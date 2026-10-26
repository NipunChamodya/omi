import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type {
  Ack,
  ClientCommand,
  Failure,
  GuestIdentity,
  RoomDescriptor,
  ServerMessage,
  Snapshot,
} from '@omi/shared';
import { cardId, createDeck, leftOf, nextSeat, teamOf } from '@omi/game-engine';
import { buildApp } from '../app.js';
import { parseConfig } from '../config.js';

const origin = 'http://127.0.0.1:5173';
type Guest = GuestIdentity & { cookie: string };
class Client {
  readonly messages: ServerMessage[] = [];
  private readonly waiters = new Set<() => void>();
  constructor(
    readonly socket: WebSocket,
    readonly guest: Guest,
    readonly roomId: string,
  ) {
    socket.on('message', (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const check of [...this.waiters]) check();
    });
    socket.on('error', () => undefined);
  }
  wait(
    predicate: (message: ServerMessage) => boolean,
    since = 0,
  ): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = this.messages.slice(since).find(predicate);
        if (found) {
          clearTimeout(timer);
          this.waiters.delete(check);
          resolve(found);
        }
      };
      const timer = setTimeout(() => {
        this.waiters.delete(check);
        reject(new Error('Timed out waiting for socket message'));
      }, 3000);
      this.waiters.add(check);
      check();
    });
  }
  async send(
    type: ClientCommand['type'],
    payload: unknown,
    expectedVersion: number,
    overrides: Record<string, unknown> = {},
  ) {
    const message = {
      roomId: this.roomId,
      actorId: this.guest.actorId,
      actionId: randomUUID(),
      expectedVersion,
      type,
      payload,
      ...overrides,
    };
    const since = this.messages.length;
    this.socket.send(JSON.stringify(message));
    const reply = await this.wait(
      (item) =>
        (item.type === 'ack' || item.type === 'error') &&
        item.actionId === message.actionId,
      since,
    );
    return { message, reply: reply as Ack | Failure };
  }
}
let app: ReturnType<typeof buildApp>;
let base: string;
const sockets: WebSocket[] = [];
beforeEach(async () => {
  app = buildApp({
    logger: false,
    config: parseConfig({
      NODE_ENV: 'test',
      ALLOW_GUESTS: 'true',
      DATABASE_PATH: ':memory:',
    }),
  });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await app.close();
});
function post(
  path: string,
  payload: object | string | undefined,
  guest?: Guest,
  suppliedOrigin = origin,
) {
  return app.inject({
    method: 'POST',
    url: path,
    ...(payload === undefined ? {} : { payload }),
    headers: {
      origin: suppliedOrigin,
      ...(guest ? { cookie: guest.cookie } : {}),
    },
  });
}
function get(path: string, guest: Guest) {
  return app.inject({
    method: 'GET',
    url: path,
    headers: { origin, cookie: guest.cookie },
  });
}
async function guest(displayName = 'Player'): Promise<Guest> {
  const response = await post('/transport/session', { displayName });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies[0]!;
  return {
    ...response.json<GuestIdentity>(),
    cookie: `${cookie.name}=${cookie.value}`,
  };
}
async function create(owner: Guest): Promise<RoomDescriptor> {
  const response = await post(
    '/rooms',
    { actorId: owner.actorId, actionId: randomUUID(), expectedVersion: 0 },
    owner,
  );
  expect(response.statusCode).toBe(201);
  return response.json<RoomDescriptor>();
}
async function join(who: Guest, room: RoomDescriptor) {
  const preview = await get(`/rooms/${room.code}/preview`, who);
  const current = preview.json<RoomDescriptor>();
  return post(
    '/rooms/join',
    {
      actorId: who.actorId,
      actionId: randomUUID(),
      roomId: room.roomId,
      code: room.code,
      expectedVersion: current.version,
    },
    who,
  );
}
async function connect(who: Guest, roomId: string): Promise<Client> {
  const socket = new WebSocket(
    `${base.replace('http', 'ws')}/rooms/${roomId}/ws`,
    { headers: { origin, cookie: who.cookie } },
  );
  sockets.push(socket);
  const client = new Client(socket, who, roomId);
  await client.wait((message) => message.type === 'snapshot');
  return client;
}
async function snap(who: Guest, roomId: string): Promise<Snapshot> {
  const response = await get(`/rooms/${roomId}/snapshot`, who);
  expect(response.statusCode).toBe(200);
  return response.json<Snapshot>();
}
async function table() {
  const guests = await Promise.all(
    ['Nipun', 'අමිල', 'Kamal', 'Nimali'].map(guest),
  );
  const room = await create(guests[0]!);
  for (const who of guests.slice(1))
    expect((await join(who, room)).statusCode).toBe(200);
  const clients = await Promise.all(
    guests.map((who) => connect(who, room.roomId)),
  );
  let version = (await snap(guests[0]!, room.roomId)).version;
  for (const client of clients) {
    const { reply } = await client.send('ready', { ready: true }, version);
    expect(reply.type).toBe('ack');
    version = reply.version!;
  }
  const start = await clients[0]!.send('start', {}, version);
  expect(start.reply.type).toBe('ack');
  return { guests, room, clients, version: start.reply.version! };
}
async function playing() {
  const setup = await table();
  let state = await snap(setup.guests[0]!, setup.room.roomId);
  const cutter = leftOf(state.game!.dealer);
  const cut = await setup.clients[cutter]!.send(
    'cut',
    { offset: 12 },
    state.version,
  );
  expect(cut.reply.type).toBe('ack');
  const selector = state.game!.selector;
  state = await snap(setup.guests[selector]!, setup.room.roomId);
  const trump = await setup.clients[selector]!.send(
    'trump',
    { suit: state.game!.hand[0]!.suit },
    state.version,
  );
  expect(trump.reply.type).toBe('ack');
  return setup;
}
function noPrivateFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect([
      'deck',
      'hands',
      'dealtHands',
      'evidence',
      'handBefore',
      'violatedFollowSuit',
      'tokenHash',
      'receipts',
      'entries',
      'settledRounds',
    ]).not.toContain(key);
    noPrivateFields(child);
  }
}
async function refusedHandshake(
  path: string,
  headers: Record<string, string>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}${path}`, {
      headers,
    });
    sockets.push(socket);
    socket.on('unexpected-response', (_req, response) => {
      response.resume();
      resolve(response.statusCode!);
    });
    socket.on('open', () =>
      reject(new Error('Unexpected authorized connection')),
    );
    socket.on('error', () => undefined);
    setTimeout(
      () => reject(new Error('Handshake did not settle')),
      3000,
    ).unref();
  });
}

describe('four-player real WebSocket integration', () => {
  it('seats exactly four in opposite teams, enforces host/ready checks, and starts only with four ready connected players', async () => {
    const guests = await Promise.all(
      ['One', 'Two', 'Three', 'Four', 'Five'].map(guest),
    );
    const room = await create(guests[0]!);
    const first = await connect(guests[0]!, room.roomId);
    let state = await snap(guests[0]!, room.roomId);
    const early = await first.send('start', {}, state.version);
    expect(early.reply).toMatchObject({
      type: 'error',
      code: 'FOUR_READY_PLAYERS_REQUIRED',
      version: state.version,
    });
    for (const who of guests.slice(1, 4))
      expect((await join(who, room)).statusCode).toBe(200);
    expect((await join(guests[4]!, room)).json().code).toBe('ROOM_FULL');
    const rest = await Promise.all(
      guests.slice(1, 4).map((who) => connect(who, room.roomId)),
    );
    state = await snap(guests[0]!, room.roomId);
    expect(state.members.map((member) => [member.seat, member.team])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]);
    expect(state.members.every((member) => member.connected)).toBe(true);
    expect(state.members.every((member) => !member.ready)).toBe(true);
    expect(
      (await rest[0]!.send('start', {}, state.version)).reply,
    ).toMatchObject({ type: 'error', code: 'HOST_REQUIRED' });
    expect(room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(room.invitePath).toBe(`/?room=${room.code}`);
    expect(
      (await get(`/rooms/${room.code}/preview`, guests[4]!)).json(),
    ).not.toHaveProperty('members');
  });
  it('plays a complete authoritative round with compact public deltas and only the recipient’s hidden cards', async () => {
    const { guests, room, clients } = await table();
    let state = await snap(guests[0]!, room.roomId);
    expect(state.game!.phase).toBe('awaiting-cut');
    expect(state.game!.hand).toHaveLength(0);
    const wrongCutter = state.game!.selector;
    expect(
      (await clients[wrongCutter]!.send('cut', { offset: 12 }, state.version))
        .reply,
    ).toMatchObject({ type: 'error', code: 'INVALID_GAME_ACTION' });
    const cut = await clients[leftOf(state.game!.dealer)]!.send(
      'cut',
      { offset: 12 },
      state.version,
    );
    expect(cut.reply.type).toBe('ack');
    const initial = await Promise.all(
      guests.map((who) => snap(who, room.roomId)),
    );
    const firstCards = initial.flatMap((item) =>
      item.game!.hand.map((held) => `${held.suit}:${held.rank}`),
    );
    expect(new Set(firstCards).size).toBe(16);
    initial.forEach((item) => {
      expect(item.game!.hand).toHaveLength(4);
      expect(item.game!.handCounts).toEqual([4, 4, 4, 4]);
      noPrivateFields(item);
    });
    const selector = state.game!.selector;
    const selected = initial[selector]!;
    expect(
      (
        await clients[selector]!.send(
          'trump',
          { suit: selected.game!.hand[0]!.suit },
          selected.version,
        )
      ).reply.type,
    ).toBe('ack');
    const full = await Promise.all(guests.map((who) => snap(who, room.roomId)));
    expect(
      new Set(
        full.flatMap((item) =>
          item.game!.hand.map((held) => `${held.suit}:${held.rank}`),
        ),
      ).size,
    ).toBe(32);
    full.forEach((item) => expect(item.game!.hand).toHaveLength(8));
    await Promise.all(
      clients.map((client) =>
        client.wait(
          (message) =>
            message.type === 'event' &&
            message.event.kind === 'cards-dealt' &&
            message.event.stage === 'second',
        ),
      ),
    );
    for (let seat = 0; seat < 4; seat++) {
      const dealEvents = clients[seat]!.messages.filter(
        (message) =>
          message.type === 'event' && message.event.kind === 'cards-dealt',
      );
      expect(dealEvents).toHaveLength(2);
      for (const message of dealEvents) {
        if (message.type !== 'event' || message.event.kind !== 'cards-dealt')
          throw new Error('Expected deal');
        const expected =
          message.event.stage === 'first'
            ? initial[seat]!.game!.hand
            : full[seat]!.game!.hand;
        expect(message.event.hand).toEqual(expected);
        noPrivateFields(message);
      }
    }
    const since = clients.map((client) => client.messages.length);
    let actor = selector;
    for (let i = 0; i < 32; i++) {
      state = await snap(guests[actor]!, room.roomId);
      const next = await clients[actor]!.send(
        'play',
        { card: state.game!.hand[0]! },
        state.version,
      );
      expect(next.reply.type).toBe('ack');
      const event = await clients[actor]!.wait(
        (message) =>
          message.type === 'event' && message.version === next.reply.version,
      );
      if (event.type !== 'event' || event.event.kind !== 'card-played')
        throw new Error('Expected play delta');
      expect(event.fromVersion + 1).toBe(event.version);
      noPrivateFields(event);
      expect(event.event.handCounts.reduce((a, b) => a + b)).toBe(31 - i);
      expect(event.event).not.toHaveProperty('hand');
      if (i < 31) actor = event.event.turn!;
    }
    await Promise.all(
      clients.map((client) =>
        client.wait(
          (message) =>
            message.type === 'event' &&
            message.event.kind === 'card-played' &&
            message.event.phase === 'complete',
        ),
      ),
    );
    for (let i = 0; i < clients.length; i++) {
      const messages = clients[i]!.messages.slice(since[i]);
      expect(messages.some((message) => message.type === 'snapshot')).toBe(
        false,
      );
      expect(
        messages.filter(
          (message) =>
            message.type === 'event' && message.event.kind === 'card-played',
        ),
      ).toHaveLength(32);
      messages.forEach(noPrivateFields);
    }
    state = await snap(guests[0]!, room.roomId);
    expect(state.game!.phase).toBe('complete');
    expect(state.game!.tricks).toHaveLength(8);
    expect(state.game!.handCounts).toEqual([0, 0, 0, 0]);
    expect(state.result!.status).toBe('settled');
    expect(
      (await clients[0]!.send('next-round', {}, state.version)).reply,
    ).toMatchObject({ type: 'error', code: 'UNRESOLVED_RULE' });
  });
  it('serializes conflicting actions, prevents duplicate/reused IDs, and resynchronizes stale clients', async () => {
    const { guests, room, clients } = await playing();
    const view = await snap(guests[0]!, room.roomId);
    const actor = view.game!.turn!;
    const own = await snap(guests[actor]!, room.roomId);
    const client = clients[actor]!;
    const commands = await Promise.all([
      client.send('play', { card: own.game!.hand[0]! }, own.version),
      client.send('play', { card: own.game!.hand[1]! }, own.version),
    ]);
    expect(commands.filter((item) => item.reply.type === 'ack')).toHaveLength(
      1,
    );
    expect(
      commands.filter(
        (item) =>
          item.reply.type === 'error' && item.reply.code === 'VERSION_CONFLICT',
      ),
    ).toHaveLength(1);
    const accepted = commands.find((item) => item.reply.type === 'ack')!;
    const beforeDuplicate = await snap(guests[actor]!, room.roomId);
    const duplicate = await client.send(
      'play',
      accepted.message.payload,
      own.version,
      { actionId: accepted.message.actionId },
    );
    expect(duplicate.reply).toMatchObject({
      type: 'ack',
      duplicate: true,
      version: accepted.reply.version,
    });
    const reused = await client.send(
      'play',
      { card: own.game!.hand[1]! },
      own.version,
      { actionId: accepted.message.actionId },
    );
    expect(reused.reply).toMatchObject({
      type: 'error',
      code: 'ACTION_ID_REUSED',
    });
    const after = await snap(guests[actor]!, room.roomId);
    expect(after.version).toBe(beforeDuplicate.version);
    expect(after.game!.hand).toHaveLength(7);
    const resumed = await connect(guests[actor]!, room.roomId);
    const retry = await resumed.send(
      'play',
      accepted.message.payload,
      own.version,
      { actionId: accepted.message.actionId },
    );
    expect(retry.reply).toMatchObject({ type: 'ack', duplicate: true });
    expect((await snap(guests[actor]!, room.roomId)).game!.hand).toHaveLength(
      7,
    );
    const requestId = randomUUID();
    resumed.socket.send(
      JSON.stringify({
        roomId: room.roomId,
        actorId: client.guest.actorId,
        actionId: requestId,
        expectedVersion: 0,
        type: 'sync',
        payload: {},
      }),
    );
    const synced = await resumed.wait(
      (message) =>
        message.type === 'snapshot' && message.requestId === requestId,
    );
    expect(synced).toMatchObject({
      version: after.version,
      game: { hand: after.game!.hand },
    });
  });
  it('reconnects to the same seat/hand/version and safely replaces an older connection', async () => {
    const { guests, room, clients } = await playing();
    const before = await snap(guests[1]!, room.roomId);
    const old = clients[1]!;
    const close = new Promise<number>((resolve) =>
      old.socket.once('close', resolve),
    );
    const resumed = await connect(guests[1]!, room.roomId);
    expect(await close).toBe(4001);
    const state = await snap(guests[1]!, room.roomId);
    expect(state.version).toBe(before.version);
    expect(state.you).toEqual(before.you);
    expect(state.game).toEqual(before.game);
    expect(state.members[1]!.connected).toBe(true);
    const observerSince = clients[0]!.messages.length;
    resumed.socket.terminate();
    await clients[0]!.wait(
      (message) =>
        message.type === 'event' &&
        message.event.kind === 'presence' &&
        message.event.seat === 1 &&
        !message.event.connected,
      observerSince,
    );
    const offline = await snap(guests[0]!, room.roomId);
    expect(offline.members[1]!.connected).toBe(false);
    const reconnected = await connect(guests[1]!, room.roomId);
    const restored = await snap(guests[1]!, room.roomId);
    expect(restored.you.seat).toBe(1);
    expect(restored.game!.hand).toEqual(before.game!.hand);
    expect(restored.version).toBe(offline.version + 1);
    noPrivateFields(reconnected.messages);
  });
});

describe('transport security regressions', () => {
  it('rejects foreign/missing origins and missing/forged cookies on HTTP and WebSocket upgrades', async () => {
    expect(
      (
        await post(
          '/transport/session',
          { displayName: 'attacker' },
          undefined,
          'https://evil.example',
        )
      ).statusCode,
    ).toBe(403);
    const noOrigin = await app.inject({
      method: 'POST',
      url: '/transport/session',
      payload: { displayName: 'one' },
    });
    expect(noOrigin.statusCode).toBe(403);
    const owner = await guest();
    const room = await create(owner);
    const path = `/rooms/${room.roomId}/ws`;
    expect(await refusedHandshake(path, { origin })).toBe(401);
    expect(
      await refusedHandshake(path, { origin, cookie: 'omi_transport=forged' }),
    ).toBe(401);
    expect(
      await refusedHandshake(path, {
        origin: 'https://evil.example',
        cookie: owner.cookie,
      }),
    ).toBe(403);
    expect(
      await refusedHandshake(`${path}?token=forbidden`, {
        origin,
        cookie: owner.cookie,
      }),
    ).toBe(400);
    const outsider = await guest('Outsider');
    expect(
      await refusedHandshake(path, { origin, cookie: outsider.cookie }),
    ).toBe(404);
    expect(
      (await get(`/rooms/${room.roomId}/snapshot`, outsider)).statusCode,
    ).toBe(404);
  });
  it('preserves HttpOnly guest identity in development and forbids guest entry in production', async () => {
    const response = await post('/transport/session', { displayName: 'සිංහල' });
    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(response.headers['set-cookie'])).toContain('SameSite=Strict');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).not.toHaveProperty('token');
    const cookie = response.cookies[0]!;
    const original = response.json<GuestIdentity>();
    const again = await app.inject({
      method: 'POST',
      url: '/transport/session',
      headers: { origin, cookie: `${cookie.name}=${cookie.value}` },
      payload: { displayName: 'ignored' },
    });
    expect(again.json()).toEqual(original);
    const production = buildApp({
      logger: false,
      config: parseConfig({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://omi.example',
        DATABASE_PATH: ':memory:',
      }),
    });
    try {
      const secure = await production.inject({
        method: 'POST',
        url: '/transport/session',
        headers: { origin: 'https://omi.example' },
        payload: { displayName: 'one' },
      });
      expect(secure.statusCode).toBe(401);
      expect(secure.json().code).toBe('LOGIN_REQUIRED');
    } finally {
      await production.close();
    }
  });
  it('binds actor and room to the connection, validates strict messages, and rejects client-owned results or hidden-card queries', async () => {
    const { guests, room, clients } = await playing();
    const state = await snap(guests[0]!, room.roomId);
    const client = clients[0]!;
    const spoof = await client.send('ready', { ready: true }, state.version, {
      actorId: guests[1]!.actorId,
    });
    expect(spoof.reply).toMatchObject({
      type: 'error',
      code: 'ACTOR_MISMATCH',
    });
    const otherRoom = await client.send(
      'ready',
      { ready: true },
      state.version,
      { roomId: randomUUID() },
    );
    expect(otherRoom.reply).toMatchObject({
      type: 'error',
      code: 'ROOM_MISMATCH',
    });
    for (const payload of [
      '{',
      JSON.stringify({ ...otherRoom.message, payload: { score: 999 } }),
      JSON.stringify({ ...otherRoom.message, winner: 0 }),
    ]) {
      const since = client.messages.length;
      client.socket.send(payload);
      expect(
        await client.wait((message) => message.type === 'error', since),
      ).toMatchObject({ code: 'INVALID_MESSAGE', actionId: null });
    }
    for (const playId of [0, 31])
      expect(
        (await client.send('accuse', { playId }, state.version)).reply,
      ).toMatchObject({ type: 'error', code: 'UNRESOLVED_RULE' });
    expect(
      (await client.send('report-no-trump', {}, state.version)).reply,
    ).toMatchObject({ type: 'error', code: 'UNRESOLVED_RULE' });
    expect((await snap(guests[0]!, room.roomId)).version).toBe(state.version);
    const actor = state.game!.turn!;
    const own = await snap(guests[actor]!, room.roomId);
    const foreign = await snap(guests[nextSeat(actor)]!, room.roomId);
    const denied = await clients[actor]!.send(
      'play',
      { card: foreign.game!.hand[0]! },
      own.version,
    );
    expect(denied.reply).toMatchObject({
      type: 'error',
      code: 'INVALID_GAME_ACTION',
    });
    const wrongTurn = await clients[nextSeat(actor)]!.send(
      'play',
      { card: foreign.game!.hand[0]! },
      own.version,
    );
    expect(wrongTurn.reply).toMatchObject({
      type: 'error',
      code: 'INVALID_GAME_ACTION',
    });
    noPrivateFields(clients.flatMap((item) => item.messages));
  });
  it('serializes competing joins for the final seat and makes HTTP creation/join retries idempotent', async () => {
    const guests = await Promise.all(
      ['one', 'two', 'three', 'four', 'five'].map(guest),
    );
    const actionId = randomUUID();
    const body = { actorId: guests[0]!.actorId, actionId, expectedVersion: 0 };
    const first = await post('/rooms', body, guests[0]!);
    const repeated = await post('/rooms', body, guests[0]!);
    expect(repeated.json()).toEqual(first.json());
    const room = first.json<RoomDescriptor>();
    expect((await join(guests[1]!, room)).statusCode).toBe(200);
    expect((await join(guests[2]!, room)).statusCode).toBe(200);
    const current = (
      await get(`/rooms/${room.code}/preview`, guests[3]!)
    ).json<RoomDescriptor>();
    const bodies = guests.slice(3).map((who) => ({
      roomId: room.roomId,
      code: room.code,
      expectedVersion: current.version,
      actorId: who.actorId,
      actionId: randomUUID(),
    }));
    const attempts = await Promise.all(
      bodies.map((payload, i) => post('/rooms/join', payload, guests[i + 3]!)),
    );
    expect(attempts.map((item) => item.statusCode).sort()).toEqual([200, 409]);
    const winner = attempts.findIndex((item) => item.statusCode === 200);
    const duplicate = await post(
      '/rooms/join',
      bodies[winner],
      guests[winner + 3]!,
    );
    expect(duplicate.json()).toEqual(attempts[winner]!.json());
    const state = await snap(guests[0]!, room.roomId);
    expect(state.members).toHaveLength(4);
    expect(new Set(state.members.map((member) => member.actorId)).size).toBe(4);
    expect(
      (
        await post(
          '/rooms',
          { ...body, actorId: guests[1]!.actorId },
          guests[0]!,
        )
      ).statusCode,
    ).toBe(403);
  });
});

async function reset(options: Parameters<typeof buildApp>[0] = {}) {
  for (const socket of sockets.splice(0)) socket.terminate();
  await app.close();
  app = buildApp({
    ...options,
    config:
      options.config ??
      parseConfig({
        NODE_ENV: 'test',
        ALLOW_GUESTS: 'true',
        DATABASE_PATH: ':memory:',
      }),
    logger: false,
  });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
}
function closeCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => socket.once('close', resolve));
}

describe('resource and lifetime bounds', () => {
  it('bounds sessions and active rooms', async () => {
    await reset({ multiplayer: { limits: { maxSessions: 2, maxRooms: 1 } } });
    const first = await guest('one');
    const second = await guest('two');
    expect(
      (await post('/transport/session', { displayName: 'three' })).json().code,
    ).toBe('SESSION_CAPACITY');
    await create(first);
    const response = await post(
      '/rooms',
      { actorId: second.actorId, actionId: randomUUID(), expectedVersion: 0 },
      second,
    );
    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe('ROOM_CAPACITY');
  });
  it('bounds deduplication history without reopening replayed actions when capacity is reached', async () => {
    await reset({ multiplayer: { limits: { actionsPerMember: 2 } } });
    const owner = await guest();
    const room = await create(owner);
    const client = await connect(owner, room.roomId);
    const state = await snap(owner, room.roomId);
    const first = await client.send('ready', { ready: true }, state.version);
    expect(first.reply.type).toBe('ack');
    const second = await client.send(
      'ready',
      { ready: false },
      first.reply.version!,
    );
    expect(second.reply.type).toBe('ack');
    expect(
      (await client.send('ready', { ready: true }, second.reply.version!))
        .reply,
    ).toMatchObject({ type: 'error', code: 'ACTION_BUDGET_EXHAUSTED' });
    const duplicate = await client.send(
      'ready',
      { ready: true },
      state.version,
      { actionId: first.message.actionId },
    );
    expect(duplicate.reply).toMatchObject({ type: 'ack', duplicate: true });
    expect((await snap(owner, room.roomId)).members[0]!.ready).toBe(false);
  });
  it('rate limits HTTP requests and messages across reconnects', async () => {
    await reset({ multiplayer: { limits: { httpPerMinute: 2 } } });
    const owner = await guest();
    const room = await create(owner);
    expect((await get(`/rooms/${room.code}/preview`, owner)).statusCode).toBe(
      429,
    );
    await reset({ multiplayer: { limits: { messagesPerTenSeconds: 2 } } });
    const second = await guest();
    const secondRoom = await create(second);
    const client = await connect(second, secondRoom.roomId);
    for (let i = 0; i < 2; i++) {
      const requestId = randomUUID();
      client.socket.send(
        JSON.stringify({
          roomId: secondRoom.roomId,
          actorId: second.actorId,
          actionId: requestId,
          expectedVersion: 0,
          type: 'sync',
          payload: {},
        }),
      );
      await client.wait(
        (message) =>
          message.type === 'snapshot' && message.requestId === requestId,
      );
    }
    const closed = closeCode(client.socket);
    client.socket.send('{}');
    expect(await closed).toBe(1008);
    const resumed = await connect(second, secondRoom.roomId);
    const closedAgain = closeCode(resumed.socket);
    resumed.socket.send('{}');
    expect(await closedAgain).toBe(1008);
  });
  it('expires sessions on active sockets and releases idle rooms without inventing forfeits', async () => {
    let now = 0;
    await reset({
      multiplayer: {
        now: () => now,
        limits: { sessionTtlMs: 100, idleRoomTtlMs: 50 },
      },
    });
    const owner = await guest();
    const room = await create(owner);
    const client = await connect(owner, room.roomId);
    const closed = closeCode(client.socket);
    now = 100;
    client.socket.send('{}');
    expect(await closed).toBe(1008);
    expect(
      (await get(`/rooms/${room.roomId}/snapshot`, owner)).statusCode,
    ).toBe(401);
    // The client close event can arrive before the server's queued detach.
    // Observe authoritative offline state before advancing the fake idle clock.
    const observer = await guest('observer');
    expect((await join(observer, room)).statusCode).toBe(200);
    const observerClient = await connect(observer, room.roomId);
    const observerClosed = closeCode(observerClient.socket);
    observerClient.socket.close();
    await observerClosed;
    await expect
      .poll(async () =>
        (await snap(observer, room.roomId)).members.every(
          (member) => !member.connected,
        ),
      )
      .toBe(true);
    now = 200;
    const replacement = await guest('new identity');
    expect(replacement.actorId).not.toBe(owner.actorId);
    const newRoom = await create(replacement); // Creation sweeps the expired disconnected room.
    expect(newRoom.roomId).not.toBe(room.roomId);
    expect(
      (await get(`/rooms/${room.code}/preview`, replacement)).statusCode,
    ).toBe(404);
  });
  it('closes binary and oversized frames and drops a connection that exceeds the outbound buffer bound', async () => {
    const owner = await guest();
    const room = await create(owner);
    const first = await connect(owner, room.roomId);
    let closed = closeCode(first.socket);
    first.socket.send(Buffer.from('{}'));
    expect(await closed).toBe(1003);
    const second = await connect(owner, room.roomId);
    closed = closeCode(second.socket);
    second.socket.send('x'.repeat(4097));
    expect(await closed).toBe(1009);
    await reset({ multiplayer: { limits: { maxBufferedBytes: 1 } } });
    const limited = await guest();
    const limitedRoom = await create(limited);
    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/rooms/${limitedRoom.roomId}/ws`,
      { headers: { origin, cookie: limited.cookie } },
    );
    sockets.push(socket);
    socket.on('error', () => undefined);
    expect(await closeCode(socket)).toBe(1006);
    const state = await snap(limited, limitedRoom.roomId);
    expect(state.members[0]!.connected).toBe(false);
  });
});

describe('private gameplay deception over the transport', () => {
  it('accepts a deliberate violation silently; only an explicit eligible manual report transfers three points once', async () => {
    let seed = 19;
    const entropy = (bound: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 2 ** 32) * bound);
    };
    // Hypothetical TEST policy; not an owner rule and never enabled by default.
    await reset({
      multiplayer: {
        entropy,
        policies: { accusationWindow: () => 'eligible' },
      },
    });
    const { guests, room, clients } = await playing();
    const states = await Promise.all(
      guests.map((who) => snap(who, room.roomId)),
    );
    const leader = states[0]!.game!.turn!;
    const offender = nextSeat(leader);
    const lead = states[leader]!.game!.hand.find(
      (held) =>
        states[offender]!.game!.hand.some(
          (other) => other.suit === held.suit,
        ) &&
        states[offender]!.game!.hand.some((other) => other.suit !== held.suit),
    );
    expect(lead).toBeDefined();
    const offSuit = states[offender]!.game!.hand.find(
      (held) => held.suit !== lead!.suit,
    )!;
    const first = await clients[leader]!.send(
      'play',
      { card: lead },
      states[0]!.version,
    );
    expect(first.reply.type).toBe('ack');
    const second = await clients[offender]!.send(
      'play',
      { card: offSuit },
      first.reply.version!,
    );
    expect(second.reply.type).toBe('ack');
    const beforeReport = await snap(guests[leader]!, room.roomId);
    expect(beforeReport.score.totals).toEqual([0, 0]);
    expect(beforeReport.game!.trick).toHaveLength(2);
    for (const client of clients) {
      await client.wait(
        (message) =>
          message.type === 'event' && message.version === second.reply.version,
      );
      noPrivateFields(client.messages);
      expect(
        client.messages.some(
          (message) =>
            message.type === 'event' &&
            message.event.kind === 'score-transferred',
        ),
      ).toBe(false);
    }
    const manual = await clients[leader]!.send(
      'accuse',
      { playId: 1 },
      beforeReport.version,
    );
    expect(manual.reply.type).toBe('ack');
    const reported = await snap(guests[leader]!, room.roomId);
    expect(reported.score.totals[teamOf(offender)]).toBe(-3);
    expect(reported.score.totals[teamOf(leader)]).toBe(3);
    const again = await clients[leader]!.send(
      'accuse',
      { playId: 1 },
      reported.version,
    );
    expect(again.reply).toMatchObject({
      type: 'error',
      code: 'REPORT_ALREADY_APPLIED',
    });
    expect((await snap(guests[leader]!, room.roomId)).score).toEqual(
      reported.score,
    );
  });
});

describe('trusted policy extension integration', () => {
  it('cancels and fully restarts a verified no-trump round only under explicit test policies', async () => {
    const deck = createDeck();
    const hands = [
      deck.slice(0, 8),
      deck.slice(8, 16),
      deck.slice(24, 32),
      deck.slice(16, 24),
    ];
    const cut = [
      ...hands.flatMap((hand) => hand.slice(0, 4)),
      ...hands.flatMap((hand) => hand.slice(4)),
    ];
    const target = [...cut.slice(16), ...cut.slice(0, 16)];
    const working = [...deck];
    const entropyValues = [3]; // Initial dealer; then exact Fisher–Yates swaps for the fixture.
    for (let i = 31; i > 0; i--) {
      const j = working.findIndex(
        (held) => cardId(held) === cardId(target[i]!),
      );
      expect(j).toBeLessThanOrEqual(i);
      entropyValues.push(j);
      [working[i], working[j]] = [working[j]!, working[i]!];
    }
    await reset({
      multiplayer: {
        entropy: (bound) => entropyValues.shift() ?? bound - 1,
        // Hypothetical TEST rules, never installed by default.
        policies: {
          noTrump: () => 'initial-deal',
          replacementDealer: (round) => nextSeat(round.dealer),
        },
      },
    });
    const { guests, clients, room } = await table();
    const initial = await snap(guests[0]!, room.roomId);
    expect(initial.game!.dealer).toBe(3);
    const dealt = await clients[2]!.send(
      'cut',
      { offset: 16 },
      initial.version,
    );
    expect(dealt.reply.type).toBe('ack');
    const trump = await clients[0]!.send(
      'trump',
      { suit: 'spades' },
      dealt.reply.version!,
    );
    expect(trump.reply.type).toBe('ack');
    const report = await clients[1]!.send(
      'report-no-trump',
      {},
      trump.reply.version!,
    );
    expect(report.reply.type).toBe('ack');
    const cancelled = await snap(guests[1]!, room.roomId);
    expect(cancelled.game!.phase).toBe('cancelled');
    expect(cancelled.score.totals).toEqual([0, 0]);
    expect(
      (
        await clients[0]!.send(
          'play',
          { card: { suit: 'spades', rank: 'A' } },
          cancelled.version,
        )
      ).reply,
    ).toMatchObject({ type: 'error', code: 'INVALID_GAME_ACTION' });
    const restart = await clients[0]!.send('restart', {}, cancelled.version);
    expect(restart.reply.type).toBe('ack');
    const restarted = await snap(guests[0]!, room.roomId);
    expect(restarted.game!.id).not.toBe(initial.game!.id);
    expect(restarted.game!.phase).toBe('awaiting-cut');
    expect(restarted.game!.dealer).toBe(0);
    expect(restarted.game!.selector).toBe(1);
    expect(restarted.game!.handCounts).toEqual([0, 0, 0, 0]);
    expect(restarted.game!.tricks).toEqual([]);
    expect(restarted.score).toEqual(cancelled.score);
    noPrivateFields(restarted);
    expect(
      (await clients[3]!.send('cut', { offset: 8 }, restarted.version)).reply
        .type,
    ).toBe('ack');
  });
  it('preserves the score ledger into another round only with an explicit test dealer policy', async () => {
    await reset({
      multiplayer: {
        policies: { nextDealer: (round) => nextSeat(round.dealer) },
      },
    });
    const { guests, clients, room } = await playing();
    let state = await snap(guests[0]!, room.roomId);
    for (let i = 0; i < 32; i++) {
      const actor = state.game!.turn!;
      const own = await snap(guests[actor]!, room.roomId);
      expect(
        (
          await clients[actor]!.send(
            'play',
            { card: own.game!.hand[0]! },
            own.version,
          )
        ).reply.type,
      ).toBe('ack');
      state = await snap(guests[0]!, room.roomId);
    }
    const completed = state;
    expect(completed.result!.status).toBe('settled');
    expect(
      (await clients[1]!.send('next-round', {}, completed.version)).reply,
    ).toMatchObject({ type: 'error', code: 'HOST_REQUIRED' });
    expect(
      (await clients[0]!.send('next-round', {}, completed.version)).reply.type,
    ).toBe('ack');
    state = await snap(guests[0]!, room.roomId);
    expect(state.game!.phase).toBe('awaiting-cut');
    expect(state.game!.dealer).toBe(nextSeat(completed.game!.dealer));
    expect(state.game!.id).not.toBe(completed.game!.id);
    expect(state.score).toEqual(completed.score);
    expect(state.result).toBeNull();
  });
  it('keeps separate rooms isolated and accepts an immediate authenticated sync frame on connect', async () => {
    const { guests, clients, room } = await playing();
    const outsider = await guest('Other room');
    const other = await create(outsider);
    const otherClient = await connect(outsider, other.roomId);
    const state = await snap(outsider, other.roomId);
    const change = await otherClient.send(
      'ready',
      { ready: true },
      state.version,
    );
    expect(change.reply.type).toBe('ack');
    expect(
      (await get(`/rooms/${room.roomId}/snapshot`, outsider)).statusCode,
    ).toBe(404);
    expect(
      (await get(`/rooms/${other.roomId}/snapshot`, guests[0]!)).statusCode,
    ).toBe(404);
    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/rooms/${other.roomId}/ws`,
      { headers: { origin, cookie: outsider.cookie } },
    );
    sockets.push(socket);
    const immediate = new Client(socket, outsider, other.roomId);
    const requestId = randomUUID();
    socket.once('open', () =>
      socket.send(
        JSON.stringify({
          type: 'sync',
          payload: {},
          roomId: other.roomId,
          actorId: outsider.actorId,
          actionId: requestId,
          expectedVersion: 0,
        }),
      ),
    );
    expect(
      await immediate.wait(
        (message) =>
          message.type === 'snapshot' && message.requestId === requestId,
      ),
    ).toMatchObject({ roomId: other.roomId });
    expect(
      clients
        .flatMap((client) => client.messages)
        .every((message) => message.roomId === room.roomId),
    ).toBe(true);
    expect(
      immediate.messages.every((message) => message.roomId === other.roomId),
    ).toBe(true);
  });
});

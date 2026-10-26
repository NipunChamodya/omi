import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID, createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { buildApp } from '../app.js';
import { parseConfig } from '../config.js';
import { iceConfiguration } from './config.js';
import type { VoiceMessage, VoiceParticipant } from '@omi/shared';
const origin = 'http://127.0.0.1:5173';
let app: ReturnType<typeof buildApp>;
let base: string;
const sockets: WebSocket[] = [];
type Player = { actorId: string; cookie: string };
type Wire = {
  socket: WebSocket;
  messages: unknown[];
  wait: (
    test: (item: Record<string, unknown>) => boolean,
  ) => Promise<Record<string, unknown>>;
};
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
const post = (path: string, player: Player, payload: object = {}) =>
  app.inject({
    method: 'POST',
    url: path,
    headers: { origin, cookie: player.cookie },
    payload,
  });
async function player(): Promise<Player> {
  const reply = await app.inject({
    method: 'POST',
    url: '/transport/session',
    headers: { origin },
    payload: { displayName: 'Voice player' },
  });
  return {
    actorId: reply.json<{ actorId: string }>().actorId,
    cookie: `${reply.cookies[0]!.name}=${reply.cookies[0]!.value}`,
  };
}
async function room(owner: Player) {
  return (
    await post('/rooms', owner, {
      actorId: owner.actorId,
      actionId: randomUUID(),
      expectedVersion: 0,
    })
  ).json<{ roomId: string; code: string; version: number }>();
}
function wire(path: string, player: Player): Wire {
  const socket = new WebSocket(base.replace('http:', 'ws:') + path, {
    headers: { origin, cookie: player.cookie },
  });
  sockets.push(socket);
  const messages: unknown[] = [];
  socket.on('message', (data) =>
    messages.push(JSON.parse(String(data)) as unknown),
  );
  socket.on('error', () => undefined);
  return {
    socket,
    messages,
    wait: async (predicate) => {
      let found: Record<string, unknown> | undefined;
      await expect
        .poll(() => {
          found = messages.find((item) =>
            predicate(item as Record<string, unknown>),
          ) as Record<string, unknown> | undefined;
          return Boolean(found);
        })
        .toBe(true);
      return found!;
    },
  };
}
async function game(roomId: string, p: Player) {
  const client = wire(`/rooms/${roomId}/ws`, p);
  await client.wait((m) => m.type === 'snapshot');
  return client;
}
async function voice(roomId: string, p: Player) {
  const client = wire(`/rooms/${roomId}/voice/ws`, p);
  const hello = await client.wait((m) => m.type === 'hello');
  return { ...client, self: hello.self as VoiceParticipant };
}
const signal = (
  roomId: string,
  from: Player,
  self: VoiceParticipant,
  target: VoiceParticipant,
  expectedVersion = 0,
) => ({
  type: 'signal',
  roomId,
  actorId: from.actorId,
  callId: self.callId,
  actionId: randomUUID(),
  expectedVersion,
  target: { actorId: target.actorId, callId: target.callId },
  payload: {
    kind: 'description',
    description: {
      type: 'offer',
      sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
    },
  },
});
it('requires a connected game member and exact Origin before issuing ICE configuration', async () => {
  const p = await player();
  const r = await room(p);
  expect((await post(`/rooms/${r.roomId}/voice/config`, p)).statusCode).toBe(
    403,
  );
  await game(r.roomId, p);
  const config = await post(`/rooms/${r.roomId}/voice/config`, p);
  expect(config.statusCode).toBe(200);
  expect(config.headers['cache-control']).toBe('no-store');
  expect(config.json().relayAvailable).toBe(false);
  const outsider = await player();
  expect(
    (await post(`/rooms/${r.roomId}/voice/config`, outsider)).statusCode,
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: `/rooms/${r.roomId}/voice/config`,
        headers: { cookie: p.cookie },
        payload: {},
      })
    ).statusCode,
  ).toBe(403);
});
it('routes four-member audio signaling only to the intended peer without changing game version', async () => {
  const people = await Promise.all(Array.from({ length: 4 }, () => player()));
  const r = await room(people[0]!);
  for (const p of people.slice(1)) {
    const preview = (await post('/rooms/preview', p, { code: r.code })).json<{
      version: number;
    }>();
    expect(
      (
        await post('/rooms/join', p, {
          roomId: r.roomId,
          code: r.code,
          actorId: p.actorId,
          actionId: randomUUID(),
          expectedVersion: preview.version,
        })
      ).statusCode,
    ).toBe(200);
  }
  const games = [];
  for (const p of people) games.push(await game(r.roomId, p));
  const before = (
    await post('/rooms/snapshot', people[0]!, { roomId: r.roomId })
  ).json<{ version: number }>().version;
  const calls: Awaited<ReturnType<typeof voice>>[] = [];
  for (const p of people) calls.push(await voice(r.roomId, p));
  const command = signal(r.roomId, people[0]!, calls[0]!.self, calls[1]!.self);
  calls[0]!.socket.send(JSON.stringify(command));
  const received = await calls[1]!.wait((m) => m.type === 'signal');
  expect((received.from as VoiceParticipant).actorId).toBe(people[0]!.actorId);
  await calls[0]!.wait((m) => m.type === 'ack');
  expect(
    calls[2]!.messages.some((m) => (m as VoiceMessage).type === 'signal'),
  ).toBe(false);
  expect(
    calls[3]!.messages.some((m) => (m as VoiceMessage).type === 'signal'),
  ).toBe(false);
  expect(
    (await post('/rooms/snapshot', people[0]!, { roomId: r.roomId })).json()
      .version,
  ).toBe(before);
  expect(JSON.stringify(received)).not.toMatch(/hand|ledger|violation/);
  calls[0]!.socket.send(JSON.stringify(command));
  await expect
    .poll(
      () =>
        calls[0]!.messages.filter((message) => {
          const value = message as { type: string; actionId?: string };
          return value.type === 'ack' && value.actionId === command.actionId;
        }).length,
    )
    .toBe(2);
  expect(
    calls[1]!.messages.filter((m) => (m as VoiceMessage).type === 'signal'),
  ).toHaveLength(1);
  games[0]!.socket.close();
  await expect.poll(() => calls[0]!.socket.readyState).toBe(WebSocket.CLOSED);
  await calls[1]!.wait(
    (m) => m.type === 'left' && m.actorId === people[0]!.actorId,
  );
});
it.each(['actor', 'call', 'version', 'room', 'video', 'extra'])(
  'rejects forged or invalid %s signaling without affecting gameplay',
  async (fault) => {
    const p = await player();
    const r = await room(p);
    const g = await game(r.roomId, p);
    const v = await voice(r.roomId, p);
    const command = signal(r.roomId, p, v.self, {
      actorId: randomUUID(),
      callId: randomUUID(),
      muted: false,
    });
    if (fault === 'actor') command.actorId = randomUUID();
    if (fault === 'call') command.callId = randomUUID();
    if (fault === 'version') command.expectedVersion = 2;
    if (fault === 'room') command.roomId = randomUUID();
    if (fault === 'video')
      command.payload.description.sdp =
        'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 111\r\n';
    v.socket.send(
      JSON.stringify(fault === 'extra' ? { ...command, hand: [] } : command),
    );
    await expect.poll(() => v.socket.readyState).toBe(WebSocket.CLOSED);
    expect(g.socket.readyState).toBe(WebSocket.OPEN);
  },
);
it('closes voice immediately on logout and isolates binary audio from signaling', async () => {
  const p = await player();
  const r = await room(p);
  await game(r.roomId, p);
  const v = await voice(r.roomId, p);
  await post('/auth/logout', p);
  await expect.poll(() => v.socket.readyState).toBe(WebSocket.CLOSED);
  const p2 = await player();
  const r2 = await room(p2);
  await game(r2.roomId, p2);
  const v2 = await voice(r2.roomId, p2);
  v2.socket.send(Buffer.from([0, 1, 2]));
  await expect.poll(() => v2.socket.readyState).toBe(WebSocket.CLOSED);
});
it('mints expiring scoped TURN credentials without returning the shared secret', () => {
  const secret = 'x'.repeat(32);
  const config = parseConfig({
    VOICE_STUN_URLS: 'stun:stun.example:3478',
    VOICE_TURN_URLS: 'turns:relay.example:5349?transport=tcp',
    VOICE_TURN_SECRET: secret,
    VOICE_ICE_POLICY: 'relay',
  });
  const actor = randomUUID();
  const ice = iceConfiguration(config, actor, 1000);
  const server = ice.iceServers[1]!;
  expect(server.username).toBe(`3601:${actor}`);
  expect(server.credential).toBe(
    createHmac('sha1', secret).update(server.username!).digest('base64'),
  );
  expect(ice.expiresAt).toBe(3_601_000);
  expect(ice.iceTransportPolicy).toBe('relay');
  expect(JSON.stringify(ice)).not.toContain(secret);
  for (const bad of [
    { VOICE_ICE_POLICY: 'relay' },
    { VOICE_TURN_URLS: 'turn:relay.example' },
    { VOICE_STUN_URLS: 'https://evil.example' },
    { VOICE_TURN_SECRET: secret },
  ])
    expect(() => parseConfig(bad)).toThrow();
});

it('never delivers a signal to a participant in another private room', async () => {
  const a = await player();
  const b = await player();
  const first = await room(a);
  const second = await room(b);
  await game(first.roomId, a);
  await game(second.roomId, b);
  const av = await voice(first.roomId, a);
  const bv = await voice(second.roomId, b);
  const command = signal(first.roomId, a, av.self, bv.self);
  av.socket.send(JSON.stringify(command));
  await av.wait((message) => message.type === 'ack');
  expect(
    bv.messages.some((message) => (message as VoiceMessage).type === 'signal'),
  ).toBe(false);
});
it('refuses changed contents under an already acknowledged voice action ID', async () => {
  const p = await player();
  const r = await room(p);
  const g = await game(r.roomId, p);
  const v = await voice(r.roomId, p);
  const command = {
    type: 'mute',
    roomId: r.roomId,
    actorId: p.actorId,
    callId: v.self.callId,
    actionId: randomUUID(),
    expectedVersion: 0,
    payload: { muted: true },
  };
  v.socket.send(JSON.stringify(command));
  await v.wait((message) => message.type === 'ack');
  v.socket.send(JSON.stringify({ ...command, payload: { muted: false } }));
  await expect.poll(() => v.socket.readyState).toBe(WebSocket.CLOSED);
  expect(g.socket.readyState).toBe(WebSocket.OPEN);
});

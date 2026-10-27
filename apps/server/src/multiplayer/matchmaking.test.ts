import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { MatchmakingMessage, Snapshot } from '@omi/shared';
import { buildApp } from '../app.js';
import { parseConfig } from '../config.js';
import { SqliteAccounts } from '../persistence/repository.js';
import { digest } from '../auth/accounts.js';
const origin = 'http://127.0.0.1:5173';
let repo: SqliteAccounts,
  app: ReturnType<typeof buildApp>,
  base: string,
  now: number;
const sockets: WebSocket[] = [];
beforeEach(async () => {
  now = 0;
  repo = new SqliteAccounts(':memory:');
  app = buildApp({
    logger: false,
    config: parseConfig({
      NODE_ENV: 'test',
      ALLOW_GUESTS: 'true',
      DATABASE_PATH: ':memory:',
    }),
    accounts: { repository: repo, provider: null, storage: null },
    multiplayer: { now: () => now },
  });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await app.close();
});
function account(expiresAt = 10000) {
  const user = repo.googleUser(randomUUID(), 'Real account fixture', null, now);
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  repo.putSession({
    tokenHash: digest(token),
    userId: user.id,
    csrfToken,
    createdAt: now,
    expiresAt,
  });
  return { id: user.id, cookie: `omi_session=${token}`, csrfToken };
}
async function connect(cookie: string) {
  const socket = new WebSocket(
    base.replace(/^http/, 'ws') + '/matchmaking/ws',
    { headers: { origin, cookie } },
  );
  sockets.push(socket);
  const messages: MatchmakingMessage[] = [];
  socket.on('message', (data) =>
    messages.push(JSON.parse(data.toString()) as MatchmakingMessage),
  );
  socket.on('error', () => undefined);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  return { socket, messages };
}
async function poll(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Queue expectation timed out');
}
it('matches exactly four authenticated people atomically and recovers an assigned room on reconnect', async () => {
  const people = Array.from({ length: 4 }, () => account());
  const peers: Awaited<ReturnType<typeof connect>>[] = [];
  for (let i = 0; i < 3; i++) {
    peers.push(await connect(people[i]!.cookie));
    await poll(() =>
      peers[i]!.messages.some(
        (m) => m.type === 'waiting' && m.waiting === i + 1,
      ),
    );
    expect(
      peers.every((p) => p.messages.every((m) => m.type !== 'matched')),
    ).toBe(true);
  }
  peers.push(await connect(people[3]!.cookie));
  await poll(() =>
    peers.every((p) => p.messages.some((m) => m.type === 'matched')),
  );
  const rooms = peers.map((p) => p.messages.find((m) => m.type === 'matched')!);
  expect(
    new Set(rooms.map((m) => m.type === 'matched' && m.room.roomId)).size,
  ).toBe(1);
  const first = rooms[0]!;
  if (first.type !== 'matched') throw new Error('Expected assignment');
  for (const person of people) {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms/snapshot',
      headers: { origin, cookie: person.cookie },
      payload: { roomId: first.room.roomId },
    });
    expect(response.statusCode).toBe(200);
    const snapshot = response.json<Snapshot>();
    expect(snapshot.members.map((m) => m.actorId)).toEqual(
      people.map((p) => p.id),
    );
    expect(snapshot.members).toHaveLength(4);
    expect(snapshot.you.actorId).toBe(person.id);
    expect(snapshot.game).toBeNull();
  }
  const resumed = await connect(people[0]!.cookie);
  await poll(() => resumed.messages.some((m) => m.type === 'matched'));
  expect(resumed.messages.find((m) => m.type === 'matched')).toEqual(first);
});
it('cancels and disconnects without phantom participants and prevents duplicate queued accounts', async () => {
  const first = account(),
    second = account();
  const old = await connect(first.cookie);
  const replacement = await connect(first.cookie);
  await poll(() => old.socket.readyState === WebSocket.CLOSED);
  await poll(() =>
    replacement.messages.some((m) => m.type === 'waiting' && m.waiting === 1),
  );
  const other = await connect(second.cookie);
  await poll(() =>
    other.messages.some((m) => m.type === 'waiting' && m.waiting === 2),
  );
  replacement.socket.send(JSON.stringify({ type: 'cancel' }));
  await poll(
    () =>
      other.messages.at(-1)?.type === 'waiting' &&
      (other.messages.at(-1) as { waiting: number }).waiting === 1,
  );
  expect(replacement.messages.some((m) => m.type === 'cancelled')).toBe(true);
  other.socket.terminate();
  const rejoined = await connect(first.cookie);
  await poll(() =>
    rejoined.messages.some((m) => m.type === 'waiting' && m.waiting === 1),
  );
});
it('removes expired and logged-out queue entries before delivery', async () => {
  const expired = account(100),
    active = account();
  const stale = await connect(expired.cookie);
  now = 100;
  const live = await connect(active.cookie);
  await poll(() => stale.socket.readyState === WebSocket.CLOSED);
  expect(stale.messages.some((m) => m.type === 'matched')).toBe(false);
  await poll(() =>
    live.messages.some((m) => m.type === 'waiting' && m.waiting === 1),
  );
  const response = await app.inject({
    method: 'POST',
    url: '/auth/logout',
    headers: {
      origin,
      cookie: active.cookie,
      'x-csrf-token': active.csrfToken,
    },
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  await poll(() => live.socket.readyState === WebSocket.CLOSED);
});
it('rejects guest, missing/foreign Origin and query credentials at the upgrade boundary', async () => {
  const guest = await app.inject({
    method: 'POST',
    url: '/transport/session',
    headers: { origin },
    payload: { displayName: 'Guest' },
  });
  const cookie = guest.cookies
    .map((item) => `${item.name}=${item.value}`)
    .join('; ');
  for (const [headers, path] of [
    [{ origin, cookie }, '/matchmaking/ws'],
    [{ cookie: account().cookie }, '/matchmaking/ws'],
    [
      { origin: 'https://foreign.invalid', cookie: account().cookie },
      '/matchmaking/ws',
    ],
    [{ origin, cookie: account().cookie }, '/matchmaking/ws?token=x'],
  ] as const) {
    const response = await app.inject({
      method: 'GET',
      url: path,
      headers: {
        ...headers,
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': randomBytes(16).toString('base64'),
      },
    });
    expect([400, 401, 403]).toContain(response.statusCode);
  }
});
it('rejects forged cancellation fields and binary messages', async () => {
  for (const payload of [
    JSON.stringify({ type: 'cancel', actorId: randomUUID() }),
    Buffer.from('binary'),
  ]) {
    const peer = await connect(account().cookie);
    peer.socket.send(payload);
    await poll(() => peer.socket.readyState === WebSocket.CLOSED);
    expect(peer.messages.some((m) => m.type === 'matched')).toBe(false);
  }
});

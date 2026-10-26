import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app.js';
import { parseConfig } from '../config.js';
import { musicPosition, trimChat, validSocialText } from '@omi/shared';
import type { SocialPayload, MusicState, ChatEntry } from '@omi/shared';
const origin = 'http://127.0.0.1:5173';
let app: ReturnType<typeof buildApp>;
let base: string;
const sockets: WebSocket[] = [];
type Player = { actorId: string; cookie: string };
type Wire = {
  socket: WebSocket;
  messages: Record<string, unknown>[];
  wait: (
    predicate: (value: Record<string, unknown>) => boolean,
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
const post = (path: string, p: Player, payload: object = {}) =>
  app.inject({
    method: 'POST',
    url: path,
    headers: { origin, cookie: p.cookie },
    payload,
  });
async function player() {
  const response = await app.inject({
    method: 'POST',
    url: '/transport/session',
    headers: { origin },
    payload: { displayName: 'Social player' },
  });
  return {
    actorId: response.json<{ actorId: string }>().actorId,
    cookie: `${response.cookies[0]!.name}=${response.cookies[0]!.value}`,
  };
}
async function room(p: Player) {
  return (
    await post('/rooms', p, {
      actorId: p.actorId,
      actionId: randomUUID(),
      expectedVersion: 0,
    })
  ).json<{ roomId: string; code: string }>();
}
function wire(path: string, p: Player): Wire {
  const socket = new WebSocket(base.replace('http:', 'ws:') + path, {
    headers: { origin, cookie: p.cookie },
  });
  sockets.push(socket);
  const messages: Record<string, unknown>[] = [];
  socket.on('message', (data) =>
    messages.push(JSON.parse(String(data)) as Record<string, unknown>),
  );
  socket.on('error', () => undefined);
  return {
    socket,
    messages,
    wait: async (predicate) => {
      let found: Record<string, unknown> | undefined;
      await expect
        .poll(() => {
          found = messages.find(predicate);
          return Boolean(found);
        })
        .toBe(true);
      return found!;
    },
  };
}
async function connected(p: Player, roomId: string) {
  const game = wire(`/rooms/${roomId}/ws`, p);
  await game.wait((m) => m.type === 'snapshot');
  const social = wire(`/rooms/${roomId}/social/ws`, p);
  const snapshot = await social.wait((m) => m.type === 'snapshot');
  let version = 0;
  return {
    ...social,
    game,
    snapshot,
    send: async (
      payload: SocialPayload,
      override: Record<string, unknown> = {},
    ) => {
      const action = {
        ...payload,
        actorId: p.actorId,
        roomId,
        connectionId: snapshot.connectionId,
        actionId: randomUUID(),
        expectedVersion: version++,
        ...override,
      };
      social.socket.send(JSON.stringify(action));
      const reply = await social.wait((m) => m.actionId === action.actionId);
      return { action, reply };
    },
  };
}
async function pair() {
  const a = await player();
  const b = await player();
  const r = await room(a);
  const preview = (await post('/rooms/preview', b, { code: r.code })).json<{
    version: number;
  }>();
  expect(
    (
      await post('/rooms/join', b, {
        roomId: r.roomId,
        code: r.code,
        actorId: b.actorId,
        actionId: randomUUID(),
        expectedVersion: preview.version,
      })
    ).statusCode,
  ).toBe(200);
  return {
    a,
    b,
    r,
    first: await connected(a, r.roomId),
    second: await connected(b, r.roomId),
  };
}
it('relays escaped-data Unicode chat once, preserves private game version and reconnect history', async () => {
  const { a, b, r, first, second } = await pair();
  const before = (await post('/rooms/snapshot', a, { roomId: r.roomId })).json<{
    version: number;
  }>().version;
  const text = 'ආයුබෝවන් යාළුවනේ 🃏 <img src=x onerror=alert(1)>';
  const { action, reply } = await first.send({
    type: 'chat',
    payload: { text },
  });
  expect(reply.type).toBe('ack');
  const delivered = await second.wait((m) => m.type === 'chat');
  expect((delivered.entry as ChatEntry).text).toBe(text);
  expect((delivered.entry as ChatEntry).actorId).toBe(a.actorId);
  first.socket.send(JSON.stringify(action));
  await expect
    .poll(
      () =>
        first.messages.filter(
          (m) => m.type === 'ack' && m.actionId === action.actionId,
        ).length,
    )
    .toBe(2);
  expect(second.messages.filter((m) => m.type === 'chat')).toHaveLength(1);
  expect(
    (await post('/rooms/snapshot', a, { roomId: r.roomId })).json().version,
  ).toBe(before);
  second.socket.close();
  await expect.poll(() => second.socket.readyState).toBe(WebSocket.CLOSED);
  const reconnect = wire(`/rooms/${r.roomId}/social/ws`, b);
  const snapshot = await reconnect.wait((m) => m.type === 'snapshot');
  expect((snapshot.history as ChatEntry[])[0]!.text).toBe(text);
});
it('keeps shared music authoritative, host-only and versioned across controls', async () => {
  const { first, second } = await pair();
  expect(
    (
      await second.send({
        type: 'music',
        payload: { command: 'play', musicVersion: 0 },
      })
    ).reply.code,
  ).toBe('MUSIC_HOST_ONLY');
  expect(
    (
      await first.send({
        type: 'music',
        payload: { command: 'play', musicVersion: 0 },
      })
    ).reply.type,
  ).toBe('ack');
  const play = await second.wait((m) => m.type === 'music');
  expect((play.music as MusicState).playing).toBe(true);
  expect(
    (
      await first.send({
        type: 'music',
        payload: { command: 'seek', position: 12, musicVersion: 1 },
      })
    ).reply.type,
  ).toBe('ack');
  expect(
    (
      await first.send({
        type: 'music',
        payload: { command: 'pause', musicVersion: 0 },
      })
    ).reply.code,
  ).toBe('MUSIC_CONFLICT');
  const pause = await first.send({
    type: 'music',
    payload: { command: 'pause', musicVersion: 2 },
  });
  expect(pause.reply.type).toBe('ack');
  expect(
    (
      await first.send({
        type: 'music',
        payload: { command: 'track', trackId: 'coast', musicVersion: 3 },
      })
    ).reply.type,
  ).toBe('ack');
  const changed = await second.wait(
    (m) => m.type === 'music' && (m.music as MusicState).version === 4,
  );
  expect(changed.music).toMatchObject({
    trackId: 'coast',
    playing: false,
    position: 0,
  });
});
it('limits chat/reactions separately, marks adult content and closes social with game logout', async () => {
  const { a, r, first, second } = await pair();
  await first.send({ type: 'chat', payload: { text: 'මගුලයි!' } });
  expect(
    ((await second.wait((m) => m.type === 'chat')).entry as ChatEntry).adult,
  ).toBe(true);
  for (let i = 0; i < 8; i++)
    expect(
      (await first.send({ type: 'reaction', payload: { id: 'tap' } })).reply
        .type,
    ).toBe('ack');
  expect(
    (await first.send({ type: 'reaction', payload: { id: 'tap' } })).reply.code,
  ).toBe('SOCIAL_SLOW_DOWN');
  expect(
    (await first.send({ type: 'quick', payload: { id: 'good-hand' } })).reply
      .type,
  ).toBe('ack');
  const voice = wire(`/rooms/${r.roomId}/voice/ws`, a);
  await voice.wait((m) => m.type === 'hello');
  await post('/auth/logout', a);
  await expect.poll(() => first.socket.readyState).toBe(WebSocket.CLOSED);
  await expect.poll(() => voice.socket.readyState).toBe(WebSocket.CLOSED);
});
it('stores a verified message report and rejects self/unknown reports', async () => {
  const { first, second } = await pair();
  await first.send({
    type: 'chat',
    payload: { text: 'Please review this message' },
  });
  const message = (await second.wait((m) => m.type === 'chat'))
    .entry as ChatEntry;
  expect(
    (
      await first.send({
        type: 'report',
        payload: { messageId: message.id, reason: 'abuse', note: '' },
      })
    ).reply.code,
  ).toBe('REPORT_MESSAGE_UNAVAILABLE');
  const result = await second.send({
    type: 'report',
    payload: { messageId: message.id, reason: 'spam', note: 'Owner review' },
  });
  expect(result.reply.reportId).toMatch(/^[a-f0-9-]{36}$/);
  const again = await second.send({
    type: 'report',
    payload: { messageId: message.id, reason: 'spam', note: 'Changed note' },
  });
  expect(again.reply.reportId).toBe(result.reply.reportId);
  expect(
    (
      await second.send({
        type: 'report',
        payload: { messageId: randomUUID(), reason: 'other', note: '' },
      })
    ).reply.code,
  ).toBe('REPORT_MESSAGE_UNAVAILABLE');
});
it('never broadcasts another private room history or reactions', async () => {
  const a = await player();
  const b = await player();
  const ra = await room(a);
  const rb = await room(b);
  const ca = await connected(a, ra.roomId);
  const cb = await connected(b, rb.roomId);
  await ca.send({ type: 'chat', payload: { text: 'Only first room' } });
  await ca.send({ type: 'reaction', payload: { id: 'nice' } });
  expect(
    cb.messages.some((m) => m.type === 'chat' || m.type === 'reaction'),
  ).toBe(false);
  expect(cb.snapshot.history as unknown[]).toHaveLength(0);
});
it.each(['actor', 'room', 'connection', 'version', 'extra', 'url'])(
  'rejects forged %s actions without closing gameplay',
  async (fault) => {
    const p = await player();
    const r = await room(p);
    const c = await connected(p, r.roomId);
    const overrides: Record<string, unknown> =
      fault === 'actor'
        ? { actorId: randomUUID() }
        : fault === 'room'
          ? { roomId: randomUUID() }
          : fault === 'connection'
            ? { connectionId: randomUUID() }
            : fault === 'version'
              ? { expectedVersion: 3 }
              : fault === 'extra'
                ? { hand: [] }
                : {};
    const action = {
      type: 'chat',
      payload: { text: 'hello' },
      actorId: p.actorId,
      roomId: r.roomId,
      connectionId: c.snapshot.connectionId,
      actionId: randomUUID(),
      expectedVersion: 0,
      ...overrides,
    };
    c.socket.send(
      JSON.stringify(
        fault === 'url'
          ? {
              ...action,
              type: 'music',
              payload: {
                command: 'track',
                trackId: 'https://untrusted.invalid/music.mp3',
                musicVersion: 0,
              },
            }
          : action,
      ),
    );
    await expect.poll(() => c.socket.readyState).toBe(WebSocket.CLOSED);
    expect(c.game.socket.readyState).toBe(WebSocket.OPEN);
  },
);
it('bounds Unicode history, validates controls and calculates loop/carry without client clocks', () => {
  const list = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    actorId: 'actor',
    text: 'සිංහල'.repeat(70),
    adult: false,
    createdAt: i,
  }));
  const trimmed = trimChat(list);
  expect(trimmed.length).toBeLessThanOrEqual(30);
  expect(
    new TextEncoder().encode(JSON.stringify(trimmed)).length,
  ).toBeLessThanOrEqual(32_768);
  expect(validSocialText('සිංහල 👨‍👩‍👧‍👦')).toBe(true);
  expect(validSocialText('a\u0000b')).toBe(false);
  expect(validSocialText('a\nb\nc\nd\ne')).toBe(false);
  const state: MusicState = {
    trackId: 'emerald',
    playing: true,
    position: 30,
    updatedAt: 1000,
    version: 1,
  };
  expect(musicPosition(state, 6000)).toBe(3);
  expect(musicPosition({ ...state, playing: false }, 6000)).toBe(30);
  expect(musicPosition(state, 0)).toBe(30);
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { GameClient } from './client';
import type { ServerMessage } from '@omi/shared';
// Public fixture only; importing the test file would register its tests twice.
const state = () => ({
  type: 'snapshot' as const,
  roomId: '11111111-1111-4111-8111-111111111111',
  requestId: null,
  version: 1,
  code: 'ABCD2345',
  hostId: '22222222-2222-4222-8222-222222222222',
  you: {
    actorId: '22222222-2222-4222-8222-222222222222',
    seat: 0 as const,
    team: 0 as const,
  },
  members: [],
  game: null,
  score: { totals: [0, 0] as const, carry: 0 as const },
  result: null,
});
class MockSocket {
  static OPEN = 1;
  static instances: MockSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    MockSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }
  message(value: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent);
  }
}
let client: GameClient;
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  MockSocket.instances = [];
  vi.stubGlobal('WebSocket', MockSocket);
  vi.spyOn(api, 'session').mockResolvedValue({
    actorId: state().you.actorId,
    displayName: 'Nipun',
    expiresAt: Date.now() + 100_000,
  });
  vi.spyOn(api, 'create').mockResolvedValue({
    roomId: state().roomId,
    code: state().code,
    version: 0,
    memberCount: 1,
    invitePath: '/?room=ABCD2345',
  });
  vi.spyOn(api, 'snapshot').mockResolvedValue({ ...state(), version: 4 });
  client = new GameClient();
});
afterEach(() => {
  client.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('keeps mutations pending without optimistic changes and retries the same envelope after a lost ack and reconnect', async () => {
  await client.enter('Nipun');
  const first = MockSocket.instances[0]!;
  first.message(state());
  client.act({ type: 'ready', payload: { ready: true } });
  const sent = first.sent[0]!;
  expect(client.store.getState().pending).toBe(true);
  expect(client.store.getState().snapshot!.version).toBe(1);
  first.close(1006);
  await vi.advanceTimersByTimeAsync(500);
  const resumed = MockSocket.instances[1]!;
  resumed.message({ ...state(), version: 5 });
  expect(resumed.sent[0]).toBe(sent);
  const original = JSON.parse(sent) as { actionId: string };
  resumed.message({
    type: 'ack',
    roomId: state().roomId,
    actionId: original.actionId,
    version: 2,
    duplicate: true,
  });
  expect(client.store.getState().snapshot!.version).toBe(5);
  expect(client.store.getState().pending).toBe(false);
});
it('requests one private sync on a gap, disables actions until recovered, and ignores foreign snapshots', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message(state());
  const gap = {
    type: 'event' as const,
    roomId: state().roomId,
    fromVersion: 2,
    version: 3,
    event: { kind: 'presence' as const, seat: 1 as const, connected: false },
  };
  socket.message(gap);
  socket.message(gap);
  expect(socket.sent).toHaveLength(1);
  expect(JSON.parse(socket.sent[0]!).type).toBe('sync');
  expect(client.store.getState().connection).toBe('reconnecting');
  client.act({ type: 'ready', payload: { ready: true } });
  expect(socket.sent).toHaveLength(1);
  socket.message({ ...state(), roomId: 'other', version: 99 });
  expect(client.store.getState().snapshot!.version).toBe(1);
  socket.message({ ...state(), version: 3 });
  expect(client.store.getState().connection).toBe('online');
});
it('does not battle a replacement tab or reconnect after disposal', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message(state());
  socket.close(4001, 'Replaced by reconnect');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(MockSocket.instances).toHaveLength(1);
  expect(client.store.getState().error).toContain('another tab');
  client.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(MockSocket.instances).toHaveLength(1);
});
it('ignores a delayed reconnect read after navigation home', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message(state());
  let resolve!: (value: ReturnType<typeof state>) => void;
  vi.mocked(api.snapshot).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  socket.close(1006);
  await vi.advanceTimersByTimeAsync(500);
  client.home();
  resolve({ ...state(), version: 4 });
  await vi.advanceTimersByTimeAsync(1);
  expect(client.store.getState().view).toBe('home');
  expect(MockSocket.instances).toHaveLength(1);
});
it('disables actions immediately when offline and restores the same cookie-bound table online', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message(state());
  client.offline();
  expect(client.store.getState().connection).toBe('offline');
  client.act({ type: 'ready', payload: { ready: true } });
  expect(socket.sent).toHaveLength(0);
  client.online();
  await vi.advanceTimersByTimeAsync(1);
  const resumed = MockSocket.instances[1]!;
  resumed.message({ ...state(), version: 5 });
  expect(client.store.getState().connection).toBe('online');
  expect(client.store.getState().snapshot!.you.actorId).toBe(
    state().you.actorId,
  );
});
it('publishes presentation only for accepted ordered deltas and clears it on reconnect snapshots', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message(state());
  const event = {
    type: 'event',
    roomId: state().roomId,
    fromVersion: 1,
    version: 2,
    event: { kind: 'presence', seat: 1, connected: true },
  } as const;
  socket.message(event);
  const presentation = client.store.getState().presentation;
  expect(presentation?.version).toBe(2);
  socket.message(event);
  socket.message({ ...event, fromVersion: 0, version: 1 });
  expect(client.store.getState().presentation).toBe(presentation);
  socket.message({ ...state(), version: 2 });
  expect(client.store.getState().presentation).toBeNull();
  socket.message({ ...event, fromVersion: 3, version: 4 });
  expect(client.store.getState().presentation).toBeNull();
  expect(client.store.getState().connection).toBe('reconnecting');
});
it('navigates menus without creating a room and handles browser history entries', () => {
  client.navigate('multiplayer');
  client.navigate('friends');
  client.navigate('create');
  expect(client.store.getState().view).toBe('create');
  client.onPopState(
    new PopStateEvent('popstate', {
      state: { omi: true, view: 'friends', index: 2 },
    }),
  );
  expect(client.store.getState().view).toBe('friends');
  expect(api.create).not.toHaveBeenCalled();
});
it('confirms leaving an active table while preserving its identity, saved seat and server state', async () => {
  await client.enter('Nipun');
  const socket = MockSocket.instances[0]!;
  socket.message({
    ...state(),
    game: {
      id: 'round',
      phase: 'playing',
      dealer: 0,
      selector: 0,
      trump: 'clubs',
      turn: 0,
      hand: [{ rank: 'A', suit: 'clubs' }],
      handCounts: [1, 1, 1, 1],
      trick: [],
      tricks: [],
    },
  });
  const snapshot = client.store.getState().snapshot;
  client.home();
  expect(client.store.getState().view).toBe('room');
  expect(client.store.getState().leaveRequest).not.toBeNull();
  expect(socket.readyState).toBe(1);
  client.cancelLeave();
  expect(client.store.getState().view).toBe('room');
  client.home();
  client.confirmLeave();
  expect(client.store.getState().view).toBe('home');
  expect(client.store.getState().snapshot).toBe(snapshot);
  expect(client.store.getState().saved?.roomId).toBe(state().roomId);
  expect(api.create).toHaveBeenCalledTimes(1);
});

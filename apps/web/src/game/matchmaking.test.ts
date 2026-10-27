// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MatchmakingClient } from './matchmaking';
import type { MatchmakingMessage, RoomDescriptor } from '@omi/shared';
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  sent: string[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Socket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
  message(data: MatchmakingMessage) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}
let client: MatchmakingClient;
const matched = vi.fn();
const room: RoomDescriptor = {
  roomId: 'room',
  code: 'ABCD2345',
  version: 0,
  memberCount: 4,
  invitePath: '/?room=ABCD2345',
};
beforeEach(() => {
  vi.useFakeTimers();
  matched.mockClear();
  Socket.instances = [];
  vi.stubGlobal('WebSocket', Socket);
  client = new MatchmakingClient(matched);
});
afterEach(() => {
  client.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('shows only server-reported counts and prevents duplicate starts', () => {
  client.start();
  client.start();
  expect(Socket.instances).toHaveLength(1);
  expect(client.store.getState().waiting).toBe(0);
  Socket.instances[0]!.message({ type: 'waiting', waiting: 2, needed: 4 });
  expect(client.store.getState()).toMatchObject({
    status: 'waiting',
    waiting: 2,
  });
});
it('cancels and ignores late assignment from an obsolete queue connection', () => {
  client.start();
  const old = Socket.instances[0]!;
  client.stop();
  expect(old.sent).toEqual([JSON.stringify({ type: 'cancel' })]);
  old.message({ type: 'matched', room });
  expect(matched).not.toHaveBeenCalled();
  expect(client.store.getState().waiting).toBe(0);
});
it('reconnects without fabricated counts and accepts the authenticated server assignment once', async () => {
  client.start();
  Socket.instances[0]!.close(1006);
  expect(client.store.getState()).toMatchObject({
    status: 'offline',
    waiting: 0,
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(Socket.instances).toHaveLength(2);
  Socket.instances[1]!.message({ type: 'matched', room });
  Socket.instances[1]!.message({ type: 'matched', room });
  expect(matched).toHaveBeenCalledExactlyOnceWith(room);
});
it('does not fight a replacement tab or retry after cancellation', async () => {
  client.start();
  Socket.instances[0]!.close(4001);
  await vi.advanceTimersByTimeAsync(10000);
  expect(Socket.instances).toHaveLength(1);
  expect(client.store.getState().error).toContain('another tab');
  client.start();
  client.offline();
  client.online();
  expect(Socket.instances).toHaveLength(3);
  client.stop();
  await vi.advanceTimersByTimeAsync(30000);
  expect(Socket.instances).toHaveLength(3);
});
it('does not open a second socket when online recovery overtakes a retry timer', async () => {
  client.start();
  Socket.instances[0]!.close(1006);
  client.online();
  expect(Socket.instances).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(Socket.instances).toHaveLength(2);
});

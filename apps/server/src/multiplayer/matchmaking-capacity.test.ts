import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { expect, it, vi } from 'vitest';
import { Matchmaking } from './matchmaking.js';
import { DEFAULT_LIMITS, RoomService } from './rooms.js';
import type { Identity } from './support.js';
const identity = (): Identity => ({
  actorId: randomUUID(),
  userId: randomUUID(),
  tokenHash: randomUUID(),
  displayName: 'Capacity fixture',
  expiresAt: 1000,
});
class Socket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  send = vi.fn();
  ping = vi.fn();
  close() {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
  terminate() {
    this.close();
  }
  cast() {
    return this as unknown as WebSocket;
  }
}
it('bounds the waiting queue and releases capacity immediately after cancellation', () => {
  const rooms = new RoomService(
    () => 0,
    () => true,
    DEFAULT_LIMITS,
  );
  const queue = new Matchmaking(
    rooms,
    () => true,
    () => 0,
    2,
  );
  const first = new Socket(),
    second = new Socket(),
    third = new Socket();
  try {
    queue.connect(identity(), first.cast());
    queue.connect(identity(), second.cast());
    expect(() => queue.connect(identity(), third.cast())).toThrow(
      'QUEUE_CAPACITY',
    );
    second.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'cancel' })),
      false,
    );
    expect(() => queue.connect(identity(), third.cast())).not.toThrow();
    const message = JSON.parse(first.send.mock.calls.at(-1)![0] as string);
    expect(message).toEqual({ type: 'waiting', waiting: 2, needed: 4 });
  } finally {
    queue.stop();
    rooms.stop();
  }
});
it('does not partially seat accounts when one proposed member already belongs to another room', () => {
  const rooms = new RoomService(
    () => 0,
    () => true,
    DEFAULT_LIMITS,
  );
  const people = Array.from({ length: 4 }, identity);
  const existing = rooms.create(people[3]!, {
    actorId: people[3]!.actorId,
    actionId: randomUUID(),
    expectedVersion: 0,
  });
  try {
    expect(() => rooms.match(people)).toThrow('ALREADY_IN_ROOM');
    for (const person of people.slice(0, 3))
      expect(rooms.forActor(person.actorId)).toBeNull();
    expect(rooms.forActor(people[3]!.actorId)?.roomId).toBe(existing.roomId);
    expect(() =>
      rooms.match([people[0]!, people[0]!, people[1]!, people[2]!]),
    ).toThrow('FOUR_PLAYERS_REQUIRED');
  } finally {
    rooms.stop();
  }
});
it('reports room saturation with genuine counts and clears the reason when fewer than four remain', () => {
  const rooms = new RoomService(
    () => 0,
    () => true,
    { ...DEFAULT_LIMITS, maxRooms: 0 },
  );
  const queue = new Matchmaking(
    rooms,
    () => true,
    () => 0,
  );
  const peers = Array.from({ length: 4 }, () => new Socket());
  try {
    for (const peer of peers) queue.connect(identity(), peer.cast());
    expect(JSON.parse(peers[0]!.send.mock.calls.at(-1)![0] as string)).toEqual({
      type: 'waiting',
      waiting: 4,
      needed: 4,
      blocked: 'ROOM_CAPACITY',
    });
    peers[3]!.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'cancel' })),
      false,
    );
    expect(JSON.parse(peers[0]!.send.mock.calls.at(-1)![0] as string)).toEqual({
      type: 'waiting',
      waiting: 3,
      needed: 4,
    });
  } finally {
    queue.stop();
    rooms.stop();
  }
});

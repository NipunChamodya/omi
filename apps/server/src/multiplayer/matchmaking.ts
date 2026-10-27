import { WebSocket } from 'ws';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MatchmakingMessage } from '@omi/shared';
import type { RoomService } from './rooms.js';
import type { Identity } from './support.js';
import { RateLimiter, RoomError } from './support.js';

type Entry = { identity: Identity; socket: WebSocket; alive: boolean };
/** One process, FIFO, real authenticated accounts only. No timer ever fabricates a player. */
export class Matchmaking {
  private waiting = new Map<string, Entry>();
  private sockets = new Set<WebSocket>();
  private rate: RateLimiter;
  constructor(
    private rooms: RoomService,
    private active: (identity: Identity) => boolean,
    now: () => number,
    private capacity = 128,
  ) {
    this.rate = new RateLimiter(now, 6, 10_000);
  }
  available() {
    if (this.sockets.size >= this.capacity + 8)
      throw new RoomError('QUEUE_CAPACITY', 503);
  }
  private authorized(entry: Entry) {
    return !!entry.identity.userId && this.active(entry.identity);
  }
  private send(entry: Entry, message: MatchmakingMessage) {
    if (!this.authorized(entry)) {
      this.remove(entry);
      entry.socket.close(1008, 'Session expired');
      return;
    }
    if (entry.socket.readyState !== WebSocket.OPEN) return;
    const data = JSON.stringify(message);
    if (entry.socket.bufferedAmount + Buffer.byteLength(data) > 65_536) {
      entry.socket.terminate();
      return;
    }
    entry.socket.send(data, (error) => {
      if (error) entry.socket.terminate();
    });
  }
  private remove(entry: Entry) {
    if (this.waiting.get(entry.identity.actorId) === entry)
      this.waiting.delete(entry.identity.actorId);
  }
  private prune() {
    for (const entry of this.waiting.values())
      if (
        !this.authorized(entry) ||
        entry.socket.readyState !== WebSocket.OPEN ||
        this.rooms.forActor(entry.identity.actorId)
      ) {
        this.remove(entry);
        entry.socket.close(1008, 'Queue entry ended');
      }
  }
  private update() {
    this.prune();
    let blocked = false;
    while (this.waiting.size >= 4) {
      const group = [...this.waiting.values()].slice(0, 4);
      try {
        const room = this.rooms.match(group.map((entry) => entry.identity));
        for (const entry of group) {
          this.remove(entry);
          this.send(entry, { type: 'matched', room });
          entry.socket.close(1000, 'Table assigned');
        }
      } catch (error) {
        // Leave genuine participants queued on capacity failure; never create a partial room.
        const code =
          error instanceof RoomError ? error.code : 'QUEUE_UNAVAILABLE';
        for (const entry of group) this.send(entry, { type: 'error', code });
        if (code === 'ROOM_CAPACITY') {
          blocked = true;
          break;
        }
        for (const entry of group) {
          this.remove(entry);
          entry.socket.close(1013, 'Please retry matchmaking');
        }
      }
    }
    for (const entry of this.waiting.values())
      this.send(entry, {
        type: 'waiting',
        waiting: this.waiting.size,
        needed: 4,
        ...(blocked ? { blocked: 'ROOM_CAPACITY' as const } : {}),
      });
  }
  connect(identity: Identity, socket: WebSocket) {
    if (!identity.userId || !this.active(identity))
      throw new RoomError('LOGIN_REQUIRED', 401);
    this.available();
    this.prune();
    const existing = this.rooms.forActor(identity.actorId);
    if (
      !existing &&
      !this.waiting.has(identity.actorId) &&
      this.waiting.size >= this.capacity
    )
      throw new RoomError('QUEUE_CAPACITY', 503);
    const entry = { identity, socket, alive: true };
    const old = this.waiting.get(identity.actorId);
    if (old) {
      this.remove(old);
      old.socket.close(4001, 'Queue moved to another tab');
    }
    this.sockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('pong', () => {
      entry.alive = true;
    });
    socket.on('close', () => {
      this.sockets.delete(socket);
      this.remove(entry);
      this.update();
    });
    socket.on('message', (data, binary) => {
      if (
        !this.authorized(entry) ||
        this.waiting.get(identity.actorId) !== entry
      ) {
        socket.close(1008, 'Queue entry ended');
        return;
      }
      if (binary || !this.rate.take(identity.actorId)) {
        socket.close(1008, 'Invalid queue message');
        return;
      }
      try {
        z.strictObject({ type: z.literal('cancel') }).parse(
          JSON.parse(data.toString()),
        );
        this.remove(entry);
        this.send(entry, { type: 'cancelled' });
        socket.close(1000, 'Queue cancelled');
        this.update();
      } catch {
        socket.close(1008, 'Invalid queue message');
      }
    });
    if (existing) {
      this.send(entry, { type: 'matched', room: existing });
      socket.close(1000, 'Table assigned');
      return;
    }
    this.waiting.set(identity.actorId, entry);
    this.update();
  }
  disconnectSession(hash: string) {
    for (const entry of this.waiting.values())
      if (entry.identity.tokenHash === hash) {
        this.remove(entry);
        entry.socket.close(1008, 'Logged out');
      }
    this.update();
  }
  heartbeat() {
    this.rate.sweep();
    for (const entry of this.waiting.values()) {
      if (!entry.alive || !this.authorized(entry)) {
        this.remove(entry);
        entry.socket.terminate();
      } else {
        entry.alive = false;
        entry.socket.ping();
      }
    }
    // Closing/replaced sockets also count against capacity until their bounded transport closes.
    for (const socket of this.sockets)
      if (socket.readyState !== WebSocket.OPEN) socket.terminate();
    this.update();
  }
  stop() {
    this.waiting.clear();
    for (const socket of this.sockets) socket.terminate();
    this.sockets.clear();
  }
}
export function registerMatchmaking(
  api: FastifyInstance,
  rooms: RoomService,
  identityFor: (request: FastifyRequest) => Identity,
  active: (identity: Identity) => boolean,
  now: () => number,
) {
  const queue = new Matchmaking(rooms, active, now);
  rooms.onSessionDisconnect = (hash) => queue.disconnectSession(hash);
  const timer = setInterval(() => queue.heartbeat(), 30_000);
  timer.unref();
  api.addHook('preClose', async () => {
    clearInterval(timer);
    queue.stop();
  });
  api.get(
    '/matchmaking/ws',
    {
      websocket: true,
      preValidation: async (request) => {
        if (request.url.includes('?'))
          throw new RoomError('QUERY_NOT_ALLOWED', 400);
        const identity = identityFor(request);
        if (!identity.userId || !active(identity))
          throw new RoomError('LOGIN_REQUIRED', 401);
        queue.available();
      },
    },
    (socket, request) => {
      try {
        queue.connect(identityFor(request), socket);
      } catch {
        socket.close(1008, 'Queue unavailable');
      }
    },
  );
}

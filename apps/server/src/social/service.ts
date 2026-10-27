import { createHash, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { z } from 'zod';
import {
  musicPosition,
  musicTracks,
  quickPhrases,
  reactions,
  trimChat,
  validSocialText,
} from '@omi/shared';
import type {
  ChatEntry,
  MusicState,
  SocialMessage,
  SocialReply,
  SocialReport,
} from '@omi/shared';
import type { Identity } from '../multiplayer/support.js';
import { RateLimiter, RoomError, SerialQueue } from '../multiplayer/support.js';
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => validSocialText(value, max),
      'Unsupported text controls',
    );
export function adultText(text: string) {
  return /\b(?:fuck|shit|damn)\b/i.test(text) || /මගුල|යකෝ/.test(text);
}
const musicVersion = z.number().int().nonnegative().max(1_000_000);
const musicPayload = z.discriminatedUnion('command', [
  z.strictObject({ command: z.enum(['play', 'pause']), musicVersion }),
  z.strictObject({
    command: z.literal('seek'),
    position: z.number().min(0).max(60),
    musicVersion,
  }),
  z.strictObject({
    command: z.literal('track'),
    trackId: z.enum(['emerald', 'coast']),
    musicVersion,
  }),
]);
const envelope = {
  roomId: z.uuid(),
  actorId: z.uuid(),
  connectionId: z.uuid(),
  actionId: z.uuid(),
  expectedVersion: z.number().int().nonnegative().max(1_000_000),
};
export const socialCommand = z.discriminatedUnion('type', [
  z.strictObject({
    ...envelope,
    type: z.literal('chat'),
    payload: z.strictObject({ text: safeText(400) }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('quick'),
    payload: z.strictObject({
      id: z.enum(quickPhrases.map((item) => item.id)),
    }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('reaction'),
    payload: z.strictObject({ id: z.enum(reactions.map((item) => item.id)) }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('music'),
    payload: musicPayload,
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('report'),
    payload: z.strictObject({
      messageId: z.uuid(),
      reason: z.enum(['abuse', 'harassment', 'spam', 'other']),
      note: z.union([z.literal(''), safeText(280)]),
    }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('clock'),
    payload: z.strictObject({
      sentAt: z.number().min(0).max(Number.MAX_SAFE_INTEGER),
    }),
  }),
]);
type Peer = {
  roomId: string;
  socket: WebSocket;
  identity: Identity;
  connectionId: string;
  sequence: number;
  alive: boolean;
  receipts: Map<string, { hash: string; reply: SocialReply }>;
};
type Channel = {
  hostId: string;
  peers: Map<string, Peer>;
  queue: SerialQueue;
  history: ChatEntry[];
  music: MusicState;
};
export class SocialService {
  private readonly channels = new Map<string, Channel>();
  private readonly traffic: RateLimiter;
  private readonly chatRate: RateLimiter;
  private readonly reactionRate: RateLimiter;
  private readonly musicRate: RateLimiter;
  private readonly reportRate: RateLimiter;
  constructor(
    private readonly authorize: (
      roomId: string,
      identity: Identity,
    ) => { hostId: string },
    private readonly roomAlive: (roomId: string, hostId: string) => boolean,
    private readonly saveReport: (report: SocialReport) => string,
    private readonly now: () => number,
    private readonly maxRooms: number,
  ) {
    this.traffic = new RateLimiter(now, 40, 10_000);
    this.chatRate = new RateLimiter(now, 6, 10_000);
    this.reactionRate = new RateLimiter(now, 8, 10_000);
    this.musicRate = new RateLimiter(now, 8, 10_000);
    this.reportRate = new RateLimiter(now, 3, 10 * 60_000);
  }
  private send(peer: Peer, message: SocialMessage) {
    const data = JSON.stringify(message);
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.authorize(peer.roomId, peer.identity);
    } catch {
      peer.socket.close(1008, 'Authorization expired');
      return;
    }
    if (peer.socket.bufferedAmount + Buffer.byteLength(data) > 65_536) {
      peer.socket.terminate();
      return;
    }
    peer.socket.send(data, (error) => {
      if (error) peer.socket.terminate();
    });
  }
  private broadcast(channel: Channel, message: SocialMessage) {
    for (const peer of channel.peers.values()) this.send(peer, message);
  }
  connect(roomId: string, identity: Identity, socket: WebSocket) {
    const { hostId } = this.authorize(roomId, identity);
    this.sweep();
    let channel = this.channels.get(roomId);
    if (!channel) {
      if (this.channels.size >= this.maxRooms)
        throw new RoomError('SOCIAL_CAPACITY', 503);
      channel = {
        hostId,
        peers: new Map(),
        queue: new SerialQueue(64),
        history: [],
        music: {
          trackId: 'emerald',
          playing: false,
          position: 0,
          updatedAt: this.now(),
          version: 0,
        },
      };
      this.channels.set(roomId, channel);
    }
    if (channel.peers.size >= 4 && !channel.peers.has(identity.actorId))
      throw new RoomError('SOCIAL_CAPACITY', 503);
    this.disconnect(roomId, identity.actorId, 4001);
    const peer: Peer = {
      roomId,
      socket,
      identity,
      connectionId: randomUUID(),
      sequence: 0,
      alive: true,
      receipts: new Map(),
    };
    channel.peers.set(identity.actorId, peer);
    this.send(peer, {
      type: 'snapshot',
      hostId,
      connectionId: peer.connectionId,
      history: channel.history,
      music: channel.music,
      serverTime: this.now(),
    });
    socket.on('error', () => undefined);
    socket.on('pong', () => {
      peer.alive = true;
    });
    socket.on('close', () => {
      if (channel.peers.get(identity.actorId) === peer)
        channel.peers.delete(identity.actorId);
    });
    socket.on('message', (data, binary) => {
      if (binary) {
        socket.close(1003, 'Text JSON required');
        return;
      }
      if (!this.traffic.take(identity.actorId)) {
        socket.close(1008, 'Social rate limited');
        return;
      }
      void channel.queue
        .run(() => {
          this.authorize(roomId, identity);
          if (channel.peers.get(identity.actorId) !== peer) throw new Error();
          const command = socialCommand.parse(JSON.parse(data.toString()));
          if (
            command.roomId !== roomId ||
            command.actorId !== identity.actorId ||
            command.connectionId !== peer.connectionId
          )
            throw new Error();
          const hash = createHash('sha256')
            .update(JSON.stringify(command))
            .digest('hex');
          const prior = peer.receipts.get(command.actionId);
          if (prior) {
            if (prior.hash !== hash) throw new Error();
            this.send(peer, prior.reply);
            return;
          }
          if (command.expectedVersion !== peer.sequence) throw new Error();
          peer.sequence++;
          let reply: SocialReply = {
            type: 'ack',
            actionId: command.actionId,
            version: peer.sequence,
          };
          try {
            const now = this.now();
            switch (command.type) {
              case 'chat':
              case 'quick': {
                if (!this.chatRate.take(identity.actorId))
                  throw new RoomError('SOCIAL_SLOW_DOWN');
                const text =
                  command.type === 'chat'
                    ? command.payload.text
                    : quickPhrases.find(
                        (item) => item.id === command.payload.id,
                      )!.text;
                const entry: ChatEntry = {
                  id: randomUUID(),
                  actorId: identity.actorId,
                  text,
                  adult: adultText(text),
                  createdAt: now,
                };
                channel.history = trimChat([...channel.history, entry]);
                this.broadcast(channel, { type: 'chat', entry });
                break;
              }
              case 'reaction': {
                if (!this.reactionRate.take(identity.actorId))
                  throw new RoomError('SOCIAL_SLOW_DOWN');
                const entry = {
                  id: randomUUID(),
                  actorId: identity.actorId,
                  reactionId: command.payload.id,
                  createdAt: now,
                };
                this.broadcast(channel, { type: 'reaction', entry });
                break;
              }
              case 'music': {
                if (identity.actorId !== channel.hostId)
                  throw new RoomError('MUSIC_HOST_ONLY');
                if (!this.musicRate.take(identity.actorId))
                  throw new RoomError('SOCIAL_SLOW_DOWN');
                if (command.payload.musicVersion !== channel.music.version)
                  throw new RoomError('MUSIC_CONFLICT');
                const position = musicPosition(channel.music, now);
                const next = {
                  ...channel.music,
                  position,
                  updatedAt: now,
                  version: channel.music.version + 1,
                };
                const payload = command.payload;
                if (payload.command === 'track') {
                  next.trackId = payload.trackId;
                  next.position = 0;
                  next.playing = false;
                } else if (payload.command === 'seek') {
                  const duration = musicTracks.find(
                    (track) => track.id === next.trackId,
                  )!.duration;
                  if (payload.position > duration)
                    throw new RoomError('INVALID_SEEK');
                  next.position = payload.position % duration;
                } else next.playing = payload.command === 'play';
                channel.music = next;
                this.broadcast(channel, {
                  type: 'music',
                  music: next,
                  serverTime: now,
                });
                break;
              }
              case 'report': {
                if (!this.reportRate.take(identity.actorId))
                  throw new RoomError('REPORT_SLOW_DOWN');
                const entry = channel.history.find(
                  (item) => item.id === command.payload.messageId,
                );
                if (!entry || entry.actorId === identity.actorId)
                  throw new RoomError('REPORT_MESSAGE_UNAVAILABLE');
                const reportId = this.saveReport({
                  id: randomUUID(),
                  roomId,
                  reporterId: identity.actorId,
                  subjectId: entry.actorId,
                  messageId: entry.id,
                  reason: command.payload.reason,
                  note: command.payload.note,
                  messageText: entry.text,
                  messageCreatedAt: entry.createdAt,
                  createdAt: now,
                });
                reply = { ...reply, reportId };
                break;
              }
              case 'clock':
                reply = {
                  type: 'clock',
                  actionId: command.actionId,
                  version: peer.sequence,
                  sentAt: command.payload.sentAt,
                  serverTime: now,
                };
                break;
            }
          } catch (error) {
            reply = {
              type: 'error',
              actionId: command.actionId,
              version: peer.sequence,
              code:
                error instanceof RoomError ? error.code : 'SOCIAL_UNAVAILABLE',
              ...(command.type === 'music' ? { music: channel.music } : {}),
            };
          }
          peer.receipts.set(command.actionId, { hash, reply });
          if (peer.receipts.size > 128)
            peer.receipts.delete(peer.receipts.keys().next().value!);
          this.send(peer, reply);
        })
        .catch(() => socket.close(1008, 'Invalid social message'));
    });
  }
  disconnect(roomId: string, actorId: string, code = 1001) {
    const channel = this.channels.get(roomId);
    const peer = channel?.peers.get(actorId);
    if (peer) {
      channel!.peers.delete(actorId);
      peer.socket.close(code, 'Social connection ended');
    }
  }
  sweep() {
    for (const [roomId, channel] of this.channels)
      if (!this.roomAlive(roomId, channel.hostId)) {
        for (const peer of channel.peers.values())
          peer.socket.close(1001, 'Room ended');
        this.channels.delete(roomId);
      }
    for (const limiter of [
      this.traffic,
      this.chatRate,
      this.reactionRate,
      this.musicRate,
      this.reportRate,
    ])
      limiter.sweep();
  }
  heartbeat() {
    this.sweep();
    for (const [roomId, channel] of this.channels)
      for (const peer of channel.peers.values()) {
        try {
          this.authorize(roomId, peer.identity);
          if (!peer.alive) throw new Error();
          peer.alive = false;
          peer.socket.ping();
        } catch {
          this.disconnect(roomId, peer.identity.actorId);
          peer.socket.terminate();
        }
      }
  }
  stop() {
    for (const [roomId, channel] of this.channels)
      for (const actorId of [...channel.peers.keys()])
        this.disconnect(roomId, actorId);
    this.channels.clear();
  }
}

import { createHash, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { z } from 'zod';
import type { VoiceMessage, VoiceParticipant } from '@omi/shared';
import { SerialQueue, RateLimiter, RoomError } from '../multiplayer/support.js';
import type { Identity } from '../multiplayer/support.js';
const participant = z.strictObject({ actorId: z.uuid(), callId: z.uuid() });
const description = z.strictObject({
  kind: z.literal('description'),
  description: z.strictObject({
    type: z.enum(['offer', 'answer']),
    sdp: z
      .string()
      .max(2800)
      .refine(
        (sdp) =>
          (sdp.match(/^m=/gm) ?? []).length === 1 && /^m=audio /m.test(sdp),
        'Only one audio track is permitted',
      ),
  }),
});
const candidate = z.strictObject({
  kind: z.literal('candidate'),
  candidate: z.strictObject({
    candidate: z.string().max(1024),
    sdpMid: z.string().max(32).nullable(),
    sdpMLineIndex: z.number().int().min(0).max(0).nullable(),
    usernameFragment: z.string().max(256).nullable().optional(),
  }),
});
const envelope = {
  roomId: z.uuid(),
  actorId: z.uuid(),
  callId: z.uuid(),
  actionId: z.uuid(),
  expectedVersion: z.number().int().min(0).max(1_000_000),
};
export const voiceCommand = z.discriminatedUnion('type', [
  z.strictObject({
    ...envelope,
    type: z.literal('signal'),
    target: participant,
    payload: z.discriminatedUnion('kind', [description, candidate]),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('mute'),
    payload: z.strictObject({ muted: z.boolean() }),
  }),
]);
type VoicePeer = {
  socket: WebSocket;
  identity: Identity;
  public: VoiceParticipant;
  version: number;
  alive: boolean;
  receipts: Map<string, { fingerprint: string; version: number }>;
};
type Channel = { peers: Map<string, VoicePeer>; queue: SerialQueue };
export class VoiceService {
  private readonly channels = new Map<string, Channel>();
  private readonly rate: RateLimiter;
  constructor(
    private readonly authorized: (roomId: string, identity: Identity) => void,
    now: () => number,
    private readonly maxRooms: number,
  ) {
    this.rate = new RateLimiter(now, 90, 10_000);
  }
  private send(peer: VoicePeer, message: VoiceMessage) {
    const data = JSON.stringify(message);
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    if (peer.socket.bufferedAmount + Buffer.byteLength(data) > 65_536) {
      peer.socket.terminate();
      return;
    }
    peer.socket.send(data, (error) => {
      if (error) peer.socket.terminate();
    });
  }
  connect(roomId: string, identity: Identity, socket: WebSocket) {
    this.authorized(roomId, identity);
    let channel = this.channels.get(roomId);
    if (!channel) {
      if (this.channels.size >= this.maxRooms)
        throw new RoomError('VOICE_CAPACITY', 503);
      channel = { peers: new Map(), queue: new SerialQueue(64) };
      this.channels.set(roomId, channel);
    }
    if (!channel.peers.has(identity.actorId) && channel.peers.size >= 4)
      throw new RoomError('VOICE_CAPACITY', 503);
    // Replaced voice calls receive new call IDs; old candidates cannot cross a reconnect.
    this.disconnect(roomId, identity.actorId, 4001);
    this.channels.set(roomId, channel);
    const peer: VoicePeer = {
      socket,
      identity,
      public: { actorId: identity.actorId, callId: randomUUID(), muted: false },
      version: 0,
      alive: true,
      receipts: new Map(),
    };
    const others = [...channel.peers.values()];
    channel.peers.set(identity.actorId, peer);
    this.send(peer, {
      type: 'hello',
      self: peer.public,
      peers: others.map((item) => item.public),
    });
    for (const other of others)
      this.send(other, { type: 'joined', peer: peer.public });
    socket.on('error', () => undefined);
    socket.on('pong', () => {
      peer.alive = true;
    });
    socket.on('close', () => {
      if (channel.peers.get(identity.actorId) === peer)
        this.disconnect(roomId, identity.actorId);
    });
    socket.on('message', (data, binary) => {
      if (binary) {
        socket.close(1003, 'Text signaling required');
        return;
      }
      if (!this.rate.take(identity.actorId)) {
        socket.close(1008, 'Voice rate limited');
        return;
      }
      void channel.queue
        .run(() => {
          this.authorized(roomId, identity);
          if (channel.peers.get(identity.actorId) !== peer) throw new Error();
          const command = voiceCommand.parse(JSON.parse(data.toString()));
          if (
            command.roomId !== roomId ||
            command.actorId !== identity.actorId ||
            command.callId !== peer.public.callId
          )
            throw new Error();
          const fingerprint = createHash('sha256')
            .update(JSON.stringify(command))
            .digest('hex');
          const previous = peer.receipts.get(command.actionId);
          if (previous) {
            if (previous.fingerprint !== fingerprint) throw new Error();
            this.send(peer, {
              type: 'ack',
              actionId: command.actionId,
              version: previous.version,
            });
            return;
          }
          if (command.expectedVersion !== peer.version) throw new Error();
          if (command.type === 'signal') {
            const target = channel.peers.get(command.target.actorId);
            if (
              target &&
              target !== peer &&
              target.public.callId === command.target.callId
            ) {
              this.authorized(roomId, target.identity);
              this.send(target, {
                type: 'signal',
                from: peer.public,
                payload: command.payload,
              });
            }
            // A departed target is harmless; do not disclose membership outside this channel.
          } else {
            peer.public = { ...peer.public, muted: command.payload.muted };
            for (const other of channel.peers.values())
              if (other !== peer)
                this.send(other, { type: 'updated', peer: peer.public });
          }
          peer.version++;
          peer.receipts.set(command.actionId, {
            fingerprint,
            version: peer.version,
          });
          if (peer.receipts.size > 128)
            peer.receipts.delete(peer.receipts.keys().next().value!);
          this.send(peer, {
            type: 'ack',
            actionId: command.actionId,
            version: peer.version,
          });
        })
        .catch(() => socket.close(1008, 'Invalid voice signaling'));
    });
  }
  disconnect(roomId: string, actorId: string, code = 1001) {
    const channel = this.channels.get(roomId);
    const peer = channel?.peers.get(actorId);
    if (!channel || !peer) return;
    channel.peers.delete(actorId);
    peer.socket.close(code, 'Voice call ended');
    for (const other of channel.peers.values())
      this.send(other, { type: 'left', actorId, callId: peer.public.callId });
    if (!channel.peers.size) this.channels.delete(roomId);
  }
  heartbeat() {
    this.rate.sweep();
    for (const [roomId, channel] of this.channels)
      for (const peer of channel.peers.values()) {
        try {
          this.authorized(roomId, peer.identity);
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
  }
}

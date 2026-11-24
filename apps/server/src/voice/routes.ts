import { z } from 'zod';
import { WebSocket } from 'ws';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RoomService } from '../multiplayer/rooms.js';
import type { Identity } from '../multiplayer/support.js';
import { RoomError } from '../multiplayer/support.js';
import { VoiceService } from './service.js';
import { iceConfiguration } from './config.js';
import type { IceSettings } from './config.js';
export function registerVoice(
  api: FastifyInstance,
  rooms: RoomService,
  identityFor: (request: FastifyRequest) => Identity,
  settings: IceSettings,
  now: () => number,
  maxRooms: number,
  accountOnly = false,
  communicationsEnabled = true,
  communicationBlocked: (actor: string) => boolean = () => false,
) {
  const roomIdFor = (value: string) => {
    const result = z.uuid().safeParse(value);
    if (!result.success) throw new RoomError('INVALID_REQUEST', 400);
    return result.data;
  };
  const authorize = (roomId: string, identity: Identity) => {
    if (accountOnly && !identity.userId)
      throw new RoomError('GUEST_COMMUNICATION_DISABLED', 403);
    if (!communicationsEnabled || communicationBlocked(identity.actorId))
      throw new RoomError('PRIVATE_COMMUNICATION_DISABLED', 403);
    const { room } = rooms.authorize(roomId, identity);
    if (room.ranked) throw new RoomError('RANKED_COMMUNICATION_DISABLED', 403);
    const peer = room.peers.get(identity.actorId);
    if (
      !peer ||
      peer.socket.readyState !== WebSocket.OPEN ||
      peer.identity.tokenHash !== identity.tokenHash
    )
      throw new RoomError('GAME_CONNECTION_REQUIRED', 403);
  };
  const voice = new VoiceService(authorize, now, maxRooms);
  const music = new VoiceService(
    authorize,
    now,
    maxRooms,
    (roomId, sender, target, payload) => {
      const { room } = rooms.authorize(roomId, sender);
      const sending = room.hostId === sender.actorId;
      if (sending === (room.hostId === target.actorId)) return false;
      if (payload.kind !== 'description') return true;
      // Music is one-way. Reject reverse or bidirectional media before relay.
      const directions = payload.description.sdp.match(
        /^a=(sendonly|recvonly|sendrecv|inactive)\r?$/gm,
      );
      return (
        directions?.length === 1 &&
        directions[0]!.trim() === (sending ? 'a=sendonly' : 'a=recvonly')
      );
    },
    (roomId, sender) =>
      rooms.authorize(roomId, sender).room.hostId === sender.actorId,
  );
  rooms.onPeerDisconnect = (roomId, actorId) => {
    voice.disconnect(roomId, actorId);
    music.disconnect(roomId, actorId);
  };
  const timer = setInterval(() => {
    voice.heartbeat();
    music.heartbeat();
  }, 30_000);
  timer.unref();
  api.addHook('preClose', async () => {
    clearInterval(timer);
    voice.stop();
    music.stop();
  });
  api.post<{ Params: { roomId: string } }>(
    '/rooms/:roomId/voice/config',
    async (request) => {
      const roomId = roomIdFor(request.params.roomId);
      if (!z.strictObject({}).safeParse(request.body).success)
        throw new RoomError('INVALID_REQUEST', 400);
      const identity = identityFor(request);
      authorize(roomId, identity);
      return iceConfiguration(settings, identity.actorId, now());
    },
  );
  for (const [lane, service] of [
    ['voice', voice],
    ['music', music],
  ] as const) {
    api.get<{ Params: { roomId: string } }>(
      `/rooms/:roomId/${lane}/ws`,
      {
        websocket: true,
        preValidation: async (request) => {
          if (request.url.includes('?'))
            throw new RoomError('QUERY_NOT_ALLOWED', 400);
          authorize(roomIdFor(request.params.roomId), identityFor(request));
        },
      },
      (socket, request) => {
        try {
          service.connect(request.params.roomId, identityFor(request), socket);
        } catch {
          socket.close(1008, 'Media unavailable');
        }
      },
    );
  }
}

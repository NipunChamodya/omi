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
) {
  const roomIdFor = (value: string) => {
    const result = z.uuid().safeParse(value);
    if (!result.success) throw new RoomError('INVALID_REQUEST', 400);
    return result.data;
  };
  const authorize = (roomId: string, identity: Identity) => {
    const { room } = rooms.authorize(roomId, identity);
    const peer = room.peers.get(identity.actorId);
    if (
      !peer ||
      peer.socket.readyState !== WebSocket.OPEN ||
      peer.identity.tokenHash !== identity.tokenHash
    )
      throw new RoomError('GAME_CONNECTION_REQUIRED', 403);
  };
  const voice = new VoiceService(authorize, now, maxRooms);
  rooms.onPeerDisconnect = (roomId, actorId) =>
    voice.disconnect(roomId, actorId);
  const timer = setInterval(() => voice.heartbeat(), 30_000);
  timer.unref();
  api.addHook('preClose', async () => {
    clearInterval(timer);
    voice.stop();
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
  api.get<{ Params: { roomId: string } }>(
    '/rooms/:roomId/voice/ws',
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
        voice.connect(request.params.roomId, identityFor(request), socket);
      } catch {
        socket.close(1008, 'Voice unavailable');
      }
    },
  );
}

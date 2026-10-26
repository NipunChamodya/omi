import { WebSocket } from 'ws';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RoomService } from '../multiplayer/rooms.js';
import type { Identity } from '../multiplayer/support.js';
import type { AccountRepository } from '../persistence/repository.js';
import { RoomError } from '../multiplayer/support.js';
import { SocialService } from './service.js';
export function registerSocial(
  api: FastifyInstance,
  rooms: RoomService,
  identityFor: (request: FastifyRequest) => Identity,
  repo: AccountRepository,
  now: () => number,
  maxRooms: number,
) {
  const authorize = (roomId: string, identity: Identity) => {
    const { room } = rooms.authorize(roomId, identity);
    const game = room.peers.get(identity.actorId);
    if (
      !game ||
      game.socket.readyState !== WebSocket.OPEN ||
      game.identity.tokenHash !== identity.tokenHash
    )
      throw new RoomError('GAME_CONNECTION_REQUIRED', 403);
    return { hostId: room.hostId };
  };
  const social = new SocialService(
    authorize,
    (roomId, hostId) => rooms.forActor(hostId)?.roomId === roomId,
    (report) => repo.storeSocialReport(report),
    now,
    maxRooms,
  );
  const previous = rooms.onPeerDisconnect;
  rooms.onPeerDisconnect = (roomId, actorId) => {
    previous(roomId, actorId);
    social.disconnect(roomId, actorId);
  };
  const timer = setInterval(() => social.heartbeat(), 30_000);
  timer.unref();
  api.addHook('preClose', async () => {
    clearInterval(timer);
    social.stop();
  });
  api.get<{ Params: { roomId: string } }>(
    '/rooms/:roomId/social/ws',
    {
      websocket: true,
      preValidation: async (request) => {
        if (request.url.includes('?'))
          throw new RoomError('QUERY_NOT_ALLOWED', 400);
        const roomId = z.uuid().safeParse(request.params.roomId);
        if (!roomId.success) throw new RoomError('INVALID_REQUEST', 400);
        authorize(roomId.data, identityFor(request));
      },
    },
    (socket, request) => {
      try {
        social.connect(request.params.roomId, identityFor(request), socket);
      } catch {
        socket.close(1008, 'Social unavailable');
      }
    },
  );
}

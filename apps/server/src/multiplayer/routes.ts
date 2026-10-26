import cookie from '@fastify/cookie';
import { registerSocial } from '../social/routes.js';
import { registerVoice } from '../voice/routes.js';
import type { IceSettings } from '../voice/config.js';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ZodType } from 'zod';
import type { ClientCommand } from '@omi/shared';
import type { RandomInt } from '@omi/game-engine';
import type { Accounts } from '../auth/accounts.js';
import { digest } from '../auth/accounts.js';
import { registerAccountRoutes, sessionCookie } from '../auth/routes.js';
import {
  codeSchema,
  commandSchema,
  createSchema,
  guestSchema,
  joinSchema,
  roomIdSchema,
} from './validation.js';
import { DEFAULT_LIMITS, RoomService } from './rooms.js';
import type { Limits, Peer, Policies } from './rooms.js';
import { GuestSessions, RateLimiter, RoomError } from './support.js';
import type { Identity } from './support.js';

export type MultiplayerOptions = {
  ice?: IceSettings;
  origin: string;
  secureCookies: boolean;
  now?: () => number;
  limits?: Partial<Limits>;
  policies?: Policies;
  entropy?: RandomInt;
  accounts: Accounts;
  allowGuests: boolean;
};
function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new RoomError('INVALID_REQUEST', 400);
  return result.data;
}
export async function registerMultiplayer(
  app: FastifyInstance,
  options: MultiplayerOptions,
): Promise<void> {
  const now = options.now ?? Date.now;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const sessions = new GuestSessions(
    now,
    limits.sessionTtlMs,
    limits.maxSessions,
  );
  const rooms = new RoomService(
    now,
    (identity) =>
      sessions.active(identity) || options.accounts.active(identity),
    limits,
    options.policies,
    options.entropy,
  );
  const httpRate = new RateLimiter(now, limits.httpPerMinute, 60_000);
  const gameSockets = new Set<import('ws').WebSocket>();
  const messageRate = new RateLimiter(
    now,
    limits.messagesPerTenSeconds,
    10_000,
  );
  const cookieName = options.secureCookies
    ? '__Host-omi_transport'
    : 'omi_transport';
  const identityFor = (request: FastifyRequest): Identity => {
    const identity =
      options.accounts.get(
        request.cookies[sessionCookie(options.secureCookies)],
      )?.identity ??
      (options.allowGuests
        ? sessions.get(request.cookies[cookieName])
        : undefined);
    if (!identity) throw new RoomError('SESSION_REQUIRED', 401);
    return identity;
  };
  await app.register(cookie);
  await app.register(websocket, {
    options: { maxPayload: 4096, perMessageDeflate: false },
  });
  const maintenance = setInterval(() => {
    sessions.sweep();
    options.accounts.maintenance();
    rooms.heartbeat();
    httpRate.sweep();
    messageRate.sweep();
  }, 30_000);
  maintenance.unref();
  app.addHook('preClose', async () => {
    clearInterval(maintenance);
    rooms.stop();
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RoomError)
      return reply
        .code(error.status)
        .send({ code: error.code, version: error.version });
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    )
      return reply.code(413).send({ code: 'PAYLOAD_TOO_LARGE' });
    if (
      error instanceof Error &&
      'statusCode' in error &&
      error.statusCode === 413
    )
      return reply.code(413).send({ code: 'AVATAR_TOO_LARGE' });
    if (
      error instanceof Error &&
      'statusCode' in error &&
      (error.statusCode === 400 || error.statusCode === 415)
    )
      return reply.code(error.statusCode).send({ code: 'INVALID_REQUEST' });
    app.log.error({ requestId: request.id }, 'Multiplayer request failed');
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  options.accounts.onProfileChange = (profile) => rooms.updateProfile(profile);
  await registerAccountRoutes(app, options.accounts, rooms, {
    origin: options.origin,
    secure: options.secureCookies,
    guestAllowed: options.allowGuests,
    now,
    revokeGuest: (token) => {
      sessions.revoke(token);
      if (token) rooms.disconnectSession(digest(token));
    },
  });
  await app.register(async (api) => {
    api.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (request.headers.origin !== options.origin)
        throw new RoomError('ORIGIN_REJECTED', 403);
      reply
        .header('Access-Control-Allow-Origin', options.origin)
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Vary', 'Origin');
      if (!httpRate.take(request.ip)) throw new RoomError('RATE_LIMITED', 429);
    });
    registerVoice(
      api,
      rooms,
      identityFor,
      options.ice ?? {
        VOICE_STUN_URLS: [],
        VOICE_TURN_URLS: [],
        VOICE_ICE_POLICY: 'all',
      },
      now,
      limits.maxRooms,
    );
    registerSocial(
      api,
      rooms,
      identityFor,
      options.accounts.repo,
      now,
      limits.maxRooms,
    );
    api.options('/*', async (_request, reply) =>
      reply
        .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
        .code(204)
        .send(),
    );
    api.post('/transport/session', async (request, reply) => {
      const body = parse(guestSchema, request.body);
      const account = options.accounts.get(
        request.cookies[sessionCookie(options.secureCookies)],
      );
      if (account)
        return {
          actorId: account.identity.actorId,
          displayName: account.profile.displayName,
          expiresAt: account.identity.expiresAt,
        };
      if (!options.allowGuests) throw new RoomError('LOGIN_REQUIRED', 401);
      const existing = sessions.get(request.cookies[cookieName]);
      const { identity, token } = existing
        ? { identity: existing, token: null }
        : sessions.create(body.displayName);
      if (token)
        reply.setCookie(cookieName, token, {
          httpOnly: true,
          sameSite: 'strict',
          secure: options.secureCookies,
          path: '/',
          maxAge: Math.floor(limits.sessionTtlMs / 1000),
        });
      return {
        actorId: identity.actorId,
        displayName: identity.displayName,
        expiresAt: identity.expiresAt,
      };
    });
    api.post('/rooms', async (request, reply) => {
      const identity = identityFor(request);
      const body = parse(createSchema, request.body);
      return reply.code(201).send(rooms.create(identity, body));
    });
    api.get<{ Params: { code: string } }>(
      '/rooms/:code/preview',
      async (request) => {
        const identity = identityFor(request);
        return rooms.preview(identity, parse(codeSchema, request.params.code));
      },
    );
    // Browser same-origin GET requests can omit Origin. These read-only POST equivalents
    // retain mandatory Origin validation without weakening the existing routes.
    api.post('/rooms/preview', async (request) => {
      const identity = identityFor(request);
      const body = parse(z.strictObject({ code: codeSchema }), request.body);
      return rooms.preview(identity, body.code);
    });
    api.post('/rooms/snapshot', async (request) => {
      const identity = identityFor(request);
      const body = parse(
        z.strictObject({ roomId: roomIdSchema }),
        request.body,
      );
      return rooms.getSnapshot(body.roomId, identity);
    });
    api.post('/rooms/join', async (request) => {
      const identity = identityFor(request);
      return rooms.join(identity, parse(joinSchema, request.body));
    });
    api.get<{ Params: { roomId: string } }>(
      '/rooms/:roomId/snapshot',
      async (request) => {
        const identity = identityFor(request);
        return rooms.getSnapshot(
          parse(roomIdSchema, request.params.roomId),
          identity,
        );
      },
    );
    api.get<{ Params: { roomId: string } }>(
      '/rooms/:roomId/ws',
      {
        websocket: true,
        preValidation: async (request) => {
          // Tokens never appear in URLs. Refuse any query string rather than accepting token parameters.
          if (request.url.includes('?'))
            throw new RoomError('QUERY_NOT_ALLOWED', 400);
          rooms.authorize(
            parse(roomIdSchema, request.params.roomId),
            identityFor(request),
          );
          if (gameSockets.size >= limits.maxRooms * 4 + 4)
            throw new RoomError('CONNECTION_CAPACITY', 503);
        },
      },
      (socket, request) => {
        gameSockets.add(socket);
        const roomId = request.params.roomId;
        const peer: Peer = {
          socket,
          identity: identityFor(request),
          alive: true,
        };
        // Attach listeners synchronously; queued messages await attachment, avoiding dropped early frames.
        const attached = rooms.attach(roomId, peer);
        void attached.catch(() => socket.terminate());
        // ws closes protocol/size failures itself; never log raw frames or terminate before its close frame.
        socket.on('error', () => undefined);
        socket.on('pong', () => {
          peer.alive = true;
        });
        socket.on('close', () => {
          gameSockets.delete(socket);
          void rooms.detach(roomId, peer).catch(() => socket.terminate());
        });
        socket.on('message', (data, isBinary) => {
          if (
            !sessions.active(peer.identity) &&
            !options.accounts.active(peer.identity)
          ) {
            socket.close(1008, 'Session expired');
            return;
          }
          if (!messageRate.take(peer.identity.actorId)) {
            socket.close(1008, 'Rate limited');
            return;
          }
          if (isBinary) {
            socket.close(1003, 'Text JSON required');
            return;
          }
          let command: ClientCommand;
          try {
            command = parse(commandSchema, JSON.parse(data.toString()));
          } catch {
            rooms.failure(peer, roomId, null, 'INVALID_MESSAGE');
            return;
          }
          void attached
            .then(() => rooms.command(roomId, peer, command))
            .catch((error: unknown) => {
              rooms.failure(
                peer,
                roomId,
                command.actionId,
                error instanceof RoomError ? error.code : 'INTERNAL_ERROR',
              );
            });
        });
      },
    );
  });
}

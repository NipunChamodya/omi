import multipart from '@fastify/multipart';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Accounts } from './accounts.js';
import { digest } from './accounts.js';
import type { RoomService } from '../multiplayer/rooms.js';
import { RateLimiter, RoomError } from '../multiplayer/support.js';
import { cropSchema, MAX_UPLOAD_BYTES } from '../avatars/images.js';
import type { AvatarSize } from '../avatars/storage.js';
const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^\P{Cc}+$/u);
const versionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const empty = z.strictObject({});
export const sessionCookie = (secure: boolean) =>
  secure ? '__Host-omi_session' : 'omi_session';
const bindingCookie = (secure: boolean) =>
  secure ? '__Host-omi_oauth' : 'omi_oauth';
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new RoomError('INVALID_REQUEST', 400);
  return result.data;
}
export async function registerAccountRoutes(
  app: FastifyInstance,
  accounts: Accounts,
  rooms: RoomService,
  options: {
    origin: string;
    secure: boolean;
    guestAllowed: boolean;
    now: () => number;
    revokeGuest: (token: string | undefined) => void;
  },
) {
  const cookieName = sessionCookie(options.secure);
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax' as const,
  };
  const rate = new RateLimiter(options.now, 120, 60_000);
  const uploads = new RateLimiter(options.now, 6, 60_000);
  let activeUploads = 0;
  const current = (request: FastifyRequest) =>
    accounts.get(request.cookies[cookieName]);
  const authorized = (request: FastifyRequest) => {
    const session = current(request);
    if (!session) throw new RoomError('LOGIN_REQUIRED', 401);
    accounts.requireCsrf(session.identity, request.headers['x-csrf-token']);
    return session;
  };
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: 2,
      parts: 3,
      fieldSize: 1024,
      fieldNameSize: 32,
    },
  });
  await app.register(async (api) => {
    api.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const publicGet =
        request.method === 'GET' &&
        (request.routeOptions.url === '/auth/google/callback' ||
          request.routeOptions.url === '/avatars/:id/:size');
      if (!publicGet && request.headers.origin !== options.origin)
        throw new RoomError('ORIGIN_REJECTED', 403);
      if (request.headers.origin === options.origin)
        reply
          .header('Access-Control-Allow-Origin', options.origin)
          .header('Access-Control-Allow-Credentials', 'true')
          .header('Vary', 'Origin');
      if (!rate.take(request.ip)) throw new RoomError('RATE_LIMITED', 429);
    });
    api.post('/auth/session', async (request) => {
      parse(empty, request.body);
      const session = current(request);
      return {
        user: session?.profile ?? null,
        csrfToken: session?.csrfToken ?? null,
        expiresAt: session?.identity.expiresAt ?? null,
        googleAvailable: accounts.provider !== null,
        guestAllowed: options.guestAllowed,
        avatarUploadsEnabled: accounts.storage !== null,
        room: session ? rooms.forActor(session.identity.actorId) : null,
      };
    });
    api.post('/auth/google/start', async (request, reply) => {
      const { returnTo } = parse(
        z.strictObject({
          returnTo: z
            .string()
            .regex(/^\/(?:\?room=[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})?$/)
            .default('/'),
        }),
        request.body,
      );
      const previous = request.cookies[bindingCookie(options.secure)];
      if (previous) accounts.repo.consumeTransaction(digest(previous));
      const result = await accounts.begin(returnTo);
      reply.setCookie(bindingCookie(options.secure), result.binding, {
        ...cookieOptions,
        maxAge: 300,
      });
      return { url: result.url };
    });
    api.get('/auth/google/callback', async (request, reply) => {
      const binding = request.cookies[bindingCookie(options.secure)];
      reply.clearCookie(bindingCookie(options.secure), cookieOptions);
      try {
        const url = new URL(accounts.callback);
        url.search = new URL(request.url, 'http://callback.invalid').search;
        const old = request.cookies[cookieName];
        const result = await accounts.complete(binding, url, old);
        if (old) rooms.disconnectSession(digest(old));
        options.revokeGuest(
          request.cookies[
            options.secure ? '__Host-omi_transport' : 'omi_transport'
          ],
        );
        reply.clearCookie(
          options.secure ? '__Host-omi_transport' : 'omi_transport',
          { path: '/', secure: options.secure },
        );
        reply.setCookie(cookieName, result.token, {
          ...cookieOptions,
          maxAge: Math.floor((result.expiresAt - options.now()) / 1000),
        });
        return reply.code(303).redirect(`${options.origin}${result.returnTo}`);
      } catch {
        app.log.info({ event: 'login_failed' }, 'Google login failed');
        return reply.code(303).redirect(`${options.origin}/?auth=failed`);
      }
    });
    api.post('/auth/logout', async (request, reply) => {
      parse(empty, request.body);
      const session = current(request);
      if (session) {
        accounts.requireCsrf(session.identity, request.headers['x-csrf-token']);
        accounts.revoke(session.identity.tokenHash);
        rooms.disconnectSession(session.identity.tokenHash);
      }
      options.revokeGuest(
        request.cookies[
          options.secure ? '__Host-omi_transport' : 'omi_transport'
        ],
      );
      reply.clearCookie(cookieName, cookieOptions);
      reply.clearCookie(bindingCookie(options.secure), cookieOptions);
      reply.clearCookie(
        options.secure ? '__Host-omi_transport' : 'omi_transport',
        { path: '/', secure: options.secure },
      );
      return { ok: true };
    });
    api.post('/profile', async (request) => {
      const session = authorized(request);
      const body = parse(
        z.strictObject({
          displayName: nameSchema,
          expectedVersion: versionSchema,
        }),
        request.body,
      );
      return accounts.rename(
        session.identity,
        body.expectedVersion,
        body.displayName,
      );
    });
    api.post('/profile/avatar/remove', async (request) => {
      const session = authorized(request);
      const body = parse(
        z.strictObject({ expectedVersion: versionSchema }),
        request.body,
      );
      return accounts.removeAvatar(session.identity, body.expectedVersion);
    });
    api.post(
      '/profile/avatar',
      { bodyLimit: MAX_UPLOAD_BYTES + 4096 },
      async (request) => {
        const session = authorized(request);
        if (!accounts.storage)
          throw new RoomError('AVATAR_STORAGE_UNAVAILABLE', 503);
        if (activeUploads >= 2 || !uploads.take(session.identity.actorId))
          throw new RoomError('UPLOAD_BUSY', 429);
        activeUploads++;
        try {
          let bytes: Buffer | undefined;
          let crop: unknown;
          let expectedVersion: unknown;
          for await (const part of request.parts()) {
            if (part.type === 'file') {
              if (part.fieldname !== 'avatar')
                throw new RoomError('INVALID_REQUEST', 400);
              bytes = await part.toBuffer();
              if (part.file.truncated)
                throw new RoomError('AVATAR_TOO_LARGE', 413);
            } else if (
              part.fieldname === 'crop' &&
              typeof part.value === 'string'
            ) {
              try {
                crop = JSON.parse(part.value);
              } catch {
                throw new RoomError('INVALID_REQUEST', 400);
              }
            } else if (
              part.fieldname === 'expectedVersion' &&
              typeof part.value === 'string' &&
              /^\d{1,16}$/.test(part.value)
            )
              expectedVersion = Number(part.value);
            else throw new RoomError('INVALID_REQUEST', 400);
          }
          if (!bytes) throw new RoomError('INVALID_AVATAR', 400);
          return accounts.upload(
            session.identity,
            parse(versionSchema, expectedVersion),
            bytes,
            parse(cropSchema, crop),
          );
        } finally {
          activeUploads--;
        }
      },
    );
    api.get<{ Params: { id: string; size: string } }>(
      '/avatars/:id/:size',
      async (request, reply) => {
        const id = parse(z.uuid(), request.params.id);
        const size = parse(
          z.enum(['profile.webp', 'thumbnail.webp']),
          request.params.size,
        ).replace('.webp', '') as AvatarSize;
        const avatar = accounts.repo.avatar(id);
        if (!avatar || avatar.status !== 'active' || !accounts.storage)
          throw new RoomError('AVATAR_NOT_FOUND', 404);
        try {
          const bytes = await accounts.storage.get(id, size);
          return reply
            .header('Cache-Control', 'public, max-age=3600')
            .header('X-Content-Type-Options', 'nosniff')
            .type('image/webp')
            .send(bytes);
        } catch {
          throw new RoomError('AVATAR_NOT_FOUND', 404);
        }
      },
    );
  });
}

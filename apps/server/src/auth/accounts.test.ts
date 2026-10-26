import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import sharp from 'sharp';
import { buildApp } from '../app.js';
import { parseConfig } from '../config.js';
import { GoogleOidc } from './oidc.js';
import { SqliteAccounts } from '../persistence/repository.js';
import { MemoryAvatars, mockOidc } from '../../test-fixtures/provider.js';
import type { AuthSession, PublicProfile, RoomDescriptor } from '@omi/shared';
const origin = 'http://127.0.0.1:5173';
const callback = 'http://127.0.0.1:3000/auth/google/callback';
let provider: Awaited<ReturnType<typeof mockOidc>>;
let app: ReturnType<typeof buildApp>;
let base: string;
let repository: SqliteAccounts;
let storage: MemoryAvatars;
let directory: string;
function config() {
  return parseConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: origin,
    DATABASE_PATH: join(directory, 'accounts.sqlite'),
    GOOGLE_CLIENT_ID: 'mock-client',
    GOOGLE_CLIENT_SECRET: 'mock-secret',
    GOOGLE_CALLBACK_URL: callback,
  });
}
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'omi-stage-e-'));
  provider = await mockOidc();
  storage = new MemoryAvatars();
  repository = new SqliteAccounts(config().DATABASE_PATH);
  app = buildApp({
    logger: false,
    config: config(),
    accounts: {
      repository,
      storage,
      provider: new GoogleOidc(
        'mock-client',
        'mock-secret',
        callback,
        new URL(provider.url),
        true,
      ),
    },
  });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
  await provider.app.close();
  rmSync(directory, { recursive: true, force: true });
});
const headers = (cookie?: string, csrf?: string) => ({
  origin,
  ...(cookie ? { cookie } : {}),
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
function post(url: string, payload: object, cookie?: string, csrf?: string) {
  return app.inject({
    method: 'POST',
    url,
    payload,
    headers: headers(cookie, csrf),
  });
}
async function initiate(returnTo = '/') {
  const response = await post('/auth/google/start', { returnTo });
  expect(response.statusCode).toBe(200);
  const binding = response.cookies.find((item) => item.name === 'omi_oauth')!;
  const url = response.json<{ url: string }>().url;
  const authorize = await fetch(url, { redirect: 'manual' });
  return {
    url,
    binding: `${binding.name}=${binding.value}`,
    callback: new URL(authorize.headers.get('location')!),
  };
}
async function login() {
  const flow = await initiate();
  const result = await app.inject({
    method: 'GET',
    url: flow.callback.pathname + flow.callback.search,
    headers: { cookie: flow.binding },
  });
  expect(result.statusCode).toBe(303);
  expect(result.headers.location).toBe(`${origin}/`);
  const cookie = result.cookies.find((item) => item.name === 'omi_session')!;
  expect(cookie.httpOnly).toBe(true);
  const value = `${cookie.name}=${cookie.value}`;
  const response = await post('/auth/session', {}, value);
  expect(response.statusCode).toBe(200);
  return { cookie: value, session: response.json<AuthSession>() };
}
function multipart(
  bytes: Buffer,
  version: number,
  crop: object = { x: 0.5, y: 0.5, size: 1 },
  mime = 'image/png',
  extra = '',
) {
  const boundary = `omi-${randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="expectedVersion"\r\n\r\n${version}\r\n--${boundary}\r\nContent-Disposition: form-data; name="crop"\r\n\r\n${JSON.stringify(crop)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="untrusted.html"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n${extra}--${boundary}--\r\n`),
  ]);
  return { body, boundary };
}
async function upload(
  cookie: string,
  csrf: string,
  bytes: Buffer,
  version: number,
  crop?: object,
  mime?: string,
) {
  const data = multipart(bytes, version, crop, mime);
  return app.inject({
    method: 'POST',
    url: '/profile/avatar',
    payload: data.body,
    headers: {
      ...headers(cookie, csrf),
      'content-type': `multipart/form-data; boundary=${data.boundary}`,
    },
  });
}

describe('real OIDC authorization-code validation and server sessions', () => {
  it('requires Google by default, binds callbacks to the initiating browser, and rejects replay/state mixups', async () => {
    expect(
      (await post('/transport/session', { displayName: 'spoof' })).json().code,
    ).toBe('LOGIN_REQUIRED');
    const first = await initiate('/?room=ABCD2345');
    const noCookie = await app.inject({
      method: 'GET',
      url: first.callback.pathname + first.callback.search,
    });
    expect(noCookie.headers.location).toBe(`${origin}/?auth=failed`);
    const altered = new URL(first.callback);
    altered.searchParams.set('state', 'wrong');
    const bad = await app.inject({
      method: 'GET',
      url: altered.pathname + altered.search,
      headers: { cookie: first.binding },
    });
    expect(bad.headers.location).toBe(`${origin}/?auth=failed`);
    const replay = await app.inject({
      method: 'GET',
      url: first.callback.pathname + first.callback.search,
      headers: { cookie: first.binding },
    });
    expect(replay.headers.location).toBe(`${origin}/?auth=failed`);
    expect(
      (await post('/auth/google/start', { returnTo: 'https://evil.example' }))
        .statusCode,
    ).toBe(400);
  });
  it.each(['nonce', 'audience', 'issuer', 'expired', 'signature', 'userinfo'])(
    'rejects invalid %s before issuing an account session',
    async (fault) => {
      provider.setFault(fault);
      const flow = await initiate();
      const response = await app.inject({
        method: 'GET',
        url: flow.callback.pathname + flow.callback.search,
        headers: { cookie: flow.binding },
      });
      expect(response.headers.location).toBe(`${origin}/?auth=failed`);
      expect(
        response.cookies.some((cookie) => cookie.name === 'omi_session'),
      ).toBe(false);
    },
  );
  it('persists a returning identity/session and profile across repository reopening, without storing a raw session credential', async () => {
    const { cookie, session } = await login();
    expect(session.user).not.toBeNull();
    expect(session.csrfToken).toHaveLength(43);
    expect(session.guestAllowed).toBe(false);
    const renamed = await post(
      '/profile',
      { displayName: 'අමිල', expectedVersion: session.user!.version },
      cookie,
      session.csrfToken!,
    );
    expect(renamed.statusCode).toBe(200);
    const user = renamed.json<PublicProfile>();
    expect(user.displayName).toBe('අමිල');
    await app.close();
    repository = new SqliteAccounts(config().DATABASE_PATH);
    app = buildApp({
      logger: false,
      config: config(),
      accounts: {
        repository,
        storage,
        provider: new GoogleOidc(
          'mock-client',
          'mock-secret',
          callback,
          new URL(provider.url),
          true,
        ),
      },
    });
    base = await app.listen({ host: '127.0.0.1', port: 0 });
    const returning = (
      await post('/auth/session', {}, cookie)
    ).json<AuthSession>();
    expect(returning.user).toEqual(user);
    expect(repository.session(cookie.split('=')[1]!)).toBeUndefined();
  });
  it('enforces CSRF and profile versions and revokes an active gameplay socket on logout', async () => {
    const { cookie, session } = await login();
    const payload = {
      displayName: 'Changed',
      expectedVersion: session.user!.version,
    };
    expect((await post('/profile', payload, cookie)).statusCode).toBe(403);
    expect(
      (await post('/profile', payload, cookie, 'x'.repeat(43))).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/profile',
          headers: {
            origin: 'https://evil.example',
            cookie,
            'x-csrf-token': session.csrfToken!,
          },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const saved = await post('/profile', payload, cookie, session.csrfToken!);
    expect(saved.statusCode).toBe(200);
    expect(
      (await post('/profile', payload, cookie, session.csrfToken!)).json().code,
    ).toBe('PROFILE_CONFLICT');
    const room = (
      await post(
        '/rooms',
        {
          actorId: session.user!.id,
          actionId: randomUUID(),
          expectedVersion: 0,
        },
        cookie,
      )
    ).json<RoomDescriptor>();
    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/rooms/${room.roomId}/ws`,
      { headers: { origin, cookie } },
    );
    socket.on('error', () => undefined);
    await new Promise<void>((resolve) =>
      socket.once('message', () => resolve()),
    );
    expect((await post('/auth/logout', {}, cookie)).statusCode).toBe(403);
    const closed = new Promise<number>((resolve) =>
      socket.once('close', resolve),
    );
    expect(
      (await post('/auth/logout', {}, cookie, session.csrfToken!)).statusCode,
    ).toBe(200);
    expect(await closed).toBe(1008);
    expect(
      (await post('/auth/session', {}, cookie)).json<AuthSession>().user,
    ).toBeNull();
    expect(
      (await post('/rooms/snapshot', { roomId: room.roomId }, cookie))
        .statusCode,
    ).toBe(401);
  });
});

describe('private external avatar lifecycle', () => {
  it('validates real bytes, strips EXIF, creates optimized profile/thumbnail objects and preserves replacement/removal', async () => {
    const { cookie, session } = await login();
    const image = await sharp({
      create: { width: 500, height: 300, channels: 3, background: '#8dbe91' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await upload(
      cookie,
      session.csrfToken!,
      image,
      session.user!.version,
      { x: 0.2, y: 0.8, size: 0.5 },
      'text/plain',
    );
    expect(result.statusCode).toBe(200);
    const user = result.json<PublicProfile>();
    expect(user.avatarUrl).toMatch(/^\/avatars\//);
    expect(storage.objects.size).toBe(2);
    const profile = await app.inject({ method: 'GET', url: user.avatarUrl! });
    expect(profile.statusCode).toBe(200);
    expect(profile.headers['content-type']).toContain('image/webp');
    expect(profile.headers['x-content-type-options']).toBe('nosniff');
    const metadata = await sharp(profile.rawPayload).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    const thumbnail = await app.inject({
      method: 'GET',
      url: user.thumbnailUrl!,
    });
    const thumb = await sharp(thumbnail.rawPayload).metadata();
    expect(thumb.width).toBe(64);
    expect(thumb.height).toBe(64);
    const second = await upload(
      cookie,
      session.csrfToken!,
      image,
      user.version,
    );
    expect(second.statusCode).toBe(200);
    const replacement = second.json<PublicProfile>();
    expect(replacement.avatarUrl).not.toBe(user.avatarUrl);
    expect(
      (await app.inject({ method: 'GET', url: user.avatarUrl! })).statusCode,
    ).toBe(404);
    const removed = await post(
      '/profile/avatar/remove',
      { expectedVersion: replacement.version },
      cookie,
      session.csrfToken!,
    );
    expect(removed.statusCode).toBe(200);
    expect(removed.json<PublicProfile>().avatarUrl).toBeNull();
  });
  it('rejects malicious/unsupported bytes, unbounded crops, excessive size and guest/other-user profile mutations', async () => {
    const { cookie, session } = await login();
    const good = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    for (const data of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      Buffer.from('not an image'),
    ])
      expect(
        (await upload(cookie, session.csrfToken!, data, 0)).statusCode,
      ).toBe(400);
    expect(
      (
        await upload(cookie, session.csrfToken!, good, 0, {
          x: -1,
          y: 0,
          size: 1,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await upload(
          cookie,
          session.csrfToken!,
          Buffer.alloc(4 * 1024 * 1024 + 1),
          0,
        )
      ).statusCode,
    ).toBe(413);
    const other = await login();
    expect(other.session.user!.id).not.toBe(session.user!.id);
    expect(
      (
        await post(
          '/profile',
          {
            displayName: 'Taken',
            expectedVersion: 0,
            userId: session.user!.id,
          },
          other.cookie,
          other.session.csrfToken!,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await post('/profile', { displayName: 'guest', expectedVersion: 0 }))
        .statusCode,
    ).toBe(401);
    expect(storage.objects.size).toBe(0);
  });
  it('keeps the prior avatar/profile on storage failure and retains cleanup intent until deletion succeeds', async () => {
    const { cookie, session } = await login();
    const bytes = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    storage.failPut = true;
    expect(
      (await upload(cookie, session.csrfToken!, bytes, 0)).statusCode,
    ).toBe(500);
    expect(repository.user(session.user!.id)!.avatarId).toBeNull();
    storage.failPut = false;
    const saved = await upload(cookie, session.csrfToken!, bytes, 0);
    expect(saved.statusCode).toBe(200);
    const user = saved.json<PublicProfile>();
    storage.failDelete = true;
    const removed = await post(
      '/profile/avatar/remove',
      { expectedVersion: user.version },
      cookie,
      session.csrfToken!,
    );
    expect(removed.statusCode).toBe(200);
    expect(repository.cleanupAvatars(Date.now()).length).toBeGreaterThan(0);
    expect(
      (await app.inject({ method: 'GET', url: user.avatarUrl! })).statusCode,
    ).toBe(404);
  });
});
it('issues Secure host-only account cookies in production and forbids production guest configuration', async () => {
  expect(() =>
    parseConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://omi.example',
      ALLOW_GUESTS: 'true',
    }),
  ).toThrow();
  const redirect = 'https://omi.example/auth/google/callback';
  const production = buildApp({
    logger: false,
    config: parseConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://omi.example',
      DATABASE_PATH: ':memory:',
      GOOGLE_CLIENT_ID: 'mock-client',
      GOOGLE_CLIENT_SECRET: 'mock-secret',
      GOOGLE_CALLBACK_URL: redirect,
    }),
    accounts: {
      provider: new GoogleOidc(
        'mock-client',
        'mock-secret',
        redirect,
        new URL(provider.url),
        true,
      ),
    },
  });
  try {
    const started = await production.inject({
      method: 'POST',
      url: '/auth/google/start',
      headers: { origin: 'https://omi.example' },
      payload: { returnTo: '/' },
    });
    const binding = started.cookies.find(
      (cookie) => cookie.name === '__Host-omi_oauth',
    )!;
    expect(String(started.headers['set-cookie'])).toContain('Secure');
    const authorized = await fetch(started.json<{ url: string }>().url, {
      redirect: 'manual',
    });
    const url = new URL(authorized.headers.get('location')!);
    const result = await production.inject({
      method: 'GET',
      url: url.pathname + url.search,
      headers: { cookie: `${binding.name}=${binding.value}` },
    });
    const session = result.cookies.find(
      (cookie) => cookie.name === '__Host-omi_session',
    );
    expect(session).toBeDefined();
    const cookie = String(result.headers['set-cookie']);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  } finally {
    await production.close();
  }
});
it.each(['profile-conflict', 'logout'])(
  'does not commit an in-flight avatar after %s',
  async (mode) => {
    const { cookie, session } = await login();
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = storage.put.bind(storage);
    vi.spyOn(storage, 'put').mockImplementation(async (id, size, bytes) => {
      if (size === 'profile') {
        entered();
        await gate;
      }
      await original(id, size, bytes);
    });
    const pending = upload(cookie, session.csrfToken!, image, 0);
    await waiting;
    try {
      const response =
        mode === 'logout'
          ? await post('/auth/logout', {}, cookie, session.csrfToken!)
          : await post(
              '/profile',
              { displayName: 'Concurrent edit', expectedVersion: 0 },
              cookie,
              session.csrfToken!,
            );
      expect(response.statusCode).toBe(200);
    } finally {
      release();
    }
    const result = await pending;
    expect(result.statusCode).toBe(mode === 'logout' ? 401 : 409);
    expect(repository.user(session.user!.id)!.avatarId).toBeNull();
    await expect.poll(() => storage.objects.size).toBe(0);
  },
);

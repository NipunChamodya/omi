import { expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, lstatSync: vi.fn(actual.lstatSync) };
});
import {
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { SqliteAccounts } from '../persistence/repository.js';
import { backupDatabase, verifyBackup, restoreCopy } from './backup.js';
import { deploymentChecks } from './preflight.js';
import { safeLogPath, registerRuntimeMonitoring } from './runtime.js';
import { parseConfig } from '../config.js';
import { supportedNode22 } from './node.js';
import { buildApp } from '../app.js';
it.each(['EACCES', 'EIO', 'ENOENT'])(
  'treats only a missing optional environment file as acceptable (%s)',
  (code) => {
    const inspection = vi.mocked(fs.lstatSync);
    const original = inspection.getMockImplementation()!;
    inspection.mockImplementation((...args) => {
      if (args[0] === '.env')
        throw Object.assign(new Error('synthetic filesystem failure'), {
          code,
        });
      return Reflect.apply(original, fs, args);
    });
    try {
      const checks = deploymentChecks(
        parseConfig({ DATABASE_PATH: '/does-not-exist/omi.sqlite' }),
      );
      const check = checks.find(
        (item) => item.name === 'private-env-file-if-present',
      );
      if (code === 'ENOENT') expect(check?.passed).toBe(true);
      else expect(check?.passed).toBe(false);
    } finally {
      inspection.mockImplementation(original);
    }
  },
);
it('backs up committed WAL data, verifies restore integrity and refuses overwrites/symlinks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-backup-'));
  const source = join(dir, 'live.sqlite'),
    backup = join(dir, 'backup.sqlite');
  const repo = new SqliteAccounts(source);
  const user = repo.googleUser(
    'backup-subject',
    'Committed WAL account',
    null,
    Date.now(),
  );
  const observer = new Database(source);
  observer.pragma('wal_autocheckpoint = 0');
  try {
    repo.putSession({
      tokenHash: 'a'.repeat(64),
      userId: user.id,
      csrfToken: 'b'.repeat(43),
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    expect(statSync(source + '-wal').size).toBeGreaterThan(0);
    expect(await backupDatabase(source, backup)).toEqual({
      integrity: 'ok',
      migrations: 2,
    });
    expect(statSync(backup).mode & 0o777).toBe(0o600);
    const copy = join(dir, 'restore.sqlite');
    expect(await restoreCopy(backup, copy)).toMatchObject({
      integrity: 'ok',
      migrations: 2,
      sessionsInvalidated: true,
    });
    const restoredDb = new Database(copy, { readonly: true });
    expect(
      restoredDb.prepare('SELECT count(*) AS count FROM sessions').get(),
    ).toEqual({ count: 0 });
    restoredDb.close();
    expect(repo.session('a'.repeat(64))).toBeDefined();
    const restored = new SqliteAccounts(backup);
    expect(restored.user(user.id)?.displayName).toBe('Committed WAL account');
    restored.close();
    repo.updateName(user.id, 0, 'After backup', Date.now());
    const isolated = new SqliteAccounts(backup);
    expect(isolated.user(user.id)?.displayName).toBe('Committed WAL account');
    isolated.close();
    await expect(backupDatabase(source, backup)).rejects.toThrow();
    await expect(backupDatabase(source, source)).rejects.toThrow();
    const link = join(dir, 'link.sqlite');
    symlinkSync(source, link);
    await expect(backupDatabase(source, link)).rejects.toThrow();
    expect(repo.user(user.id)?.displayName).toBe('After backup');
    writeFileSync(join(dir, 'invalid.sqlite'), 'invalid');
    expect(() => verifyBackup(join(dir, 'invalid.sqlite'))).toThrow();
    await expect(
      backupDatabase(
        source,
        new URL('../../../web/public/private.sqlite', import.meta.url).pathname,
      ),
    ).rejects.toThrow();
  } finally {
    observer.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it('fails configuration readiness without inventing public OAuth or TURN success', () => {
  const checks = deploymentChecks(
    parseConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://omi.example',
      DATABASE_PATH: '/does-not-exist/omi.sqlite',
    }),
  );
  expect(
    checks.find((check) => check.name === 'google-configured')?.passed,
  ).toBe(false);
  expect(
    checks.find((check) => check.name === 'remote-voice-turn-configured')
      ?.passed,
  ).toBe(false);
  expect(
    checks.find((check) => check.name === 'database-integrity-and-migrations')
      ?.passed,
  ).toBe(false);
});
it('strips query credentials even from plugin path logs and bounds raw paths', () => {
  expect(safeLogPath('/health?token=private#fragment')).toBe('/health');
  expect(safeLogPath('/auth/google/callback?code=private&state=private')).toBe(
    '/auth/google/callback',
  );
  expect(safeLogPath('x'.repeat(1000))).toHaveLength(256);
  expect(safeLogPath(null)).toBe('');
});
it('emits bounded aggregate health without credentials and stops the monitor on close', async () => {
  const app = buildApp({
    logger: false,
    config: parseConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:' }),
  });
  const logs = vi.spyOn(app.log, 'info');
  registerRuntimeMonitoring(app, 25);
  try {
    await app.inject('/health?token=do-not-log');
    await vi.waitFor(
      () =>
        expect(
          logs.mock.calls.some(
            (call) =>
              typeof call[0] === 'object' &&
              call[0] !== null &&
              'event' in call[0] &&
              call[0].event === 'runtime_health',
          ),
        ).toBe(true),
      { timeout: 1000 },
    );
    const sample = logs.mock.calls.find(
      (call) =>
        typeof call[0] === 'object' && call[0] !== null && 'event' in call[0],
    );
    expect(sample?.[0]).toMatchObject({ event: 'runtime_health' });
    expect(JSON.stringify(sample)).not.toMatch(
      /token|do-not-log|cookie|actorId|roomId/,
    );
    await app.close();
    const count = logs.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(logs.mock.calls).toHaveLength(count);
  } finally {
    await app.close();
    logs.mockRestore();
  }
});
it('keeps API errors uncacheable, sets HTTPS-only HSTS and rejects credential-bearing endpoints', async () => {
  for (const value of [
    'https://user:password@storage.example',
    'http://user:password@localhost',
    'ftp://localhost',
  ])
    expect(() => parseConfig({ AVATAR_ENDPOINT: value })).toThrow();
  expect(() =>
    parseConfig({
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_CALLBACK_URL:
        'https://user:password@omi.example/api/auth/google/callback',
    }),
  ).toThrow();
  const app = buildApp({
    logger: false,
    config: parseConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://omi.example',
      DATABASE_PATH: ':memory:',
    }),
  });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { origin: 'https://evil.invalid' },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBe('max-age=86400');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
  } finally {
    await app.close();
  }
});
it('shuts down a live upgraded connection without waiting for its close handshake', async () => {
  const { WebSocket } = await import('ws');
  const app = buildApp({
    logger: false,
    config: parseConfig({
      NODE_ENV: 'test',
      ALLOW_GUESTS: 'true',
      DATABASE_PATH: ':memory:',
    }),
  });
  const base = await app.listen({ host: '127.0.0.1', port: 0 });
  let socket: InstanceType<typeof WebSocket> | undefined;
  try {
    const origin = 'http://127.0.0.1:5173';
    const guest = await app.inject({
      method: 'POST',
      url: '/transport/session',
      headers: { origin },
      payload: { displayName: 'Shutdown check' },
    });
    const cookie = `${guest.cookies[0]!.name}=${guest.cookies[0]!.value}`;
    const room = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { origin, cookie },
      payload: {
        actorId: guest.json().actorId,
        actionId: crypto.randomUUID(),
        expectedVersion: 0,
      },
    });
    socket = new WebSocket(
      `${base.replace(/^http/, 'ws')}/rooms/${room.json().roomId}/ws`,
      { headers: { origin, cookie } },
    );
    await new Promise<void>((resolve, reject) => {
      socket!.once('message', () => resolve());
      socket!.once('error', reject);
    });
    socket.pause();
    const started = performance.now();
    await app.close();
    expect(performance.now() - started).toBeLessThan(2000);
  } finally {
    socket?.resume();
    socket?.terminate();
    await app.close();
  }
}, 5000);

it('rejects outdated or unsupported production runtimes against the reviewed security baseline', () => {
  for (const version of [
    '22.13.1',
    '22.23.3',
    '20.23.4',
    '24.0.0',
    '22.23.4-rc.1',
    'invalid',
  ])
    expect(supportedNode22(version)).toBe(false);
  for (const version of ['22.23.4', '22.23.5', '22.24.0'])
    expect(supportedNode22(version)).toBe(true);
});

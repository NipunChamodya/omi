import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { WebSocket } from 'ws';
const dist = fileURLToPath(new URL('../../apps/server/dist/', import.meta.url));
test('compiled migration, backup, restore, readiness and production shutdown work without touching live data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-ops-cli-'));
  const source = join(dir, 'source.sqlite'),
    backup = join(dir, 'backup.sqlite'),
    restored = join(dir, 'restored.sqlite');
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://omi.example',
    DATABASE_PATH: source,
    HOST: '127.0.0.1',
    TRUST_LOCAL_PROXY: 'true',
  };
  const run = (file, args = [], extra = {}) => {
    const result = spawnSync(process.execPath, [join(dist, file), ...args], {
      cwd: dir,
      env: { ...env, ...extra },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `Compiled operation failed: ${file}`);
    return result.stdout;
  };
  let writer, child;
  try {
    run('persistence/migrate.js');
    run('persistence/migrate.js');
    writer = new Database(source);
    writer.pragma('journal_mode = WAL');
    const id = randomUUID();
    writer
      .prepare(
        'INSERT INTO users (id,google_sub,display_name,created_at,updated_at) VALUES (?,?,?,?,?)',
      )
      .run(id, 'restore-fixture', 'Restored player', Date.now(), Date.now());
    writer
      .prepare(
        'INSERT INTO sessions (token_hash,user_id,csrf_token,created_at,expires_at) VALUES (?,?,?,?,?)',
      )
      .run('c'.repeat(64), id, 'd'.repeat(43), Date.now(), Date.now() + 60_000);
    assert.deepEqual(JSON.parse(run('ops/backup-cli.js', ['create', backup])), {
      operation: 'create',
      integrity: 'ok',
      migrations: 2,
    });
    assert.equal(statSync(backup).mode & 0o777, 0o600);
    run('ops/backup-cli.js', ['verify', backup]);
    assert.equal(
      JSON.parse(run('ops/backup-cli.js', ['restore-copy', backup, restored]))
        .sessionsInvalidated,
      true,
    );
    const check = new Database(restored, { readonly: true });
    assert.equal(check.prepare('SELECT count(*) AS n FROM users').get().n, 1);
    assert.equal(
      check.prepare('SELECT count(*) AS n FROM sessions').get().n,
      0,
    );
    check.close();
    assert.equal(
      writer.prepare('SELECT count(*) AS n FROM sessions').get().n,
      1,
    );
    const readiness = JSON.parse(
      run('ops/preflight-cli.js', [], {
        GOOGLE_CLIENT_ID: 'fixture-client',
        GOOGLE_CLIENT_SECRET: 'fixture-secret',
        GOOGLE_CALLBACK_URL: 'https://omi.example/api/auth/google/callback',
        AVATAR_BUCKET: 'fixture-bucket',
        VOICE_TURN_URLS: 'turns:turn.example:5349?transport=tcp',
        VOICE_TURN_SECRET: 'fixture-shared-turn-secret-at-least-32-chars',
      }),
    );
    assert.equal(readiness.configurationPassed, true);
    assert.equal(readiness.publicVerification, 'not-performed');
    const probe = createServer();
    await new Promise((done) => probe.listen(0, '127.0.0.1', done));
    const port = probe.address().port;
    await new Promise((done) => probe.close(done));
    child = spawn(process.execPath, [join(dist, 'index.js')], {
      cwd: dir,
      env: { ...env, PORT: String(port), DATABASE_PATH: restored },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', (data) => (logs = (logs + data).slice(-32768)));
    child.stderr.on('data', (data) => (logs = (logs + data).slice(-32768)));
    for (
      let attempt = 0;
      attempt < 100 && !logs.includes('Server listening');
      attempt++
    )
      await new Promise((done) => setTimeout(done, 50));
    assert.ok(
      logs.includes('Server listening'),
      'Compiled server failed to start',
    );
    const marker = 'SYNTHETIC_QUERY_MUST_NOT_BE_LOGGED';
    const response = await fetch(
      `http://127.0.0.1:${port}/health?code=${marker}`,
    );
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('strict-transport-security'),
      'max-age=86400',
    );
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/health?token=${marker}`,
    );
    await new Promise((done) => {
      socket.once('close', done);
      socket.once('error', done);
    });
    socket.terminate();
    assert.ok(
      !logs.includes(marker),
      'Query credential reached structured logs',
    );
    const exited = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Owned child shutdown timed out'));
      }, 8000);
      child.once('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    child.kill('SIGTERM');
    assert.equal(await exited, 0);
    assert.ok(logs.includes('shutdown_started'));
  } finally {
    if (child && child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
    writer?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

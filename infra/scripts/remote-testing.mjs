import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  cpSync,
  readdirSync,
  lstatSync,
  chmodSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';
import { root, renderConfig, quickUrl, origin, port } from './config.mjs';

process.umask(0o077);
const base = join(root, '.remote-testing');
const statePath = join(base, 'current.json');
const command = process.argv[2];
const children = [];
let state;
let closing = false;
let tunnelProcess;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `${executable} command failed; inspect local configuration (credentials are not printed)`,
    );
  return result.stdout?.trim();
}
function stamp(pid) {
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'lstart='], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}
function owner(record) {
  return record && stamp(record.pid) === record.stamp;
}
function readState() {
  if (!existsSync(statePath))
    throw new Error('No remote-testing supervisor is recorded');
  return JSON.parse(readFileSync(statePath, 'utf8'));
}
function save() {
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
}
function launch(executable, args, options = {}) {
  const child = spawn(executable, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  children.push(child);
  child.stdout?.resume();
  child.stderr?.resume();
  child.on('error', () => {
    void shutdown(1);
  });
  child.once('exit', () => {
    if (!closing) {
      console.error(
        'A managed service stopped; shutting down this deployment.',
      );
      void shutdown(1);
    }
  });
  return child;
}
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  // Close the public connector first. Only child handles owned by this supervisor are signaled.
  const shutdownOrder = [
    tunnelProcess,
    ...[...children].reverse().filter((child) => child !== tunnelProcess),
  ].filter(Boolean);
  for (const child of shutdownOrder) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    child.kill('SIGTERM');
    for (
      let i = 0;
      i < 50 && child.exitCode === null && child.signalCode === null;
      i++
    )
      await pause(100);
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
  }
  if (
    state &&
    existsSync(statePath) &&
    JSON.parse(readFileSync(statePath, 'utf8')).pid === process.pid
  )
    unlinkSync(statePath);
  process.exitCode = code;
}
async function http(url, options = {}) {
  return fetch(url, {
    redirect: 'manual',
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
}
async function waitHttp(url, options = {}) {
  for (let i = 0; i < 40; i++) {
    if (closing) throw new Error('Deployment stopped');
    try {
      const response = await http(url, options);
      if (response.ok) return response;
    } catch {
      /* bounded startup wait */
    }
    await pause(250);
  }
  throw new Error('Local health check failed');
}
async function freePort(number) {
  await new Promise((done, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Loopback port ${number} is occupied; no existing process was stopped`,
        ),
      ),
    );
    server.listen(number, '127.0.0.1', () => server.close(done));
  });
}
function staticCopy(directory) {
  const source = join(root, 'apps/web/dist');
  for (const entry of readdirSync(source, { recursive: true })) {
    const file = join(source, String(entry));
    if (
      lstatSync(file).isSymbolicLink() ||
      /(?:^|\/)\.|\.(?:map|env|sqlite|ts|tsx)$/.test(String(entry))
    )
      throw new Error('Unexpected private file or symlink in frontend build');
  }
  cpSync(source, directory, { recursive: true });
}
async function check(record) {
  if (!owner(record))
    throw new Error('Recorded supervisor is no longer running');
  if (record.phase !== 'active') {
    const response = await http(`${record.publicOrigin}/_omi/health`);
    if (
      !response.ok ||
      (await response.json()).status !== 'awaiting-oauth-registration'
    )
      throw new Error('Public maintenance gate is unreachable');
    const blocked = await http(`${record.publicOrigin}/api/auth/session`, {
      method: 'POST',
    });
    if (blocked.status !== 503)
      throw new Error('Maintenance gate is not closed');
    console.log(
      `Tunnel transport verified; application remains CLOSED.\nPublic URL: ${record.publicOrigin}\nGoogle callback: ${record.publicOrigin}/api/auth/google/callback\nRegister/validate that exact callback in Google, then explicitly activate. This is not multiplayer readiness.`,
    );
    return;
  }
  const page = await http(record.publicOrigin + '/');
  if (
    !page.ok ||
    !(page.headers.get('content-type') ?? '').includes('text/html')
  )
    throw new Error('Public compiled frontend failed');
  const html = await page.text();
  if (/@vite|src\/main\.tsx|__OMI_CSP_NONCE__/.test(html))
    throw new Error('Development frontend must never be exposed');
  const entry = html.match(/src="([^"]+\.js)"/)?.[1];
  if (!entry) throw new Error('Compiled frontend entry was not found');
  const assetUrl = new URL(entry, record.publicOrigin);
  if (assetUrl.origin !== record.publicOrigin || !(await http(assetUrl)).ok)
    throw new Error('Compiled frontend JavaScript failed');
  const response = await http(`${record.publicOrigin}/api/auth/session`, {
    method: 'POST',
    headers: {
      Origin: record.publicOrigin,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) throw new Error('Public account bootstrap failed');
  const session = await response.json();
  if (!session.googleAvailable || session.guestAllowed)
    throw new Error('Public authentication prerequisites failed');
  for (const path of [
    '/.env',
    '/.git/config',
    '/src/main.tsx',
    '/@vite/client',
    '/api/test-provider',
    '/apps/server/.env',
  ]) {
    if ((await http(record.publicOrigin + path)).status !== 404)
      throw new Error(`Blocked-path check failed: ${path}`);
  }
  const denied = await http(`${record.publicOrigin}/api/rooms`, {
    method: 'POST',
    headers: {
      Origin: record.publicOrigin,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (denied.status !== 401)
    throw new Error('Unauthenticated rooms must be denied');
  const foreign = await http(`${record.publicOrigin}/api/auth/session`, {
    method: 'POST',
    headers: {
      Origin: 'https://foreign.invalid',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (foreign.status !== 403) throw new Error('Foreign Origin must be denied');
  console.log(
    `HTTPS/static/API security checks passed: ${record.publicOrigin}\nGoogle login, logout, reload and four external players still require interactive verification; this command cannot certify those.`,
  );
}
async function start() {
  if (
    !/^22\./.test(process.versions.node) ||
    Number(process.versions.node.split('.')[1]) < 13
  )
    throw new Error('Use Node.js 22');
  if (run('git', ['branch', '--show-current']) !== 'dev')
    throw new Error('Remote testing is restricted to branch dev');
  if (existsSync(statePath))
    throw new Error(
      'A deployment record exists; run stop-remote-testing.sh first',
    );
  const prefix = run('brew', ['--prefix']);
  const nginx = run('which', ['nginx']);
  const cloudflared = run('which', ['cloudflared']);
  const serverDirectory = join(root, 'apps/server');
  const envPath = join(serverDirectory, '.env');
  const source = {
    ...(existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {}),
    ...process.env,
  };
  if (
    !source.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com') ||
    !source.GOOGLE_CLIENT_SECRET ||
    !source.GOOGLE_CALLBACK_URL
  )
    throw new Error(
      'Configure all Google settings privately in apps/server/.env before starting; public application access is blocked',
    );
  if (source.ALLOW_GUESTS === 'true')
    throw new Error('Disable ALLOW_GUESTS before remote testing');
  if (source.HOST && source.HOST !== '127.0.0.1')
    throw new Error('The backend HOST must be 127.0.0.1');
  for (const file of ['config.yml', 'config.yaml'])
    if (existsSync(join(homedir(), '.cloudflared', file)))
      throw new Error(
        'Existing cloudflared default configuration may interfere; inspect it manually. Nothing was changed',
      );
  for (const key of Object.keys(source))
    if (key.startsWith('TUNNEL_'))
      throw new Error(
        'Unset inherited TUNNEL_* overrides before running this isolated Quick Tunnel',
      );
  const proxyPort = port(source.OMI_NGINX_PORT ?? 8080);
  const backendPort = port(source.PORT ?? 3000);
  if (proxyPort === backendPort)
    throw new Error('NGINX and backend need separate ports');
  await freePort(proxyPort);
  await freePort(backendPort);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  chmodSync(base, 0o700);
  const runtime = join(base, `run-${Date.now()}`);
  mkdirSync(runtime, { mode: 0o700 });
  for (const directory of ['body', 'proxy'])
    mkdirSync(join(runtime, directory));
  state = {
    pid: process.pid,
    stamp: stamp(process.pid),
    runtime,
    proxyPort,
    backendPort,
    phase: 'preparing',
  };
  writeFileSync(statePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void shutdown();
    });
  const configPath = join(runtime, 'nginx.conf');
  const mimeTypes = join(prefix, 'etc/nginx/mime.types');
  const settings = {
    runtime,
    staticRoot: join(runtime, 'public'),
    mimeTypes,
    proxyPort,
    backendPort,
    locked: true,
  };
  writeFileSync(configPath, renderConfig(settings));
  run(nginx, ['-t', '-p', runtime + '/', '-c', configPath], {
    stdio: 'inherit',
  });
  launch(nginx, ['-p', runtime + '/', '-c', configPath]);
  await waitHttp(`http://127.0.0.1:${proxyPort}/_omi/health`);
  const connector = launch(cloudflared, [
    'tunnel',
    '--no-autoupdate',
    '--url',
    `http://127.0.0.1:${proxyPort}`,
  ]);
  tunnelProcess = connector;
  let captured;
  let connectorOutput = '';
  const capture = (bytes) => {
    connectorOutput = (connectorOutput + bytes.toString()).slice(-8192);
    captured ??= quickUrl(connectorOutput);
  };
  connector.stdout.on('data', capture);
  connector.stderr.on('data', capture);
  for (let i = 0; i < 180 && !captured && !closing; i++) await pause(500);
  if (!captured)
    throw new Error(
      'Cloudflare did not issue a Quick Tunnel hostname within 90 seconds',
    );
  state.publicOrigin = captured;
  state.phase = 'awaiting-google-registration';
  save();
  console.log(
    `Captured actual Cloudflare URL: ${captured}\nThe tunnel serves only a maintenance gate, not the application.`,
  );
  const databasePath = resolve(
    serverDirectory,
    source.DATABASE_PATH ?? './data/omi.sqlite',
  );
  if (
    databasePath.startsWith(join(root, 'apps/web/dist')) ||
    databasePath.startsWith(join(runtime, 'public'))
  )
    throw new Error('Database must be outside public static files');
  const serverEnv = {
    ...source,
    HOST: '127.0.0.1',
    PORT: String(backendPort),
    NODE_ENV: 'production',
    ALLOW_GUESTS: 'false',
    TRUST_LOCAL_PROXY: 'true',
    DATABASE_PATH: databasePath,
    APP_ORIGIN: captured,
    GOOGLE_CALLBACK_URL: `${captured}/api/auth/google/callback`,
  };
  const buildEnv = { ...process.env, VITE_API_URL: `${captured}/api` };
  console.log('Building production assets; application access remains closed.');
  run('npm', ['run', 'build'], { env: buildEnv, stdio: 'inherit' });
  staticCopy(settings.staticRoot);
  run('npm', ['run', 'db:migrate', '-w', '@omi/server'], {
    env: serverEnv,
    stdio: 'inherit',
  });
  const backend = launch(process.execPath, ['dist/index.js'], {
    cwd: serverDirectory,
    env: serverEnv,
  });
  // Keep query-stripped structured logs private; never print raw provider errors.
  backend.stdout.resume();
  backend.stderr.resume();
  await waitHttp(`http://127.0.0.1:${backendPort}/health`);
  state.phase = 'awaiting-google-registration';
  save();
  await check(state);
  console.log(
    'After Google accepts the exact callback, run in a SECOND terminal:\n  infra/scripts/start-remote-testing.sh --activate-google-registered\nThis assertion must come from real Google Console configuration, not a guessed hostname. Keep this terminal open; Ctrl-C closes all managed services.',
  );
  while (!closing) {
    if (existsSync(join(runtime, 'activate')) && state.phase !== 'active') {
      settings.locked = false;
      settings.publicOrigin = captured;
      writeFileSync(configPath, renderConfig(settings));
      run(nginx, ['-t', '-p', runtime + '/', '-c', configPath], {
        stdio: 'inherit',
      });
      // Signal only this supervisor's NGINX child, never a global service.
      children[0].kill('SIGHUP');
      state.phase = 'active';
      save();
      await pause(500);
      await check(state);
      console.log(
        'Application access enabled with Google authentication enforced. Complete real login before inviting friends; successful account bootstrap alone is not successful login.',
      );
    }
    await pause(500);
  }
}
try {
  if (command === 'start') await start();
  else if (command === 'activate') {
    const record = readState();
    if (!owner(record) || record.phase !== 'awaiting-google-registration')
      throw new Error('No prepared deployment is awaiting Google registration');
    origin(record.publicOrigin);
    writeFileSync(
      join(record.runtime, 'activate'),
      'Owner confirmed Google callback registration\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(
      'Activation requested. Watch the supervisor terminal for validation; login is not yet verified.',
    );
  } else if (command === 'check') await check(readState());
  else if (command === 'stop') {
    const record = readState();
    if (owner(record)) {
      process.kill(record.pid, 'SIGTERM');
      for (let i = 0; i < 200 && owner(record); i++) await pause(100);
      if (owner(record))
        throw new Error(
          'Supervisor has not exited; inspect its terminal. No unrelated process was signaled',
        );
      console.log(
        'Recorded supervisor and managed services stopped; application data retained.',
      );
    } else {
      unlinkSync(statePath);
      console.log(
        'Removed stale process record; no process was signaled and no data deleted.',
      );
    }
  } else throw new Error('Expected start, activate, check or stop');
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Remote testing failed',
  );
  await shutdown(1);
}

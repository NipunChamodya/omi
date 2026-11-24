// Loopback-only browser fixture. Never imported by public startup scripts.
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  watchFile,
  unwatchFile,
} from 'node:fs';
import { join } from 'node:path';
import { root, renderConfig } from '../scripts/config.mjs';
const prefix = spawnSync('brew', ['--prefix'], {
  encoding: 'utf8',
}).stdout.trim();
mkdirSync(join(root, '.remote-testing'), { recursive: true, mode: 0o700 });
const runtime = mkdtempSync(join(root, '.remote-testing/browser-'));
for (const dir of ['body', 'proxy']) mkdirSync(join(runtime, dir));
const config = join(runtime, 'nginx.conf');
writeFileSync(
  config,
  renderConfig({
    runtime,
    staticRoot: join(root, 'apps/web/dist'),
    mimeTypes: join(prefix, 'etc/nginx/mime.types'),
    proxyPort: 8082,
    backendPort: 3100,
    publicOrigin: 'http://127.0.0.1:8082',
    local: true,
  }),
);
if (
  spawnSync('nginx', ['-t', '-p', runtime + '/', '-c', config], {
    stdio: 'inherit',
  }).status !== 0
)
  process.exit(1);
const restartDir = process.env.OMI_TEST_RESTART_DIR;
let restarting = false;
let stopping = false;
let restartTimer;
const restartMarker = restartDir && join(restartDir, 'restart');
function startBackend() {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'apps/server/test-fixtures/e2e.ts'],
    {
      cwd: root,
      env: {
        ...process.env,
        OMI_TEST_ORIGIN: 'http://127.0.0.1:8082',
        ...(restartDir && {
          OMI_TEST_DATABASE: join(restartDir, 'fixture.db'),
        }),
      },
      stdio: 'inherit',
    },
  );
  child.once('exit', (code) => {
    if (stopping) return;
    if (restarting) {
      restarting = false;
      restartTimer = setTimeout(() => {
        backend = startBackend();
      }, 900);
      return;
    }
    process.exitCode = code || 1;
    stop();
  });
  return child;
}
let backend = startBackend();
const nginx = spawn('nginx', ['-p', runtime + '/', '-c', config], {
  stdio: 'inherit',
});
function stop() {
  if (stopping) return;
  stopping = true;
  if (restartMarker) unwatchFile(restartMarker);
  clearTimeout(restartTimer);
  nginx.kill('SIGTERM');
  backend.kill('SIGTERM');
}
if (restartMarker) {
  watchFile(restartMarker, { interval: 100 }, (current, previous) => {
    if (
      !current.ino ||
      current.mtimeMs === previous.mtimeMs ||
      restarting ||
      restartTimer ||
      stopping
    )
      return;
    restarting = true;
    backend.kill('SIGKILL');
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
nginx.once('exit', (code) => {
  if (stopping) return;
  process.exitCode = code || 1;
  stop();
});

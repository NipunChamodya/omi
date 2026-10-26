// Loopback-only browser fixture. Never imported by public startup scripts.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
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
const backend = spawn(
  process.execPath,
  ['--import', 'tsx', 'apps/server/test-fixtures/e2e.ts'],
  {
    cwd: root,
    env: { ...process.env, OMI_TEST_ORIGIN: 'http://127.0.0.1:8082' },
    stdio: 'inherit',
  },
);
const nginx = spawn('nginx', ['-p', runtime + '/', '-c', config], {
  stdio: 'inherit',
});
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  nginx.kill('SIGTERM');
  backend.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of [nginx, backend])
  child.once('exit', (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });

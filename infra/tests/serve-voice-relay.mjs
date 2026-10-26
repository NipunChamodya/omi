// Real TURN, strictly loopback-only, for browser verification. Not a deployment config.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../scripts/config.mjs';
process.umask(0o077);
mkdirSync(join(root, '.remote-testing'), { recursive: true, mode: 0o700 });
const runtime = mkdtempSync(join(root, '.remote-testing/turn-'));
const secret = randomBytes(32).toString('hex');
const config = join(runtime, 'turn.conf');
writeFileSync(
  config,
  [
    'listening-ip=127.0.0.1',
    'relay-ip=127.0.0.1',
    'listening-port=3479',
    'min-port=51000',
    'max-port=51031',
    'realm=omi-loopback-test',
    'fingerprint',
    'use-auth-secret',
    `static-auth-secret=${secret}`,
    'no-tls',
    'no-dtls',
    'no-cli',
    'no-multicast-peers',
    'allow-loopback-peers',
    'denied-peer-ip=0.0.0.0-255.255.255.255',
    'allowed-peer-ip=127.0.0.1',
    'user-quota=12',
    'total-quota=64',
    'max-allocate-lifetime=600',
    `pidfile=${runtime}/turn.pid`,
    `log-file=${runtime}/turn.log`,
    'simple-log',
    'no-stdout-log',
  ].join('\n') + '\n',
  { mode: 0o600 },
);
const turn = spawn('turnserver', ['-c', config], { stdio: 'ignore' });
let stopping = false;
const stop = () => {
  stopping = true;
  turn.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
turn.on('error', () => {
  process.exitCode = 1;
  process.emit('SIGTERM');
});
turn.once('exit', () => {
  if (!stopping) {
    process.exitCode = 1;
    process.emit('SIGTERM');
  }
});
process.env.OMI_TEST_TURN_URLS = 'turn:127.0.0.1:3479?transport=udp';
process.env.OMI_TEST_TURN_SECRET = secret;
process.env.OMI_TEST_ICE_POLICY = 'relay';
await import('./serve-nginx.mjs');

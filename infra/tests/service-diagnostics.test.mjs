import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireDeploymentNode,
  serviceDiagnostic,
  watchService,
} from '../scripts/service-diagnostics.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('deployment rejects the exact failed runtime before provisioning and accepts patched Node 22', () => {
  for (const version of [
    '22.13.1',
    '22.23.3',
    '23.0.0',
    '24.0.0',
    '22.23.4-rc.1',
  ])
    assert.throws(
      () => requireDeploymentNode(version),
      /no services were started/,
    );
  for (const version of ['22.23.4', '22.23.5', '22.24.0'])
    assert.doesNotThrow(() => requireDeploymentNode(version));
});
test('diagnostics classify split output without retaining credentials or arbitrary provider data', () => {
  const diagnostic = serviceDiagnostic();
  diagnostic.append(
    Buffer.from('secret=FAKE_PRIVATE_VALUE\nProduction requires No'),
  );
  diagnostic.append(Buffer.from('de 22.23.4\nBearer FAKE_TOKEN\nEADDRINUSE'));
  diagnostic.append(Buffer.alloc(100_000, 65));
  assert.match(diagnostic.summary(), /Node runtime/);
  assert.match(diagnostic.summary(), /port is occupied/);
  assert.doesNotMatch(diagnostic.summary(), /FAKE|Bearer|secret=|AAAA/);
  const unknown = serviceDiagnostic();
  unknown.append(Buffer.from('opaque OAuth response FAKE_SECRET'));
  assert.doesNotMatch(unknown.summary(), /FAKE_SECRET/);
});
test('explicit wrapper runtime is honored without provisioning services', () => {
  // Echo stands in for an explicit executable: verify the wrapper really execs
  // it with the supervisor and requested action, without starting a deployment.
  const result = spawnSync('sh', ['infra/scripts/start-remote-testing.sh'], {
    env: { ...process.env, OMI_NODE_BINARY: '/bin/echo' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /remote-testing\.mjs start/);
});

test('service observer captures final output, exit status and no raw credentials', async () => {
  const child = spawn(
    process.execPath,
    [
      '-e',
      "process.stdout.write('EADDRINUSE FAKE_TOKEN'); process.stderr.write('FAKE_OAUTH_RESPONSE'); process.exitCode=7",
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const status = await new Promise((done) => watchService(child, done));
  assert.equal(status.code, 7);
  assert.equal(status.signal, null);
  assert.match(status.summary, /port is occupied/);
  assert.doesNotMatch(JSON.stringify(status), /FAKE/);
});
test('service observer reports spawn errors exactly once', async () => {
  const child = spawn('/omi-fixture-missing-executable', [], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let notifications = 0;
  const status = await new Promise((done) =>
    watchService(child, (value) => {
      notifications++;
      done(value);
    }),
  );
  await new Promise((done) => child.once('close', done));
  assert.equal(status.spawnCode, 'ENOENT');
  assert.equal(notifications, 1);
});
test('service observer reports termination signal', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = new Promise((done) => watchService(child, done));
  child.once('spawn', () => child.kill('SIGTERM'));
  const status = await result;
  assert.equal(status.signal, 'SIGTERM');
  assert.equal(status.code, null);
});

test('wrapper prefers a supported standard PATH runtime over the private fallback', () => {
  requireDeploymentNode(process.versions.node);
  const directory = mkdtempSync(join(tmpdir(), 'omi-node-selection-'));
  // The probe runs the real supported runtime; the final exec reports selection
  // instead of provisioning a tunnel. Retain the tiny fixture for inspection.
  writeFileSync(
    join(directory, 'node'),
    `#!/bin/sh
if [ "$1" = "--input-type=module" ]; then
  exec "$OMI_TEST_NODE" "$@"
fi
printf '%s\\n' STANDARD_PATH_RUNTIME_SELECTED
`,
    { mode: 0o700 },
  );
  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    OMI_TEST_NODE: process.execPath,
    // If selection regresses, the real supervisor must reject the fixture
    // before starting services, rather than accidentally provisioning a tunnel.
    TUNNEL_OMI_TEST_GUARD: 'reject-real-supervisor-in-selection-test',
  };
  delete env.OMI_NODE_BINARY;
  const result = spawnSync('sh', ['infra/scripts/start-remote-testing.sh'], {
    env,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'STANDARD_PATH_RUNTIME_SELECTED');
});
test('wrapper never silently substitutes the fallback for an invalid explicit runtime', () => {
  const result = spawnSync('sh', ['infra/scripts/start-remote-testing.sh'], {
    env: { ...process.env, OMI_NODE_BINARY: '/omi-fixture-missing-node' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /OMI_NODE_BINARY is not an executable file/);
  assert.doesNotMatch(result.stdout, /Captured actual Cloudflare URL/);
});

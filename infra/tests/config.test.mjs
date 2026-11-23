import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderConfig, quickUrl, origin, port } from '../scripts/config.mjs';
const settings = {
  runtime: '/tmp/omi-run',
  staticRoot: '/tmp/omi-public',
  mimeTypes: '/tmp/mime.types',
  proxyPort: 8080,
  backendPort: 3000,
  publicOrigin: 'https://accepted-host.trycloudflare.com',
};
test('renders one loopback entry with controlled forwarding and actual API/socket paths', () => {
  const config = renderConfig(settings);
  assert.match(config, /listen 127\.0\.0\.1:8080/);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
  assert.match(config, /proxy_set_header X-Forwarded-For \$remote_addr/);
  assert.doesNotMatch(
    config,
    /proxy_add_x_forwarded_for|0\.0\.0\.0|@vite|unsafe-inline/,
  );
  assert.match(config, /snapshot\|ws/);
  assert.match(config, /client_max_body_size 5m/);
  assert.match(config, /map "https" \$omi_hsts/);
  assert.match(config, /https "max-age=86400"/);
  assert.match(config, /microphone=\(self\)/);
});
test('closed gate serves no application or API', () => {
  const config = renderConfig({ ...settings, locked: true });
  assert.match(config, /return 503/);
  assert.doesNotMatch(config, /proxy_pass|root /);
});
test('rejects config injection, unsafe origins and privileged ports', () => {
  assert.throws(() =>
    renderConfig({ ...settings, runtime: '/tmp/evil";include /etc/passwd;' }),
  );
  for (const value of [
    'http://remote.example',
    'https://user:password@remote.example',
    'https://remote.example/path',
  ])
    assert.throws(() => origin(value));
  for (const value of [80, 0, 'abc', 65536]) assert.throws(() => port(value));
});
test('extracts only an actual Quick Tunnel URL from connector output', () => {
  assert.equal(
    quickUrl('Visit https://actual-issued-name.trycloudflare.com |'),
    'https://actual-issued-name.trycloudflare.com',
  );
  assert.equal(quickUrl('https://malicious.example.com'), undefined);
});

test('Azure direct TLS reuses the API allowlist and ignores visitor forwarding headers', () => {
  const directTls = {
    certificate: '/etc/omi/fullchain.pem',
    key: '/etc/omi/key.pem',
  };
  const output = renderConfig({
    ...settings,
    publicOrigin: 'https://play.example.com',
    directTls,
  });
  assert.match(output, /listen 443 ssl;/);
  assert.match(output, /ssl_reject_handshake on;/);
  assert.match(output, /ssl_certificate_key "\/etc\/omi\/key.pem"/);
  assert.match(output, /proxy_set_header X-Forwarded-For \$remote_addr/);
  assert.match(output, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
  assert.doesNotMatch(output, /real_ip_header|127\.0\.0\.1:8080|@[A-Z_]+@/);
  assert.throws(() =>
    renderConfig({ ...settings, directTls: { ...directTls, key: '/bad;key' } }),
  );
  assert.throws(() =>
    renderConfig({
      ...settings,
      publicOrigin: 'https://play.example.com:444',
      directTls,
    }),
  );
});

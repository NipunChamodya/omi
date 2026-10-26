import { expect, test } from '@playwright/test';
test('NGINX serves compiled assets, denies private files and preserves Origin checks', async ({
  request,
  page,
}) => {
  for (const path of [
    '/.env',
    '/.git/config',
    '/src/main.tsx',
    '/@vite/client',
    '/test-fixtures/e2e.ts',
    '/infra/nginx/omi-testing.conf',
    '/omi.sqlite',
    '/assets/missing.js.map',
    '/api/debug',
    '/api/test-provider',
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  const worker = await request.get('/sw.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['cache-control']).toBe('no-cache');
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.headers()['content-type']).toContain(
    'application/manifest+json',
  );
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toBe(
    "frame-ancestors 'none'",
  );
  const html = await response.text();
  expect(html).not.toMatch(/@vite|src\/main\.tsx|__OMI_CSP_NONCE__/);
  const script = html.match(/src="([^"]+\.js)"/)![1]!;
  const asset = await request.get(script);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');
  expect((await request.get('/nested/frontend/route')).status()).toBe(200);
  expect(
    (
      await request.post('/api/auth/session', {
        headers: { Origin: 'https://foreign.invalid' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Four friends/ }),
  ).toBeVisible();
  expect(
    await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content'),
  ).not.toMatch(/unsafe-|nonce-|ws:\/\/localhost/);
});

test('NGINX overwrites visitor forwarding chains and preserves per-client API limits', async ({
  request,
}, testInfo) => {
  const ip =
    testInfo.project.name === 'firefox' ? '198.51.100.92' : '198.51.100.91';
  let lastStatus = 0;
  for (let i = 0; i < 121; i++) {
    const response = await request.post('/api/auth/session', {
      headers: {
        Origin: String(testInfo.project.use.baseURL),
        // This loopback test emulates the trusted connector's edge header.
        'CF-Connecting-IP': ip,
        // A visitor must not evade limits by changing this header.
        'X-Forwarded-For': `203.0.113.${i + 1}`,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'foreign.invalid',
      },
      data: {},
    });
    lastStatus = response.status();
  }
  expect(lastStatus).toBe(429);
});

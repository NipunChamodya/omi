import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
});
test('static cache excludes identities and supplies a styled offline fallback', async ({
  page,
}) => {
  // Stop our isolated origin to test actual network failure in both browsers.
  // Firefox's Playwright offline emulation does not reliably reach SW fetches.
  const root = resolve('apps/web/dist');
  let updateWorker = false;
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      response.writeHead(503);
      response.end('{}');
      return;
    }
    let file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + '/')) file = resolve(root, 'index.html');
    const types: Record<string, string> = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
    };
    try {
      const data = await readFile(file);
      response.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(
        pathname === '/sw.js' && updateWorker
          ? Buffer.concat([
              data,
              Buffer.from('\n// lifecycle update fixture\n'),
            ])
          : data,
      );
    } catch {
      if (pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(await readFile(resolve(root, 'index.html')));
      } else {
        response.writeHead(404);
        response.end();
      }
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No fixture port');
  const origin = `http://127.0.0.1:${address.port}`;
  const close = () =>
    new Promise<void>((done, reject) => {
      server.close((error) => (error ? reject(error) : done()));
      server.closeAllConnections();
    });
  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await expect(
      page.getByRole('heading', { name: /Four friends/ }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await fetch('/api/auth/session');
      await fetch('/api/avatars/does-not-exist');
      await fetch('/assets/not-in-build.js');
    });
    const paths = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (
        await Promise.all(
          keys
            .filter((key) => key.startsWith('omi-static-'))
            .map(async (key) =>
              (await (await caches.open(key)).keys()).map(
                (request) => new URL(request.url).pathname,
              ),
            ),
        )
      ).flat();
    });
    expect(paths).toContain('/offline.html');
    expect(paths).toContain('/offline.css');
    expect(paths.some((path) => path.endsWith('.js'))).toBe(true);
    expect(
      paths.every(
        (path) =>
          /^\/assets\/[^/]+\.(js|css)$/.test(path) ||
          ['/offline.html', '/offline.css'].includes(path),
      ),
    ).toBe(true);
    expect(paths).not.toContain('/assets/not-in-build.js');
    updateWorker = true;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await navigator.serviceWorker.ready).waiting?.state,
        ),
      )
      .toBe('installed');
    await expect(page.getByText(/An OMI update is ready/)).toBeVisible();
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller?.state),
    ).toBe('activated');
    await expect(
      page.getByRole('heading', { name: /Four friends/ }),
    ).toBeVisible();
    await close();
    await page.goto(origin);
    await expect(
      page.getByRole('heading', { name: 'You’re offline' }),
    ).toBeVisible();
    expect(
      await page
        .locator('body')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe('rgba(0, 0, 0, 0)');
    expect(
      await page
        .locator('html')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe('rgb(7, 59, 48)');
    await new Promise<void>((done) =>
      server.listen(address.port, '127.0.0.1', done),
    );
    await page.getByRole('link', { name: 'Try OMI again' }).click();
    await expect(
      page.getByRole('heading', { name: /Four friends/ }),
    ).toBeVisible();
  } finally {
    if (server.listening) await close();
  }
});
test('manifest, icons and persisted data saver work at narrow mobile widths', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]));
  }
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  const saver = page.getByRole('checkbox', { name: 'Data Saver Mode' });
  await saver.check();
  await expect(page.locator('html')).toHaveClass(/data-saver/);
  await page.reload();
  await expect(saver).toBeChecked();
  await page.getByText('Install & data settings', { exact: true }).click();
  await expect(page.getByText(/On iPhone or iPad/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await saver.uncheck();
  await expect(page.locator('html')).not.toHaveClass(/data-saver/);
  await page.reload();
  await expect(saver).not.toBeChecked();
});

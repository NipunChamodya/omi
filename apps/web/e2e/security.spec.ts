import { expect, test } from '@playwright/test';
test('serves executable Vite modules, enforces CSP and mounts without bootstrap', async ({
  page,
  request,
}) => {
  for (const path of ['/@vite/client', '/src/main.tsx']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
  }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"code":"UNAVAILABLE"}',
    }),
  );
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', () =>
      document.documentElement.setAttribute('data-csp-violation', 'true'),
    );
  });
  const documentResponse = await page.goto('/');
  expect(
    documentResponse?.headers()['content-security-policy'],
  ).toBeUndefined();
  await expect(
    page.getByRole('heading', { name: /Four friends/ }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Sign-in is unavailable');
  await expect(
    page.locator('meta[http-equiv="Content-Security-Policy"]'),
  ).toHaveCount(1);
  expect(
    await page.locator('html').getAttribute('data-csp-violation'),
  ).toBeNull();
  const firstNonce = await page
    .locator('meta[property="csp-nonce"]')
    .evaluate((node) => (node as HTMLElement).nonce);
  expect(firstNonce).not.toContain('__OMI_');
  const secondDocument = await request.get('/');
  expect(await secondDocument.text()).not.toContain(firstNonce);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unexpectedInline = true';
    document.head.append(script);
  });
  expect(await page.evaluate(() => '__unexpectedInline' in window)).toBe(false);
  expect(errors).toEqual([]);
});

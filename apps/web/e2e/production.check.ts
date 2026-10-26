import { expect, test } from '@playwright/test';
test('production mounts with strict CSP and no Vite exceptions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"code":"UNAVAILABLE"}',
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Four friends/ }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Sign-in is unavailable');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self';");
  expect(policy).not.toMatch(/nonce-|unsafe-|localhost|127\.0\.0\.1|\*/);
  expect(await page.locator('script[src="/@vite/client"]').count()).toBe(0);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unexpectedInline = true';
    document.head.append(script);
  });
  expect(await page.evaluate(() => '__unexpectedInline' in window)).toBe(false);
  expect(errors).toEqual([]);
});

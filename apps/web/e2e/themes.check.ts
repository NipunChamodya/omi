import { expect, test } from '@playwright/test';
test('themes load on demand, persist privately, and respect reduced motion and Data Saver', async ({
  page,
  browser,
}, info) => {
  const requests: string[] = [];
  const violations: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    (window as unknown as { __themeViolations: string[] }).__themeViolations =
      [];
    document.addEventListener('securitypolicyviolation', (event) =>
      (
        window as unknown as { __themeViolations: string[] }
      ).__themeViolations.push(event.violatedDirective),
    );
  });
  page.on('pageerror', (error) => violations.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute(
    'data-card-theme',
    'classic',
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(requests.some((url) => /royal.*\.(css|svg)/.test(url))).toBe(false);
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith('omi-static-'))
          .map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (request) => request.url,
            ),
          ),
      )
    ).flat(),
  );
  expect(cached.some((url) => /royal.*\.css/.test(url))).toBe(false);
  await page.getByText('Card themes', { exact: true }).click();
  const select = page.getByLabel('Card design', { exact: true });
  await select.selectOption('royal');
  await expect(page.locator('html')).toHaveAttribute(
    'data-card-theme',
    'royal',
  );
  const preview = page.getByLabel('Card theme preview', { exact: true });
  await expect(
    preview.getByRole('img', { name: 'A of spades', exact: true }),
  ).toBeVisible();
  expect(
    await preview
      .locator('.card-face')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(241, 213, 151)');
  expect(
    await preview
      .locator('.card-face.red')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(255, 167, 172)');
  await expect
    .poll(() => preview.locator('.card-back img').getAttribute('src'))
    .toContain('royal-back-');
  await expect
    .poll(() =>
      preview
        .locator('.card-back img')
        .evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(requests.some((url) => /royal.*\.css/.test(url))).toBe(true);
  expect(requests.some((url) => /royal-back-.*\.svg/.test(url))).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('royal-320.png'),
    fullPage: true,
  });
  const other = await browser.newContext({
    baseURL: String(info.project.use.baseURL),
  });
  try {
    const friend = await other.newPage();
    await friend.goto('/');
    await expect(friend.locator('html')).toHaveAttribute(
      'data-card-theme',
      'classic',
    );
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-card-theme',
      'royal',
    );
    await expect(friend.locator('html')).toHaveAttribute(
      'data-card-theme',
      'classic',
    );
  } finally {
    await other.close();
  }
  await page.getByText('Card themes', { exact: true }).click();
  await select.selectOption('classic');
  await expect(page.locator('html')).toHaveAttribute(
    'data-card-theme',
    'classic',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Real animation selectors are exercised on a decorative DOM fixture, no game state is invented.
  await page.evaluate(() => {
    const card = document.createElement('div');
    card.className = 'thrown-card animate-play';
    card.id = 'motion-probe';
    document.querySelector('.theme-preview')!.append(card);
  });
  expect(
    await page
      .locator('#motion-probe')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(
    await page
      .locator('#motion-probe')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('physical-play');
  await page.getByRole('checkbox', { name: 'Data Saver Mode' }).check();
  expect(
    await page
      .locator('#motion-probe')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __themeViolations: string[] })
          .__themeViolations,
    ),
  ).toEqual([]);
  expect(violations).toEqual([]);
});
test('unavailable theme CSS preserves readable cards and offers a retry', async ({
  page,
}) => {
  await page.route(/\/assets\/royal-[^/]+\.css$/, (route) => route.abort());
  await page.goto('/');
  await page.getByText('Card themes', { exact: true }).click();
  await page.getByLabel('Card design', { exact: true }).selectOption('royal');
  await expect(page.getByRole('alert')).toContainText(
    'current cards are still playable',
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-card-theme',
    'classic',
  );
  await expect(
    page.getByRole('button', { name: 'Retry card design' }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Retry card design' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-card-theme',
    'royal',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(
    await page
      .locator('.theme-preview .card-face')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(241, 213, 151)');
});

import { expect, test } from '@playwright/test';

for (const width of [320, 1280]) {
  test(`settings and waiting lobby remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Game settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('combobox')).toBeVisible();
    await expect(
      settings.getByRole('checkbox', { name: 'Data Saver Mode' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath(`settings-${width}.png`) });
    await settings.getByRole('button', { name: 'Back' }).click();
    await expect(settings).not.toBeVisible();
    await page.getByLabel('Your name').fill('Nimali');
    await page.getByRole('button', { name: 'Create a table' }).click();
    const lobby = page.getByRole('region', { name: 'Your table is ready.' });
    await expect(lobby).toBeVisible();
    await expect(lobby.locator('.lobby-seat')).toHaveCount(4);
    await expect(
      lobby.getByRole('button', { name: 'Start game' }),
    ).toBeDisabled();
    await expect(
      lobby.getByRole('button', { name: 'Add a bot' }),
    ).toBeEnabled();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`lobby-${width}.png`),
      fullPage: true,
    });
  });
}

test('lobby settings use a closable overlay and Sinhala labels stay readable', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Nimali');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await expect(
    page.getByRole('region', { name: 'Your table is ready.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sound, voice & music' }).click();
  const settings = page.locator('dialog.table-utilities');
  await expect(settings).toBeVisible();
  await settings.getByRole('combobox').first().selectOption('si');
  await expect(page.locator('html')).toHaveAttribute('lang', 'si');
  await expect(
    settings.getByText('ශබ්දය සහ චලනය', { exact: true }),
  ).toBeVisible();
  await expect(settings.getByRole('slider').first()).toBeVisible();
  await settings.getByText('කොළ සැලසුම්', { exact: true }).click();
  await expect(
    settings.getByLabel('කොළ සැලසුම', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('lobby-settings-sinhala.png'),
  });
  await page.keyboard.press('Escape');
  await expect(settings).not.toBeVisible();
  await expect(page.locator('.lobby')).toBeVisible();
});

test('startup shows real session loading and exposes retry after server failure', async ({
  page,
}, info) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let attempt = 0;
  await page.route('**/api/auth/session', async (route) => {
    if (attempt++ === 0) {
      await pending;
      await route.fulfill({
        status: 503,
        json: { code: 'SERVICE_UNAVAILABLE' },
      });
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  try {
    await expect(
      page.getByRole('heading', { name: 'Opening OMI…' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Checking your session…' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('startup.png') });
  } finally {
    finish();
  }
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Tropical Adventure/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeEnabled();
  expect(attempt).toBe(2);
});

test('network loss shows one recovery state and restores the same authorized lobby', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Recovery host');
  await page.getByRole('button', { name: 'Create a table' }).click();
  const code = await page.locator('.invite-box strong').textContent();
  await context.setOffline(true);
  await expect(page.locator('.connection-banner')).toContainText(
    'Disconnected',
  );
  await expect(
    page.getByRole('button', { name: 'Ready to play' }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(page.locator('.header-note')).toHaveText('At the table');
  await expect(page.locator('.connection-banner')).toHaveCount(0);
  await expect(page.locator('.invite-box strong')).toHaveText(code!);
  await expect(
    page.getByRole('button', { name: 'Ready to play' }),
  ).toBeEnabled();
});

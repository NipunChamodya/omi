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

test('short mobile lobby keeps long names on one line and actions within reach', async ({
  page,
}, info) => {
  const name = 'NimaliWickramasinghePerera123';
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Create a table' }).click();
  const lobby = page.getByRole('region', { name: 'Your table is ready.' });
  const start = lobby.getByRole('button', { name: 'Start game' });
  await expect(start).toBeDisabled();
  for (let i = 0; i < 3; i++) {
    await lobby.getByRole('button', { name: 'Add a bot' }).click();
    await expect(lobby.locator('.lobby-seat.empty')).toHaveCount(2 - i);
  }
  await expect(start).toBeDisabled();
  await lobby.getByRole('button', { name: 'Ready to play' }).click();
  await expect(start).toBeEnabled();

  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [375, 667],
    [390, 844],
    [412, 915],
    [430, 932],
    [568, 320],
    [768, 1024],
    [1024, 768],
    [1280, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    if (width === 320 || width === 568 || width === 1280) {
      await page.screenshot({
        path: info.outputPath(`full-lobby-${width}.png`),
        fullPage: true,
      });
    }
    const nameLines = await lobby
      .getByText(name, { exact: true })
      .evaluate((label) => {
        const range = document.createRange();
        range.selectNode(label.firstChild!);
        return new Set(Array.from(range.getClientRects(), ({ top }) => top))
          .size;
      });
    expect(nameLines, `name wraps at ${width}×${height}`).toBe(1);
    const seats = await lobby.locator('.lobby-seat').evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y } = element.getBoundingClientRect();
        return { x, y };
      }),
    );
    expect(seats[0]!.y).toBe(seats[1]!.y);
    expect(seats[2]!.y).toBe(seats[3]!.y);
    expect(seats[0]!.x).toBe(seats[2]!.x);
    expect(seats[1]!.x).toBeGreaterThan(seats[0]!.x);
    if (width <= 430 || width === 568) {
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
        `lobby overflow at ${width}×${height}`,
      ).toBeLessThanOrEqual(height + 1);
    }
    const button = await start.boundingBox();
    expect(
      button!.y + button!.height,
      `Start at ${width}×${height}`,
    ).toBeLessThanOrEqual(height);
    expect(button!.height).toBeGreaterThanOrEqual(43.9);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test('first launch intro can be skipped and stays skipped after reload', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip intro' });
  await expect(skip).toBeVisible();
  await expect(page.locator('.opening-cards__deck span')).toHaveCount(4);
  await skip.click();
  await expect(skip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play OMI' })).toBeVisible();
  await expect(skip).toHaveCount(0);
});

test('reduced motion opens the menu without a timed introduction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play OMI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
});

test('menu soundtrack is opt-in and can be turned off without changing game effects', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/(menu|opening)-theme-[^/]+\.mp3/.test(request.url()))
      requests.push(request.url());
  });
  await page.goto('/');
  const music = page.getByRole('button', { name: 'Menu music' });
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  expect(requests).toHaveLength(0);
  await music.click();
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  expect(requests.some((url) => url.includes('/menu-theme-'))).toBe(true);
  await music.click();
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Game settings' });
  await settings.getByText('Sound & motion', { exact: true }).click();
  await expect(
    settings.getByRole('checkbox', { name: 'Card sounds' }),
  ).toBeChecked();
});

test('Data Saver bypasses the fresh launch animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() =>
    localStorage.setItem('omi-data-saver', 'true'),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play OMI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
});

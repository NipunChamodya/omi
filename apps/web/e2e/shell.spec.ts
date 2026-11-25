import { expect, test } from '@playwright/test';
for (const width of [320, 390, 430, 1280]) {
  test(`home and join fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Tropical Adventure/ }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`home-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: /Join a table/ }).click();
    await expect(page.getByLabel('Table code')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`join-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('supports keyboard focus and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await expect(page.getByRole('main')).toBeVisible();
});

test('beginner practice gives feedback and switches to Sinhala', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Learn to play/ }).click();
  const practice = page.getByRole('dialog', { name: 'Practice OMI' });
  await expect(practice).toBeVisible();
  await page.screenshot({
    path: info.outputPath('practice.png'),
    animations: 'disabled',
  });
  await practice.getByRole('button', { name: 'The player beside you' }).click();
  await expect(practice.getByRole('status')).toHaveText('Try again.');
  await practice
    .getByRole('button', { name: 'The player opposite you' })
    .click();
  await practice.getByRole('button', { name: 'Next' }).click();
  await practice.getByRole('button', { name: 'සිංහල' }).click();
  const translated = page.getByRole('dialog', { name: 'ඕමි පුහුණුව' });
  await expect(translated).toHaveAttribute('lang', 'si');
  await expect(
    translated.getByRole('button', { name: 'ආසියා (A)' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(translated).toHaveCount(0);
});

test('Sinhala join labels fit a narrow screen and survive reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings & install' }).click();
  await page.getByRole('combobox', { name: /Language/ }).selectOption('si');
  await expect(page.locator('html')).toHaveAttribute('lang', 'si');
  await page.reload();
  await page.getByRole('button', { name: 'මේසයකට එක්වන්න' }).click();
  await expect(page.getByLabel('මේස කේතය')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('browser Back closes settings before leaving the join screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Join a table/ }).click();
  await expect(page.getByLabel('Table code')).toBeVisible();
  await page.getByRole('button', { name: 'Settings & install' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Game settings' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'Game settings' }),
  ).not.toBeVisible();
  await expect(page.getByLabel('Table code')).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Table code')).not.toBeVisible();
});

test('iPhone install guide shows the Safari Share steps', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings & install' }).click();
    await page.getByText('Install & data settings', { exact: true }).click();
    await expect(
      page.getByText('Share → Add to Home Screen → Add'),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const width of [
  320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440, 1920,
]) {
  test(`Tropical Adventure artwork and controls fit ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'OMI Tropical Adventure' }),
    ).toBeVisible();
    const stage = page.locator('.island-stage');
    await expect(stage).toBeVisible();
    for (const selector of ['.island-stage__world', '.island-stage__guide']) {
      await expect
        .poll(() =>
          stage
            .locator(selector)
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
        )
        .toBe(true);
    }
    const play = page.getByRole('button', { name: 'Play OMI' });
    await expect(play).toBeEnabled();
    expect(
      await play.evaluate((node) => getComputedStyle(node).backgroundImage),
    ).toContain('rgb(131, 213, 47)');
    expect((await play.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      page.getByRole('button', { name: 'Settings', exact: true }),
    ).toBeVisible();
    if (width === 320 || width === 1280)
      await page.screenshot({
        path: info.outputPath(`tropical-${width}.png`),
        fullPage: true,
      });
  });
}

test('direct Join Back returns to the mode picker and then Home', async ({
  page,
}) => {
  await page.goto('/?screen=join');
  await expect(page.getByLabel('Table code')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose how to play' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'OMI Tropical Adventure' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Back', exact: true }),
  ).toHaveCount(0);
});

test('repeated Settings Back presses close one history entry', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play OMI' }).click();
  await page.getByRole('button', { name: 'Settings & install' }).click();
  const settings = page.getByRole('dialog', { name: 'Game settings' });
  await settings
    .getByRole('button', { name: 'Back' })
    .evaluate((node: HTMLButtonElement) => {
      node.click();
      node.click();
    });
  await expect(settings).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Choose how to play' }),
  ).toBeVisible();
});

test('saved lobby exposes Create and Join guidance and can resume the same code', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Island captain');
  await page.getByRole('button', { name: /Create a table/ }).click();
  const code = await page.locator('.invite-box strong').innerText();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Back', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Return home and keep my seat' })
    .click();
  const recovery = page.getByRole('region', { name: 'Your seat is saved.' });
  await expect(recovery.getByText(code)).toBeVisible();
  await expect(
    recovery.getByRole('button', { name: 'Create a table' }),
  ).toBeVisible();
  await recovery.getByRole('button', { name: 'Join a table' }).click();
  await expect(recovery.getByText(/before taking another seat/)).toBeVisible();
  await expect(page.getByLabel('Table code')).toHaveCount(0);
  await recovery.getByRole('button', { name: 'Resume table' }).click();
  await expect(page.locator('.invite-box strong')).toHaveText(code);
});

test('Play Online opens mode selection with a saved lobby and releases it only on confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Island online');
  await page.getByRole('button', { name: /Create a table/ }).click();
  const oldCode = await page.locator('.invite-box strong').innerText();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Back', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Return home and keep my seat' })
    .click();
  await page.getByRole('button', { name: 'Play Online', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose how to play' }),
  ).toBeVisible();
  await expect(page.getByText(oldCode, { exact: true })).toBeVisible();
  await expect(page.locator('.lobby')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Choose how to play' }),
  ).toBeVisible();
  const release = page.getByRole('button', { name: 'Release table seat' });
  await release.click();
  await page.getByRole('button', { name: 'Keep my seat' }).click();
  await expect(page.getByText(oldCode, { exact: true })).toBeVisible();
  await release.click();
  await release.click();
  await expect(page.getByText(oldCode, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create Private Table' }).click();
  await page.getByRole('button', { name: /Create a table/ }).click();
  await expect(page.locator('.invite-box strong')).not.toHaveText(oldCode);
});

test('fresh Play Online shows illustrated and actionable modes at mobile and desktop widths', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Online', exact: true }).click();
  const modes = page.getByRole('region', { name: 'Choose how to play' });
  for (const label of [
    'Create Private Table',
    'Join Table with Code',
    'Play with Friends',
    'Ranked Match',
  ])
    await expect(modes.getByRole('button', { name: label })).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Your seat is saved.' }),
  ).toHaveCount(0);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect
      .poll(() =>
        page
          .locator('.mode-postcard__island')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`modes-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await modes.getByRole('button', { name: 'Create Private Table' }).click();
  await expect(
    page.getByRole('button', { name: 'Create a table', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('create-390.png'),
    fullPage: true,
  });
});

test('a signed-in tab reconciles an active lobby created in a second tab', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: 'My profile' })).toBeVisible();
  const other = await context.newPage();
  try {
    await other.goto('/');
    await other.getByRole('button', { name: /Create a table/ }).click();
    const code = await other.locator('.invite-box strong').innerText();
    await page.getByRole('button', { name: /Create a table/ }).click();
    const recovery = page.getByRole('region', { name: 'Your seat is saved.' });
    await expect(recovery.getByText(code, { exact: true })).toBeVisible();
    await expect(
      recovery.getByRole('button', { name: 'Resume table' }),
    ).toBeEnabled();
    await expect(page.locator('.lobby')).toHaveCount(0);
    expect(await other.locator('.invite-box strong').innerText()).toBe(code);
  } finally {
    await other.close();
  }
});

test('Tamil practice starts in the selected language and provides answer feedback', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('omi.language', 'ta'));
  await page.goto('/');
  await page
    .getByRole('button', { name: /Learn to play|விளையாடக் கற்றுக்கொள்/ })
    .click();
  const practice = page.getByRole('dialog', { name: 'ஓமி பயிற்சி' });
  await expect(practice).toHaveAttribute('lang', 'ta');
  await practice
    .getByRole('button', { name: 'உங்களுக்கு எதிரே உள்ள வீரர்' })
    .click();
  await expect(practice.getByRole('status')).toHaveText('சரி!');
  await practice.getByRole('button', { name: 'அடுத்து' }).click();
  await expect(practice.getByRole('button', { name: 'ஏஸ் (A)' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('practice-ta-320.png') });
});

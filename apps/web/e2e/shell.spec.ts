import { expect, test } from '@playwright/test';
for (const width of [320, 390, 430, 1280]) {
  test(`home and join fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Four friends/ }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`home-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: /Join a table/ }).click();
    await expect(page.getByLabel('Table code')).toBeVisible();
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
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Learn to play/ }).click();
  const practice = page.getByRole('dialog', { name: 'Practice OMI' });
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

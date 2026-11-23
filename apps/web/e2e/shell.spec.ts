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

import { expect, test } from '@playwright/test';
for (const width of [320, 390, 430, 1280]) {
  test(`shell fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Four friends. One table.' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('supports reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});

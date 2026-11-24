import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test('active casual hand survives abrupt backend termination and resumes browser play', async ({
  page,
}) => {
  const fixtureDir = process.env.OMI_TEST_RESTART_DIR;
  test.skip(!fixtureDir, 'requires isolated disk-backed browser fixture');
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByLabel('Your name').fill('Nimali');
  await page.getByRole('button', { name: 'Create a table' }).click();
  const code = await page.locator('.invite-box strong').textContent();
  for (let bots = 1; bots <= 3; bots++) {
    await page.getByRole('button', { name: 'Add a bot' }).click();
    await expect(page.locator('.lobby-seat:not(.empty)')).toHaveCount(bots + 1);
  }
  await page.getByRole('button', { name: 'Ready to play' }).click();
  await page.getByRole('button', { name: /Start game/ }).click();

  const cut = page.getByRole('button', { name: 'Cut & deal' });
  const trump = page
    .getByRole('button', { name: /Trump (spades|hearts|diamonds|clubs)/ })
    .first();
  const play = page.getByRole('button', { name: 'Play selected card' });
  await expect(cut.or(trump).or(play)).toBeVisible({ timeout: 12_000 });
  if (await cut.isVisible()) await cut.click();
  await expect(trump.or(play)).toBeVisible({ timeout: 12_000 });
  if (await trump.isVisible()) await trump.click();
  await expect(page.getByTestId('hand-card')).toHaveCount(8);
  const originalCards = await page
    .getByTestId('hand-card')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('aria-label')),
    );

  await writeFile(join(fixtureDir!, 'restart'), 'restart\n', { flag: 'wx' });
  await expect(page.locator('.connection-banner')).toBeVisible();
  await expect(page.locator('.header-note')).toHaveText('At the table', {
    timeout: 25_000,
  });
  await expect(page.locator('.room-code strong')).toHaveText(code!);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.header-note')).toHaveText('At the table', {
    timeout: 12_000,
  });
  await expect(page.locator('.room-code strong')).toHaveText(code!);
  await expect(page.getByTestId('hand-card')).toHaveCount(8);
  expect(
    await page
      .getByTestId('hand-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('aria-label')),
      ),
  ).toEqual(originalCards);
  const firstPlayable = page
    .locator('[data-testid="hand-card"]:not([disabled])')
    .first();
  await expect(firstPlayable).toBeEnabled({ timeout: 12_000 });
  await firstPlayable.click();
  await play.click();
  await expect(page.getByTestId('hand-card')).toHaveCount(7);
  for (let remaining = 7; remaining > 0; remaining--) {
    await expect(
      page.getByText(/Your (turn|lead)\. Choose a card\./),
    ).toBeVisible({ timeout: 12_000 });
    await firstPlayable.click();
    await play.click();
    await expect(page.getByTestId('hand-card')).toHaveCount(remaining - 1);
  }
  await expect(
    page.getByRole('heading', { name: 'Round complete.' }),
  ).toBeVisible({ timeout: 12_000 });
  const scores = await page.locator('.result-scores strong').allTextContents();
  expect(scores.map(Number).reduce((sum, score) => sum + score, 0)).toBe(20);
});

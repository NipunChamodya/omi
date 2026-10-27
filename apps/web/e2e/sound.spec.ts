import { expect, test } from '@playwright/test';

test('game audio stays gesture-bound, decodes local assets and persists independent settings', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    if (!Base) return;
    const stats = { contexts: 0, starts: 0 };
    Object.assign(window, { omiAudioTest: stats });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options);
        stats.contexts++;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args: Parameters<typeof source.start>) => {
          stats.starts++;
          start(...args);
        };
        return source;
      }
    };
  });
  const errors: string[] = [];
  const violations: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.assign(window, { omiCspTest: [] });
    document.addEventListener('securitypolicyviolation', (event) =>
      (window as unknown as { omiCspTest: string[] }).omiCspTest.push(
        event.violatedDirective,
      ),
    );
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Four friends/ }),
  ).toBeVisible();
  const stats = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            omiAudioTest: { contexts: number; starts: number };
          }
        ).omiAudioTest,
    );
  expect((await stats()).contexts).toBe(0);
  await page.getByText('Sound & motion', { exact: true }).click();
  await page.getByLabel('Sound effects volume', { exact: true }).focus();
  await page.getByLabel('Sound effects volume', { exact: true }).press('Home');
  for (let i = 0; i < 3; i++)
    await page
      .getByLabel('Sound effects volume', { exact: true })
      .press('ArrowRight');
  await expect(
    page.getByLabel('Sound effects volume', { exact: true }),
  ).toHaveValue('0.15');
  await page.getByLabel('Voice chat volume', { exact: true }).focus();
  await page.getByLabel('Voice chat volume', { exact: true }).press('Home');
  await page
    .getByLabel('Voice chat volume', { exact: true })
    .press('ArrowRight');
  await expect(
    page.getByLabel('Voice chat volume', { exact: true }),
  ).toHaveValue('0.05');
  const asset = page.waitForResponse(
    (response) =>
      response.url().includes('paper') &&
      response.url().includes('.mp3') &&
      response.ok(),
  );
  await page.getByRole('button', { name: /Join a table/ }).click();
  await asset;
  await expect.poll(async () => (await stats()).starts).toBeGreaterThan(0);
  expect((await stats()).contexts).toBe(1);
  await page.getByLabel('Master sound', { exact: true }).uncheck();
  const before = (await stats()).starts;
  await page.getByRole('link', { name: 'OMI home' }).click();
  expect((await stats()).starts).toBe(before);
  await page.reload();
  await page.getByText('Sound & motion', { exact: true }).click();
  await expect(
    page.getByLabel('Master sound', { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel('Quiet table ambience', { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel('Voice chat volume', { exact: true }),
  ).toHaveValue('0.05');
  await expect(
    page.getByLabel('Sound effects volume', { exact: true }),
  ).toHaveValue('0.15');
  violations.push(
    ...(await page.evaluate(
      () => (window as unknown as { omiCspTest: string[] }).omiCspTest,
    )),
  );
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

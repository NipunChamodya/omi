import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

test('four mobile friends create, join, deal, play a round and resume after reload', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (const width of [320, 390, 430, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        baseURL: String(
          testInfo.project.use.baseURL ?? 'http://127.0.0.1:5173',
        ),
      });
      contexts.push(context);
      pages.push(await context.newPage());
    }
    const host = pages[0]!;
    await host.goto('/');
    await host.getByLabel('Your name').fill('Nipun');
    await host.getByRole('button', { name: /Create a table/ }).click();
    await expect(
      host.getByRole('heading', { name: 'Your table is ready.' }),
    ).toBeVisible();
    const code = (await host.locator('.invite-box strong').textContent())!;
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    await expect(
      host.getByRole('button', { name: /Start game/ }),
    ).toBeDisabled();
    await Promise.all(
      pages.slice(1).map(async (page, i) => {
        await page.goto(`/?room=${code}`);
        await page
          .getByLabel('Your name')
          .fill(['Kamal', 'Nimali', 'Amila'][i]!);
        await expect(page.getByLabel('Table code')).toHaveValue(code);
        await page.getByRole('button', { name: /Join table/ }).click();
        await expect(
          page.getByRole('heading', { name: 'Your table is ready.' }),
        ).toBeVisible();
      }),
    );
    for (const page of pages) {
      await expect(page.locator('.lobby-seat:not(.empty)')).toHaveCount(4);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    // Every participant chooses independently before the same authoritative round.
    for (let i = 0; i < pages.length; i++) {
      await pages[i]!.getByText('Card themes', { exact: true }).click();
      await pages[i]!.getByLabel('Card design', { exact: true }).selectOption(
        i % 2 === 0 ? 'royal' : 'classic',
      );
      await expect(pages[i]!.locator('html')).toHaveAttribute(
        'data-card-theme',
        i % 2 === 0 ? 'royal' : 'classic',
      );
      await pages[i]!.getByText('Card themes', { exact: true }).click();
    }
    for (let i = 0; i < pages.length; i++) {
      await pages[i]!.getByRole('button', { name: 'Ready to play' }).click();
      await Promise.all(
        pages.map((page) =>
          expect(page.locator('.ready-label.is-ready')).toHaveCount(i + 1),
        ),
      );
    }
    await expect(
      host.getByRole('button', { name: /Start game/ }),
    ).toBeEnabled();
    await host.getByRole('button', { name: /Start game/ }).click();
    await expect
      .poll(async () => {
        for (let i = 0; i < 4; i++)
          if (
            await pages[i]!.getByRole('button', { name: 'Cut & deal' }).count()
          )
            return i;
        return -1;
      })
      .not.toBe(-1);
    const cutter = await (async () => {
      for (const page of pages)
        if (await page.getByRole('button', { name: 'Cut & deal' }).count())
          return page;
      throw new Error('No cutter');
    })();
    await cutter.getByLabel('Cut position').focus();
    await cutter.getByLabel('Cut position').press('Home');
    await cutter.getByLabel('Cut position').press('ArrowRight');
    await expect(cutter.getByLabel('Cut position')).toHaveValue('2');
    await cutter.getByRole('button', { name: 'Cut & deal' }).click();
    for (const page of pages)
      await expect(page.getByTestId('hand-card')).toHaveCount(4);
    const selector = await (async () => {
      for (const page of pages)
        if (
          await page
            .getByRole('button', {
              name: /Trump (spades|hearts|diamonds|clubs)/,
            })
            .count()
        )
          return page;
      throw new Error('No selector');
    })();
    await selector
      .getByRole('button', { name: /Trump (spades|hearts|diamonds|clubs)/ })
      .first()
      .click();
    for (const page of pages) {
      await expect(page.getByTestId('hand-card')).toHaveCount(8);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.getByTestId('seat-bottom')).toContainText('You');
    }
    for (let i = 0; i < 3; i++)
      await pages[i]!.screenshot({
        path: testInfo.outputPath(`table-${[320, 390, 430][i]}.png`),
        fullPage: true,
      });
    const beforeReload = await host
      .getByTestId('hand-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('aria-label')),
      );
    const beforeScore = await host.getByTestId('score').innerText();
    await host.getByText('Card themes', { exact: true }).click();
    await host
      .getByLabel('Card design', { exact: true })
      .selectOption('classic');
    await expect(host.locator('html')).toHaveAttribute(
      'data-card-theme',
      'classic',
    );
    expect(
      await host
        .getByTestId('hand-card')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute('aria-label')),
        ),
    ).toEqual(beforeReload);
    expect(await host.getByTestId('score').innerText()).toBe(beforeScore);
    await host.getByLabel('Card design', { exact: true }).selectOption('royal');
    await expect(host.locator('html')).toHaveAttribute(
      'data-card-theme',
      'royal',
    );
    await host.reload();
    await expect(host.locator('html')).toHaveAttribute(
      'data-card-theme',
      'royal',
    );
    await expect(host.getByTestId('hand-card')).toHaveCount(8);
    await expect(host.locator('.header-note')).toHaveText('At the table');
    expect(
      await host
        .getByTestId('hand-card')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute('aria-label')),
        ),
    ).toEqual(beforeReload);
    await contexts[2]!.setOffline(true);
    await expect(pages[2]!.locator('.header-note')).toHaveText('Disconnected');
    await expect(pages[2]!.getByTestId('hand-card').first()).toBeDisabled();
    await contexts[2]!.setOffline(false);
    await expect(pages[2]!.locator('.header-note')).toHaveText('At the table');
    await expect(pages[2]!.getByTestId('hand-card')).toHaveCount(8);
    await host.setViewportSize({ width: 320, height: 568 });
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (let play = 0; play < 32; play++) {
      let actor: Page | undefined;
      await expect
        .poll(async () => {
          for (const page of pages)
            if (
              (await page
                .getByTestId('turn-status')
                .getAttribute('data-your-turn')) === 'true'
            ) {
              actor = page;
              return true;
            }
          return false;
        })
        .toBe(true);
      const hand = actor!.getByTestId('hand-card');
      const count = await hand.count();
      await hand.first().click();
      await expect(hand).toHaveCount(count);
      await expect(
        actor!.getByRole('button', { name: 'Play selected card' }),
      ).toBeEnabled();
      await actor!.getByRole('button', { name: 'Play selected card' }).click();
      await expect(hand).toHaveCount(count - 1);
      if (play === 3) {
        await expect(
          pages[1]!.locator('.trick-area.completed .thrown-card'),
        ).toHaveCount(4);
        await pages[1]!.screenshot({
          path: testInfo.outputPath('trick-390.png'),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
    for (const page of pages) {
      await expect(
        page.getByRole('heading', { name: 'Round complete.' }),
      ).toBeVisible();
      await expect(page.getByTestId('hand-card')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await host.screenshot({
      path: testInfo.outputPath('results-320.png'),
      fullPage: true,
    });
    await host.getByRole('button', { name: /Next round/ }).click();
    await expect(host.getByRole('alert')).toContainText('dealer rule');
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('shows a useful error for an invalid invite without creating a fake lobby', async ({
  page,
}) => {
  await page.goto('/?room=ZZZZZZZZ');
  await page.getByLabel('Your name').fill('Guest');
  await page.getByRole('button', { name: /Join table/ }).click();
  await expect(page.getByRole('alert')).toContainText('code is incorrect');
  await expect(page.locator('.lobby')).toHaveCount(0);
});

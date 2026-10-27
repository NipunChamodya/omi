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
        hasTouch: browser.browserType().name() === 'chromium',
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
    await host
      .getByRole('button', { name: 'Sound & tools', exact: true })
      .click();
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
    await host
      .getByRole('button', { name: 'Back to game', exact: true })
      .click();
    await host.getByRole('button', { name: '← Home', exact: true }).click();
    await expect(
      host.getByRole('dialog', { name: 'Return from your table?' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Keep playing' }).click();
    await expect(host.getByTestId('hand-card')).toHaveCount(8);
    await host.goBack();
    await expect(
      host.getByRole('dialog', { name: 'Return from your table?' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Keep playing' }).click();
    host.once('dialog', (dialog) => void dialog.accept());
    await host.reload();
    await expect(host.locator('html')).toHaveAttribute(
      'data-card-theme',
      'royal',
    );
    await expect(host.getByTestId('hand-card')).toHaveCount(8);
    await expect(host.locator('.header-note')).toHaveText('At the table');
    await expect(
      host.locator('.animate-play, .shuffle-deck, .deal-flight'),
    ).toHaveCount(0);
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
    for (const [width, height] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [393, 852],
      [430, 932],
      [412, 915],
      [667, 375],
      [844, 390],
    ]) {
      await host.setViewportSize({ width: width!, height: height! });
      await host.evaluate(() => scrollTo(0, 0));
      const boxes = await host.getByTestId('hand-card').evaluateAll((cards) =>
        cards.map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        }),
      );
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width!);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(height!);
        expect(box.right - box.left).toBeGreaterThanOrEqual(43.9);
        expect(box.bottom - box.top).toBeGreaterThanOrEqual(43.9);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!,
            b = boxes[j]!;
          expect(
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5,
          ).toBe(false);
        }
      expect(
        await host.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
      ).toBe(true);
      await expect(host.getByTestId('score')).toBeInViewport();
      await expect(
        host.getByRole('button', { name: 'Play selected card' }),
      ).toBeInViewport();
      for (const position of ['top', 'left', 'right', 'bottom'])
        await expect(host.getByTestId(`seat-${position}`)).toBeInViewport();
      await host.screenshot({
        path: testInfo.outputPath(`viewport-${width}x${height}.png`),
      });
    }
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
      if (play === 0) {
        await actor!.setViewportSize({ width: 375, height: 667 });
        await actor!.evaluate(() => scrollTo(0, 0));
        const first = hand.first();
        const source = (await first.boundingBox())!;
        const zone = (await actor!
          .getByTestId('card-drop-zone')
          .boundingBox())!;
        expect(source.y).toBeGreaterThanOrEqual(0);
        expect(source.y + source.height).toBeLessThanOrEqual(667);
        const sx = source.x + source.width / 2,
          sy = source.y + source.height / 2;
        const tx = zone.x + zone.width / 2,
          ty = zone.y + zone.height / 2;
        expect(
          await first.evaluate(
            (element) => getComputedStyle(element).touchAction,
          ),
        ).toBe('none');
        // An outside drop must return without removing anything from the hand.
        await actor!.mouse.move(sx, sy);
        await actor!.mouse.down();
        await actor!.mouse.move(8, sy - 25, { steps: 5 });
        await actor!.mouse.up();
        await expect(hand).toHaveCount(count);
        await expect(first).not.toHaveAttribute('data-awaiting');
        await expect
          .poll(() =>
            first.evaluate((element) =>
              element
                .getAnimations()
                .some((animation) => animation.playState === 'running'),
            ),
          )
          .toBe(false);
        const returned = (await first.boundingBox())!;
        // Real mouse drag submits through the same authoritative multiplayer path.
        await actor!.mouse.move(
          returned.x + returned.width / 2,
          returned.y + returned.height / 2,
        );
        await actor!.mouse.down();
        await actor!.mouse.move(tx, ty, { steps: 12 });
        await expect(actor!.getByTestId('card-drop-zone')).toHaveClass(
          /drop-over/,
        );
        await actor!.mouse.up();
        await expect(hand).toHaveCount(count - 1);
        for (const page of pages)
          await expect(page.locator('.thrown-card')).toHaveCount(1);
        continue;
      }
      if (play === 1) {
        await hand.first().focus();
        await hand.first().press('Space');
        await hand.first().press('Enter');
        await expect(hand).toHaveCount(count - 1);
        continue;
      }
      if (play === 2 && browser.browserType().name() === 'chromium') {
        await actor!.evaluate(() => scrollTo(0, 0));
        const source = (await hand.first().boundingBox())!;
        const zone = (await actor!
          .getByTestId('card-drop-zone')
          .boundingBox())!;
        const scroll = await actor!.evaluate(() => scrollY);
        const cdp = await actor!.context().newCDPSession(actor!);
        const start = {
          x: source.x + source.width / 2,
          y: source.y + source.height / 2,
        };
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [start],
        });
        await actor!.waitForTimeout(180);
        for (let step = 1; step <= 6; step++)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              {
                x: start.x + ((zone.x + zone.width / 2 - start.x) * step) / 6,
                y: start.y + ((zone.y + zone.height / 2 - start.y) * step) / 6,
              },
            ],
          });
        await expect(actor!.getByTestId('card-drop-zone')).toHaveClass(
          /drop-over/,
        );
        expect(await actor!.evaluate(() => scrollY)).toBe(scroll);
        await actor!.screenshot({
          path: testInfo.outputPath('touch-drag.png'),
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        await cdp.detach();
        await expect(hand).toHaveCount(count - 1);
        continue;
      }
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
    await expect(
      host.getByRole('button', { name: /Next round/ }),
    ).toBeDisabled();
    await expect(
      host.getByText(
        'Next round is unavailable: the owner has not approved dealer rotation.',
      ),
    ).toBeVisible();
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

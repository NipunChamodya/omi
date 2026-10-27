import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
const openSocial = async (page: Page) => {
  const details = page.locator('.social-panel > details');
  if (!(await details.getAttribute('open'))) {
    if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
      await details.locator('> summary').click();
  }
};
const settings = async (page: Page) => {
  const details = page.locator('.social-settings');
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
    await details.locator('> summary').click();
};
const music = (page: Page) =>
  page.getByRole('region', { name: 'Shared music' });
const send = async (page: Page, text: string) => {
  await page.getByLabel('Message to the table').fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
};
test('four friends exchange safe social content and synchronize real opt-in music', async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const audioRequests: string[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({
        baseURL: String(info.project.use.baseURL),
        viewport: { width: i === 0 ? 320 : 390, height: 844 },
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on('request', (request) => {
        // Game foley is gesture-enabled separately; shared music and reactions
        // must still load only after their explicit opt-in controls.
        if (
          /\/(?:emerald|coast|tap|chime|chuckle)-v1[^/]*\.(mp3|wav)(?:\?|$)/.test(
            request.url(),
          )
        )
          audioRequests.push(request.url());
      });
      pages.push(page);
    }
    const host = pages[0]!;
    await host.goto('/');
    await host.getByLabel('Your name').fill('Social host');
    await host.getByRole('button', { name: /Create a table/ }).click();
    const code = (await host.locator('.invite-box strong').textContent())!;
    for (let i = 1; i < 4; i++) {
      await pages[i]!.goto(`/?room=${code}`);
      await pages[i]!.getByLabel('Your name').fill(`Social friend ${i}`);
      await pages[i]!.getByRole('button', { name: /Join table/ }).click();
    }
    for (const page of pages) {
      await expect(page.locator('.social-connection')).toHaveText('Connected');
      await openSocial(page);
    }
    expect(audioRequests).toHaveLength(0);
    const greeting = 'ආයුබෝවන් යාළුවනේ! 🃏';
    await send(host, greeting);
    for (const page of pages)
      await expect(page.locator('.chat-history')).toContainText(greeting);
    const markup = '<img src=x onerror=alert(1)> hello';
    await send(pages[1]!, markup);
    for (const page of pages) {
      await expect(page.locator('.chat-history')).toContainText(markup);
      await expect(page.locator('.chat-history img')).toHaveCount(0);
    }
    await host
      .getByRole('button', { name: 'Tap the table', exact: true })
      .click();
    await expect(pages[2]!.locator('.reaction-feed')).toContainText(
      'Table tap',
    );
    expect(audioRequests).toHaveLength(0);
    await settings(host);
    await host
      .getByLabel('Allow adult-language content (off by default)')
      .check();
    await host.getByRole('button', { name: 'මගුලයි! 🙈', exact: true }).click();
    await expect(pages[1]!.locator('.reaction-feed')).not.toContainText(
      'මගුලයි!',
    );
    await send(host, 'මගුලයි!');
    await expect(pages[1]!.locator('.chat-history')).toContainText(
      '[Adult-language message hidden]',
    );
    await settings(pages[1]!);
    await pages[1]!
      .getByLabel('Block incoming chat, reactions and voice from Social host')
      .check();
    await send(host, 'Blocked incoming sample');
    await expect(pages[2]!.locator('.chat-history')).toContainText(
      'Blocked incoming sample',
    );
    await expect(pages[1]!.locator('.chat-history')).not.toContainText(
      'Blocked incoming sample',
    );
    await pages[2]!
      .locator('.chat-history li')
      .filter({ hasText: markup })
      .getByRole('button', { name: 'Report message from Social friend 1' })
      .click();
    const report = pages[2]!.getByRole('form', { name: 'Report room message' });
    await report.getByLabel('Report reason').selectOption('spam');
    await report
      .getByLabel('Report details (optional)')
      .fill('Please review this test message');
    await report.getByRole('button', { name: 'Submit report' }).click();
    await expect(
      pages[2]!.locator('.social-panel').getByRole('status'),
    ).toContainText('Report saved for owner review');
    for (const page of pages) {
      await page.bringToFront();
      await music(page)
        .getByRole('button', { name: 'Enable music locally' })
        .click();
      await expect
        .poll(() =>
          page
            .locator('audio[data-social-music]')
            .evaluate((node) => (node as HTMLAudioElement).readyState),
        )
        .toBeGreaterThanOrEqual(2);
    }
    expect(
      audioRequests.filter((url) => url.includes('.mp3')).length,
    ).toBeGreaterThan(0);
    await music(host)
      .getByRole('button', { name: 'Play shared music' })
      .click();
    for (const page of pages)
      await expect
        .poll(() =>
          page
            .locator('audio[data-social-music]')
            .evaluate((node) => (node as HTMLAudioElement).paused),
        )
        .toBe(false);
    await music(host)
      .getByRole('slider', { name: 'Shared playback position' })
      .fill('12');
    await music(host)
      .getByRole('button', { name: 'Set shared position' })
      .click();
    for (const page of pages)
      await expect
        .poll(
          () =>
            page
              .locator('audio[data-social-music]')
              .evaluate((node) =>
                Math.abs((node as HTMLAudioElement).currentTime - 12),
              ),
          { timeout: 5000 },
        )
        .toBeLessThan(1.5);
    await music(host)
      .getByRole('button', { name: 'Pause shared music' })
      .click();
    for (const page of pages)
      await expect
        .poll(() =>
          page
            .locator('audio[data-social-music]')
            .evaluate((node) => (node as HTMLAudioElement).paused),
        )
        .toBe(true);
    await music(pages[1]!)
      .getByRole('slider', { name: 'Music volume' })
      .fill('0.1');
    await expect(
      music(pages[2]!).getByRole('slider', { name: 'Music volume' }),
    ).toHaveValue('0.25');
    await music(host).getByLabel('Shared track').selectOption('coast');
    for (const page of pages) {
      await expect(music(page)).toContainText('Coastal breeze');
      await expect
        .poll(() =>
          page
            .locator('audio[data-social-music]')
            .evaluate((node) =>
              (node as HTMLAudioElement).currentSrc.includes('coast-v1'),
            ),
        )
        .toBe(true);
    }
    await music(pages[3]!)
      .getByRole('button', { name: 'Disable music locally' })
      .click();
    await music(host)
      .getByRole('button', { name: 'Play shared music' })
      .click();
    await expect
      .poll(() =>
        pages[3]!
          .locator('audio[data-social-music]')
          .evaluate((node) => (node as HTMLAudioElement).paused),
      )
      .toBe(true);
    await contexts[2]!.setOffline(true);
    await expect(pages[2]!.locator('.header-note')).toHaveText('Disconnected');
    await expect
      .poll(() =>
        pages[2]!
          .locator('audio[data-social-music]')
          .evaluate((node) => (node as HTMLAudioElement).paused),
      )
      .toBe(true);
    await contexts[2]!.setOffline(false);
    await expect(pages[2]!.locator('.social-connection')).toHaveText(
      'Connected',
    );
    await expect
      .poll(() =>
        pages[2]!
          .locator('audio[data-social-music]')
          .evaluate((node) => (node as HTMLAudioElement).paused),
      )
      .toBe(false);
    const times = await Promise.all(
      pages
        .slice(0, 3)
        .map((page) =>
          page
            .locator('audio[data-social-music]')
            .evaluate((node) => (node as HTMLAudioElement).currentTime),
        ),
    );
    for (const time of times)
      expect(
        Math.min(Math.abs(time - times[0]!), 32 - Math.abs(time - times[0]!)),
      ).toBeLessThan(1);
    for (const page of pages) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator('.lobby-seat:not(.empty)')).toHaveCount(4);
    }
    await pages[1]!.getByRole('checkbox', { name: 'Data Saver Mode' }).check();
    await expect(
      music(pages[1]!).getByRole('button', { name: 'Enable music locally' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        pages[1]!
          .locator('audio[data-social-music]')
          .evaluate((node) => (node as HTMLAudioElement).paused),
      )
      .toBe(true);
    await expect(pages[1]!.locator('.avatar img')).toHaveCount(0);
    await pages[1]!
      .getByRole('checkbox', { name: 'Data Saver Mode' })
      .uncheck();
    await expect(
      music(pages[1]!).getByRole('button', { name: 'Enable music locally' }),
    ).toBeVisible();
    await host.screenshot({
      path: info.outputPath('social-320.png'),
      fullPage: true,
    });
    await host.getByRole('link', { name: 'OMI home' }).click();
    await expect(host.locator('audio[data-social-music]')).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

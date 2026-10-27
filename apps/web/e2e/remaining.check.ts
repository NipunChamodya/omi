import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

test('menu and browser back navigate without refreshes or accidental room creation', async ({
  page,
}) => {
  let creations = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/rooms'
    )
      creations++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  await page
    .getByRole('button', { name: 'Play with Friends', exact: true })
    .click();
  await page.getByRole('button', { name: 'Create Room', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Play with Friends', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Join Room', exact: true }).click();
  await expect(page.getByLabel('Table code')).toBeVisible();
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Play with Friends', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Multiplayer', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play Online', exact: true }).click();
  await expect(
    page.getByText('Sign in to join the real-player queue.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find players' })).toHaveCount(
    0,
  );
  expect(creations).toBe(0);
});

test('four distinct OIDC accounts queue, cancel, reconnect and enter one real-player table', async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const contexts: BrowserContext[] = [],
    pages: Page[] = [];
  const baseURL = String(info.project.use.baseURL);
  try {
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      await page.goto('/');
      await page
        .getByRole('button', { name: 'Continue with Google', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'My profile' }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Multiplayer', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Play Online', exact: true })
        .click();
      if (i === 0) {
        await page.getByRole('button', { name: 'Find players' }).click();
        await expect(page.getByTestId('queue-status')).toContainText(
          '1 in the queue',
        );
        await page.getByRole('button', { name: 'Cancel search' }).click();
        await expect(
          page.getByRole('button', { name: 'Find players' }),
        ).toBeVisible();
      }
      await page.getByRole('button', { name: 'Find players' }).click();
      if (i === 0) {
        await expect(page.getByTestId('queue-status')).toContainText(
          '1 in the queue',
        );
        await context.setOffline(true);
        await expect(page.getByTestId('queue-status')).toContainText(
          'Waiting counts are unavailable',
        );
        await context.setOffline(false);
        await expect(page.getByTestId('queue-status')).toContainText(
          '1 in the queue',
        );
      }
      if (i < 3) {
        await expect(page.getByTestId('queue-status')).toContainText(
          `${i + 1} in the queue`,
        );
        await expect(page.locator('.lobby')).toHaveCount(0);
      }
    }
    const ids: string[] = [];
    let roomId = '';
    for (const page of pages) {
      await expect(
        page.getByRole('heading', { name: 'Your table is ready.' }),
      ).toBeVisible();
      const session = await (
        await page.request.post('/api/auth/session', {
          headers: { origin: baseURL },
          data: {},
        })
      ).json();
      ids.push(session.user.id);
      if (roomId) expect(session.room.roomId).toBe(roomId);
      else roomId = session.room.roomId;
    }
    expect(new Set(ids).size).toBe(4);
    for (const page of pages) {
      const response = await page.request.post('/api/rooms/snapshot', {
        headers: { origin: baseURL },
        data: { roomId },
      });
      expect(response.ok()).toBe(true);
      const snapshot = await response.json();
      expect(
        snapshot.members
          .map((member: { actorId: string }) => member.actorId)
          .sort(),
      ).toEqual([...ids].sort());
      expect(snapshot.members).toHaveLength(4);
      expect(snapshot.game).toBeNull();
      await page.getByRole('button', { name: 'Ready to play' }).click();
      await expect(page.locator('.ready-label.is-ready')).toHaveCount(
        pages.indexOf(page) + 1,
      );
    }
    await pages[0]!.getByRole('button', { name: /Start game/ }).click();
    await expect
      .poll(async () => {
        for (const page of pages)
          if (await page.getByRole('button', { name: 'Cut & deal' }).count())
            return true;
        return false;
      })
      .toBe(true);
    for (const page of pages)
      if (await page.getByRole('button', { name: 'Cut & deal' }).count()) {
        await page.getByRole('button', { name: 'Cut & deal' }).click();
        break;
      }
    await expect
      .poll(async () => {
        for (const page of pages)
          if (
            await page
              .getByRole('button', {
                name: /^Trump (clubs|hearts|diamonds|spades)$/,
              })
              .count()
          )
            return true;
        return false;
      })
      .toBe(true);
    for (const page of pages) {
      const choice = page.getByRole('button', {
        name: /^Trump (clubs|hearts|diamonds|spades)$/,
      });
      if (await choice.count()) {
        await choice.first().click();
        break;
      }
    }
    for (const page of pages) {
      await expect(page.getByTestId('hand-card')).toHaveCount(8);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
      ).toBe(true);
      await expect(page.locator('.hidden-hand .card-face')).toHaveCount(0);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { applyEvent } from '../src/game/reducer';
import type { AuthSession, ServerMessage, Snapshot } from '@omi/shared';

test.use({ trace: 'off' });

for (const mode of ['casual', 'ranked', 'casual-restart'] as const) {
  test(`full-interface ${mode} match ends in results and a fresh rematch`, async ({
    browser,
  }, info) => {
    test.skip(
      process.env.OMI_TEST_SEEDED_MATCH !== '1',
      'requires deterministic local fixture',
    );
    const restartDirectory = process.env.OMI_TEST_RESTART_DIR;
    test.skip(
      mode === 'casual-restart' && !restartDirectory,
      'requires a disposable SQLite restart directory',
    );
    test.setTimeout(360_000);
    const origin = String(info.project.use.baseURL);
    const contexts = await Promise.all(
      Array.from({ length: 4 }, () =>
        browser.newContext({
          baseURL: origin,
          viewport: { width: 390, height: 844 },
          reducedMotion: 'reduce',
        }),
      ),
    );
    const recentErrors: string[] = [];
    try {
      const pages = await Promise.all(
        contexts.map((context) => context.newPage()),
      );
      const views = new Map<Page, Snapshot>();
      for (const page of pages)
        page.on('websocket', (socket) => {
          if (!/\/api\/rooms\/[^/]+\/ws$/.test(socket.url())) return;
          socket.on('framereceived', ({ payload }) => {
            const message = JSON.parse(String(payload)) as ServerMessage;
            if (message.type === 'snapshot') views.set(page, message);
            else if (message.type === 'error') recentErrors.push(message.code);
            else if (message.type === 'event') {
              const previous = views.get(page);
              if (!previous) return;
              const next = applyEvent(previous, message);
              if (next) views.set(page, next);
            }
          });
        });
      const host = pages[0]!;
      for (const page of pages) {
        await page.goto('/');
        await page
          .getByRole('button', { name: 'Continue with Google' })
          .click();
        await expect(
          page.getByRole('button', { name: 'My profile' }),
        ).toBeVisible();
        if (mode === 'ranked') {
          await page
            .getByRole('button', { name: 'Play Online', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'Ranked Match', exact: true })
            .click();
          await page.getByRole('button', { name: 'Find players' }).click();
        }
      }
      if (mode !== 'ranked') {
        await host.getByRole('button', { name: /Create a table/ }).click();
        const code = (await host.locator('.invite-box strong').textContent())!;
        for (const page of pages.slice(1)) {
          await page.goto(`/?room=${code}`);
          await page.getByRole('button', { name: /Join table/ }).click();
          await expect(
            page.getByRole('heading', { name: 'Your table is ready.' }),
          ).toBeVisible();
        }
      }
      for (const page of pages)
        await expect(
          page.getByRole('heading', { name: 'Your table is ready.' }),
        ).toBeVisible();
      const sessions = await Promise.all(
        pages.map(async (page) => {
          const response = await page.request.post('/api/auth/session', {
            headers: { origin },
            data: {},
          });
          expect(response.ok()).toBe(true);
          return (await response.json()) as AuthSession;
        }),
      );
      const roomId = sessions[0]!.room!.roomId;
      expect(new Set(sessions.map((session) => session.room?.roomId))).toEqual(
        new Set([roomId]),
      );
      expect(new Set(sessions.map((session) => session.user?.id)).size).toBe(4);
      // Observe authorized game frames to choose deterministic cards without
      // flooding the read endpoint. All game actions use real browser controls.
      const snapshot = async (page: Page) => {
        const response = await page.request.post('/api/rooms/snapshot', {
          headers: { origin },
          data: { roomId },
        });
        expect(response.ok()).toBe(true);
        return (await response.json()) as Snapshot;
      };
      const seats: Page[] = [];
      for (const page of pages) {
        const view = await snapshot(page);
        seats[view.you.seat] = page;
        expect(view.you.team).toBe(view.you.seat % 2);
        await page.getByRole('button', { name: 'Ready to play' }).click();
      }
      await host.getByRole('button', { name: /Start game/ }).click();
      for (let hand = 0; hand < 24; hand++) {
        let cutting: Snapshot | undefined;
        await expect
          .poll(async () => {
            cutting = views.get(host);
            return cutting?.game?.phase;
          })
          .toBe('awaiting-cut');
        await seats[(cutting!.game!.dealer + 3) % 4]!.getByRole('button', {
          name: 'Cut & deal',
        }).click();
        const chooser = seats[cutting!.game!.selector]!;
        let choosing: Snapshot | undefined;
        await expect
          .poll(async () => {
            choosing = views.get(chooser);
            return choosing?.game?.phase;
          })
          .toBe('awaiting-trump');
        const selector = seats[choosing!.game!.selector]!;
        const suit = choosing!.game!.hand[0]!.suit;
        await selector
          .getByRole('button', { name: `Trump ${suit}`, exact: true })
          .click();

        for (let move = 0; move < 32; move++) {
          let activePage: Page | undefined;
          await expect
            .poll(
              () => {
                const game = views.get(host)?.game;
                if (
                  !game ||
                  game.phase !== 'playing' ||
                  game.turn === null ||
                  game.tricks.length * 4 + game.trick.length !== move
                )
                  return false;
                activePage = seats[game.turn];
                return (
                  activePage !== undefined &&
                  views.get(activePage)?.version === views.get(host)?.version
                );
              },
              {
                intervals: [10, 20, 50, 100],
                message: `Hand ${hand + 1}, card ${move + 1}`,
              },
            )
            .toBe(true);
          if (mode === 'casual-restart' && hand === 0 && move === 7) {
            const before = await Promise.all(pages.map(snapshot));
            await writeFile(join(restartDirectory!, 'restart'), 'restart\n', {
              flag: 'wx',
            });
            for (const page of pages)
              await expect(page.locator('.connection-banner')).toBeVisible();
            for (const page of pages)
              await expect(page.locator('.header-note')).toHaveText(
                'At the table',
                { timeout: 30_000 },
              );
            for (const [index, page] of pages.entries()) {
              const restored = await snapshot(page);
              expect(restored.you).toEqual(before[index]!.you);
              expect(restored.game!.hand).toEqual(before[index]!.game!.hand);
              expect(restored.game!.tricks).toEqual(
                before[index]!.game!.tricks,
              );
              expect(restored.game!.trick).toEqual(before[index]!.game!.trick);
              expect(restored.score).toEqual(before[index]!.score);
            }
          }

          const page = activePage!;
          const game = views.get(page)!.game!;
          const card =
            game.hand.find((held) => held.suit === game.trick[0]?.card.suit) ??
            game.hand[0]!;
          await page
            .getByRole('button', {
              name: `Select ${card.rank} of ${card.suit}`,
              exact: true,
            })
            .evaluate((element) => (element as HTMLButtonElement).click());
          const play = page.getByRole('button', {
            name: 'Play selected card',
            exact: true,
          });
          await expect(play).toBeEnabled();
          await play.evaluate((element) =>
            (element as HTMLButtonElement).click(),
          );
          await new Promise((resolve) => setTimeout(resolve, 140));
        }
        await expect.poll(() => views.get(host)?.game?.phase).toBe('complete');
        const settled = views.get(host)!;
        expect(settled.game!.tricks).toHaveLength(8);
        expect(settled.score.totals[0] + settled.score.totals[1]).toBe(20);
        if (settled.score.final) break;
        await expect(
          host.getByRole('heading', { name: 'Round complete.' }),
        ).toBeVisible();
        await host.getByRole('button', { name: /Next round/ }).click();
      }
      const resultHeading = { name: /Your team won!|The other team won!/ };
      for (const page of pages)
        await expect(page.getByRole('heading', resultHeading)).toBeVisible();
      const result = await snapshot(host);
      expect(result.game!.tricks).toHaveLength(8);
      expect(['loan_loss', 'inventory_depleted']).toContain(
        result.score.final?.reason,
      );
      expect(result.score.totals[0] + result.score.totals[1]).toBe(20);
      await host.screenshot({
        path: info.outputPath(`${mode}-full-interface-results.png`),
      });
      for (const page of pages) {
        const vote = page.getByRole('button', { name: 'Play again' });
        await expect(vote).toBeEnabled();
        await vote.click();
      }
      for (const page of pages)
        await expect(
          page.getByRole('heading', resultHeading),
        ).not.toBeVisible();
      const rematch = await snapshot(host);
      expect(rematch.game?.id).not.toBe(result.game?.id);
      expect(rematch.score.totals).toEqual([10, 10]);
      expect(rematch.score.final).toBeNull();
      if (mode !== 'ranked') {
        await host
          .getByRole('main')
          .getByRole('button', { name: 'Back', exact: true })
          .click();
        await host
          .getByRole('button', { name: 'Return home and keep my seat' })
          .click();
        await host.getByRole('button', { name: 'Manage saved table' }).click();
        const release = host.getByRole('button', {
          name: 'Leave match permanently',
        });
        await release.click();
        await expect(
          host.getByText(
            'A bot will take your seat. You cannot return to this match.',
          ),
        ).toBeVisible();
        await release.click();
        await expect(
          host.getByRole('region', { name: 'Your seat is saved.' }),
        ).toHaveCount(0);
        await host
          .getByRole('button', { name: 'Create Private Table' })
          .click();
        await host.getByRole('button', { name: /Create a table/ }).click();
        await expect(host.locator('.invite-box strong')).not.toHaveText(
          rematch.code,
        );
      }
    } catch (error) {
      if (recentErrors.length)
        throw new Error(recentErrors.join(', '), { cause: error });
      throw error;
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

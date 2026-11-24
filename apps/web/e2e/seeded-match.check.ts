import { expect, test, type Page } from '@playwright/test';
import type {
  AuthSession,
  ClientCommand,
  RoomDescriptor,
  Snapshot,
} from '@omi/shared';

type Intent = ClientCommand extends infer Command
  ? Command extends ClientCommand
    ? Pick<Command, 'type' | 'payload'>
    : never
  : never;
type Started = {
  socket: WebSocket;
  snapshots: Snapshot | null;
  response?: { actionId: string; type: string; code?: string };
};
declare global {
  interface Window {
    seededMatchDriver: Started;
  }
}

const identities = async (pages: Page[]) =>
  Promise.all(
    pages.map((page) =>
      page.evaluate(
        async () =>
          (
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).json() as Promise<AuthSession>,
      ),
    ),
  );
const view = (page: Page) =>
  page.evaluate(() => window.seededMatchDriver.snapshots!);

for (const mode of ['casual', 'ranked'] as const) {
  test(`seeded four authenticated browser clients finish a fresh ${mode} match and rematch`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    test.skip(
      process.env.OMI_TEST_SEEDED_MATCH !== '1',
      'requires an isolated deterministic fixture',
    );
    const contexts = await Promise.all(
      Array.from({ length: 4 }, () =>
        browser.newContext({
          baseURL: String(info.project.use.baseURL),
          viewport: { width: 390, height: 844 },
        }),
      ),
    );
    try {
      const pages = await Promise.all(
        contexts.map((context) => context.newPage()),
      );
      for (const page of pages) {
        await page.goto('/');
        await page
          .getByRole('button', { name: 'Continue with Google' })
          .click();
        await expect(
          page.getByRole('button', { name: 'My profile' }),
        ).toBeVisible();
      }
      const sessions = await identities(pages);
      const host = pages[0]!;
      let room: RoomDescriptor;
      if (mode === 'ranked') {
        for (const page of pages) {
          await page
            .getByRole('button', { name: 'Play Online', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'Ranked Match', exact: true })
            .click();
          await page.getByRole('button', { name: 'Find players' }).click();
        }
        for (const page of pages) {
          await expect(
            page.getByText('RANKED TABLE', { exact: true }),
          ).toBeVisible();
        }
        const queuedSessions = await identities(pages);
        room = queuedSessions[0]!.room!;
        expect(
          new Set(queuedSessions.map((session) => session.room?.roomId)),
        ).toEqual(new Set([room.roomId]));
      } else {
        const create = await host.request.post('/api/rooms', {
          headers: { origin: String(info.project.use.baseURL) },
          data: {
            actorId: sessions[0]!.user!.id,
            expectedVersion: 0,
            actionId: crypto.randomUUID(),
          },
        });
        expect(create.status()).toBe(201);
        room = (await create.json()) as RoomDescriptor;
      }
      for (const [i, page] of pages.entries()) {
        if (mode === 'casual' && i > 0) {
          const headers = { origin: String(info.project.use.baseURL) };
          const preview = await page.request.post('/api/rooms/preview', {
            headers,
            data: { code: room.code },
          });
          const { version } = (await preview.json()) as RoomDescriptor;
          const joined = await page.request.post('/api/rooms/join', {
            headers,
            data: {
              actorId: sessions[i]!.user!.id,
              roomId: room.roomId,
              code: room.code,
              expectedVersion: version,
              actionId: crypto.randomUUID(),
            },
          });
          expect(joined.status()).toBe(200);
        }
        await page.evaluate((id) => {
          const socket = new WebSocket(
            `${location.origin.replace(/^http/, 'ws')}/api/rooms/${id}/ws`,
          );
          const entry: Started = { socket, snapshots: null };
          window.seededMatchDriver = entry;
          socket.addEventListener('message', ({ data }) => {
            const packet = JSON.parse(data);
            if (packet.type === 'snapshot') entry.snapshots = packet;
            if (packet.type === 'ack' || packet.type === 'error')
              entry.response = packet;
          });
        }, room.roomId);
        await page.waitForFunction(() => !!window.seededMatchDriver.snapshots);
      }

      const command = async (index: number, intent: Intent) => {
        const page = pages[index]!;
        const round = await page.evaluate(async (action) => {
          const entry = window.seededMatchDriver;
          const exchange = (request: Intent) =>
            new Promise<Snapshot>((resolve, reject) => {
              const actionId = crypto.randomUUID();
              const snapshot = entry.snapshots!;
              const handler = ({ data }: MessageEvent<string>) => {
                const result = JSON.parse(data);
                if (result.actionId === actionId && result.type === 'error') {
                  entry.socket.removeEventListener('message', handler);
                  reject(new Error(result.code));
                }
                if (
                  (result.actionId === actionId && result.type === 'ack') ||
                  (result.requestId === actionId && result.type === 'snapshot')
                ) {
                  entry.socket.removeEventListener('message', handler);
                  resolve(
                    result.type === 'snapshot'
                      ? result
                      : { ...snapshot, version: result.version },
                  );
                }
              };
              entry.socket.addEventListener('message', handler);
              entry.socket.send(
                JSON.stringify({
                  ...request,
                  roomId: snapshot.roomId,
                  actorId: snapshot.you.actorId,
                  expectedVersion: snapshot.version,
                  actionId,
                }),
              );
            });
          if (action.type === 'sync') return exchange(action);
          await exchange({ type: 'sync', payload: {} });
          await exchange(action);
          return exchange({ type: 'sync', payload: {} });
        }, intent);
        return round;
      };

      for (let seat = 0; seat < 4; seat++) {
        expect((await view(pages[seat]!)).you).toMatchObject({
          seat,
          team: seat % 2,
        });
        expect(
          (await command(seat, { type: 'sync', payload: {} })).members
            .map((member) => member.actorId)
            .sort(),
        ).toEqual(sessions.map((session) => session.user!.id).sort());
        await command(seat, { type: 'ready', payload: { ready: true } });
      }
      let current = await command(0, { type: 'start', payload: {} });
      for (let hand = 0; hand < 9; hand++) {
        const cut = await command((current.game!.dealer + 3) % 4, {
          type: 'cut',
          payload: { offset: 16 },
        });
        const selector = cut.game!.selector;
        const selectorHand = await command(selector, {
          type: 'sync',
          payload: {},
        });
        current = await command(selector, {
          type: 'trump',
          payload: { suit: selectorHand.game!.hand[0]!.suit },
        });
        for (let play = 0; play < 32; play++) {
          const actor = current.game!.turn!;
          const personal = await command(actor, { type: 'sync', payload: {} });
          const { hand, trick } = personal.game!;
          await pages[actor]!.waitForTimeout(220);
          current = await command(actor, {
            type: 'play',
            payload: {
              card:
                hand.find((card) => card.suit === trick[0]?.card.suit) ??
                hand[0]!,
            },
          });
        }
        expect(current.game!.tricks).toHaveLength(8);
        expect(current.score.totals[0] + current.score.totals[1]).toBe(20);
        if (hand < 8)
          current = await command(0, { type: 'next-round', payload: {} });
      }
      expect(current.score.final?.reason).toBe('loan_loss');
      const previousRound = current.game!.id;
      // Use the normal game UI for the terminal result and all four rematch votes.
      for (const page of pages) {
        if (mode === 'casual') {
          await page.goto('/');
          await page.getByRole('button', { name: 'View results' }).click();
        } else {
          await page
            .getByRole('button', { name: 'Reconnect', exact: true })
            .click();
        }
        await expect(
          page.getByRole('heading', {
            name: /Your team won!|The other team won!/,
          }),
        ).toBeVisible();
      }
      await host.screenshot({
        path: info.outputPath(`${mode}-results.png`),
        fullPage: true,
      });
      for (const page of pages)
        await page.getByRole('button', { name: 'Play again' }).click();
      for (const page of pages)
        await expect(
          page.getByRole('heading', {
            name: /Your team won!|The other team won!/,
          }),
        ).not.toBeVisible();

      const after = await host.request.post('/api/rooms/snapshot', {
        headers: { origin: String(info.project.use.baseURL) },
        data: { roomId: room.roomId },
      });
      expect(after.ok()).toBe(true);
      const restarted = (await after.json()) as Snapshot;
      expect(restarted.game?.id).not.toBe(previousRound);
      expect(restarted.score.totals).toEqual([10, 10]);
      expect(restarted.score.final).toBeNull();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}

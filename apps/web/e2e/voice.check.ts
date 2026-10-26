import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
test('four real peer connections carry audio, mute, recover and stop without playing a card', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({
        baseURL: String(testInfo.project.use.baseURL),
        viewport: { width: 390, height: 844 },
      });
      contexts.push(context);
      if (browser.browserType().name() === 'chromium')
        await context.grantPermissions(['microphone']);
      // Instrument real browser objects; do not stub media, ICE, SDP or statistics.
      await context.addInitScript(() => {
        const OriginalContext = window.AudioContext;
        const contexts: AudioContext[] = [];
        Object.assign(window, { __voiceAudioContexts: contexts });
        window.AudioContext = class extends OriginalContext {
          constructor(options?: AudioContextOptions) {
            super(options);
            contexts.push(this);
          }
        };
        const Original = window.RTCPeerConnection;
        const peers: RTCPeerConnection[] = [];
        const streams: MediaStream[] = [];
        const events: { index: number; event: string; error?: string }[] = [];
        Object.assign(window, { __voiceEvents: events });
        Object.assign(window, { __voicePeers: peers, __voiceStreams: streams });
        window.RTCPeerConnection = class extends Original {
          constructor(config?: RTCConfiguration) {
            super(config);
            peers.push(this);
            const index = peers.length - 1;
            for (const type of [
              'negotiationneeded',
              'signalingstatechange',
              'icegatheringstatechange',
            ])
              this.addEventListener(type, () =>
                events.push({ index, event: type }),
              );
          }
          async setLocalDescription(
            description?: RTCLocalSessionDescriptionInit,
          ) {
            events.push({
              index: peers.indexOf(this),
              event: 'local-description',
            });
            try {
              await super.setLocalDescription(description);
            } catch (error) {
              events.push({
                index: peers.indexOf(this),
                event: 'local-error',
                error: error instanceof Error ? error.name : 'unknown',
              });
              throw error;
            }
          }
          async setRemoteDescription(description: RTCSessionDescriptionInit) {
            events.push({
              index: peers.indexOf(this),
              event: 'remote-description',
            });
            try {
              await super.setRemoteDescription(description);
            } catch (error) {
              events.push({
                index: peers.indexOf(this),
                event: 'remote-error',
                error: error instanceof Error ? error.name : 'unknown',
              });
              throw error;
            }
          }
        };
        if (!navigator.mediaDevices) return;
        const capture = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const stream = await capture(constraints);
          streams.push(stream);
          return stream;
        };
      });
      pages.push(await context.newPage());
    }
    await pages[0]!.goto('/');
    await pages[0]!.getByLabel('Your name').fill('Voice host');
    await pages[0]!.getByRole('button', { name: /Create a table/ }).click();
    const code = (await pages[0]!.locator('.invite-box strong').textContent())!;
    for (let i = 1; i < 4; i++) {
      await pages[i]!.goto(`/?room=${code}`);
      await pages[i]!.getByLabel('Your name').fill(`Voice player ${i}`);
      await pages[i]!.getByRole('button', { name: /Join table/ }).click();
    }
    for (const page of pages) {
      await expect(
        page.getByRole('region', { name: 'Room voice' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __voiceStreams: MediaStream[] })
              .__voiceStreams.length,
        ),
      ).toBe(0);
    }
    for (const page of pages) {
      await page.bringToFront();
      await page
        .getByRole('button', { name: 'Join voice', exact: true })
        .click();
      await expect(
        page.getByRole('region', { name: 'Room voice' }).getByRole('status'),
      ).toHaveText('Voice connected');
    }
    for (const page of pages) {
      await expect(
        page.locator('[data-voice-peer][data-connection="connected"]'),
      ).toHaveCount(3, { timeout: 25_000 });
      await expect
        .poll(
          async () =>
            page.evaluate(async () => {
              const peers = (
                window as unknown as { __voicePeers: RTCPeerConnection[] }
              ).__voicePeers.filter(
                (peer) => peer.connectionState === 'connected',
              );
              let receiving = 0;
              for (const peer of peers) {
                const stats = await peer.getStats();
                if (
                  [...stats.values()].some(
                    (item: {
                      type: string;
                      kind?: string;
                      bytesReceived?: number;
                    }) =>
                      item.type === 'inbound-rtp' &&
                      item.kind === 'audio' &&
                      (item.bytesReceived ?? 0) > 0,
                  )
                )
                  receiving++;
              }
              return receiving;
            }),
          { timeout: 20_000 },
        )
        .toBe(3);
    }
    if (testInfo.project.name.includes('relay')) {
      for (const page of pages) {
        expect(
          await page.evaluate(async () => {
            const peers = (
              window as unknown as { __voicePeers: RTCPeerConnection[] }
            ).__voicePeers.filter((pc) => pc.connectionState === 'connected');
            for (const pc of peers) {
              const stats = await pc.getStats();
              const pair = [...stats.values()].find(
                (item: { type: string; state?: string; nominated?: boolean }) =>
                  item.type === 'candidate-pair' &&
                  item.state === 'succeeded' &&
                  item.nominated,
              );
              if (
                !pair ||
                stats.get(pair.localCandidateId)?.candidateType !== 'relay'
              )
                return false;
            }
            return peers.length === 3;
          }),
        ).toBe(true);
      }
    }
    await expect
      .poll(() => pages[0]!.locator('.voice-indicator.speaking').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    for (const page of pages) {
      await page.bringToFront();
      const audible = new Set<string>();
      await expect
        .poll(
          async () => {
            for (const id of await page
              .locator('[data-voice-peer]:has(.voice-indicator.speaking)')
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute('data-voice-peer')!),
              ))
              audible.add(id);
            return audible.size;
          },
          { timeout: 15_000 },
        )
        .toBe(3);
    }
    await pages[0]!.setViewportSize({ width: 320, height: 568 });
    expect(
      await pages[0]!.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await pages[0]!.screenshot({
      path: testInfo.outputPath('voice-320.png'),
      fullPage: true,
    });
    await pages[0]!
      .getByRole('button', { name: 'Mute microphone', exact: true })
      .click();
    expect(
      await pages[0]!.evaluate(() =>
        (window as unknown as { __voiceStreams: MediaStream[] }).__voiceStreams
          .at(-1)!
          .getAudioTracks()
          .every((track) => !track.enabled),
      ),
    ).toBe(true);
    await expect(
      pages[1]!.locator('[data-voice-peer]').filter({ hasText: 'Voice host' }),
    ).toContainText('Muted');
    await pages[1]!
      .getByRole('slider', { name: 'Volume for Voice host' })
      .fill('0.25');
    await expect(
      pages[1]!.getByRole('slider', { name: 'Volume for Voice host' }),
    ).toHaveValue('0.25');
    const social = pages[1]!.locator('.social-panel > details');
    await social.locator('> summary').click();
    await pages[1]!.locator('.social-settings > summary').click();
    const block = pages[1]!.getByLabel(
      'Block incoming chat, reactions and voice from Voice host',
    );
    await block.check();
    await expect(
      pages[1]!.getByRole('slider', { name: 'Volume for Voice host' }),
    ).toBeDisabled();
    await expect(
      pages[1]!.getByRole('slider', { name: 'Volume for Voice host' }),
    ).toHaveValue('0');
    await expect(
      pages[1]!.locator('[data-voice-peer][data-connection="connected"]'),
    ).toHaveCount(3);
    await block.uncheck();
    await expect(
      pages[1]!.getByRole('slider', { name: 'Volume for Voice host' }),
    ).toHaveValue('0.25');
    await social.locator('> summary').click();
    await pages[0]!
      .getByRole('button', { name: 'Unmute microphone', exact: true })
      .click();
    await contexts[2]!.setOffline(true);
    await expect(pages[2]!.locator('.header-note')).toHaveText('Disconnected');
    await expect
      .poll(() =>
        pages[2]!.evaluate(() =>
          (
            window as unknown as { __voiceStreams: MediaStream[] }
          ).__voiceStreams.every((stream) =>
            stream.getTracks().every((track) => track.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true);
    await contexts[2]!.setOffline(false);
    for (const page of pages)
      await expect(
        page.locator('[data-voice-peer][data-connection="connected"]'),
      ).toHaveCount(3, { timeout: 25_000 });
    for (const page of pages)
      await page
        .getByRole('button', { name: 'Leave voice', exact: true })
        .click();
    for (const page of pages) {
      await expect(
        page.getByRole('button', { name: 'Join voice', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          (
            window as unknown as { __voiceStreams: MediaStream[] }
          ).__voiceStreams.every((stream) =>
            stream.getTracks().every((track) => track.readyState === 'ended'),
          ),
        ),
      ).toBe(true);
      await expect(page.locator('.lobby-seat:not(.empty)')).toHaveCount(4);
    }
  } finally {
    {
      const diagnostics = await Promise.all(
        pages.map(async (page) => {
          try {
            return await page.evaluate(async () => ({
              events: (window as unknown as { __voiceEvents: unknown[] })
                .__voiceEvents,
              contexts: (
                window as unknown as { __voiceAudioContexts: AudioContext[] }
              ).__voiceAudioContexts.map((ctx) => ({
                state: ctx.state,
                time: ctx.currentTime,
              })),
              voiceText: document.querySelector('.voice-panel')?.textContent,
              streams: (
                window as unknown as { __voiceStreams: MediaStream[] }
              ).__voiceStreams.map((stream) =>
                stream.getTracks().map((track) => ({
                  kind: track.kind,
                  state: track.readyState,
                })),
              ),
              audioStats: await Promise.all(
                (
                  window as unknown as { __voicePeers: RTCPeerConnection[] }
                ).__voicePeers.map(async (pc) =>
                  [...(await pc.getStats()).values()]
                    .filter(
                      (item: { type: string }) =>
                        item.type === 'inbound-rtp' ||
                        item.type === 'outbound-rtp',
                    )
                    .map(
                      (item: {
                        type: string;
                        bytesReceived?: number;
                        bytesSent?: number;
                        totalAudioEnergy?: number;
                        audioLevel?: number;
                        totalSamplesDuration?: number;
                      }) => ({
                        type: item.type,
                        bytesReceived: item.bytesReceived,
                        bytesSent: item.bytesSent,
                        totalAudioEnergy: item.totalAudioEnergy,
                        audioLevel: item.audioLevel,
                        totalSamplesDuration: item.totalSamplesDuration,
                      }),
                    ),
                ),
              ),
              connections: (
                window as unknown as { __voicePeers: RTCPeerConnection[] }
              ).__voicePeers.map((pc) => ({
                connection: pc.connectionState,
                signaling: pc.signalingState,
                ice: pc.iceConnectionState,
              })),
            }));
          } catch {
            return { closed: true };
          }
        }),
      );
      await testInfo.attach('voice-state', {
        body: JSON.stringify(diagnostics),
        contentType: 'application/json',
      });
    }
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('account logout stops microphone capture and voice without losing the home', async ({
  page,
  context,
  browser,
}) => {
  if (browser.browserType().name() === 'chromium')
    await context.grantPermissions(['microphone']);
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    Object.assign(window, { __logoutStreams: streams });
    if (!navigator.mediaDevices) return;
    const capture = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: 'My profile' })).toBeVisible();
  await page.getByRole('button', { name: /Create a table/ }).click();
  await page.getByRole('button', { name: 'Join voice', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Room voice' }).getByRole('status'),
  ).toHaveText('Voice connected');
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __logoutStreams: MediaStream[] })
          .__logoutStreams.length,
    ),
  ).toBe(1);
  await page.getByRole('button', { name: 'My profile' }).click();
  await page
    .getByRole('dialog', { name: 'Your profile' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(
    page.getByRole('heading', { name: /Four friends/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { __logoutStreams: MediaStream[] }
      ).__logoutStreams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === 'ended'),
      ),
    ),
  ).toBe(true);
});

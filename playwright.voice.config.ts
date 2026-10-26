import config from './playwright.nginx.config';
import { defineConfig } from '@playwright/test';
import { syntheticAudioPath } from './infra/tests/audio-source.mjs';
export default defineConfig({
  ...config,
  testMatch: '**/voice.check.ts',
  outputDir: './.remote-testing/voice-results',
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${syntheticAudioPath}`,
            '--autoplay-policy=no-user-gesture-required',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'media.autoplay.default': 0,
            'media.peerconnection.ice.loopback': true,
            'media.peerconnection.ice.obfuscate_host_addresses': false,
          },
        },
      },
    },
  ],
});

import config from './playwright.voice.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...config,
  outputDir: './.remote-testing/voice-relay-results',
  projects: (config.projects ?? []).map((project) => ({
    ...project,
    name: `${project.name}-relay`,
  })),
  webServer: {
    command: 'node infra/tests/serve-voice-relay.mjs',
    url: 'http://127.0.0.1:8082/api/health',
    reuseExistingServer: false,
  },
});

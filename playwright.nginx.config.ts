import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: [
    '**/game.spec.ts',
    '**/profile.spec.ts',
    '**/shell.spec.ts',
    '**/nginx.check.ts',
    '**/sound.spec.ts',
  ],
  workers: 2,
  outputDir: './.remote-testing/browser-results',
  use: { baseURL: 'http://127.0.0.1:8082', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    command: 'node infra/tests/serve-nginx.mjs',
    url: 'http://127.0.0.1:8082/api/health',
    reuseExistingServer: false,
  },
});

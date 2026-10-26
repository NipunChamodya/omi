import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/production.check.ts',
  use: { baseURL: 'http://127.0.0.1:5175' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    command: 'npm run preview -w @omi/web -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
});

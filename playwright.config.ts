import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:e2e -w @omi/server',
      url: 'http://127.0.0.1:3100/health',
      env: {
        HOST: '127.0.0.1',
        PORT: '3100',
        APP_ORIGIN: 'http://127.0.0.1:5173',
        NODE_ENV: 'test',
        ALLOW_GUESTS: 'true',
        DATABASE_PATH: ':memory:',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:web -- --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3100' },
      reuseExistingServer: false,
    },
  ],
  reporter: 'list',
});

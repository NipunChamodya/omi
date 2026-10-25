import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -w @omi/web -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});

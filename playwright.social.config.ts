import config from './playwright.nginx.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...config,
  testMatch: '**/social.check.ts',
  workers: 1,
  outputDir: './.remote-testing/social-results',
});

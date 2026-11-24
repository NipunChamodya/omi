import config from './playwright.nginx.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...config,
  testMatch: '**/seeded-match.check.ts',
  workers: 1,
  outputDir: './.remote-testing/seeded-match-results',
});

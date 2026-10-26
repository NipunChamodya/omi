import { defineConfig } from '@playwright/test';
import production from './playwright.production.config';
export default defineConfig(production, {
  testMatch: '**/pwa.check.ts',
  workers: 1,
  outputDir: '.remote-testing/pwa-results',
});

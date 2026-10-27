import { defineConfig } from '@playwright/test';
import base from './playwright.nginx.config';
export default defineConfig({
  ...base,
  testMatch: '**/remaining.check.ts',
  workers: 1,
  outputDir: './.remote-testing/remaining-results',
});

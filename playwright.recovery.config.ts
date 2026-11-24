import config from './playwright.nginx.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...config,
  testMatch: '**/restart.check.ts',
  workers: 1,
});

import config from './playwright.nginx.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...config,
  testMatch: [
    '**/adventure.check.ts',
    '**/game.spec.ts',
    '**/profile.spec.ts',
    '**/shell.spec.ts',
  ],
});

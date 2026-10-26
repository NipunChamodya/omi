import { expect, it } from 'vitest';
import { contentSecurityPolicy } from './security';
it('permits nonced Vite scripts/styles and explicit local HMR only in development', () => {
  const policy = contentSecurityPolicy(true, 'test-nonce');
  expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
  expect(policy).toContain("style-src 'self' 'nonce-test-nonce'");
  expect(policy).toContain('ws://127.0.0.1:5173');
  expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
});
it('keeps production scripts and styles same-origin without tooling exceptions', () => {
  const policy = contentSecurityPolicy(
    false,
    'unused',
    'https://api.omi.example/api',
  );
  expect(policy).toContain("script-src 'self';");
  expect(policy).toContain("style-src 'self';");
  expect(policy).toContain('https://api.omi.example wss://api.omi.example');
  expect(policy).not.toMatch(/nonce-|localhost|127\.0\.0\.1|unsafe-|\*/);
  expect(() =>
    contentSecurityPolicy(false, '', 'http://api.omi.example'),
  ).toThrow();
});

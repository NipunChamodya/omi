import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { parseConfig } from './config.js';
const app = buildApp();
afterAll(async () => {
  await app.close();
});
describe('foundation API', () => {
  it('returns the public health contract without infrastructure details', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'omi-server' });
  });
  it('requires a transport session before room creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { origin: 'http://127.0.0.1:5173' },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('SESSION_REQUIRED');
  });
});
it('validates environment configuration and supplies safe local defaults', () => {
  expect(parseConfig({})).toEqual({
    HOST: '127.0.0.1',
    PORT: 3000,
    APP_ORIGIN: 'http://127.0.0.1:5173',
    NODE_ENV: 'development',
  });
  for (const PORT of ['0', '65536', 'abc', '1.5'])
    expect(() => parseConfig({ PORT })).toThrow();
  expect(() => parseConfig({ NODE_ENV: 'invalid' })).toThrow();
});

it('rejects invalid origins and insecure production configuration', () => {
  for (const APP_ORIGIN of [
    'https://example.com/path',
    'null',
    'file:///tmp',
    'http://example.com/',
  ])
    expect(() => parseConfig({ APP_ORIGIN })).toThrow();
  expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow();
  expect(
    parseConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://omi.example' })
      .APP_ORIGIN,
  ).toBe('https://omi.example');
});

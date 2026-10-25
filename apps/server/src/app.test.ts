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
  it('returns 404 for routes not implemented in Stage A', async () => {
    const response = await app.inject({ method: 'POST', url: '/rooms' });
    expect(response.statusCode).toBe(404);
  });
});
it('validates environment configuration and supplies safe local defaults', () => {
  expect(parseConfig({})).toEqual({
    HOST: '127.0.0.1',
    PORT: 3000,
    NODE_ENV: 'development',
  });
  for (const PORT of ['0', '65536', 'abc', '1.5'])
    expect(() => parseConfig({ PORT })).toThrow();
  expect(() => parseConfig({ NODE_ENV: 'invalid' })).toThrow();
});

/** Explicit Playwright fixture process, never the production entry point. */
import { buildApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { GoogleOidc } from '../src/auth/oidc.js';
import { mockOidc, mockS3 } from './provider.js';
const provider = await mockOidc();
const storage = await mockS3();
process.env.AWS_ACCESS_KEY_ID = 'fixture-key';
process.env.AWS_SECRET_ACCESS_KEY = 'fixture-secret';
const callback = 'http://127.0.0.1:5173/api/auth/google/callback';
const app = buildApp({
  logger: false,
  config: parseConfig({
    NODE_ENV: 'test',
    PORT: '3100',
    APP_ORIGIN: 'http://127.0.0.1:5173',
    DATABASE_PATH: ':memory:',
    ALLOW_GUESTS: 'true',
    GOOGLE_CLIENT_ID: 'mock-client',
    GOOGLE_CLIENT_SECRET: 'mock-secret',
    GOOGLE_CALLBACK_URL: callback,
    AVATAR_BUCKET: 'avatars',
    AVATAR_REGION: 'us-east-1',
    AVATAR_ENDPOINT: storage.url,
  }),
  accounts: {
    provider: new GoogleOidc(
      'mock-client',
      'mock-secret',
      callback,
      new URL(provider.url),
      true,
    ),
  },
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void (async () => {
      await app.close();
      await provider.app.close();
      await storage.app.close();
    })();
  });
await app.listen({ host: '127.0.0.1', port: 3100 });

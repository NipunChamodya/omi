import Fastify from 'fastify';
import type { HealthResponse } from '@omi/shared';
import { parseConfig } from './config.js';
import { registerMultiplayer } from './multiplayer/routes.js';
import { Accounts } from './auth/accounts.js';
import { GoogleOidc } from './auth/oidc.js';
import type { IdentityProvider } from './auth/oidc.js';
import { SqliteAccounts } from './persistence/repository.js';
import type { AccountRepository } from './persistence/repository.js';
import { S3Avatars } from './avatars/storage.js';
import type { AvatarStorage } from './avatars/storage.js';
import type { MultiplayerOptions } from './multiplayer/routes.js';
export type AppOptions = {
  config?: ReturnType<typeof parseConfig>;
  logger?: boolean;
  accounts?: {
    repository?: AccountRepository;
    provider?: IdentityProvider | null;
    storage?: AvatarStorage | null;
  };
  multiplayer?: Omit<
    MultiplayerOptions,
    'origin' | 'secureCookies' | 'accounts' | 'allowGuests'
  >;
};
export function buildApp(options: AppOptions = {}) {
  const config = options.config ?? parseConfig({});
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            serializers: {
              req: (request: { method?: string; url?: string }) => ({
                method: request.method ?? '',
                url: (request.url ?? '').split('?')[0] ?? '',
              }),
            },
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers.set-cookie',
            ],
          },
    bodyLimit: 16_384,
    requestTimeout: 30_000,
  });
  const repository =
    options.accounts?.repository ?? new SqliteAccounts(config.DATABASE_PATH);
  const provider =
    options.accounts?.provider !== undefined
      ? options.accounts.provider
      : config.GOOGLE_CLIENT_ID &&
          config.GOOGLE_CLIENT_SECRET &&
          config.GOOGLE_CALLBACK_URL
        ? new GoogleOidc(
            config.GOOGLE_CLIENT_ID,
            config.GOOGLE_CLIENT_SECRET,
            config.GOOGLE_CALLBACK_URL,
          )
        : null;
  const storage =
    options.accounts?.storage !== undefined
      ? options.accounts.storage
      : config.AVATAR_BUCKET
        ? new S3Avatars(
            config.AVATAR_BUCKET,
            config.AVATAR_REGION,
            config.AVATAR_ENDPOINT,
          )
        : null;
  const accounts = new Accounts(
    repository,
    provider,
    storage,
    config.GOOGLE_CALLBACK_URL ?? 'http://127.0.0.1:3000/auth/google/callback',
    options.multiplayer?.now,
  );
  app.addHook('onClose', async () => accounts.close());
  app.register(async (api) => {
    await registerMultiplayer(api, {
      ...options.multiplayer,
      accounts,
      allowGuests: config.ALLOW_GUESTS,
      origin: config.APP_ORIGIN,
      secureCookies: config.NODE_ENV === 'production',
    });
  });
  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'omi-server',
  }));
  return app;
}

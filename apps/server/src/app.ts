import Fastify from 'fastify';
import { safeLogPath, registerRuntimeMonitoring } from './ops/runtime.js';
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
    'origin' | 'secureCookies' | 'accounts' | 'allowGuests' | 'ice'
  >;
};
export function buildApp(options: AppOptions = {}) {
  const config = options.config ?? parseConfig({});
  const app = Fastify({
    trustProxy: config.TRUST_LOCAL_PROXY
      ? (address, hop) =>
          hop === 0 &&
          (address === '127.0.0.1' || address === '::ffff:127.0.0.1')
      : false,
    logger:
      options.logger === false
        ? false
        : {
            serializers: {
              path: safeLogPath,
              req: (request: { method?: string; url?: string }) => ({
                method: request.method ?? '',
                url: safeLogPath(request.url),
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
    keepAliveTimeout: 5_000,
    maxRequestsPerSocket: 1000,
  });
  app.server.headersTimeout = 15_000;
  app.addHook('onRequest', async (_request, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'no-store')
      .header(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'",
      )
      .header('Referrer-Policy', 'no-referrer');
    if (config.NODE_ENV === 'production')
      reply.header('Strict-Transport-Security', 'max-age=86400');
  });
  if (config.NODE_ENV === 'production' && options.logger !== false)
    registerRuntimeMonitoring(app);
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
      ice: config,
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

import Fastify from 'fastify';
import type { HealthResponse } from '@omi/shared';
import { parseConfig } from './config.js';
import { registerMultiplayer } from './multiplayer/routes.js';
import type { MultiplayerOptions } from './multiplayer/routes.js';
export type AppOptions = {
  config?: ReturnType<typeof parseConfig>;
  logger?: boolean;
  multiplayer?: Omit<MultiplayerOptions, 'origin' | 'secureCookies'>;
};
export function buildApp(options: AppOptions = {}) {
  const config = options.config ?? parseConfig({});
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers.set-cookie',
            ],
          },
    bodyLimit: 16_384,
    requestTimeout: 10_000,
  });
  app.register(async (api) => {
    await registerMultiplayer(api, {
      ...options.multiplayer,
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

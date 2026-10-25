import Fastify from 'fastify';
import type { HealthResponse } from '@omi/shared';
export function buildApp() {
  const app = Fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
    bodyLimit: 16_384,
    requestTimeout: 10_000,
  });
  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'omi-server',
  }));
  return app;
}

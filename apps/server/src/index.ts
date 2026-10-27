import 'dotenv/config';
import { supportedNode22, NODE_SECURITY_BASELINE } from './ops/node.js';
import { buildApp } from './app.js';
import { parseConfig } from './config.js';
const config = parseConfig(process.env);
if (config.NODE_ENV === 'production' && !supportedNode22(process.versions.node))
  throw new Error(
    `Production requires Node ${NODE_SECURITY_BASELINE} or a newer patched Node 22 release`,
  );
const app = buildApp({ config });
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    app.log.info({ event: 'shutdown_started' }, 'Stopping OMI');
    const deadline = setTimeout(() => {
      app.log.error(
        { event: 'shutdown_timeout' },
        'Shutdown deadline exceeded',
      );
      process.exit(1);
    }, 35_000);
    deadline.unref();
    void app
      .close()
      .then(() => clearTimeout(deadline))
      .catch(() => {
        app.log.error({ event: 'shutdown_failed' }, 'Shutdown failed');
        process.exitCode = 1;
      });
  });
}
try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(
    {
      event: 'listen_failed',
      code: error instanceof Error && 'code' in error ? error.code : 'UNKNOWN',
    },
    'Server could not start',
  );
  await app.close();
  process.exitCode = 1;
}

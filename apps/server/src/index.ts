import 'dotenv/config';
import { buildApp } from './app.js';
import { parseConfig } from './config.js';
const config = parseConfig(process.env);
const app = buildApp();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

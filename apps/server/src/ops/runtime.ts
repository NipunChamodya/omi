import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { FastifyInstance } from 'fastify';
export function safeLogPath(value: unknown): string {
  return typeof value === 'string' ? value.split(/[?#]/)[0]!.slice(0, 256) : '';
}
/** Private aggregate logs only: no public metrics endpoint or per-user labels. */
export function registerRuntimeMonitoring(
  app: FastifyInstance,
  intervalMs = 60_000,
) {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  let requests = 0,
    failures = 0,
    totalMs = 0,
    maxMs = 0;
  delay.enable();
  app.addHook('onResponse', async (_request, reply) => {
    requests++;
    if (reply.statusCode >= 500) failures++;
    totalMs += reply.elapsedTime;
    maxMs = Math.max(maxMs, reply.elapsedTime);
  });
  const timer = setInterval(() => {
    const memory = process.memoryUsage();
    app.log.info(
      {
        event: 'runtime_health',
        requests,
        failures,
        meanResponseMs: requests ? Math.round(totalMs / requests) : 0,
        maxResponseMs: Math.round(maxMs),
        rssBytes: memory.rss,
        heapBytes: memory.heapUsed,
        eventLoopP99Ms: Math.round(delay.percentile(99) / 1e6),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      'Runtime health',
    );
    requests = failures = totalMs = maxMs = 0;
    delay.reset();
  }, intervalMs);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    delay.disable();
  });
}

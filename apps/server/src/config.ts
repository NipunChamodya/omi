import { z } from 'zod';
const schema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});
export function parseConfig(env: Record<string, string | undefined>) {
  return schema.parse(env);
}

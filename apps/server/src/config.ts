import { z } from 'zod';
const schema = z
  .object({
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z
      .url()
      .refine(
        (value) => new URL(value).origin === value,
        'Must be an exact HTTP(S) origin',
      )
      .refine((value) => /^https?:/.test(value), 'HTTP(S) required')
      .default('http://127.0.0.1:5173'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .refine(
    (config) =>
      config.NODE_ENV !== 'production' ||
      config.APP_ORIGIN.startsWith('https://'),
    { message: 'Production APP_ORIGIN must use HTTPS', path: ['APP_ORIGIN'] },
  );
export function parseConfig(env: Record<string, string | undefined>) {
  return schema.parse(env);
}

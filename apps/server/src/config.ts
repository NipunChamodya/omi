import { z } from 'zod';
import { voiceFields } from './voice/config.js';
const schema = z
  .object({
    ...voiceFields,
    HOST: z.string().min(1).default('127.0.0.1'),
    TRUST_LOCAL_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z
      .url()
      .refine(
        (value) => new URL(value).origin === value,
        'Must be an exact HTTP(S) origin',
      )
      .refine((value) => /^https?:/.test(value), 'HTTP(S) required')
      .default('http://127.0.0.1:5173'),
    DATABASE_PATH: z.string().min(1).default('./data/omi.sqlite'),
    ALLOW_GUESTS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_CALLBACK_URL: z.url().optional(),
    AVATAR_BUCKET: z.string().min(1).optional(),
    AVATAR_REGION: z.string().min(1).default('us-east-1'),
    AVATAR_ENDPOINT: z.url().optional(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .refine(
    (config) =>
      Boolean(config.VOICE_TURN_SECRET) === config.VOICE_TURN_URLS.length > 0,
    { message: 'Configure TURN URLs and shared secret together' },
  )
  .refine(
    (config) =>
      config.VOICE_ICE_POLICY !== 'relay' || config.VOICE_TURN_URLS.length > 0,
    { message: 'Relay-only voice requires TURN configuration' },
  )
  .refine(
    (config) => !config.TRUST_LOCAL_PROXY || config.HOST === '127.0.0.1',
    { message: 'Local proxy trust requires IPv4 loopback binding' },
  )
  .refine(
    (config) =>
      [
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_CALLBACK_URL,
      ].filter(Boolean).length === 0 ||
      [
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_CALLBACK_URL,
      ].every(Boolean),
    { message: 'Configure all three Google settings together' },
  )
  .refine(
    (config) =>
      !config.GOOGLE_CALLBACK_URL ||
      (new URL(config.GOOGLE_CALLBACK_URL).pathname.endsWith(
        '/auth/google/callback',
      ) &&
        !new URL(config.GOOGLE_CALLBACK_URL).username &&
        !new URL(config.GOOGLE_CALLBACK_URL).password &&
        !new URL(config.GOOGLE_CALLBACK_URL).search &&
        !new URL(config.GOOGLE_CALLBACK_URL).hash &&
        ['http:', 'https:'].includes(
          new URL(config.GOOGLE_CALLBACK_URL).protocol,
        )),
    { message: 'Invalid Google callback URL' },
  )
  .refine(
    (config) => config.NODE_ENV !== 'production' || !config.ALLOW_GUESTS,
    { message: 'Guest transport is forbidden in production' },
  )
  .refine(
    (config) =>
      config.NODE_ENV !== 'production' ||
      !config.GOOGLE_CALLBACK_URL ||
      config.GOOGLE_CALLBACK_URL.startsWith('https://'),
    { message: 'Production OAuth callback requires HTTPS' },
  )
  .refine(
    (config) =>
      !config.AVATAR_ENDPOINT ||
      (!new URL(config.AVATAR_ENDPOINT).username &&
        !new URL(config.AVATAR_ENDPOINT).password &&
        (new URL(config.AVATAR_ENDPOINT).protocol === 'https:' ||
          (config.NODE_ENV !== 'production' &&
            new URL(config.AVATAR_ENDPOINT).protocol === 'http:' &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(
              new URL(config.AVATAR_ENDPOINT).hostname,
            )))),
    {
      message:
        'Avatar storage endpoint requires HTTPS (loopback HTTP allowed for local testing)',
    },
  )
  .refine(
    (config) =>
      config.NODE_ENV !== 'production' ||
      config.APP_ORIGIN.startsWith('https://'),
    { message: 'Production APP_ORIGIN must use HTTPS', path: ['APP_ORIGIN'] },
  );
export function parseConfig(env: Record<string, string | undefined>) {
  return schema.parse(env);
}

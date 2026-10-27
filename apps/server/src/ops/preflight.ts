import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { parseConfig } from '../config.js';
import { supportedNode22 } from './node.js';
import { verifyBackup } from './backup.js';
/** Configuration gate for this project's same-origin, loopback-NGINX deployment. */
export function deploymentChecks(config: ReturnType<typeof parseConfig>) {
  const checks: { name: string; passed: boolean }[] = [];
  const add = (name: string, passed: boolean) => checks.push({ name, passed });
  try {
    const file = lstatSync('.env');
    add(
      'private-env-file-if-present',
      file.isFile() && !file.isSymbolicLink() && (file.mode & 0o077) === 0,
    );
  } catch {
    /* Environment injection need not use a file. */
  }
  add('patched-node-22', supportedNode22(process.versions.node));
  add('production-mode', config.NODE_ENV === 'production');
  add(
    'loopback-proxy',
    config.HOST === '127.0.0.1' && config.TRUST_LOCAL_PROXY,
  );
  add(
    'secure-origin-and-guests-disabled',
    config.APP_ORIGIN.startsWith('https://') && !config.ALLOW_GUESTS,
  );
  add(
    'google-configured',
    Boolean(
      config.GOOGLE_CLIENT_ID &&
      config.GOOGLE_CLIENT_SECRET &&
      config.GOOGLE_CALLBACK_URL,
    ),
  );
  const callback = config.GOOGLE_CALLBACK_URL
    ? new URL(config.GOOGLE_CALLBACK_URL)
    : null;
  add(
    'same-origin-google-callback',
    callback?.origin === config.APP_ORIGIN &&
      callback.pathname === '/api/auth/google/callback',
  );
  add('avatar-storage-configured', Boolean(config.AVATAR_BUCKET));
  add(
    'remote-voice-turn-configured',
    config.VOICE_TURN_URLS.length > 0 && Boolean(config.VOICE_TURN_SECRET),
  );
  const webRoot = fileURLToPath(new URL('../../../web', import.meta.url));
  let databaseLocation = resolve(config.DATABASE_PATH);
  try {
    databaseLocation = realpathSync(databaseLocation);
  } catch {
    /* Existence is reported separately. */
  }
  const location = relative(realpathSync(webRoot), databaseLocation);
  add(
    'database-private-absolute-path',
    isAbsolute(config.DATABASE_PATH) &&
      (location === '..' || location.startsWith('..' + sep)),
  );
  try {
    const file = lstatSync(config.DATABASE_PATH);
    add(
      'database-owner-only-regular-file',
      file.isFile() &&
        !file.isSymbolicLink() &&
        (file.mode & 0o077) === 0 &&
        (process.getuid === undefined || file.uid === process.getuid()),
    );
    add(
      'database-integrity-and-migrations',
      verifyBackup(config.DATABASE_PATH).migrations >= 2,
    );
  } catch {
    add('database-integrity-and-migrations', false);
  }
  return checks;
}

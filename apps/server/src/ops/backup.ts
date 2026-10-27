import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import {
  chmodSync,
  closeSync,
  openSync,
  unlinkSync,
  realpathSync,
} from 'node:fs';
import {
  resolve,
  relative,
  isAbsolute,
  dirname,
  basename,
  sep,
} from 'node:path';
const webRoot = fileURLToPath(new URL('../../../web', import.meta.url));
export function verifyBackup(path: string) {
  const database = new Database(path, { readonly: true, fileMustExist: true });
  try {
    if (
      database.pragma('integrity_check', { simple: true }) !== 'ok' ||
      (database.pragma('foreign_key_check') as unknown[]).length !== 0
    )
      throw new Error('Database integrity check failed');
    const migrations = database
      .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
      .get() as { count: number };
    for (const table of [
      'users',
      'sessions',
      'oauth_transactions',
      'avatars',
      'social_reports',
    ])
      database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
    return { integrity: 'ok', migrations: migrations.count };
  } finally {
    database.close();
  }
}
export async function backupDatabase(source: string, destination: string) {
  const output = resolve(destination);
  const inWeb = relative(
    webRoot,
    resolve(realpathSync(dirname(output)), basename(output)),
  );
  if (
    source === ':memory:' ||
    resolve(source) === output ||
    !output.endsWith('.sqlite') ||
    (inWeb !== '..' && !inWeb.startsWith('..' + sep) && !isAbsolute(inWeb))
  )
    throw new Error(
      'Choose a new private .sqlite destination outside the web workspace',
    );
  // Exclusive reservation refuses overwrite and symlinks before the backup API opens it.
  const database = new Database(source, {
    readonly: true,
    fileMustExist: true,
  });
  let owned = false;
  try {
    closeSync(openSync(output, 'wx', 0o600));
    owned = true;
    const started = Date.now();
    await database.backup(output, {
      progress: () => {
        if (Date.now() - started > 30_000)
          throw new Error('Backup deadline exceeded');
        return 100;
      },
    });
    chmodSync(output, 0o600);
    return verifyBackup(output);
  } catch (error) {
    if (owned) unlinkSync(output);
    throw error;
  } finally {
    database.close();
  }
}

/** New-file restore drill; never overwrites an active database or revives old sessions. */
export async function restoreCopy(source: string, destination: string) {
  await backupDatabase(source, destination);
  const restored = new Database(destination, { fileMustExist: true });
  try {
    restored.transaction(() => {
      restored.prepare('DELETE FROM sessions').run();
      restored.prepare('DELETE FROM oauth_transactions').run();
    })();
  } finally {
    restored.close();
  }
  return { ...verifyBackup(destination), sessionsInvalidated: true };
}

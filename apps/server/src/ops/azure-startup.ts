import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { verifyBackup } from './backup.js';

try {
  const path = process.env.DATABASE_PATH;
  if (process.env.NODE_ENV !== 'production' || !path || !isAbsolute(path))
    throw new Error();
  const mount = '/srv/omi-data';
  const file = lstatSync(path);
  const location = relative(mount, realpathSync(path));
  if (
    !location ||
    location.startsWith('../') ||
    location === '..' ||
    !file.isFile() ||
    (file.mode & 0o077) !== 0 ||
    (process.getuid && file.uid !== process.getuid()) ||
    verifyBackup(path).migrations < 7
  )
    throw new Error();
} catch {
  console.error(
    'Azure startup requires an existing, private, migrated OMI database on the mounted data volume.',
  );
  process.exitCode = 1;
}

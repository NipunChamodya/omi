import 'dotenv/config';
import { backupDatabase, verifyBackup, restoreCopy } from './backup.js';
try {
  const [command, path, destination] = process.argv.slice(2);
  if (!path || !['create', 'verify', 'restore-copy'].includes(command ?? ''))
    throw new Error(
      'Usage: db:backup -- create|verify path OR restore-copy backup-path new-path',
    );
  if (command === 'restore-copy' && !destination)
    throw new Error('Restore requires a new destination');
  const result =
    command === 'restore-copy'
      ? await restoreCopy(path, destination!)
      : command === 'create'
        ? await backupDatabase(
            process.env.DATABASE_PATH ?? './data/omi.sqlite',
            path,
          )
        : verifyBackup(path);
  console.log(JSON.stringify({ operation: command, ...result }));
} catch {
  console.error(
    'Backup operation failed. Use create|verify|restore-copy with private .sqlite paths; verify source, permissions and database integrity. No credentials or account data are printed.',
  );
  process.exitCode = 1;
}

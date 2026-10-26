import 'dotenv/config';
import { SqliteAccounts } from './repository.js';
const repository = new SqliteAccounts(
  process.env.DATABASE_PATH ?? './data/omi.sqlite',
);
repository.close();
console.log('Account database migrations are up to date.');

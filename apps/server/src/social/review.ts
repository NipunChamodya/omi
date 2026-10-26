/** Owner-only local CLI; no public moderation endpoint. JSON escapes terminal control text. */
import 'dotenv/config';
import Database from 'better-sqlite3';
const db = new Database(process.env.DATABASE_PATH ?? './data/omi.sqlite', {
  readonly: true,
  fileMustExist: true,
});
try {
  const reports = db
    .prepare(
      'SELECT * FROM social_reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT 1000',
    )
    .all(Date.now() - 30 * 24 * 60 * 60_000);
  for (const report of reports) console.log(JSON.stringify(report));
} finally {
  db.close();
}

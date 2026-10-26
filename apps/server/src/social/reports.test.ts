import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { SqliteAccounts } from '../persistence/repository.js';
it('migrates additively and persists deduplicated, bounded private reports across reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-reports-'));
  const path = join(dir, 'accounts.sqlite');
  try {
    const previousMigrations = join(dir, 'stage-e-migrations');
    mkdirSync(join(previousMigrations, 'meta'), { recursive: true });
    const journal = JSON.parse(
      readFileSync(
        new URL('../../migrations/meta/_journal.json', import.meta.url),
        'utf8',
      ),
    ) as { entries: unknown[] };
    journal.entries = journal.entries.slice(0, 1);
    writeFileSync(
      join(previousMigrations, 'meta/_journal.json'),
      JSON.stringify(journal),
    );
    writeFileSync(
      join(previousMigrations, '0000_stage-e-accounts.sql'),
      readFileSync(
        new URL('../../migrations/0000_stage-e-accounts.sql', import.meta.url),
      ),
    );
    const oldDatabase = new Database(path);
    migrate(drizzle(oldDatabase), { migrationsFolder: previousMigrations });
    const existingId = randomUUID();
    oldDatabase
      .prepare(
        'INSERT INTO users (id,google_sub,display_name,version,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run(
        existingId,
        'pre-stage-g',
        'Before social migration',
        0,
        Date.now(),
        Date.now(),
      );
    oldDatabase.close();
    let repo = new SqliteAccounts(path);
    expect(repo.user(existingId)?.displayName).toBe('Before social migration');
    const user = repo.googleUser(
      'verified-subject',
      'Existing player',
      null,
      Date.now(),
    );
    const report = {
      id: randomUUID(),
      roomId: randomUUID(),
      reporterId: randomUUID(),
      subjectId: user.id,
      messageId: randomUUID(),
      reason: 'abuse' as const,
      note: 'Review privately',
      messageText: 'සිංහල <script>text only</script>',
      messageCreatedAt: Date.now(),
      createdAt: Date.now(),
    };
    expect(repo.storeSocialReport(report)).toBe(report.id);
    expect(repo.storeSocialReport({ ...report, id: randomUUID() })).toBe(
      report.id,
    );
    repo.close();
    repo = new SqliteAccounts(path);
    expect(repo.user(user.id)?.displayName).toBe('Existing player');
    repo.close();
    const db = new Database(path, { readonly: true });
    const rows = db.prepare('SELECT * FROM social_reports').all() as {
      message_text: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message_text).toBe(report.messageText);
    db.close();
    repo = new SqliteAccounts(path);
    repo.prune(Date.now() + 31 * 24 * 60 * 60_000);
    repo.close();
    const empty = new Database(path, { readonly: true });
    expect(
      empty.prepare('SELECT count(*) as count FROM social_reports').get(),
    ).toEqual({ count: 0 });
    empty.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('caps reports at 1000 without retaining older entries indefinitely', () => {
  const directory = mkdtempSync(join(tmpdir(), 'omi-report-cap-'));
  const path = join(directory, 'reports.sqlite');
  try {
    const repo = new SqliteAccounts(path);
    const now = Date.now();
    let oldest = '';
    for (let i = 0; i < 1002; i++) {
      const id = randomUUID();
      if (i === 0) oldest = id;
      repo.storeSocialReport({
        id,
        roomId: randomUUID(),
        reporterId: randomUUID(),
        subjectId: randomUUID(),
        messageId: randomUUID(),
        reason: 'spam',
        note: '',
        messageText: 'Bounded evidence',
        messageCreatedAt: now + i,
        createdAt: now + i,
      });
    }
    repo.close();
    const db = new Database(path, { readonly: true });
    expect(
      db.prepare('SELECT count(*) as count FROM social_reports').get(),
    ).toEqual({ count: 1000 });
    expect(
      db.prepare('SELECT id FROM social_reports WHERE id = ?').get(oldest),
    ).toBeUndefined();
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 15000);

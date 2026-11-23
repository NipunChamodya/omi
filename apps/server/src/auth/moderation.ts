import type Database from 'better-sqlite3';
import type { ModerationReport, ReviewStatus } from '@omi/shared';
import { RoomError } from '../multiplayer/support.js';

export class Moderation {
  constructor(private readonly db: Database.Database) {}

  list(now: number): ModerationReport[] {
    return this.db
      .prepare(
        `SELECT id, reason, message_text AS evidence, note,
      created_at AS createdAt, review_status AS status, review_revision AS revision
      FROM social_reports WHERE created_at >= ?
      ORDER BY created_at DESC, id DESC LIMIT 50`,
      )
      .all(now - 30 * 24 * 60 * 60_000) as ModerationReport[];
  }

  review(
    actor: string,
    id: string,
    revision: number,
    status: ReviewStatus,
    now: number,
  ): void {
    this.db.transaction(() => {
      const current = this.db
        .prepare(
          `SELECT review_status AS status, review_revision AS revision
        FROM social_reports WHERE id = ? AND created_at >= ?`,
        )
        .get(id, now - 30 * 24 * 60 * 60_000) as
        Pick<ModerationReport, 'status' | 'revision'> | undefined;
      if (!current) throw new RoomError('REPORT_NOT_FOUND', 404);
      if (
        current.status === status &&
        (revision === current.revision || revision + 1 === current.revision)
      )
        return;
      if (current.revision !== revision)
        throw new RoomError('REPORT_CHANGED', 409);
      this.db
        .prepare(
          'UPDATE social_reports SET review_status = ?, review_revision = ? WHERE id = ?',
        )
        .run(status, revision + 1, id);
      this.db
        .prepare('INSERT INTO omi_moderation_audit VALUES (?, ?, ?, ?, ?)')
        .run(id, revision + 1, actor, status, now);
    })();
  }
}

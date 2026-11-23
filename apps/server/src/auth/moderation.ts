import type Database from 'better-sqlite3';
import type { ModerationReport, ReviewStatus } from '@omi/shared';
import { RoomError } from '../multiplayer/support.js';

export class Moderation {
  constructor(private readonly db: Database.Database) {}

  safety(actor: string) {
    const row = this.db
      .prepare(
        'SELECT protected_play, restricted FROM omi_account_safety WHERE actor_id = ?',
      )
      .get(actor) as { protected_play: number; restricted: number } | undefined;
    return {
      protectedPlay: row?.protected_play === 1,
      communicationRestricted: row?.restricted === 1,
    };
  }

  communicationBlocked(actor: string): boolean {
    const safety = this.safety(actor);
    return safety.protectedPlay || safety.communicationRestricted;
  }

  enableProtectedPlay(actor: string) {
    this.db
      .prepare(
        `INSERT INTO omi_account_safety (actor_id, protected_play) VALUES (?, 1)
      ON CONFLICT(actor_id) DO UPDATE SET protected_play = 1`,
      )
      .run(actor);
  }

  restrict(
    actor: string,
    report: string,
    restricted: boolean,
    now: number,
    moderators: ReadonlySet<string>,
  ): string {
    return this.db.transaction(() => {
      const recent = this.db
        .prepare(
          `SELECT subject_id FROM social_reports
        INNER JOIN users ON users.id = subject_id WHERE social_reports.id = ? AND social_reports.created_at >= ?`,
        )
        .get(report, now - 30 * 24 * 60 * 60_000) as
        { subject_id: string } | undefined;
      const subject =
        recent ??
        (restricted
          ? undefined
          : (this.db
              .prepare(
                `SELECT audit.subject_id FROM omi_restriction_audit AS audit
          JOIN omi_account_safety AS safety ON safety.actor_id = audit.subject_id
          WHERE audit.report_id = ? AND audit.restricted = 1 AND safety.restricted = 1
          ORDER BY audit.id DESC LIMIT 1`,
              )
              .get(report) as { subject_id: string } | undefined));
      if (!subject || moderators.has(subject.subject_id))
        throw new RoomError('RESTRICTION_UNAVAILABLE', 409);
      const id = subject.subject_id;
      if (this.safety(id).communicationRestricted !== restricted) {
        this.db
          .prepare(
            `INSERT INTO omi_account_safety (actor_id, restricted) VALUES (?, ?)
          ON CONFLICT(actor_id) DO UPDATE SET restricted = excluded.restricted`,
          )
          .run(id, Number(restricted));
        this.db
          .prepare(
            `INSERT INTO omi_restriction_audit
          (report_id, moderator_id, subject_id, restricted, occurred_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(report, actor, id, Number(restricted), now);
      }
      return id;
    })();
  }

  list(now: number): ModerationReport[] {
    const reports = this.db
      .prepare(
        `SELECT subject_id AS subject, id, reason, message_text AS evidence, note,
      created_at AS createdAt, review_status AS status, review_revision AS revision
      FROM social_reports WHERE created_at >= ?
      ORDER BY created_at DESC, id DESC LIMIT 50`,
      )
      .all(now - 30 * 24 * 60 * 60_000) as (ModerationReport & {
      subject: string;
    })[];
    const recentIds = new Set(reports.map(({ id }) => id));
    const restrictions = this.db
      .prepare(
        `SELECT report_id AS id, occurred_at AS createdAt
      FROM omi_restriction_audit AS audit JOIN omi_account_safety AS safety
        ON safety.actor_id = audit.subject_id AND safety.restricted = 1
      WHERE audit.id = (
        SELECT max(id) FROM omi_restriction_audit WHERE subject_id = audit.subject_id
      )
      ORDER BY audit.id DESC LIMIT 50`,
      )
      .all() as Pick<ModerationReport, 'id' | 'createdAt'>[];
    const archived: ModerationReport[] = restrictions
      .filter(({ id }) => !recentIds.has(id))
      .map((item) => ({
        ...item,
        archived: true,
        reason: '',
        evidence: '',
        note: '',
        status: 'reviewed',
        revision: 0,
        communicationRestricted: true,
      }));
    return [
      ...reports.map(({ subject, ...report }) => ({
        ...report,
        communicationRestricted: this.safety(subject).communicationRestricted,
      })),
      ...archived,
    ];
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

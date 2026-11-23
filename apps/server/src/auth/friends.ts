import type Database from 'better-sqlite3';
import type { FriendAction, FriendContact } from '@omi/shared';
import { RoomError } from '../multiplayer/support.js';

type Relationship = {
  left_id: string;
  right_id: string;
  requester_id: string;
  accepted: number;
  left_blocked: number;
  right_blocked: number;
};

export class Friends {
  constructor(private readonly db: Database.Database) {}

  list(actor: string): FriendContact[] {
    const result = this.db
      .prepare(
        `SELECT u.id, u.display_name AS displayName,
      CASE
        WHEN (f.left_id = @actor AND f.left_blocked = 1) OR (f.right_id = @actor AND f.right_blocked = 1) THEN 'blocked'
        WHEN f.accepted = 1 THEN 'accepted'
        WHEN f.requester_id = @actor THEN 'sent'
        ELSE 'incoming'
      END AS status
      FROM omi_friendships AS f
      JOIN users AS u ON u.id = CASE WHEN f.left_id = @actor THEN f.right_id ELSE f.left_id END
      WHERE (f.left_id = @actor AND (f.right_blocked = 0 OR f.left_blocked = 1))
         OR (f.right_id = @actor AND (f.left_blocked = 0 OR f.right_blocked = 1))
      ORDER BY f.updated_at DESC, u.id LIMIT 200`,
      )
      .all({ actor });
    return result as FriendContact[];
  }

  change(
    actor: string,
    target: string,
    action: FriendAction,
    now: number,
  ): void {
    if (actor === target) throw new RoomError('FRIEND_UNAVAILABLE', 409);
    const [left, right] = actor < target ? [actor, target] : [target, actor];
    const unavailable = () => new RoomError('FRIEND_UNAVAILABLE', 409);
    this.db.transaction(() => {
      const row = this.db
        .prepare(
          'SELECT * FROM omi_friendships WHERE left_id = ? AND right_id = ?',
        )
        .get(left, right) as Relationship | undefined;
      const blocked = actor === left ? 'left_blocked' : 'right_blocked';
      if (action === 'block') {
        if (row?.[blocked]) return;
        if (!row) this.addEdge(left, right, actor, now);
        this.db
          .prepare(
            `UPDATE omi_friendships
          SET ${blocked} = 1, accepted = 0, updated_at = ?
          WHERE left_id = ? AND right_id = ?`,
          )
          .run(now, left, right);
        return;
      }
      if (action === 'unblock') {
        if (!row?.[blocked]) return;
        if (row.left_blocked && row.right_blocked)
          this.db
            .prepare(
              `UPDATE omi_friendships
          SET ${blocked} = 0, updated_at = ? WHERE left_id = ? AND right_id = ?`,
            )
            .run(now, left, right);
        else this.remove(left, right);
        return;
      }
      if (row?.left_blocked || row?.right_blocked) throw unavailable();
      if (action === 'request') {
        if (!row) this.addEdge(left, right, actor, now);
        else if (row.requester_id !== actor && !row.accepted)
          throw unavailable();
        return;
      }
      if (action === 'accept' && row && row.requester_id !== actor) {
        this.db
          .prepare(
            'UPDATE omi_friendships SET accepted = 1, updated_at = ? WHERE left_id = ? AND right_id = ?',
          )
          .run(now, left, right);
        return;
      }
      if (action === 'remove' && row) {
        this.remove(left, right);
        return;
      }
      throw unavailable();
    })();
  }

  private addEdge(left: string, right: string, actor: string, now: number) {
    const capacity = this.db
      .prepare(`SELECT count(*) AS count FROM omi_friendships
      WHERE left_id = ? OR right_id = ?`);
    if (
      [left, right].some(
        (id) => (capacity.get(id, id) as { count: number }).count >= 200,
      ) ||
      !this.db
        .prepare('SELECT id FROM users WHERE id = ?')
        .get(actor === left ? right : left)
    ) {
      throw new RoomError('FRIEND_UNAVAILABLE', 409);
    }
    this.db
      .prepare(
        'INSERT INTO omi_friendships (left_id, right_id, requester_id, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(left, right, actor, now);
  }

  private remove(left: string, right: string) {
    this.db
      .prepare('DELETE FROM omi_friendships WHERE left_id = ? AND right_id = ?')
      .run(left, right);
  }
}

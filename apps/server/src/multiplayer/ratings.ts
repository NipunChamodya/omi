import type Database from 'better-sqlite3';
import type { RatingOverview, Team } from '@omi/shared';

export const experimentalElo = { initial: 1000, k: 32, floor: 0 } as const;

export function teamRatingChange(
  own: number,
  opponent: number,
  won: boolean,
): number {
  const expected = 1 / (1 + 10 ** ((opponent - own) / 400));
  return Math.round(experimentalElo.k * (Number(won) - expected));
}

export class Ratings {
  constructor(private readonly db: Database.Database) {}

  private rating(actor: string) {
    return (
      (
        this.db
          .prepare('SELECT rating FROM omi_ratings WHERE actor_id = ?')
          .get(actor) as { rating: number } | undefined
      )?.rating ?? experimentalElo.initial
    );
  }

  /** Called by the authoritative result transaction with newly inserted participants only. */
  record(
    roomId: string,
    actors: readonly string[],
    winner: Team,
    completedAt: number,
  ): void {
    if (actors.length !== 4 || new Set(actors).size !== 4)
      throw new Error('Invalid ranked participants');
    const prior = actors.map((actor) => this.rating(actor));
    const means = [
      (prior[0]! + prior[2]!) / 2,
      (prior[1]! + prior[3]!) / 2,
    ] as const;
    const history = this.db.prepare(
      'INSERT INTO omi_rating_history VALUES (?, ?, ?, ?, ?)',
    );
    const update = this.db
      .prepare(`INSERT INTO omi_ratings (actor_id, rating) VALUES (?, ?)
      ON CONFLICT(actor_id) DO UPDATE SET rating = excluded.rating`);
    for (const [seat, actor] of actors.entries()) {
      const team = (seat % 2) as Team;
      const previous = prior[seat]!;
      const rating = Math.max(
        experimentalElo.floor,
        previous +
          teamRatingChange(means[team], means[1 - team]!, team === winner),
      );
      history.run(roomId, actor, previous, rating, completedAt);
      update.run(actor, rating);
    }
  }

  overview(actor: string): RatingOverview {
    return {
      rating: this.rating(actor),
      history: this.db
        .prepare(
          `SELECT previous, rating, completed_at AS completedAt FROM omi_rating_history
        WHERE actor_id = ? ORDER BY completed_at DESC, room_id DESC LIMIT 10`,
        )
        .all(actor) as RatingOverview['history'],
      leaders: this.db
        .prepare(
          `SELECT u.display_name AS name, r.rating FROM omi_ratings r
        JOIN users u ON u.id = r.actor_id ORDER BY r.rating DESC, r.actor_id LIMIT 20`,
        )
        .all() as RatingOverview['leaders'],
    };
  }
}

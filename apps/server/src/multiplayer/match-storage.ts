import type { EloPolicy } from './ratings.js';
import { Ratings } from './ratings.js';
import { createHash } from 'node:crypto';
import type { MatchStatistics } from '@omi/shared';
import { settleRound, countTricks } from '@omi/game-engine';
import type { ScoreLedger } from '@omi/game-engine';
import type Database from 'better-sqlite3';
import type { Receipt, Room } from './rooms.js';

export type StoredMatch = Pick<
  Room,
  | 'id'
  | 'code'
  | 'hostId'
  | 'version'
  | 'members'
  | 'round'
  | 'ledger'
  | 'result'
  | 'lastActive'
  | 'ranked'
  | 'matchId'
  | 'rematchVotes'
  | 'hands'
> & { receipts: readonly (readonly [string, Receipt])[] };

export interface MatchStorage {
  loadActive(limit: number): StoredMatch[];
  save(state: StoredMatch, archivePrevious?: string): void;
  archive(id: string): void;
  statistics(actorId: string): MatchStatistics;
}

export function storedMatch(room: Room): StoredMatch {
  const {
    id,
    code,
    hostId,
    version,
    members,
    round,
    ledger,
    result,
    lastActive,
    ranked,
  } = room;
  return {
    id,
    code,
    hostId,
    version,
    members,
    round,
    ledger,
    result,
    lastActive,
    ranked: ranked ?? false,
    matchId: room.matchId ?? room.id,
    rematchVotes: room.rematchVotes ?? [],
    hands: room.hands ?? [],
    receipts: [...room.receipts],
  };
}

const digest = (payload: string) =>
  createHash('sha256').update(payload).digest('hex');

export class SqliteMatchStorage implements MatchStorage {
  private readonly ratings: Ratings | null;
  constructor(
    private readonly db: Database.Database,
    experimental: boolean | EloPolicy = false,
  ) {
    this.ratings = experimental
      ? new Ratings(db, experimental === true ? undefined : experimental)
      : null;
  }

  loadActive(limit: number): StoredMatch[] {
    const rows = this.db
      .prepare(
        'SELECT id, payload, checksum FROM omi_match_state WHERE active = 1 LIMIT ?',
      )
      .all(limit + 1) as { id: string; payload: string; checksum: string }[];
    if (rows.length > limit)
      throw new Error('Saved OMI matches exceed room capacity');
    return rows.map(({ id, payload, checksum }) => {
      if (digest(payload) !== checksum)
        throw new Error('Saved OMI match failed integrity verification');
      const { format, state } = JSON.parse(payload) as {
        format: unknown;
        state: Omit<StoredMatch, 'ledger' | 'result'> & {
          ledger: ScoreLedger & { continuationBlocked?: boolean };
          result:
            | StoredMatch['result']
            | { status: 'unresolved'; reason: 'REPEATED_DRAW' };
          cancellationVote?: unknown;
          cancellationDecided?: unknown;
        };
      };
      if (
        format !== 1 ||
        (state?.matchId ?? state?.id) !== id ||
        !state.round ||
        state.members.length !== 4 ||
        state.members.some((member, seat) => member.seat !== seat) ||
        !Number.isSafeInteger(state.version) ||
        state.version < 0 ||
        !state.ledger.totals.every(
          (count) => Number.isInteger(count) && count >= 0,
        ) ||
        state.ledger.totals[0] + state.ledger.totals[1] !== 20
      ) {
        throw new Error('Saved OMI match failed format validation');
      }
      const { continuationBlocked, ...ledger } = state.ledger;
      const restored: StoredMatch = {
        ...state,
        // V2.2 added avatarUrl (including null) to every human seat and omitted it for lobby bots.
        members: state.members.map((member) =>
          !state.ranked &&
          member.bot &&
          member.permanentBot === undefined &&
          member.avatarUrl === undefined
            ? { ...member, permanentBot: true }
            : member,
        ),
        ledger:
          continuationBlocked ||
          (state.result?.status === 'settled' &&
            state.result.outcome === 'kapothi')
            ? { ...ledger, carry: 0 }
            : ledger,
        result: state.result?.status === 'unresolved' ? null : state.result,
      };
      delete (restored as typeof restored & { cancellationVote?: unknown })
        .cancellationVote;
      delete (restored as typeof restored & { cancellationDecided?: unknown })
        .cancellationDecided;
      if (state.result?.status === 'unresolved') {
        const settlement = settleRound(state.round, restored.ledger);
        if (settlement.status !== 'settled' || settlement.result !== 'seporu')
          throw new Error('Saved Sepuru could not be recovered');
        restored.ledger = settlement.ledger;
        restored.result = {
          status: 'settled',
          outcome: 'seporu',
          tricks: countTricks(state.round),
        };
      }
      return restored;
    });
  }

  save(state: StoredMatch, archivePrevious?: string): void {
    const payload = JSON.stringify({ format: 1, state });
    const matchId = state.matchId ?? state.id;
    this.db.transaction(() => {
      if (archivePrevious !== undefined) this.archive(archivePrevious);
      this.db
        .prepare(
          `INSERT INTO omi_match_state (id, active, payload, checksum) VALUES (?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checksum = excluded.checksum`,
        )
        .run(matchId, payload, digest(payload));
      const final = state.ledger.final;
      if (!final) return;
      const record = this.db
        .prepare(`INSERT INTO omi_match_results (room_id, actor_id, won, ranked, reason, completed_at, partner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, actor_id) DO NOTHING`);
      let inserted = 0;
      for (const member of state.members) {
        inserted += record.run(
          matchId,
          member.actorId,
          Number(member.seat % 2 === final.winner),
          Number(!!state.ranked),
          final.reason,
          state.lastActive,
          state.members[(member.seat + 2) % 4]?.actorId ?? null,
        ).changes;
      }
      if (inserted > 0 && state.hands?.length)
        this.db
          .prepare(
            'INSERT INTO omi_match_hands (match_id, summary) VALUES (?, ?)',
          )
          .run(matchId, JSON.stringify(state.hands));
      if (
        this.ratings &&
        state.ranked &&
        final.winner !== null &&
        inserted > 0
      ) {
        if (inserted !== 4) throw new Error('Incomplete ranked result');
        this.ratings.record(
          matchId,
          state.members.map(({ actorId }) => actorId),
          final.winner,
          state.lastActive,
        );
      }
    })();
  }

  statistics(actorId: string): MatchStatistics {
    const totals = this.db
      .prepare(
        `SELECT
      count(*) AS played,
      count(*) FILTER (WHERE won = 1) AS wins,
      count(*) FILTER (WHERE won = 1 AND ranked = 1) AS rankedWins,
      count(*) FILTER (WHERE won = 1 AND ranked = 0) AS casualWins,
      count(*) FILTER (WHERE won = 0 AND reason = 'loan_loss') AS loanLosses,
      count(*) FILTER (WHERE won = 0 AND reason IN ('ranked_forfeit', 'double_forfeit')) AS rankedForfeitLosses
      FROM omi_match_results WHERE actor_id = ?`,
      )
      .get(actorId) as Omit<MatchStatistics, 'recent'>;
    const rows = this.db
      .prepare(
        `SELECT completed_at AS completedAt, won, ranked, reason, h.summary AS hands
      FROM omi_match_results r LEFT JOIN omi_match_hands h ON h.match_id = r.room_id
      WHERE actor_id = ? ORDER BY completed_at DESC, room_id DESC LIMIT 10`,
      )
      .all(actorId) as {
      completedAt: number;
      hands: string | null;
      won: number;
      ranked: number;
      reason: MatchStatistics['recent'][number]['reason'];
    }[];
    return {
      ...totals,
      partnerships: this.db
        .prepare(
          `SELECT u.display_name AS name, COUNT(*) AS matches, SUM(r.won) AS wins
        FROM omi_match_results r JOIN users u ON u.id = r.partner_id
        WHERE r.actor_id = ? GROUP BY r.partner_id ORDER BY matches DESC, r.partner_id LIMIT 10`,
        )
        .all(actorId) as NonNullable<MatchStatistics['partnerships']>,
      ...(this.ratings && {
        experimentalRating: this.ratings.overview(actorId),
      }),
      recent: rows.map(({ hands, ...row }) => ({
        ...row,
        ...(hands && {
          hands: JSON.parse(hands) as NonNullable<
            MatchStatistics['recent'][number]['hands']
          >,
        }),
        won: row.won === 1,
        ranked: row.ranked === 1,
      })),
    };
  }

  archive(id: string): void {
    const row = this.db
      .prepare(
        'SELECT payload, checksum FROM omi_match_state WHERE id = ? AND active = 1',
      )
      .get(id) as { payload: string; checksum: string } | undefined;
    if (!row || digest(row.payload) !== row.checksum)
      throw new Error('Saved OMI match failed integrity verification');
    const { state } = JSON.parse(row.payload) as { state: StoredMatch };
    const payload = JSON.stringify({
      format: 1,
      history: { ranked: state.ranked, ledger: state.ledger },
    });
    this.db
      .prepare(
        'UPDATE omi_match_state SET active = 0, payload = ?, checksum = ? WHERE id = ?',
      )
      .run(payload, digest(payload), id);
  }
}

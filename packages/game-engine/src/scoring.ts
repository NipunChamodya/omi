import { otherTeam, requireRule, teamOf } from './cards.js';
import type { Team } from './cards.js';
import { countTricks } from './round.js';
import type { PrivateRound } from './round.js';

export type LedgerEntry =
  | Readonly<{
      kind: 'award';
      id: string;
      roundId: string;
      team: Team;
      amount: number;
      reason: 'selector-win' | 'selector-loss' | 'kapothi';
    }>
  | Readonly<{
      kind: 'transfer';
      id: string;
      roundId: string;
      from: Team;
      to: Team;
      amount: 3;
      reason: 'manual-accusation';
    }>
  | Readonly<{
      kind: 'carry';
      id: string;
      roundId: string;
      amount: 1;
      reason: 'seporu';
    }>;
/** Totals track awarded points plus net transfers, not an invented physical counter inventory. */
export type ScoreLedger = Readonly<{
  totals: readonly [number, number];
  carry: 0 | 1;
  settledRounds: readonly string[];
  entries: readonly LedgerEntry[];
}>;
export function createLedger(): ScoreLedger {
  return { totals: [0, 0], carry: 0, settledRounds: [], entries: [] };
}
export type Settlement =
  | Readonly<{
      status: 'unresolved';
      reason: 'REPEATED_DRAW' | 'KAPOTHI_WITH_CARRY';
    }>
  | Readonly<{ status: 'already-settled'; ledger: ScoreLedger }>
  | Readonly<{
      status: 'settled';
      ledger: ScoreLedger;
      result: 'seporu' | 'selector-win' | 'selector-loss' | 'kapothi';
    }>;

export function settleRound(
  round: PrivateRound,
  ledger: ScoreLedger,
): Settlement {
  requireRule(
    round.phase === 'complete' && round.tricks.length === 8,
    'ROUND_NOT_COMPLETE',
  );
  requireRule(ledger.carry === 0 || ledger.carry === 1, 'INVALID_CARRY');
  if (ledger.settledRounds.includes(round.id))
    return { status: 'already-settled', ledger };
  const counts = countTricks(round);
  const settledRounds = [...ledger.settledRounds, round.id];
  if (counts[0] === 4) {
    if (ledger.carry === 1)
      return { status: 'unresolved', reason: 'REPEATED_DRAW' };
    return {
      status: 'settled',
      result: 'seporu',
      ledger: {
        ...ledger,
        carry: 1,
        settledRounds,
        entries: [
          ...ledger.entries,
          {
            kind: 'carry',
            id: `round:${round.id}`,
            roundId: round.id,
            amount: 1,
            reason: 'seporu',
          },
        ],
      },
    };
  }
  const winner: Team = counts[0] > counts[1] ? 0 : 1;
  const kapothi = counts[winner] === 8;
  const selectorWon = winner === teamOf(round.selector);
  // Carry one point into an ordinary result; Kapothi bonus combinations remain unresolved.
  if (ledger.carry === 1 && kapothi)
    return { status: 'unresolved', reason: 'KAPOTHI_WITH_CARRY' };
  const amount = (kapothi ? 3 : selectorWon ? 1 : 2) + ledger.carry;
  const reason = kapothi
    ? 'kapothi'
    : selectorWon
      ? 'selector-win'
      : 'selector-loss';
  const totals: [number, number] = [...ledger.totals];
  totals[winner] += amount;
  return {
    status: 'settled',
    result: reason,
    ledger: {
      totals,
      carry: 0,
      settledRounds,
      entries: [
        ...ledger.entries,
        {
          kind: 'award',
          id: `round:${round.id}`,
          roundId: round.id,
          team: winner,
          amount,
          reason,
        },
      ],
    },
  };
}
/** Internal bookkeeping for a verified manual accusation; no automatic invocation. */
export function recordAccusationTransfer(
  ledger: ScoreLedger,
  roundId: string,
  playId: number,
  offender: Team,
): ScoreLedger {
  requireRule(
    roundId.trim().length > 0 && Number.isInteger(playId) && playId >= 0,
    'INVALID_EVIDENCE_ID',
  );
  const id = `accusation:${roundId.length}:${roundId}:${playId}`;
  if (ledger.entries.some((entry) => entry.id === id)) return ledger;
  const recipient = otherTeam(offender);
  const totals: [number, number] = [...ledger.totals];
  totals[offender] -= 3;
  totals[recipient] += 3;
  return {
    ...ledger,
    totals,
    entries: [
      ...ledger.entries,
      {
        kind: 'transfer',
        id,
        roundId,
        from: offender,
        to: recipient,
        amount: 3,
        reason: 'manual-accusation',
      },
    ],
  };
}

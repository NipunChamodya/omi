import { otherTeam, requireRule, teamOf } from './cards.js';
import type { Team } from './cards.js';
import { countTricks } from './round.js';
import type { PrivateRound } from './round.js';

export type TransferReason =
  'selector-win' | 'selector-loss' | 'kapothi' | 'manual-accusation';
export type MatchResult = Readonly<{
  reason: 'inventory_depleted' | 'loan_loss' | 'ranked_forfeit';
  winner: Team;
  loser: Team;
  roundId: string;
}>;
export type LedgerEntry =
  | Readonly<{
      kind: 'carry';
      id: string;
      roundId: string;
      amount: 1;
      reason: 'seporu';
    }>
  | Readonly<{
      kind: 'transfer' | 'unpaid';
      id: string;
      roundId: string;
      from: Team;
      to: Team;
      amount: number;
      reason: TransferReason;
    }>;
export type ScoreLedger = Readonly<{
  totals: readonly [number, number];
  carry: 0 | 1;
  settledRounds: readonly string[];
  entries: readonly LedgerEntry[];
  final: MatchResult | null;
  continuationBlocked: boolean;
}>;
export function createLedger(): ScoreLedger {
  return {
    totals: [10, 10],
    carry: 0,
    settledRounds: [],
    entries: [],
    final: null,
    continuationBlocked: false,
  };
}

function settleTransfer(
  ledger: ScoreLedger,
  id: string,
  roundId: string,
  from: Team,
  amount: number,
  reason: TransferReason,
): ScoreLedger {
  requireRule(!ledger.final, 'MATCH_COMPLETE');
  requireRule(
    ledger.totals.every((value) => Number.isInteger(value) && value >= 0) &&
      ledger.totals[0] + ledger.totals[1] === 20,
    'INVALID_INVENTORY',
  );
  const to = otherTeam(from);
  const unpaid = ledger.totals[from] < amount;
  const totals: [number, number] = [...ledger.totals];
  if (!unpaid) {
    totals[from] -= amount;
    totals[to] += amount;
  }
  return {
    ...ledger,
    totals,
    settledRounds: [...ledger.settledRounds, roundId],
    entries: [
      ...ledger.entries,
      {
        kind: unpaid ? 'unpaid' : 'transfer',
        id,
        roundId,
        from,
        to,
        amount,
        reason,
      },
    ],
    final:
      unpaid || totals[from] === 0
        ? {
            reason: unpaid ? 'loan_loss' : 'inventory_depleted',
            winner: to,
            loser: from,
            roundId,
          }
        : null,
  };
}

export type Settlement =
  | Readonly<{ status: 'unresolved'; reason: 'REPEATED_DRAW' }>
  | Readonly<{ status: 'already-settled'; ledger: ScoreLedger }>
  | Readonly<{
      status: 'settled';
      ledger: ScoreLedger;
      result: 'seporu' | Exclude<TransferReason, 'manual-accusation'>;
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
  requireRule(!ledger.final, 'MATCH_COMPLETE');
  requireRule(!ledger.continuationBlocked, 'UNRESOLVED_RULE');
  const counts = countTricks(round);
  const id = `round:${round.id}`;
  if (counts[0] === 4) {
    if (ledger.carry) return { status: 'unresolved', reason: 'REPEATED_DRAW' };
    return {
      status: 'settled',
      result: 'seporu',
      ledger: {
        ...ledger,
        carry: 1,
        settledRounds: [...ledger.settledRounds, round.id],
        entries: [
          ...ledger.entries,
          { kind: 'carry', id, roundId: round.id, amount: 1, reason: 'seporu' },
        ],
      },
    };
  }
  const winner: Team = counts[0] > counts[1] ? 0 : 1;
  const kapothi = counts[winner] === 8;
  const selectorWon = winner === teamOf(round.selector);
  const reason = kapothi
    ? 'kapothi'
    : selectorWon
      ? 'selector-win'
      : 'selector-loss';
  const amount = kapothi ? 3 : selectorWon ? 1 : 2 + ledger.carry;
  const settled = settleTransfer(
    ledger,
    id,
    round.id,
    otherTeam(winner),
    amount,
    reason,
  );
  const kapothiAfterSepuru = kapothi && ledger.carry === 1;
  return {
    status: 'settled',
    result: reason,
    ledger: {
      ...settled,
      carry: kapothiAfterSepuru ? 1 : 0,
      continuationBlocked: kapothiAfterSepuru && !settled.final,
    },
  };
}

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
  if (ledger.settledRounds.includes(roundId)) return ledger;
  return settleTransfer(
    ledger,
    `accusation:${roundId.length}:${roundId}:${playId}`,
    roundId,
    offender,
    3,
    'manual-accusation',
  );
}

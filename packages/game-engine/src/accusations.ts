import { assertSeat, requireRule, teamOf } from './cards.js';
import type { Seat } from './cards.js';
import type { PlayEvidence, PrivateRound } from './round.js';
import { recordAccusationTransfer } from './scoring.js';
import type { ScoreLedger } from './scoring.js';

/** Trusted server policy only, after owner clarification; never a client payload. */
export type AccusationWindow = (
  round: PrivateRound,
  reporter: Seat,
  evidence: PlayEvidence,
) => 'eligible' | 'ineligible' | 'unresolved';
export type AccusationResult =
  | Readonly<{ status: 'unresolved'; reason: 'ACCUSATION_WINDOW' }>
  | Readonly<{
      status: 'invalid';
      reason:
        'UNKNOWN_PLAY' | 'NOT_OPPONENT' | 'NO_VIOLATION' | 'OUTSIDE_WINDOW';
    }>
  | Readonly<{ status: 'already-applied'; ledger: ScoreLedger }>
  | Readonly<{ status: 'confirmed'; ledger: ScoreLedger }>;

/** Called only for a manual report. All inputs/outputs and policy context are server-private. */
export function accuse(
  round: PrivateRound,
  ledger: ScoreLedger,
  reporter: Seat,
  playId: number,
  window?: AccusationWindow,
): AccusationResult {
  assertSeat(reporter);
  requireRule(Number.isInteger(playId) && playId >= 0, 'INVALID_EVIDENCE_ID');
  const evidence = round.evidence.find((item) => item.id === playId);
  if (!evidence) return { status: 'invalid', reason: 'UNKNOWN_PLAY' };
  if (teamOf(evidence.play.seat) === teamOf(reporter))
    return { status: 'invalid', reason: 'NOT_OPPONENT' };
  const eligibility = window?.(round, reporter, evidence) ?? 'unresolved';
  if (eligibility === 'unresolved')
    return { status: 'unresolved', reason: 'ACCUSATION_WINDOW' };
  requireRule(
    eligibility === 'eligible' || eligibility === 'ineligible',
    'INVALID_ACCUSATION_POLICY',
  );
  if (eligibility === 'ineligible')
    return { status: 'invalid', reason: 'OUTSIDE_WINDOW' };
  // Verify using the saved hand rather than trusting only the derived violation flag.
  const violated =
    evidence.leadSuit !== null &&
    evidence.play.card.suit !== evidence.leadSuit &&
    evidence.handBefore.some((card) => card.suit === evidence.leadSuit);
  if (!violated) return { status: 'invalid', reason: 'NO_VIOLATION' };
  const updated = recordAccusationTransfer(
    ledger,
    round.id,
    playId,
    teamOf(evidence.play.seat),
  );
  return {
    status: updated === ledger ? 'already-applied' : 'confirmed',
    ledger: updated,
  };
}

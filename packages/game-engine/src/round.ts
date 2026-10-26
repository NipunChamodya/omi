import {
  assertCard,
  assertDeck,
  assertSeat,
  cardId,
  cutDeck,
  EngineError,
  leftOf,
  nextSeat,
  RANKS,
  requireRule,
  sameCard,
  teamOf,
} from './cards.js';
import type { Card, Four, Seat, Suit, Team } from './cards.js';

export type Play = Readonly<{ seat: Seat; card: Card }>;
export type Trick = Readonly<{ plays: readonly Play[]; winner: Seat }>;
export type PlayEvidence = Readonly<{
  id: number;
  trickIndex: number;
  play: Play;
  /** Full hand immediately before this play. Server-private, including nonviolations. */
  handBefore: readonly Card[];
  leadSuit: Suit | null;
  violatedFollowSuit: boolean;
}>;
export type RoundPhase =
  'awaiting-cut' | 'awaiting-trump' | 'playing' | 'complete' | 'cancelled';
/** Entire object is trusted-server-only. NEVER serialize it to a player or into public logs. */
export type PrivateRound = Readonly<{
  id: string;
  phase: RoundPhase;
  dealer: Seat;
  selector: Seat;
  deck: readonly Card[];
  hands: Four<readonly Card[]>;
  dealtHands: Four<readonly Card[]>;
  trump: Suit | null;
  turn: Seat | null;
  trick: readonly Play[];
  tricks: readonly Trick[];
  evidence: readonly PlayEvidence[];
  cancellation: null | Readonly<{ reason: 'no-trump'; reporter: Seat }>;
}>;
const emptyHands = (): Four<readonly Card[]> => [[], [], [], []];

export function createRound(
  id: string,
  dealer: Seat,
  shuffledDeck: readonly Card[],
): PrivateRound {
  requireRule(id.trim().length > 0, 'INVALID_ROUND_ID');
  assertSeat(dealer);
  assertDeck(shuffledDeck);
  return {
    id,
    phase: 'awaiting-cut',
    dealer,
    selector: nextSeat(dealer),
    deck: shuffledDeck.map((card) => ({ ...card })),
    hands: emptyHands(),
    dealtHands: emptyHands(),
    trump: null,
    turn: null,
    trick: [],
    tricks: [],
    evidence: [],
    cancellation: null,
  };
}
function dealFour(
  deck: readonly Card[],
  dealer: Seat,
  hands: Four<readonly Card[]>,
): Four<readonly Card[]> {
  const result = hands.map((hand) => [...hand]) as [
    Card[],
    Card[],
    Card[],
    Card[],
  ];
  let seat = nextSeat(dealer);
  for (let i = 0; i < 4; i++) {
    result[seat].push(
      ...deck.slice(i * 4, i * 4 + 4).map((card) => ({ ...card })),
    );
    seat = nextSeat(seat);
  }
  return result;
}
/** Interactive actor is always the dealer's left; trusted caller supplies actor identity. */
export function cutAndDeal(
  round: PrivateRound,
  actor: Seat,
  offset: number,
): PrivateRound {
  requireRule(round.phase === 'awaiting-cut', 'WRONG_PHASE');
  requireRule(actor === leftOf(round.dealer), 'NOT_CUTTER');
  const deck = cutDeck(round.deck, offset);
  return {
    ...round,
    phase: 'awaiting-trump',
    deck: deck.slice(16),
    hands: dealFour(deck.slice(0, 16), round.dealer, round.hands),
    turn: round.selector,
  };
}
export function selectTrump(
  round: PrivateRound,
  actor: Seat,
  suit: Suit,
): PrivateRound {
  requireRule(round.phase === 'awaiting-trump', 'WRONG_PHASE');
  requireRule(actor === round.selector, 'NOT_TRUMP_SELECTOR');
  requireRule(
    round.hands[actor].some((card) => card.suit === suit),
    'TRUMP_NOT_IN_HAND',
  );
  const hands = dealFour(round.deck, round.dealer, round.hands);
  return {
    ...round,
    phase: 'playing',
    deck: [],
    hands,
    dealtHands: hands.map((hand) =>
      hand.map((card) => ({ ...card })),
    ) as unknown as Four<readonly Card[]>,
    trump: suit,
    turn: actor,
  };
}
/** Resolves exactly four distinct cards in counterclockwise seat order. */
export function resolveTrick(plays: readonly Play[], trump: Suit): Seat {
  requireRule(plays.length === 4, 'INCOMPLETE_TRICK');
  requireRule(
    new Set(plays.map((play) => cardId(play.card))).size === 4,
    'DUPLICATE_CARD',
  );
  const first = plays[0]!;
  let expected = first.seat;
  for (const play of plays) {
    assertSeat(play.seat);
    assertCard(play.card);
    requireRule(play.seat === expected, 'INVALID_TRICK_ORDER');
    expected = nextSeat(expected);
  }
  // Trump is validated even when called outside the round reducer.
  requireRule(
    ['spades', 'hearts', 'diamonds', 'clubs'].includes(trump),
    'INVALID_TRUMP',
  );
  const winningSuit = plays.some((play) => play.card.suit === trump)
    ? trump
    : first.card.suit;
  const eligible = plays.filter((play) => play.card.suit === winningSuit);
  return eligible.reduce((best, play) =>
    RANKS.indexOf(play.card.rank) < RANKS.indexOf(best.card.rank) ? play : best,
  ).seat;
}
/** Follow-suit deception is accepted. No warning, penalty, or public event is generated. */
export function playCard(
  round: PrivateRound,
  actor: Seat,
  card: Card,
): PrivateRound {
  requireRule(round.phase === 'playing', 'WRONG_PHASE');
  requireRule(actor === round.turn, 'NOT_YOUR_TURN');
  assertCard(card);
  const hand = round.hands[actor];
  requireRule(
    hand.some((held) => sameCard(held, card)),
    'CARD_NOT_OWNED',
  );
  const leadSuit = round.trick[0]?.card.suit ?? null;
  const play: Play = { seat: actor, card: { ...card } };
  const evidence: PlayEvidence = {
    id: round.evidence.length,
    trickIndex: round.tricks.length,
    play,
    handBefore: hand.map((held) => ({ ...held })),
    leadSuit,
    violatedFollowSuit:
      leadSuit !== null &&
      card.suit !== leadSuit &&
      hand.some((held) => held.suit === leadSuit),
  };
  const hands = round.hands.map((held, seat) =>
    seat === actor ? held.filter((item) => !sameCard(item, card)) : held,
  ) as unknown as Four<readonly Card[]>;
  const trick = [...round.trick, play];
  const base = { ...round, hands, evidence: [...round.evidence, evidence] };
  if (trick.length < 4) return { ...base, trick, turn: nextSeat(actor) };
  if (round.trump === null) throw new EngineError('MISSING_TRUMP');
  const winner = resolveTrick(trick, round.trump);
  const tricks = [...round.tricks, { plays: trick, winner }];
  return {
    ...base,
    trick: [],
    tricks,
    phase: tricks.length === 8 ? 'complete' : 'playing',
    turn: tricks.length === 8 ? null : winner,
  };
}
export function countTricks(round: PrivateRound): readonly [number, number] {
  return round.tricks.reduce<[number, number]>(
    (counts, trick) => {
      counts[teamOf(trick.winner)]++;
      return counts;
    },
    [0, 0],
  );
}
export type NoTrumpBasis = 'initial-deal' | 'current-hand' | 'unresolved';
/** Basis/timing have no default rule: caller must obtain owner clarification first. */
export type NoTrumpPolicy = (
  round: PrivateRound,
  reporter: Seat,
) => NoTrumpBasis | 'ineligible';
export type NoTrumpReport =
  | Readonly<{
      status: 'unresolved';
      reason: 'NO_TRUMP_REPORT_BASIS_OR_TIMING';
    }>
  | Readonly<{
      status: 'invalid';
      reason: 'NOT_OPPOSING_TEAM' | 'TEAM_HAS_TRUMP' | 'OUTSIDE_REPORT_WINDOW';
    }>
  | Readonly<{ status: 'confirmed'; round: PrivateRound }>;
export function reportNoTrump(
  round: PrivateRound,
  reporter: Seat,
  policy?: NoTrumpPolicy,
): NoTrumpReport {
  requireRule(round.phase === 'playing', 'WRONG_PHASE');
  assertSeat(reporter);
  if (teamOf(reporter) === teamOf(round.selector))
    return { status: 'invalid', reason: 'NOT_OPPOSING_TEAM' };
  const basis = policy?.(round, reporter) ?? 'unresolved';
  if (basis === 'unresolved')
    return { status: 'unresolved', reason: 'NO_TRUMP_REPORT_BASIS_OR_TIMING' };
  if (basis === 'ineligible')
    return { status: 'invalid', reason: 'OUTSIDE_REPORT_WINDOW' };
  requireRule(
    basis === 'initial-deal' || basis === 'current-hand',
    'INVALID_REPORT_POLICY',
  );
  const hands = basis === 'initial-deal' ? round.dealtHands : round.hands;
  const team: Team = teamOf(reporter);
  if (
    hands.some(
      (hand, seat) =>
        teamOf(seat as Seat) === team &&
        hand.some((card) => card.suit === round.trump),
    )
  ) {
    return { status: 'invalid', reason: 'TEAM_HAS_TRUMP' };
  }
  return {
    status: 'confirmed',
    round: {
      ...round,
      phase: 'cancelled',
      turn: null,
      cancellation: { reason: 'no-trump', reporter },
    },
  };
}
export type RestartResult =
  | Readonly<{ status: 'unresolved'; reason: 'REPLACEMENT_DEALER_SELECTION' }>
  | Readonly<{ status: 'restarted'; round: PrivateRound }>;
/** Caller reshuffles and supplies an explicitly selected new dealer. No selection algorithm is invented. */
export function restartCancelledRound(
  round: PrivateRound,
  id: string,
  reshuffledDeck: readonly Card[],
  replacementDealer?: Seat,
): RestartResult {
  requireRule(
    round.phase === 'cancelled' && round.cancellation?.reason === 'no-trump',
    'ROUND_NOT_CANCELLED',
  );
  if (replacementDealer === undefined)
    return { status: 'unresolved', reason: 'REPLACEMENT_DEALER_SELECTION' };
  assertSeat(replacementDealer);
  requireRule(replacementDealer !== round.dealer, 'DEALER_MUST_CHANGE');
  requireRule(id !== round.id, 'ROUND_ID_MUST_CHANGE');
  return {
    status: 'restarted',
    round: createRound(id, replacementDealer, reshuffledDeck),
  };
}

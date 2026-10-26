import { describe, expect, it } from 'vitest';
import {
  accuse,
  cardId,
  chooseInitialDealer,
  countTricks,
  createDeck,
  createLedger,
  createRound,
  cutAndDeal,
  cutDeck,
  EngineError,
  leftOf,
  nextSeat,
  otherTeam,
  playCard,
  RANKS,
  reportNoTrump,
  resolveTrick,
  restartCancelledRound,
  sameCard,
  selectTrump,
  settleRound,
  shuffleDeck,
  SUITS,
  teamOf,
} from './index.js';
import type {
  Card,
  PrivateRound,
  Rank,
  ScoreLedger,
  Seat,
  Suit,
} from './index.js';

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const seeded = (seed: number) => (bound: number) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return Math.floor((seed / 2 ** 32) * bound);
};
function ready(seed = 1, dealer: Seat = 3): PrivateRound {
  const round = createRound(
    `round-${seed}`,
    dealer,
    shuffleDeck(createDeck(), seeded(seed)),
  );
  const dealt = cutAndDeal(round, leftOf(dealer), 16);
  return selectTrump(
    dealt,
    dealt.selector,
    dealt.hands[dealt.selector][0]!.suit,
  );
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function finished(seed = 1): PrivateRound {
  let round = ready(seed);
  while (round.phase === 'playing')
    round = playCard(round, round.turn!, round.hands[round.turn!][0]!);
  return round;
}
/** Scoring fixtures isolate confirmed trick totals from trick resolution (tested separately). */
function withTricks(team0: number, selector: Seat = 0): PrivateRound {
  const round = finished();
  return {
    ...round,
    selector,
    tricks: round.tricks.map((trick, i) => ({
      ...trick,
      winner: i < team0 ? 0 : 1,
    })),
  };
}
function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

// All hands in one fixture are arranged intentionally; the actual reducers still deal every card.
function noTrumpRound(): PrivateRound {
  const deck = createDeck();
  // Dealer 3 => selector 0; opposing seats 1 and 3 receive only red suits.
  const hands = [
    deck.slice(0, 8),
    deck.slice(8, 16),
    deck.slice(24, 32),
    deck.slice(16, 24),
  ];
  const afterCut = [
    ...hands[0]!.slice(0, 4),
    ...hands[1]!.slice(0, 4),
    ...hands[2]!.slice(0, 4),
    ...hands[3]!.slice(0, 4),
    ...hands[0]!.slice(4),
    ...hands[1]!.slice(4),
    ...hands[2]!.slice(4),
    ...hands[3]!.slice(4),
  ];
  const beforeCut = [...afterCut.slice(16), ...afterCut.slice(0, 16)];
  return selectTrump(
    cutAndDeal(createRound('no-trump', 3, beforeCut), 2, 16),
    0,
    'spades',
  );
}

describe('deck and seating', () => {
  it('creates exactly 32 distinct cards with owner ranks and suits', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(32);
    expect(new Set(deck.map(cardId)).size).toBe(32);
    expect(RANKS).toEqual(['A', 'K', 'Q', 'J', '10', '9', '8', '7']);
    expect(SUITS).toEqual(['spades', 'hearts', 'diamonds', 'clubs']);
    for (const suit of SUITS)
      expect(
        deck.filter((item) => item.suit === suit).map((item) => item.rank),
      ).toEqual(RANKS);
    expect(createDeck()).not.toBe(deck);
  });
  it('keeps teammates opposite and moves counterclockwise through exactly four seats', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      expect(nextSeat(nextSeat(nextSeat(nextSeat(seat))))).toBe(seat);
      expect(nextSeat(leftOf(seat))).toBe(seat);
      expect(teamOf(nextSeat(nextSeat(seat)))).toBe(teamOf(seat));
      expect(teamOf(nextSeat(seat))).toBe(otherTeam(teamOf(seat)));
      expect(chooseInitialDealer(() => seat)).toBe(seat);
    }
  });
  it('requires trusted entropy and checks its bounds', () => {
    for (const bad of [-1, 4, 0.1, NaN, Infinity])
      expectCode(() => chooseInitialDealer(() => bad), 'INVALID_ENTROPY');
    expectCode(
      () => shuffleDeck(createDeck(), (bound) => bound),
      'INVALID_ENTROPY',
    );
    expectCode(() => nextSeat(4 as Seat), 'INVALID_SEAT');
  });
  it('uses reproducible Fisher–Yates without mutating its deck', () => {
    const deck = freeze(createDeck());
    const bounds: number[] = [];
    const shuffled = shuffleDeck(deck, (bound) => {
      bounds.push(bound);
      return 0;
    });
    expect(bounds).toEqual(Array.from({ length: 31 }, (_, i) => 32 - i));
    expect(shuffled).not.toEqual(deck);
    expect([...shuffled.map(cardId)].sort()).toEqual(
      [...deck.map(cardId)].sort(),
    );
    expect(shuffleDeck(deck, seeded(7))).toEqual(shuffleDeck(deck, seeded(7)));
    expect(shuffleDeck(deck, seeded(7))).not.toEqual(
      shuffleDeck(deck, seeded(8)),
    );
  });
  it('rejects malformed decks and cuts without discarding any cards', () => {
    const deck = freeze(createDeck());
    expect(cutDeck(deck, 1)).toEqual([...deck.slice(1), deck[0]]);
    expect(cutDeck(deck, 31)).toEqual([deck[31], ...deck.slice(0, 31)]);
    for (const offset of [0, 32, -1, 1.5, NaN])
      expectCode(() => cutDeck(deck, offset), 'INVALID_CUT');
    for (const bad of [
      deck.slice(1),
      [...deck, deck[0]!],
      Array<Card>(32).fill(deck[0]!),
    ]) {
      expectCode(() => createRound('invalid', 0, bad), 'INVALID_DECK');
      expectCode(() => shuffleDeck(bad, seeded(1)), 'INVALID_DECK');
    }
    expectCode(() => createRound(' ', 0, deck), 'INVALID_ROUND_ID');
    expectCode(() => createRound('bad', 4 as Seat, deck), 'INVALID_SEAT');
    expectCode(
      () =>
        createRound('bad-card', 0, [
          ...deck.slice(1),
          card('clubs', '2' as Rank),
        ]),
      'INVALID_CARD',
    );
  });
});

describe('cutting, deals and trump', () => {
  it.each([0, 1, 2, 3] as const)(
    'cuts and deals to the right first, dealer %s last, then completes hands',
    (dealer) => {
      const deck = createDeck();
      const round = freeze(createRound(`dealer-${dealer}`, dealer, deck));
      expect(round.phase).toBe('awaiting-cut');
      expect(round.hands.map((hand) => hand.length)).toEqual([0, 0, 0, 0]);
      expectCode(() => cutAndDeal(round, dealer, 7), 'NOT_CUTTER');
      const dealt = freeze(cutAndDeal(round, leftOf(dealer), 7));
      expect(dealt.phase).toBe('awaiting-trump');
      expect(dealt.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4]);
      const cut = cutDeck(deck, 7);
      let seat = nextSeat(dealer);
      for (let i = 0; i < 4; i++) {
        expect(dealt.hands[seat]).toEqual(cut.slice(i * 4, i * 4 + 4));
        seat = nextSeat(seat);
      }
      expect(dealt.hands[dealer]).toEqual(cut.slice(12, 16));
      expect(dealt.deck).toEqual(cut.slice(16));
      const suit = dealt.hands[dealt.selector][0]!.suit;
      const playing = selectTrump(dealt, dealt.selector, suit);
      expect(playing.hands.map((hand) => hand.length)).toEqual([8, 8, 8, 8]);
      expect(playing.dealtHands).toEqual(playing.hands);
      expect(playing.deck).toEqual([]);
      expect(playing.turn).toBe(nextSeat(dealer));
      expect(playing.trump).toBe(suit);
      expect(new Set(playing.hands.flat().map(cardId)).size).toBe(32);
      seat = nextSeat(dealer);
      for (let i = 0; i < 4; i++) {
        expect(playing.hands[seat].slice(4)).toEqual(
          cut.slice(16 + i * 4, 20 + i * 4),
        );
        seat = nextSeat(seat);
      }
      expectCode(
        () => selectTrump(playing, playing.selector, suit),
        'WRONG_PHASE',
      );
      expectCode(() => cutAndDeal(dealt, leftOf(dealer), 7), 'WRONG_PHASE');
    },
  );
  it('enforces trump actor, first-four suit and phase restrictions', () => {
    const round = createRound('trump', 3, createDeck());
    expectCode(() => selectTrump(round, 0, 'spades'), 'WRONG_PHASE');
    expectCode(() => playCard(round, 0, createDeck()[0]!), 'WRONG_PHASE');
    const dealt = cutAndDeal(round, 2, 16);
    expectCode(
      () => selectTrump(dealt, 1, dealt.hands[0][0]!.suit),
      'NOT_TRUMP_SELECTOR',
    );
    const absent = SUITS.find(
      (suit) => !dealt.hands[0].some((held) => held.suit === suit),
    )!;
    expectCode(() => selectTrump(dealt, 0, absent), 'TRUMP_NOT_IN_HAND');
    const onlyInSecondFour = createDeck().find((item) => item.suit === absent)!;
    expect(onlyInSecondFour).toBeDefined();
    expectCode(() => playCard(dealt, 0, dealt.hands[0][0]!), 'WRONG_PHASE');
  });
});

describe('trick resolution', () => {
  it.each(SUITS)(
    'selects the highest trump for %s regardless of lead or off-suit aces',
    (trump) => {
      const lead = SUITS.find((suit) => suit !== trump)!;
      expect(
        resolveTrick(
          [
            { seat: 0, card: card(lead, 'A') },
            { seat: 1, card: card(trump, '7') },
            { seat: 2, card: card(trump, 'K') },
            { seat: 3, card: card(lead, 'K') },
          ],
          trump,
        ),
      ).toBe(2);
    },
  );
  it.each(RANKS.slice(0, -1))(
    'honors rank %s over the next lower rank',
    (rank) => {
      const weaker = RANKS[RANKS.indexOf(rank) + 1]!;
      expect(
        resolveTrick(
          [
            { seat: 3, card: card('hearts', weaker) },
            { seat: 0, card: card('clubs', 'A') },
            { seat: 1, card: card('hearts', rank) },
            { seat: 2, card: card('diamonds', 'A') },
          ],
          'spades',
        ),
      ).toBe(1);
    },
  );
  it('rejects partial tricks, repeated cards, invalid order and invalid trump', () => {
    const plays = [
      { seat: 2, card: card('hearts', '7') },
      { seat: 3, card: card('hearts', 'A') },
      { seat: 0, card: card('clubs', 'A') },
      { seat: 1, card: card('diamonds', 'A') },
    ] as const;
    expectCode(
      () => resolveTrick(plays.slice(0, 3), 'spades'),
      'INCOMPLETE_TRICK',
    );
    expectCode(
      () =>
        resolveTrick(
          [...plays.slice(0, 3), { seat: 1, card: plays[0].card }],
          'spades',
        ),
      'DUPLICATE_CARD',
    );
    expectCode(
      () => resolveTrick([plays[1], plays[0], plays[2], plays[3]], 'spades'),
      'INVALID_TRICK_ORDER',
    );
    expectCode(() => resolveTrick(plays, 'invalid' as Suit), 'INVALID_TRUMP');
  });
});

describe('play and private evidence', () => {
  it('enforces turn and ownership without modifying rejected states', () => {
    const round = freeze(ready());
    const actor = round.turn!;
    expectCode(
      () => playCard(round, nextSeat(actor), round.hands[nextSeat(actor)][0]!),
      'NOT_YOUR_TURN',
    );
    const missing = round.hands[nextSeat(actor)][0]!;
    expectCode(() => playCard(round, actor, missing), 'CARD_NOT_OWNED');
    const played = playCard(round, actor, round.hands[actor][0]!);
    expect(round.hands[actor]).toHaveLength(8);
    expect(played.hands[actor]).toHaveLength(7);
    expectCode(
      () => playCard(played, actor, round.hands[actor][0]!),
      'NOT_YOUR_TURN',
    );
    expect(played.evidence[0]!.violatedFollowSuit).toBe(false);
    expect(played.evidence[0]!.handBefore).toEqual(round.hands[actor]);
  });
  it('accepts deliberate follow-suit violations silently and stores exact private evidence', () => {
    let round = noTrumpRound();
    const original = freeze(round);
    round = playCard(round, 0, card('spades', 'A'));
    round = playCard(round, 1, card('hearts', 'A')); // genuinely void in spades
    round = playCard(round, 2, card('clubs', 'A')); // genuinely void in spades
    round = playCard(round, 3, card('diamonds', 'A')); // genuinely void in spades
    expect(round.tricks[0]!.winner).toBe(0);
    // Construct another legal deal with mixed hands to guarantee a voluntary violation.
    let violationFound = false;
    for (let seed = 1; seed <= 20 && !violationFound; seed++) {
      let state = ready(seed);
      state = playCard(state, state.turn!, state.hands[state.turn!][0]!);
      const actor = state.turn!;
      const lead = state.trick[0]!.card.suit;
      const offSuit = state.hands[actor].find((held) => held.suit !== lead);
      if (offSuit && state.hands[actor].some((held) => held.suit === lead)) {
        const ledger = freeze(createLedger());
        const before = freeze(state);
        const after = playCard(state, actor, offSuit);
        expect(after.evidence[1]!.violatedFollowSuit).toBe(true);
        expect(after.evidence[1]!.handBefore).toEqual(before.hands[actor]);
        expect(after.evidence[1]!.trickIndex).toBe(0);
        expect(after.evidence[1]!.leadSuit).toBe(lead);
        expect(after.trick).toHaveLength(2);
        expect(after.hands[actor]).toHaveLength(7);
        expect(ledger.totals).toEqual([0, 0]);
        expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
        violationFound = true;
      }
    }
    expect(violationFound).toBe(true);
    expect(original.hands.flat()).toHaveLength(32);
    expect(round.evidence.every((item) => !item.violatedFollowSuit)).toBe(true);
  });
  it('preserves card conservation, winner leads and immutability over 100 full rounds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let round = freeze(ready(seed, (seed % 4) as Seat));
      for (let i = 0; i < 32; i++) {
        const before = round;
        const actor = round.turn!;
        const chosen = round.hands[actor][i % round.hands[actor].length]!;
        round = freeze(playCard(round, actor, chosen));
        expect(round.evidence).toHaveLength(i + 1);
        expect(round.hands.flat()).toHaveLength(31 - i);
        const all = [
          ...round.hands.flat(),
          ...round.trick.map((play) => play.card),
          ...round.tricks.flatMap((trick) =>
            trick.plays.map((play) => play.card),
          ),
        ];
        expect(all).toHaveLength(32);
        expect(new Set(all.map(cardId)).size).toBe(32);
        expect(before.hands[actor].some((held) => sameCard(held, chosen))).toBe(
          true,
        );
        expect(round.hands[actor].some((held) => sameCard(held, chosen))).toBe(
          false,
        );
        if ((i + 1) % 4 === 0 && i < 31)
          expect(round.turn).toBe(round.tricks.at(-1)!.winner);
        else if (i < 31) expect(round.turn).toBe(nextSeat(actor));
      }
      expect(round.phase).toBe('complete');
      expect(round.tricks).toHaveLength(8);
      expect(round.trick).toEqual([]);
      expect(round.turn).toBeNull();
      expect(countTricks(round).reduce((a, b) => a + b)).toBe(8);
      expectCode(() => playCard(round, 0, createDeck()[0]!), 'WRONG_PHASE');
    }
  });
});

describe('confirmed scoring and unresolved combinations', () => {
  it.each([0, 1] as const)(
    'awards 1 for selector win and 2 for selector loss, selecting seat %s',
    (selector) => {
      const winner0 = withTricks(5, selector);
      const result = settleRound(winner0, freeze(createLedger()));
      expect(result.status).toBe('settled');
      if (result.status !== 'settled') throw new Error('fixture');
      expect(result.ledger.totals).toEqual(selector === 0 ? [1, 0] : [2, 0]);
      const winner1 = settleRound(withTricks(3, selector), createLedger());
      if (winner1.status !== 'settled') throw new Error('fixture');
      expect(winner1.ledger.totals).toEqual(selector === 1 ? [0, 1] : [0, 2]);
      expect(result.ledger.carry).toBe(0);
      expect(settleRound(winner0, result.ledger)).toEqual({
        status: 'already-settled',
        ledger: result.ledger,
      });
    },
  );
  it.each([0, 1] as const)(
    'awards only 3 for all eight tricks, regardless of selecting seat %s',
    (selector) => {
      for (const counts of [0, 8]) {
        const result = settleRound(
          withTricks(counts, selector),
          createLedger(),
        );
        if (result.status !== 'settled') throw new Error('fixture');
        expect(result.result).toBe('kapothi');
        expect(result.ledger.totals).toEqual(counts === 8 ? [3, 0] : [0, 3]);
        expect(result.ledger.entries[0]).toMatchObject({
          amount: 3,
          reason: 'kapothi',
        });
      }
    },
  );
  it('records a 4–4 carry and the confirmed draw then 2-point win totaling 3', () => {
    const draw = withTricks(4);
    const first = settleRound(draw, createLedger());
    if (first.status !== 'settled') throw new Error('fixture');
    expect(first.result).toBe('seporu');
    expect(first.ledger.totals).toEqual([0, 0]);
    expect(first.ledger.carry).toBe(1);
    const win = { ...withTricks(3, 0), id: 'after-draw' };
    const second = settleRound(win, freeze(first.ledger));
    if (second.status !== 'settled') throw new Error('fixture');
    expect(second.ledger.totals).toEqual([0, 3]);
    expect(second.ledger.carry).toBe(0);
    expect(second.ledger.entries).toHaveLength(2);
    const ordinaryWin = settleRound(
      { ...withTricks(5), id: 'ordinary-after-draw' },
      first.ledger,
    );
    if (ordinaryWin.status !== 'settled') throw new Error('fixture');
    expect(ordinaryWin.ledger.totals).toEqual([2, 0]);
  });
  it('blocks repeated draws and Kapothi carry combinations without changing the ledger', () => {
    const ledger: ScoreLedger = freeze({ ...createLedger(), carry: 1 });
    expect(settleRound(withTricks(4), ledger)).toEqual({
      status: 'unresolved',
      reason: 'REPEATED_DRAW',
    });
    expect(settleRound(withTricks(8), ledger)).toEqual({
      status: 'unresolved',
      reason: 'KAPOTHI_WITH_CARRY',
    });
    expect(ledger).toEqual({
      totals: [0, 0],
      carry: 1,
      settledRounds: [],
      entries: [],
    });
    expectCode(() => settleRound(ready(), ledger), 'ROUND_NOT_COMPLETE');
    expectCode(
      () => settleRound(withTricks(5), { ...ledger, carry: 2 as 1 }),
      'INVALID_CARRY',
    );
  });
});

function violationRound(): PrivateRound {
  for (let seed = 1; seed <= 50; seed++) {
    let round = ready(seed);
    round = playCard(round, round.turn!, round.hands[round.turn!][0]!);
    const actor = round.turn!;
    const lead = round.trick[0]!.card.suit;
    const offSuit = round.hands[actor].find((held) => held.suit !== lead);
    if (offSuit && round.hands[actor].some((held) => held.suit === lead))
      return playCard(round, actor, offSuit);
  }
  throw new Error('No violation fixture found');
}

describe('manual accusations only', () => {
  it('blocks adjudication until accusation-window policy is clarified', () => {
    const round = freeze(violationRound());
    const ledger = freeze(createLedger());
    const reporter = nextSeat(round.evidence[1]!.play.seat);
    expect(accuse(round, ledger, reporter, 1)).toEqual({
      status: 'unresolved',
      reason: 'ACCUSATION_WINDOW',
    });
    expect(accuse(round, ledger, reporter, 1, () => 'unresolved')).toEqual({
      status: 'unresolved',
      reason: 'ACCUSATION_WINDOW',
    });
    expect(accuse(round, ledger, reporter, 1, () => 'ineligible')).toEqual({
      status: 'invalid',
      reason: 'OUTSIDE_WINDOW',
    });
    expect(ledger.totals).toEqual([0, 0]);
  });
  it('verifies saved evidence and transfers exactly 3 once after a manual report with explicit test eligibility', () => {
    const round = freeze(violationRound());
    const offender = round.evidence[1]!.play.seat;
    const reporter = nextSeat(offender);
    const ledger = freeze(createLedger());
    const result = accuse(round, ledger, reporter, 1, () => 'eligible');
    if (result.status !== 'confirmed') throw new Error('fixture');
    expect(result.ledger.totals[teamOf(offender)]).toBe(-3);
    expect(result.ledger.totals[teamOf(reporter)]).toBe(3);
    expect(result.ledger.totals[0] + result.ledger.totals[1]).toBe(0);
    expect(result.ledger.entries).toHaveLength(1);
    const repeated = accuse(
      round,
      freeze(result.ledger),
      nextSeat(nextSeat(reporter)),
      1,
      () => 'eligible',
    );
    expect(repeated).toEqual({
      status: 'already-applied',
      ledger: result.ledger,
    });
    expect(round.evidence).toHaveLength(2);
    expect(ledger.entries).toEqual([]);
    // A cached flag alone is insufficient to establish a violation.
    const tampered = {
      ...round,
      evidence: round.evidence.map((item) => ({ ...item, handBefore: [] })),
    };
    expect(accuse(tampered, ledger, reporter, 1, () => 'eligible')).toEqual({
      status: 'invalid',
      reason: 'NO_VIOLATION',
    });
  });
  it('rejects self/team reports, unknown evidence and false accusations without a penalty', () => {
    const round = violationRound();
    const offender = round.evidence[1]!.play.seat;
    const ledger = freeze(createLedger());
    for (const reporter of [offender, nextSeat(nextSeat(offender))]) {
      expect(accuse(round, ledger, reporter, 1, () => 'eligible')).toEqual({
        status: 'invalid',
        reason: 'NOT_OPPONENT',
      });
    }
    expect(
      accuse(round, ledger, nextSeat(offender), 99, () => 'eligible'),
    ).toEqual({ status: 'invalid', reason: 'UNKNOWN_PLAY' });
    expect(
      accuse(
        round,
        ledger,
        nextSeat(round.evidence[0]!.play.seat),
        0,
        () => 'eligible',
      ),
    ).toEqual({ status: 'invalid', reason: 'NO_VIOLATION' });
    expectCode(() => accuse(round, ledger, 0, -1), 'INVALID_EVIDENCE_ID');
    expectCode(() => accuse(round, ledger, 4 as Seat, 1), 'INVALID_SEAT');
    expect(ledger.totals).toEqual([0, 0]);
  });
});

describe('no-trump report and round restart infrastructure', () => {
  it('requires an opposing reporter, explicit report basis, and no trump across both teammates', () => {
    const round = freeze(noTrumpRound());
    expect(reportNoTrump(round, 0)).toEqual({
      status: 'invalid',
      reason: 'NOT_OPPOSING_TEAM',
    });
    expect(reportNoTrump(round, 2)).toEqual({
      status: 'invalid',
      reason: 'NOT_OPPOSING_TEAM',
    });
    expect(reportNoTrump(round, 1)).toEqual({
      status: 'unresolved',
      reason: 'NO_TRUMP_REPORT_BASIS_OR_TIMING',
    });
    for (const reporter of [1, 3] as const) {
      const result = reportNoTrump(round, reporter, () => 'initial-deal');
      expect(result.status).toBe('confirmed');
      const current = reportNoTrump(round, reporter, () => 'current-hand');
      expect(current.status).toBe('confirmed');
    }
    let hasTrump = ready();
    const reporter = nextSeat(hasTrump.selector);
    // Find a deterministic actual deal where the opposite team holds trump.
    for (let seed = 1; seed <= 20; seed++) {
      hasTrump = ready(seed);
      if (
        hasTrump.hands.some(
          (hand, seat) =>
            teamOf(seat as Seat) === teamOf(reporter) &&
            hand.some((held) => held.suit === hasTrump.trump),
        )
      )
        break;
    }
    expect(reportNoTrump(hasTrump, reporter, () => 'initial-deal')).toEqual({
      status: 'invalid',
      reason: 'TEAM_HAS_TRUMP',
    });
    expectCode(
      () => reportNoTrump(createRound('not-dealt', 0, createDeck()), 1),
      'WRONG_PHASE',
    );
  });
  it('cancels only the round, blocks play, and requires an explicitly selected new dealer to restart', () => {
    const round = noTrumpRound();
    const ledger = freeze(createLedger());
    const report = reportNoTrump(round, 1, () => 'initial-deal');
    if (report.status !== 'confirmed') throw new Error('fixture');
    const cancelled = freeze(report.round);
    expect(cancelled.phase).toBe('cancelled');
    expect(cancelled.cancellation).toEqual({ reason: 'no-trump', reporter: 1 });
    expect(cancelled.turn).toBeNull();
    expectCode(() => playCard(cancelled, 0, round.hands[0][0]!), 'WRONG_PHASE');
    expectCode(() => settleRound(cancelled, ledger), 'ROUND_NOT_COMPLETE');
    expect(restartCancelledRound(cancelled, 'new', createDeck())).toEqual({
      status: 'unresolved',
      reason: 'REPLACEMENT_DEALER_SELECTION',
    });
    expectCode(
      () =>
        restartCancelledRound(cancelled, 'new', createDeck(), cancelled.dealer),
      'DEALER_MUST_CHANGE',
    );
    expectCode(
      () => restartCancelledRound(cancelled, cancelled.id, createDeck(), 0),
      'ROUND_ID_MUST_CHANGE',
    );
    expectCode(
      () => restartCancelledRound(round, 'new', createDeck(), 0),
      'ROUND_NOT_CANCELLED',
    );
    const shuffled = shuffleDeck(createDeck(), seeded(99));
    const restarted = restartCancelledRound(cancelled, 'new', shuffled, 0);
    if (restarted.status !== 'restarted') throw new Error('fixture');
    expect(restarted.round.phase).toBe('awaiting-cut');
    expect(restarted.round.dealer).toBe(0);
    expect(restarted.round.selector).toBe(1);
    expect(restarted.round.deck).toEqual(shuffled);
    expect(restarted.round.hands.flat()).toHaveLength(0);
    expect(restarted.round.trump).toBeNull();
    expect(restarted.round.evidence).toEqual([]);
    expect(restarted.round.tricks).toEqual([]);
    expect(ledger).toEqual(createLedger());
    const redealt = cutAndDeal(restarted.round, 3, 7);
    expect(redealt.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4]);
  });
});

describe('engine boundary regressions', () => {
  it('copies the supplied deck and submitted cards into private state', () => {
    const input = createDeck().map((item) => ({ ...item }));
    const initial = createRound('copy', 0, input);
    input[0]!.rank = '7';
    expect(initial.deck[0]).toEqual(card('spades', 'A'));
    const round = ready();
    const submitted = { ...round.hands[round.turn!][0]! };
    const expected = { ...submitted };
    const after = playCard(round, round.turn!, submitted);
    submitted.rank = submitted.rank === 'A' ? '7' : 'A';
    expect(after.trick[0]!.card).toEqual(expected);
    expect(after.evidence[0]!.play.card).toEqual(expected);
  });
  it('accumulates ordinary results, preserves carry and awards through manual transfers, and settles draws once', () => {
    const first = settleRound(withTricks(5), createLedger());
    if (first.status !== 'settled') throw new Error('fixture');
    const second = settleRound(
      { ...withTricks(3), id: 'second' },
      first.ledger,
    );
    if (second.status !== 'settled') throw new Error('fixture');
    expect(second.ledger.totals).toEqual([1, 2]);
    const thirdRound = { ...withTricks(4), id: 'third' };
    const draw = settleRound(thirdRound, second.ledger);
    if (draw.status !== 'settled') throw new Error('fixture');
    expect(settleRound(thirdRound, draw.ledger)).toEqual({
      status: 'already-settled',
      ledger: draw.ledger,
    });
    const round = violationRound();
    const offender = round.evidence[1]!.play.seat;
    const result = accuse(
      round,
      freeze(draw.ledger),
      nextSeat(offender),
      1,
      () => 'eligible',
    );
    if (result.status !== 'confirmed') throw new Error('fixture');
    expect(result.ledger.carry).toBe(1);
    expect(result.ledger.settledRounds).toEqual(draw.ledger.settledRounds);
    expect(result.ledger.totals[teamOf(offender)]).toBe(
      draw.ledger.totals[teamOf(offender)] - 3,
    );
    expect(result.ledger.totals[otherTeam(teamOf(offender))]).toBe(
      draw.ledger.totals[otherTeam(teamOf(offender))] + 3,
    );
  });
  it('denies no-trump reports when only the reporter is void and the teammate still has trump', () => {
    const original = noTrumpRound();
    const hands = original.hands.map((hand) => [...hand]);
    const spade = hands[0]!.shift()!;
    const diamond = hands[3]!.shift()!;
    hands[0]!.push(diamond);
    hands[3]!.push(spade);
    const round = {
      ...original,
      hands: hands as unknown as PrivateRound['hands'],
      dealtHands: hands as unknown as PrivateRound['dealtHands'],
    };
    expect(round.hands[1].some((held) => held.suit === round.trump)).toBe(
      false,
    );
    expect(reportNoTrump(round, 1, () => 'initial-deal')).toEqual({
      status: 'invalid',
      reason: 'TEAM_HAS_TRUMP',
    });
    expect(reportNoTrump(original, 1, () => 'ineligible')).toEqual({
      status: 'invalid',
      reason: 'OUTSIDE_REPORT_WINDOW',
    });
  });
  it('supports distinct verified reports without conflating different round evidence', () => {
    const round = violationRound();
    const actor = nextSeat(round.evidence[1]!.play.seat);
    const first = accuse(round, createLedger(), actor, 1, () => 'eligible');
    if (first.status !== 'confirmed') throw new Error('fixture');
    const second = accuse(
      { ...round, id: `${round.id}:1` },
      first.ledger,
      actor,
      1,
      () => 'eligible',
    );
    if (second.status !== 'confirmed') throw new Error('fixture');
    expect(second.ledger.entries).toHaveLength(2);
    expect(second.ledger.totals[teamOf(actor)]).toBe(6);
  });
});

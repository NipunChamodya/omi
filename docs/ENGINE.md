# Standalone engine API — Stage B

Import from `@omi/game-engine` after `npm run build`. The package has no runtime dependencies and is not yet wired to the backend.

## Trusted ownership

The future server owns every `PrivateRound` and `ScoreLedger`. Never send either entire object to players or logs: they contain hidden hands and cheating evidence. Stage C must construct explicit player-specific views and sanitize errors. Caller-supplied actors must be authenticated by that layer. The engine validates game actions, not authentication, untrusted JSON, concurrency or storage hydration.

Production entropy is supplied by the trusted caller using a secure bounded-integer generator, such as `node:crypto`'s `randomInt`. The engine deliberately has no default randomness. Bad sample bounds are rejected, but randomness quality cannot be inferred from samples.

```ts
// Example trusted caller only; not implemented as a backend endpoint in Stage B.
import { randomInt } from 'node:crypto';
import {
  chooseInitialDealer,
  createDeck,
  shuffleDeck,
  createRound,
  leftOf,
  cutAndDeal,
  selectTrump,
  playCard,
  createLedger,
  settleRound,
} from '@omi/game-engine';

const dealer = chooseInitialDealer(randomInt);
let round = createRound(
  'unique-round-id',
  dealer,
  shuffleDeck(createDeck(), randomInt),
);
// offset comes from an authenticated interactive cut action by this actor:
round = cutAndDeal(round, leftOf(dealer), 10);
// The authenticated selector supplies their chosen eligible suit:
round = selectTrump(
  round,
  round.selector,
  round.hands[round.selector][0]!.suit,
);
// Real players choose cards; this only demonstrates a legal action shape:
round = playCard(round, round.turn!, round.hands[round.turn!][0]!);
let ledger = createLedger();
// After all 32 plays:
if (round.phase === 'complete') {
  const result = settleRound(round, ledger);
  if (result.status === 'settled') ledger = result.ledger;
}
```

`createRound` requires four seats implicitly through fixed four-hand tuples and validates all 32 unique cards. Cards are `{ suit, rank }`. Seats increase counterclockwise: right is +1, left is +3 modulo 4. Teammates share parity. Ranks are A, K, Q, J, 10, 9, 8, 7. No lower ranks enter the playing deck.

`cutAndDeal` rotates a shuffled deck at offset 1–31, then gives consecutive four-card batches starting at the dealer's right. `selectTrump` checks the first four before completing hands. `resolveTrick` checks four distinct cards in counterclockwise order and selects highest trump, otherwise highest lead-suit card. `playCard` accepts off-suit deception even when lead suit is held.

## Private evidence and manual accusation

Every play records an original eight-card deal (on the round), a per-play hand-before copy, lead suit, trick index, actor/card and a private derived violation flag. There is no emitted warning, broadcast, automatic accusation or score mutation during play.

`accuse(round, ledger, reporter, playId, window?)` checks opposing team, saved evidence and an explicit trusted policy returning `eligible`, `ineligible` or `unresolved`. Omitting the policy leaves the window unresolved. Only an eligible verified manual report transfers three points. The same round/play evidence cannot pay twice in one ledger. There is no false-accusation penalty. Adjudication results are also server-private and must not become a hidden-hand oracle.

## Scoring

`createLedger` starts bookkeeping totals at zero; it does not invent a starting physical inventory of scoring cards. Each award increments the winning team's total. An accusation transfer decrements the offending team by three and increments opponents by three. Negative bookkeeping totals are possible; no floor or physical counter-pool policy is assumed. `entries` preserve reasons; `settledRounds` prevent scoring a round twice. Preserve the returned ledger across rounds/retries; globally unique round IDs are the trusted caller's responsibility.

`settleRound` derives outcomes from completed trick winners and selector's team. It awards 1 for an ordinary selector win, 2 for an ordinary selector loss, 3 for winning all eight. A single draw adds no current award and retains one carry. An ordinary following winner receives that carry, including the confirmed 2+1=3 example. Repeated draws and Kapothi plus carry return unresolved and leave inputs untouched. It does not settle cancelled rounds or decide when a match ends.

## No-trump cancellation and restart

`reportNoTrump(round, reporter, policy?)` checks the reporting team is opposite the selector. No default report basis/timing is installed. The policy can return `initial-deal` or `current-hand` only when an owner-confirmed reporting window permits it, `ineligible` when outside that window, or `unresolved`. It then checks both teammates' hands. These are extension points, not alternative rules exposed to players.

A confirmed report returns a cancelled private round. It produces no score entry. `restartCancelledRound(cancelled, newId, reshuffledDeck, replacementDealer?)` returns unresolved if no dealer is supplied; otherwise it validates a different seat and new ID and returns a clean round awaiting another interactive cut. The caller invokes `shuffleDeck` again before restart; the engine cannot prove that a supplied permutation is freshly random. No normal dealer rotation is invented.

## Error and state contracts

Invalid game actions throw `EngineError` with a stable `code`. Unresolved rules and adjudication outcomes are explicit tagged results. Transitions do not mutate their input, but readonly types are compile-time contracts; returned objects are not deep-frozen in production. Future server code must keep state private, preserve authoritative references and never accept a client-supplied replacement state or policy.

Active round play is bounded to 32 evidence records, eight tricks, four current-trick slots and four eight-card hands. Ledger history grows with rounds; persistence, retention and room lifecycle limits belong to later stages. No clocks, automatic round advancement or background processing exist here.

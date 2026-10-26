/** Standalone engine. PrivateRound and adjudication results MUST remain server-private. */
export {
  SUITS,
  RANKS,
  EngineError,
  nextSeat,
  leftOf,
  teamOf,
  otherTeam,
  cardId,
  sameCard,
  createDeck,
  chooseInitialDealer,
  shuffleDeck,
  cutDeck,
} from './cards.js';
export type { Card, Suit, Rank, Seat, Team, Four, RandomInt } from './cards.js';
export {
  createRound,
  cutAndDeal,
  selectTrump,
  resolveTrick,
  playCard,
  countTricks,
  reportNoTrump,
  restartCancelledRound,
} from './round.js';
export type {
  Play,
  Trick,
  PlayEvidence,
  RoundPhase,
  PrivateRound,
  NoTrumpBasis,
  NoTrumpPolicy,
  NoTrumpReport,
  RestartResult,
} from './round.js';
export { createLedger, settleRound } from './scoring.js';
export type { ScoreLedger, LedgerEntry, Settlement } from './scoring.js';
export { accuse } from './accusations.js';
export type { AccusationWindow, AccusationResult } from './accusations.js';

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type Card = Readonly<{ suit: Suit; rank: Rank }>;
/** Seats increase counterclockwise; a player's right is +1 and left is +3. */
export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export type Four<T> = readonly [T, T, T, T];
/** Trusted caller supplies secure bounded integers in production; no Math.random fallback. */
export type RandomInt = (upperExclusive: number) => number;

export class EngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'EngineError';
  }
}
export function requireRule(
  condition: unknown,
  code: string,
): asserts condition {
  if (!condition) throw new EngineError(code);
}
export function assertSeat(value: number): asserts value is Seat {
  requireRule(
    Number.isInteger(value) && value >= 0 && value < 4,
    'INVALID_SEAT',
  );
}
export function nextSeat(seat: Seat): Seat {
  assertSeat(seat);
  return ((seat + 1) % 4) as Seat;
}
export function leftOf(seat: Seat): Seat {
  assertSeat(seat);
  return ((seat + 3) % 4) as Seat;
}
export function teamOf(seat: Seat): Team {
  assertSeat(seat);
  return (seat % 2) as Team;
}
export function otherTeam(team: Team): Team {
  requireRule(team === 0 || team === 1, 'INVALID_TEAM');
  return team === 0 ? 1 : 0;
}
export function cardId(card: Card): string {
  return `${card.suit}:${card.rank}`;
}
export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}
export function assertCard(card: Card): void {
  requireRule(
    SUITS.includes(card.suit) && RANKS.includes(card.rank),
    'INVALID_CARD',
  );
}
export function createDeck(): readonly Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}
export function assertDeck(deck: readonly Card[]): void {
  requireRule(deck.length === 32, 'INVALID_DECK');
  for (const card of deck) assertCard(card);
  requireRule(new Set(deck.map(cardId)).size === 32, 'INVALID_DECK');
}
function sample(randomInt: RandomInt, bound: number): number {
  const value = randomInt(bound);
  requireRule(
    Number.isInteger(value) && value >= 0 && value < bound,
    'INVALID_ENTROPY',
  );
  return value;
}
export function chooseInitialDealer(randomInt: RandomInt): Seat {
  return sample(randomInt, 4) as Seat;
}
export function shuffleDeck(
  deck: readonly Card[],
  randomInt: RandomInt,
): readonly Card[] {
  assertDeck(deck);
  const shuffled = deck.map((card) => ({ ...card }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = sample(randomInt, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
/** Lift the first offset cards to the bottom. A real cut uses two nonempty piles. */
export function cutDeck(
  deck: readonly Card[],
  offset: number,
): readonly Card[] {
  assertDeck(deck);
  requireRule(
    Number.isInteger(offset) && offset > 0 && offset < 32,
    'INVALID_CUT',
  );
  return [...deck.slice(offset), ...deck.slice(0, offset)].map((card) => ({
    ...card,
  }));
}

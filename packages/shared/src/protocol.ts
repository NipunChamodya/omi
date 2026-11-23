/** Public wire contracts only. Never add engine state, deck order or private evidence here. */
export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Card = Readonly<{
  suit: Suit;
  rank: 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7';
}>;
export type Four<T> = readonly [T, T, T, T];
export type Phase =
  'awaiting-cut' | 'awaiting-trump' | 'playing' | 'complete' | 'cancelled';
export type PublicPlay = Readonly<{ seat: Seat; card: Card }>;
export type PublicTrick = Readonly<{
  plays: readonly PublicPlay[];
  winner: Seat;
}>;
export type Member = Readonly<{
  actorId: string;
  displayName: string;
  seat: Seat;
  team: Team;
  ready: boolean;
  connected: boolean;
  bot?: boolean;
  disconnectDeadline?: number | undefined;
  avatarUrl?: string | null;
}>;
export type Score = Readonly<{
  totals: readonly [number, number];
  carry: 0 | 1;
  final?:
    | Readonly<{
        reason: 'inventory_depleted' | 'loan_loss' | 'ranked_forfeit';
        winner: Team;
        loser: Team;
        roundId: string;
      }>
    | Readonly<{
        reason: 'double_forfeit';
        winner: null;
        loser: null;
        roundId: string;
      }>
    | null;
}>;
export type RoundResult = null | Readonly<{
  status: 'settled';
  outcome: 'seporu' | 'selector-win' | 'selector-loss' | 'kapothi' | 'baldu';
  tricks: readonly [number, number];
}>;
export type RoundHeader = Readonly<{
  id: string;
  phase: Phase;
  dealer: Seat;
  selector: Seat;
  trump: Suit | null;
  turn: Seat | null;
}>;
export type PlayerGame = RoundHeader &
  Readonly<{
    hand: readonly Card[];
    handCounts: Four<number>;
    trick: readonly PublicPlay[];
    tricks: readonly PublicTrick[];
  }>;
export type Snapshot = Readonly<{
  ranked?: boolean;
  capabilities?: Readonly<{ nextRound: boolean }>;
  type: 'snapshot';
  roomId: string;
  requestId: string | null;
  version: number;
  code: string;
  hostId: string;
  you: Readonly<{ actorId: string; seat: Seat; team: Team }>;
  members: readonly Member[];
  game: PlayerGame | null;
  score: Score;
  result: RoundResult;
}>;
export type RoomDescriptor = Readonly<{
  roomId: string;
  code: string;
  version: number;
  memberCount: number;
  invitePath: string;
}>;
export type GuestIdentity = Readonly<{
  actorId: string;
  displayName: string;
  expiresAt: number;
}>;

type Envelope = Readonly<{
  roomId: string;
  actorId: string;
  actionId: string;
  expectedVersion: number;
}>;
export type ClientCommand = Envelope &
  (
    | Readonly<{ type: 'ready'; payload: Readonly<{ ready: boolean }> }>
    | Readonly<{
        type:
          | 'start'
          | 'leave-match'
          | 'add-bot'
          | 'sync'
          | 'report-no-trump'
          | 'restart'
          | 'next-round';
        payload: Record<string, never>;
      }>
    | Readonly<{ type: 'cut'; payload: Readonly<{ offset: number }> }>
    | Readonly<{ type: 'trump'; payload: Readonly<{ suit: Suit }> }>
    | Readonly<{ type: 'play'; payload: Readonly<{ card: Card }> }>
    | Readonly<{ type: 'accuse'; payload: Readonly<{ playId: number }> }>
  );
export type RoomEvent =
  | Readonly<{ kind: 'member-joined'; member: Member }>
  | Readonly<{ kind: 'member-updated'; member: Member }>
  | Readonly<{
      kind: 'presence';
      seat: Seat;
      connected: boolean;
      bot?: boolean;
      disconnectDeadline?: number | null;
    }>
  | Readonly<{ kind: 'match-ended'; score: Score }>
  | Readonly<{ kind: 'ready'; seat: Seat; ready: boolean }>
  | Readonly<{
      kind: 'round-started';
      cancelledBy?: Seat;
      round: RoundHeader;
      handCounts: Four<number>;
    }>
  | Readonly<{
      kind: 'cards-dealt';
      stage: 'first' | 'second';
      round: RoundHeader;
      hand: readonly Card[];
      handCounts: Four<number>;
    }>
  | Readonly<{
      kind: 'card-played';
      seat: Seat;
      card: Card;
      turn: Seat | null;
      phase: Phase;
      handCounts: Four<number>;
      completedTrick: PublicTrick | null;
      score: Score;
      result: RoundResult;
    }>
  | Readonly<{
      kind: 'score-transferred';
      from: Team;
      to: Team;
      amount: 3;
      score: Score;
      result?: RoundResult;
    }>
  | Readonly<{ kind: 'round-cancelled'; reporter: Seat }>;
export type Ack = Readonly<{
  type: 'ack';
  roomId: string;
  actionId: string;
  version: number;
  duplicate: boolean;
}>;
export type Failure = Readonly<{
  type: 'error';
  roomId: string | null;
  actionId: string | null;
  code: string;
  version: number | null;
}>;
export type EventMessage = Readonly<{
  type: 'event';
  roomId: string;
  fromVersion: number;
  version: number;
  event: RoomEvent;
}>;
export type ServerMessage = Snapshot | Ack | Failure | EventMessage;

export type PublicProfile = Readonly<{
  id: string;
  displayName: string;
  googleAvatarUrl: string | null;
  avatarUrl: string | null;
  thumbnailUrl: string | null;
  version: number;
}>;
export type FriendAction =
  'request' | 'accept' | 'remove' | 'block' | 'unblock';
export type FriendContact = Readonly<{
  id: string;
  displayName: string;
  status: 'incoming' | 'sent' | 'accepted' | 'blocked';
}>;
export type RatingOverview = Readonly<{
  rating: number;
  history: readonly { previous: number; rating: number; completedAt: number }[];
  leaders: readonly { name: string; rating: number }[];
}>;
export type MatchStatistics = Readonly<{
  experimentalRating?: RatingOverview;
  played: number;
  wins: number;
  rankedWins: number;
  casualWins: number;
  loanLosses: number;
  rankedForfeitLosses: number;
  recent: readonly Readonly<{
    completedAt: number;
    won: boolean;
    ranked: boolean;
    reason: NonNullable<Score['final']>['reason'];
  }>[];
}>;
export type AuthSession = Readonly<{
  user: PublicProfile | null;
  statistics?: MatchStatistics;
  csrfToken: string | null;
  expiresAt: number | null;
  googleAvailable: boolean;
  guestAllowed: boolean;
  avatarUploadsEnabled: boolean;
  room: RoomDescriptor | null;
}>;

import { describe, expect, it } from 'vitest';
import type { EventMessage, RoomEvent, Snapshot } from '@omi/shared';
import { applyEvent } from './reducer';
export const sample = (): Snapshot => ({
  type: 'snapshot',
  roomId: '11111111-1111-4111-8111-111111111111',
  requestId: null,
  version: 1,
  code: 'ABCD2345',
  hostId: '22222222-2222-4222-8222-222222222222',
  you: { actorId: '22222222-2222-4222-8222-222222222222', seat: 0, team: 0 },
  members: [0, 1, 2, 3].map((seat) => ({
    actorId:
      seat === 0 ? '22222222-2222-4222-8222-222222222222' : `player-${seat}`,
    seat: seat as 0 | 1 | 2 | 3,
    team: (seat % 2) as 0 | 1,
    displayName: ['Nipun', 'Kamal', 'Nimali', 'Amila'][seat]!,
    ready: true,
    connected: true,
  })),
  game: {
    id: 'round',
    phase: 'playing',
    dealer: 3,
    selector: 0,
    trump: 'hearts',
    turn: 0,
    hand: [
      { suit: 'spades', rank: 'A' },
      { suit: 'hearts', rank: '7' },
    ],
    handCounts: [2, 2, 2, 2],
    trick: [],
    tricks: [],
  },
  score: { totals: [0, 0], carry: 0 },
  result: null,
});
const event = (payload: RoomEvent, state = sample()): EventMessage => ({
  type: 'event',
  roomId: state.roomId,
  fromVersion: state.version,
  version: state.version + 1,
  event: payload,
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
describe('public client projection', () => {
  it('ignores duplicate, older and foreign-room events and requests sync on gaps', () => {
    const state = freeze(sample());
    const message = event({ kind: 'presence', seat: 1, connected: false });
    expect(applyEvent(state, { ...message, version: 1 })).toBe(state);
    expect(applyEvent(state, { ...message, roomId: 'other' })).toBe(state);
    expect(
      applyEvent(state, { ...message, fromVersion: 2, version: 3 }),
    ).toBeNull();
    expect(applyEvent(state, { ...message, version: 5 })).toBeNull();
  });
  it('applies membership, ready and presence updates without mutating prior state', () => {
    const state = freeze(sample());
    expect(
      applyEvent(state, event({ kind: 'presence', seat: 1, connected: false }))!
        .members[1]!.connected,
    ).toBe(false);
    expect(
      applyEvent(state, event({ kind: 'ready', seat: 0, ready: false }))!
        .members[0]!.ready,
    ).toBe(false);
    const lobby = { ...state, members: state.members.slice(0, 3) };
    expect(
      applyEvent(
        lobby,
        event({ kind: 'member-joined', member: state.members[3]! }, lobby),
      )!.members,
    ).toHaveLength(4);
    const updated = applyEvent(
      state,
      event({
        kind: 'member-updated',
        member: {
          ...state.members[1]!,
          displayName: 'Updated',
          avatarUrl: '/avatars/test/thumbnail.webp',
        },
      }),
    )!;
    expect(updated.members[1]!.displayName).toBe('Updated');
    expect(updated.members[1]!.avatarUrl).toContain('/avatars/');
    expect(updated.game).toBe(state.game);
    expect(state.members[0]!.ready).toBe(true);
  });
  it('starts fresh rounds and uses only the recipient hand in deal events', () => {
    const state = freeze(sample());
    const header = {
      id: 'new',
      phase: 'awaiting-cut' as const,
      dealer: 1 as const,
      selector: 2 as const,
      trump: null,
      turn: null,
    };
    const started = applyEvent(
      state,
      event({ kind: 'round-started', round: header, handCounts: [0, 0, 0, 0] }),
    )!;
    expect(started.game!.hand).toEqual([]);
    expect(started.game!.tricks).toEqual([]);
    const dealt = applyEvent(
      started,
      event(
        {
          kind: 'cards-dealt',
          stage: 'first',
          round: { ...header, phase: 'awaiting-trump', turn: 2 },
          hand: [{ suit: 'clubs', rank: 'K' }],
          handCounts: [4, 4, 4, 4],
        },
        started,
      ),
    )!;
    expect(dealt.game!.hand).toEqual([{ suit: 'clubs', rank: 'K' }]);
    expect(dealt.game).not.toHaveProperty('hands');
  });
  it('removes only a confirmed local play and never filters or warns about off-suit cards', () => {
    const state = freeze(sample());
    const played = {
      kind: 'card-played' as const,
      seat: 0 as const,
      card: state.game!.hand[1]!,
      turn: 1 as const,
      phase: 'playing' as const,
      handCounts: [1, 2, 2, 2] as const,
      completedTrick: null,
      score: state.score,
      result: null,
    };
    const next = applyEvent(state, event(played))!;
    expect(next.game!.hand).toEqual([state.game!.hand[0]]);
    expect(next.game!.trick).toEqual([{ seat: 0, card: played.card }]);
    expect(state.game!.hand).toHaveLength(2);
    const other = applyEvent(
      state,
      event({ ...played, seat: 1, card: { suit: 'clubs', rank: 'A' } }),
    )!;
    expect(other.game!.hand).toBe(state.game!.hand);
    expect(other).not.toHaveProperty('violation');
  });
  it('records only completed public tricks and server-provided scores/results', () => {
    const state = freeze(sample());
    const trick = {
      plays: [{ seat: 0 as const, card: state.game!.hand[0]! }],
      winner: 0 as const,
    };
    const result = {
      status: 'settled' as const,
      outcome: 'selector-win' as const,
      tricks: [5, 3] as const,
    };
    const next = applyEvent(
      state,
      event({
        kind: 'card-played',
        seat: 3,
        card: { suit: 'clubs', rank: '7' },
        turn: null,
        phase: 'complete',
        handCounts: [0, 0, 0, 0],
        completedTrick: trick,
        score: { totals: [1, 0], carry: 0 },
        result,
      }),
    )!;
    expect(next.game!.trick).toEqual([]);
    expect(next.game!.tricks).toEqual([trick]);
    expect(next.score.totals).toEqual([1, 0]);
    expect(next.result).toEqual(result);
  });
  it('applies only confirmed cancellation/score transfer events', () => {
    const state = freeze(sample());
    expect(
      applyEvent(state, event({ kind: 'round-cancelled', reporter: 1 }))!.game!
        .phase,
    ).toBe('cancelled');
    const transfer = applyEvent(
      state,
      event({
        kind: 'score-transferred',
        from: 1,
        to: 0,
        amount: 3,
        score: { totals: [3, -3], carry: 0 },
      }),
    )!;
    expect(transfer.score.totals).toEqual([3, -3]);
    expect(state.score.totals).toEqual([0, 0]);
  });
});

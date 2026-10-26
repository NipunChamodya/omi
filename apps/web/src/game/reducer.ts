import type { EventMessage, Snapshot } from '@omi/shared';
const sameCard = (
  a: { suit: string; rank: string },
  b: { suit: string; rank: string },
) => a.suit === b.suit && a.rank === b.rank;
/** null means a version gap: request a private snapshot instead of guessing state. */
export function applyEvent(
  state: Snapshot,
  message: EventMessage,
): Snapshot | null {
  if (message.roomId !== state.roomId || message.version <= state.version)
    return state;
  if (
    message.fromVersion !== state.version ||
    message.version !== message.fromVersion + 1
  )
    return null;
  const next = { ...state, version: message.version };
  const event = message.event;
  switch (event.kind) {
    case 'member-joined':
      return { ...next, members: [...state.members, event.member] };
    case 'ready':
      return {
        ...next,
        members: state.members.map((member) =>
          member.seat === event.seat
            ? { ...member, ready: event.ready }
            : member,
        ),
      };
    case 'presence':
      return {
        ...next,
        members: state.members.map((member) =>
          member.seat === event.seat
            ? { ...member, connected: event.connected }
            : member,
        ),
      };
    case 'round-started':
      return {
        ...next,
        game: {
          ...event.round,
          hand: [],
          handCounts: event.handCounts,
          trick: [],
          tricks: [],
        },
        result: null,
      };
    case 'cards-dealt':
      if (!state.game) return null;
      return {
        ...next,
        game: {
          ...state.game,
          ...event.round,
          hand: event.hand,
          handCounts: event.handCounts,
        },
      };
    case 'card-played': {
      if (!state.game) return null;
      const game = state.game;
      return {
        ...next,
        game: {
          ...game,
          phase: event.phase,
          turn: event.turn,
          handCounts: event.handCounts,
          hand:
            event.seat === state.you.seat
              ? game.hand.filter((card) => !sameCard(card, event.card))
              : game.hand,
          trick: event.completedTrick
            ? []
            : [...game.trick, { seat: event.seat, card: event.card }],
          tricks: event.completedTrick
            ? [...game.tricks, event.completedTrick]
            : game.tricks,
        },
        score: event.score,
        result: event.result,
      };
    }
    case 'score-transferred':
      return { ...next, score: event.score };
    case 'round-cancelled':
      return state.game
        ? { ...next, game: { ...state.game, phase: 'cancelled', turn: null } }
        : null;
  }
}

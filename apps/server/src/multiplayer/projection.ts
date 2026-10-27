import type {
  Card,
  Four,
  Member,
  PublicTrick,
  RoundHeader,
  Score,
  Snapshot,
} from '@omi/shared';
import type { PrivateRound, ScoreLedger } from '@omi/game-engine';
import { teamOf } from '@omi/game-engine';
import type { Room, RoomMember } from './rooms.js';

export const publicCard = (card: Card): Card => ({
  suit: card.suit,
  rank: card.rank,
});
export function publicMember(room: Room, member: RoomMember): Member {
  return {
    actorId: member.actorId,
    displayName: member.displayName,
    seat: member.seat,
    team: teamOf(member.seat),
    ready: member.ready,
    connected: room.peers.has(member.actorId),
    avatarUrl: member.avatarUrl ?? null,
  };
}
export function roundHeader(round: PrivateRound): RoundHeader {
  return {
    id: round.id,
    phase: round.phase,
    dealer: round.dealer,
    selector: round.selector,
    trump: round.trump,
    turn: round.turn,
  };
}
export function handCounts(round: PrivateRound): Four<number> {
  return [
    round.hands[0].length,
    round.hands[1].length,
    round.hands[2].length,
    round.hands[3].length,
  ];
}
export function publicTrick(
  trick: PrivateRound['tricks'][number],
): PublicTrick {
  return {
    winner: trick.winner,
    plays: trick.plays.map((play) => ({
      seat: play.seat,
      card: publicCard(play.card),
    })),
  };
}
export function publicScore(ledger: ScoreLedger): Score {
  return { totals: [ledger.totals[0], ledger.totals[1]], carry: ledger.carry };
}
/** Explicit whitelist. Never spread a private engine object or ledger onto the wire. */
export function snapshot(
  room: Room,
  member: RoomMember,
  requestId: string | null = null,
  nextRoundConfigured = false,
): Snapshot {
  const round = room.round;
  return {
    capabilities: { nextRound: nextRoundConfigured },
    type: 'snapshot',
    roomId: room.id,
    requestId,
    version: room.version,
    code: room.code,
    hostId: room.hostId,
    you: {
      actorId: member.actorId,
      seat: member.seat,
      team: teamOf(member.seat),
    },
    members: room.members.map((item) => publicMember(room, item)),
    game: round
      ? {
          ...roundHeader(round),
          hand: round.hands[member.seat].map(publicCard),
          handCounts: handCounts(round),
          trick: round.trick.map((play) => ({
            seat: play.seat,
            card: publicCard(play.card),
          })),
          tricks: round.tricks.map(publicTrick),
        }
      : null,
    score: publicScore(room.ledger),
    result: room.result,
  };
}

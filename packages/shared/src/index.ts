export interface HealthResponse {
  status: 'ok';
  service: 'omi-server';
}
export type {
  Seat,
  Team,
  Suit,
  Card,
  Four,
  Phase,
  PublicPlay,
  PublicTrick,
  Member,
  Score,
  RoundResult,
  RoundHeader,
  PlayerGame,
  Snapshot,
  RoomDescriptor,
  GuestIdentity,
  ClientCommand,
  RoomEvent,
  Ack,
  Failure,
  EventMessage,
  ServerMessage,
} from './protocol.js';

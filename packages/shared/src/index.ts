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

export type { PublicProfile, AuthSession } from './protocol.js';
export type {
  VoiceParticipant,
  VoiceSignal,
  VoiceCommand,
  VoiceMessage,
  VoiceConfig,
} from './voice.js';
export {
  quickPhrases,
  reactions,
  musicTracks,
  musicPosition,
  trimChat,
  validSocialText,
} from './social.js';
export type {
  MusicTrackId,
  MusicState,
  ChatEntry,
  ReactionEntry,
  ReportReason,
  SocialReport,
  SocialPayload,
  SocialCommand,
  SocialMessage,
  SocialReply,
} from './social.js';

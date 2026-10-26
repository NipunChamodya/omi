/** Public signaling only. Never contains engine state or audio samples. */
export type VoiceParticipant = {
  actorId: string;
  callId: string;
  muted: boolean;
};
export type VoiceSignal =
  | {
      kind: 'description';
      description: { type: 'offer' | 'answer'; sdp: string };
    }
  | {
      kind: 'candidate';
      candidate: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment?: string | null | undefined;
      };
    };
export type VoiceCommand = {
  roomId: string;
  actorId: string;
  callId: string;
  actionId: string;
  /** Per-connection signaling sequence; independent of game state/version. */
  expectedVersion: number;
} & (
  | {
      type: 'signal';
      target: { actorId: string; callId: string };
      payload: VoiceSignal;
    }
  | { type: 'mute'; payload: { muted: boolean } }
);
export type VoiceMessage =
  | { type: 'hello'; self: VoiceParticipant; peers: VoiceParticipant[] }
  | { type: 'joined' | 'updated'; peer: VoiceParticipant }
  | { type: 'left'; actorId: string; callId: string }
  | { type: 'signal'; from: VoiceParticipant; payload: VoiceSignal }
  | { type: 'ack'; actionId: string; version: number };
export type VoiceConfig = {
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  iceTransportPolicy: 'all' | 'relay';
  expiresAt: number;
  relayAvailable: boolean;
};

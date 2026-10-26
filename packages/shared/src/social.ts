export const quickPhrases = [
  { id: 'well-played', text: 'Well played! 👏' },
  { id: 'good-hand', text: 'හොඳ අතක්! 👏' },
  { id: 'wait', text: 'පොඩ්ඩක් ඉන්න 🙏' },
  { id: 'ready', text: 'හරි, සෙල්ලම් කරමු! 🃏' },
] as const;
export const reactions = [
  { id: 'tap', text: 'ටක් ටක්! · Table tap', adult: false, sound: 'tap' },
  { id: 'aiyo', text: 'අයියෝ! 😂', adult: false, sound: 'chuckle' },
  { id: 'nice', text: 'නියමයි! 👏', adult: false, sound: 'chime' },
  { id: 'what', text: 'හරි වැඩේ! 😅', adult: false, sound: 'chuckle' },
  { id: 'adult', text: 'මගුලයි! 🙈', adult: true, sound: 'chuckle' },
] as const;
export const musicTracks = [
  { id: 'emerald', title: 'Emerald evening', duration: 32 },
  { id: 'coast', title: 'Coastal breeze', duration: 32 },
] as const;
export type MusicTrackId = (typeof musicTracks)[number]['id'];
export type MusicState = {
  trackId: MusicTrackId;
  playing: boolean;
  position: number;
  updatedAt: number;
  version: number;
};
export type ChatEntry = {
  id: string;
  actorId: string;
  text: string;
  adult: boolean;
  createdAt: number;
};
export type ReactionEntry = {
  id: string;
  actorId: string;
  reactionId: (typeof reactions)[number]['id'];
  createdAt: number;
};
export type ReportReason = 'abuse' | 'harassment' | 'spam' | 'other';
export type SocialReport = {
  id: string;
  roomId: string;
  reporterId: string;
  subjectId: string;
  messageId: string;
  reason: ReportReason;
  note: string;
  messageText: string;
  messageCreatedAt: number;
  createdAt: number;
};
export type SocialPayload =
  | { type: 'chat'; payload: { text: string } }
  | { type: 'quick'; payload: { id: string } }
  | { type: 'reaction'; payload: { id: string } }
  | {
      type: 'music';
      payload:
        | { command: 'play' | 'pause'; musicVersion: number }
        | { command: 'seek'; position: number; musicVersion: number }
        | { command: 'track'; trackId: MusicTrackId; musicVersion: number };
    }
  | {
      type: 'report';
      payload: { messageId: string; reason: ReportReason; note: string };
    }
  | { type: 'clock'; payload: { sentAt: number } };
export type SocialCommand = {
  roomId: string;
  actorId: string;
  connectionId: string;
  actionId: string;
  expectedVersion: number;
} & SocialPayload;
export type SocialReply =
  | { type: 'ack'; actionId: string; version: number; reportId?: string }
  | {
      type: 'error';
      actionId: string;
      version: number;
      code: string;
      music?: MusicState;
    }
  | {
      type: 'clock';
      actionId: string;
      version: number;
      sentAt: number;
      serverTime: number;
    };
export type SocialMessage =
  | SocialReply
  | {
      type: 'snapshot';
      connectionId: string;
      hostId: string;
      history: ChatEntry[];
      music: MusicState;
      serverTime: number;
    }
  | { type: 'chat'; entry: ChatEntry }
  | { type: 'reaction'; entry: ReactionEntry }
  | { type: 'music'; music: MusicState; serverTime: number };
export function musicPosition(state: MusicState, now: number): number {
  const duration = musicTracks.find(
    (track) => track.id === state.trackId,
  )!.duration;
  return (
    (state.position +
      (state.playing ? Math.max(0, now - state.updatedAt) / 1000 : 0)) %
    duration
  );
}
export function trimChat(history: ChatEntry[]): ChatEntry[] {
  const result = history.slice(-30);
  while (new TextEncoder().encode(JSON.stringify(result)).length > 32_768)
    result.shift();
  return result;
}

export function validSocialText(value: string, max = 400): boolean {
  const text = value.trim();
  return (
    text.length > 0 &&
    text.length <= max &&
    text.split('\n').length <= 4 &&
    Array.from(text).every((character) => {
      const code = character.codePointAt(0)!;
      return (
        (code === 10 || code >= 32) &&
        !(code >= 127 && code <= 159) &&
        !(code >= 0x202a && code <= 0x202e) &&
        !(code >= 0x2066 && code <= 0x2069) &&
        !(code >= 0xd800 && code <= 0xdfff)
      );
    })
  );
}

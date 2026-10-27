import type { RoomDescriptor } from './protocol.js';
export type MatchmakingMessage =
  | { type: 'waiting'; waiting: number; needed: 4; blocked?: 'ROOM_CAPACITY' }
  | { type: 'matched'; room: RoomDescriptor }
  | { type: 'cancelled' }
  | { type: 'error'; code: string };

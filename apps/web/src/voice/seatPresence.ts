import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

type Speaking = { roomId: string; actors: ReadonlySet<string> } | null;
export const VoiceSeatPresence = createContext<StoreApi<Speaking> | null>(null);
export const createVoiceSeatPresence = () => createStore<Speaking>(() => null);
const silent = createVoiceSeatPresence();

export function useSeatSpeaking(roomId: string, actorId: string) {
  const store = useContext(VoiceSeatPresence) ?? silent;
  return useStore(
    store,
    (state) => state?.roomId === roomId && state.actors.has(actorId),
  );
}

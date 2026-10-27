import { create } from 'zustand';

export type SoundPreferences = {
  enabled: boolean;
  volume: number;
  cards: boolean;
  ui: boolean;
  celebrations: boolean;
  ambience: boolean;
  voice: number;
  motionMs: number;
};
export const soundDefaults: SoundPreferences = {
  enabled: true,
  volume: 0.35,
  cards: true,
  ui: true,
  celebrations: true,
  ambience: false,
  voice: 0.8,
  motionMs: 900,
};
export function readSoundPreferences(): SoundPreferences {
  const result = { ...soundDefaults };
  try {
    const saved = JSON.parse(localStorage.getItem('omi.sound.v1') ?? '{}');
    for (const key of [
      'enabled',
      'cards',
      'ui',
      'celebrations',
      'ambience',
    ] as const)
      if (typeof saved?.[key] === 'boolean') result[key] = saved[key];
    for (const key of ['volume', 'voice', 'motionMs'] as const) {
      const value = saved?.[key];
      if (typeof value === 'number' && Number.isFinite(value))
        result[key] = Math.max(
          key === 'motionMs' ? 400 : 0,
          Math.min(key === 'motionMs' ? 1600 : 1, value),
        );
    }
  } catch {
    /* Private browsing and malformed preferences use safe defaults. */
  }
  return result;
}
export const useSoundPreferences =
  create<SoundPreferences>(readSoundPreferences);
export function changeSoundPreferences(patch: Partial<SoundPreferences>) {
  useSoundPreferences.setState(patch);
  try {
    localStorage.setItem(
      'omi.sound.v1',
      JSON.stringify(useSoundPreferences.getState()),
    );
  } catch {
    /* Preferences remain available for this tab. */
  }
}

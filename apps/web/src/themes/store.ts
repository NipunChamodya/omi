import { createStore } from 'zustand/vanilla';
import { isThemeId, loadTheme } from './registry';
import type { ThemeId } from './registry';
export function readTheme(): ThemeId {
  try {
    const saved = localStorage.getItem('omi-card-theme');
    return isThemeId(saved) ? saved : 'classic';
  } catch {
    return 'classic';
  }
}
type State = {
  active: ThemeId;
  selected: ThemeId;
  loading: boolean;
  error: string | null;
  choose: (value: unknown) => Promise<void>;
};
// Dependencies are injectable so load races/errors can be tested deterministically.
export function createThemeStore(
  loader: (id: ThemeId) => Promise<unknown> = loadTheme,
) {
  let generation = 0;
  return createStore<State>((set) => ({
    active: 'classic',
    selected: readTheme(),
    loading: false,
    error: null,
    choose: async (value) => {
      if (!isThemeId(value)) return;
      const request = ++generation;
      set({ selected: value, loading: true, error: null });
      try {
        await loader(value);
        if (request !== generation) return;
        set({ active: value, selected: value, loading: false, error: null });
        try {
          localStorage.setItem('omi-card-theme', value);
        } catch {
          /* Choice remains usable for this tab. */
        }
      } catch {
        if (request !== generation) return;
        set({
          loading: false,
          error:
            'This card design could not load. Your current cards are still playable. Retry when connected.',
        });
      }
    },
  }));
}
export const themeStore = createThemeStore();

import { create } from 'zustand';
export function readDataSaver(): boolean {
  try {
    const saved = localStorage.getItem('omi-data-saver');
    if (saved === 'true' || saved === 'false') return saved === 'true';
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData === true
  );
}
export const useDataSaver = create<{
  enabled: boolean;
  set: (enabled: boolean) => void;
}>((set) => ({
  enabled: readDataSaver(),
  set: (enabled) => {
    try {
      localStorage.setItem('omi-data-saver', String(enabled));
    } catch {
      /* In-memory preference remains usable. */
    }
    set({ enabled });
  },
}));

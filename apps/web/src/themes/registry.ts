import classicCss from './classic.css?url';
import royalCss from './royal.css?url';
import classicBack from './artwork/classic-back.svg?no-inline';
import royalBack from './artwork/royal-back.svg?no-inline';
// URLs alone do not fetch artwork or styles. Only the active design is requested.
export const themes = [
  {
    id: 'classic',
    name: 'Classic OMI',
    description: 'Ivory faces, emerald filigree and familiar red suits.',
    css: classicCss,
    back: classicBack,
  },
  {
    id: 'royal',
    name: 'Royal Black & Gold',
    description: 'Midnight faces, warm gold detailing and rose-red suits.',
    css: royalCss,
    back: royalBack,
  },
] as const;
export type ThemeId = (typeof themes)[number]['id'];
export function isThemeId(value: unknown): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}
const loads = new Map<ThemeId, Promise<void>>();
export function loadTheme(id: ThemeId): Promise<void> {
  const existing = loads.get(id);
  if (existing) return existing;
  const theme = themes.find((theme) => theme.id === id)!;
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = theme.css;
    let settled = false;
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      link.onload = null;
      link.onerror = null;
      if (success) resolve();
      else {
        link.remove();
        loads.delete(id);
        reject(new Error('Theme stylesheet unavailable'));
      }
    };
    const timeout = setTimeout(() => finish(false), 12_000);
    link.onload = () => finish(true);
    link.onerror = () => finish(false);
    document.head.append(link);
  });
  loads.set(id, promise);
  return promise;
}

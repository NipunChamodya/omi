import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ClientState } from '../game/client';

export function gameScene(state: ClientState, booting: boolean) {
  if (booting) return 'boot';
  if (state.view !== 'room') return state.view === 'home' ? 'menu' : state.view;
  if (!state.snapshot) return 'recovery';
  if (!state.snapshot.game) return 'lobby';
  if (state.snapshot.score.final) return 'match-results';
  if (state.snapshot.game.phase === 'complete') return 'round-results';
  return 'gameplay';
}

/** Reuses the shell and live room children across transitions. */
export function useSceneEntrance(scene: string) {
  const element = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = element.current;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!node?.animate || motion?.matches || document.hidden) return;
    const animation = node.animate([{ opacity: 0.75 }, { opacity: 1 }], {
      duration: 220,
      easing: 'ease-out',
    });
    const reconcile = () => {
      if (motion?.matches || document.hidden) animation.cancel();
    };
    motion?.addEventListener('change', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      animation.cancel();
      motion?.removeEventListener('change', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [scene]);
  return element;
}

export function GameNavigation({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav className="game-dock" aria-label={label}>
      {children}
    </nav>
  );
}

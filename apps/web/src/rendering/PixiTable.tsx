import { useEffect, useRef, type RefObject } from 'react';
import { useDataSaver } from '../pwa/preferences';
import './pixi-table.css';

export function PixiTable({
  root,
  revealId,
}: {
  root: RefObject<HTMLDivElement | null>;
  revealId: string | null;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const reveal = useRef(revealId);
  const redraw = useRef<() => void>(undefined);
  const saver = useDataSaver((state) => state.enabled);

  useEffect(() => {
    reveal.current = revealId;
    redraw.current?.();
  }, [revealId]);

  useEffect(() => {
    const host = mount.current;
    const sceneRoot = root.current;
    if (!host || !sceneRoot || saver || !globalThis.ResizeObserver) return;
    const lifetime = new AbortController();
    void (async () => {
      // Install the interpreted shader path before initializing the renderer.
      await import('pixi.js/unsafe-eval');
      const { mountTableScene } = await import('./tableScene');
      const invalidate = await mountTableScene(
        host,
        sceneRoot,
        () => reveal.current,
        lifetime.signal,
      );
      if (!lifetime.signal.aborted) redraw.current = invalidate;
    })().catch(() => lifetime.abort());

    return () => {
      lifetime.abort();
      redraw.current = undefined;
    };
  }, [root, saver]);

  return <div ref={mount} className="pixi-table" aria-hidden="true" />;
}

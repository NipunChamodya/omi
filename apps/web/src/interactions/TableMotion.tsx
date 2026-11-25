import { useEffect, useState, type CSSProperties } from 'react';
import type { EventMessage } from '@omi/shared';
import { CardBack } from '../components/Cards';
import { useSoundPreferences } from '../audio/preferences';
import { useDataSaver } from '../pwa/preferences';

export function TableMotion({ message }: { message: EventMessage | null }) {
  const duration = useSoundPreferences((state) => state.motionMs);
  const saver = useDataSaver((state) => state.enabled);
  const kind = message?.event.kind;
  const id =
    message && (kind === 'round-started' || kind === 'cards-dealt')
      ? `${message.roomId}:${message.version}`
      : null;
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!id || saver || motion?.matches || document.hidden) {
      setActive(null);
      return;
    }
    setActive(id);
    const stop = () => setActive(null);
    const suspend = () => {
      if (document.hidden || motion?.matches) stop();
    };
    const timer = setTimeout(stop, kind === 'round-started' ? duration : 780);
    document.addEventListener('visibilitychange', suspend);
    motion?.addEventListener('change', suspend);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', suspend);
      motion?.removeEventListener('change', suspend);
    };
  }, [duration, id, kind, saver]);

  if (!id || active !== id || saver) return null;
  const shuffling = kind === 'round-started';
  return (
    <div
      className="table-motion"
      style={{ '--shuffle-duration': `${duration}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className={shuffling ? 'shuffle-deck' : 'deal-flight'} key={id}>
        {Array.from({ length: shuffling ? 8 : 16 }, (_, i) => (
          <span
            className={shuffling ? 'shuffle-card' : `dealt-back deal-${i % 4}`}
            key={i}
          >
            <CardBack />
          </span>
        ))}
      </div>
    </div>
  );
}

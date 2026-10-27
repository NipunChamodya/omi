import { useEffect, useRef } from 'react';
import type { EventMessage } from '@omi/shared';
import { CardBack } from '../components/Cards';
import { useSoundPreferences } from '../audio/preferences';
export function TableMotion({ message }: { message: EventMessage | null }) {
  const root = useRef<HTMLDivElement>(null);
  const duration = useSoundPreferences((state) => state.motionMs);
  useEffect(() => {
    root.current?.style.setProperty('--shuffle-duration', `${duration}ms`);
  }, [duration]);
  const kind = message?.event.kind;
  return (
    <div className="table-motion" ref={root} aria-hidden="true">
      {kind === 'round-started' && (
        <div className="shuffle-deck" key={message?.version}>
          {Array.from({ length: 8 }, (_, i) => (
            <span className="shuffle-card" key={i}>
              <CardBack />
            </span>
          ))}
          <span className="deck-caption">Gather · shuffle · tap</span>
        </div>
      )}
      {kind === 'cards-dealt' && (
        <div className="deal-flight" key={message?.version}>
          {Array.from({ length: 16 }, (_, i) => (
            <span className={`dealt-back deal-${i % 4}`} key={i}>
              <CardBack />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

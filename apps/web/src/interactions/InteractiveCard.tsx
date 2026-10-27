import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Card } from '@omi/shared';
import { CardFace, cardName } from '../components/Cards';
import { gameAudio } from '../audio/gameAudio';

export const HOLD_MS = 140;
export function insideDropZone(zone: Element | null, x: number, y: number) {
  if (!zone || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const rect = zone.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}
type Drag = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  armed: boolean;
  moved: boolean;
  touch: boolean;
  bounds: DOMRect | null;
};
export function InteractiveCard({
  card,
  selected,
  disabled,
  playable,
  pending,
  zone,
  onSelect,
  onPlay,
  onDrag,
  deal,
}: {
  card: Card;
  selected: boolean;
  disabled: boolean;
  playable: boolean;
  pending: boolean;
  zone: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onPlay: () => void;
  onDrag: (active: boolean, over: boolean) => void;
  deal: boolean;
}) {
  const element = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppress = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const latest = useRef({ onDrag, onSelect, onPlay, playable, disabled });
  latest.current = { onDrag, onSelect, onPlay, playable, disabled };
  const animation = useRef<Animation | null>(null);
  const indicator = useRef({ active: false, over: false });
  const report = (active: boolean, over: boolean) => {
    if (indicator.current.active === active && indicator.current.over === over)
      return;
    indicator.current = { active, over };
    latest.current.onDrag(active, over);
  };
  function reset(animate = true) {
    const node = element.current;
    const previous = node?.style.transform;
    clearTimeout(hold.current);
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    drag.current = null;
    if (node) {
      delete node.dataset.dragging;
      delete node.dataset.awaiting;
      node.style.removeProperty('transform');
      animation.current?.cancel();
      if (
        animate &&
        previous &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      )
        animation.current =
          node.animate?.(
            [
              { transform: previous },
              { transform: selected ? 'translateY(-9px)' : 'none' },
            ],
            { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' },
          ) ?? null;
    }
    report(false, false);
  }
  useEffect(() => {
    const interrupt = () => reset();
    const visibility = () => {
      if (document.hidden) reset();
    };
    const scroll = () => {
      if (drag.current) reset();
    };
    window.addEventListener('blur', interrupt);
    window.addEventListener('resize', interrupt);
    window.addEventListener('orientationchange', interrupt);
    window.addEventListener('scroll', scroll, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', interrupt);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', interrupt);
      window.removeEventListener('resize', interrupt);
      window.removeEventListener('orientationchange', interrupt);
      window.removeEventListener('scroll', scroll, true);
      window.visualViewport?.removeEventListener('resize', interrupt);
      document.removeEventListener('visibilitychange', visibility);
      clearTimeout(hold.current);
      clearTimeout(clickTimer.current);
      cancelAnimationFrame(frame.current);
      animation.current?.cancel();
    };
    // Event callbacks use latest refs; pointer motion never causes a React render.
  }, []);
  useEffect(() => {
    if (!pending) reset();
  }, [pending]);
  useEffect(() => {
    if (disabled && !pending) reset();
  }, [disabled, pending]);
  return (
    <button
      ref={element}
      className={`hand-card ${selected ? 'selected' : ''} ${deal ? 'hand-dealt' : ''}`}
      data-testid="hand-card"
      aria-label={`Select ${cardName(card)}`}
      aria-pressed={selected}
      disabled={disabled}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (
          disabled ||
          pending ||
          drag.current ||
          !event.isPrimary ||
          event.button !== 0
        )
          return;
        suppress.current = false;
        animation.current?.cancel();
        const touch = event.pointerType === 'touch';
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          dx: 0,
          dy: 0,
          armed: !touch,
          moved: false,
          touch,
          bounds: zone.current?.getBoundingClientRect() ?? null,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (touch)
          hold.current = setTimeout(() => {
            const current = drag.current;
            if (!current) return;
            current.armed = true;
            if (!selected) latest.current.onSelect();
            if (element.current) element.current.dataset.dragging = 'true';
            report(true, false);
            void gameAudio.play('select');
          }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        current.dx = event.clientX - current.x;
        current.dy = event.clientY - current.y;
        const distance = Math.hypot(current.dx, current.dy);
        if (current.touch && !current.armed && distance > 12) {
          reset();
          return;
        }
        if (!current.armed || distance < 7) return;
        event.preventDefault();
        if (!current.moved) {
          current.moved = true;
          if (!selected) onSelect();
          void gameAudio.play('select');
        }
        const rect = current.bounds;
        const over = !!(
          playable &&
          rect &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
        report(true, over);
        if (!frame.current)
          frame.current = requestAnimationFrame(() => {
            frame.current = 0;
            if (!drag.current || !element.current) return;
            const { dx, dy } = drag.current;
            element.current.dataset.dragging = 'true';
            element.current.style.transform = `translate3d(${dx}px,${dy - 10}px,0) rotate(${Math.max(-9, Math.min(9, dx / 18))}deg) scale(1.07)`;
          });
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const moved = current.moved;
        const valid =
          moved &&
          current.armed &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) >=
            24 &&
          latest.current.playable &&
          !latest.current.disabled &&
          insideDropZone(zone.current, event.clientX, event.clientY);
        clearTimeout(hold.current);
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        drag.current = null;
        report(false, false);
        suppress.current = moved || (current.touch && current.armed);
        clearTimeout(clickTimer.current);
        clickTimer.current = setTimeout(() => {
          suppress.current = false;
        }, 0);
        if (valid) {
          const rect = zone.current!.getBoundingClientRect();
          const origin = event.currentTarget.getBoundingClientRect();
          delete event.currentTarget.dataset.dragging;
          event.currentTarget.dataset.awaiting = 'true';
          event.currentTarget.style.transform = `translate3d(${current.dx + rect.left + rect.width / 2 - origin.left - origin.width / 2}px,${current.dy + rect.top + rect.height / 2 - origin.top - origin.height / 2}px,0) scale(.9)`;
          void gameAudio.play('release');
          onPlay();
        } else {
          if (moved) void gameAudio.play('reject');
          reset();
        }
        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        suppress.current = true;
        reset();
      }}
      onLostPointerCapture={() => {
        if (drag.current) reset();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          reset();
          if (selected) onSelect();
        }
        if (event.key === 'Enter' && selected && playable) {
          event.preventDefault();
          onPlay();
        }
      }}
      onClick={(event) => {
        if (suppress.current && event.detail !== 0) return;
        suppress.current = false;
        onSelect();
        void gameAudio.play('select');
      }}
    >
      <CardFace card={card} />
    </button>
  );
}

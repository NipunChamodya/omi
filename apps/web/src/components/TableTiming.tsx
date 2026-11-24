import { useEffect, useRef, useState } from 'react';
import type { PublicTrick, Snapshot, TurnClock } from '@omi/shared';
import { useCopy } from '../i18n/locale';
import { CardFace, useCardName, suits } from './Cards';

export const revealSeconds = [2, 3, 5] as const;
export function readRevealSeconds(): 2 | 3 | 5 {
  try {
    const value = Number(localStorage.getItem('omi.trick-reveal'));
    return value === 2 || value === 5 ? value : 3;
  } catch {
    return 3;
  }
}
export function remainingTurnMs(clock: TurnClock, elapsedMs: number) {
  return Math.max(
    0,
    Math.min(
      clock.durationMs,
      clock.deadline - clock.serverNow - Math.max(0, elapsedMs),
    ),
  );
}
export function TurnCountdown({ clock }: { clock: TurnClock }) {
  const text = useCopy();
  const [remaining, setRemaining] = useState(() => remainingTurnMs(clock, 0));
  useEffect(() => {
    const receivedAt = performance.now();
    const refresh = () =>
      setRemaining(remainingTurnMs(clock, performance.now() - receivedAt));
    refresh();
    const interval = setInterval(refresh, 200);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [clock.deadline, clock.serverNow, clock.durationMs]); // Clock samples are server issued.
  const seconds = Math.ceil(remaining / 1000);
  return (
    <span
      className={`turn-clock ${seconds <= 5 ? 'turn-clock--urgent' : ''}`}
      role="timer"
      aria-label={text('Turn time remaining')}
    >
      <strong>
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:
        {String(seconds % 60).padStart(2, '0')}
      </strong>
      <progress
        aria-label={text('Turn time remaining')}
        value={remaining}
        max={clock.durationMs}
      />
    </span>
  );
}

export function TrickReplay({
  trick,
  snapshot,
  onClose,
}: {
  trick: PublicTrick;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const text = useCopy();
  const cardName = useCardName();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (element.showModal) element.showModal();
    else element.setAttribute('open', '');
    return () => element.close?.();
  }, []);
  const name = (seat: number) =>
    snapshot.members.find((member) => member.seat === seat)?.displayName ??
    text('Player');
  const lead = trick.plays[0]?.card.suit;
  const trump = snapshot.game?.trump;
  return (
    <dialog
      ref={dialog}
      className="leave-dialog trick-replay"
      aria-label={text('Replay last trick')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2>{text('Replay last trick')}</h2>
      <p>
        {text('Trick winner')} · {name(trick.winner)}
      </p>
      <p>
        {text('Lead suit')} · {lead ? suits[lead].symbol : '—'} /{' '}
        {text('TRUMP')} · {trump ? suits[trump].symbol : '—'}
      </p>
      <ul>
        {trick.plays.map(({ card, seat }) => (
          <li
            key={seat}
            className={seat === trick.winner ? 'winning-play' : ''}
          >
            <span
              className="replay-face"
              role="img"
              aria-label={cardName(card)}
            >
              <CardFace card={card} />
            </span>
            <span>{name(seat)}</span>
            {seat === trick.winner && <small>{text('Winning card')}</small>}
          </li>
        ))}
      </ul>
      <button className="button secondary" onClick={onClose}>
        {text('Back')}
      </button>
    </dialog>
  );
}

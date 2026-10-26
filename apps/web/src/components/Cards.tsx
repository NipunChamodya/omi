import { useDataSaver } from '../pwa/preferences';
import { useState } from 'react';
import type { Card, Suit } from '@omi/shared';
export const suits: Record<
  Suit,
  { symbol: string; label: string; sinhala: string }
> = {
  spades: { symbol: '♠', label: 'Spades', sinhala: 'ස්කෝප්ප' },
  hearts: { symbol: '♥', label: 'Hearts', sinhala: 'හාරත' },
  diamonds: { symbol: '♦', label: 'Diamonds', sinhala: 'රුයිත' },
  clubs: { symbol: '♣', label: 'Clubs', sinhala: 'කලාබර' },
};
export const cardName = (card: Card) => `${card.rank} of ${card.suit}`;
export function CardFace({ card }: { card: Card }) {
  return (
    <span
      className={`card-face ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : ''}`}
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <span>{suits[card.suit].symbol}</span>
      </span>
      <span className="card-pip" aria-hidden="true">
        {suits[card.suit].symbol}
      </span>
      <span className="card-corner inverted" aria-hidden="true">
        <b>{card.rank}</b>
        <span>{suits[card.suit].symbol}</span>
      </span>
    </span>
  );
}
export function Brand({ onHome }: { onHome?: () => void }) {
  return (
    <a
      className="brand"
      href="/"
      aria-label="OMI home"
      onClick={(event) => {
        if (onHome) {
          event.preventDefault();
          onHome();
        }
      }}
    >
      <span className="brand-mark" aria-hidden="true">
        ♠
      </span>
      <span>
        OMI{' '}
        <span className="brand-si" lang="si">
          ඕමි
        </span>
      </span>
    </a>
  );
}
export function Avatar({
  name,
  teammate = false,
  src,
}: {
  name: string;
  teammate?: boolean;
  src?: string | undefined;
}) {
  const saver = useDataSaver((state) => state.enabled);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`avatar ${teammate ? 'teammate' : ''}`} aria-hidden="true">
      {!saver && src && failed !== src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        name.charAt(0).toLocaleUpperCase()
      )}
    </span>
  );
}

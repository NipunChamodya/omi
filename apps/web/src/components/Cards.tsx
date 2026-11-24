import { TropicalCourt } from './TropicalCourt';
import { useCopy } from '../i18n/locale';
import { useDataSaver } from '../pwa/preferences';
import { useStore } from 'zustand';
import { themeStore } from '../themes/store';
import { themes } from '../themes/registry';
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
const pipRows: Partial<Record<Card['rank'], readonly (readonly number[])[]>> = {
  '7': [[10, 34, 58], [22], [10, 34, 58]],
  '8': [
    [10, 34, 58],
    [22, 46],
    [10, 34, 58],
  ],
  '9': [[10, 26, 42, 58], [34], [10, 26, 42, 58]],
  '10': [
    [10, 26, 42, 58],
    [18, 50],
    [10, 26, 42, 58],
  ],
};
export function CardFace({ card }: { card: Card }) {
  const pips = pipRows[card.rank];
  const theme = useStore(themeStore, (state) => state.active);
  const court = theme === 'tropical' && ['J', 'Q', 'K'].includes(card.rank);
  return (
    <span
      aria-hidden="true"
      data-rank={card.rank}
      data-suit={card.suit}
      className={`card-face ${card.rank === 'A' ? 'card-face--ace' : ''} ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : ''}`}
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <span>{suits[card.suit].symbol}</span>
      </span>
      {pips ? (
        <svg className="card-pips" viewBox="0 0 48 68" aria-hidden="true">
          {pips.flatMap((rows, column) =>
            rows.map((y) => {
              const x = 11 + column * 13;
              return (
                <text
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  transform={y > 34 ? `rotate(180 ${x} ${y})` : undefined}
                >
                  {suits[card.suit].symbol}
                </text>
              );
            }),
          )}
        </svg>
      ) : court ? (
        <TropicalCourt card={card} />
      ) : (
        <span className="card-pip" aria-hidden="true">
          {suits[card.suit].symbol}
        </span>
      )}
      <span className="card-corner inverted" aria-hidden="true">
        <b>{card.rank}</b>
        <span>{suits[card.suit].symbol}</span>
      </span>
    </span>
  );
}
export function CardBack() {
  const active = useStore(themeStore, (state) => state.active);
  const [failed, setFailed] = useState<string | null>(null);
  const back = themes.find((theme) => theme.id === active)!.back;
  return (
    <span className="card-back" aria-hidden="true">
      <span>♠</span>
      {failed !== back && (
        <img
          src={back}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(back)}
        />
      )}
    </span>
  );
}
export function Brand({ onHome }: { onHome?: () => void }) {
  const text = useCopy();
  return (
    <a
      className="brand"
      href="/"
      aria-label={text('OMI home')}
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

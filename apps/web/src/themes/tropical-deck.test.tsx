// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { Card } from '@omi/shared';
import { CardFace } from '../components/Cards';
import { themeStore } from './store';

afterEach(() => {
  cleanup();
  themeStore.setState({ active: 'classic' });
});

const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'] as const;
const deck: Card[] = suits.flatMap((suit) =>
  ranks.map((rank) => ({ suit, rank })),
);

it.each(deck)('renders Tropical Adventure $rank of $suit correctly', (card) => {
  themeStore.setState({ active: 'tropical' });
  const { container } = render(<CardFace card={card} />);
  const face = container.querySelector('.card-face')!;
  expect(face.getAttribute('data-rank')).toBe(card.rank);
  expect(face.getAttribute('data-suit')).toBe(card.suit);
  expect(
    [...face.querySelectorAll('.card-corner b')].map(
      (node) => node.textContent,
    ),
  ).toEqual([card.rank, card.rank]);
  expect(face.classList.contains('red')).toBe(
    card.suit === 'hearts' || card.suit === 'diamonds',
  );
  if (/^\d/.test(card.rank)) {
    const symbols = [...face.querySelectorAll('.card-pips text')];
    expect(symbols).toHaveLength(Number(card.rank));
    expect(new Set(symbols.map((node) => node.textContent))).toEqual(
      new Set([face.querySelector('.card-corner span')!.textContent]),
    );
  } else if (card.rank === 'A') {
    expect(face.querySelector('.card-pip')?.textContent).toBe(
      face.querySelector('.card-corner span')!.textContent,
    );
  } else {
    expect(face.querySelectorAll('.card-court g')).toHaveLength(2);
    expect(
      face
        .querySelector('.card-court g:nth-of-type(2)')
        ?.getAttribute('transform'),
    ).toBe('rotate(180 24 38)');
  }
});

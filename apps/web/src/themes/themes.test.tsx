// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createThemeStore, readTheme } from './store';
import { isThemeId, themes } from './registry';
import { CardFace, cardName, CardBack } from '../components/Cards';
import type { Card } from '@omi/shared';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('accepts only registry IDs and restores an explicit saved design', async () => {
  const load = vi.fn(async () => undefined);
  for (const value of [
    '__proto__',
    'https://evil.invalid/design.css',
    '<script>',
    null,
    1,
  ])
    expect(isThemeId(value)).toBe(false);
  localStorage.setItem('omi-card-theme', 'https://evil.invalid/design.css');
  expect(readTheme()).toBe('classic');
  const store = createThemeStore(load);
  await store.getState().choose('unknown');
  expect(load).not.toHaveBeenCalled();
  await store.getState().choose('royal');
  expect(store.getState().active).toBe('royal');
  expect(localStorage.getItem('omi-card-theme')).toBe('royal');
  expect(createThemeStore(load).getState().selected).toBe('royal');
});
it('keeps the last usable design during failed loads and supports retry', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('private implementation detail'))
    .mockResolvedValueOnce(undefined);
  const store = createThemeStore(load);
  await store.getState().choose('classic');
  await store.getState().choose('royal');
  expect(store.getState().active).toBe('classic');
  expect(store.getState().loading).toBe(false);
  expect(store.getState().error).toContain('current cards are still playable');
  expect(store.getState().error).not.toContain('private implementation detail');
  expect(localStorage.getItem('omi-card-theme')).toBe('classic');
  await store.getState().choose('royal');
  expect(store.getState().active).toBe('royal');
  expect(store.getState().error).toBeNull();
});
it('ignores stale successful or failed loads after a newer selection', async () => {
  let first!: () => void;
  let second!: (error: Error) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () => new Promise<void>((resolve) => (first = resolve)),
    )
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (second = reject)),
    )
    .mockResolvedValueOnce(undefined);
  const store = createThemeStore(load);
  const slow = store.getState().choose('royal');
  await store.getState().choose('classic');
  first();
  await slow;
  expect(store.getState().active).toBe('classic');
  const failed = store.getState().choose('classic');
  await store.getState().choose('royal');
  second(new Error('late'));
  await failed;
  expect(store.getState().active).toBe('royal');
  expect(store.getState().error).toBeNull();
  expect(localStorage.getItem('omi-card-theme')).toBe('royal');
});
it('remains usable when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  expect(readTheme()).toBe('classic');
  const store = createThemeStore(async () => undefined);
  await store.getState().choose('royal');
  expect(store.getState().active).toBe('royal');
});
it('renders all 32 card identities independently of the two visual designs', () => {
  for (const theme of themes) {
    document.documentElement.dataset.cardTheme = theme.id;
    for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const)
      for (const rank of ['A', 'K', 'Q', 'J', '10', '9', '8', '7'] as const) {
        const card: Card = Object.freeze({ suit, rank });
        const view = render(
          <span role="img" aria-label={cardName(card)}>
            <CardFace card={card} />
          </span>,
        );
        expect(
          view.container.querySelector('.card-corner b')?.textContent,
        ).toBe(rank);
        expect(view.container.querySelector('.card-pip')?.textContent).toBe(
          { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[suit],
        );
        expect(view.container.querySelector('.red') !== null).toBe(
          suit === 'hearts' || suit === 'diamonds',
        );
        expect(card).toEqual({ suit, rank });
        view.unmount();
      }
  }
  const back = render(<CardBack />);
  fireEvent.error(back.container.querySelector('img')!);
  expect(back.container.querySelector('img')).toBeNull();
  expect(back.container.textContent).toBe('♠');
  expect(back.container.querySelector('.card-corner')).toBeNull();
  expect(
    back.container.querySelector('.card-back')?.getAttribute('aria-hidden'),
  ).toBe('true');
});

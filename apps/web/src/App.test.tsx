// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { GameClient } from './game/client';
import type { Snapshot } from '@omi/shared';
afterEach(cleanup);
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
const fixture = (): Snapshot => ({
  type: 'snapshot',
  roomId: 'room',
  requestId: null,
  version: 1,
  code: 'ABCD2345',
  hostId: 'local',
  you: { actorId: 'local', seat: 1, team: 1 },
  members: [0, 1, 2, 3].map((seat) => ({
    actorId: seat === 1 ? 'local' : `player-${seat}`,
    displayName: seat === 2 ? '<img src=x onerror=alert(1)>' : `Player ${seat}`,
    seat: seat as 0 | 1 | 2 | 3,
    team: (seat % 2) as 0 | 1,
    ready: true,
    connected: true,
  })),
  game: {
    id: 'round',
    phase: 'playing',
    dealer: 0,
    selector: 1,
    trump: 'spades',
    turn: 1,
    hand: [
      { rank: 'A', suit: 'hearts' },
      { rank: '7', suit: 'clubs' },
    ],
    handCounts: [8, 2, 8, 8],
    trick: [{ seat: 0, card: { suit: 'spades', rank: 'A' } }],
    tricks: [],
  },
  score: { totals: [0, 0], carry: 0 },
  result: null,
});
it('shows accessible create/join forms and consumes a room invite', () => {
  render(<App />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: /Four friends/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Create a table/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Join a table/ }));
  expect(screen.getByLabelText('Table code')).toBeInTheDocument();
});
it('opens an invitation directly into the join form', () => {
  window.history.replaceState(null, '', '/?room=ABCD2345');
  render(<App />);
  expect(screen.getByLabelText('Table code')).toHaveValue('ABCD2345');
});
it('places the local player at bottom, teammate opposite, escapes names and allows off-suit selection without sending a move', async () => {
  const client = new GameClient();
  const state = fixture();
  client.store.setState({
    view: 'room',
    snapshot: state,
    connection: 'online',
  });
  const act = vi.spyOn(client, 'act');
  render(<App client={client} />);
  expect(
    await screen.findByRole('heading', { name: 'Your hand' }),
  ).toBeInTheDocument();
  expect(screen.getByTestId('seat-bottom')).toHaveTextContent('You');
  expect(screen.getByTestId('seat-top')).toHaveTextContent('Player 3');
  expect(screen.getByTestId('seat-left')).toHaveTextContent('Player 0');
  expect(screen.getByTestId('seat-right')).toHaveTextContent(
    '<img src=x onerror=alert(1)>',
  );
  expect(document.querySelector('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Select 7 of clubs' }));
  expect(
    screen.getByRole('button', { name: 'Select 7 of clubs' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(act).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Play selected card' }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Play selected card' }));
  expect(act).toHaveBeenCalledWith({
    type: 'play',
    payload: { card: { rank: '7', suit: 'clubs' } },
  });
});
it('disables gameplay while disconnected and never invents a new round dealer', async () => {
  const client = new GameClient();
  client.store.setState({
    view: 'room',
    snapshot: fixture(),
    connection: 'offline',
  });
  render(<App client={client} />);
  expect(
    await screen.findByRole('button', { name: 'Select A of hearts' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Play selected card' }),
  ).toBeDisabled();
});

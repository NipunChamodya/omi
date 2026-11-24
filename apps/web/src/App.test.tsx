// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { authApi } from './auth/api';
import { GameClient } from './game/client';
import type { Snapshot } from '@omi/shared';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(authApi, 'session').mockResolvedValue({
    user: null,
    csrfToken: null,
    expiresAt: null,
    googleAvailable: false,
    guestAllowed: true,
    avatarUploadsEnabled: false,
    room: null,
  });
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
it('shows accessible create/join forms and consumes a room invite', async () => {
  render(<App />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: /Tropical Adventure/ }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: /Create a table/ }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Join a table/ }));
  expect(screen.getByLabelText('Table code')).toBeInTheDocument();
});
it('opens an invitation directly into the join form', async () => {
  window.history.replaceState(null, '', '/?room=ABCD2345');
  render(<App />);
  expect(await screen.findByLabelText('Table code')).toHaveValue('ABCD2345');
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
  expect(
    screen.getByTestId('seat-right').querySelector('.player-name img'),
  ).toBeNull();
  expect(document.querySelector('img[src="x"], [onerror]')).toBeNull();
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

it('requires sign-in when guest play is disabled and does not expose account fields', async () => {
  vi.mocked(authApi.session).mockResolvedValueOnce({
    user: null,
    csrfToken: null,
    expiresAt: null,
    googleAvailable: true,
    guestAllowed: false,
    avatarUploadsEnabled: false,
    room: null,
  });
  render(<App />);
  expect(
    await screen.findByRole('button', { name: 'Continue with Google' }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Create a table/ }),
  ).not.toBeInTheDocument();
});

it('renders the home and a safe error when authentication bootstrap rejects', async () => {
  vi.mocked(authApi.session).mockRejectedValueOnce(
    new Error('private-provider-detail'),
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sign-in is unavailable',
  );
  expect(
    await screen.findByRole('heading', { name: /Tropical Adventure/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument();
  expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument();
});

it('shows one opening sponsor and removes it when leaving Home', async () => {
  vi.stubEnv('VITE_OMI_FAMILY_SPONSOR_APPROVED', 'true');
  vi.stubEnv('VITE_OMI_SPONSOR_LABEL', 'Test sponsor');
  vi.stubEnv('VITE_OMI_SPONSOR_URL', 'https://example.com/');
  try {
    const first = render(<App />);
    expect(
      await screen.findByRole('complementary', { name: 'Advertisement' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Play Online' }));
    expect(
      screen.queryByRole('complementary', { name: 'Advertisement' }),
    ).toBeNull();
    first.unmount();
    window.history.replaceState(null, '', '/');
    render(<App />);
    await screen.findByRole('button', { name: /Create a table/ });
    expect(
      screen.queryByRole('complementary', { name: 'Advertisement' }),
    ).toBeNull();
  } finally {
    vi.unstubAllEnvs();
  }
});

it('switches beginner navigation to Sinhala and updates the document language', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings & install' }));
  const language = await screen.findByRole('combobox', { name: /Language/ });
  try {
    fireEvent.change(language, { target: { value: 'si' } });
    expect(document.documentElement.lang).toBe('si');
    expect(
      screen.getByRole('button', { name: 'අන්තර්ජාලයෙන් ක්‍රීඩා කරන්න' }),
    ).toBeVisible();
  } finally {
    fireEvent.change(language, { target: { value: 'en' } });
  }
});

it('does not show an approved opening sponsor for protected play', async () => {
  vi.stubEnv('VITE_OMI_FAMILY_SPONSOR_APPROVED', 'true');
  vi.stubEnv('VITE_OMI_SPONSOR_LABEL', 'Test sponsor');
  vi.stubEnv('VITE_OMI_SPONSOR_URL', 'https://example.com/');
  vi.mocked(authApi.session).mockResolvedValueOnce({
    user: {
      id: 'player',
      displayName: 'Player',
      version: 0,
      googleAvatarUrl: null,
      avatarUrl: null,
      thumbnailUrl: null,
    },
    csrfToken: 'fixture',
    expiresAt: null,
    googleAvailable: false,
    guestAllowed: true,
    avatarUploadsEnabled: false,
    room: null,
    protectedPlay: true,
  });
  try {
    render(<App />);
    await screen.findByRole('button', { name: 'My profile' });
    expect(
      screen.queryByRole('complementary', { name: 'Advertisement' }),
    ).toBeNull();
  } finally {
    vi.unstubAllEnvs();
  }
});

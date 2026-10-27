// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useStore } from 'zustand';
import { Profiler } from 'react';
import type { Snapshot } from '@omi/shared';
import GameTable from '../components/GameTable';
import { GameClient } from '../game/client';
import { HOLD_MS } from './InteractiveCard';
import { gameAudio } from '../audio/gameAudio';
const card = { rank: 'A', suit: 'hearts' } as const;
const fixture = (): Snapshot => ({
  type: 'snapshot',
  requestId: null,
  roomId: 'room',
  version: 1,
  code: 'ABCD2345',
  hostId: 'local',
  you: { actorId: 'local', seat: 0, team: 0 },
  members: [0, 1, 2, 3].map((seat) => ({
    actorId: String(seat),
    seat: seat as 0 | 1 | 2 | 3,
    team: (seat % 2) as 0 | 1,
    displayName: 'Friend',
    connected: true,
    ready: true,
  })),
  game: {
    id: 'round',
    phase: 'playing',
    dealer: 0,
    selector: 0,
    trump: 'hearts',
    turn: 0,
    hand: [card, { rank: '7', suit: 'clubs' }],
    handCounts: [2, 8, 8, 8],
    trick: [],
    tricks: [],
  },
  score: { totals: [0, 0], carry: 0 },
  result: null,
});
class Pointer extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}
let client: GameClient;
let send: ReturnType<typeof vi.spyOn>;
let renders = 0;
beforeEach(() => {
  renders = 0;
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent', Pointer);
  vi.spyOn(gameAudio, 'play').mockResolvedValue();
  client = new GameClient();
  client.store.setState({
    snapshot: fixture(),
    connection: 'online',
    view: 'room',
  });
  send = vi
    .spyOn(client, 'act')
    .mockImplementation(() => client.store.setState({ pending: true }));
  function Harness() {
    const state = useStore(client.store);
    return (
      <GameTable
        client={client}
        snapshot={state.snapshot!}
        enabled={state.connection === 'online'}
        pending={state.pending}
      />
    );
  }
  render(
    <Profiler
      id="hand"
      onRender={() => {
        renders++;
      }}
    >
      <Harness />
    </Profiler>,
  );
  vi.spyOn(
    screen.getByTestId('card-drop-zone'),
    'getBoundingClientRect',
  ).mockReturnValue({
    left: 100,
    top: 100,
    right: 220,
    bottom: 220,
    width: 120,
    height: 120,
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  client.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const button = () => screen.getByRole('button', { name: 'Select A of hearts' });
it('updates pointer transforms without React commits for every movement', () => {
  down();
  move();
  act(() => vi.advanceTimersByTime(20));
  const before = renders;
  for (let i = 0; i < 20; i++) {
    move(160 + i, 160);
    act(() => vi.advanceTimersByTime(17));
  }
  expect(renders).toBe(before);
  expect(button().style.transform).toContain('translate3d');
});
function down(pointerType = 'mouse') {
  fireEvent.pointerDown(button(), {
    clientX: 160,
    clientY: 400,
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
  });
}
function move(x = 160, y = 160) {
  fireEvent.pointerMove(button(), { clientX: x, clientY: y, pointerId: 1 });
}
function up(x = 160, y = 160) {
  fireEvent.pointerUp(button(), { clientX: x, clientY: y, pointerId: 1 });
}
it.each(['mouse', 'pen', 'touch'])(
  'drags with %s and retains the card until authoritative confirmation',
  (type) => {
    down(type);
    if (type === 'touch') act(() => vi.advanceTimersByTime(HOLD_MS));
    move();
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByTestId('card-drop-zone')).toHaveClass('drop-over');
    up();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'play',
      payload: { card },
    });
    expect(screen.getAllByTestId('hand-card')).toHaveLength(2);
    expect(button()).toBeDisabled();
    expect(button()).toHaveAttribute('data-awaiting');
  },
);
it('returns outside drops, unarmed touch movement and short accidental releases without submitting', () => {
  down();
  move(40, 300);
  up(40, 300);
  expect(send).not.toHaveBeenCalled();
  down('touch');
  move();
  up();
  expect(send).not.toHaveBeenCalled();
  down();
  up();
  expect(send).not.toHaveBeenCalled();
});
it.each([
  'pointerCancel',
  'lostPointerCapture',
  'blur',
  'resize',
  'orientationchange',
  'visibilitychange',
])('cleans up interrupted dragging on %s', (event) => {
  down('touch');
  act(() => vi.advanceTimersByTime(HOLD_MS));
  move();
  act(() => vi.advanceTimersByTime(20));
  if (event === 'pointerCancel') fireEvent.pointerCancel(button());
  else if (event === 'lostPointerCapture')
    fireEvent.lostPointerCapture(button());
  else if (event === 'visibilitychange') {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event(event));
  } else fireEvent(window, new Event(event));
  up();
  expect(send).not.toHaveBeenCalled();
  expect(button()).not.toHaveAttribute('data-dragging');
});
it('restores a rejected card and blocks rapid repeated submissions', () => {
  down();
  move();
  up();
  fireEvent.keyDown(button(), { key: 'Enter' });
  expect(send).toHaveBeenCalledTimes(1);
  act(() =>
    client.store.setState({
      pending: false,
      error: 'That move could not be played.',
    }),
  );
  expect(button()).toBeEnabled();
  expect(button()).not.toHaveAttribute('data-awaiting');
  expect(button().style.transform).toBe('');
  expect(screen.getAllByTestId('hand-card')).toHaveLength(2);
});
it('allows keyboard selection/play and prevents out-of-turn drops', () => {
  fireEvent.click(button());
  fireEvent.keyDown(button(), { key: 'Enter' });
  expect(send).toHaveBeenCalledTimes(1);
  const snapshot = fixture();
  act(() =>
    client.store.setState({
      pending: false,
      snapshot: { ...snapshot, game: { ...snapshot.game!, turn: 1 } },
    }),
  );
  down();
  move();
  up();
  expect(send).toHaveBeenCalledTimes(1);
});
it('animates only an accepted public play and clears motion on a restored snapshot', () => {
  const snapshot = fixture();
  const event = {
    kind: 'card-played',
    seat: 1,
    card: { rank: 'K', suit: 'clubs' },
    turn: 0,
    phase: 'playing',
    handCounts: [2, 7, 8, 8],
    completedTrick: null,
    score: snapshot.score,
    result: null,
  } as const;
  act(() =>
    client.store.setState({
      snapshot: {
        ...snapshot,
        version: 2,
        game: { ...snapshot.game!, trick: [{ seat: 1, card: event.card }] },
      },
      presentation: {
        type: 'event',
        roomId: 'room',
        fromVersion: 1,
        version: 2,
        event,
      },
    }),
  );
  expect(document.querySelector('.animate-play')).not.toBeNull();
  expect(screen.getAllByTestId('hand-card')).toHaveLength(2);
  // An authoritative reconnect snapshot renders the cards with no historical animation.
  act(() => client.store.setState({ presentation: null }));
  expect(document.querySelector('.animate-play')).toBeNull();
  expect(document.querySelectorAll('.hidden-hand .card-face')).toHaveLength(0);
});

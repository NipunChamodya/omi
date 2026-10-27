// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Snapshot } from '@omi/shared';
import { GameClient } from '../game/client';
import { gameAudio } from './gameAudio';
import { useGameAudio } from './useGameAudio';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('announces the first playing turn once even when the trump selector keeps the lead', () => {
  const client = new GameClient();
  const play = vi.spyOn(gameAudio, 'play').mockResolvedValue();
  const snapshot: Snapshot = {
    type: 'snapshot',
    roomId: 'room',
    version: 1,
    requestId: null,
    code: 'ABCD2345',
    hostId: 'actor',
    you: { actorId: 'actor', seat: 0, team: 0 },
    members: [],
    score: { totals: [0, 0], carry: 0 },
    result: null,
    game: {
      id: 'round',
      phase: 'awaiting-trump',
      dealer: 0,
      selector: 0,
      trump: null,
      turn: 0,
      hand: [],
      handCounts: [4, 4, 4, 4],
      trick: [],
      tricks: [],
    },
  };
  client.store.setState({ snapshot, view: 'room', connection: 'online' });
  renderHook(() => useGameAudio(client));
  const round = {
    ...snapshot.game!,
    phase: 'playing',
    trump: 'hearts',
  } as const;
  act(() =>
    client.store.setState({
      snapshot: { ...snapshot, game: round, version: 2 },
      presentation: {
        type: 'event',
        roomId: 'room',
        fromVersion: 1,
        version: 2,
        event: {
          kind: 'cards-dealt',
          stage: 'second',
          round,
          hand: [],
          handCounts: [8, 8, 8, 8],
        },
      },
    }),
  );
  expect(play.mock.calls.filter((call) => call[0] === 'turn')).toHaveLength(1);
  act(() => client.store.setState({ pending: true }));
  expect(play.mock.calls.filter((call) => call[0] === 'turn')).toHaveLength(1);
  act(() => client.store.setState({ presentation: null }));
  expect(play.mock.calls.filter((call) => call[0] === 'turn')).toHaveLength(1);
});

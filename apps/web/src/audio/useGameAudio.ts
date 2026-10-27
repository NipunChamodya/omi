import { useEffect } from 'react';
import type { GameClient } from '../game/client';
import { gameAudio } from './gameAudio';

/** Subscribe to accepted deltas, never infer sounds from restored snapshots. */
export function useGameAudio(client: GameClient) {
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const clear = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
    const later = (
      delay: number,
      cue: Parameters<typeof gameAudio.play>[0],
      id: string,
    ) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        void gameAudio.play(cue, id);
      }, delay);
      timers.add(timer);
    };
    const gesture = (event: Event) => {
      if (event.isTrusted) void gameAudio.unlock();
    };
    const click = (event: Event) => {
      if (event.isTrusted && (event.target as Element).closest('button'))
        void gameAudio.play('button');
    };
    const visibility = () => gameAudio.setVisible(!document.hidden);
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    document.addEventListener('click', click);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    const unsubscribe = client.store.subscribe((state, previous) => {
      if (state.connection !== 'online' || state.view !== 'room') {
        clear();
        gameAudio.silence();
        return;
      }
      if (!state.presentation) {
        clear();
        gameAudio.silence();
      }
      const message = state.presentation;
      if (message && message !== previous.presentation) {
        const id = `${message.roomId}:${message.version}`;
        const event = message.event;
        switch (event.kind) {
          case 'round-started':
            void gameAudio.play('shuffle', id);
            break;
          case 'cards-dealt':
            void gameAudio.play('deal', id);
            for (const delay of [100, 200, 300])
              later(delay, 'deal', id + ':deal:' + delay);
            if (event.stage === 'second')
              void gameAudio.play('trump', id + ':trump');
            break;
          case 'card-played':
            void gameAudio.play('land', id);
            if (event.completedTrick) later(360, 'gather', id + ':gather');
            if (event.phase === 'complete') later(650, 'round', id + ':round');
            break;
          case 'member-joined':
            void gameAudio.play('joined', id);
            break;
          case 'presence':
            void gameAudio.play(
              event.connected ? 'joined' : 'disconnected',
              id,
            );
            break;
        }
        if (
          state.snapshot?.game?.phase === 'playing' &&
          state.snapshot.game.turn === state.snapshot.you.seat &&
          (previous.snapshot?.game?.phase !== 'playing' ||
            previous.snapshot?.game?.turn !== state.snapshot.game.turn)
        )
          void gameAudio.play('turn', id + ':turn');
      }
      if (state.error && state.error !== previous.error)
        void gameAudio.play('reject');
    });
    return () => {
      unsubscribe();
      clear();
      document.removeEventListener('pointerdown', gesture);
      document.removeEventListener('keydown', gesture);
      document.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', visibility);
      gameAudio.dispose();
    };
  }, [client]);
}

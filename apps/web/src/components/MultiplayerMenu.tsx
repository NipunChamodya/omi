import './tropical.css';
import { useCopy } from '../i18n/locale';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { AuthSession } from '@omi/shared';
import type { GameClient } from '../game/client';
import { MatchmakingClient } from '../game/matchmaking';
import { GoogleButton } from '../auth/GoogleButton';
export function MultiplayerMenu({
  client,
  session,
  onSignIn,
}: {
  client: GameClient;
  session: AuthSession | null;
  onSignIn: () => void;
}) {
  const view = useStore(client.store, (state) => state.view);
  const text = useCopy();
  const [queue] = useState(() => new MatchmakingClient(client.acceptMatch));
  const waiting = useStore(queue.store);
  useEffect(() => {
    if (view !== 'online') queue.stop();
  }, [view, queue]);
  useEffect(() => {
    window.addEventListener('online', queue.online);
    window.addEventListener('offline', queue.offline);
    return () => {
      queue.stop();
      window.removeEventListener('online', queue.online);
      window.removeEventListener('offline', queue.offline);
    };
  }, [queue]);
  return (
    <section className="entry-panel multiplayer-menu">
      <h1>
        {view === 'multiplayer'
          ? text('Multiplayer')
          : view === 'friends'
            ? text('Play with Friends')
            : text('Play Online')}
      </h1>
      {view === 'multiplayer' && (
        <>
          <button
            className="button primary"
            onClick={() => client.navigate('online')}
          >
            {text('Play Online')}
          </button>
          <button
            className="button secondary"
            onClick={() => client.navigate('friends')}
          >
            {text('Play with Friends')}
          </button>
        </>
      )}
      {view === 'friends' && (
        <>
          <p>
            {text(
              'Create a private table or join your friends with an invite code.',
            )}
          </p>
          <button
            className="button primary"
            onClick={() => client.navigate('create')}
          >
            {text('Create Room')}
          </button>
          <button className="button secondary" onClick={client.showJoin}>
            {text('Join Room')}
          </button>
        </>
      )}
      {view === 'online' && (
        <>
          <p>
            {text('Four signed-in people. No bots and no simulated players.')}
          </p>
          {!session?.user ? (
            <>
              <p>{text('Sign in to join the ranked, human-only queue.')}</p>
              {session?.googleAvailable && (
                <GoogleButton onClick={onSignIn} disabled={false} />
              )}
            </>
          ) : (
            <>
              <p role="status" data-testid="queue-status">
                {waiting.status === 'waiting'
                  ? `Waiting for real players · ${waiting.waiting} in the queue. Four are needed to make a table.`
                  : waiting.status === 'connecting'
                    ? 'Connecting to the waiting queue…'
                    : waiting.status === 'offline'
                      ? 'Disconnected. Waiting counts are unavailable. Reconnecting when online…'
                      : 'Join the ranked queue to find three other people.'}
              </p>
              {waiting.error && <p role="alert">{waiting.error}</p>}
              {waiting.status === 'idle' || waiting.status === 'error' ? (
                <button className="button primary" onClick={queue.start}>
                  {text('Find players')}
                </button>
              ) : (
                <button className="button secondary" onClick={queue.stop}>
                  {text('Cancel search')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

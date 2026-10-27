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
      <button className="text-button" onClick={client.back}>
        ← Back
      </button>
      <h1>
        {view === 'multiplayer'
          ? 'Multiplayer'
          : view === 'friends'
            ? 'Play with Friends'
            : 'Play Online'}
      </h1>
      {view === 'multiplayer' && (
        <>
          <button
            className="button primary"
            onClick={() => client.navigate('online')}
          >
            Play Online
          </button>
          <button
            className="button secondary"
            onClick={() => client.navigate('friends')}
          >
            Play with Friends
          </button>
        </>
      )}
      {view === 'friends' && (
        <>
          <p>
            Create a private table or join your friends with an invite code.
          </p>
          <button
            className="button primary"
            onClick={() => client.navigate('create')}
          >
            Create Room
          </button>
          <button className="button secondary" onClick={client.showJoin}>
            Join Room
          </button>
        </>
      )}
      {view === 'online' && (
        <>
          <p>Four signed-in people. No bots and no simulated players.</p>
          {!session?.user ? (
            <>
              <p>Sign in to join the real-player queue.</p>
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
                      : 'Join the queue to find three other people.'}
              </p>
              {waiting.error && <p role="alert">{waiting.error}</p>}
              {waiting.status === 'idle' || waiting.status === 'error' ? (
                <button className="button primary" onClick={queue.start}>
                  Find players
                </button>
              ) : (
                <button className="button secondary" onClick={queue.stop}>
                  Cancel search
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

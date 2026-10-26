import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { GameClient } from './game/client';
import { Brand } from './components/Cards';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
const GameTable = lazy(() => import('./components/GameTable'));
export function App({ client: supplied }: { client?: GameClient }) {
  const [client] = useState(() => supplied ?? new GameClient());
  const state = useStore(client.store);
  useEffect(() => {
    void client.start();
    window.addEventListener('offline', client.offline);
    window.addEventListener('online', client.online);
    return () => {
      window.removeEventListener('offline', client.offline);
      window.removeEventListener('online', client.online);
      client.stop();
    };
  }, [client]);
  const online = state.connection === 'online';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Brand onHome={client.home} />
        <span className="header-note">
          {state.view === 'room' ? (
            <>
              <span
                className={`connection-light ${online ? 'connected' : ''}`}
              />
              {online
                ? 'At the table'
                : state.connection === 'connecting' ||
                    state.connection === 'reconnecting'
                  ? 'Connecting…'
                  : 'Disconnected'}
            </>
          ) : (
            'THE SRI LANKAN TABLE'
          )}
        </span>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={state.view === 'room' ? 'room-main' : 'welcome-main'}
      >
        <div className="feedback-stack">
          {state.error && (
            <div className="feedback error" role="alert">
              <p>{state.error}</p>
              <button aria-label="Dismiss message" onClick={client.dismiss}>
                ×
              </button>
            </div>
          )}
          {state.notice && (
            <div className="feedback notice" role="status">
              <p>{state.notice}</p>
              <button aria-label="Dismiss message" onClick={client.dismiss}>
                ×
              </button>
            </div>
          )}
        </div>
        {state.view === 'room' ? (
          <>
            <div className="room-toolbar">
              <button className="text-button" onClick={client.home}>
                ← Home
              </button>
              <span className="room-code">
                TABLE{' '}
                <strong>{state.snapshot?.code ?? state.saved?.code}</strong>
              </span>
            </div>
            {!online && (
              <div className="connection-banner" role="status">
                <span>
                  {state.connection === 'expired'
                    ? 'This session has ended.'
                    : state.connection === 'connecting' ||
                        state.connection === 'reconnecting'
                      ? 'Reconnecting. Your seat is saved.'
                      : 'You are disconnected. Your seat is saved.'}
                </span>
                {!['expired', 'connecting'].includes(state.connection) && (
                  <button
                    className="text-button"
                    onClick={() => void client.retry()}
                  >
                    Reconnect
                  </button>
                )}
              </div>
            )}
            {state.snapshot ? (
              state.snapshot.game ? (
                <Suspense
                  fallback={
                    <p role="status" className="loading">
                      Opening the table…
                    </p>
                  }
                >
                  <GameTable
                    snapshot={state.snapshot}
                    client={client}
                    enabled={online}
                    pending={state.pending}
                  />
                </Suspense>
              ) : (
                <Lobby
                  snapshot={state.snapshot}
                  client={client}
                  enabled={online}
                  pending={state.pending}
                />
              )
            ) : (
              <p className="loading" role="status">
                Setting your table…
              </p>
            )}
          </>
        ) : (
          <Home client={client} state={state} />
        )}
      </main>
      <footer className="app-footer">
        <span>Made for the way we play.</span>
        <span lang="si">හිතවතුන් එක්ක ඕමි</span>
      </footer>
    </div>
  );
}

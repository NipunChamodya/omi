import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { GameClient } from './game/client';
import type { AuthSession, PublicProfile } from '@omi/shared';
import { authApi, avatarSource } from './auth/api';
import { ThemeControls } from './themes/ThemeControls';
import { PwaControls } from './pwa/PwaControls';
import { Brand, Avatar } from './components/Cards';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { SoundSettings } from './audio/SoundSettings';
import { useGameAudio } from './audio/useGameAudio';
import { MultiplayerMenu } from './components/MultiplayerMenu';
const RoomControls = lazy(() => import('./social/RoomControls'));
const Profile = lazy(() => import('./auth/Profile'));
const GameTable = lazy(() => import('./components/GameTable'));
export function App({ client: supplied }: { client?: GameClient }) {
  const [client] = useState(() => supplied ?? new GameClient());
  useGameAudio(client);
  const state = useStore(client.store);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = useRef<HTMLDialogElement>(null);
  const leaving = useRef<HTMLDialogElement>(null);
  const playing = state.view === 'room' && !!state.snapshot?.game;
  useEffect(() => {
    const dialog = tools.current;
    if (!dialog) return;
    if (!playing) {
      if (dialog.open) dialog.close?.();
      dialog.removeAttribute('data-modal');
      dialog.setAttribute('open', '');
    } else {
      if (dialog.open && !dialog.hasAttribute('data-modal')) {
        dialog.close?.();
        dialog.removeAttribute('open');
      }
      if (toolsOpen && !dialog.open) {
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute('open', '');
        dialog.setAttribute('data-modal', 'true');
      }
      if (!toolsOpen && dialog.open) {
        dialog.close?.();
        dialog.removeAttribute('open');
        dialog.removeAttribute('data-modal');
      }
    }
  }, [playing, toolsOpen]);
  useEffect(() => {
    const dialog = leaving.current;
    if (state.leaveRequest && dialog && !dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!state.leaveRequest && dialog?.open) {
      dialog.close?.();
      dialog.removeAttribute('open');
    }
  }, [state.leaveRequest]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      const current = client.store.getState();
      if (current.view === 'room' && current.snapshot?.game) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('popstate', client.onPopState);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('popstate', client.onPopState);
      window.removeEventListener('beforeunload', unload);
    };
  }, [client]);
  async function refreshAuth() {
    const session = await authApi.session();
    setAuth(session);
    if (auth?.user && !session.user) client.forgetIdentity();
  }
  function updatedProfile(user: PublicProfile) {
    setAuth((current) => (current ? { ...current, user } : current));
    client.profileChanged(user);
  }
  async function signIn() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const code = new URLSearchParams(window.location.search).get('room');
      const returnTo =
        code && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)
          ? `/?room=${code}`
          : '/';
      const response = await authApi.start(returnTo);
      window.location.assign(response.url);
    } catch {
      setAuthError('Google sign-in could not be started. Please try again.');
      setAuthLoading(false);
    }
  }
  async function logout() {
    await authApi.logout(auth?.csrfToken ?? '');
    client.forgetIdentity();
    setProfileOpen(false);
    await refreshAuth();
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void authApi
      .session(controller.signal)
      .then(async (session) => {
        if (!active) return;
        setAuth(session);
        setAuthLoading(false);
        if (session.user && session.expiresAt)
          client.adoptAccount(session.user, session.room, session.expiresAt);
        if (
          new URLSearchParams(window.location.search).get('auth') === 'failed'
        )
          setAuthError(
            'Google sign-in was cancelled or could not be verified. Please try again.',
          );
        if (session.user || session.guestAllowed) await client.start();
      })
      .catch(() => {
        if (active) {
          setAuthLoading(false);
          setAuthError(
            'Sign-in is unavailable. Refresh the page to try again.',
          );
        }
      });
    window.addEventListener('offline', client.offline);
    window.addEventListener('online', client.online);
    return () => {
      window.removeEventListener('offline', client.offline);
      window.removeEventListener('online', client.online);
      active = false;
      controller.abort();
      client.stop();
    };
  }, [client]);
  const online = state.connection === 'online';
  return (
    <div
      className={`app-shell ${state.view === 'room' && state.snapshot?.game ? 'playing-room' : ''}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Brand onHome={client.home} />
        <div className="header-controls">
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
          {auth?.user && (
            <button
              className="profile-button"
              aria-label="My profile"
              onClick={() => setProfileOpen(true)}
            >
              <Avatar
                name={auth.user.displayName}
                src={avatarSource(
                  auth.user.thumbnailUrl ?? auth.user.googleAvatarUrl,
                )}
                teammate
              />
            </button>
          )}
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={state.view === 'room' ? 'room-main' : 'welcome-main'}
      >
        <div className="feedback-stack">
          {authError && (
            <div className="feedback error" role="alert">
              <p>{authError}</p>
              <button
                aria-label="Dismiss sign-in message"
                onClick={() => setAuthError(null)}
              >
                ×
              </button>
            </div>
          )}
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
              <button
                className="text-button"
                onClick={() => {
                  setToolsOpen(true);
                  const panel = document.getElementById('table-sound-settings');
                  if (panel instanceof HTMLDetailsElement) panel.open = true;
                }}
              >
                Sound & tools
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
        ) : ['multiplayer', 'friends', 'online'].includes(state.view) ? (
          <MultiplayerMenu
            client={client}
            session={auth}
            onSignIn={() => void signIn()}
          />
        ) : (
          <Home
            client={client}
            state={state}
            session={auth}
            authLoading={authLoading}
            onSignIn={() => void signIn()}
          />
        )}
      </main>
      <dialog
        ref={tools}
        className="table-utilities"
        aria-label={playing ? 'Table settings and voice' : 'Game settings'}
        onClick={(event) => {
          if (playing && (event.target as Element).closest('a[href="#main"]')) {
            event.preventDefault();
            setToolsOpen(false);
            document.getElementById('main')?.focus();
          }
        }}
        onCancel={() => setToolsOpen(false)}
        onClose={() => setToolsOpen(false)}
      >
        {playing && (
          <button
            className="button secondary"
            onClick={() => setToolsOpen(false)}
          >
            Back to game
          </button>
        )}
        <PwaControls />
        <ThemeControls />
        <SoundSettings />
        {state.view === 'room' && state.snapshot && (
          <Suspense fallback={<p role="status">Loading room controls…</p>}>
            <RoomControls
              key={`${state.snapshot.roomId}:${state.snapshot.you.actorId}`}
              roomId={state.snapshot.roomId}
              actorId={state.snapshot.you.actorId}
              members={state.snapshot.members}
              online={online}
            />
          </Suspense>
        )}
      </dialog>
      <dialog
        ref={leaving}
        className="leave-dialog"
        aria-labelledby="leave-title"
        onCancel={(event) => {
          event.preventDefault();
          client.cancelLeave();
        }}
      >
        <h2 id="leave-title">Return from your table?</h2>
        <p>
          Your seat, hand and scores stay at the server. Your friends will see
          you disconnect. You can return to this table.
        </p>
        <button className="button primary" onClick={client.cancelLeave}>
          Keep playing
        </button>
        <button className="button secondary" onClick={client.confirmLeave}>
          Return home and keep my seat
        </button>
      </dialog>
      {profileOpen && auth?.user && (
        <Suspense
          fallback={
            <p role="status" className="loading">
              Opening your profile…
            </p>
          }
        >
          <Profile
            session={auth}
            onClose={() => setProfileOpen(false)}
            onUpdate={updatedProfile}
            onRefresh={refreshAuth}
            onLogout={logout}
          />
        </Suspense>
      )}
      <footer className="app-footer">
        <span>Made for the way we play.</span>
        <span lang="si">හිතවතුන් එක්ක ඕමි</span>
      </footer>
    </div>
  );
}

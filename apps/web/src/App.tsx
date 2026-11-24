import { useLocale, useCopy, translate } from './i18n/locale';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { tableErrorCopy } from './i18n/tableErrors';
import { GameClient, friendlyError } from './game/client';
import type { AuthSession, PublicProfile } from '@omi/shared';
import { authApi, avatarSource } from './auth/api';
import { ThemeControls } from './themes/ThemeControls';
import { PwaControls } from './pwa/PwaControls';
import { Brand, Avatar } from './components/Cards';
import { claimOpeningSponsor } from './components/SponsorPlacement';
import { GameBack } from './components/GameChrome';
import { Lobby } from './components/Lobby';
import { SoundSettings } from './audio/SoundSettings';
import { useGameAudio } from './audio/useGameAudio';
const Home = lazy(() =>
  import('./components/Home').then(({ Home }) => ({ default: Home })),
);
const MultiplayerMenu = lazy(() =>
  import('./components/MultiplayerMenu').then(({ MultiplayerMenu }) => ({
    default: MultiplayerMenu,
  })),
);
const PlayerReport = lazy(() => import('./auth/PlayerReport'));
const RoomControls = lazy(() => import('./social/RoomControls'));
const Profile = lazy(() => import('./auth/Profile'));
const GameTable = lazy(() => import('./components/GameTable'));
export function App({ client: supplied }: { client?: GameClient }) {
  const [client] = useState(() => supplied ?? new GameClient());
  useGameAudio(client);
  const language = useLocale((state) => state.language);
  const changeLanguage = useLocale((state) => state.change);
  const text = useCopy();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const state = useStore(client.store);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tools = useRef<HTMLDialogElement>(null);
  const leaving = useRef<HTMLDialogElement>(null);
  const playing = state.view === 'room' && !!state.snapshot?.game;
  const overlay = useRef<'profile' | 'settings' | 'tutorial' | null>(null);
  function openOverlay(panel: 'profile' | 'settings' | 'tutorial') {
    if (overlay.current) return;
    const current = window.history.state;
    window.history.pushState({ ...current, omiOverlay: panel }, '');
    overlay.current = panel;
    if (panel === 'profile') setProfileOpen(true);
    else if (panel === 'settings') setToolsOpen(true);
    else setTutorialOpen(true);
  }
  const closingOverlay = useRef(false);
  function closeOverlay() {
    if (
      !closingOverlay.current &&
      overlay.current &&
      window.history.state?.omiOverlay === overlay.current
    ) {
      closingOverlay.current = true;
      window.history.back();
    }
  }
  useEffect(() => {
    const dialog = tools.current;
    if (!dialog) return;
    if (state.view === 'room' && !playing) {
      if (dialog.open) dialog.close?.();
      dialog.removeAttribute('data-modal');
      dialog.setAttribute('open', '');
      return;
    }
    if (dialog.open && !dialog.hasAttribute('data-modal'))
      dialog.removeAttribute('open');
    if (toolsOpen && !dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.setAttribute('data-modal', '');
    }
    if (!toolsOpen && dialog.open) {
      dialog.close?.();
      dialog.removeAttribute('open');
      dialog.removeAttribute('data-modal');
    }
  }, [toolsOpen, state.view, playing]);
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
    const onPop = (event: PopStateEvent) => {
      closingOverlay.current = false;
      if (overlay.current || event.state?.omiOverlay) {
        overlay.current = event.state?.omiOverlay ?? null;
        setProfileOpen(overlay.current === 'profile');
        setToolsOpen(overlay.current === 'settings');
        setTutorialOpen(overlay.current === 'tutorial');
        return;
      }
      client.onPopState(event);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('popstate', onPop);
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
    overlay.current = null;
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
        else if (session.guestIdentity)
          client.adoptIdentity(session.guestIdentity, session.room);
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
  const [opening, setOpening] = useState(
    () =>
      state.view === 'home' && !state.saved && window.location.search === '',
  );
  const sponsorClaimed = useRef(false);
  const sponsorEligible =
    opening &&
    state.view === 'home' &&
    !state.saved &&
    !state.snapshot &&
    !state.busy &&
    !authLoading &&
    !!auth &&
    !auth.room &&
    !auth.protectedPlay;
  const [showSponsor, setShowSponsor] = useState(false);
  useEffect(
    () =>
      client.store.subscribe(({ view, busy, saved, snapshot }) => {
        if (view !== 'home' || busy || saved || snapshot) setOpening(false);
      }),
    [client],
  );
  useEffect(() => {
    if (sponsorEligible && !sponsorClaimed.current) {
      sponsorClaimed.current = true;
      setShowSponsor(claimOpeningSponsor());
    }
  }, [sponsorEligible]);
  const online = state.connection === 'online';
  return (
    <div
      className={`app-shell ${state.view === 'room' ? '' : 'game-menu'} ${state.view === 'room' && state.snapshot?.game ? 'playing-room' : ''}`}
    >
      <a className="skip-link" href="#main">
        {text('Skip to content')}
      </a>
      <header className="app-header">
        {state.view !== 'home' && state.view !== 'room' && (
          <GameBack onClick={client.back} />
        )}
        <Brand onHome={client.home} />
        <div className="header-controls">
          {state.view === 'home' && (
            <button
              className="button secondary island-settings"
              onClick={() => openOverlay('settings')}
            >
              <span aria-hidden="true">⚙</span> {text('Settings')}
            </button>
          )}

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
                    : text('Disconnected')}
              </>
            ) : (
              'THE SRI LANKAN TABLE'
            )}
          </span>
          {auth?.user && (
            <button
              className="profile-button"
              aria-label={text('My profile')}
              onClick={() => {
                openOverlay('profile');
                void refreshAuth().catch(() => undefined);
              }}
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
          <div id="pwa-messages" />
          {authError && (
            <div className="feedback error" role="alert">
              <p>{translate(language, authError)}</p>
              <button
                aria-label={text('Dismiss sign-in message')}
                onClick={() => setAuthError(null)}
              >
                ×
              </button>
            </div>
          )}
          {state.error && (
            <div className="feedback error" role="alert">
              <p>
                {typeof state.error === 'string'
                  ? translate(language, state.error)
                  : language === 'si'
                    ? tableErrorCopy(state.error)
                    : friendlyError(state.error.code, state.error.action)}
              </p>
              <button
                aria-label={text('Dismiss message')}
                onClick={client.dismiss}
              >
                ×
              </button>
            </div>
          )}
          {state.notice && (
            <div className="feedback notice" role="status">
              <p>{translate(language, state.notice)}</p>
              <button
                aria-label={text('Dismiss message')}
                onClick={client.dismiss}
              >
                ×
              </button>
            </div>
          )}
        </div>
        <Suspense
          fallback={
            <p role="status" className="loading">
              {text('Opening the table…')}
            </p>
          }
        >
          {state.view === 'room' ? (
            <>
              <div className="room-toolbar">
                <GameBack onClick={client.home} />
                <button
                  className="text-button"
                  onClick={() => {
                    if (playing) openOverlay('settings');
                    else tools.current?.scrollIntoView?.({ block: 'start' });
                    const panel = document.getElementById(
                      'table-sound-settings',
                    );
                    if (panel instanceof HTMLDetailsElement) panel.open = true;
                  }}
                >
                  {text('Sound, voice & music')}
                </button>
                {auth?.csrfToken && state.snapshot && (
                  <Suspense fallback={null}>
                    <PlayerReport
                      key={state.snapshot.roomId}
                      csrf={auth.csrfToken}
                      snapshot={state.snapshot}
                    />
                  </Suspense>
                )}
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
                      {text('Reconnect')}
                    </button>
                  )}
                </div>
              )}
              {state.snapshot ? (
                state.snapshot.game ? (
                  <Suspense
                    fallback={
                      <p role="status" className="loading">
                        {text('Opening the table…')}
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
                  {text('Setting your table…')}
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
              tutorialOpen={tutorialOpen}
              openTutorial={() => openOverlay('tutorial')}
              closeTutorial={closeOverlay}
              animateOpening={opening && !auth?.room && !authLoading}
              showSponsor={sponsorEligible && showSponsor}
              onSignIn={() => void signIn()}
            />
          )}
        </Suspense>
      </main>
      {state.view !== 'room' && (
        <nav className="game-dock" aria-label={text('Game menu')}>
          <button className="button secondary" onClick={client.home}>
            {text('Home')}
          </button>
          {auth?.user && (
            <button
              className="button secondary"
              onClick={() => openOverlay('profile')}
            >
              {text('Profile & friends')}
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => openOverlay('settings')}
          >
            {text('Settings & install')}
          </button>
        </nav>
      )}
      <dialog
        ref={tools}
        className={`table-utilities ${state.view === 'room' && !playing ? 'lobby-utilities' : ''}`}
        aria-label={
          playing ? text('Table settings and voice') : text('Game settings')
        }
        onCancel={(event) => {
          event.preventDefault();
          closeOverlay();
        }}
      >
        {(playing || state.view !== 'room') && (
          <GameBack onClick={closeOverlay} />
        )}
        <label>
          Language / භාෂාව{' '}
          <select
            value={language}
            onChange={(event) =>
              changeLanguage(event.target.value === 'si' ? 'si' : 'en')
            }
          >
            <option value="en">English</option>
            <option value="si" lang="si">
              සිංහල
            </option>
          </select>
        </label>
        <PwaControls />
        <ThemeControls />
        <SoundSettings />
        {state.snapshot &&
          (state.snapshot.ranked ||
            auth?.privateCommunicationAllowed === false ||
            (!auth?.user && auth?.guestCommunicationAllowed === false)) && (
            <p>
              {text('Voice and shared music are unavailable at this table.')}
            </p>
          )}

        {state.view === 'room' &&
          state.snapshot &&
          !state.snapshot.ranked &&
          auth?.privateCommunicationAllowed !== false &&
          (auth?.user || auth?.guestCommunicationAllowed !== false) && (
            <Suspense
              fallback={<p role="status">{text('Loading room controls…')}</p>}
            >
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
        <h2 id="leave-title">{text('Return from your table?')}</h2>
        <p>
          {text(
            state.snapshot?.ranked && state.snapshot.game
              ? 'Leaving a ranked game starts the reconnect timer. If it expires, your team forfeits.'
              : 'Your seat is saved. You can return to this table.',
          )}
        </p>
        <button className="button primary" onClick={client.cancelLeave}>
          {text('Keep playing')}
        </button>
        <button className="button secondary" onClick={client.confirmLeave}>
          {text('Return home and keep my seat')}
        </button>
      </dialog>
      {profileOpen && auth?.user && (
        <Suspense
          fallback={
            <p role="status" className="loading">
              {text('Opening your profile…')}
            </p>
          }
        >
          <Profile
            session={auth}
            onClose={closeOverlay}
            onUpdate={updatedProfile}
            onRefresh={refreshAuth}
            onLogout={logout}
            canInvite={
              state.view === 'room' &&
              !!state.snapshot &&
              !state.snapshot.ranked &&
              !state.snapshot.game &&
              state.snapshot.hostId === state.snapshot.you.actorId
            }
            onRoom={(room) => {
              overlay.current = null;
              setProfileOpen(false);
              client.acceptMatch(room);
            }}
          />
        </Suspense>
      )}
      <footer className="app-footer">
        <span>{text('Made for the way we play.')}</span>
        <span lang="si">හිතවතුන් එක්ක ඕමි</span>
      </footer>
    </div>
  );
}

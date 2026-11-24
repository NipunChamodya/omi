import { useCopy } from '../i18n/locale';
import { SponsorPlacement } from './SponsorPlacement';
import { lazy, Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthSession } from '@omi/shared';
import { GoogleButton } from '../auth/GoogleButton';
import type { ClientState, GameClient } from '../game/client';
import { GameButton, GamePanel } from './GameChrome';
import island from '../art/tropical-island.svg';
import guide from '../art/card-guide.svg?no-inline';
import logo from '../art/omi-mark.svg?no-inline';
import './tropical.css';
const Tutorial = lazy(() => import('./Tutorial'));
export function Home({
  client,
  state,
  session,
  authLoading,
  showSponsor,
  animateOpening,
  onSignIn,
  tutorialOpen,
  openTutorial,
  closeTutorial,
}: {
  client: GameClient;
  state: ClientState;
  session: AuthSession | null;
  authLoading: boolean;
  showSponsor: boolean;
  animateOpening: boolean;
  onSignIn: () => void;
  tutorialOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}) {
  const text = useCopy();
  const [sponsorDismissed, setSponsorDismissed] = useState(false);
  const joining = state.view === 'join';
  const [name, setName] = useState(
    state.identity?.displayName ?? state.saved?.displayName ?? '',
  );
  const [code, setCode] = useState(state.inviteCode);
  function submit(event: FormEvent) {
    event.preventDefault();
    void client.enter(
      session?.user?.displayName ?? name,
      joining ? code.trim().toUpperCase() : undefined,
    );
  }
  return (
    <div className="welcome-layout">
      {state.view === 'home' && (
        <section
          className={`island-stage ${animateOpening ? 'opening-hero' : ''}`}
          aria-labelledby="welcome-title"
        >
          <img
            className="island-stage__world"
            src={island}
            alt=""
            fetchPriority="high"
            width="840"
            height="520"
          />
          <div className="island-stage__title">
            <h1 id="welcome-title">
              <img src={logo} alt="OMI" width="394" height="136" />
              <span>{text('Tropical Adventure')}</span>
            </h1>
          </div>
          <img
            className="island-stage__guide"
            src={guide}
            alt=""
            width="270"
            height="235"
          />
          <div className="island-stage__actions">
            <GameButton
              tone="green"
              onClick={() =>
                state.saved
                  ? void client.resume()
                  : client.navigate('multiplayer')
              }
              disabled={
                state.busy ||
                authLoading ||
                (!!state.saved && !session?.user && !session?.guestAllowed)
              }
            >
              {text(state.saved ? 'Return to your table' : 'Play OMI')}{' '}
              <span aria-hidden="true">▶</span>
            </GameButton>
            <button
              className="island-stage__learn"
              onClick={() => {
                setSponsorDismissed(true);
                openTutorial();
              }}
            >
              {text('Learn to play')}
            </button>
          </div>
          {tutorialOpen && (
            <Suspense
              fallback={<p role="status">{text('Loading practice…')}</p>}
            >
              <Tutorial onClose={closeTutorial} />
            </Suspense>
          )}
        </section>
      )}
      <GamePanel titleId="entry-title" recovery={!!state.saved}>
        {state.saved ? (
          <>
            <p className="eyebrow">{text('WELCOME BACK')}</p>
            <h2 id="entry-title">{text('Your seat is saved.')}</h2>
            <p>
              {text('Table code')}{' '}
              <strong className="table-ticket">{state.saved.code}</strong>
            </p>
            {authLoading ? (
              <p role="status">{text('Checking your session…')}</p>
            ) : !session?.user && !session?.guestAllowed ? (
              session?.googleAvailable ? (
                <GoogleButton onClick={onSignIn} disabled={state.busy} />
              ) : (
                <p className="quiet-note">
                  {text('Google sign-in is not available at this table yet.')}
                </p>
              )
            ) : (
              <>
                <button
                  className="button primary"
                  onClick={() => void client.resume()}
                  disabled={state.busy || authLoading}
                >
                  {text('Resume table')} <span aria-hidden="true">↗</span>
                </button>
                <p className="seated-options">
                  {text(
                    'You have a saved seat. Return to your table and finish or leave the match before taking another seat.',
                  )}
                </p>
                {state.view === 'home' && (
                  <div className="seat-shortcuts">
                    <button
                      className="button secondary"
                      onClick={() => client.navigate('create')}
                    >
                      {text('Create a table')}
                    </button>
                    <button
                      className="button secondary"
                      onClick={client.showJoin}
                    >
                      {text('Join a table')}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p className="eyebrow">
              {text(joining ? 'Join a table' : 'Create a table')}
            </p>
            <h2 id="entry-title">
              {text(
                joining ? 'Your friends are waiting.' : 'Bring your people.',
              )}
            </h2>
            <p>
              {joining
                ? text('Enter the code shared by your table host.')
                : text('Start a private table and invite three friends.')}
            </p>
            {authLoading ? (
              <p role="status">{text('Checking your session…')}</p>
            ) : (
              <>
                {session?.user ? (
                  <p className="account-welcome">
                    {text('Playing as')}{' '}
                    <strong>{session.user.displayName}</strong>
                  </p>
                ) : session?.googleAvailable ? (
                  <>
                    <GoogleButton onClick={onSignIn} disabled={state.busy} />
                    <p className="quiet-note">
                      {text('Sign in to save your profile and take your seat.')}
                    </p>
                  </>
                ) : !session?.guestAllowed ? (
                  <p className="quiet-note">
                    {text('Google sign-in is not available at this table yet.')}
                  </p>
                ) : null}
                {(session?.user || session?.guestAllowed) && (
                  <form onSubmit={submit} className="entry-form">
                    {!session?.user && (
                      <>
                        <label htmlFor="player-name">{text('Your name')}</label>
                        <input
                          id="player-name"
                          name="displayName"
                          autoComplete="nickname"
                          placeholder={text('Your name')}
                          required
                          maxLength={32}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          disabled={state.busy || authLoading}
                        />
                      </>
                    )}
                    {joining && (
                      <>
                        <label htmlFor="room-code">{text('Table code')}</label>
                        <input
                          id="room-code"
                          className="code-input"
                          name="roomCode"
                          placeholder="ABCD2345"
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          minLength={8}
                          maxLength={8}
                          pattern="[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}"
                          title={text('An eight-character table code')}
                          required
                          value={code}
                          onChange={(event) =>
                            setCode(event.target.value.toUpperCase())
                          }
                          disabled={state.busy || authLoading}
                        />
                      </>
                    )}
                    <button
                      className="button primary"
                      type="submit"
                      disabled={
                        state.busy ||
                        !(session?.user?.displayName ?? name).trim()
                      }
                    >
                      {state.busy
                        ? text('Finding your seat…')
                        : joining
                          ? text('Join table')
                          : text('Create a table')}{' '}
                      <span aria-hidden="true">↗</span>
                    </button>
                  </form>
                )}
              </>
            )}
            {!joining && (
              <>
                <div className="divider">
                  <span>{text('already have an invite?')}</span>
                </div>
                <button
                  className="button secondary"
                  onClick={client.showJoin}
                  disabled={state.busy || authLoading}
                >
                  {text('Join a table')} <span aria-hidden="true">→</span>
                </button>
              </>
            )}
            <button
              className="button secondary"
              onClick={() => client.navigate('multiplayer')}
            >
              {text('Multiplayer')}
            </button>
          </>
        )}
        {showSponsor && !sponsorDismissed && <SponsorPlacement />}
      </GamePanel>
    </div>
  );
}

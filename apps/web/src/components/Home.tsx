import { useCopy } from '../i18n/locale';
import { SponsorPlacement } from './SponsorPlacement';
import { lazy, Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthSession } from '@omi/shared';
import { GoogleButton } from '../auth/GoogleButton';
import type { ClientState, GameClient } from '../game/client';
import { CardFace } from './Cards';
const Tutorial = lazy(() => import('./Tutorial'));
export function Home({
  client,
  state,
  session,
  authLoading,
  showSponsor,
  animateOpening,
  onSignIn,
}: {
  client: GameClient;
  state: ClientState;
  session: AuthSession | null;
  authLoading: boolean;
  showSponsor: boolean;
  animateOpening: boolean;
  onSignIn: () => void;
}) {
  const [tutorial, setTutorial] = useState(false);
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
      <section
        className={
          !animateOpening ? 'welcome-copy' : 'welcome-copy opening-hero'
        }
        aria-labelledby="welcome-title"
      >
        <p className="eyebrow">
          <span className="tiny-line" /> {text('A SRI LANKAN TRADITION')}
        </p>
        <h1 id="welcome-title">
          {text('Four friends.')}
          <br />
          <em>{text('One table.')}</em>
        </h1>
        <p className="welcome-description">
          {text('A familiar game. A little friendly rivalry.')}
          <br />
          {text('Good company, wherever you are.')}
        </p>
        <div className="hero-cards" aria-hidden="true">
          <div className="hero-card first">
            <CardFace card={{ rank: 'K', suit: 'spades' }} />
          </div>
          <div className="hero-card middle">
            <span className="card-mascot">• ᴗ •</span>
            <CardFace card={{ rank: 'A', suit: 'hearts' }} />
          </div>
          <div className="hero-card last">
            <CardFace card={{ rank: 'Q', suit: 'clubs' }} />
          </div>
        </div>
        {!state.saved && state.view === 'home' && (
          <button
            className="button primary play-omi"
            onClick={() => client.navigate('multiplayer')}
          >
            {text('Play OMI')} <span aria-hidden="true">▶</span>
          </button>
        )}
        <button
          className="text-button"
          onClick={() => {
            setSponsorDismissed(true);
            setTutorial(true);
          }}
        >
          {text('Learn to play')} <span lang="si">· ඕමි ඉගෙන ගන්න</span>
        </button>
        {tutorial && (
          <Suspense fallback={<p role="status">{text('Loading practice…')}</p>}>
            <Tutorial onClose={() => setTutorial(false)} />
          </Suspense>
        )}
        <p className="table-promise">
          {text('4 players')} <span>·</span> {text('2 teams')} <span>·</span>{' '}
          {text('Your kind of company')}
        </p>
      </section>
      <section className="entry-panel" aria-labelledby="entry-title">
        {state.saved ? (
          <>
            <p className="eyebrow">{text('WELCOME BACK')}</p>
            <h2 id="entry-title">{text('Your seat is saved.')}</h2>
            <p>
              {text('Table code')} <strong>{state.saved.code}</strong>
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
                  {text('Return to your table')}{' '}
                  <span aria-hidden="true">↗</span>
                </button>
                <details className="seated-options">
                  <summary>
                    {text('Create a table')} / {text('Join a table')}
                  </summary>
                  <p>
                    {text(
                      'You have a saved seat. Return to your table and finish or leave the match before taking another seat.',
                    )}
                  </p>
                </details>
              </>
            )}
          </>
        ) : (
          <>
            {(joining || state.view === 'create') && (
              <button
                className="text-button back"
                onClick={client.back}
                disabled={state.busy || authLoading}
              >
                ← {text('Back')}
              </button>
            )}
            <p className="eyebrow">
              {joining ? 'TAKE YOUR SEAT' : 'MAKE TIME FOR A GAME'}
            </p>
            <h2 id="entry-title">
              {text(
                joining ? 'Your friends are waiting.' : 'Bring your people.',
              )}
            </h2>
            <p>
              {joining
                ? 'Enter the code shared by your table host.'
                : 'Start a private table and invite three friends.'}
            </p>
            {authLoading ? (
              <p role="status">{text('Checking your session…')}</p>
            ) : (
              <>
                {session?.user ? (
                  <p className="account-welcome">
                    Playing as <strong>{session.user.displayName}</strong>
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
                          placeholder="What should we call you?"
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
                          title="An eight-character table code"
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
                        ? 'Finding your seat…'
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
            <p className="quiet-note">
              {text('Private tables. Familiar rules.')}
              <br />A little space for the people you know.
            </p>
          </>
        )}
        {showSponsor && !sponsorDismissed && <SponsorPlacement />}
      </section>
    </div>
  );
}

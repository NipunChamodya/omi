import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthSession } from '@omi/shared';
import { GoogleButton } from '../auth/GoogleButton';
import type { ClientState, GameClient } from '../game/client';
import { CardFace } from './Cards';
export function Home({
  client,
  state,
  session,
  authLoading,
  onSignIn,
}: {
  client: GameClient;
  state: ClientState;
  session: AuthSession | null;
  authLoading: boolean;
  onSignIn: () => void;
}) {
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
      <section className="welcome-copy" aria-labelledby="welcome-title">
        <p className="eyebrow">
          <span className="tiny-line" /> A SRI LANKAN TRADITION
        </p>
        <h1 id="welcome-title">
          Four friends.
          <br />
          <em>One table.</em>
        </h1>
        <p className="welcome-description">
          A familiar game. A little friendly rivalry.
          <br />
          Good company, wherever you are.
        </p>
        <div className="hero-cards" aria-hidden="true">
          <div className="hero-card first">
            <CardFace card={{ rank: 'K', suit: 'spades' }} />
          </div>
          <div className="hero-card middle">
            <CardFace card={{ rank: 'A', suit: 'hearts' }} />
          </div>
          <div className="hero-card last">
            <CardFace card={{ rank: 'Q', suit: 'clubs' }} />
          </div>
        </div>
        <p className="table-promise">
          4 players <span>·</span> 2 teams <span>·</span> Your kind of company
        </p>
      </section>
      <section className="entry-panel" aria-labelledby="entry-title">
        {state.saved ? (
          <>
            <p className="eyebrow">WELCOME BACK</p>
            <h2 id="entry-title">Your seat is saved.</h2>
            <p>
              Return to table <strong>{state.saved.code}</strong> and pick up
              where you left off.
            </p>
            {authLoading ? (
              <p role="status">Checking your session…</p>
            ) : !session?.user && !session?.guestAllowed ? (
              session?.googleAvailable ? (
                <GoogleButton onClick={onSignIn} disabled={state.busy} />
              ) : (
                <p className="quiet-note">
                  Google sign-in is not available at this table yet.
                </p>
              )
            ) : (
              <>
                <button
                  className="button primary"
                  onClick={() => void client.resume()}
                  disabled={state.busy || authLoading}
                >
                  Return to your table <span aria-hidden="true">↗</span>
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {joining && (
              <button
                className="text-button back"
                onClick={client.home}
                disabled={state.busy || authLoading}
              >
                ← Back
              </button>
            )}
            <p className="eyebrow">
              {joining ? 'TAKE YOUR SEAT' : 'MAKE TIME FOR A GAME'}
            </p>
            <h2 id="entry-title">
              {joining ? 'Your friends are waiting.' : 'Bring your people.'}
            </h2>
            <p>
              {joining
                ? 'Enter the code shared by your table host.'
                : 'Start a private table and invite three friends.'}
            </p>
            {authLoading ? (
              <p role="status">Checking your session…</p>
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
                      Sign in to save your profile and take your seat.
                    </p>
                  </>
                ) : !session?.guestAllowed ? (
                  <p className="quiet-note">
                    Google sign-in is not available at this table yet.
                  </p>
                ) : null}
                {(session?.user || session?.guestAllowed) && (
                  <form onSubmit={submit} className="entry-form">
                    {!session?.user && (
                      <>
                        <label htmlFor="player-name">Your name</label>
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
                        <label htmlFor="room-code">Table code</label>
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
                          ? 'Join table'
                          : 'Create a table'}{' '}
                      <span aria-hidden="true">↗</span>
                    </button>
                  </form>
                )}
              </>
            )}
            {!joining && (
              <>
                <div className="divider">
                  <span>already have an invite?</span>
                </div>
                <button
                  className="button secondary"
                  onClick={client.showJoin}
                  disabled={state.busy || authLoading}
                >
                  Join a table <span aria-hidden="true">→</span>
                </button>
              </>
            )}
            <p className="quiet-note">
              Private tables. Familiar rules.
              <br />A little space for the people you know.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

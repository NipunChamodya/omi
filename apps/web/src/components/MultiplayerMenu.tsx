import './adventure-surfaces.css';
import island from '../art/tropical-island.svg';
import guide from '../art/card-guide.svg?no-inline';
import './tropical.css';
import { GameButton, GamePanel } from './GameChrome';
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
  const { view, saved, busy } = useStore(client.store);
  const [confirmSeat, setConfirmSeat] = useState<string | null>(null);
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
    <div className="mode-stage">
      <GamePanel titleId="mode-title">
        <h1 id="mode-title">
          {text(
            view === 'multiplayer'
              ? 'Choose how to play'
              : view === 'friends'
                ? 'Play with Friends'
                : 'Ranked Match',
          )}
        </h1>
        {view === 'multiplayer' && (
          <div className="mode-grid">
            <GameButton tone="green" onClick={() => client.navigate('create')}>
              {text('Create Private Table')}
            </GameButton>
            <GameButton onClick={client.showJoin}>
              {text('Join Table with Code')}
            </GameButton>
            <GameButton onClick={() => client.navigate('friends')}>
              {text('Play with Friends')}
            </GameButton>
            <GameButton tone="gold" onClick={() => client.navigate('online')}>
              {text('Ranked Match')}
            </GameButton>
          </div>
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
                  <button
                    className="button primary"
                    disabled={!!saved && saved.seatStatus !== 'completed'}
                    onClick={async () => {
                      if (saved?.seatStatus === 'completed') {
                        await client.releaseSavedSeat(
                          session.csrfToken ?? undefined,
                        );
                        if (
                          client.store.getState().saved ||
                          client.store.getState().view !== 'online'
                        )
                          return;
                      }
                      queue.start();
                    }}
                  >
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
      </GamePanel>
      {saved && (
        <GamePanel titleId="mode-seat" recovery>
          <p className="eyebrow">{text('WELCOME BACK')}</p>
          <h2 id="mode-seat">{text('Your seat is saved.')}</h2>
          <p>
            {text('Table code')}{' '}
            <strong className="table-ticket">{saved.code}</strong>
          </p>
          <p>
            {text(
              saved.seatStatus === 'completed'
                ? 'Match complete'
                : saved.seatStatus === 'lobby'
                  ? 'Waiting lobby'
                  : saved.seatStatus === 'ranked'
                    ? 'Ranked match in progress'
                    : saved.seatStatus === 'casual'
                      ? 'Casual match in progress'
                      : 'Check your saved table',
            )}
          </p>
          {saved.memberCount !== undefined && (
            <p>
              {text('Players seated')} · {saved.memberCount}/4
            </p>
          )}
          <GameButton
            tone="green"
            onClick={() => void client.resume()}
            disabled={busy}
          >
            {text(
              saved.seatStatus === 'completed'
                ? 'View results'
                : 'Resume table',
            )}
          </GameButton>
          {saved.seatStatus !== 'ranked' ? (
            confirmSeat === saved.roomId ? (
              <div>
                <p>
                  {text(
                    saved.seatStatus === 'casual'
                      ? 'A bot will take your seat. You cannot return to this match.'
                      : 'Release this seat and make it available for a new game?',
                  )}
                </p>
                <GameButton onClick={() => setConfirmSeat(null)}>
                  {text('Keep my seat')}
                </GameButton>
                <GameButton
                  tone="gold"
                  disabled={busy}
                  onClick={() =>
                    void client.releaseSavedSeat(
                      session?.csrfToken ?? undefined,
                    )
                  }
                >
                  {text(
                    saved.seatStatus === 'casual'
                      ? 'Leave match permanently'
                      : saved.seatStatus === 'completed'
                        ? 'Remove from Home'
                        : 'Release table seat',
                  )}
                </GameButton>
              </div>
            ) : (
              <GameButton
                onClick={() => setConfirmSeat(saved.roomId)}
                disabled={busy}
              >
                {text(
                  saved.seatStatus === 'casual'
                    ? 'Leave match permanently'
                    : saved.seatStatus === 'completed'
                      ? 'Remove from Home'
                      : 'Release table seat',
                )}
              </GameButton>
            )
          ) : (
            <p>
              {text(
                saved.seatStatus === 'ranked'
                  ? 'Leaving a ranked game starts the reconnect timer. If it expires, your team forfeits.'
                  : 'You have a saved seat. Return to your table and finish or leave the match before taking another seat.',
              )}
            </p>
          )}
        </GamePanel>
      )}
      {!saved && (
        <div className="mode-postcard" aria-hidden="true">
          <img
            className="mode-postcard__island"
            src={island}
            alt=""
            width="840"
            height="520"
          />
          <img
            className="mode-postcard__guide"
            src={guide}
            alt=""
            width="270"
            height="235"
          />
        </div>
      )}
    </div>
  );
}

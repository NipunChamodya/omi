import type { Snapshot } from '@omi/shared';
import type { GameClient } from '../game/client';
import { avatarSource } from '../auth/api';
import { Avatar } from './Cards';
export async function copyText(text: string, client: GameClient) {
  try {
    await navigator.clipboard.writeText(text);
    client.notice('Copied. Share it with your friends.');
  } catch {
    client.notice(`Share this with your friends: ${text}`);
  }
}
export function Lobby({
  snapshot,
  client,
  enabled,
  pending,
}: {
  snapshot: Snapshot;
  client: GameClient;
  enabled: boolean;
  pending: boolean;
}) {
  const own = snapshot.members.find(
    (member) => member.actorId === snapshot.you.actorId,
  )!;
  const host = snapshot.you.actorId === snapshot.hostId;
  const allReady =
    snapshot.members.length === 4 &&
    snapshot.members.every((member) => member.ready && member.connected);
  return (
    <section className="lobby" aria-labelledby="lobby-title">
      <p className="eyebrow">A PLACE FOR YOUR PEOPLE</p>
      <h1 id="lobby-title">Your table is ready.</h1>
      <p className="subtitle">
        {snapshot.members.length < 4
          ? `${4 - snapshot.members.length} more ${snapshot.members.length === 3 ? 'friend' : 'friends'} to make a game.`
          : 'Four seats. Let the friendly rivalry begin.'}
      </p>
      <div className="invite-box">
        <div>
          <span className="eyebrow">TABLE CODE</span>
          <strong>{snapshot.code}</strong>
        </div>
        <button
          className="button compact secondary"
          onClick={() => void copyText(snapshot.code, client)}
        >
          Copy code
        </button>
      </div>
      <button
        className="text-button invite-link"
        onClick={() =>
          void copyText(
            `${window.location.origin}${window.location.pathname}?room=${snapshot.code}`,
            client,
          )
        }
      >
        Copy invite link <span aria-hidden="true">↗</span>
      </button>
      <div className="lobby-seats" aria-label="Four table seats">
        {([0, 1, 2, 3] as const).map((seat) => {
          const member = snapshot.members.find((item) => item.seat === seat);
          const teammate = seat % 2 === snapshot.you.team;
          return (
            <div className={`lobby-seat ${member ? '' : 'empty'}`} key={seat}>
              {member ? (
                <Avatar
                  name={member.displayName}
                  teammate={teammate}
                  src={avatarSource(member.avatarUrl)}
                />
              ) : (
                <span className="avatar vacant" aria-hidden="true">
                  +
                </span>
              )}
              <div className="seat-copy">
                <strong>
                  {member?.displayName ?? 'An open seat'}
                  {member?.actorId === own.actorId && (
                    <span className="you-tag">YOU</span>
                  )}
                </strong>
                <span>
                  {teammate ? 'Your team' : 'Other team'} · Seat {seat + 1}
                </span>
              </div>
              <span
                className={`ready-label ${member?.ready && member.connected ? 'is-ready' : ''}`}
              >
                {!member
                  ? 'Invite a friend'
                  : !member.connected
                    ? 'Reconnecting'
                    : member.ready
                      ? '✓ Ready'
                      : 'Not ready'}
              </span>
            </div>
          );
        })}
      </div>
      <p className="quiet-note">
        You and your teammate will sit opposite each other.
      </p>
      <div className="lobby-actions">
        <button
          className={`button ${own.ready ? 'secondary' : 'primary'}`}
          disabled={!enabled || pending}
          aria-pressed={own.ready}
          onClick={() =>
            client.act({ type: 'ready', payload: { ready: !own.ready } })
          }
        >
          {own.ready ? 'Not ready' : 'Ready to play'}
        </button>
        {host ? (
          <button
            className="button primary"
            disabled={!enabled || pending || !allReady}
            onClick={() => client.act({ type: 'start', payload: {} })}
          >
            Start game <span aria-hidden="true">→</span>
          </button>
        ) : (
          <p className="waiting-note">
            {allReady
              ? 'Your host will start the game.'
              : 'Ready up while your friends take their seats.'}
          </p>
        )}
      </div>
    </section>
  );
}

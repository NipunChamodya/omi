import './adventure-chrome.css';
import { useCopy } from '../i18n/locale';
import type { Snapshot } from '@omi/shared';
import type { GameClient } from '../game/client';
import { avatarSource } from '../auth/api';
import island from '../art/tropical-island.svg';
import { GameButton, GameRibbon } from './GameChrome';
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
  const text = useCopy();
  const own = snapshot.members.find(
    (member) => member.actorId === snapshot.you.actorId,
  )!;
  const host = snapshot.you.actorId === snapshot.hostId;
  const allReady =
    snapshot.members.length === 4 &&
    snapshot.members.every((member) => member.ready && member.connected);
  return (
    <section className="lobby adventure-lobby" aria-labelledby="lobby-title">
      <div className="lobby-scene" aria-hidden="true">
        <img src={island} alt="" />
      </div>
      <p className="eyebrow">
        {text(snapshot.ranked ? 'RANKED TABLE' : 'CASUAL TABLE')}
      </p>
      <GameRibbon as="h1" id="lobby-title">
        {text('Your table is ready.')}
      </GameRibbon>
      <p className="subtitle">
        {snapshot.members.length < 4
          ? text('Open seats: {count}').replace(
              '{count}',
              String(4 - snapshot.members.length),
            )
          : text('All four seats are filled.')}
      </p>
      {snapshot.ranked && (
        <p className="quiet-note">
          {text('Chat and voice are off at ranked tables.')}
        </p>
      )}
      <div className="invite-box">
        <div>
          <span className="eyebrow">{text('TABLE CODE')}</span>
          <strong>{snapshot.code}</strong>
        </div>
        <GameButton
          tone="blue"
          className="compact"
          onClick={() => void copyText(snapshot.code, client)}
        >
          {text('Copy code')}
        </GameButton>
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
        {text('Copy invite link')} <span aria-hidden="true">↗</span>
      </button>
      <div className="lobby-seats" aria-label={text('Four table seats')}>
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
                  {member?.displayName ?? text('An open seat')}
                  {member?.actorId === snapshot.hostId && (
                    <span className="host-tag">{text('Host')}</span>
                  )}
                  {member?.actorId === own.actorId && (
                    <span className="you-tag">{text('YOU')}</span>
                  )}
                </strong>
                <span>
                  {text(teammate ? 'Your team' : 'Their team')} · {text('Seat')}{' '}
                  {seat + 1}
                </span>
              </div>
              <span
                className={`ready-label ${member?.ready && member.connected ? 'is-ready' : ''}`}
              >
                {!member
                  ? text('Invite a friend')
                  : !member.connected
                    ? text('Reconnecting')
                    : member.ready
                      ? `✓ ${text('Ready')}`
                      : text('Not ready')}
              </span>
            </div>
          );
        })}
      </div>
      <p className="quiet-note">
        {text('You and your teammate will sit opposite each other.')}
      </p>
      <div className="lobby-actions">
        {host && !snapshot.ranked && snapshot.members.length < 4 && (
          <GameButton
            tone="blue"
            disabled={!enabled || pending}
            onClick={() => client.act({ type: 'add-bot', payload: {} })}
          >
            {text('Add a bot')}
          </GameButton>
        )}
        <GameButton
          tone={own.ready ? 'blue' : 'green'}
          disabled={!enabled || pending}
          aria-pressed={own.ready}
          onClick={() =>
            client.act({ type: 'ready', payload: { ready: !own.ready } })
          }
        >
          {text(own.ready ? 'Not ready' : 'Ready to play')}
        </GameButton>
        {host ? (
          <GameButton
            tone="gold"
            disabled={!enabled || pending || !allReady}
            onClick={() => client.act({ type: 'start', payload: {} })}
          >
            {text('Start game')} <span aria-hidden="true">→</span>
          </GameButton>
        ) : (
          <p className="waiting-note">
            {allReady
              ? text('Your host will start the game.')
              : text('Ready up while your friends take their seats.')}
          </p>
        )}
      </div>
    </section>
  );
}

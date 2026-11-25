import './adventure-chrome.css';
import { GameRibbon } from './GameChrome';
import './adventure-surfaces.css';
import {
  TurnCountdown,
  TrickReplay,
  readRevealSeconds,
  revealSeconds,
} from './TableTiming';
import './table-adventure.css';
import { PixiTable } from '../rendering/PixiTable';
import { useDataSaver } from '../pwa/preferences';
import { useSeatSpeaking } from '../voice/seatPresence';
import { useCopy } from '../i18n/locale';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from 'zustand';
import { InteractiveCard } from '../interactions/InteractiveCard';
import { TableMotion } from '../interactions/TableMotion';
import { gameAudio } from '../audio/gameAudio';
import type { Card, Member, Seat, Snapshot } from '@omi/shared';
import type { GameClient } from '../game/client';
import { avatarSource } from '../auth/api';
import { Avatar, CardBack, CardFace, useCardName, suits } from './Cards';
const cardKey = (card: Card) => `${card.suit}:${card.rank}`;
const relative = (seat: Seat, local: Seat) => (seat - local + 4) % 4;
const positions = ['bottom', 'right', 'top', 'left'] as const;
function fanPosition(index: number, total: number): CSSProperties {
  const center = (total - 1) / 2;
  const position = (index - center) / Math.max(center, 3);
  return {
    '--fan-angle': `${position * 10}deg`,
    '--fan-rise': `${position ** 2 * 7 - 2}px`,
  } as CSSProperties;
}
function useTablePulse(value: string, animate: boolean) {
  const element = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || !animate || document.hidden) return;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motion?.matches) return;
    const pulse = element.current?.animate?.(
      [
        { filter: 'brightness(1)' },
        { filter: 'brightness(1.25)' },
        { filter: 'brightness(1)' },
      ],
      { duration: 390, easing: 'ease-out' },
    );
    const cancel = () => pulse?.cancel();
    document.addEventListener('visibilitychange', cancel);
    motion?.addEventListener('change', cancel);
    return () => {
      cancel();
      document.removeEventListener('visibilitychange', cancel);
      motion?.removeEventListener('change', cancel);
    };
  }, [animate, value]);
  return element;
}

function ReconnectCountdown({ deadline }: { deadline: number }) {
  const text = useCopy();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span title={text('Reconnection time remaining')}>
      {Math.max(0, Math.ceil((deadline - now) / 1_000))}s
    </span>
  );
}
function Player({
  member,
  snapshot,
  position,
  trickWinner,
}: {
  member: Member;
  snapshot: Snapshot;
  position: string;
  trickWinner: boolean;
}) {
  const text = useCopy();
  const speaking = useSeatSpeaking(snapshot.roomId, member.actorId);
  const active = snapshot.game!.turn === member.seat;
  const local = member.seat === snapshot.you.seat;
  return (
    <div
      className={`table-player seat-${position} ${active ? 'active' : ''} ${trickWinner ? 'trick-seat-winner' : ''}`}
      data-testid={`seat-${position}`}
      data-speaking={speaking || undefined}
    >
      <span className="avatar-wrap">
        <Avatar
          name={member.displayName}
          seat={member.seat}
          src={avatarSource(member.avatarUrl)}
          teammate={member.team === snapshot.you.team}
        />
        <span
          className={`presence-dot ${member.connected ? 'connected' : ''}`}
          aria-label={
            member.connected ? text('Connected') : text('Disconnected')
          }
        />
        {speaking && (
          <span
            className="seat-speaking"
            role="img"
            aria-label={text('Speaking')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 7v2m3-5v8m4-10v12m3-9v6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
      </span>
      <strong className="player-name" title={member.displayName}>
        {local ? text('You') : member.displayName}
      </strong>
      <span className="player-detail">
        {member.disconnectDeadline !== undefined && !snapshot.score.final ? (
          <ReconnectCountdown deadline={member.disconnectDeadline} />
        ) : member.bot ? (
          text('AI bot')
        ) : local ? (
          text('Your seat')
        ) : member.team === snapshot.you.team ? (
          text('Teammate')
        ) : (
          text('Opponent')
        )}
      </span>
      {active && snapshot.turnClock && (
        <TurnCountdown clock={snapshot.turnClock} />
      )}
      {!local && (
        <span
          className="hidden-hand"
          aria-label={text('{count} cards face down').replace(
            '{count}',
            String(snapshot.game!.handCounts[member.seat]),
          )}
        >
          <span className="hidden-card-backs" aria-hidden="true">
            <CardBack />
            <CardBack />
            <CardBack />
          </span>
          <small>{snapshot.game!.handCounts[member.seat]}</small>
        </span>
      )}
    </div>
  );
}
export default function GameTable({
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
  const game = snapshot.game!;
  const sceneRoot = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cut, setCut] = useState(16);
  const dropZone = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const submitted = useRef(false);
  const presentation = useStore(client.store, (state) => state.presentation);
  const text = useCopy();
  const cardName = useCardName();
  const live =
    enabled && presentation?.roomId === snapshot.roomId ? presentation : null;
  useEffect(() => {
    if (!pending) submitted.current = false;
  }, [pending]);
  useEffect(() => {
    if (!enabled) {
      setDragging(false);
      setOver(false);
    }
  }, [enabled]);
  useEffect(() => {
    if (!game.hand.some((card) => cardKey(card) === selected))
      setSelected(null);
  }, [game.hand, selected]);
  const yours = game.turn === snapshot.you.seat;
  const final = snapshot.score.final;
  const playable =
    enabled && !pending && !final && yours && game.phase === 'playing';
  const play = (card: Card) => {
    if (!playable || submitted.current || client.store.getState().pending)
      return;
    submitted.current = true;
    client.act({ type: 'play', payload: { card } });
    // The transport may decline synchronously; never strand a visual card.
    if (!client.store.getState().pending) submitted.current = false;
  };
  const saver = useDataSaver((state) => state.enabled);
  const animateIndicators = !!live && !saver;
  const yourScore = useTablePulse(
    String(snapshot.score.totals[snapshot.you.team]),
    animateIndicators,
  );
  const otherScore = useTablePulse(
    String(snapshot.score.totals[snapshot.you.team === 0 ? 1 : 0]),
    animateIndicators,
  );
  const trumpBadge = useTablePulse(game.trump ?? '', animateIndicators);
  const chosen = game.hand.find((card) => cardKey(card) === selected);
  const cutter = ((game.dealer + 3) % 4) as Seat;
  const name = (seat: Seat | null) =>
    snapshot.members.find((member) => member.seat === seat)?.displayName ??
    text('Player');
  const lastTrick = game.tricks.at(-1);
  const [revealFor, setRevealFor] = useState(readRevealSeconds);
  const [replay, setReplay] = useState<{
    trick: NonNullable<typeof lastTrick>;
    round: string;
  } | null>(null);
  const [reveals, setReveals] = useState<
    readonly { trick: NonNullable<typeof lastTrick>; round: string }[]
  >([]);
  const seen = useRef({ round: game.id, index: game.tricks.length });
  useEffect(() => {
    const index = game.tricks.length;
    if (!enabled || document.hidden || seen.current.round !== game.id) {
      seen.current = { round: game.id, index };
      setReveals([]);
      return;
    }
    if (index <= seen.current.index) return;
    const recent = game.tricks
      .slice(seen.current.index)
      .map((trick) => ({ trick, round: game.id }));
    seen.current.index = index;
    setReveals((pending) => [...pending, ...recent]);
  }, [enabled, game.id, game.tricks]);
  useEffect(() => {
    const suspend = () => {
      if (document.hidden) setReveals([]);
    };
    document.addEventListener('visibilitychange', suspend);
    return () => document.removeEventListener('visibilitychange', suspend);
  }, []);
  const reveal = enabled ? reveals[0] : undefined;
  useEffect(() => {
    if (!reveal) return;
    const timeout = setTimeout(
      () => setReveals((pending) => pending.slice(1)),
      revealFor * 1000,
    );
    return () => clearTimeout(timeout);
  }, [reveal, revealFor]);
  const visibleReveal = reveal?.round === game.id ? reveal.trick : null;
  const plays = visibleReveal?.plays ?? game.trick;
  const completed = !!visibleReveal;
  const trickCounts = [
    game.tricks.filter((trick) => trick.winner % 2 === snapshot.you.team)
      .length,
    game.tricks.filter((trick) => trick.winner % 2 !== snapshot.you.team)
      .length,
  ];
  return (
    <div className={`game-view phase-${game.phase}`} ref={sceneRoot}>
      <PixiTable
        root={sceneRoot}
        revealId={
          visibleReveal
            ? `${game.id}:${visibleReveal.plays.map((play) => cardKey(play.card)).join('/')}`
            : null
        }
      />
      <section
        className="scoreboard"
        aria-label={text('Team scores')}
        data-testid="score"
      >
        <div ref={yourScore}>
          <span>{text('Your team')}</span>
          <strong>{snapshot.score.totals[snapshot.you.team]}</strong>
          <small>
            {text(trickCounts[0] === 1 ? '1 trick' : '{count} tricks').replace(
              '{count}',
              String(trickCounts[0]),
            )}
          </small>
        </div>
        <div className="trump-badge" ref={trumpBadge}>
          <span className="eyebrow">{text('TRUMP')}</span>
          <strong
            className={
              game.trump === 'hearts' || game.trump === 'diamonds'
                ? 'red-suit'
                : ''
            }
          >
            {game.trump ? suits[game.trump].symbol : '—'}
          </strong>
          <small>
            {game.trump ? text(suits[game.trump].label) : text('Not chosen')}
          </small>
        </div>
        <div ref={otherScore}>
          <span>{text('Their team')}</span>
          <strong>
            {snapshot.score.totals[snapshot.you.team === 0 ? 1 : 0]}
          </strong>
          <small>
            {text(trickCounts[1] === 1 ? '1 trick' : '{count} tricks').replace(
              '{count}',
              String(trickCounts[1]),
            )}
          </small>
        </div>
      </section>
      <div className="round-meta">
        <span>
          {text('Round · {count} / 8 tricks').replace(
            '{count}',
            String(game.tricks.length),
          )}
        </span>
        <span lang="si">කැට කොල{snapshot.score.carry ? ' · Sepuru' : ''}</span>
      </div>
      <section
        className={`felt-table ${dragging ? 'drag-active' : ''}`}
        aria-label={text('Game table')}
      >
        {snapshot.members.map((member) => (
          <Player
            key={member.actorId}
            member={member}
            snapshot={snapshot}
            position={positions[relative(member.seat, snapshot.you.seat)]!}
            trickWinner={visibleReveal?.winner === member.seat}
          />
        ))}
        <div
          ref={dropZone}
          data-testid="card-drop-zone"
          data-drop-ready={dragging && playable}
          data-collect-to={
            visibleReveal &&
            positions[relative(visibleReveal.winner, snapshot.you.seat)]
          }
          style={
            visibleReveal
              ? ({
                  '--collect-after': `${revealFor * 1000 - 300}ms`,
                } as CSSProperties)
              : undefined
          }
          className={`trick-area ${completed ? 'completed' : ''} ${over ? 'drop-over' : ''} `}
          aria-label={
            completed ? text('Last completed trick') : text('Current trick')
          }
        >
          {plays.map((play) => (
            <div
              className={`thrown-card ${visibleReveal?.winner === play.seat ? 'winning-play' : ''} thrown-${positions[relative(play.seat, snapshot.you.seat)]} ${live?.event.kind === 'card-played' && cardKey(live.event.card) === cardKey(play.card) ? 'animate-play' : ''}`}
              key={`${game.id}-${cardKey(play.card)}`}
              role="img"
              aria-label={text('{player} played {card}').replace(
                /\{player\}|\{card\}/g,
                (key) =>
                  key === '{card}' ? cardName(play.card) : name(play.seat),
              )}
            >
              <CardFace card={play.card} />
            </div>
          ))}
        </div>
        {visibleReveal && (
          <div className="trick-banner" role="status">
            {text(
              visibleReveal.winner % 2 === snapshot.you.team
                ? 'Your team took the trick'
                : 'Their team took the trick',
            )}{' '}
            · {name(visibleReveal.winner)}
          </div>
        )}
        <TableMotion message={live} />
        {dragging && (
          <span className="drop-caption" role="status">
            {text(
              playable ? 'Release in the center to play' : 'Wait for your turn',
            )}
          </span>
        )}
      </section>
      <div className="table-turn-row">
        <p
          className={`turn-status ${yours && game.phase === 'playing' ? 'your-turn' : ''}`}
          data-testid="turn-status"
          data-your-turn={yours && game.phase === 'playing'}
          role="status"
        >
          {live?.event.kind === 'round-started' &&
            live.event.cancelledBy !== undefined && (
              <>{text('No trump. Same dealer.')} </>
            )}
          {!enabled
            ? text('Reconnecting to your table…')
            : game.phase === 'awaiting-cut'
              ? text('{name} is cutting the deck.').replace(
                  '{name}',
                  name(cutter),
                )
              : game.phase === 'awaiting-trump'
                ? yours
                  ? text('Choose your trump suit.')
                  : text('{name} is choosing trump.').replace(
                      '{name}',
                      name(game.selector),
                    )
                : game.phase === 'complete'
                  ? text('Eight tricks. One good game.')
                  : game.phase === 'cancelled'
                    ? text('This round was cancelled.')
                    : yours
                      ? game.trick.length
                        ? text('Your turn. Choose a card.')
                        : text('Your lead. Choose a card.')
                      : text('Waiting for {name}…').replace(
                          '{name}',
                          name(game.turn),
                        )}
        </p>
        {game.tricks.length > 0 && (
          <div className="table-timing-controls">
            <button
              className="text-button"
              disabled={!lastTrick}
              onClick={() => {
                if (lastTrick) setReplay({ trick: lastTrick, round: game.id });
              }}
            >
              {text('Replay last trick')}
            </button>
            <label>
              {text('Trick reveal speed')}
              <select
                value={revealFor}
                onChange={(event) => {
                  const value = revealSeconds.find(
                    (seconds) => seconds === Number(event.target.value),
                  );
                  if (!value) return;
                  setRevealFor(value);
                  try {
                    localStorage.setItem('omi.trick-reveal', String(value));
                  } catch {
                    /* This session still works. */
                  }
                }}
              >
                <option value="2">{text('Fast')} · 2s</option>
                <option value="3">{text('Normal')} · 3s</option>
                <option value="5">{text('Relaxed')} · 5s</option>
              </select>
            </label>
          </div>
        )}
      </div>
      {game.phase === 'awaiting-cut' && cutter === snapshot.you.seat && (
        <section className="action-panel" aria-labelledby="cut-title">
          <h2 id="cut-title">{text('Cut the deck.')}</h2>
          <p>
            {text(
              'Lift the top {count} cards. Then the first four will be dealt.',
            ).replace('{count}', String(cut))}
          </p>
          <label htmlFor="cut-position">
            {text('Cut position')} <output>{cut}</output>
          </label>
          <input
            id="cut-position"
            type="range"
            min={1}
            max={31}
            value={cut}
            onChange={(event) => setCut(Number(event.target.value))}
            disabled={!enabled || pending}
          />
          <button
            className="button primary"
            onClick={() =>
              client.act({ type: 'cut', payload: { offset: cut } })
            }
            disabled={!enabled || pending}
          >
            {text('Cut & deal')}
          </button>
        </section>
      )}
      {game.phase === 'awaiting-trump' &&
        game.selector === snapshot.you.seat && (
          <section className="action-panel" aria-labelledby="trump-title">
            <h2 id="trump-title">{text('Choose trump.')}</h2>
            <p>{text('Choose a suit from your first four cards.')}</p>
            <div className="trump-choices">
              {(Object.keys(suits) as (keyof typeof suits)[])
                .filter((suit) => game.hand.some((card) => card.suit === suit))
                .map((suit) => (
                  <button
                    key={suit}
                    className={`suit-choice ${suit === 'hearts' || suit === 'diamonds' ? 'red-suit' : ''}`}
                    aria-label={text('Trump {suit}').replace(
                      '{suit}',
                      text(suits[suit].label).toLocaleLowerCase(),
                    )}
                    disabled={!enabled || pending}
                    onClick={() =>
                      client.act({ type: 'trump', payload: { suit } })
                    }
                  >
                    <strong aria-hidden="true">{suits[suit].symbol}</strong>
                    <span>{text(suits[suit].label)}</span>
                    <small lang="si">{suits[suit].sinhala}</small>
                  </button>
                ))}
            </div>
          </section>
        )}
      {replay?.round === game.id && (
        <TrickReplay
          trick={replay.trick}
          snapshot={snapshot}
          onClose={() => setReplay(null)}
        />
      )}
      {game.hand.length > 0 &&
        game.phase !== 'complete' &&
        game.phase !== 'cancelled' && (
          <section className="hand-panel" aria-label={text('Your hand')}>
            <div className="hand-heading">
              <h2>{text('Your hand')}</h2>
              <span>
                {text('{count} cards').replace(
                  '{count}',
                  String(game.hand.length),
                )}
                {game.phase === 'playing'
                  ? text(' · Hold & drag, or select')
                  : ''}
              </span>
            </div>
            <div className={`hand-grid hand-fan hand-${game.hand.length}`}>
              {game.hand.map((card, index) => (
                <div
                  className="fan-slot"
                  key={cardKey(card)}
                  style={fanPosition(index, game.hand.length)}
                >
                  <InteractiveCard
                    card={card}
                    selected={selected === cardKey(card)}
                    disabled={game.phase !== 'playing' || !enabled || pending}
                    playable={playable}
                    pending={pending}
                    zone={dropZone}
                    deal={live?.event.kind === 'cards-dealt'}
                    onDrag={(active, inside) => {
                      setDragging(active);
                      setOver(inside);
                    }}
                    onSelect={() =>
                      setSelected(
                        selected === cardKey(card) ? null : cardKey(card),
                      )
                    }
                    onPlay={() => play(card)}
                  />
                </div>
              ))}
            </div>
            {game.phase === 'playing' && (
              <button
                className="button primary play-button"
                aria-label={text('Play selected card')}
                disabled={!playable || !chosen}
                onClick={() => {
                  if (chosen) {
                    void gameAudio.play('release');
                    play(chosen);
                  }
                }}
              >
                {pending
                  ? text('Playing…')
                  : chosen
                    ? text('Play {card}').replace(
                        '{card}',
                        `${chosen.rank} ${suits[chosen.suit].symbol}`,
                      )
                    : yours
                      ? text('Select a card to play')
                      : text('Waiting for your turn')}
              </button>
            )}
          </section>
        )}
      {game.phase === 'complete' && (
        <section
          className={`result-panel ${final?.reason === 'loan_loss' && live ? 'loan-loss' : ''}`}
          aria-labelledby="result-title"
          tabIndex={0}
        >
          <div
            className={`result-medallion ${final && final.winner !== snapshot.you.team ? 'result-medallion--defeat' : ''}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
              <path
                d="M20 14H10v9c0 9 8 14 16 13m18-22h10v9c0 9-8 14-16 13"
                stroke="#8c491d"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M19 10h26v14c0 9-5 16-13 16s-13-7-13-16V10Z"
                fill="#ffd044"
                stroke="#8c491d"
                strokeWidth="3"
              />
              <path
                d="M32 40v10m-10 5h20"
                stroke="#8c491d"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="m32 16 2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5Z"
                fill="#fff2d0"
              />
            </svg>
          </div>
          <GameRibbon id="result-title">
            {final?.reason === 'double_forfeit'
              ? text('Both teams forfeited')
              : final
                ? final.winner === snapshot.you.team
                  ? text('Your team won!')
                  : text('The other team won!')
                : text('Round complete.')}
          </GameRibbon>
          <p>
            {final?.reason === 'loan_loss' ? (
              <>
                <span lang="si">ණයටත් පැරදුණා!</span> ·{' '}
                {text('The losing team couldn’t cover the kata kola transfer.')}{' '}
                😂
              </>
            ) : final?.reason === 'ranked_forfeit' ? (
              text('A ranked player’s reconnection period expired.')
            ) : final?.reason === 'double_forfeit' ? (
              text(
                'Players on both teams reached the reconnection deadline together.',
              )
            ) : snapshot.result?.outcome === 'seporu' ? (
              text(
                'සෙපෝරු · Four tricks each. Sepuru applies to the next settlement.',
              )
            ) : snapshot.result?.outcome === 'kapothi' ? (
              text('කපෝති · All eight tricks. Three kata kola owed.')
            ) : snapshot.result?.outcome === 'baldu' ? (
              text(
                'බාල්දුයි · Correct accusation. The hand ends with a three kata kola obligation.',
              )
            ) : (
              text(
                '{count} tricks for your team. The round score is settled.',
              ).replace(
                '{count}',
                String(snapshot.result?.tricks[snapshot.you.team] ?? 0),
              )
            )}
          </p>
          <div className="result-scores">
            <span>
              {text('Your team')}{' '}
              <strong>{snapshot.score.totals[snapshot.you.team]}</strong>
            </span>
            <span>
              {text('Their team')}{' '}
              <strong>
                {snapshot.score.totals[snapshot.you.team === 0 ? 1 : 0]}
              </strong>
            </span>
          </div>
          {!final && snapshot.hostId === snapshot.you.actorId && (
            <button
              className="button primary"
              onClick={() => client.act({ type: 'next-round', payload: {} })}
              disabled={
                !enabled ||
                pending ||
                snapshot.capabilities?.nextRound === false ||
                snapshot.members.some((member) => !member.connected)
              }
            >
              {text('Next round')} <span aria-hidden="true">→</span>
            </button>
          )}
          {final && (
            <div className="result-actions">
              {snapshot.rematchAvailable !== false && (
                <button
                  className="button secondary"
                  disabled={!enabled || pending}
                  onClick={() => client.act({ type: 'rematch', payload: {} })}
                >
                  {snapshot.rematchVotes?.includes(snapshot.you.seat)
                    ? text('Waiting for rematch')
                    : text('Play again')}
                </button>
              )}
              <button
                className="button primary"
                disabled={!enabled || pending}
                onClick={() => client.act({ type: 'leave-match', payload: {} })}
              >
                {text('Return home')}
              </button>
            </div>
          )}
          {!final && (
            <p className="quiet-note">
              {snapshot.members.some((member) => !member.connected)
                ? text('All four players must reconnect before the next round.')
                : text(
                    'The host can start the next round when all four players are connected.',
                  )}
            </p>
          )}
        </section>
      )}
      {game.phase === 'cancelled' && (
        <section className="result-panel">
          <h2>{text('Let’s deal again.')}</h2>
          <p>
            {text(
              'The no-trump report was confirmed. This round has been cancelled.',
            )}
          </p>
          {snapshot.hostId === snapshot.you.actorId && (
            <button
              className="button primary"
              disabled={!enabled || pending}
              onClick={() => client.act({ type: 'restart', payload: {} })}
            >
              Restart deal
            </button>
          )}
        </section>
      )}
      {(game.phase === 'playing' || game.phase === 'complete') && (
        <details className="table-details">
          <summary>{text('Table history & reports')}</summary>
          <p className="quiet-note">
            {text(
              'Report an opponent’s play after its trick finishes and before the round ends.',
            )}
          </p>
          {game.phase === 'playing' &&
            game.trump &&
            game.hand.length === 8 &&
            !game.trick.length &&
            !game.tricks.length &&
            game.hand.every((card) => card.suit !== game.trump) && (
              <button
                className="button secondary"
                disabled={!enabled || pending}
                onClick={() =>
                  client.act({ type: 'report-no-trump', payload: {} })
                }
              >
                Redeal without trump <span lang="si">අත පොලේ ගහන්න</span>
              </button>
            )}
          {[
            ...game.tricks.map((trick, i) => ({
              plays: trick.plays,
              index: i,
            })),
            ...(game.trick.length
              ? [{ plays: game.trick, index: game.tricks.length }]
              : []),
          ].map(({ plays: trick, index }) => (
            <div className="history-trick" key={index}>
              <h3>
                {text('Trick {count}').replace('{count}', String(index + 1))}
              </h3>
              {trick.map((play, order) => (
                <div className="history-play" key={play.seat}>
                  <span>
                    {name(play.seat)}{' '}
                    <strong>
                      {play.card.rank} {suits[play.card.suit].symbol}
                    </strong>
                  </span>
                  {game.phase === 'playing' &&
                    index < game.tricks.length &&
                    play.seat % 2 !== snapshot.you.team && (
                      <button
                        className="text-button"
                        aria-label={text(
                          'Report {card} played by {player}',
                        ).replace(/\{player\}|\{card\}/g, (key) =>
                          key === '{card}'
                            ? cardName(play.card)
                            : name(play.seat),
                        )}
                        disabled={!enabled || pending}
                        onClick={() =>
                          client.act({
                            type: 'accuse',
                            payload: { playId: index * 4 + order },
                          })
                        }
                      >
                        {text('Report play')}
                      </button>
                    )}
                </div>
              ))}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

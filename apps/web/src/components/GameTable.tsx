import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { InteractiveCard } from '../interactions/InteractiveCard';
import { TableMotion } from '../interactions/TableMotion';
import { gameAudio } from '../audio/gameAudio';
import type { Card, Member, Seat, Snapshot } from '@omi/shared';
import type { GameClient } from '../game/client';
import { avatarSource } from '../auth/api';
import { Avatar, CardBack, CardFace, cardName, suits } from './Cards';
const cardKey = (card: Card) => `${card.suit}:${card.rank}`;
const relative = (seat: Seat, local: Seat) => (seat - local + 4) % 4;
const positions = ['bottom', 'right', 'top', 'left'] as const;
function Player({
  member,
  snapshot,
  position,
}: {
  member: Member;
  snapshot: Snapshot;
  position: string;
}) {
  const active = snapshot.game!.turn === member.seat;
  const local = member.seat === snapshot.you.seat;
  return (
    <div
      className={`table-player seat-${position} ${active ? 'active' : ''}`}
      data-testid={`seat-${position}`}
    >
      <span className="avatar-wrap">
        <Avatar
          name={member.displayName}
          src={avatarSource(member.avatarUrl)}
          teammate={member.team === snapshot.you.team}
        />
        <span
          className={`presence-dot ${member.connected ? 'connected' : ''}`}
          aria-label={member.connected ? 'Connected' : 'Disconnected'}
        />
      </span>
      <strong className="player-name" title={member.displayName}>
        {local ? 'You' : member.displayName}
      </strong>
      <span className="player-detail">
        {local
          ? 'Your seat'
          : member.team === snapshot.you.team
            ? 'Teammate'
            : 'Opponent'}
      </span>
      {!local && (
        <span
          className="hidden-hand"
          aria-label={`${snapshot.game!.handCounts[member.seat]} cards face down`}
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
  const [selected, setSelected] = useState<string | null>(null);
  const [cut, setCut] = useState(16);
  const dropZone = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const submitted = useRef(false);
  const presentation = useStore(client.store, (state) => state.presentation);
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
  const playable = enabled && !pending && yours && game.phase === 'playing';
  const play = (card: Card) => {
    if (!playable || submitted.current || client.store.getState().pending)
      return;
    submitted.current = true;
    client.act({ type: 'play', payload: { card } });
    // The transport may decline synchronously; never strand a visual card.
    if (!client.store.getState().pending) submitted.current = false;
  };
  const chosen = game.hand.find((card) => cardKey(card) === selected);
  const cutter = ((game.dealer + 3) % 4) as Seat;
  const name = (seat: Seat | null) =>
    snapshot.members.find((member) => member.seat === seat)?.displayName ??
    'Your friend';
  const lastTrick = game.tricks.at(-1);
  const plays = game.trick.length ? game.trick : (lastTrick?.plays ?? []);
  const completed = game.trick.length === 0 && !!lastTrick;
  const trickCounts = [
    game.tricks.filter((trick) => trick.winner % 2 === snapshot.you.team)
      .length,
    game.tricks.filter((trick) => trick.winner % 2 !== snapshot.you.team)
      .length,
  ];
  return (
    <div className={`game-view phase-${game.phase}`}>
      <section
        className="scoreboard"
        aria-label="Team scores"
        data-testid="score"
      >
        <div>
          <span>Your team</span>
          <strong>{snapshot.score.totals[snapshot.you.team]}</strong>
          <small>
            {trickCounts[0]} {trickCounts[0] === 1 ? 'trick' : 'tricks'}
          </small>
        </div>
        <div className="trump-badge">
          <span className="eyebrow">TRUMP</span>
          <strong
            className={
              game.trump === 'hearts' || game.trump === 'diamonds'
                ? 'red-suit'
                : ''
            }
          >
            {game.trump ? suits[game.trump].symbol : '—'}
          </strong>
          <small>{game.trump ? suits[game.trump].label : 'Not chosen'}</small>
        </div>
        <div>
          <span>Their team</span>
          <strong>
            {snapshot.score.totals[snapshot.you.team === 0 ? 1 : 0]}
          </strong>
          <small>
            {trickCounts[1]} {trickCounts[1] === 1 ? 'trick' : 'tricks'}
          </small>
        </div>
      </section>
      <div className="round-meta">
        <span>Round · {game.tricks.length} / 8 tricks</span>
        <span lang="si">කැට කොල{snapshot.score.carry ? ' · 1 carry' : ''}</span>
      </div>
      <section
        className={`felt-table ${dragging ? 'drag-active' : ''}`}
        aria-label="Game table"
      >
        {snapshot.members.map((member) => (
          <Player
            key={member.actorId}
            member={member}
            snapshot={snapshot}
            position={positions[relative(member.seat, snapshot.you.seat)]!}
          />
        ))}
        <div
          ref={dropZone}
          data-testid="card-drop-zone"
          data-drop-ready={dragging && playable}
          className={`trick-area ${completed ? 'completed' : ''} ${over ? 'drop-over' : ''} ${live?.event.kind === 'card-played' && live.event.completedTrick ? `trick-collect collect-${positions[relative(live.event.completedTrick.winner, snapshot.you.seat)]}` : ''}`}
          aria-label={completed ? 'Last completed trick' : 'Current trick'}
        >
          {!plays.length && (
            <div className="table-watermark" aria-hidden="true">
              <span>♠</span>
              <small>OMI</small>
            </div>
          )}
          {plays.map((play) => (
            <div
              className={`thrown-card thrown-${positions[relative(play.seat, snapshot.you.seat)]} ${live?.event.kind === 'card-played' && cardKey(live.event.card) === cardKey(play.card) ? 'animate-play' : ''}`}
              key={`${game.id}-${cardKey(play.card)}`}
              role="img"
              aria-label={`${name(play.seat)} played ${cardName(play.card)}`}
            >
              <CardFace card={play.card} />
            </div>
          ))}
        </div>
        <TableMotion message={live} />
        {dragging && (
          <span className="drop-caption" role="status">
            {playable ? 'Release in the center to play' : 'Wait for your turn'}
          </span>
        )}
      </section>
      {completed && (
        <p className="trick-winner">
          {lastTrick!.winner === snapshot.you.seat
            ? 'You won'
            : `${name(lastTrick!.winner)} won`}{' '}
          the last trick
        </p>
      )}

      <p
        className={`turn-status ${yours && game.phase === 'playing' ? 'your-turn' : ''}`}
        data-testid="turn-status"
        data-your-turn={yours && game.phase === 'playing'}
        role="status"
      >
        {!enabled
          ? 'Reconnecting to your table…'
          : game.phase === 'awaiting-cut'
            ? `${name(cutter)} is cutting the deck.`
            : game.phase === 'awaiting-trump'
              ? yours
                ? 'Choose your trump suit.'
                : `${name(game.selector)} is choosing trump.`
              : game.phase === 'complete'
                ? 'Eight tricks. One good game.'
                : game.phase === 'cancelled'
                  ? 'This round was cancelled.'
                  : yours
                    ? game.trick.length
                      ? 'Your turn. Choose a card.'
                      : 'Your lead. Choose a card.'
                    : `Waiting for ${name(game.turn)}…`}
      </p>
      {game.phase === 'awaiting-cut' && cutter === snapshot.you.seat && (
        <section className="action-panel" aria-labelledby="cut-title">
          <h2 id="cut-title">Cut the deck.</h2>
          <p>Lift the top {cut} cards. Then the first four will be dealt.</p>
          <label htmlFor="cut-position">
            Cut position <output>{cut}</output>
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
            Cut &amp; deal
          </button>
        </section>
      )}
      {game.phase === 'awaiting-trump' &&
        game.selector === snapshot.you.seat && (
          <section className="action-panel" aria-labelledby="trump-title">
            <h2 id="trump-title">Choose trump.</h2>
            <p>Choose a suit from your first four cards.</p>
            <div className="trump-choices">
              {(Object.keys(suits) as (keyof typeof suits)[])
                .filter((suit) => game.hand.some((card) => card.suit === suit))
                .map((suit) => (
                  <button
                    key={suit}
                    className={`suit-choice ${suit === 'hearts' || suit === 'diamonds' ? 'red-suit' : ''}`}
                    aria-label={`Trump ${suit}`}
                    disabled={!enabled || pending}
                    onClick={() =>
                      client.act({ type: 'trump', payload: { suit } })
                    }
                  >
                    <strong aria-hidden="true">{suits[suit].symbol}</strong>
                    <span>{suits[suit].label}</span>
                    <small lang="si">{suits[suit].sinhala}</small>
                  </button>
                ))}
            </div>
          </section>
        )}
      {game.hand.length > 0 && (
        <section className="hand-panel" aria-label="Your hand">
          <div className="hand-heading">
            <h2>Your hand</h2>
            <span>
              {game.hand.length} cards
              {game.phase === 'playing' ? ' · Hold & drag, or select' : ''}
            </span>
          </div>
          <div className={`hand-grid hand-${game.hand.length}`}>
            {game.hand.map((card) => (
              <InteractiveCard
                key={cardKey(card)}
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
                  setSelected(selected === cardKey(card) ? null : cardKey(card))
                }
                onPlay={() => play(card)}
              />
            ))}
          </div>
          {game.phase === 'playing' && (
            <button
              className="button primary play-button"
              aria-label="Play selected card"
              disabled={!yours || !chosen || !enabled || pending}
              onClick={() => {
                if (chosen) {
                  void gameAudio.play('release');
                  play(chosen);
                }
              }}
            >
              {pending
                ? 'Playing…'
                : chosen
                  ? `Play ${chosen.rank} ${suits[chosen.suit].symbol}`
                  : yours
                    ? 'Select a card to play'
                    : 'Waiting for your turn'}
            </button>
          )}
        </section>
      )}
      {game.phase === 'complete' && (
        <section className="result-panel" aria-labelledby="result-title">
          <p className="eyebrow">BACK AROUND THE TABLE</p>
          <h2 id="result-title">Round complete.</h2>
          <p>
            {snapshot.result?.status === 'unresolved'
              ? 'This scoring combination needs rule confirmation. Your score is unchanged.'
              : snapshot.result?.outcome === 'seporu'
                ? 'සෙපෝරු · Four tricks each. One point carries forward.'
                : snapshot.result?.outcome === 'kapothi'
                  ? 'කපෝති · All eight tricks. Three points awarded.'
                  : `${snapshot.result?.tricks[snapshot.you.team] ?? 0} tricks for your team. The round score is settled.`}
          </p>
          <div className="result-scores">
            <span>
              Your team{' '}
              <strong>{snapshot.score.totals[snapshot.you.team]}</strong>
            </span>
            <span>
              Their team{' '}
              <strong>
                {snapshot.score.totals[snapshot.you.team === 0 ? 1 : 0]}
              </strong>
            </span>
          </div>
          {snapshot.hostId === snapshot.you.actorId && (
            <button
              className="button primary"
              onClick={() => client.act({ type: 'next-round', payload: {} })}
              disabled={
                !enabled ||
                pending ||
                snapshot.result?.status === 'unresolved' ||
                snapshot.capabilities?.nextRound === false ||
                snapshot.members.some((member) => !member.connected)
              }
            >
              Next round <span aria-hidden="true">→</span>
            </button>
          )}
          <p className="quiet-note">
            {snapshot.capabilities?.nextRound === false
              ? 'Next round is unavailable: the owner has not approved dealer rotation.'
              : snapshot.members.some((member) => !member.connected)
                ? 'All four players must reconnect before the next round.'
                : 'The host can start the next round when all four players are connected.'}
          </p>
        </section>
      )}
      {game.phase === 'cancelled' && (
        <section className="result-panel">
          <h2>Let’s deal again.</h2>
          <p>
            The no-trump report was confirmed. This round has been cancelled.
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
          <summary>Table history &amp; reports</summary>
          <p className="quiet-note">
            Reports are manual. No report timing rule has been confirmed yet.
          </p>
          {game.phase === 'playing' &&
            game.selector % 2 !== snapshot.you.team && (
              <button
                className="button secondary"
                disabled={!enabled || pending}
                onClick={() =>
                  client.act({ type: 'report-no-trump', payload: {} })
                }
              >
                Report no trump <span lang="si">අත පොලේ ගහන්න</span>
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
              <h3>Trick {index + 1}</h3>
              {trick.map((play, order) => (
                <div className="history-play" key={play.seat}>
                  <span>
                    {name(play.seat)}{' '}
                    <strong>
                      {play.card.rank} {suits[play.card.suit].symbol}
                    </strong>
                  </span>
                  {play.seat % 2 !== snapshot.you.team && (
                    <button
                      className="text-button"
                      aria-label={`Report ${cardName(play.card)} played by ${name(play.seat)}`}
                      disabled={!enabled || pending}
                      onClick={() =>
                        client.act({
                          type: 'accuse',
                          payload: { playId: index * 4 + order },
                        })
                      }
                    >
                      Report play
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

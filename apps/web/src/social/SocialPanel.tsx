import { useState } from 'react';
import { useStore } from 'zustand';
import { musicTracks, quickPhrases, reactions } from '@omi/shared';
import type { Member, MusicTrackId, ReportReason } from '@omi/shared';
import type { SocialClient } from './client';
export default function SocialPanel({
  client,
  members,
}: {
  client: SocialClient;
  members: readonly Member[];
}) {
  const state = useStore(client.store);
  const [draft, setDraft] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason>('abuse');
  const [note, setNote] = useState('');
  const [seek, setSeek] = useState<number | null>(null);
  const enabled = state.status === 'online';
  const prefs = state.preferences;
  const name = (id: string) =>
    id === client.actorId
      ? 'You'
      : (members.find((member) => member.actorId === id)?.displayName ??
        'Player');
  const host = state.hostId === client.actorId;
  const music = state.music;
  const duration =
    musicTracks.find((track) => track.id === music?.trackId)?.duration ?? 32;
  return (
    <section
      className={`social-panel ${state.tapped ? 'tapped' : ''}`}
      aria-label="Room social"
    >
      <details>
        <summary>
          Friends, chat & music{' '}
          <span className="social-connection">
            {enabled ? 'Connected' : 'Offline'}
          </span>
        </summary>
        {!enabled && (
          <button className="text-button" onClick={client.reconnect}>
            Reconnect social
          </button>
        )}
        {state.error && <p role="alert">{state.error}</p>}
        {state.notice && <p role="status">{state.notice}</p>}
        <section aria-label="Table chat">
          <h3>Table chat</h3>
          <ol
            className="chat-history"
            aria-label="Recent room messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {state.history
              .filter((entry) => !prefs.blocked.includes(entry.actorId))
              .map((entry) => (
                <li key={entry.id} data-chat-id={entry.id}>
                  <strong>{name(entry.actorId)}</strong>
                  <p dir="auto">
                    {entry.adult && !prefs.adult
                      ? '[Adult-language message hidden]'
                      : entry.text}
                  </p>
                  {entry.actorId !== client.actorId && (
                    <button
                      className="text-button report-message"
                      aria-label={`Report message from ${name(entry.actorId)}`}
                      onClick={() => {
                        setReportId(entry.id);
                        setNote('');
                      }}
                    >
                      Report
                    </button>
                  )}
                </li>
              ))}
            {!state.history.length && (
              <li>
                No messages yet. Sinhala, English, Singlish and emojis welcome.
              </li>
            )}
          </ol>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                client.send({ type: 'chat', payload: { text: draft.trim() } })
              )
                setDraft('');
            }}
          >
            <label htmlFor="social-message">Message to the table</label>
            <textarea
              id="social-message"
              maxLength={400}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!enabled}
            />
            <button
              className="secondary-button"
              disabled={!enabled || !draft.trim() || state.pending}
            >
              Send message
            </button>
          </form>
          <div className="social-buttons" aria-label="Quick phrases">
            {quickPhrases.map((phrase) => (
              <button
                className="text-button"
                key={phrase.id}
                disabled={!enabled}
                onClick={() =>
                  client.send({ type: 'quick', payload: { id: phrase.id } })
                }
              >
                {phrase.text}
              </button>
            ))}
          </div>
        </section>
        <section aria-label="Table reactions">
          <h3>Reactions</h3>
          <div className="social-buttons">
            {reactions
              .filter((reaction) => !reaction.adult || prefs.adult)
              .map((reaction) => (
                <button
                  className="secondary-button"
                  key={reaction.id}
                  disabled={!enabled}
                  onClick={() =>
                    client.send({
                      type: 'reaction',
                      payload: { id: reaction.id },
                    })
                  }
                >
                  {reaction.id === 'tap' ? 'Tap the table' : reaction.text}
                </button>
              ))}
          </div>
          <div className="reaction-feed" aria-live="polite">
            {state.recent
              .filter(
                (entry) =>
                  !prefs.blocked.includes(entry.actorId) &&
                  !prefs.muteReactions &&
                  (prefs.adult ||
                    !reactions.find(
                      (reaction) => reaction.id === entry.reactionId,
                    )?.adult),
              )
              .map((entry) => (
                <span key={entry.id}>
                  {name(entry.actorId)} ·{' '}
                  {
                    reactions.find(
                      (reaction) => reaction.id === entry.reactionId,
                    )?.text
                  }
                </span>
              ))}
          </div>
          <button
            className="text-button"
            disabled={!enabled}
            onClick={() =>
              state.effectsEnabled
                ? client.disableEffects()
                : void client.enableEffects()
            }
          >
            {state.effectsEnabled
              ? 'Disable reaction sounds'
              : 'Enable reaction sounds'}
          </button>
          <label>
            Reaction sound volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs.effectsVolume}
              onChange={(event) =>
                client.preference({ effectsVolume: Number(event.target.value) })
              }
            />
          </label>
        </section>
        <section aria-label="Shared music">
          <h3>Shared music</h3>
          <p>
            {musicTracks.find((track) => track.id === music?.trackId)?.title ??
              'Loading music state…'}{' '}
            · {music?.playing ? 'Playing' : 'Paused'}
          </p>
          <button
            className="secondary-button"
            disabled={!enabled || !music}
            onClick={() =>
              state.musicEnabled
                ? client.disableMusic()
                : void client.enableMusic()
            }
          >
            {state.musicEnabled
              ? 'Disable music locally'
              : 'Enable music locally'}
          </button>
          <label>
            Music volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs.musicVolume}
              onChange={(event) =>
                client.preference({ musicVolume: Number(event.target.value) })
              }
            />
          </label>
          {host && music ? (
            <div className="music-host-controls">
              <label>
                Shared track
                <select
                  value={music.trackId}
                  disabled={!enabled || state.pending}
                  onChange={(event) =>
                    client.send({
                      type: 'music',
                      payload: {
                        command: 'track',
                        trackId: event.target.value as MusicTrackId,
                        musicVersion: music.version,
                      },
                    })
                  }
                >
                  {musicTracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="text-button"
                disabled={!enabled || state.pending}
                onClick={() =>
                  client.send({
                    type: 'music',
                    payload: {
                      command: music.playing ? 'pause' : 'play',
                      musicVersion: music.version,
                    },
                  })
                }
              >
                {music.playing ? 'Pause shared music' : 'Play shared music'}
              </button>
              <label>
                Shared playback position
                <input
                  type="range"
                  min="0"
                  max={Math.floor(duration)}
                  step="1"
                  value={seek ?? state.position}
                  onChange={(event) => setSeek(Number(event.target.value))}
                />
              </label>
              <button
                className="text-button"
                disabled={!enabled || state.pending || seek === null}
                onClick={() => {
                  client.send({
                    type: 'music',
                    payload: {
                      command: 'seek',
                      position: seek!,
                      musicVersion: music.version,
                    },
                  });
                  setSeek(null);
                }}
              >
                Set shared position
              </button>
            </div>
          ) : (
            <p className="social-note">
              The table host controls track, play, pause and seek. Your volume
              is local.
            </p>
          )}
          <p className="social-note">
            Original OMI audio · CC0. Music downloads only after you enable it.
          </p>
        </section>
        <details className="social-settings">
          <summary>Social preferences & blocking</summary>
          <label>
            <input
              type="checkbox"
              checked={prefs.adult}
              onChange={(event) =>
                client.preference({ adult: event.target.checked })
              }
            />
            Allow adult-language content (off by default)
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.muteReactions}
              onChange={(event) =>
                client.preference({ muteReactions: event.target.checked })
              }
            />
            Mute and hide all reactions
          </label>
          <p className="social-note">
            Adult filtering covers curated reactions and a small word list. It
            is not complete moderation.
          </p>
          {members
            .filter((member) => member.actorId !== client.actorId)
            .map((member) => (
              <label key={member.actorId}>
                <input
                  type="checkbox"
                  checked={prefs.blocked.includes(member.actorId)}
                  onChange={(event) =>
                    client.block(member.actorId, event.target.checked)
                  }
                />
                Block incoming chat, reactions and voice from{' '}
                {member.displayName}
              </label>
            ))}
          <p className="social-note">
            Blocks apply in this table on this device. They do not remove
            players or hide game moves.
          </p>
        </details>
        {state.audioError && (
          <div role="alert">
            <p>{state.audioError}</p>
            <button
              className="text-button"
              onClick={() => void client.audio.retry()}
            >
              Retry audio
            </button>
          </div>
        )}
        {reportId && (
          <form
            className="report-form"
            aria-label="Report room message"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                client.send({
                  type: 'report',
                  payload: { messageId: reportId, reason, note: note.trim() },
                })
              )
                setReportId(null);
            }}
          >
            <h3>Report message</h3>
            <label>
              Report reason
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as ReportReason)
                }
              >
                <option value="abuse">Abusive language</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Report details (optional)
              <textarea
                maxLength={280}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <p className="social-note">
              The selected message and your report are stored privately for
              owner review. No automatic game penalty.
            </p>
            <button
              className="secondary-button"
              disabled={!enabled || state.pending}
            >
              Submit report
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setReportId(null)}
            >
              Cancel report
            </button>
          </form>
        )}
      </details>
    </section>
  );
}

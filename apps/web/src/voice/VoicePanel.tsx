import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { Member } from '@omi/shared';
import { VoiceClient } from './client';
const noBlocked: readonly string[] = [];
export default function VoicePanel({
  roomId,
  actorId,
  members,
  online,
  blockedActorIds = noBlocked,
}: {
  roomId: string;
  actorId: string;
  members: readonly Member[];
  online: boolean;
  blockedActorIds?: readonly string[];
}) {
  const [client] = useState(() => new VoiceClient(roomId, actorId));
  const state = useStore(client.store);
  useEffect(() => () => client.leave(), [client]);
  useEffect(() => {
    client.setOnline(online);
  }, [client, online]);
  useEffect(() => {
    client.setBlocked(blockedActorIds);
  }, [client, blockedActorIds]);
  const active = ['joining', 'connected', 'reconnecting'].includes(
    state.status,
  );
  return (
    <section className="voice-panel" aria-label="Room voice">
      <div className="voice-heading">
        <strong>At the table · Voice</strong>
        <span role="status">
          {state.status === 'off'
            ? 'Microphone off'
            : state.status === 'joining'
              ? 'Connecting voice…'
              : state.status === 'reconnecting'
                ? 'Reconnecting voice…'
                : state.status === 'connected'
                  ? 'Voice connected'
                  : 'Voice unavailable'}
        </span>
      </div>
      <div className="voice-controls">
        {!active ? (
          <button
            className="secondary-button"
            disabled={!online}
            onClick={() => void client.join()}
          >
            Join voice
          </button>
        ) : (
          <>
            <button
              className="secondary-button"
              aria-pressed={state.muted}
              disabled={state.status !== 'connected'}
              onClick={() => client.setMuted(!state.muted)}
            >
              {state.muted ? 'Unmute microphone' : 'Mute microphone'}
            </button>
            <button className="text-button" onClick={client.leave}>
              Leave voice
            </button>
          </>
        )}
        {state.playbackBlocked && (
          <button
            className="secondary-button"
            onClick={() => void client.resumePlayback()}
          >
            Enable voice playback
          </button>
        )}
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {active && (
        <ul className="voice-people">
          <li>
            <span
              className={`voice-indicator ${state.speaking ? 'speaking' : ''}`}
              aria-hidden="true"
            />
            <span>
              You ·{' '}
              {state.muted
                ? 'Muted'
                : state.speaking
                  ? 'Speaking'
                  : 'Listening'}
            </span>
          </li>
          {state.peers.map((peer) => {
            const name =
              members.find((member) => member.actorId === peer.actorId)
                ?.displayName ?? 'Player';
            return (
              <li
                key={peer.actorId}
                data-voice-peer={peer.actorId}
                data-connection={peer.connection}
              >
                <span
                  className={`voice-indicator ${peer.speaking ? 'speaking' : ''}`}
                  aria-hidden="true"
                />
                <span>
                  {name} ·{' '}
                  {blockedActorIds.includes(peer.actorId)
                    ? 'Blocked'
                    : peer.muted
                      ? 'Muted'
                      : peer.speaking
                        ? 'Speaking'
                        : peer.connection === 'connected'
                          ? 'Listening'
                          : 'Connecting'}
                </span>
                <label className="voice-volume">
                  Volume for {name}
                  <input
                    disabled={blockedActorIds.includes(peer.actorId)}
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={peer.volume}
                    onChange={(event) =>
                      client.setVolume(peer.actorId, Number(event.target.value))
                    }
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="voice-note">
        Opt-in microphone. Audio is not recorded.
        {active && !state.relayAvailable
          ? ' Direct connections only; some networks need TURN.'
          : ''}
      </p>
    </section>
  );
}

import { useMediaCopy } from '../i18n/mediaCopy';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { Member } from '@omi/shared';
import { VoiceClient } from './client';
import { useSoundPreferences } from '../audio/preferences';
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
  const media = useMediaCopy();
  const state = useStore(client.store);
  const [pushToTalk, setPushToTalk] = useState(false);
  const talking = useRef(false);
  const volume = useSoundPreferences((state) => state.voice);
  useEffect(() => {
    client.setMasterVolume(volume);
  }, [client, volume]);
  useEffect(() => () => client.leave(), [client]);
  useEffect(() => {
    client.setOnline(online);
  }, [client, online]);
  useEffect(() => {
    client.setBlocked(blockedActorIds);
  }, [client, blockedActorIds]);
  useEffect(() => {
    if (!pushToTalk) return;
    function release() {
      talking.current = false;
      client.setMuted(true);
    }
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
      if (talking.current) release();
    };
  }, [client, pushToTalk]);
  useEffect(() => {
    if (pushToTalk && state.status !== 'connected' && talking.current) {
      talking.current = false;
      client.setMuted(true);
    }
  }, [client, pushToTalk, state.status]);
  function talk(pressed: boolean) {
    if (pressed && state.status !== 'connected') return;
    if (talking.current === pressed) return;
    talking.current = pressed;
    client.setMuted(!pressed);
  }
  const active = ['joining', 'connected', 'reconnecting'].includes(
    state.status,
  );
  return (
    <section className="voice-panel" aria-label={media('Room voice')}>
      <div className="voice-heading">
        <strong>{media('At the table · Voice')}</strong>
        <span role="status">
          {state.status === 'off'
            ? media('Microphone off')
            : state.status === 'joining'
              ? media('Connecting voice…')
              : state.status === 'reconnecting'
                ? media('Reconnecting voice…')
                : state.status === 'connected'
                  ? media('Voice connected')
                  : media('Voice unavailable')}
        </span>
      </div>
      <div className="voice-controls">
        {!active ? (
          <button
            className="secondary-button"
            disabled={!online}
            onClick={() => void client.join()}
          >
            {media('Join voice')}
          </button>
        ) : (
          <>
            {pushToTalk ? (
              <button
                className="secondary-button"
                aria-pressed={!state.muted}
                disabled={state.status !== 'connected'}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  talk(true);
                }}
                onPointerUp={() => talk(false)}
                onPointerCancel={() => talk(false)}
                onLostPointerCapture={() => talk(false)}
                onBlur={() => talk(false)}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    talk(true);
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    talk(false);
                  }
                }}
              >
                {media('Hold to talk')}
              </button>
            ) : (
              <button
                className="secondary-button"
                aria-pressed={state.muted}
                disabled={state.status !== 'connected'}
                onClick={() => client.setMuted(!state.muted)}
              >
                {state.muted
                  ? media('Unmute microphone')
                  : media('Mute microphone')}
              </button>
            )}
            <label className="voice-push-to-talk">
              <input
                type="checkbox"
                checked={pushToTalk}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  talking.current = false;
                  client.setMuted(true);
                  setPushToTalk(enabled);
                }}
              />
              {media('Push to talk')}
            </label>
            <button
              className="text-button"
              onClick={() => {
                talk(false);
                client.leave();
              }}
            >
              {media('Leave voice')}
            </button>
          </>
        )}
        {state.playbackBlocked && (
          <button
            className="secondary-button"
            onClick={() => void client.resumePlayback()}
          >
            {media('Enable voice playback')}
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
                ? media('Muted')
                : state.speaking
                  ? media('Speaking')
                  : media('Listening')}
            </span>
          </li>
          {state.peers.map((peer) => {
            const name =
              members.find((member) => member.actorId === peer.actorId)
                ?.displayName ?? media('Player');
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
                    ? media('Blocked')
                    : peer.muted
                      ? media('Muted')
                      : peer.speaking
                        ? media('Speaking')
                        : peer.connection === 'connected'
                          ? media('Listening')
                          : media('Connecting')}
                </span>
                <label className="voice-volume">
                  {media('Volume for')} {name}
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
        {media('Opt-in microphone. Audio is not recorded.')}
        {active && !state.relayAvailable
          ? ' ' + media('Direct connections only; some networks need TURN.')
          : ''}
      </p>
    </section>
  );
}

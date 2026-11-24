import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useMediaCopy } from '../i18n/mediaCopy';
import { VoiceClient } from '../voice/client';
import { canSelectLocalMusic, fitsLocalMusicBudget } from './localMusicFile';

type Capture = {
  buffer: AudioBuffer | null;
  title: string;
  source: AudioBufferSourceNode | null;
  startedAt: number;
  offset: number;
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  monitor: GainNode;
};

export default function LocalMusic({
  roomId,
  actorId,
  hostId,
  online,
  blocked,
}: {
  roomId: string;
  actorId: string;
  hostId: string;
  online: boolean;
  blocked: boolean;
}) {
  const media = useMediaCopy();
  const capture = useRef<Capture | null>(null);
  const [client] = useState(
    () =>
      new VoiceClient(roomId, actorId, {
        hostId,
        capture: () => capture.current?.destination.stream ?? null,
        track: () => {
          const current = capture.current;
          return current?.buffer
            ? {
                title: current.title,
                seconds: Math.ceil(current.buffer.duration),
              }
            : undefined;
        },
      }),
  );
  const voice = useStore(client.store);
  const publisher = actorId === hostId;
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<'invalid' | 'unavailable' | null>(null);

  const release = useCallback(() => {
    client.leave();
    const current = capture.current;
    capture.current = null;
    if (!current) return;
    if (current.source) {
      current.source.onended = null;
      current.source.stop();
      current.source.disconnect();
    }
    current.destination.stream.getTracks().forEach((track) => track.stop());
    void current.context.close().catch(() => undefined);
  }, [client]);
  useEffect(() => release, [release]);
  useEffect(() => {
    client.setOnline(online && !blocked);
  }, [blocked, client, online]);
  useEffect(() => {
    const gain = blocked || muted ? 0 : volume;
    if (capture.current) capture.current.monitor.gain.value = gain;
    client.setMasterVolume(gain);
  }, [blocked, client, muted, volume]);
  async function start() {
    if (!publisher || !file || !consent || capture.current || !online) return;
    setError(null);
    let pending: Capture | undefined;
    let audioContext: AudioContext | undefined;
    try {
      const context = new AudioContext();
      audioContext = context;
      const destination = context.createMediaStreamDestination();
      const monitor = context.createGain();
      monitor.gain.value = muted ? 0 : volume;
      monitor.connect(context.destination);
      const current: Capture = {
        context,
        destination,
        monitor,
        buffer: null,
        title:
          file.name.replace(/\p{C}/gu, '').slice(0, 120).trim() ||
          media('Local table music'),
        source: null,
        startedAt: 0,
        offset: 0,
      };
      pending = current;
      capture.current = current;
      setSharing(true);
      const [, buffer] = await Promise.all([
        context.resume(),
        file.arrayBuffer().then((bytes) => context.decodeAudioData(bytes)),
      ]);
      if (capture.current !== current) return;
      // Bound decoded memory as well as the source file size.
      if (!fitsLocalMusicBudget(buffer))
        throw new Error('Unsupported audio length');
      current.buffer = buffer;
      setDuration(buffer.duration);
      await client.join();
    } catch {
      if (pending && capture.current !== pending) return;
      if (pending) release();
      else if (audioContext) void audioContext.close().catch(() => undefined);
      setSharing(false);
      setError('unavailable');
    }
  }
  function stopPlayback(current: Capture) {
    const source = current.source;
    if (!source) return;
    current.offset = Math.max(
      0,
      current.context.currentTime - current.startedAt,
    );
    current.source = null;
    source.onended = null;
    source.stop();
    source.disconnect();
  }
  function playFrom(current: Capture, offset: number) {
    const buffer = current.buffer;
    if (!buffer) return;
    const bounded = offset >= buffer.duration ? 0 : offset;
    const source = current.context.createBufferSource();
    source.buffer = buffer;
    source.connect(current.destination);
    source.connect(current.monitor);
    current.startedAt = current.context.currentTime - bounded;
    current.source = source;
    source.onended = () => {
      if (current.source !== source) return;
      source.disconnect();
      current.source = null;
      current.offset = 0;
      setPlaying(false);
      setPosition(buffer.duration);
    };
    source.start(0, bounded);
    setPlaying(true);
  }
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = capture.current;
      if (current?.source)
        setPosition(
          Math.max(0, current.context.currentTime - current.startedAt),
        );
    }, 200);
    return () => clearInterval(timer);
  }, [playing]);
  const remoteTrack = voice.peers.find(
    (peer) => peer.actorId === hostId,
  )?.track;
  const active =
    voice.status === 'connected' ||
    voice.status === 'joining' ||
    voice.status === 'reconnecting';
  return (
    <section
      className="local-file-music"
      aria-label={media('Local table music')}
    >
      <details>
        <summary>{media('Local table music')}</summary>
        <p>{media('The table host can share music from their device.')}</p>
        {publisher ? (
          <>
            <label>
              {media('Choose a music file')}
              <input
                type="file"
                accept=".mp3,.aac,.m4a,.wav"
                disabled={sharing}
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  const valid = selected && canSelectLocalMusic(selected);
                  setFile(valid ? selected : null);
                  setConsent(false);
                  setError(selected && !valid ? 'invalid' : null);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={consent}
                disabled={sharing}
                onChange={(event) => setConsent(event.target.checked)}
              />
              {media('I have permission to share this audio.')}
            </label>
            {file && <p>{file.name}</p>}
            {!sharing ? (
              <button
                disabled={!online || !file || !consent}
                onClick={() => void start()}
              >
                {media('Start sharing file')}
              </button>
            ) : (
              <>
                <button
                  disabled={voice.status !== 'connected' || !duration}
                  onClick={() => {
                    const current = capture.current;
                    if (!current) return;
                    if (current.source) {
                      stopPlayback(current);
                      setPosition(current.offset);
                      setPlaying(false);
                    } else {
                      void current.context
                        .resume()
                        .catch(() => setError('unavailable'));
                      playFrom(current, current.offset);
                    }
                  }}
                >
                  {media(playing ? 'Pause file' : 'Play file')}
                </button>
                <button
                  onClick={() => {
                    release();
                    setSharing(false);
                    setPlaying(false);
                    setPosition(0);
                    setDuration(0);
                  }}
                >
                  {media('Stop file sharing')}
                </button>
                <label>
                  {media('File playback position')}
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.1"
                    value={position}
                    disabled={!duration}
                    onChange={(event) => {
                      const current = capture.current;
                      if (!current) return;
                      const offset = Number(event.target.value);
                      const wasPlaying = !!current.source;
                      stopPlayback(current);
                      current.offset = offset;
                      setPosition(offset);
                      if (wasPlaying) playFrom(current, offset);
                    }}
                  />
                </label>
                <p>
                  {Math.floor(position)} / {Math.floor(duration)} s
                </p>
              </>
            )}
          </>
        ) : active ? (
          <button onClick={client.leave}>{media('Leave file audio')}</button>
        ) : (
          <button
            disabled={!online || blocked}
            onClick={() => void client.join()}
          >
            {media('Listen to shared file')}
          </button>
        )}
        {!publisher && remoteTrack && (
          <p>
            {remoteTrack.title} · {remoteTrack.seconds} s
          </p>
        )}
        {voice.playbackBlocked && !blocked && (
          <button onClick={() => void client.resumePlayback()}>
            {media('Enable file audio playback')}
          </button>
        )}
        <label>
          {media('File music volume')}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={muted}
            onChange={(event) => setMuted(event.target.checked)}
          />
          {media('Mute file music')}
        </label>
        <p role="status">
          {media(
            !active
              ? 'File audio off'
              : publisher
                ? 'File sharing connected'
                : voice.peers.some((peer) => peer.connection === 'connected')
                  ? 'File audio connected'
                  : 'Waiting for the host to share',
          )}
        </p>
        {(error || voice.error) && (
          <p role="alert">
            {media(
              error === 'invalid'
                ? 'Choose an MP3, AAC, M4A or WAV file up to 25 MiB.'
                : 'File audio could not connect or play.',
            )}
          </p>
        )}
      </details>
    </section>
  );
}

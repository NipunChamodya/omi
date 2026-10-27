// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { VoiceClient } from './client';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(getUserMedia: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('RTCPeerConnection', class {});
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [],
        iceTransportPolicy: 'all',
        expiresAt: Date.now() + 1000,
        relayAvailable: false,
      }),
    }),
  );
}
it('does not request microphone permission before explicit join and handles denial safely', async () => {
  const mic = vi
    .fn()
    .mockRejectedValue(
      new DOMException('private hardware details', 'NotAllowedError'),
    );
  setup(mic);
  const client = new VoiceClient('room', 'actor');
  expect(mic).not.toHaveBeenCalled();
  await client.join();
  expect(client.store.getState().status).toBe('error');
  expect(client.store.getState().error).toContain('permission was denied');
  expect(client.store.getState().error).not.toContain('private hardware');
  client.leave();
});
it('stops a microphone granted after leaving and never opens a socket for that stale join', async () => {
  let grant!: (value: MediaStream) => void;
  const mic = vi.fn().mockImplementation(
    () =>
      new Promise<MediaStream>((done) => {
        grant = done;
      }),
  );
  setup(mic);
  const client = new VoiceClient('room', 'actor');
  const joining = client.join();
  await vi.waitFor(() => expect(mic).toHaveBeenCalled());
  client.leave();
  const stop = vi.fn();
  grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await joining;
  expect(stop).toHaveBeenCalledOnce();
  expect(client.store.getState().status).toBe('off');
});
it('refuses microphone capture outside a secure context', async () => {
  const mic = vi.fn();
  setup(mic);
  vi.stubGlobal('isSecureContext', false);
  const client = new VoiceClient('room', 'actor');
  await client.join();
  expect(mic).not.toHaveBeenCalled();
  expect(client.store.getState().error).toContain('HTTPS');
  client.leave();
});
it('keeps voice master volume separate, composes peer volume and preserves blocks', () => {
  const client = new VoiceClient('room', 'actor');
  const audio = { volume: 1 };
  const gain = { gain: { value: 1 } };
  const links = (client as unknown as { links: Map<string, unknown> }).links;
  links.set('friend', {
    peer: { actorId: 'friend', callId: 'call', muted: false },
    pc: { connectionState: 'connected' },
    audio,
    gain,
  });
  client.setMasterVolume(0.4);
  client.setVolume('friend', 0.5);
  expect(audio.volume).toBe(0.2);
  expect(gain.gain.value).toBe(0.2);
  expect(client.store.getState().peers[0]!.volume).toBe(0.5);
  client.setBlocked(['friend']);
  client.setMasterVolume(0.7);
  expect(gain.gain.value).toBe(0);
  client.setBlocked([]);
  expect(gain.gain.value).toBe(0.35);
  client.setMasterVolume(NaN);
  expect(gain.gain.value).toBe(0.35);
  links.clear();
  client.leave();
});

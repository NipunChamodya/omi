// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameAudio } from './gameAudio';
import {
  readSoundPreferences,
  soundDefaults,
  useSoundPreferences,
} from './preferences';
const makeSource = () => ({
  buffer: null,
  playbackRate: { value: 1 },
  loop: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null,
});
const makeGain = () => ({
  gain: { value: 0 },
  connect: vi.fn(),
  disconnect: vi.fn(),
});

class Context {
  static instances: Context[] = [];
  state = 'suspended';
  destination = {};
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  decodeAudioData = vi.fn(async () => ({}));
  sources: ReturnType<typeof makeSource>[] = [];
  gains: ReturnType<typeof makeGain>[] = [];
  constructor() {
    Context.instances.push(this);
  }
  createBufferSource() {
    const source = makeSource();
    this.sources.push(source);
    return source;
  }
  createGain() {
    const gain = makeGain();
    this.gains.push(gain);
    return gain;
  }
}
let audio: GameAudio;
beforeEach(() => {
  Context.instances = [];
  localStorage.clear();
  useSoundPreferences.setState(soundDefaults);
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    })),
  );
  audio = new GameAudio();
});
afterEach(() => {
  audio.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('never initializes before a gesture, caches decoded assets and suppresses duplicate event IDs', async () => {
  await audio.play('land', 'old');
  expect(Context.instances).toHaveLength(0);
  await audio.unlock();
  await audio.play('land', 'old');
  expect(fetch).not.toHaveBeenCalled();
  await audio.play('land', 'room:12');
  await audio.play('land', 'room:12');
  await audio.play('strong', 'room:13');
  const context = Context.instances[0]!;
  expect(Context.instances).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  expect(context.sources).toHaveLength(2);
});
it('applies enabled, category and live volume controls while leaving voice independent', async () => {
  useSoundPreferences.setState({ enabled: false });
  await audio.unlock();
  expect(Context.instances).toHaveLength(0);
  useSoundPreferences.setState({ enabled: true, cards: false });
  await audio.unlock();
  await audio.play('land');
  expect(fetch).not.toHaveBeenCalled();
  useSoundPreferences.setState({ cards: true });
  await audio.play('strong');
  const context = Context.instances[0]!;
  useSoundPreferences.setState({ volume: 0.1 });
  expect(context.gains[0]!.gain.value).toBe(0.1);
  useSoundPreferences.setState({ enabled: false });
  expect(context.sources[0]!.stop).toHaveBeenCalled();
  expect(useSoundPreferences.getState().voice).toBe(0.8);
});
it('handles blocked/suspended contexts, missing assets and retries on a later gesture', async () => {
  const blocked = vi.spyOn(Context.prototype, 'createGain');
  await audio.unlock();
  const context = Context.instances[0]!;
  context.state = 'suspended';
  context.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
  await audio.unlock();
  await audio.play('select');
  expect(blocked).not.toHaveBeenCalled();
  await audio.unlock();
  vi.mocked(fetch).mockRejectedValueOnce(new Error('missing asset'));
  await audio.play('land');
  expect(context.sources).toHaveLength(0);
  await audio.play('strong');
  expect(context.sources).toHaveLength(1);
});
it('stops hidden-tab playback and cleans up context, nodes and pending fetches', async () => {
  await audio.unlock();
  await audio.play('select');
  const context = Context.instances[0]!;
  audio.setVisible(false);
  expect(context.sources[0]!.stop).toHaveBeenCalled();
  await audio.play('land');
  expect(context.sources).toHaveLength(1);
  audio.dispose();
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.sources[0]!.disconnect).toHaveBeenCalled();
});
it('does not start a decoded sound after cleanup and never enables ambience by default', async () => {
  let finish!: (value: ArrayBuffer) => void;
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    arrayBuffer: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  } as Response);
  await audio.unlock();
  const pending = audio.play('land');
  await Promise.resolve();
  await Promise.resolve();
  audio.dispose();
  finish(new ArrayBuffer(4));
  await pending;
  expect(Context.instances[0]!.sources).toHaveLength(0);
  expect(soundDefaults.ambience).toBe(false);
});
it('bounds persisted preferences and tolerates malformed or unavailable storage', () => {
  localStorage.setItem(
    'omi.sound.v1',
    JSON.stringify({ volume: 99, voice: -1, enabled: 'false', motionMs: 9000 }),
  );
  expect(readSoundPreferences()).toMatchObject({
    volume: 1,
    voice: 0,
    enabled: true,
    motionMs: 1600,
  });
  localStorage.setItem('omi.sound.v1', '{');
  expect(readSoundPreferences()).toEqual(soundDefaults);
});
it('starts optional ambience only after a gesture and stops it independently', async () => {
  useSoundPreferences.setState({ ambience: true });
  expect(Context.instances).toHaveLength(0);
  await audio.unlock();
  const context = Context.instances[0]!;
  await vi.waitFor(() => expect(context.sources).toHaveLength(1));
  expect(context.sources[0]!.loop).toBe(true);
  useSoundPreferences.setState({ ambience: false });
  expect(context.sources[0]!.stop).toHaveBeenCalled();
  expect(useSoundPreferences.getState().cards).toBe(true);
});
it('does not cancel an in-flight cue when a subsequent gesture resumes the same context', async () => {
  await audio.unlock();
  let finish!: (value: ArrayBuffer) => void;
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    arrayBuffer: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  } as Response);
  const playing = audio.play('land');
  await Promise.resolve();
  await Promise.resolve();
  await audio.unlock();
  finish(new ArrayBuffer(4));
  await playing;
  expect(Context.instances[0]!.sources).toHaveLength(1);
});

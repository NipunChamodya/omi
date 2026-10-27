import { useSoundPreferences } from './preferences';
import paper from './assets/paper.mp3?url&no-inline';
import slide from './assets/slide.mp3?url&no-inline';
import land from './assets/land.mp3?url&no-inline';
import flick from './assets/flick.mp3?url&no-inline';
import shuffle from './assets/shuffle.mp3?url&no-inline';
import gather from './assets/gather.mp3?url&no-inline';
import tone from './assets/tone.mp3?url&no-inline';
import result from './assets/result.mp3?url&no-inline';

const cues = {
  select: [paper, 'cards', 0.45, 1],
  drag: [paper, 'cards', 0.2, 0.85],
  release: [slide, 'cards', 0.5, 1],
  land: [land, 'cards', 0.8, 1],
  strong: [land, 'cards', 1, 0.9],
  reject: [tone, 'ui', 0.4, 0.65],
  deal: [flick, 'cards', 0.5, 1],
  shuffle: [shuffle, 'cards', 0.65, 1],
  gather: [gather, 'cards', 0.6, 1],
  split: [slide, 'cards', 0.4, 0.8],
  tap: [land, 'cards', 0.45, 0.7],
  trump: [tone, 'ui', 0.55, 1.2],
  joined: [tone, 'ui', 0.4, 1.4],
  disconnected: [tone, 'ui', 0.35, 0.8],
  turn: [tone, 'ui', 0.5, 1.1],
  round: [result, 'celebrations', 0.5, 1],
  win: [result, 'celebrations', 0.65, 1.25],
  lose: [result, 'celebrations', 0.4, 0.8],
  button: [paper, 'ui', 0.2, 1.5],
  ambience: [paper, 'ambience', 0.025, 0.25],
} as const;
export type SoundCue = keyof typeof cues;
type Playing = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  category: string;
  level: number;
};

/** One reusable context, lazy decoded buffers, no audio before a trusted gesture. */
export class GameAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private playing = new Set<Playing>();
  private seen = new Set<string>();
  private last = new Map<SoundCue, number>();
  private generation = 0;
  private unlocked = false;
  private controller = new AbortController();
  private unsubscribe: (() => void) | null = null;
  private visible = true;

  async unlock() {
    if (!useSoundPreferences.getState().enabled) return;
    try {
      const Constructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Constructor) return;
      if (this.controller.signal.aborted)
        this.controller = new AbortController();
      this.context ??= new Constructor();
      this.unsubscribe ??= useSoundPreferences.subscribe(() => {
        this.generation++;
        this.refresh();
      });
      await this.context.resume();
      this.unlocked = this.context?.state === 'running';
      this.refresh();
    } catch {
      this.unlocked = false; /* Next gesture can retry autoplay permission. */
    }
  }
  private buffer(url: string, context: AudioContext) {
    let pending = this.buffers.get(url);
    if (!pending) {
      pending = fetch(url, { signal: this.controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Audio unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .catch(() => {
          if (this.buffers.get(url) === pending) this.buffers.delete(url);
          return null;
        });
      this.buffers.set(url, pending);
    }
    return pending;
  }
  private allowed(category: string) {
    const prefs = useSoundPreferences.getState();
    return (
      this.visible &&
      prefs.enabled &&
      prefs.volume > 0 &&
      prefs[category as 'cards' | 'ui' | 'celebrations' | 'ambience']
    );
  }
  async play(cue: SoundCue, id?: string) {
    // Mark IDs even while muted/locked: enabling sound never replays old events.
    if (id) {
      if (this.seen.has(id)) return;
      this.seen.add(id);
      if (this.seen.size > 256)
        this.seen.delete(this.seen.values().next().value!);
    }
    const [url, category, level, rate] = cues[cue];
    const context = this.context;
    if (
      !this.unlocked ||
      !context ||
      context.state !== 'running' ||
      !this.allowed(category)
    )
      return;
    const now = performance.now();
    if (now - (this.last.get(cue) ?? -Infinity) < (cue === 'deal' ? 75 : 110))
      return;
    this.last.set(cue, now);
    const generation = this.generation;
    const requestedAt = performance.now();
    const buffer = await this.buffer(url, context);
    if (
      !buffer ||
      context !== this.context ||
      generation !== this.generation ||
      performance.now() - requestedAt > 700 ||
      context.state !== 'running' ||
      !this.allowed(category) ||
      this.playing.size >= 8
    )
      return;
    if (
      cue === 'ambience' &&
      [...this.playing].some((entry) => entry.source.loop)
    )
      return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = cue === 'ambience';
    gain.gain.value = level * useSoundPreferences.getState().volume;
    source.connect(gain);
    gain.connect(context.destination);
    const entry = { source, gain, category, level };
    this.playing.add(entry);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.playing.delete(entry);
    };
    source.start();
  }
  private refresh() {
    // Stop immediately on mute/category changes and apply live volume without new contexts.
    for (const entry of this.playing) {
      if (!this.allowed(entry.category)) {
        entry.source.stop();
        this.playing.delete(entry);
      } else {
        entry.gain.gain.value =
          entry.level * useSoundPreferences.getState().volume;
      }
    }
    if (
      this.allowed('ambience') &&
      this.unlocked &&
      ![...this.playing].some((entry) => entry.source.loop)
    )
      void this.play('ambience');
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.silence();
    else this.refresh();
  }
  silence() {
    this.generation++;
    for (const entry of this.playing) {
      entry.source.stop();
      entry.source.disconnect();
      entry.gain.disconnect();
    }
    this.playing.clear();
  }
  dispose() {
    this.silence();
    this.controller.abort();
    this.unsubscribe?.();
    this.unsubscribe = null;
    const context = this.context;
    this.context = null;
    this.unlocked = false;
    this.buffers.clear();
    this.seen.clear();
    this.last.clear();
    if (context) void context.close().catch(() => undefined);
  }
}
export const gameAudio = new GameAudio();

import { musicPosition, reactions } from '@omi/shared';
import type { MusicState, ReactionEntry } from '@omi/shared';
import emerald from './assets/emerald-v1.mp3?url';
import coast from './assets/coast-v1.mp3?url';
import tap from './assets/tap-v1.wav?url';
import chime from './assets/chime-v1.wav?url';
import chuckle from './assets/chuckle-v1.wav?url';
const songs = { emerald, coast };
const sounds = { tap, chime, chuckle };
export class SocialAudio {
  musicEnabled = false;
  effectsEnabled = false;
  private online = false;
  private context: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private effect: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private effectGain: GainNode | null = null;
  private sources: MediaElementAudioSourceNode[] = [];
  private state: MusicState | null = null;
  private track: string | null = null;
  private musicVolume = 0.25;
  private effectsVolume = 0.45;
  private priming = false;
  private blocked = false;
  private generation = 0;
  private effectGeneration = 0;
  private timer?: ReturnType<typeof setInterval> | undefined;
  constructor(
    private readonly serverNow: () => number,
    private readonly notify: (error: string | null) => void,
    private readonly positionChanged: (position: number) => void,
  ) {}
  private prepare(kind: 'music' | 'effect') {
    let element = kind === 'music' ? this.music : this.effect;
    if (element) return element;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      /* Native element volume is the fallback. */
    }
    element = document.createElement('audio');
    element.hidden = true;
    element.preload = 'none';
    element.setAttribute(`data-social-${kind}`, '');
    document.body.append(element);
    if (this.context) {
      const source = this.context.createMediaElementSource(element);
      const gain = this.context.createGain();
      source.connect(gain);
      gain.connect(this.context.destination);
      this.sources.push(source);
      if (kind === 'music') this.musicGain = gain;
      else this.effectGain = gain;
    }
    if (kind === 'music') {
      this.music = element;
      element.loop = true;
      element.onloadedmetadata = () => this.sync();
      element.onerror = () =>
        this.notify(
          'Music could not load. Check your connection and try enabling it again.',
        );
    } else this.effect = element;
    this.volumes(this.musicVolume, this.effectsVolume);
    return element;
  }
  volumes(music: number, effects: number) {
    this.musicVolume = music;
    this.effectsVolume = effects;
    if (this.musicGain) this.musicGain.gain.value = music;
    if (this.effectGain) this.effectGain.gain.value = effects;
    if (this.music) this.music.volume = this.musicGain ? 1 : music;
    if (this.effect) this.effect.volume = this.effectGain ? 1 : effects;
  }
  update(state: MusicState) {
    this.state = state;
    this.sync();
  }
  setOnline(online: boolean) {
    this.online = online;
    if (!online) {
      this.music?.pause();
      this.silenceEffects();
      clearInterval(this.timer);
      this.timer = undefined;
    } else {
      this.startTimer();
      this.sync();
    }
  }
  private startTimer() {
    if (this.musicEnabled && this.online && !this.timer)
      this.timer = setInterval(() => this.sync(), 1000);
  }
  enableMusic = async () => {
    const audio = this.prepare('music');
    this.musicEnabled = true;
    this.blocked = false;
    this.notify(null);
    this.priming = true;
    const generation = ++this.generation;
    if (this.context) void this.context.resume().catch(() => undefined);
    if (this.state && (this.track !== this.state.trackId || audio.error)) {
      this.track = this.state.trackId;
      audio.src = songs[this.state.trackId];
      audio.load();
    }
    // An explicit gesture unlocks this element even when the shared track is paused.
    if (this.musicGain) this.musicGain.gain.value = 0;
    else audio.volume = 0;
    try {
      await audio.play();
    } catch {
      if (this.musicEnabled && this.online && generation === this.generation) {
        this.blocked = true;
        this.notify(
          'Music playback is blocked. Press Retry audio to allow it.',
        );
      }
    } finally {
      if (generation === this.generation) {
        this.priming = false;
        this.volumes(this.musicVolume, this.effectsVolume);
        this.startTimer();
        this.sync();
      } else audio.pause();
    }
  };
  disableMusic = () => {
    this.musicEnabled = false;
    this.generation++;
    this.priming = false;
    this.music?.pause();
    clearInterval(this.timer);
    this.timer = undefined;
    if (this.music) {
      this.music.removeAttribute('src');
      this.music.load();
      this.track = null;
    }
  };
  enableEffects = async () => {
    const audio = this.prepare('effect');
    this.effectsEnabled = true;
    if (this.context) void this.context.resume().catch(() => undefined);
    audio.src = tap;
    const generation = ++this.effectGeneration;
    try {
      await audio.play();
    } catch {
      if (
        this.effectsEnabled &&
        this.online &&
        generation === this.effectGeneration
      )
        this.notify(
          'Reaction sounds are blocked. Press Retry audio to allow them.',
        );
    }
  };
  disableEffects = () => {
    this.effectsEnabled = false;
    this.effectGeneration++;
    this.effect?.pause();
    if (this.effect) {
      this.effect.removeAttribute('src');
      this.effect.load();
    }
  };
  retry = async () => {
    if (this.context) void this.context.resume().catch(() => undefined);
    this.blocked = false;
    this.notify(null);
    if (this.musicEnabled) await this.enableMusic();
    else if (this.effectsEnabled) await this.enableEffects();
  };
  reaction(entry: ReactionEntry) {
    if (!this.effectsEnabled || !this.online) return;
    const definition = reactions.find((item) => item.id === entry.reactionId);
    if (!definition) return;
    const audio = this.prepare('effect');
    const generation = ++this.effectGeneration;
    audio.pause();
    audio.src = sounds[definition.sound];
    audio.currentTime = 0;
    void audio.play().catch(() => {
      if (
        this.effectsEnabled &&
        this.online &&
        generation === this.effectGeneration
      )
        this.notify(
          'Reaction sounds are blocked. Press Retry audio to allow them.',
        );
    });
  }
  silenceEffects() {
    this.effectGeneration++;
    this.effect?.pause();
  }

  private sync() {
    if (
      !this.musicEnabled ||
      !this.online ||
      !this.music ||
      !this.state ||
      this.priming
    )
      return;
    const audio = this.music;
    const state = this.state;
    if (this.track !== state.trackId) {
      this.track = state.trackId;
      this.generation++;
      audio.pause();
      audio.src = songs[state.trackId];
      audio.load();
      return;
    }
    const expected = musicPosition(state, this.serverNow());
    this.positionChanged(expected);
    if (audio.readyState >= 1) {
      const difference = Math.abs(audio.currentTime - expected);
      const duration = audio.duration;
      if (Math.min(difference, Math.abs(duration - difference)) > 0.35)
        audio.currentTime = expected;
    }
    if (!state.playing) audio.pause();
    else if (audio.paused && !this.blocked) {
      const generation = this.generation;
      void audio.play().catch(() => {
        if (
          this.musicEnabled &&
          this.state?.playing &&
          this.online &&
          generation === this.generation
        ) {
          this.blocked = true;
          this.notify(
            'Music playback is blocked. Press Retry audio to allow it.',
          );
        }
      });
    }
  }
  dispose() {
    this.disableMusic();
    this.disableEffects();
    for (const source of this.sources) source.disconnect();
    this.sources = [];
    this.musicGain?.disconnect();
    this.effectGain?.disconnect();
    this.musicGain = null;
    this.effectGain = null;
    for (const audio of [this.music, this.effect])
      if (audio) {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.remove();
      }
    this.music = null;
    this.effect = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}

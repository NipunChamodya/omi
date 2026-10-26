import { createStore } from 'zustand/vanilla';
import {
  musicPosition,
  reactions,
  trimChat,
  validSocialText,
} from '@omi/shared';
import type {
  ChatEntry,
  MusicState,
  ReactionEntry,
  SocialMessage,
  SocialPayload,
} from '@omi/shared';
import { apiBase } from '../game/api';
import { SocialAudio } from './audio';
export type SocialPreferences = {
  adult: boolean;
  muteReactions: boolean;
  musicVolume: number;
  effectsVolume: number;
  blocked: string[];
};
const defaults = (): SocialPreferences => ({
  adult: false,
  muteReactions: false,
  musicVolume: 0.25,
  effectsVolume: 0.45,
  blocked: [],
});
export function readPreferences(key: string): SocialPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) ?? 'null',
    ) as Partial<SocialPreferences> | null;
    if (!value || typeof value !== 'object') return defaults();
    const volume = (item: unknown, fallback: number) =>
      typeof item === 'number' &&
      Number.isFinite(item) &&
      item >= 0 &&
      item <= 1
        ? item
        : fallback;
    return {
      adult: value.adult === true,
      muteReactions: value.muteReactions === true,
      musicVolume: volume(value.musicVolume, 0.25),
      effectsVolume: volume(value.effectsVolume, 0.45),
      blocked: Array.isArray(value.blocked)
        ? value.blocked
            .filter(
              (item): item is string =>
                typeof item === 'string' && /^[a-f0-9-]{36}$/.test(item),
            )
            .slice(0, 3)
        : [],
    };
  } catch {
    return defaults();
  }
}
export type SocialState = {
  status: 'offline' | 'connecting' | 'online';
  history: ChatEntry[];
  recent: ReactionEntry[];
  hostId: string | null;
  music: MusicState | null;
  position: number;
  preferences: SocialPreferences;
  error: string | null;
  notice: string | null;
  audioError: string | null;
  musicEnabled: boolean;
  effectsEnabled: boolean;
  pending: boolean;
  tapped: boolean;
};
export class SocialClient {
  readonly store;
  readonly audio: SocialAudio;
  private socket: WebSocket | null = null;
  private online = false;
  private connectionId: string | null = null;
  private sequence = 0;
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout> | undefined;
  private connectTimer?: ReturnType<typeof setTimeout> | undefined;
  private clockTimer?: ReturnType<typeof setInterval> | undefined;
  private reactionTimer?: ReturnType<typeof setTimeout> | undefined;
  private tapTimer?: ReturnType<typeof setTimeout> | undefined;
  private readonly pending = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; type: SocialPayload['type'] }
  >();
  private serverAt = Date.now();
  private perfAt = performance.now();
  private readonly preferenceKey;
  constructor(
    readonly roomId: string,
    readonly actorId: string,
  ) {
    this.preferenceKey = `omi-social:${actorId}:${roomId}`;
    const preferences = readPreferences(this.preferenceKey);
    this.store = createStore<SocialState>(() => ({
      status: 'offline',
      history: [],
      recent: [],
      hostId: null,
      music: null,
      position: 0,
      preferences,
      error: null,
      notice: null,
      audioError: null,
      musicEnabled: false,
      effectsEnabled: false,
      pending: false,
      tapped: false,
    }));
    this.audio = new SocialAudio(
      () => this.serverNow(),
      (audioError) => this.store.setState({ audioError }),
      (position) => this.store.setState({ position }),
    );
    this.audio.volumes(preferences.musicVolume, preferences.effectsVolume);
  }
  private serverNow() {
    return this.serverAt + performance.now() - this.perfAt;
  }
  private anchor(serverTime: number, halfRtt = 0) {
    this.serverAt = serverTime + halfRtt;
    this.perfAt = performance.now();
  }
  preference(update: Partial<SocialPreferences>) {
    const next = { ...this.store.getState().preferences, ...update };
    this.store.setState({ preferences: next });
    this.audio.volumes(next.musicVolume, next.effectsVolume);
    if (next.muteReactions) this.audio.silenceEffects();
    try {
      localStorage.setItem(this.preferenceKey, JSON.stringify(next));
    } catch {
      /* Controls still work when storage is unavailable. */
    }
  }
  block(actorId: string, blocked: boolean) {
    const old = this.store
      .getState()
      .preferences.blocked.filter((id) => id !== actorId);
    this.preference({ blocked: blocked ? [...old, actorId].slice(-3) : old });
  }
  setOnline = (online: boolean) => {
    if (online === this.online) return;
    this.online = online;
    if (online) {
      this.retries = 0;
      this.connect();
    } else this.drop();
  };
  private drop() {
    const socket = this.socket;
    this.socket = null;
    this.connectionId = null;
    socket?.close();
    clearTimeout(this.retryTimer);
    clearTimeout(this.connectTimer);
    clearInterval(this.clockTimer);
    for (const item of this.pending.values()) clearTimeout(item.timer);
    this.pending.clear();
    this.audio.setOnline(false);
    this.store.setState({ status: 'offline', pending: false });
  }
  private connect() {
    if (!this.online) return;
    this.store.setState({ status: 'connecting' });
    const url = new URL(
      `${apiBase}/rooms/${encodeURIComponent(this.roomId)}/social/ws`,
      window.location.origin,
    );
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    this.connectTimer = setTimeout(() => socket.close(), 8000);
    socket.onerror = () => undefined;
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      try {
        this.receive(JSON.parse(String(event.data)) as SocialMessage);
      } catch {
        this.store.setState({
          error: 'Social updates could not be read. Reconnect to the table.',
        });
        socket.close();
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.drop();
      if (!this.online) return;
      if (event.code === 1008 || event.code === 4001 || this.retries >= 4) {
        this.store.setState({
          error: 'Social connection paused. Use Reconnect social to try again.',
        });
        return;
      }
      this.retryTimer = setTimeout(
        () => this.connect(),
        500 * 2 ** this.retries++,
      );
    };
  }
  reconnect = () => {
    this.drop();
    if (this.online) {
      this.retries = 0;
      this.connect();
    }
  };
  send = (command: SocialPayload): string | null => {
    if (
      !this.connectionId ||
      this.socket?.readyState !== WebSocket.OPEN ||
      this.pending.size >= 16
    )
      return null;
    if (command.type === 'chat' && !validSocialText(command.payload.text)) {
      this.store.setState({
        error:
          'Use 1–400 characters, at most four lines, without control characters.',
      });
      return null;
    }
    const actionId = crypto.randomUUID();
    const data = JSON.stringify({
      ...command,
      actorId: this.actorId,
      roomId: this.roomId,
      connectionId: this.connectionId,
      actionId,
      expectedVersion: this.sequence,
    });
    if (
      new TextEncoder().encode(data).length > 4096 ||
      this.socket.bufferedAmount > 32_768
    ) {
      this.store.setState({
        error: 'That message is too large or the connection is busy.',
      });
      return null;
    }
    this.sequence++;
    const timer = setTimeout(() => {
      this.pending.delete(actionId);
      this.store.setState({
        pending: this.pending.size > 0,
        error:
          'Social delivery was not confirmed. Check the room before retrying; messages are not replayed automatically.',
      });
    }, 8000);
    this.pending.set(actionId, { timer, type: command.type });
    this.socket.send(data);
    if (command.type !== 'clock')
      this.store.setState({ pending: true, error: null, notice: null });
    return actionId;
  };
  private receive(message: SocialMessage) {
    if (message.type === 'snapshot') {
      clearTimeout(this.connectTimer);
      this.connectionId = message.connectionId;
      this.sequence = 0;
      this.anchor(message.serverTime);
      this.store.setState({
        status: 'online',
        history: trimChat(message.history),
        hostId: message.hostId,
        music: message.music,
        position: musicPosition(message.music, this.serverNow()),
        error: null,
      });
      this.audio.setOnline(true);
      this.audio.update(message.music);
      this.send({ type: 'clock', payload: { sentAt: performance.now() } });
      this.clockTimer = setInterval(() => {
        if (this.store.getState().musicEnabled)
          this.send({ type: 'clock', payload: { sentAt: performance.now() } });
      }, 15_000);
    } else if (message.type === 'chat') {
      const history = this.store.getState().history;
      if (!history.some((item) => item.id === message.entry.id))
        this.store.setState({ history: trimChat([...history, message.entry]) });
    } else if (message.type === 'reaction') {
      const prefs = this.store.getState().preferences;
      const definition = reactions.find(
        (item) => item.id === message.entry.reactionId,
      );
      if (
        !definition ||
        prefs.muteReactions ||
        prefs.blocked.includes(message.entry.actorId) ||
        (definition.adult && !prefs.adult) ||
        Math.abs(this.serverNow() - message.entry.createdAt) > 5000
      )
        return;
      this.store.setState({
        recent: [...this.store.getState().recent, message.entry].slice(-6),
      });
      this.audio.reaction(message.entry);
      if (definition.id === 'tap') {
        this.store.setState({ tapped: true });
        document.body.classList.add('omi-table-tap');
        clearTimeout(this.tapTimer);
        this.tapTimer = setTimeout(() => {
          document.body.classList.remove('omi-table-tap');
          this.store.setState({ tapped: false });
        }, 450);
      }
      clearTimeout(this.reactionTimer);
      this.reactionTimer = setTimeout(
        () => this.store.setState({ recent: [] }),
        3500,
      );
    } else if (message.type === 'music') {
      const current = this.store.getState().music;
      if (!current || message.music.version >= current.version) {
        this.store.setState({
          music: message.music,
          position: musicPosition(message.music, this.serverNow()),
        });
        this.audio.update(message.music);
      }
    } else {
      const pending = this.pending.get(message.actionId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.actionId);
      this.store.setState({
        pending: [...this.pending.values()].some(
          (item) => item.type !== 'clock',
        ),
      });
      if (message.type === 'clock') {
        const rtt = performance.now() - message.sentAt;
        if (rtt >= 0 && rtt < 10_000) this.anchor(message.serverTime, rtt / 2);
      } else if (message.type === 'error') {
        const messages: Record<string, string> = {
          SOCIAL_SLOW_DOWN: 'Slow down a little before sending again.',
          REPORT_SLOW_DOWN: 'Please wait before submitting another report.',
          REPORT_MESSAGE_UNAVAILABLE:
            'That message is no longer available for reporting.',
          MUSIC_HOST_ONLY: 'Only the table host can control shared music.',
          MUSIC_CONFLICT:
            'Music changed before that action. The current state has been restored.',
        };
        this.store.setState({
          error:
            messages[message.code] ??
            'That social action could not be completed.',
        });
        if (message.music) {
          this.store.setState({ music: message.music });
          this.audio.update(message.music);
        }
      } else if (message.reportId)
        this.store.setState({
          notice:
            'Report saved for owner review. No automatic penalty was applied.',
        });
    }
  }
  enableMusic = async () => {
    this.store.setState({ musicEnabled: true });
    await this.audio.enableMusic();
  };
  disableMusic = () => {
    this.audio.disableMusic();
    this.store.setState({ musicEnabled: false, audioError: null });
  };
  enableEffects = async () => {
    this.store.setState({ effectsEnabled: true });
    await this.audio.enableEffects();
  };
  disableEffects = () => {
    this.audio.disableEffects();
    this.store.setState({ effectsEnabled: false });
  };
  stop = () => {
    this.online = false;
    this.drop();
    clearTimeout(this.reactionTimer);
    clearTimeout(this.tapTimer);
    document.body.classList.remove('omi-table-tap');
    this.audio.dispose();
    this.store.setState({
      musicEnabled: false,
      effectsEnabled: false,
      recent: [],
      tapped: false,
    });
  };
}

import { createStore } from 'zustand/vanilla';
import type {
  VoiceConfig,
  VoiceMessage,
  VoiceParticipant,
  VoiceSignal,
} from '@omi/shared';
import { apiBase } from '../game/api';
export type VoicePeerState = VoiceParticipant & {
  connection: RTCPeerConnectionState;
  speaking: boolean;
  volume: number;
};
export type VoiceState = {
  status: 'off' | 'joining' | 'connected' | 'reconnecting' | 'error';
  muted: boolean;
  speaking: boolean;
  peers: VoicePeerState[];
  error: string | null;
  playbackBlocked: boolean;
  relayAvailable: boolean;
};
type Link = {
  peer: VoiceParticipant;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
  candidates: RTCIceCandidateInit[];
  serial: Promise<void>;
  attempts: number;
  retry?: ReturnType<typeof setTimeout> | undefined;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  gain?: GainNode;
  track?: MediaStreamTrack;
};
export class VoiceClient {
  readonly store = createStore<VoiceState>(() => ({
    status: 'off',
    muted: false,
    speaking: false,
    peers: [],
    error: null,
    playbackBlocked: false,
    relayAvailable: false,
  }));
  private wanted = false;
  private online = true;
  private epoch = 0;
  private socket: WebSocket | null = null;
  private self: VoiceParticipant | null = null;
  private stream: MediaStream | null = null;
  private config: VoiceConfig | null = null;
  private readonly links = new Map<string, Link>();
  private version = 0;
  private retries = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private meterTimer?: ReturnType<typeof setInterval>;
  private request: AbortController | null = null;
  private context: AudioContext | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private blocked = new Set<string>();
  private readonly volumes = new Map<string, number>();
  private masterVolume = 0.8;
  constructor(
    readonly roomId: string,
    readonly actorId: string,
  ) {}
  private peerStates() {
    this.store.setState({
      peers: [...this.links.values()].map((link) => ({
        ...link.peer,
        connection: link.pc.connectionState,
        speaking:
          this.store
            .getState()
            .peers.find((peer) => peer.actorId === link.peer.actorId)
            ?.speaking ?? false,
        volume: this.blocked.has(link.peer.actorId)
          ? 0
          : (this.volumes.get(link.peer.actorId) ?? 1),
      })),
    });
  }
  private async configuration(signal: AbortSignal): Promise<VoiceConfig> {
    const response = await fetch(
      `${apiBase}/rooms/${encodeURIComponent(this.roomId)}/voice/config`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal,
      },
    );
    if (!response.ok)
      throw new Error(
        'Voice is unavailable. Reconnect to the table and try again.',
      );
    return (await response.json()) as VoiceConfig;
  }
  private audioContext() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      /* Audio calls still work without speaking meters. */
    }
  }
  join = async () => {
    if (this.wanted) return;
    this.wanted = true;
    this.retries = 0;
    this.audioContext();
    await this.open();
  };
  private async open() {
    if (!this.wanted || !this.online) return;
    const epoch = ++this.epoch;
    this.store.setState({
      status: this.retries ? 'reconnecting' : 'joining',
      error: null,
    });
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.RTCPeerConnection
    ) {
      this.fail(
        'Voice needs microphone support and HTTPS (or loopback localhost).',
      );
      return;
    }
    const request = new AbortController();
    this.request = request;
    const timeout = setTimeout(() => request.abort(), 10_000);
    try {
      const config = await this.configuration(request.signal);
      if (epoch !== this.epoch || !this.wanted) return;
      // Exactly one shared microphone track feeds the three outgoing peer connections.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (epoch !== this.epoch || !this.wanted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.config = config;
      this.stream = stream;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !this.store.getState().muted;
        track.onended = () =>
          this.fail('The microphone disconnected. Join voice again to retry.');
      }
      this.audioContext();
      if (this.context) {
        this.localSource = this.context.createMediaStreamSource(stream);
        this.localAnalyser = this.context.createAnalyser();
        this.localAnalyser.fftSize = 2048;
        this.localSource.connect(this.localAnalyser);
      }
      this.store.setState({ relayAvailable: config.relayAvailable });
      this.meterTimer = setInterval(() => this.meters(), 150);
      const url = new URL(
        `${apiBase}/rooms/${encodeURIComponent(this.roomId)}/voice/ws`,
        window.location.origin,
      );
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      this.socket = socket;
      this.connectTimer = setTimeout(() => {
        if (this.socket === socket) socket.close();
      }, 8000);
      socket.onmessage = (event) => {
        if (this.socket !== socket || epoch !== this.epoch) return;
        try {
          this.receive(JSON.parse(String(event.data)) as VoiceMessage);
        } catch {
          this.fail('Voice signaling could not be read. Join again to retry.');
        }
      };
      socket.onerror = () => undefined;
      socket.onclose = (event) => {
        if (this.socket !== socket || epoch !== this.epoch) return;
        this.clean();
        if (event.code === 1008 || event.code === 4001)
          this.fail(
            'Voice ended or moved to another connection. Join again to retry.',
          );
        else this.recover();
      };
      this.refreshTimer = setInterval(() => {
        void this.refresh();
      }, 30 * 60_000);
    } catch (error) {
      if (epoch !== this.epoch || !this.wanted) return;
      const name =
        error &&
        typeof error === 'object' &&
        'name' in error &&
        typeof error.name === 'string'
          ? error.name
          : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
        this.fail(
          'Microphone permission was denied. Allow microphone access in your browser, then join again.',
        );
      else if (name === 'NotFoundError')
        this.fail('No microphone was found. Connect one and join again.');
      else
        this.fail(
          'Voice could not start. Check your microphone and connection, then try again.',
        );
    } finally {
      clearTimeout(timeout);
    }
  }
  private async refresh() {
    const epoch = this.epoch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const config = await this.configuration(controller.signal);
      if (epoch !== this.epoch || !this.wanted) return;
      this.config = config;
      for (const link of this.links.values()) {
        link.pc.setConfiguration({
          iceServers: config.iceServers,
          iceTransportPolicy: config.iceTransportPolicy,
          bundlePolicy: 'max-bundle',
        });
        if (this.actorId < link.peer.actorId) link.pc.restartIce();
      }
    } catch {
      if (epoch === this.epoch) {
        this.clean();
        this.recover();
      }
    } finally {
      clearTimeout(timer);
    }
  }
  private transmit(
    command:
      | { type: 'mute'; payload: { muted: boolean } }
      | {
          type: 'signal';
          target: { actorId: string; callId: string };
          payload: VoiceSignal;
        },
  ) {
    if (!this.self || this.socket?.readyState !== WebSocket.OPEN) return;
    const encoded = JSON.stringify({
      ...command,
      roomId: this.roomId,
      actorId: this.actorId,
      callId: this.self.callId,
      actionId: crypto.randomUUID(),
      expectedVersion: this.version++,
    });
    if (
      new TextEncoder().encode(encoded).length > 4096 ||
      this.socket.bufferedAmount > 32_768
    ) {
      this.fail('Voice signaling exceeded its limits. Join again to retry.');
      return;
    }
    this.socket.send(encoded);
  }
  private signal(link: Link, payload: VoiceSignal) {
    if (this.links.get(link.peer.actorId) === link)
      this.transmit({
        type: 'signal',
        target: { actorId: link.peer.actorId, callId: link.peer.callId },
        payload,
      });
  }
  private receive(message: VoiceMessage) {
    if (message.type === 'hello') {
      if (message.self.actorId !== this.actorId || message.peers.length > 3)
        throw new Error();
      clearTimeout(this.connectTimer);
      this.self = message.self;
      this.version = 0;
      this.store.setState({ status: 'connected', error: null });
      this.transmit({
        type: 'mute',
        payload: { muted: this.store.getState().muted },
      });
      for (const peer of message.peers) this.add(peer);
    } else if (message.type === 'joined') this.add(message.peer);
    else if (message.type === 'updated') {
      const link = this.links.get(message.peer.actorId);
      if (link?.peer.callId === message.peer.callId) {
        link.peer = message.peer;
        this.peerStates();
      }
    } else if (message.type === 'left') {
      const link = this.links.get(message.actorId);
      if (link?.peer.callId === message.callId) this.remove(message.actorId);
    } else if (message.type === 'signal') {
      const link = this.links.get(message.from.actorId);
      if (link?.peer.callId !== message.from.callId) return;
      const epoch = this.epoch;
      link.serial = link.serial
        .then(async () => {
          if (
            this.links.get(link.peer.actorId) !== link ||
            epoch !== this.epoch
          )
            return;
          await this.handleSignal(link, message.payload);
        })
        .catch(() => {
          if (this.links.get(link.peer.actorId) === link) this.retryLink(link);
        });
    }
  }
  private add(peer: VoiceParticipant) {
    if (peer.actorId === this.actorId || !this.stream || !this.config) return;
    const existing = this.links.get(peer.actorId);
    if (existing?.peer.callId === peer.callId) return;
    if (this.links.size >= 3 && !existing) return;
    if (existing) this.remove(peer.actorId);
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
      bundlePolicy: 'max-bundle',
    });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.hidden = true;
    audio.setAttribute('playsinline', '');
    audio.volume = this.blocked.has(peer.actorId)
      ? 0
      : (this.volumes.get(peer.actorId) ?? 1) * this.masterVolume;
    document.body.append(audio);
    const link: Link = {
      peer,
      pc,
      audio,
      makingOffer: false,
      ignoreOffer: false,
      settingAnswer: false,
      candidates: [],
      serial: Promise.resolve(),
      attempts: 0,
    };
    this.links.set(peer.actorId, link);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const json = candidate.toJSON();
        this.signal(link, {
          kind: 'candidate',
          candidate: {
            candidate: json.candidate ?? '',
            sdpMid: json.sdpMid ?? null,
            sdpMLineIndex: json.sdpMLineIndex ?? null,
            ...(json.usernameFragment === undefined
              ? {}
              : { usernameFragment: json.usernameFragment }),
          },
        });
      }
    };
    pc.onnegotiationneeded = async () => {
      // Only one side starts a new pair. Later renegotiations still use perfect negotiation.
      if (!pc.remoteDescription && this.actorId > link.peer.actorId) return;
      try {
        link.makingOffer = true;
        await pc.setLocalDescription();
        if (
          pc.localDescription?.sdp &&
          (pc.localDescription.type === 'offer' ||
            pc.localDescription.type === 'answer')
        )
          this.signal(link, {
            kind: 'description',
            description: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp,
            },
          });
      } catch {
        this.retryLink(link);
      } finally {
        link.makingOffer = false;
      }
    };
    pc.ontrack = (event) => {
      if (this.links.get(peer.actorId) !== link) return;
      if (event.track.kind !== 'audio') {
        event.track.stop();
        return;
      }
      if (link.track) link.track.onunmute = null;
      link.track = event.track;
      const receive = () => {
        if (this.links.get(peer.actorId) !== link || link.track !== event.track)
          return;
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        audio.srcObject = stream;
        if (this.context) {
          link.source?.disconnect();
          link.source = this.context.createMediaStreamSource(stream);
          link.analyser = this.context.createAnalyser();
          link.analyser.fftSize = 2048;
          link.source.connect(link.analyser);
          link.gain?.disconnect();
          link.gain = this.context.createGain();
          link.gain.gain.value = audio.volume;
          link.source.connect(link.gain);
          link.gain.connect(this.context.destination);
          audio.muted = true;
          if (this.context.state !== 'running')
            this.store.setState({ playbackBlocked: true });
        }
        void this.play(audio);
      };
      // Incoming tracks can initially be muted until ICE/DTLS delivers media.
      event.track.onunmute = receive;
      if (!event.track.muted) receive();
    };
    pc.onconnectionstatechange = () => {
      if (this.links.get(peer.actorId) !== link) return;
      this.peerStates();
      if (pc.connectionState === 'connected') {
        link.attempts = 0;
        clearTimeout(link.retry);
        link.retry = undefined;
      }
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      )
        this.retryLink(link);
    };
    for (const track of this.stream.getAudioTracks())
      pc.addTrack(track, this.stream);
    this.peerStates();
    link.retry = setTimeout(() => {
      link.retry = undefined;
      if (
        this.links.get(peer.actorId) === link &&
        pc.connectionState !== 'connected'
      )
        this.retryLink(link);
    }, 8000);
  }
  private async handleSignal(link: Link, signal: VoiceSignal) {
    const pc = link.pc;
    if (signal.kind === 'description') {
      const description = signal.description;
      const ready =
        !link.makingOffer &&
        (pc.signalingState === 'stable' || link.settingAnswer);
      const collision = description.type === 'offer' && !ready;
      link.ignoreOffer = this.actorId < link.peer.actorId && collision;
      if (link.ignoreOffer) return;
      link.settingAnswer = description.type === 'answer';
      try {
        await pc.setRemoteDescription(description);
      } finally {
        link.settingAnswer = false;
      }
      for (const candidate of link.candidates.splice(0))
        await pc.addIceCandidate(candidate);
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        if (pc.localDescription?.sdp)
          this.signal(link, {
            kind: 'description',
            description: { type: 'answer', sdp: pc.localDescription.sdp },
          });
      }
    } else {
      if (link.ignoreOffer) return;
      const candidate: RTCIceCandidateInit = {
        candidate: signal.candidate.candidate,
        sdpMid: signal.candidate.sdpMid,
        sdpMLineIndex: signal.candidate.sdpMLineIndex,
        ...(signal.candidate.usernameFragment === undefined
          ? {}
          : { usernameFragment: signal.candidate.usernameFragment }),
      };
      if (!pc.remoteDescription) {
        if (link.candidates.length >= 32)
          throw new Error('Too many candidates');
        link.candidates.push(candidate);
      } else await pc.addIceCandidate(candidate);
    }
  }
  private retryLink(link: Link) {
    if (
      this.links.get(link.peer.actorId) !== link ||
      link.retry ||
      !this.wanted
    )
      return;
    if (link.attempts >= 3) {
      this.store.setState({
        error:
          'A voice connection could not recover. Rejoin voice; configure TURN for restrictive networks.',
      });
      return;
    }
    link.retry = setTimeout(
      () => {
        link.retry = undefined;
        if (
          this.links.get(link.peer.actorId) === link &&
          link.pc.connectionState !== 'connected'
        ) {
          link.attempts++;
          link.pc.restartIce();
          this.retryLink(link);
        }
      },
      1000 * 2 ** link.attempts,
    );
  }
  private async play(audio: HTMLAudioElement) {
    try {
      await audio.play();
    } catch {
      if (audio.isConnected) this.store.setState({ playbackBlocked: true });
    }
  }
  resumePlayback = async () => {
    this.audioContext();
    this.store.setState({ playbackBlocked: false });
    await Promise.all(
      [...this.links.values()].map((link) => this.play(link.audio)),
    );
  };
  setMuted = (muted: boolean) => {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.store.setState({ muted, speaking: false });
    this.transmit({ type: 'mute', payload: { muted } });
  };
  setBlocked = (ids: readonly string[]) => {
    this.blocked = new Set(ids);
    for (const [actorId, link] of this.links) {
      const value = this.blocked.has(actorId)
        ? 0
        : (this.volumes.get(actorId) ?? 1) * this.masterVolume;
      link.audio.volume = value;
      if (link.gain) link.gain.gain.value = value;
    }
    this.peerStates();
  };
  setVolume = (actorId: string, value: number) => {
    if (!Number.isFinite(value)) return;
    const volume = Math.max(0, Math.min(1, value));
    this.volumes.set(actorId, volume);
    const link = this.links.get(actorId);
    if (link) {
      const playback = this.blocked.has(actorId)
        ? 0
        : volume * this.masterVolume;
      link.audio.volume = playback;
      if (link.gain) link.gain.gain.value = playback;
      this.peerStates();
    }
  };
  setMasterVolume = (value: number) => {
    if (!Number.isFinite(value)) return;
    this.masterVolume = Math.max(0, Math.min(1, value));
    this.setBlocked([...this.blocked]);
  };
  private meters() {
    const level = (analyser: AnalyserNode | undefined | null) => {
      if (!analyser || this.context?.state !== 'running') return false;
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return (
        Math.sqrt(
          samples.reduce((total, item) => total + item * item, 0) /
            samples.length,
        ) > 0.02
      );
    };
    const current = this.store.getState();
    const speaking = !current.muted && level(this.localAnalyser);
    const peers = current.peers.map((peer) => ({
      ...peer,
      speaking: !peer.muted && level(this.links.get(peer.actorId)?.analyser),
    }));
    if (
      speaking !== current.speaking ||
      peers.some((peer, i) => peer.speaking !== current.peers[i]?.speaking)
    )
      this.store.setState({ speaking, peers });
  }
  private remove(actorId: string) {
    const link = this.links.get(actorId);
    if (!link) return;
    this.links.delete(actorId);
    clearTimeout(link.retry);
    link.pc.ontrack = null;
    link.pc.onnegotiationneeded = null;
    link.pc.onicecandidate = null;
    link.pc.onconnectionstatechange = null;
    if (link.track) link.track.onunmute = null;
    link.pc.close();
    link.source?.disconnect();
    link.gain?.disconnect();
    link.audio.pause();
    link.audio.srcObject = null;
    link.audio.remove();
    this.peerStates();
  }
  private clean() {
    this.epoch++;
    this.request?.abort();
    this.request = null;
    clearTimeout(this.connectTimer);
    clearTimeout(this.reconnectTimer);
    clearInterval(this.refreshTimer);
    clearInterval(this.meterTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.self = null;
    for (const actorId of [...this.links.keys()]) this.remove(actorId);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.localSource?.disconnect();
    this.localSource = null;
    this.localAnalyser = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.store.setState({ speaking: false, playbackBlocked: false });
  }
  private recover() {
    if (!this.wanted || !this.online) return;
    if (this.retries >= 4) {
      this.fail('Voice could not reconnect. Join again to retry.');
      return;
    }
    this.store.setState({ status: 'reconnecting' });
    this.reconnectTimer = setTimeout(
      () => {
        void this.open();
      },
      500 * 2 ** this.retries++,
    );
  }
  private fail(message: string) {
    this.wanted = false;
    this.clean();
    this.store.setState({ status: 'error', error: message });
  }
  setOnline = (online: boolean) => {
    if (online === this.online) return;
    this.online = online;
    if (!online) {
      this.clean();
      if (this.wanted) this.store.setState({ status: 'reconnecting' });
    } else if (this.wanted) {
      this.retries = 0;
      void this.open();
    }
  };
  leave = () => {
    this.wanted = false;
    this.clean();
    this.store.setState({ status: 'off', error: null });
  };
}

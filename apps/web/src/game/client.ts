import { createStore } from 'zustand/vanilla';
import type {
  ClientCommand,
  GuestIdentity,
  ServerMessage,
  Snapshot,
  PublicProfile,
  RoomDescriptor,
} from '@omi/shared';
import { api, ApiError, socketUrl } from './api';
import { applyEvent } from './reducer';
export type Connection =
  'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'expired';
export type GameAction = ClientCommand extends infer T
  ? T extends ClientCommand
    ? Pick<T, 'type' | 'payload'>
    : never
  : never;
type SavedTable = { roomId: string; code: string; displayName: string };
export type ClientState = {
  view: 'home' | 'join' | 'room';
  inviteCode: string;
  identity: GuestIdentity | null;
  snapshot: Snapshot | null;
  connection: Connection;
  busy: boolean;
  pending: boolean;
  error: string | null;
  notice: string | null;
  saved: SavedTable | null;
};
const key = 'omi.table.v1';
function loadSaved(): SavedTable | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      parsed &&
      typeof parsed === 'object' &&
      'roomId' in parsed &&
      typeof parsed.roomId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.roomId,
      ) &&
      'code' in parsed &&
      typeof parsed.code === 'string' &&
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(parsed.code) &&
      'displayName' in parsed &&
      typeof parsed.displayName === 'string' &&
      parsed.displayName.length <= 32 &&
      parsed.displayName.trim().length > 0
    )
      return parsed as SavedTable;
  } catch {
    /* Storage may be unavailable in private browsing. Gameplay still works in memory. */
  }
  return null;
}
export function friendlyError(code: string, type?: string): string {
  switch (code) {
    case 'UNRESOLVED_RULE':
      return type === 'next-round' || type === 'restart'
        ? 'The dealer rule for the next deal still needs confirmation. This table is paused.'
        : 'Reporting is paused until the reporting rules are confirmed.';
    case 'VERSION_CONFLICT':
      return 'The table changed. Please try again.';
    case 'INVALID_GAME_ACTION':
      return 'That move could not be played. Your hand has been refreshed.';
    case 'ROOM_FULL':
      return 'This table already has four players.';
    case 'ROOM_NOT_FOUND':
    case 'ROOM_EXPIRED':
      return 'This table has closed or the code is incorrect.';
    case 'ALREADY_IN_ROOM':
      return 'You already have a seat at a table. Return to that table to continue.';
    case 'LOGIN_REQUIRED':
      return 'Sign in with Google to take your seat.';
    case 'SESSION_REQUIRED':
    case 'SESSION_EXPIRED':
      return 'Your temporary session has ended. Return home to start again.';
    case 'FOUR_READY_PLAYERS_REQUIRED':
      return 'All four players need to be connected and ready.';
    case 'RATE_LIMITED':
    case 'ROOM_BUSY':
      return 'The table is busy. Please try again in a moment.';
    case 'ACTION_BUDGET_EXHAUSTED':
      return 'This table has reached its action limit.';
    case 'HOST_REQUIRED':
      return 'Only the table host can do that.';
    case 'REPORT_REJECTED':
      return 'The report could not be confirmed.';
    case 'REPORT_ALREADY_APPLIED':
      return 'That report has already been counted.';
    default:
      return 'Could not reach the table. Please try again.';
  }
}
export class GameClient {
  readonly store;
  private socket: WebSocket | null = null;
  private epoch = 0;
  private stopped = false;
  private controller: AbortController | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private actionTimer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private syncing = false;
  private recovering = false;
  private wentOffline = false;
  private pendingAction: { wire: ClientCommand; tries: number } | null = null;
  constructor() {
    const inviteCode =
      new URLSearchParams(window.location.search)
        .get('room')
        ?.trim()
        .toUpperCase() ?? '';
    this.store = createStore<ClientState>(() => ({
      view: inviteCode ? 'join' : 'home',
      inviteCode,
      identity: null,
      snapshot: null,
      connection: 'idle',
      busy: false,
      pending: false,
      error: null,
      notice: null,
      saved: loadSaved(),
    }));
  }
  private save(saved: SavedTable | null) {
    this.store.setState({ saved });
    try {
      if (saved) sessionStorage.setItem(key, JSON.stringify(saved));
      else sessionStorage.removeItem(key);
    } catch {
      /* No credentials are stored here. */
    }
  }
  private clearPending() {
    clearTimeout(this.actionTimer);
    this.pendingAction = null;
    this.store.setState({ pending: false });
  }
  stop = () => {
    this.stopped = true;
    this.wentOffline = false;
    this.epoch++;
    this.recovering = false;
    this.controller?.abort();
    clearTimeout(this.retryTimer);
    clearTimeout(this.connectTimer);
    clearTimeout(this.actionTimer);
    clearTimeout(this.syncTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.clearPending();
  };
  start = async () => {
    this.stopped = false;
    const saved = this.store.getState().saved;
    if (saved) await this.resume();
  };
  adoptAccount = (
    profile: PublicProfile,
    room: RoomDescriptor | null,
    expiresAt: number,
  ) => {
    const state = this.store.getState();
    if (state.identity && state.identity.actorId !== profile.id)
      this.forgetIdentity();
    this.store.setState({
      identity: {
        actorId: profile.id,
        displayName: profile.displayName,
        expiresAt,
      },
    });
    this.save(
      room
        ? {
            roomId: room.roomId,
            code: room.code,
            displayName: profile.displayName,
          }
        : null,
    );
  };
  profileChanged = (profile: PublicProfile) => {
    const state = this.store.getState();
    if (state.identity?.actorId !== profile.id) return;
    this.store.setState({
      identity: { ...state.identity, displayName: profile.displayName },
    });
    if (state.saved)
      this.save({ ...state.saved, displayName: profile.displayName });
  };
  forgetIdentity = () => {
    this.home();
    this.save(null);
    this.store.setState({ identity: null, snapshot: null });
  };
  showJoin = () => this.store.setState({ view: 'join', error: null });
  dismiss = () => this.store.setState({ error: null, notice: null });
  home = () => {
    this.stop();
    this.stopped = false;
    this.store.setState({
      view: 'home',
      connection: 'idle',
      busy: false,
      error: null,
      notice: null,
    });
    window.history.replaceState(null, '', window.location.pathname);
  };
  enter = async (displayName: string, code?: string) => {
    if (this.store.getState().busy) return;
    const epoch = ++this.epoch;
    this.stopped = false;
    this.controller?.abort();
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.store.setState({ busy: true, error: null });
    try {
      const identity = await api.session(displayName.trim(), signal);
      let room;
      if (code !== undefined) {
        for (let attempt = 0; ; attempt++) {
          const preview = await api.preview(code.trim().toUpperCase(), signal);
          try {
            room = await api.join(
              identity.actorId,
              crypto.randomUUID(),
              preview,
              signal,
            );
            break;
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              error.code !== 'VERSION_CONFLICT' ||
              attempt >= 4
            )
              throw error;
          }
        }
      } else
        room = await api.create(identity.actorId, crypto.randomUUID(), signal);
      if (this.stopped || epoch !== this.epoch) return;
      this.store.setState({
        identity,
        view: 'room',
        snapshot: null,
        busy: false,
      });
      this.save({
        roomId: room.roomId,
        code: room.code,
        displayName: identity.displayName,
      });
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}?room=${room.code}`,
      );
      this.retries = 0;
      this.openSocket(room.roomId);
    } catch (error) {
      if (!this.stopped && epoch === this.epoch)
        this.store.setState({
          busy: false,
          error: friendlyError(
            error instanceof ApiError ? error.code : 'NETWORK',
          ),
        });
    }
  };
  resume = async () => {
    const saved = this.store.getState().saved;
    if (!saved) return;
    const epoch = ++this.epoch;
    this.stopped = false;
    this.controller?.abort();
    this.controller = new AbortController();
    this.store.setState({
      view: 'room',
      busy: true,
      connection: 'connecting',
      error: null,
    });
    try {
      const identity = await api.session(
        saved.displayName,
        this.controller.signal,
      );
      const snapshot = await api.snapshot(saved.roomId, this.controller.signal);
      if (this.stopped || epoch !== this.epoch) return;
      this.store.setState({ identity, snapshot, busy: false });
      this.retries = 0;
      this.openSocket(saved.roomId);
    } catch (error) {
      if (this.stopped || epoch !== this.epoch) return;
      if (
        error instanceof ApiError &&
        ['ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'SESSION_REQUIRED'].includes(
          error.code,
        )
      )
        this.save(null);
      this.store.setState({
        view: 'home',
        busy: false,
        connection: 'offline',
        error: friendlyError(
          error instanceof ApiError ? error.code : 'NETWORK',
        ),
      });
    }
  };
  offline = () => {
    if (this.store.getState().view !== 'room') return;
    this.wentOffline = true;
    this.epoch++;
    this.controller?.abort();
    this.recovering = false;
    clearTimeout(this.retryTimer);
    clearTimeout(this.connectTimer);
    clearTimeout(this.actionTimer);
    clearTimeout(this.syncTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.store.setState({ connection: 'offline', busy: false });
  };
  online = () => {
    if (!this.wentOffline) return;
    this.wentOffline = false;
    if (this.store.getState().view === 'room') void this.retry();
  };
  retry = async () => {
    this.retries = 0;
    this.store.setState({ error: null });
    if (!this.store.getState().identity) await this.resume();
    else await this.reconnect();
  };
  private async reconnect() {
    if (this.stopped || this.recovering) return;
    const { saved } = this.store.getState();
    if (!saved) return;
    const epoch = this.epoch;
    this.recovering = true;
    this.store.setState({ connection: 'reconnecting' });
    try {
      const snapshot = await api.snapshot(saved.roomId);
      if (this.stopped || epoch !== this.epoch) return;
      this.store.setState({ snapshot });
      this.openSocket(saved.roomId);
    } catch (error) {
      if (this.stopped || epoch !== this.epoch) return;
      if (
        error instanceof ApiError &&
        [
          'SESSION_REQUIRED',
          'SESSION_EXPIRED',
          'ROOM_NOT_FOUND',
          'ROOM_EXPIRED',
        ].includes(error.code)
      ) {
        this.clearPending();
        this.save(null);
        this.store.setState({
          connection: 'expired',
          error: friendlyError(error.code),
        });
      } else this.scheduleRetry();
    } finally {
      if (epoch === this.epoch) this.recovering = false;
    }
  }
  private scheduleRetry() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    if (this.retries >= 6) {
      this.store.setState({
        connection: 'offline',
        error:
          'The connection was lost. Your seat is saved; reconnect when you are ready.',
      });
      return;
    }
    this.store.setState({ connection: 'reconnecting' });
    this.retryTimer = setTimeout(
      () => {
        void this.reconnect();
      },
      Math.min(500 * 2 ** this.retries++, 8000),
    );
  }
  private openSocket(roomId: string) {
    if (this.stopped) return;
    clearTimeout(this.connectTimer);
    clearTimeout(this.retryTimer);
    clearTimeout(this.syncTimer);
    const previous = this.socket;
    this.socket = null;
    previous?.close();
    const socket = new WebSocket(socketUrl(roomId));
    this.socket = socket;
    this.syncing = false;
    this.store.setState({
      connection: this.retries > 0 ? 'reconnecting' : 'connecting',
    });
    this.connectTimer = setTimeout(() => socket.close(), 8000);
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.stopped) return;
      try {
        this.receive(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        this.store.setState({
          error: 'Could not read the table update. Reconnecting…',
        });
        socket.close();
      }
    };
    socket.onerror = () => {
      /* close triggers bounded reconnection; never log payloads. */
    };
    socket.onclose = (event) => {
      if (this.socket !== socket || this.stopped) return;
      this.socket = null;
      clearTimeout(this.connectTimer);
      clearTimeout(this.actionTimer);
      if (event.code === 4001 || event.code === 1008) {
        this.store.setState({
          connection:
            event.reason === 'Session expired' ? 'expired' : 'offline',
          error:
            event.code === 4001
              ? 'This table is open in another tab. Reconnect here to move it back.'
              : event.reason === 'Session expired'
                ? friendlyError('SESSION_EXPIRED')
                : 'Connection paused. Try reconnecting in a few seconds.',
        });
      } else this.scheduleRetry();
    };
  }
  private receive(message: ServerMessage) {
    const state = this.store.getState();
    if (message.roomId !== state.saved?.roomId) return;
    if (message.type === 'snapshot') {
      if (message.you.actorId !== state.identity?.actorId) return;
      if (state.snapshot && message.version < state.snapshot.version) return;
      clearTimeout(this.connectTimer);
      clearTimeout(this.syncTimer);
      this.retries = 0;
      this.syncing = false;
      this.store.setState({
        snapshot: message,
        connection: 'online',
        busy: false,
      });
      if (this.pendingAction) this.transmitPending();
    } else if (message.type === 'event') {
      if (!state.snapshot) {
        this.requestSync();
        return;
      }
      const snapshot = applyEvent(state.snapshot, message);
      if (!snapshot) this.requestSync();
      else this.store.setState({ snapshot });
    } else if (message.type === 'ack') {
      if (message.actionId === this.pendingAction?.wire.actionId)
        this.clearPending();
    } else if (message.type === 'error') {
      const type = this.pendingAction?.wire.type;
      if (message.actionId === this.pendingAction?.wire.actionId)
        this.clearPending();
      this.store.setState({ error: friendlyError(message.code, type) });
      if (
        message.code === 'VERSION_CONFLICT' ||
        message.code === 'INVALID_GAME_ACTION'
      )
        this.requestSync();
    }
  }
  private requestSync() {
    const { identity, snapshot, saved } = this.store.getState();
    if (
      this.syncing ||
      !identity ||
      !saved ||
      this.socket?.readyState !== WebSocket.OPEN
    )
      return;
    this.syncing = true;
    this.store.setState({ connection: 'reconnecting' });
    const socket = this.socket;
    this.syncTimer = setTimeout(() => {
      if (this.socket === socket) socket.close();
    }, 5000);
    this.socket.send(
      JSON.stringify({
        roomId: saved.roomId,
        actorId: identity.actorId,
        actionId: crypto.randomUUID(),
        expectedVersion: snapshot?.version ?? 0,
        type: 'sync',
        payload: {},
      }),
    );
  }
  act = (action: GameAction) => {
    const state = this.store.getState();
    if (
      state.connection !== 'online' ||
      !state.snapshot ||
      !state.identity ||
      this.pendingAction ||
      this.socket?.readyState !== WebSocket.OPEN
    )
      return;
    const wire = {
      ...action,
      actorId: state.identity.actorId,
      roomId: state.snapshot.roomId,
      actionId: crypto.randomUUID(),
      expectedVersion: state.snapshot.version,
    } as ClientCommand;
    this.pendingAction = { wire, tries: 0 };
    this.store.setState({ pending: true, error: null, notice: null });
    this.transmitPending();
  };
  private transmitPending() {
    const pending = this.pendingAction;
    if (!pending || this.socket?.readyState !== WebSocket.OPEN) return;
    clearTimeout(this.actionTimer);
    if (pending.tries >= 3) {
      this.clearPending();
      this.store.setState({
        error:
          'The move could not be confirmed. Your table has been refreshed.',
      });
      this.requestSync();
      return;
    }
    pending.tries++;
    this.socket.send(JSON.stringify(pending.wire));
    this.actionTimer = setTimeout(() => this.transmitPending(), 5000);
  }
  notice = (notice: string) => this.store.setState({ notice });
}

import { createStore } from 'zustand/vanilla';
import type { MatchmakingMessage, RoomDescriptor } from '@omi/shared';
import { apiBase } from './api';
export class MatchmakingClient {
  readonly store = createStore<{
    status: 'idle' | 'connecting' | 'waiting' | 'offline' | 'error';
    waiting: number;
    error: string | null;
  }>(() => ({ status: 'idle', waiting: 0, error: null }));
  private socket: WebSocket | null = null;
  private wanted = false;
  private retries = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  constructor(private matched: (room: RoomDescriptor) => void) {}
  start = () => {
    if (this.wanted) return;
    this.wanted = true;
    this.retries = 0;
    this.open();
  };
  private open() {
    if (!this.wanted) return;
    clearTimeout(this.timer);
    if (this.socket) return;
    if (!navigator.onLine) {
      this.store.setState({ status: 'offline', waiting: 0 });
      return;
    }
    const url = new URL(`${apiBase}/matchmaking/ws`, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    this.store.setState({ status: 'connecting', waiting: 0, error: null });
    this.deadline = setTimeout(() => socket.close(), 8000);
    socket.onmessage = (event) => {
      if (this.socket !== socket || !this.wanted) return;
      try {
        const message = JSON.parse(String(event.data)) as MatchmakingMessage;
        clearTimeout(this.deadline);
        if (message.type === 'waiting') {
          this.retries = 0;
          this.store.setState({
            status: 'waiting',
            waiting: message.waiting,
            error:
              message.blocked === 'ROOM_CAPACITY'
                ? 'Tables are currently full. You remain in the waiting queue.'
                : null,
          });
        }
        if (message.type === 'matched') {
          this.stop();
          this.matched(message.room);
        }
        if (message.type === 'cancelled') this.stop();
        if (message.type === 'error') {
          if (message.code === 'ROOM_CAPACITY')
            this.store.setState({
              error:
                'Tables are currently full. You remain in the waiting queue.',
            });
          else {
            this.stop();
            this.store.setState({
              status: 'error',
              error: 'The queue could not assign a table. Please try again.',
            });
          }
        }
      } catch {
        this.stop();
        this.store.setState({
          status: 'error',
          error: 'The queue could not be read. Please try again.',
        });
      }
    };
    socket.onerror = () => undefined;
    socket.onclose = (event) => {
      if (this.socket !== socket || !this.wanted) return;
      clearTimeout(this.deadline);
      this.socket = null;
      this.store.setState({ status: 'offline', waiting: 0 });
      if (event.code === 4001 || event.code === 1008 || this.retries >= 3) {
        this.wanted = false;
        this.store.setState({
          status: 'error',
          error:
            event.code === 4001
              ? 'The waiting queue moved to another tab.'
              : 'The queue disconnected. Check your sign-in and try again.',
        });
      } else
        this.timer = setTimeout(() => this.open(), 1000 * 2 ** this.retries++);
    };
  }
  online = () => {
    if (this.wanted && !this.socket) this.open();
  };
  offline = () => {
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.store.setState({ status: 'offline', waiting: 0 });
  };
  stop = () => {
    this.wanted = false;
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    const socket = this.socket;
    this.socket = null;
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: 'cancel' }));
    socket?.close();
    this.store.setState({ status: 'idle', waiting: 0, error: null });
  };
}

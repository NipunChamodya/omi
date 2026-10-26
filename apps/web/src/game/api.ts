import type { GuestIdentity, RoomDescriptor, Snapshot } from '@omi/shared';
export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
const configured = import.meta.env.VITE_API_URL as string | undefined;
export const apiBase = (configured || '/api').replace(/\/$/, '');
export function socketUrl(roomId: string): string {
  const url = new URL(
    `${apiBase}/rooms/${encodeURIComponent(roomId)}/ws`,
    window.location.origin,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
async function post<T>(
  path: string,
  payload: object,
  signal?: AbortSignal,
): Promise<T> {
  // Reuse the same body/action ID after uncertain HTTP delivery; never manufacture a second mutation.
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 10_000);
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new ApiError(
          typeof body === 'object' &&
            body !== null &&
            'code' in body &&
            typeof body.code === 'string'
            ? body.code
            : 'REQUEST_FAILED',
        );
      return body as T;
    } catch (error) {
      if (error instanceof ApiError || signal?.aborted || attempt >= 1)
        throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}
export const api = {
  session: (displayName: string, signal?: AbortSignal) =>
    post<GuestIdentity>('/transport/session', { displayName }, signal),
  create: (actorId: string, actionId: string, signal?: AbortSignal) =>
    post<RoomDescriptor>(
      '/rooms',
      { actorId, actionId, expectedVersion: 0 },
      signal,
    ),
  preview: (code: string, signal?: AbortSignal) =>
    post<RoomDescriptor>('/rooms/preview', { code }, signal),
  join: (
    actorId: string,
    actionId: string,
    room: RoomDescriptor,
    signal?: AbortSignal,
  ) =>
    post<RoomDescriptor>(
      '/rooms/join',
      {
        actorId,
        actionId,
        roomId: room.roomId,
        code: room.code,
        expectedVersion: room.version,
      },
      signal,
    ),
  snapshot: (roomId: string, signal?: AbortSignal) =>
    post<Snapshot>('/rooms/snapshot', { roomId }, signal),
};

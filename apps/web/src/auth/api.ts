import { apiBase, ApiError } from '../game/api';
import type { AuthSession, PublicProfile } from '@omi/shared';
async function json<T>(
  path: string,
  payload: object,
  csrf?: string,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = (await response.json()) as unknown;
    if (!response.ok)
      throw new ApiError(
        body &&
          typeof body === 'object' &&
          'code' in body &&
          typeof body.code === 'string'
          ? body.code
          : 'REQUEST_FAILED',
      );
    return body as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export const authApi = {
  session: (signal?: AbortSignal) =>
    json<AuthSession>('/auth/session', {}, undefined, signal),
  start: (returnTo: string) =>
    json<{ url: string }>('/auth/google/start', { returnTo }),
  logout: (csrf: string) => json<{ ok: true }>('/auth/logout', {}, csrf),
  rename: (name: string, version: number, csrf: string) =>
    json<PublicProfile>(
      '/profile',
      { displayName: name, expectedVersion: version },
      csrf,
    ),
  remove: (version: number, csrf: string) =>
    json<PublicProfile>(
      '/profile/avatar/remove',
      { expectedVersion: version },
      csrf,
    ),
  upload: async (
    file: File,
    crop: { x: number; y: number; size: number },
    version: number,
    csrf: string,
  ): Promise<PublicProfile> => {
    const body = new FormData();
    body.append('expectedVersion', String(version));
    body.append('crop', JSON.stringify(crop));
    body.append('avatar', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${apiBase}/profile/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf },
        body,
        signal: controller.signal,
      });
      const result = (await response.json()) as unknown;
      if (!response.ok)
        throw new ApiError(
          result &&
            typeof result === 'object' &&
            'code' in result &&
            typeof result.code === 'string'
            ? result.code
            : 'UPLOAD_FAILED',
        );
      return result as PublicProfile;
    } finally {
      clearTimeout(timer);
    }
  },
};
export function avatarSource(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return value.startsWith('/avatars/') ? `${apiBase}${value}` : value;
}

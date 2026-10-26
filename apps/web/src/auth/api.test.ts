import { afterEach, expect, it, vi } from 'vitest';
import { authApi } from './api';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('aborts a stalled authentication bootstrap after fifteen seconds', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    ),
  );
  const result = authApi.session().catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await result).toBeInstanceOf(DOMException);
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('retries uncertain HTTP delivery using the identical action ID/body and credentialed requests', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('network'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomId: 'room' }),
    });
  vi.stubGlobal('fetch', fetcher);
  await api.create('actor', 'stable-action');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]![1].body).toBe(fetcher.mock.calls[1]![1].body);
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).actionId).toBe(
    'stable-action',
  );
  expect(fetcher.mock.calls[0]![1].credentials).toBe('include');
});
it('bounds a stalled request to two ten-second attempts and cleans its timeout', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url: unknown, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const request = api.snapshot('room');
  const rejected = expect(request).rejects.toThrow('Aborted');
  await vi.advanceTimersByTimeAsync(20_000);
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it('aborts navigation-cancelled requests without retrying', async () => {
  const fetcher = vi.fn(
    (_url: unknown, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  const request = api.session('Player', controller.signal);
  const rejected = expect(request).rejects.toThrow('Aborted');
  controller.abort();
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
});

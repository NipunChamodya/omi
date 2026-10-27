import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { pwa } from './pwa';
it('generates a bounded static-only worker with safe lifecycle and valid syntax', async () => {
  let source = '';
  const plugin = pwa();
  const hook = plugin.generateBundle;
  if (typeof hook !== 'function')
    throw new Error('Expected generateBundle hook');
  await Reflect.apply(
    hook,
    {
      emitFile: (file: { source: string }) => {
        source = file.source;
      },
    },
    [
      {},
      {
        entry: {
          type: 'chunk',
          fileName: 'assets/index-123.js',
          isEntry: true,
          viteMetadata: { importedCss: new Set(['assets/index-123.css']) },
        },
        lazy: {
          type: 'chunk',
          fileName: 'assets/voice-123.js',
          isEntry: false,
        },
        css: { type: 'asset', fileName: 'assets/index-123.css' },
        theme: { type: 'asset', fileName: 'assets/royal-123.css' },
        music: { type: 'asset', fileName: 'assets/song-123.mp3' },
      },
      false,
    ],
  );
  const handlers = new Map<string, (event: unknown) => void>();
  const put: string[] = [];
  const cached: string[][] = [];
  const removed: string[] = [];
  const pending: Promise<unknown>[] = [];
  const cache = {
    addAll: async (paths: string[]) => {
      cached.push(paths);
    },
    match: async (key: Request | string) =>
      key === '/offline.html' ? new Response('offline') : undefined,
    put: async (request: Request) => {
      put.push(request.url);
    },
  };
  runInNewContext(source, {
    self: {
      location: { origin: 'https://omi.example' },
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        handlers.set(type, handler),
    },
    caches: {
      open: async () => cache,
      keys: async () => ['omi-static-old', 'unrelated-app-cache'],
      delete: async (key: string) => {
        removed.push(key);
      },
    },
    URL,
    fetch: async () => ({
      ok: true,
      type: 'basic',
      headers: new Headers({ 'content-type': 'application/javascript' }),
      clone: () => new Response('module'),
    }),
  });
  handlers.get('install')!({
    waitUntil: (task: Promise<unknown>) => pending.push(task),
  });
  handlers.get('activate')!({
    waitUntil: (task: Promise<unknown>) => pending.push(task),
  });
  await Promise.all(pending);
  expect(cached[0]).toEqual([
    '/offline.html',
    '/offline.css',
    '/assets/index-123.js',
    '/assets/index-123.css',
  ]);
  expect(removed).toEqual(['omi-static-old']);
  function fetchEvent(path: string, method = 'GET') {
    let response: Promise<unknown> | undefined;
    handlers.get('fetch')!({
      request: new Request(`https://omi.example${path}`, { method }),
      respondWith: (value: Promise<unknown>) => {
        response = value;
      },
    });
    return response;
  }
  for (const path of [
    '/api/auth/session',
    '/api/avatars/private.webp',
    '/assets/song-123.mp3',
    '/assets/unknown.js',
    '/assets/index-123.js?token=secret',
  ])
    expect(fetchEvent(path)).toBeUndefined();
  expect(fetchEvent('/assets/index-123.js', 'POST')).toBeUndefined();
  await fetchEvent('/assets/voice-123.js');
  expect(put).toEqual(['https://omi.example/assets/voice-123.js']);
  expect(source).not.toMatch(/self\.(skipWaiting|clients\.claim)\(/);
});

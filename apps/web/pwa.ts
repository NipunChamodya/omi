import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Generated from this build only. No arbitrary runtime URLs enter the cache.
export function pwa(): Plugin {
  return {
    name: 'omi-static-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle);
      const assets = files
        .map((file) => '/' + file.fileName)
        .filter((path) => /^\/assets\/[^/]+\.(?:js|css)$/.test(path));
      const entry = files.filter(
        (file) => file.type === 'chunk' && file.isEntry,
      );
      const initial = [
        '/offline.html',
        '/offline.css',
        ...entry.map((file) => '/' + file.fileName),
        ...entry.flatMap((file) =>
          [
            ...((
              file as typeof file & {
                viteMetadata?: { importedCss: Set<string> };
              }
            ).viteMetadata?.importedCss ?? []),
          ].map((path) => '/' + path),
        ),
      ];
      const version = createHash('sha256')
        .update(JSON.stringify(assets))
        .update(readFileSync(new URL('./public/offline.html', import.meta.url)))
        .update(readFileSync(new URL('./public/offline.css', import.meta.url)))
        .digest('hex')
        .slice(0, 16);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = 'omi-static-${version}';
const ALLOWED = new Set(${JSON.stringify([...assets, '/offline.html', '/offline.css'])});
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(${JSON.stringify(initial)})));
});
// Deliberately no skipWaiting or clients.claim: never replace a live table.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('omi-static-') && key !== CACHE)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // OAuth callbacks and every API request always use the network.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/offline.html'))));
    return;
  }
  if (url.search || !ALLOWED.has(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' &&
        ['text/css', 'application/javascript', 'text/javascript'].includes((response.headers.get('content-type') || '').split(';')[0])) {
      try { await cache.put(request, response.clone()); } catch { /* Quota limits must not break online loading. */ }
    }
    return response;
  }));
});
`,
      });
    },
  };
}

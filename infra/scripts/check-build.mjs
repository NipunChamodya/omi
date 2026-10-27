// Repeatable local size/privacy smoke gate; not a substitute for a mobile benchmark.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../apps/web/dist', import.meta.url));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const scripts = [
  ...html.matchAll(/<script\b[^>]*\bsrc="(\/assets\/[^"/]+\.js)"/g),
].map((match) => match[1]);
const styles = [
  ...html.matchAll(/<link\b[^>]*\bhref="(\/assets\/[^"/]+\.css)"/g),
].map((match) => match[1]);
if (
  scripts.length !== 1 ||
  styles.length === 0 ||
  /@vite|src\/main\.tsx|unsafe-inline|unsafe-eval/.test(html)
)
  throw new Error('Unexpected production entry/security markup');
const size = (paths) =>
  paths.reduce(
    (total, path) =>
      total + gzipSync(readFileSync(resolve(root, '.' + path))).length,
    0,
  );
const entryJsGzip = size(scripts),
  entryCssGzip = size(styles);
if (
  entryJsGzip > 90 * 1024 ||
  entryCssGzip > 12 * 1024 ||
  entryJsGzip + entryCssGzip > 100 * 1024
)
  throw new Error(
    'Initial gzip budget exceeded (JS 90KiB, CSS 12KiB, combined 100KiB)',
  );
const assets = readdirSync(resolve(root, 'assets'));
if (assets.some((path) => path.endsWith('.map')))
  throw new Error('Unexpected public source map');
for (const path of assets.filter((path) => path.endsWith('.js'))) {
  if (
    /GOOGLE_CLIENT_SECRET|AWS_SECRET_ACCESS_KEY|better-sqlite3|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(
      readFileSync(resolve(root, 'assets', path), 'utf8'),
    )
  )
    throw new Error('Server-only marker in frontend output');
}
console.log(
  JSON.stringify(
    {
      entryJsGzipBytes: entryJsGzip,
      entryCssGzipBytes: entryCssGzip,
      combinedGzipBytes: entryJsGzip + entryCssGzip,
      limitsKiB: { js: 90, css: 12, combined: 100 },
      publicSourceMaps: 0,
      serverMarkerSmokeCheck: 'passed',
    },
    null,
    2,
  ),
);

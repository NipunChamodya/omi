import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function safe(value) {
  const text = String(value);
  if (/["'\\$;{}\r\n]/.test(text))
    throw new Error('Unsupported configuration characters');
  return text;
}
export function origin(value, local = false) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(local && url.protocol === 'http:' && url.hostname === '127.0.0.1'))
  )
    throw new Error('An exact HTTPS public origin is required');
  return url;
}
export function port(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1024 || number > 65535)
    throw new Error('Invalid unprivileged port');
  return number;
}
export function renderConfig({
  runtime,
  staticRoot,
  mimeTypes,
  proxyPort,
  backendPort,
  publicOrigin,
  locked = false,
  local = false,
  directTls,
}) {
  if (directTls && (locked || local))
    throw new Error('Direct TLS requires the production profile');
  if (locked)
    return `worker_processes 1; daemon off; pid "${safe(runtime)}/nginx.pid"; error_log stderr crit; events { worker_connections 64; } http { access_log off; server_tokens off; server { listen 127.0.0.1:${port(proxyPort)}; server_name _; add_header Cache-Control no-store always; location = /_omi/health { default_type application/json; return 200 '{"status":"awaiting-oauth-registration"}'; } location / { return 503; } } }`;
  const url = origin(publicOrigin, local);
  if (
    directTls &&
    (url.port ||
      !/^(?:[a-z0-9][a-z0-9-]*\.)+[a-z0-9][a-z0-9-]*$/.test(url.hostname) ||
      ![directTls.certificate, directTls.key].every(
        (path) => typeof path === 'string' && path.startsWith('/'),
      ))
  )
    throw new Error(
      'Direct TLS requires a DNS origin on port 443 and absolute certificate paths',
    );
  const listener = directTls ? '443 ssl' : `127.0.0.1:${port(proxyPort)}`;
  const edge = directTls
    ? ''
    : [
        '    set_real_ip_from 127.0.0.1;',
        '    real_ip_header CF-Connecting-IP;',
        '    real_ip_recursive off;',
      ].join('\n');
  const tls = directTls
    ? [
        `        ssl_certificate "${safe(directTls.certificate)}";`,
        `        ssl_certificate_key "${safe(directTls.key)}";`,
        '        ssl_protocols TLSv1.2 TLSv1.3;',
      ].join('\n')
    : '';
  const values = {
    RUNTIME: resolve(runtime),
    STATIC_ROOT: resolve(staticRoot),
    MIME_TYPES: resolve(mimeTypes),
    BACKEND_PORT: port(backendPort),
    PUBLIC_HOST: url.hostname,
    PUBLIC_SCHEME: url.protocol.slice(0, -1),
  };
  return readFileSync(
    resolve(root, 'infra/nginx/omi-testing.conf'),
    'utf8',
  ).replace(/@([A-Z_]+)@/g, (_, key) => {
    switch (key) {
      case 'EDGE_TRUST':
        return edge;
      case 'DEFAULT_LISTENER':
        return `listen ${listener} default_server;`;
      case 'DEFAULT_ACTION':
        return directTls ? 'ssl_reject_handshake on;' : 'return 404;';
      case 'APP_LISTENER':
        return `listen ${listener};`;
      case 'TLS_SETTINGS':
        return tls;
      default:
        return safe(values[key]);
    }
  });
}
export function quickUrl(line) {
  return line.match(
    /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/,
  )?.[0];
}

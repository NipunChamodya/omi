import { randomBytes } from 'node:crypto';
import type { Plugin } from 'vite';

const placeholder = '__OMI_CSP_NONCE__';
export function contentSecurityPolicy(
  development: boolean,
  nonce: string,
  api?: string,
) {
  const connections = ["'self'"];
  const images = ["'self'", 'blob:', 'https://lh3.googleusercontent.com'];
  if (api && /^https?:\/\//.test(api)) {
    const url = new URL(api);
    if (
      url.username ||
      url.password ||
      (!development && url.protocol !== 'https:')
    )
      throw new Error(
        'VITE_API_URL must use HTTPS without credentials in production',
      );
    connections.push(url.origin, url.origin.replace(/^http/, 'ws'));
    images.push(url.origin);
  }
  if (development)
    connections.push('ws://127.0.0.1:5173', 'ws://localhost:5173');
  return [
    "default-src 'none'",
    `script-src 'self'${development ? ` 'nonce-${nonce}'` : ''}`,
    `style-src 'self'${development ? ` 'nonce-${nonce}'` : ''}`,
    "script-src-attr 'none'",
    "style-src-attr 'none'",
    `connect-src ${connections.join(' ')}`,
    `img-src ${images.join(' ')}`,
    "font-src 'self'",
    "media-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}
export function frontendSecurity(development: boolean, api?: string): Plugin {
  return {
    name: 'omi-frontend-security',
    config: () => (development ? { html: { cspNonce: placeholder } } : {}),
    configureServer(server) {
      if (!development) return;
      server.middlewares.use((req, res, next) => {
        // Replace after Vite injects its refresh/client tags, not before.
        delete req.headers['if-none-match'];
        const end = res.end;
        res.end = ((...args: unknown[]) => {
          if (
            String(res.getHeader('Content-Type')).includes('text/html') &&
            (typeof args[0] === 'string' || args[0] instanceof Uint8Array)
          ) {
            const html =
              typeof args[0] === 'string'
                ? args[0]
                : Buffer.from(args[0]).toString('utf8');
            args[0] = html.replaceAll(
              placeholder,
              randomBytes(24).toString('base64'),
            );
            res.removeHeader('ETag');
            res.setHeader(
              'Content-Length',
              Buffer.byteLength(args[0] as string),
            );
          }
          return Reflect.apply(end, res, args);
        }) as typeof res.end;
        next();
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const nonce = development ? placeholder : '';
        return {
          html: html.replaceAll(placeholder, nonce),
          tags: [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: contentSecurityPolicy(development, nonce, api),
              },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
  };
}

import { isAbsolute } from 'node:path';
import { renderConfig } from '../scripts/config.mjs';

const [publicOrigin, staticRoot, certificate, key] = process.argv.slice(2);
if (
  !publicOrigin ||
  !staticRoot ||
  !certificate ||
  !key ||
  !isAbsolute(staticRoot)
)
  throw new Error(
    'Usage: render-nginx.mjs HTTPS_ORIGIN ABSOLUTE_DIST CERTIFICATE KEY',
  );
process.stdout.write(
  renderConfig({
    publicOrigin,
    staticRoot,
    runtime: '/run/omi-nginx',
    mimeTypes: '/etc/nginx/mime.types',
    backendPort: 3000,
    directTls: { certificate, key },
  }),
);

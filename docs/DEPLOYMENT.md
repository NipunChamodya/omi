# Deployment

## Current Stage J status

Stage J provides patched-runtime startup enforcement, a fail-closed read-only readiness command, security headers, operational monitoring, WAL-safe backup/restore tooling and an optional syntax-checked launchd template. Nothing has been publicly deployed or installed as a service. The current development environment intentionally fails production readiness; real Google/S3/TURN/HTTPS/phone/recovery checks remain open. See OPERATIONS.md for exact commands, process ownership and manual release gates; local tests are not approval to expose the app.

## Current Stage I status

Stage I uses existing same-origin fingerprinted CSS/SVG hosting and unchanged CSP. Deploy the complete compiled assets directory; do not prefetch all theme CSS. The service worker precaches entry styles only and caches eligible lazy CSS on demand. Browser-local choices are origin-specific and do not migrate between temporary tunnel hostnames. No deployment or Stage J work was performed. See THEMES.md.

## Current Stage H status

Serve the full compiled apps/web/dist at the origin root, including sw.js, manifest.webmanifest, icons and offline files. HTTPS is required publicly. NGINX revalidates worker/manifest, types the manifest explicitly and keeps immutable caching on fingerprinted assets. Preserve old fingerprinted files while older clients remain open. PWA registration is disabled in Vite development; loopback preview supports verification. No public deployment or Google hostname gate bypass is part of this stage. See PWA.md.

## Current Stage G status

Stage G requires additive migration 0001_stage-g-reports.sql and its journal entry, shipped alongside existing migrations. Existing accounts are preserved; reports stay outside the static directory. The NGINX allowlist now includes /api/rooms/:roomId/social/ws. Bundle and serve all fingerprinted MP3/WAV build assets with their normal MIME/range support; no external music endpoint or upload storage is needed. Keep the full frontend CSP including media-src self and existing header protections. Owner review uses the local reports:review CLI, never a public admin route. No public deployment or Stage J readiness was established.

## Current Stage F status

The NGINX allowlist now also proxies `/api/rooms/:roomId/voice/config` and `/api/rooms/:roomId/voice/ws`; the existing same-origin HTTPS/WSS setup is retained. No extra public application port is needed for signaling. WebRTC media is separate: Quick Tunnel HTTP forwarding does not provide STUN/TURN. Configure a reviewed reachable TURN service with server-only shared-secret REST credentials and appropriate TLS/UDP/TCP/firewall/quotas before claiming restrictive-network support. No public TURN service was provisioned; the installed coturn test runs only on loopback and must not be published. Google public callback registration remains unresolved. See VOICE.md.

## Current Stage E status

Stage E requires a durable SQLite volume and a private external S3-compatible bucket for custom avatars. Accounts/sessions now persist; game rooms/scores still disappear on restart and require one backend process. Ship migrations with dist, run the migration CLI and configure real Google credentials and exact HTTPS callback URL. Account cookies use SameSite=Lax with Secure host-only production scope; keep frontend/API same-site or use a same-origin proxy. Proxy /api and WebSocket upgrades; allow callback and public image GET routes. Account mutation requests require exact Origin and CSRF. Guest mode is development-only. Native SQLite and Sharp binaries must support the deployment OS/architecture. Live Google, IAM, backups, monitoring, TLS and production deployment have not been verified. Do not deploy the E2E fixture. See ACCOUNTS.md for setup. Historical stage notes below describe earlier implementations.

**Local foundation, engine, multiplayer backend and mobile browser flow verified; production deployment remains Stage J.**

Build with `npm ci && npm run build`. Frontend output is `apps/web/dist`, suitable for static hosting. Run the backend with `npm run start -w @omi/server` after building. Supply HOST, PORT and NODE_ENV through the deployment environment; use HOST=0.0.0.0 only when external binding is intended. Health probe: GET `/health`.

Backend requires a persistent Node 22 host. Future sockets require proxy WebSocket upgrades; HTTPS/WSS termination, timeouts, origin rules, backups and monitoring remain to be configured and verified. SQLite requires durable storage; avatars require external persistent object storage. Nothing has been deployed. No service worker, database, migration runner, TURN server or production auth is configured in Stage A.

Stage B added the engine library; Stage C integrates it inside local server room/socket handlers. Nothing has been deployed. Build output for the engine is `packages/game-engine/dist`; it must stay in the trusted backend boundary when integrated later. A deployment must supply secure entropy, durable ledger/state ownership, and owner-confirmed policies before enabling affected game paths.

## Stage C hosting constraints

Use one persistent Node process for rooms. Current sessions, rooms, scores and idempotency records are in memory and are lost on restart; do not distribute requests across independent instances. No database-based room recovery, backups or durable user identity exists yet.

Set APP_ORIGIN to the exact browser HTTP(S) origin, with no trailing slash/path; production requires HTTPS. Frontend and API must be same-site for Strict cookies (custom app/api subdomains or a same-origin reverse proxy). Browsers need credentialed requests. The backend emits exact-origin credentialed CORS headers; all multiplayer reads, writes and WebSocket upgrades reject missing/foreign Origin. Cookie credentials must not be put in query strings. Use separate cookie jars/contexts when testing four identities.

Production must terminate HTTPS/WSS, proxy WebSocket upgrade requests, preserve heartbeat traffic and configure timeouts/connection limits. Fastify currently uses direct peer IP; trusted-proxy configuration and suitable shared-IP rate limits must be reviewed before hosting behind a proxy. Application queue/room/frame/receipt limits do not replace edge-level limits or load testing. The Stage C default reaches one round's result; subsequent rounds and manual reports remain gated on unresolved owner policies.

No Stage J deployment configuration, monitoring or production certification is being claimed.

## Stage D frontend/API configuration

Frontend development defaults to `/api` through Vite's HTTP/WebSocket proxy, targeting port 3000. `apps/web/.env.example` documents public VITE_API_URL and server-only development API_PROXY_TARGET. The UI uses credentialed POST read equivalents so mandatory browser Origin checks remain intact. No credential is in VITE_ variables or invitation URLs.

A static production build does not include Vite's dev proxy. Configure a real same-origin reverse proxy stripping `/api` and forwarding WebSocket upgrades, or set VITE_API_URL to a same-site HTTPS API at build time and align APP_ORIGIN with the frontend. Google credentials/authentication infrastructure are not part of Stage D. Rooms/sessions remain ephemeral and the unresolved dealer/report policies remain disabled. The browser's sessionStorage metadata cannot recover a restarted backend.

Playwright uses backend port 3100/front port 5173 with isolated test clients and refuses to reuse unrelated running servers. These local test fixtures are not a deployment configuration.

## Free remote-testing milestone

The implemented supervisor and standalone NGINX template are documented in CLOUDFLARE_MULTIPLAYER_SETUP.md. They use compiled static assets, a loopback production backend with tightly scoped proxy trust, preserved SQLite and a maintenance-gated Quick Tunnel. Do not expose Vite or test fixtures. Public Google login and four external devices are not verified; the observed generated callback received redirect_uri_mismatch. This infrastructure task does not complete Stage J or establish production readiness.

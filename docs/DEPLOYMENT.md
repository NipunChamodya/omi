# Deployment

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

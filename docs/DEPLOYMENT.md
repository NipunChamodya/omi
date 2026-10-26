# Deployment

**Local foundation, engine and four-client multiplayer backend verified; production deployment is planned for Stage J.**

Build with `npm ci && npm run build`. Frontend output is `apps/web/dist`, suitable for static hosting. Run the backend with `npm run start -w @omi/server` after building. Supply HOST, PORT and NODE_ENV through the deployment environment; use HOST=0.0.0.0 only when external binding is intended. Health probe: GET `/health`.

Backend requires a persistent Node 22 host. Future sockets require proxy WebSocket upgrades; HTTPS/WSS termination, timeouts, origin rules, backups and monitoring remain to be configured and verified. SQLite requires durable storage; avatars require external persistent object storage. Nothing has been deployed. No service worker, database, migration runner, TURN server or production auth is configured in Stage A.

Stage B added the engine library; Stage C integrates it inside local server room/socket handlers. Nothing has been deployed. Build output for the engine is `packages/game-engine/dist`; it must stay in the trusted backend boundary when integrated later. A deployment must supply secure entropy, durable ledger/state ownership, and owner-confirmed policies before enabling affected game paths.

## Stage C hosting constraints

Use one persistent Node process for rooms. Current sessions, rooms, scores and idempotency records are in memory and are lost on restart; do not distribute requests across independent instances. No database-based room recovery, backups or durable user identity exists yet.

Set APP_ORIGIN to the exact browser HTTP(S) origin, with no trailing slash/path; production requires HTTPS. Frontend and API must be same-site for Strict cookies (custom app/api subdomains or a same-origin reverse proxy). Browsers need credentialed requests. The backend emits exact-origin credentialed CORS headers; all multiplayer reads, writes and WebSocket upgrades reject missing/foreign Origin. Cookie credentials must not be put in query strings. Use separate cookie jars/contexts when testing four identities.

Production must terminate HTTPS/WSS, proxy WebSocket upgrade requests, preserve heartbeat traffic and configure timeouts/connection limits. Fastify currently uses direct peer IP; trusted-proxy configuration and suitable shared-IP rate limits must be reviewed before hosting behind a proxy. Application queue/room/frame/receipt limits do not replace edge-level limits or load testing. The Stage C default reaches one round's result; subsequent rounds and manual reports remain gated on unresolved owner policies.

No Stage J deployment configuration, monitoring or production certification is being claimed.

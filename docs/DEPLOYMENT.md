# Deployment

**Local foundation and standalone engine verified only; production deployment is planned for Stage J.**

Build with `npm ci && npm run build`. Frontend output is `apps/web/dist`, suitable for static hosting. Run the backend with `npm run start -w @omi/server` after building. Supply HOST, PORT and NODE_ENV through the deployment environment; use HOST=0.0.0.0 only when external binding is intended. Health probe: GET `/health`.

Backend requires a persistent Node 22 host. Future sockets require proxy WebSocket upgrades; HTTPS/WSS termination, timeouts, origin rules, backups and monitoring remain to be configured and verified. SQLite requires durable storage; avatars require external persistent object storage. Nothing has been deployed. No service worker, database, migration runner, TURN server or production auth is configured in Stage A.

Stage B adds only a library: no engine endpoints or gameplay server are deployed. Build output for the engine is `packages/game-engine/dist`; it must stay in the trusted backend boundary when integrated later. A deployment must supply secure entropy, durable ledger/state ownership, and owner-confirmed policies before enabling affected game paths.

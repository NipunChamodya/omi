# OMI

A lightweight, mobile-first Sri Lankan card game for four friends.

**Status: Stage E authentication and profiles implemented and locally verified. Google OIDC, durable SQLite accounts/sessions, profile editing and private S3-backed avatar processing are included. Live Google/S3 verification requires owner configuration. Voice chat remains Stage F and is not implemented.**

## Local setup

Use Node 22 (see `.nvmrc`) and npm 10.

```sh
npm ci
npm run build
cp .env.example apps/server/.env
npm run dev:server
```

In a second terminal, run `npm run dev:web`. Open http://127.0.0.1:5173.
The API health endpoint is http://127.0.0.1:3000/health. The browser connects to the backend through the Vite development proxy at `/api`. Run both processes to play.
`npm run build` builds shared packages before apps; run it before starting the server from a fresh checkout.
The server reads `.env` from its workspace directory. Set `APP_ORIGIN` to the exact browser origin (default `http://127.0.0.1:5173`). Multiplayer HTTP and WebSocket requests require that Origin and a valid account session. Configure Google credentials using [Accounts setup](docs/ACCOUNTS.md); without credentials sign-in is unavailable. For local guest gameplay only, explicitly set `ALLOW_GUESTS=true` (forbidden in production). Optional public API configuration is in `apps/web/.env.example`; default `/api` works with the local proxy. No secrets belong in frontend variables.

To play locally, use four independent browser profiles/isolated contexts or four devices with a correctly hosted HTTPS deployment. Four tabs sharing one cookie are the same player; opening the same table in another tab replaces the older connection. For automated local testing, Playwright creates four isolated mobile browser contexts automatically.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

`npm test` now binds ephemeral loopback ports for real four-client integration tests. Sandboxed environments must allow local listening; tests do not skip this requirement. For just multiplayer integration, run `npm test -- apps/server/src/multiplayer/multiplayer.test.ts`.

Accounts, sessions and profile metadata persist in SQLite; avatars persist in external object storage. Rooms and scores are in memory and disappear on server restart. One round can finish with confirmed scoring; continuing to another round requires owner clarification of dealer rotation. Accusations and no-trump reporting remain unresolved by default. Invite links open the join form. Home navigation keeps the seat reserved; there is no server leave/forfeit action.

## Workspace

- `apps/web`: React/Vite mobile home, invite/join, lobby, table and results, with Zustand public projections and bounded reconnection.
- `apps/server`: Fastify health API and authoritative private rooms/WebSockets, durable Google account sessions and opt-in development guests, serialized actions, versioning and recipient-specific resynchronization.
- `packages/shared`: public infrastructure and multiplayer wire contracts; no engine-private state.
- `packages/game-engine`: dependency-free, server-private OMI rules engine with deterministic transitions and tested rule-clarification gates.
- `docs`: architecture, owner rules, unresolved decisions, testing and operations.

Development stops after each authorized stage. Stage F requires explicit owner authorization.
See [Stage E report](docs/STAGE_E_REPORT.md), [Accounts setup](docs/ACCOUNTS.md), [Stage D report](docs/STAGE_D_REPORT.md), [UI guide](docs/UI.md), [multiplayer protocol](docs/MULTIPLAYER.md), [engine API](docs/ENGINE.md), and [owner rules](docs/OWNER_RULES.md).

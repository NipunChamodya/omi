# OMI

A lightweight, mobile-first Sri Lankan card game for four friends.

**Status: Stage C multiplayer backend implemented and tested with four real WebSocket clients. The frontend remains the foundation shell; mobile game UI is Stage D. Unresolved rule-dependent paths remain gated.**

## Local setup

Use Node 22 (see `.nvmrc`) and npm 10.

```sh
npm ci
npm run build
cp .env.example apps/server/.env
npm run dev:server
```

In a second terminal, run `npm run dev:web`. Open http://127.0.0.1:5173.
The API health endpoint is http://127.0.0.1:3000/health. The shell is static and does not require the API.
`npm run build` builds shared packages before apps; run it before starting the server from a fresh checkout.
The server reads `.env` from its workspace directory. Set `APP_ORIGIN` to the exact browser origin (default `http://127.0.0.1:5173`). Multiplayer HTTP and WebSocket requests require that Origin and a temporary guest transport cookie. Google login remains Stage E. No secrets belong in frontend variables.

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

Rooms, sessions and scores are in memory and disappear on server restart. One round can finish with confirmed scoring; continuing to another round requires owner clarification of dealer rotation. Accusations and no-trump reporting remain unresolved by default. Invitation paths are returned by the backend; the browser join flow arrives in Stage D.

## Workspace

- `apps/web`: React, Vite, Tailwind mobile shell; Zustand installed for later UI state.
- `apps/server`: Fastify health API and authoritative private rooms/WebSockets, guest transport identities, serialized actions, versioning and recipient-specific resynchronization.
- `packages/shared`: public infrastructure and multiplayer wire contracts; no engine-private state.
- `packages/game-engine`: dependency-free, server-private OMI rules engine with deterministic transitions and tested rule-clarification gates.
- `docs`: architecture, owner rules, unresolved decisions, testing and operations.

Development stops after each authorized stage. Stage D requires explicit owner authorization.
See [Stage C report](docs/STAGE_C_REPORT.md), [multiplayer protocol](docs/MULTIPLAYER.md), [engine API](docs/ENGINE.md), and [owner rules](docs/OWNER_RULES.md).

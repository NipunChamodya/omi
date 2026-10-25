# OMI

A lightweight, mobile-first Sri Lankan card game for four friends.

**Status: Stage A foundation implemented. Gameplay and all later stages are planned, not implemented.**

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
The server reads `.env` from its workspace directory. No frontend environment variables or secrets are needed.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

## Workspace

- `apps/web`: React, Vite, Tailwind mobile shell; Zustand installed for later UI state.
- `apps/server`: Fastify health API, Zod environment validation, graceful shutdown.
- `packages/shared`: infrastructure contracts.
- `packages/game-engine`: dependency-free empty package boundary; no rules implemented.
- `docs`: architecture, owner rules, unresolved decisions, testing and operations.

Development stops after each authorized stage. Stage B requires explicit owner authorization.
See [Stage A report](docs/STAGE_A_REPORT.md) and [owner rules](docs/OWNER_RULES.md).

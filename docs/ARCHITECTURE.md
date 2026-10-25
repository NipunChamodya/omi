# Architecture

## Implemented in Stage A

npm workspaces with strict TypeScript: `apps/web`, `apps/server`, `packages/shared`, `packages/game-engine`. The root build script explicitly builds shared packages before apps. App packages are private; no package publishing is configured.

Web uses React, Vite and Tailwind. Zustand is installed but unused until stateful UI is authorized. The static mobile shell has semantic landmarks, safe-area spacing and reduced-motion CSS. No gameplay, login, room controls, WebSockets or audio are present.

Server uses Fastify and Zod. `buildApp` separates application construction from network startup for injection testing. Environment parsing rejects invalid ports and modes. GET `/health` returns only a public health contract. Logs redact authorization and cookies. Startup binds to loopback by default.

The engine package has no runtime dependencies or game logic. Shared infrastructure contracts contain no private game state.

## Planned

Stage B: pure deterministic engine. C: per-room serialized authoritative actions, deduplication, versions and recipient-specific snapshots. D: game UI. E: Google OIDC, server sessions, SQLite through a maintained query layer and migrations; permanent avatars in external storage. F: WebRTC and TURN. G: chat and local audio synchronization. H: PWA and data saver. I: replaceable lazy-loaded visual themes. J: deployment and hardening.

Persistence, schema migrations and ORM selection are deferred until a stage owns persistent data. The planned repository boundary must allow PostgreSQL later. No temporary hosting filesystem will store permanent avatars.

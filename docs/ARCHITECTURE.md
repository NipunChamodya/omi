# Architecture

## Implemented in Stage A

npm workspaces with strict TypeScript: `apps/web`, `apps/server`, `packages/shared`, `packages/game-engine`. The root build script explicitly builds shared packages before apps. App packages are private; no package publishing is configured.

Web uses React, Vite and Tailwind. Zustand is installed but unused until stateful UI is authorized. The static mobile shell has semantic landmarks, safe-area spacing and reduced-motion CSS. No gameplay, login, room controls, WebSockets or audio are present.

Server uses Fastify and Zod. `buildApp` separates application construction from network startup for injection testing. Environment parsing rejects invalid ports and modes. GET `/health` returns only a public health contract. Logs redact authorization and cookies. Startup binds to loopback by default.

Shared infrastructure contracts contain no private game state.

## Implemented in Stage B

The standalone engine has no runtime dependencies, I/O, clocks, implicit randomness or imports from React, Fastify, WebSockets, Node or browser APIs. Modules: cards/deck/seating, private round transitions, scoring ledger and manual accusations. Readonly state is transformed without mutating inputs. Trusted callers supply a bounded random-integer function for initial dealer selection and Fisher–Yates shuffle. Fixed entropy makes tests reproducible; production must use a cryptographically secure source.

Seats 0–3 increase counterclockwise, with teams {0,2} and {1,3}. This is an internal indexing convention, not a visual seating decision. A cut moves the first n cards to the bottom, with both piles nonempty. Four-card deal batches begin at the dealer's right and finish with the dealer. Trump validation occurs before the second batch.

All `PrivateRound` objects, including hands, original deals and play evidence, are server-private. The engine is not connected to either app and provides no wire protocol or player snapshots. Ledger entries distinguish point awards, single-draw carry, and accusation transfers. Entries prevent duplicate round settlement and duplicate payment for the same evidence within a ledger. No initial physical counter pool, score floor, victory threshold, normal dealer rotation, or unresolved bonus rules are invented.

Accusation windows and no-trump report timing/basis require trusted owner-confirmed policies. No production policy is installed. Restart requires a separately supplied shuffled deck, a new unique round ID and explicitly chosen replacement dealer. See ENGINE.md and RULE_CLARIFICATIONS.md.

## Planned

Stage C: per-room serialized authoritative actions, deduplication, versions and recipient-specific snapshots. D: game UI. E: Google OIDC, server sessions, SQLite through a maintained query layer and migrations; permanent avatars in external storage. F: WebRTC and TURN. G: chat and local audio synchronization. H: PWA and data saver. I: replaceable lazy-loaded visual themes. J: deployment and hardening.

Persistence, schema migrations and ORM selection are deferred until a stage owns persistent data. The planned repository boundary must allow PostgreSQL later. No temporary hosting filesystem will store permanent avatars.

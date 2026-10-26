# Architecture

## Current Stage I status

Stage I adds a frontend-only fixed theme registry, async selection store and native selector/preview. Classic and Royal use CSS faces and original generic SVG backs; rank/suit values and all engine/server actions stay unchanged. Preferences are browser-local. Same-origin styles load only on selection, with safe retry and stale-load protection. Entry-only PWA CSS precaching preserves lazy themes. See THEMES.md.

## Current Stage H status

A build-generated root service worker caches an exact static JS/CSS allowlist and generic offline page. It never caches API/player data or queues gameplay. Updates wait for old tabs to close. A small global Data Saver preference skips avatars and decorative motion and turns off locally enabled music/effects until explicit opt-in. Manifest, original PNG icons and iOS metadata support installation. See PWA.md for implementation and hardware-test limits.

## Current Stage G status

Stage G adds a dedicated social WebSocket with a separate queue, sender sequences and bounded recent chat/music state. A lazy RoomControls module combines existing voice controls with escaped chat, reactions, local blocking and consent-gated HTML5 Audio. Music metadata is server-authoritative and host-controlled; bytes are bundled original assets. An additive SQLite migration stores explicitly reported chat evidence only, with a local owner-review CLI. Game engine, cards, scores and private projections are unchanged. See SOCIAL.md.

## Current Stage F status

Stage F adds a separate room-authorized voice WebSocket and member-only ICE configuration route. Four opted-in clients form an audio-only WebRTC mesh; signaling has its own queue, limits, call IDs and versions. Game socket lifecycle revokes voice while engine/projections remain unchanged. The lazy room voice panel owns microphone tracks, peer/audio contexts and bounded recovery. See VOICE.md; social features remain Stage G.

## Stage E implementation

Stage E adds Drizzle-backed SQLite accounts, hashed opaque sessions, OAuth transactions and durable avatar cleanup intents. Google OIDC runs only in the backend; shared types expose public profile data. The profile dialog is lazy-loaded. S3 stores only sanitized WebP images. Account identity now authorizes multiplayer and compact member-updated events synchronize names/thumbnails. The engine and owner rules are unchanged. See ACCOUNTS.md. Earlier stage descriptions below document their original scope; temporary guest identities now require an explicit non-production flag. Voice and subsequent stages remain unimplemented.

## Implemented in Stage A

npm workspaces with strict TypeScript: `apps/web`, `apps/server`, `packages/shared`, `packages/game-engine`. The root build script explicitly builds shared packages before apps. App packages are private; no package publishing is configured.

Stage A established React, Vite and Tailwind with a static mobile shell, semantic landmarks, safe-area spacing and reduced-motion CSS. Stage D now uses Zustand and replaces that shell with the authorized game interface. Account authentication and audio remain later-stage work.

Server uses Fastify and Zod. `buildApp` separates application construction from network startup for injection testing. Environment parsing rejects invalid ports and modes. GET `/health` returns only a public health contract. Logs redact authorization and cookies. Startup binds to loopback by default.

Shared infrastructure contracts contain no private game state.

## Implemented in Stage B

The standalone engine has no runtime dependencies, I/O, clocks, implicit randomness or imports from React, Fastify, WebSockets, Node or browser APIs. Modules: cards/deck/seating, private round transitions, scoring ledger and manual accusations. Readonly state is transformed without mutating inputs. Trusted callers supply a bounded random-integer function for initial dealer selection and Fisher–Yates shuffle. Fixed entropy makes tests reproducible; production must use a cryptographically secure source.

Seats 0–3 increase counterclockwise, with teams {0,2} and {1,3}. This is an internal indexing convention, not a visual seating decision. A cut moves the first n cards to the bottom, with both piles nonempty. Four-card deal batches begin at the dealer's right and finish with the dealer. Trump validation occurs before the second batch.

All `PrivateRound` objects, including hands, original deals and play evidence, are server-private. Stage B introduced no app integration; Stage C now integrates it only inside the backend, through separate explicit public projections. The engine itself remains independent of transports. Ledger entries distinguish point awards, single-draw carry, and accusation transfers. Entries prevent duplicate round settlement and duplicate payment for the same evidence within a ledger. No initial physical counter pool, score floor, victory threshold, normal dealer rotation, or unresolved bonus rules are invented.

Accusation windows and no-trump report timing/basis require trusted owner-confirmed policies. No production policy is installed. Restart requires a separately supplied shuffled deck, a new unique round ID and explicitly chosen replacement dealer. See ENGINE.md and RULE_CLARIFICATIONS.md.

## Implemented in Stage C

Fastify WebSocket and cookie plugins wrap a single-process in-memory RoomService. Temporary guest cookie identities supply transport authentication until Stage E Google accounts. HTTP creates/previews/joins rooms; WebSockets carry validated actions, acknowledgements, compact recipient-specific events and reconnect snapshots. Public contracts live in `packages/shared/src/protocol.ts`; runtime validation remains server-side. Stage C itself added no frontend controls; Stage D consumes this protocol below.

The server derives seats/teams, owns secure entropy and all engine state, and serializes joins, presence and gameplay in a bounded queue per room. Action IDs plus expected versions handle retries/races. Exactly four ready connected players are required to start. Projection code explicitly whitelists own hand and public information. Raw engine state, private evidence and ledger history are never serialized.

Same-cookie reconnects reserve the same seat and recover from a current snapshot, replacing an old socket safely. Rooms/sessions, message queues, frame sizes, outbound buffering and receipt history have explicit bounds and TTL cleanup. Origin checks and HttpOnly cookies protect transport identity. These are not durable accounts or crash recovery. All in-memory state is lost on server restart; multiple independent backend instances are unsupported.

Owner-dependent rules remain unresolved by default, including ordinary next-round dealer rotation. Server-only policy extension points are exercised by hypothetical tests, not installed as production rules. See MULTIPLAYER.md for the full protocol and constraints.

## Implemented in Stage D

The React frontend now has home/create/join, lobby and lazy-loaded table/result views. Baseline card faces use HTML/CSS and suit text; profile/avatar systems and theme registries are not introduced. Relative seats keep the local player bottom and teammate opposite. Forms, controls, feedback, safe areas and reduced-motion styles support the mobile-first flow.

Zustand stores only recipient-visible snapshots plus connection/UI metadata. A pure public reducer validates version continuity and never computes authoritative trick/scoring outcomes. The browser transport retains an uncertain action's identity, disables input while pending/offline, recovers by snapshot, and bounds retries/timeouts. SessionStorage contains only public room metadata; credentials stay HttpOnly and no hands/engine evidence are persisted.

The Vite dev proxy serves `/api` HTTP/WebSockets; optional public API configuration supports later hosting. Backend POST read equivalents preserve mandatory Origin validation for same-origin browser access. No game-engine, room-rule, authentication-account, database or social features were added. See UI.md for behavior and testing limits.

## Planned

Stages H/I are implemented above. J: final hardening and deployment verification. Stages E/F/G are implemented as described above.

Stage E owns SQLite/Drizzle persistence, migrations and external avatar storage. Migrating to PostgreSQL requires an adapter and asynchronous integration changes. Permanent avatars are never stored on temporary hosting filesystems.

## Optional remote-testing infrastructure

A foreground Node supervisor manages one isolated loopback NGINX, one production Fastify process and a Cloudflare Quick Tunnel. NGINX serves staged compiled assets and strips the verified /api prefix for allowlisted backend/socket routes. Public hostname-dependent configuration is runtime-derived, without changing server .env. The initial tunnel exposes a maintenance-only gate; explicit Google registration acknowledgment is required for application activation. Active rooms still live in the single backend process. No engine, authentication provider or persistence architecture was replaced. See CLOUDFLARE_MULTIPLAYER_SETUP.md.

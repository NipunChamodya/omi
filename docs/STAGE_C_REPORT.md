# Stage C — Multiplayer Backend and WebSockets

## Completion status

Stage C backend implemented and tested with four simultaneous real WebSocket clients. Confirmed engine behavior is integrated server-side. Unresolved owner-dependent policies remain gated. No Stage D UI or later-stage feature was implemented. No Stage C commit was created because stage commit authorization has not been supplied.

## Features implemented

- Temporary guest transport identities with cryptographically random HttpOnly cookies, hashed server-side credentials, absolute expiry, strict Origin checks and production Secure host-cookie configuration. This supplies transport identity until Stage E; Google accounts/profiles are not implemented.
- Private room creation, eight-character secure codes, invite-path metadata, preview/join, four-seat membership, opposite teams and ready status. Host start requires exactly four ready connected players.
- Strict validated action envelopes bound to authenticated actor, room, unique action ID and expected version. The server chooses deck/dealer, owns engine state, validates game actions and settles confirmed round results.
- Bounded per-room sequential processing for joins, presence and gameplay; optimistic versions; retained idempotency receipts; duplicate/reused-ID handling; competing joins/card submissions cannot apply twice.
- Recipient-specific whitelist snapshots and deal events. Hidden hands, deck order, original deals, cheating evidence, private ledgers and session credentials stay server-side. Ordinary plays use compact public deltas rather than snapshots.
- Same-identity reconnect preserves seat/hand/ready state, replaces old socket safely and returns a current snapshot. Explicit sync works with stale versions; actual presence transitions are versioned. Heartbeats detect unresponsive peers.
- Session/room/queue/receipt/frame/buffer/request/message bounds; idle room expiry; server shutdown cleanup. Capacity exhaustion refuses new work rather than evicting accepted action IDs and reopening replay.
- Manual reports remain unresolved by default; test-only trusted policies verify exact three-point transfers, cancellation/fresh restart and score-preserving next-round mechanics. No automatic warning or cheating penalty.

## Files created

- `packages/shared/src/protocol.ts`
- `apps/server/src/multiplayer/validation.ts`
- `apps/server/src/multiplayer/support.ts`
- `apps/server/src/multiplayer/rooms.ts`
- `apps/server/src/multiplayer/projection.ts`
- `apps/server/src/multiplayer/routes.ts`
- `apps/server/src/multiplayer/multiplayer.test.ts`
- `apps/server/src/multiplayer/support.test.ts`
- `apps/server/tsconfig.test.json`
- `docs/MULTIPLAYER.md`
- `docs/STAGE_C_REPORT.md`

## Files modified

- `.env.example`: exact APP_ORIGIN configuration.
- `apps/server/package.json`: cookie/WebSocket/ws dependencies, engine dependency and test-inclusive typechecking.
- `package-lock.json`
- `apps/server/src/app.ts`: multiplayer registration and injectable configuration.
- `apps/server/src/index.ts`: passes validated runtime configuration to the app.
- `apps/server/src/config.ts`: exact HTTP(S) origin validation and HTTPS requirement for production.
- `apps/server/src/app.test.ts`: current room-authorization behavior and origin configuration tests.
- `packages/shared/src/index.ts`: public protocol type exports.
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/ENGINE.md`
- `docs/GAME_STATES.md`
- `docs/RULE_CLARIFICATIONS.md`
- `docs/SECURITY.md`
- `docs/PERFORMANCE.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`

Owner rules, engine implementation, frontend source and earlier completion reports remain unchanged.

## Tests executed and results

- `npm test`: **65 tests passed across 5 files**, comprising 40 engine, 4 server foundation/configuration, 1 frontend, 3 transport primitive and 17 real-network multiplayer tests.
- Real WebSocket integration tests connect four independent cookie identities to an actual ephemeral TCP listener. A full round plays all 32 cards and resolves eight tricks and confirmed scoring. Each recipient's first/final deal is checked against their own snapshot; ordinary throws contain no snapshots, replacement hands or private evidence.
- Concurrency/recovery: competing final-seat joins, same-version card submissions, retained duplicate IDs, altered-ID reuse, retry after reconnect, stale version sync, old-socket replacement, offline/online transitions, immediate frames and cross-room isolation.
- Security/resource tests: wrong actor/room, outsiders, missing/forged cookies, foreign/missing origins, forbidden URL credentials, strict unknown-field validation, malformed/binary/oversized messages, production cookie flags, outbound bounds, HTTP/message rate limits across reconnect, session/room capacity and expiry, bounded receipts, queue recovery/cleanup.
- Explicit hypothetical test policies verify silent deception followed by a manual three-point transfer once, no-trump cancellation/fresh restart and score preservation across a policy-selected next dealer. No such policy is installed in the application defaults.
- `npm run build`: passed across all workspaces.
- `npm run typecheck`: passed across all workspaces, including server and engine test sources.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- Compiled backend smoke check: health and temporary session route return expected public contracts.
- Dependency installation audit: zero known vulnerabilities reported after installing the new plugins/types. This is an installation-time result, not a security certification.

Initial failures were corrected: strict test helper typing, a test reading observer sockets before their final frames arrived, unused/control-regex lint issues, and Fastify unknown-error narrowing. Sandbox registry access and local TCP binding were blocked; authorized retries completed. No test was silently skipped or represented as passed after failing.

Playwright was not rerun because the browser shell was unchanged. No voice, authentication/upload, load, production TLS/proxy, physical-device or deployment tests were performed; those belong to later stages.

## Security observations

The backend owns all authoritative state. Wire types contain only public data and the recipient's own current hand; projection functions explicitly whitelist fields. Ordinary play accepts gameplay deception without generating a warning or penalty. The default accusation endpoint gives no evidence-dependent answer while its window is unresolved. Cookie/Origin/current-socket/membership checks and serialized versioned actions protect the implemented transport boundary.

Temporary guest credentials are not Google authentication or durable account recovery. Client-facing failures do not expose private engine errors or raw frames. Process restart loses rooms, scores, credentials and replay history. Stage J must still verify proxy/TLS configuration, operational limits, monitoring and production security. No production readiness claim is made.

## Performance observations

The active-room path makes no database calls. Four-recipient card deltas are small and bounded; full private snapshots are used for connect/sync and HTTP reads. Room queues, maps, message sizes, receipt history and buffers have explicit defaults described in MULTIPLAYER.md. The frontend remains 69.25 kB JavaScript and 2.00 kB CSS gzipped. No capacity, latency or mobile-network performance guarantee is inferred from integration tests.

## Unresolved questions

- Accusation window and any implications for historical-round evidence retention/routing.
- No-trump report timing and original versus remaining-hand basis.
- Replacement-dealer selection after cancellation.
- Normal inter-round dealer rotation.
- Repeated draws, Kapothi carry and other unconfirmed scoring combinations.
- Physical counter inventories, score floor and match-ending threshold remain unspecified.

## Known limitations

The frontend is still the Stage A shell; invitation paths are metadata until Stage D consumes them. One confirmed network round can finish; ordinary continuation is gated until dealer rotation is confirmed. Manual reports/restarts cannot be activated by arbitrary client input; they need trusted owner-confirmed policies. Test callbacks are not game rules.

Rooms, scores, sessions and deduplication history are single-process memory only; no crash recovery, distributed room coordination, automatic forfeits, player substitution, host migration or public matchmaking exists. Current report commands target the current round; any later owner-confirmed cross-round accusation window will require historical evidence routing/retention. Cookies require same-site frontend/API hosting or a same-origin proxy. Session expiry is absolute at six hours. Browser reconnect UX and event reducers remain Stage D.

## Local testing

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
# Only the real-network multiplayer integration suite:
npm test -- apps/server/src/multiplayer/multiplayer.test.ts
```

Local TCP listening must be permitted. No external service credentials are needed. The tests create four isolated guest cookie jars and real ws clients. For manual HTTP testing, follow MULTIPLAYER.md. Local server startup remains `cp .env.example apps/server/.env`, then `npm run dev:server`. Default browser Origin is http://127.0.0.1:5173, API health is http://127.0.0.1:3000/health. The shell itself still has no multiplayer UI.

## Recommended next stage

Stage D — Mobile Game Interface, only after explicit owner authorization. Stop here; do not build home/lobby/table/card-interaction UI automatically.

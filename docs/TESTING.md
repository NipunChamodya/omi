# Testing

## Stage A scope

Stage A introduced Vitest health/configuration and React Testing Library/jsdom shell tests. These tests have since been updated for the implemented room authorization and browser entry flows; the original Stage A results remain in STAGE_A_REPORT.md.

`npm run test:e2e`: Playwright Chromium tests shell visibility and horizontal fit at 320, 390, 430 and 1280 pixels, plus a reduced-motion smoke test. Playwright starts Vite automatically. Install Chromium first with `npx playwright install chromium`.

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` verify types, lint, formatting and production compilation. Run build before standalone type checking on a fresh checkout so package declarations exist.

## Stage B scope

`packages/game-engine/src/engine.test.ts` tests deck composition, reproducible bounded shuffle, seat parity/order, all four dealer positions, interactive cut authorization, both deals, first-four trump eligibility, rank/trump/lead resolution, turns and ownership. Tests verify that off-suit deception is accepted, evidence is private engine state, and ordinary play never changes a ledger.

The suite plays 100 complete seeded rounds (3,200 card actions), deep-freezing inputs and checking unique-card conservation, hand reduction, trick totals and winner-led turns. It checks confirmed 1/2/3 scoring, draw carry including 2+1=3, duplicate settlement, unresolved repeated draws/bonus combinations, manual accusation eligibility, three-point transfer conservation, false/team reports, repeated-report idempotence, no-trump checks across both teammates, cancellation and explicit full restart.

Synthetic completed-round fixtures isolate score-ledger behavior from trick resolution. Eligibility/basis callbacks in tests are hypothetical mechanics fixtures, not production rules. No default policy has been installed. The engine's typecheck additionally includes test sources through `tsconfig.test.json`.

Run `npm test -- packages/game-engine/src/engine.test.ts` for the engine alone. Run the root build/typecheck/lint/format checks and `npm test` for integration with the unchanged foundation. Exact executed results are recorded in STAGE_B_REPORT.md. Stage C adds real WebSocket hidden-card and authorization tests; production hardening remains Stage J.

## Stage C scope

`apps/server/src/multiplayer/multiplayer.test.ts` binds ephemeral loopback ports and uses real ws clients with separate cookie jars. It tests exactly-four seating/readiness, public/private deals, full authoritative rounds, compact events, concurrent actions/joins, duplicate IDs and retries across reconnect, version conflicts/sync, socket replacement, early frames, and cross-room isolation.

Security/resource regressions cover strict schemas and server authority, cookie/origin/member checks, credential-free URLs, uniform unresolved-report responses, malformed/binary/oversized frames, outbound backpressure closure, action-receipt caps, request/message limits across reconnect, session/capacity bounds and idle expiry. Test-only hypothetical policies verify manual three-point transfers, cancellation/fresh restart and ledger-preserving next-round transitions. No such rule policy is installed by default.

`support.test.ts` checks serial queue ordering/recovery/capacity/cleanup, opaque session expiry and bounded rate windows. Server typechecking now includes test sources via tsconfig.test.json. Shared protocol has only public types; runtime command schemas are server-side. All original engine and frontend tests remain included.

Run `npm test -- apps/server/src/multiplayer/multiplayer.test.ts` for real-client integration. Root `npm test` also needs local TCP listening permission and must fail rather than silently skip these tests when binding is blocked. See STAGE_C_REPORT.md for exact results. The browser UI was unchanged during Stage C; Stage D adds the Playwright coverage below.

## Stage D scope

React Testing Library tests accessible forms/invite entry, relative seat layout, HTML-like name escaping, explicit off-suit selection without automatic submission, and disabled offline controls. Pure reducer tests cover all public events, old/foreign events, gaps, own-hand removal, trick/result projection and nonmutation. Transport tests cover identical lost-ack replay across reconnect, old ack handling, gap sync/input suspension, replaced tabs, delayed callbacks after navigation and native offline/online recovery. API tests cover stable-ID credentialed retries, two ten-second timeouts and cancellation without retry. Server read-route tests verify the browser POST equivalents retain Origin/member semantics.

`npm run test:e2e` now starts a dedicated backend at 3100 plus Vite at 5173 and uses four isolated browser contexts. It verifies home/create/invite/join/lobby/readiness, keyboard cut, eligible trump, all 32 plays/eight tricks/results, reload hand restoration, offline/online recovery and an honest unresolved next-dealer message. Layout checks cover widths 320/390/430/1280, including play on a 320×568 viewport. Invalid invite and keyboard/reduced-motion smoke checks are included. Test screenshots capture home/table/trick/results for visual inspection under test-results/.

Frontend typechecking includes E2E sources. An existing server expiry test now waits for authoritative offline state before advancing its fake clock, removing a client-close/server-detach race exposed under concurrent test load. Screenshot fixture typing was corrected and is now checked with the rest of the frontend.

Actual counts/checks/build output are in STAGE_D_REPORT.md. Chromium emulation and keyboard smoke checks do not replace physical-device, Safari/WebKit or assistive-technology testing.

## Planned

Voice in F; social synchronization in G; PWA and actual Android/iOS behavior in H; security regression, load tests and deployment checks in J.

Chromium emulation does not establish real iOS or Android compatibility. See the individual STAGE_A/B/C/D_REPORT.md documents for actual executed results.

## Stage E executed verification

`npm test`: 101 tests across 10 files passed. Added signed OIDC callback/signature/nonce/issuer/audience/expiry/subject checks, secure production cookies, Origin/CSRF, SQLite reopen persistence, account ownership, session revocation/socket closure, upload content/crop/metadata/thumbnail validation, failed storage cleanup and concurrent edit/logout during upload regressions. Existing engine and four-client multiplayer coverage remains passing.

`npm run test:e2e`: all 10 Chromium checks passed. Three profile checks cover signed local OIDC login, Sinhala editing, crop/reposition, real SDK against a local S3 fixture, reload, replacement/removal, logout/return, live lobby profile propagation and 320px dialog layout. These are mock external services, not live Google/S3 verification.

Build, typecheck, lint and formatting passed. Compiled migration CLI applied twice successfully against the same temporary file; mode 0600 verified. npm audit reported zero vulnerabilities. SQLite 13 initially crashed on this Node environment; the tested dependency tree uses better-sqlite3 12.11.1. No migration generator is installed. Physical devices, real cloud permissions, production TLS, load and broader hardening remain untested. See STAGE_E_REPORT.md.

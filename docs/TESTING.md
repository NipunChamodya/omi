# Testing

## Stage A scope

`npm test`: Vitest tests public health shape, unavailable future routes, invalid environment configuration and accessible shell rendering using React Testing Library and jsdom.

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

Run `npm test -- apps/server/src/multiplayer/multiplayer.test.ts` for real-client integration. Root `npm test` also needs local TCP listening permission and must fail rather than silently skip these tests when binding is blocked. See STAGE_C_REPORT.md for exact results. The browser UI is unchanged, so Playwright was not rerun in this stage.

## Planned

Interactive mobile UI in D; auth/uploads in E; voice in F; social synchronization in G; PWA and actual Android/iOS behavior in H; security regression, load tests and deployment checks in J.

Chromium emulation does not establish real iOS or Android compatibility. See the individual STAGE_A/B/C_REPORT.md documents for actual executed results.

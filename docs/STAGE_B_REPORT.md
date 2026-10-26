# Stage B — Authentic OMI Game Engine

## Completion status

Confirmed-rule engine and manual adjudication/restart infrastructure implemented. Unresolved owner-defined policies remain explicitly gated; they are not claimed playable or resolved. No Stage C functionality was implemented. No Git commit has been created for Stage B because stage commit authorization has not been supplied.

## Features implemented

- Standalone TypeScript package with zero runtime dependencies and no app, transport or browser imports.
- Owner's 32-card deck/ranking, four seats, opposite teams and counterclockwise order.
- Injected bounded entropy for initial dealer selection and Fisher–Yates shuffle; no implicit random source.
- Interactive cut by dealer's left, first four-card batches right first/dealer last, first-four trump validation, remaining deal and selector lead.
- Phase, turn and ownership validation; highest-trump/lead-suit trick resolution; winner leads; eight-trick completion.
- Private initial hands and hand-before evidence for every play. Deliberate follow-suit violations are accepted silently. No automatic penalty, warning or public event.
- Point-award/carry/transfer ledger, confirmed 1/2/3 scoring, single-draw carry including 2+1=3. Duplicate settlement and duplicate evidence payment are idempotent within the preserved ledger.
- Manual accusation infrastructure with opposing-team/evidence checks and exactly three-point transfers only after explicit eligibility. Unconfirmed accusation window has no default.
- No-trump report verification/cancellation infrastructure with explicit trusted timing/hand-basis policy, checks across both teammates, and full restart through a separately shuffled deck, explicitly selected new dealer and another interactive cut.
- Unresolved results for repeated draws, Kapothi carry, missing accusation/report policies and missing replacement-dealer selection. No guessed outcomes mutate state or scores.

## Files created

- `packages/game-engine/src/cards.ts`
- `packages/game-engine/src/round.ts`
- `packages/game-engine/src/scoring.ts`
- `packages/game-engine/src/accusations.ts`
- `packages/game-engine/src/engine.test.ts`
- `packages/game-engine/tsconfig.test.json`
- `docs/ENGINE.md`
- `docs/STAGE_B_REPORT.md`

## Files modified

- `packages/game-engine/src/index.ts`: exports engine API with private-state warning.
- `packages/game-engine/package.json`: typecheck includes test sources.
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_STATES.md`
- `docs/RULE_CLARIFICATIONS.md`
- `docs/SECURITY.md`
- `docs/PERFORMANCE.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`

`docs/OWNER_RULES.md` remains unchanged. No app, shared-wire-contract, dependency-version or lockfile changes.

## Tests executed and results

- `npm test`: **44 tests passed across 3 files**, including 40 engine tests and the 4 existing foundation tests.
- Engine simulation: 100 complete seeded rounds / 3,200 card actions, with deep-frozen inputs, unique-card conservation, hand lengths, turn order, winner-led tricks and round completion asserted at each step.
- Rules tests: all ranks, all trump suits, all four dealer positions, entropy bounds, invalid decks/cuts/phases/actors/cards, private evidence, scoring, carry, manual accusations, false/team/duplicate reports, cancellation and restart.
- `npm run typecheck`: passed for all workspaces, including new engine test sources.
- `npm run build`: passed for all workspaces; frontend remains 69.25 kB JavaScript and 2.00 kB CSS gzipped.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- Compiled-package Node smoke test: completed all 32 plays / 8 tricks successfully.

The existing Playwright suite was not rerun in Stage B because the frontend and browser behavior did not change. No WebSocket integration, load, authentication, physical-device or deployment tests were performed; those components are outside this stage.

## Security observations

The engine takes trusted private state and authenticated-seat identities from its future caller. It rejects invalid game actions and preserves input state. Every hand, private evidence flag and adjudication context remains inside the engine; nothing is wired to a client or endpoint. No automatic cheating penalty or warning is possible through ordinary play.

This is not an authorization or untrusted-state hydration layer. Stage C must build player-specific snapshots, authenticate actors and sanitize errors without serializing raw private state or adjudication evidence. Secure entropy, unique IDs, trusted policies and preserving the ledger across calls are caller responsibilities. Types are readonly, but production objects are not deep-frozen. No production security certification is claimed.

## Performance observations

32-card shuffle, at most eight-card hand scans and four-card trick resolution. Round evidence is bounded to 32 records. No I/O, clocks, timers or background tasks. Ledger scans/copies grow with match history; retention and persistence remain later-stage work. Seeded simulations establish correctness, not hosting capacity or latency guarantees. No new frontend payload is introduced.

## Unresolved questions

- Exact accusation window.
- Replacement-dealer selection after no-trump cancellation.
- Repeated-draw behavior and unconfirmed bonus combinations, including Kapothi with carry.
- No-trump reporting timing and whether absence means original dealt hands or currently remaining cards. An owner clarification question was raised; neither possibility is installed as a rule.
- Normal dealer rotation, physical counter inventories/score floor and match-winning threshold are unspecified and have no invented defaults.

## Known limitations

The app still shows the Stage A shell. The engine is a library, not a playable network game. Policy-dependent report paths remain unresolved by default. Test eligibility callbacks demonstrate infrastructure only and do not constitute owner confirmation. Restart relies on its trusted caller to freshly shuffle and explicitly select a dealer. Ledger totals are bookkeeping awards plus net transfers, not physical counter inventories; negative net totals are possible without a confirmed floor rule.

## Local testing

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
# Engine only:
npm test -- packages/game-engine/src/engine.test.ts
```

Read ENGINE.md for the trusted API, private-state boundary and unresolved-result handling. Existing local web/server startup commands in README remain unchanged.

## Recommended next stage

Stage C — Multiplayer Backend and WebSockets, after explicit owner authorization. Stop here; do not implement rooms, socket handlers, snapshots or reconnection automatically.

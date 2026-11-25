# OMI V3 browser migration

**Release gate open.** This increment moves local-hand and public-trick card faces to PixiJS and retains the live browser game around them.

## Baseline and architecture audit

| Surface | Repository findings |
| --- | --- |
| Browser shell, components and scenes | React, TypeScript, Vite and Zustand. App owns boot and navigation. Home owns the existing skippable five-second opening, menu audio and welcome forms. MultiplayerMenu, Lobby, GameTable, results branches, settings dialogs, Profile and Tutorial own the existing screens. Adventure Chrome, GameChrome and the adventure surface styles already share core visual styling. |
| Server and gameplay | Fastify and the pure game-engine workspace own four-seat rules, private hands, cut, trump, trick settlement and scoring. The existing manual report rule allows a player to choose an off-suit card and resolves the report on the server. Presentation retains that behavior. |
| Rooms and ranked | The client owns HTTP room create, join, preview, invite and seat recovery. Server routes own membership, casual rooms, ranked matchmaking, rating, rematches and reconnection. |
| Transport and persistence | WebSocket deltas are filtered by the server projection. Gap handling and reconnect use private snapshots and pending action IDs. SQLite repositories and migrations store account and match data. |
| Identity | Existing guest transport identity, Google/OIDC account sign-in, account/profile and friends flows. |
| Voice and audio | Existing WebRTC peer client, server signaling, VoicePanel, local-file sharing, audio preferences, and opening/menu and in-game cues. |
| Animation and access | Existing CSS and WAAPI deal, fan, play and trick motion. The buttons already handle keyboard and pointer actions and provide accessible names. Reports, history and results remain live React content. |
| Language | English and Sinhala dictionaries with incomplete coverage. This increment adds a Tamil interface option and localized player, hand, trump, score, turn and menu strings. Some flows still fall back to English. |
| Tests and performance | Vitest, Playwright, local fixture simulations and a production bundle gate. Starting local Node 22.13.1 was below the package engine floor. The installed repository test runtime at Node 22.23.4 ran the baseline. Generated native wrappers already present in the worktree were included by root ESLint until excluded. |
| References and older gaps | The 16 references are directly in [docs/design/references](../design/references). [V2.11 acceptance](../V2_11_ACCEPTANCE.md) records open Tamil, accessibility, physical media, performance and test inventory requirements. |

## Implementation

- Pixi loads at table entry. The React input layer supplies layout and current motion geometry to the Pixi scene. The GPU presents the local hand and public plays and a transient trick-reveal animation. Scene updates respond to actual layout and card changes and pause in background tabs.
- The board uses an original hardwood inset on the existing illustrated felt. The scene owns its card texture cache, animation frame, observers and GPU lifetime. A failed texture leaves its HTML face visible. Data Saver, forced colors, initialization failure and WebGL context loss have HTML fallback behavior.
- The renderer reads faced cards already shown by the client. The server still processes actions and projects room data. Opponents’ unplayed cards stay represented by backs and public counts.
- Browser startup has no native bridge import. Existing native working files were present before migration and are outside the web build.
- GSAP was deferred because this increment uses the existing CSS/WAAPI timelines and a single demand-driven Pixi tween. Other screens continue through the existing React scene components.

## Build

The root build emits the web artifact in `apps/web/dist`. The current 96,212-byte gzip entry combines 83,988 bytes of initial JavaScript and 12,224 bytes of initial CSS. In a loopback Chromium run, Resource Timing recorded the lazy table scene module at 84,050 encoded bytes, 241,359 decoded bytes and 5 ms. This measurement covers one module and excludes its dependencies. Mobile frame rate, memory, battery and Safari behavior remain unmeasured. [Resource Timing evidence](evidence/pixi-scene-resource.json)

## Rollback checkpoint

The original branch was `dev` at `5f28db4ac3b7722a01af98f9300791bf6e9e49e6`. [The local checkpoint](/private/tmp/omi-v3-rollback-h3i74k36) stores the workspace tar, staged and unstaged binary patches, HEAD and original status. It covers tracked paths and unignored untracked paths. Its archive member list and file contents were checked against the working tree before edits.

```text
d5ecfd2e7d6fe36a508fbff4551c1166f55b6a626c6955fd1be4ecf97b5605ad  workspace.tar
```

Verify with `shasum -a 256 /private/tmp/omi-v3-rollback-h3i74k36/workspace.tar`. Extract the archive into a fresh directory with `tar -xf` and compare against the current checkout before selectively restoring files. The supplied patches and original status record index state and tracked deletions. The checkpoint is stored in the machine’s temporary directory. Ignored build output and local runtime files were outside the archive and remain outside source rollback.

## Local verification and visual review

- Baseline and regression each passed 327 Vitest cases. All 15 infrastructure tests passed with loopback access. Workspace TypeScript, source ESLint, production Vite build and bundle gate passed. An initial sandbox run could not bind server test sockets. The same suite passed with loopback access.
- Four Chromium clients completed a casual round with pointer and synthetic touch input, trick replay, round results and room reload. The separate seeded ranked run completed a match and rematch. Tamil settings and Sinhala join passed in Chromium and Firefox.
- Four synthetic Chromium voice and music cases passed, including four-peer voice recovery, bundled and local music, codec handling, and logout stopping capture.
- The Chromium GPU scenario passed ten viewport sizes from 320×568 to 1280×900 under the production CSP. It verified face handoff and Data Saver fallback. An earlier test iteration entered layout checks before its bot fixture completed cutting or choosing trump. The final scenario completes both when the host owns the action.
- [Home](evidence/home-390.png), [multiplayer](evidence/multiplayer-320.png), [create](evidence/create-390.png), [join](evidence/join-390.png), [four-player lobby](evidence/lobby-390.png), [landscape lobby](evidence/lobby-568x320.png), [portrait gameplay](evidence/gameplay-390x844.png), [landscape gameplay](evidence/gameplay-568x320.png), [trump](evidence/trump-390.png), [leave dialog](evidence/leave-menu-320.png), [settings](evidence/settings-320.png), [round results](evidence/round-results-844x390.png), and [match results](evidence/match-results-390.png) were captured from working UI flows. The leave dialog documents the current return/keep-playing flow. A dedicated pause menu remains open.
- The reference review found the most visible difference in play to be the central hardwood board. After adding it, the 568×320 screenshot exposed the partially clipped play control and oversized trick board. The compact layout reduced the board and fan height, and the rerun required at least 99% of the play button to be visible. The references still use a more compact dark menu, richer avatar imagery and tighter control grouping than the current home and lobby.

## Repeat the targeted checks

Use the project-supported Node 22.23.4 runtime or a later compatible 22.x release. The browser fixture uses the production web build and disposable loopback services.

```sh
npm test
npm run test:infra
npm run lint
npm run typecheck
npm run build
npm run check:build
npx playwright test -c playwright.adventure.config.ts --workers=1 -g 'Pixi table loads|Tamil settings|Sinhala join labels|four mobile friends'
OMI_TEST_SEEDED_MATCH=1 npx playwright test -c playwright.seeded.config.ts --project=chromium -g 'full-interface ranked match'
npx playwright test -c playwright.voice.config.ts --project=chromium
```

## Remaining release gates

- Scene-level redesign and visual approval across every menu, account, invitation, match and help surface.
- Complete English, Sinhala and Tamil coverage, native speaker review, script font verification, screen-reader and WCAG 2.2 AA review.
- Physical Samsung and iPhone gameplay and frame profiling, physical microphones, Bluetooth routing, interruptions and live TURN.
- The 1,200-case requirement remains open. Historical results are in the existing test inventory and acceptance records. Browser runs, viewport assertions and repeated executions should retain their actual case counts.

# OMI V2.11 acceptance

**Release status: INCOMPLETE.** The mobile lobby fix and opening experience pass targeted desktop-browser automation. The broader release gates remain open.

## Implementation and screen coverage

| Surface | Change and available evidence | Status |
| --- | --- | --- |
| Home and opening | A fresh eligible tab gets a skippable five-second four-ace animation. Reduced motion and Data Saver suppress it. Restore and direct invitation paths bypass it. User-initiated menu music uses an original opening cue and loop. | Targeted Chromium and Firefox checks pass for skipping, reload, reduced motion, Data Saver and soundtrack opt-in. |
| Multiplayer mode, Create and Join | Existing flows use the shared button foundation. Invalid invitation and active seat reconciliation passed on fresh fixtures in both browsers. | Targeted pass. Full visual review remains open. |
| Casual waiting lobby | Intrinsic sizing fixed with bounded seat columns and single-line name labels. The full name remains available as text and a title. Team, seat, host and ready details use the row below. Room code, copy actions and ready/start controls are grouped. Short landscape places the seat grid alongside the actions. | Passed at 320×568, 360×640, 375×667, 390×844, 412×915, 430×932, 568×320, 768×1024, 1024×768 and 1280×900 in both browsers. The assertion checks page scroll on the six phone portraits and short landscape. |
| Active table and hand | Prior V2.10 board artwork and seat geometry retained. Fan curvature now follows the card count, and small hands use the available width to reduce overlap. Four-human browser controls exercised touch/drag or select/play, dealing, all 32 plays, replay and reload. Eight-card hit testing checked every visible card at eight portrait and landscape viewports. | Passed in both browsers on an isolated rerun. A full artwork review and physical-device acceptance remain open. |
| Casual and ranked results/rematch | Actual browser controls reached final results and started rematches with four humans in Chromium. | Local pass. The independent four-human SQLite restart run restored seats, private hands and score, then reached results and a rematch. |
| Settings, profile, friends, tutorial, installation and dialogs | Existing components retained. Automated coverage includes settings focus and Back, profile persistence, friend-code flow, Sinhala settings, tutorial and Safari install guidance. | Partial. Complete visual, keyboard, screen-reader and contrast acceptance remain open. |
| Audio overlays and permissions | Existing voice and local-file sharing retained. New menu audio stops when leaving Home and has a separate opt-in control. | Chromium and isolated Firefox synthetic four-peer media passed. One combined run recorded a Firefox zero-audio receiver followed by a separate logout timeout. The fresh Firefox fixture passed all four cases. Physical microphones and live TURN remain unverified. |
| Localization | New intro, lobby and music messages and card-selection, play, replay and report announcements use English and Sinhala. | English and Sinhala spot checks only. Full message audit and reviewed Tamil interface remain open. |

## Inspected screenshots

- [320px lobby before](v2_11/evidence/lobby-before-320.png)
- [320px lobby after](v2_11/evidence/lobby-after-320.png)
- [568×320 lobby after](v2_11/evidence/lobby-after-568-landscape.png)
- [1280px lobby after](v2_11/evidence/lobby-after-1280.png)
- [320×568 table, Chromium](v2_11/evidence/table-chromium-320x568.png)
- [844×390 table, Firefox](v2_11/evidence/table-firefox-844x390.png)

The 16 owner references under `docs/design/references/` were visually reviewed. Their compact layout and game controls informed the mobile work. The existing tropical artwork, brand, deck and server-side gameplay were reused.

## Verification results

| Check | Result |
| --- | --- |
| Vitest | 327 passed across 35 files. The 120 focused defensive security tests are included in that count. |
| Infrastructure | 15 passed. |
| Adventure browser regression | 42 of 42 passed on Chromium and 42 of 42 passed on Firefox using separate fixtures. |
| Four-player terminal journeys | Three Chromium scenarios passed, covering casual, ranked and independent server restart through results and a rematch. |
| Voice and local-file music | Four scenarios passed per engine after isolating Firefox into a fresh run. |
| Card themes and PWA | Two scenarios per suite passed per engine. The Firefox PWA Data Saver check initially timed out and passed on an isolated rerun. |
| Build, TypeScript, ESLint and bundle gate | Passed. The initial entry measured 95,996 bytes gzip, including 12,062 bytes of CSS. |
| Disk-backed loopback | Eight rooms, 32 players, 320 actions, eight reconnects and eight duplicate checks. Action p50 was 2.53 ms, p95 5.81 ms and p99 12.30 ms. Peak combined RSS was 145 MiB and average combined CPU was 6.4%. |

This run verified 395 distinct passing automated cases across the listed suites. Browser-engine repeats and the 120-case focused selection are excluded from that total. See the [new-case inventory](v2_11/new-tests.csv). The earlier broader shared-fixture browser run had five failures before the layout correction and isolated reruns. A shared-seed restart attempt also failed to reach the results heading within its hand limit. The fresh-seed isolated restart passed.

## Repeatable checks

```sh
npm run build
npm run check:build
npm run typecheck
npm run lint
npm test
npm run test:infra
npm run test:security
npx playwright test -c playwright.adventure.config.ts --workers=1 -g 'short mobile lobby|intro|menu soundtrack|Data Saver bypasses'
npx playwright test -c playwright.adventure.config.ts -g 'four mobile friends'
npx playwright test -c playwright.voice.config.ts --project=chromium
OMI_TEST_SEEDED_MATCH=1 OMI_TEST_RESTART_DIR="$(mktemp -d)" npx playwright test -c playwright.seeded.config.ts --project=chromium --grep 'full-interface casual-restart match'
```

Use a fresh server per seeded scenario. The disposable fixture uses its own SQLite directory. The broader two-worker browser run also hit the production-style local rate constraints. Nothing was changed in those protections.

## Outstanding release gates

- Finish the screen-by-screen art and accessibility audit, with reviewed Tamil and complete English and Sinhala coverage.
- Verify casual and ranked four-human sessions and audio on physical Android and iPhone devices. On each device, open the Home screen in a fresh tab, confirm the introduction ends or skips, create or join a lobby using a long display name, rotate in the lobby and during play, try each card with touch, complete a trick, pause/resume authorized audio and regain the same seat after switching networks.
- Expand the historical automated inventory with distinct, executed cases. Five Playwright scenario definitions and one keyboard-localization unit case were added in this batch. Browser engine reruns do not add unique scenario IDs.
- Finish systematic performance profiling, including startup, network transitions, frame timing and memory. Local bundle checks provide asset evidence without establishing device or production capacity.

## Git safety

The starting worktree was `dev` at `889b501` and already had tracked and untracked V2.10 changes. The SHA-256-verified checkpoint is `/private/tmp/omi211.LDTl4z/worktree.tar` with checksum in the same directory. All work remains local.

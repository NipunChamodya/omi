# Stage D — Mobile Game Interface

## Completion status

Stage D implemented and verified against the Stage C backend. Four isolated browser players can create/join, ready up, cut, choose trump, play 32 cards/eight tricks and view confirmed results. Unresolved owner-dependent rule paths remain gated. Stage E authentication/profiles and all subsequent stages were not implemented. No Stage D commit was created because stage commit authorization has not been supplied.

## Features implemented

- Responsive home/create/join forms with temporary guest transport names, room codes and invitation-query entry.
- Four-seat lobby with teams/presence/readiness, shareable code/link, clipboard fallback, host-only start and waiting states.
- Dark emerald table, initials, local player bottom, teammate top, opponents left/right, public hand counts, current-turn indicators, trump, trick history and team scores.
- Interactive keyboard/touch-friendly cut slider, eligible first-four trump choices and second-deal rendering.
- Explicit local card selection followed by Play; lightweight public card animations. Owned off-suit cards remain available without automatic cheating warnings or penalties. No optimistic card removal or client-owned outcomes.
- Public round results/carry, completed-trick winner, manual history/report entry points and honest unresolved dealer/report feedback. The client never selects a dealer or scoring rule.
- Zustand public-state projection, contiguous event handling, stale/foreign-event rejection, private sync on gaps, exact-envelope retries, pending/offline controls, bounded recovery, tab-takeover handling, navigation cleanup, reload restoration and native offline/online recovery.
- Keyboard/native controls, pressed card states, focus outlines/skip link, alert/status messages, safe areas and reduced-motion CSS. Baseline local HTML/CSS card faces only; no Stage I theme system.
- Lazy-loaded table chunk, system fonts, no new images/remote fonts/audio or external runtime libraries.
- Development HTTP/WebSocket proxy and public API configuration. Minimal backend read-only POST equivalents preserve Origin/member validation for same-origin browser access.

## Files created

- `apps/web/.env.example`
- `apps/web/src/components/Cards.tsx`
- `apps/web/src/components/Home.tsx`
- `apps/web/src/components/Lobby.tsx`
- `apps/web/src/components/GameTable.tsx`
- `apps/web/src/game/api.ts`
- `apps/web/src/game/client.ts`
- `apps/web/src/game/reducer.ts`
- `apps/web/src/game/api.test.ts`
- `apps/web/src/game/client.test.ts`
- `apps/web/src/game/reducer.test.ts`
- `apps/web/e2e/game.spec.ts`
- `docs/UI.md`
- `docs/STAGE_D_REPORT.md`

## Files modified

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/App.test.tsx`
- `apps/web/e2e/shell.spec.ts`
- `apps/web/vite.config.ts`
- `apps/web/tsconfig.json`: also typechecks E2E sources.
- `apps/web/package.json`: local shared-type workspace dependency.
- `package-lock.json`
- `playwright.config.ts`: isolated backend/frontend fixtures.
- `apps/server/src/multiplayer/routes.ts`: authorized read-only POST counterparts.
- `apps/server/src/app.test.ts`: read-route regression coverage.
- `apps/server/src/multiplayer/multiplayer.test.ts`: deterministic server-detach/idle-clock ordering in an existing expiry test.
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_STATES.md`
- `docs/MULTIPLAYER.md`
- `docs/SECURITY.md`
- `docs/PERFORMANCE.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`

Owner rules, engine implementation, shared wire contracts and earlier stage reports remain unchanged. No new external dependency version was added. Screenshots are ignored Playwright artifacts, not permanent card/theme assets.

## Tests executed and results

- `npm test`: **83 tests passed across 8 files**. Includes all previous engine/network tests, public reducer projection, React UI controls/seating/name escaping, gap/lost-ack/reconnect/offline behavior, bounded HTTP retries/timeouts/cancellation and new authorized browser read endpoints.
- `npm run test:e2e`: **7 Chromium tests passed**. Real frontend/backend processes and four isolated cookie/browser contexts created and joined a table through invites, readied up, keyboard-cut, selected trump, played all 32 cards, resolved eight tricks/results, restored the exact hand after reload, recovered from offline and verified unresolved next-dealer feedback.
- Mobile/table checks covered 320/390/430 widths, desktop home/join at 1280, and full-round controls on a 320×568 short screen. No horizontal document overflow was observed. Keyboard skip-link and reduced-motion smoke checks passed. Invalid invites produced feedback without a fake lobby.
- `npm run build`: passed for all workspaces.
- `npm run typecheck`: passed, including frontend tests and E2E sources.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed.
- Home/table/completed-trick/results screenshots were generated under `test-results/` and visually inspected. Review corrected compact-card readability and moved the last-trick caption away from the local player marker.

Failures found and fixed: an existing expiry test advanced its fake clock before the server's queued disconnect completed; it now observes authoritative offline state first. A screenshot test fixture omitted its testInfo parameter; it was corrected and E2E files now participate in strict typechecking. Final executed runs above passed; failed intermediate runs were not counted as successes.

Chromium is the only browser actually exercised. No physical Android/iPhone, Safari/WebKit, installed PWA, assistive-technology audit, load test or production deployment validation was performed.

## Security observations

Credentials stay in the HttpOnly cookie; sessionStorage contains only public room/name metadata. Only recipient-visible cards/public events enter Zustand or the DOM. Names/notices render as text, with a regression checking HTML-like names cannot create an image/handler. Client restrictions supplement, and never replace, server validation.

Pending commands retain their original ID/body after uncertain delivery. Duplicate acknowledgements cannot roll state back; gaps and rejected actions refresh through private snapshots. Offline/pending input is disabled; stale callbacks and timers are cleaned up. Backend POST reads retain exact Origin/session/member checks. No private cheating data, automatic warning/penalty, guessed score or client-chosen dealer was introduced. Google/OIDC/profile/upload security remains Stage E/J; production readiness is not claimed.

## Performance observations

Actual final Vite build:

| Artifact                  | Uncompressed | Gzip     |
| ------------------------- | ------------ | -------- |
| Initial JavaScript        | 244.95 kB    | 76.57 kB |
| Lazy GameTable JavaScript | 9.34 kB      | 3.06 kB  |
| CSS                       | 22.45 kB     | 6.28 kB  |
| HTML                      | 0.60 kB      | 0.35 kB  |

No remote font/image/audio payloads or browser engine package. Ordinary card throws use compact socket events, not full-state polling. HTTP requests, socket recovery, sync, pending actions and timers are bounded. Animations use short CSS transforms/opacity and respect reduced motion. These sizes/tests do not establish real-device latency, memory usage or hosting capacity.

## Unresolved questions

The owner has not resolved accusation timing, no-trump report timing/hand basis, replacement-dealer selection, normal dealer rotation, repeated draws or unconfirmed bonus combinations. The UI reports the pause rather than inventing those rules. Physical scoring-counter inventories/score floors and match-ending threshold also remain unspecified.

## Known limitations

- One first round can finish; subsequent normal dealing remains gated by unconfirmed dealer rotation. Manual report policies remain unresolved by default.
- Google login, durable profiles/avatars, voice, chat, reactions, music, PWA/data saver and replaceable premium themes are not implemented.
- Temporary cookies identify the player. Four same-profile tabs share that identity; use separate profiles/contexts for four players. Opening another tab for the same identity replaces the old socket.
- Home closes the socket but reserves the seat. No backend leave/forfeit/kick/substitution/host-migration flow exists. Another room cannot be created by the same active identity until its old room is released.
- Reload recovery depends on accessible sessionStorage metadata and the original valid cookie. Cross-tab room discovery without metadata and crash recovery are not implemented.
- Backend rooms/scores/sessions remain single-process memory and disappear on restart. Production needs HTTPS/WSS, same-site cookie-compatible hosting and a real proxy or configured API base. No deployment occurred.
- Short screens scroll vertically; mobile viewport testing does not prove real-device/Safari behavior.

## Local testing

```sh
npm ci
npm run build
cp .env.example apps/server/.env
npm run dev:server
# Separate terminal:
npm run dev:web
```

Open http://127.0.0.1:5173. Create a table, copy its invite, and join using three independent browser profiles/contexts. Ready all four; host starts. The appropriate player cuts, the selector chooses trump, and players select then play cards. See UI.md for proxy/public configuration and recovery details.

Verification:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

Tests require permission to bind local ports and launch Chromium. Playwright uses ports 3100 and 5173 and does not reuse unrelated running servers. Screenshot artifacts are regenerated in ignored `test-results/`.

## Recommended next stage

Stage E — Google Authentication and Profiles, only after explicit owner authorization. Stop here; do not implement account login, database profiles or uploads automatically.

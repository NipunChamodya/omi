# Stage I — Premium Card Designs and Theme System

## Completion status

Stage I is implemented and locally verified on `dev`. The worktree was clean at inspection. No Stage J work, purchase flow, commit, push or public deployment occurred. Backend, engine, owner rules, authentication, database and CSP source are unchanged. Stop here pending explicit authorization for Stage J.

## Features implemented

- Typed, replaceable frontend theme registry with exactly two included designs: Classic OMI and Royal Black & Gold.
- Separate cosmetic CSS and original SVG backs; ranks/suits remain shared data rendered as text, without per-theme game logic or hidden-card attributes.
- Native labeled theme selection with four-suit/back preview, browser-local persistence, validation of stored IDs and safe storage-error behavior.
- Per-player independent appearance, including home cards, own hand, public throws and generic opponent backs. No theme choice is sent over gameplay sockets.
- Lazy stylesheet/artwork loading, bounded successful link/promise reuse, 12-second stylesheet deadline, safe retry and protection against stale async selection results. Unavailable artwork uses a generic spade back; a failed stylesheet keeps the last usable design.
- Short position-aware card entrance and hand-selection easing, preserving server-only action flow and reduced motion/Data Saver behavior.
- PWA precache refinement: entry CSS only, so unused theme styles remain lazy; eligible requested CSS retains existing static caching.

## Files created

- `apps/web/src/themes/registry.ts`: trusted theme definitions, asset URLs and lazy stylesheet loader.
- `apps/web/src/themes/store.ts`: validated persisted choice, async state and race/error handling.
- `apps/web/src/themes/ThemeControls.tsx`: selector, preview, loading/error/retry UI.
- `apps/web/src/themes/classic.css`, `royal.css`: scoped card appearance.
- `apps/web/src/themes/artwork/classic-back.svg`, `royal-back.svg`, `README.md`: original backs and provenance.
- `apps/web/src/themes/themes.test.tsx`: storage/race/failure/card identity/fallback tests.
- `apps/web/e2e/themes.check.ts`, `playwright.themes.config.ts`: Chromium/Firefox theme checks.
- `docs/THEMES.md`, `docs/STAGE_I_REPORT.md`: usage, architecture, testing, limits and completion record.

## Files modified

- `apps/web/src/App.tsx`: theme controls.
- `apps/web/src/components/Cards.tsx`: decorative face semantics and generic active-theme back with artwork fallback.
- `apps/web/src/components/GameTable.tsx`: replace existing generic back characters with themed generic backs, retaining public counts.
- `apps/web/src/styles.css`: mobile selector/preview/back layout and short reduced-motion-aware animations.
- `apps/web/pwa.ts`, `pwa.test.ts`: exact entry-CSS precache metadata and unused-theme exclusion test.
- `apps/web/src/App.test.tsx`: retain escaped-name/XSS checks while permitting legitimate trusted card-back images.
- `apps/web/e2e/game.spec.ts`: mixed designs, live switching with unchanged hand/score, persistence/reconnect/full-round regression.
- Root `package.json`: `test:themes`; `README.md`: current stage and links.
- Docs `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `GAME_STATES.md`, `UI.md`, `PWA.md`: Stage I behavior and limits.

## Tests executed and results

| Command/check                                                  | Actual result                                          |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run build`                                                | All workspaces passed                                  |
| `npm run typecheck`                                            | Passed                                                 |
| `npm run lint`                                                 | Passed                                                 |
| `npm run format:check`                                         | Passed                                                 |
| `npm test`                                                     | 148 tests across 20 files passed                       |
| `npm run test:infra`                                           | 4 passed                                               |
| `npm run test:themes`                                          | 4 passed in Chromium/Firefox                           |
| `npm run test:e2e:nginx`                                       | 24 gameplay/profile/mobile/proxy browser checks passed |
| `npm run test:pwa`                                             | 4 offline/cache/update/mobile checks passed            |
| `npm run test:social`                                          | 2 four-player chat/music/Data Saver journeys passed    |
| `npx playwright test --config playwright.production.config.ts` | 2 strict CSP/render checks passed                      |
| NGINX syntax validation in browser fixtures                    | Passed                                                 |
| 320px Royal screenshot                                         | Visually inspected; no overflow asserted in browser    |
| `git diff --check`                                             | Passed                                                 |

Theme unit tests check valid/invalid IDs, persistence/restoration, blocked storage, failed loading and retry, stale successes/failures, all 32 rank/suit identities under both designs and a back-artwork error fallback. Generated worker tests validate entry-only CSS caching and preserve API/private-data exclusions.

Real browser tests inspect applied colors, actual decoded SVGs, unused-theme network/cache exclusions, native selection, independent contexts, reload persistence, unavailable CSS and successful retry. They verify no CSP violations and disabled decorative motion under reduced motion and Data Saver. The motion-selector probe is decorative DOM only, not simulated gameplay. Four actual independent game clients use alternating designs, change a theme during play without changing their hand or score, reload, reconnect and finish all 32 plays with existing scoring/rule gates intact.

The old unit assertion that the entire page had no image became invalid once legitimate back images were added. It was narrowed to the escaped player-name container and injected `src=x`/inline-handler markup; the complete unit suite then passed. Draft CSS-loading approaches were replaced with retryable external links; final browser tests verify both applied styles and real assets after retry. Existing non-failing Vite future-native-loader warnings remain. Direct/relay voice suites were not rerun in Stage I; voice code is unchanged. Local signed OIDC/S3 fixtures are not public Google verification.

## Security observations

The registry uses fixed local CSS/SVG asset URLs, and local storage accepts only known IDs. No arbitrary import/URL, inline stylesheet, raw HTML, external artwork, CSP exception or payment endpoint was added. Generic backs carry no hidden identity; the server remains authoritative. All styling is scoped to the local active design and is absent from game actions/snapshots. SVGs are original geometric sources without scripts or external references. Credentials, session handling, CSRF/Origin checks and avatar storage are unchanged.

## Performance observations

Final measured entry JS: 257.53 kB / 80.47 kB gzip, about 1 kB gzip above Stage H. Main CSS: 30.90 / 8.08 kB gzip. Worker: about 1.93 kB. Classic/Royal stylesheets are 305/304 bytes; SVGs are 456/572 bytes. No new npm dependency, animation loop, polling, rule computation or audio behavior was added. Styles are loaded only on selection; artwork is lazy and locally cached through existing hashed HTTP assets. The PWA no longer precaches every CSS file. Load state/promise reuse is bounded to the two registry entries, with failed links removed. Device CPU, battery, FPS, memory and mobile-data benchmarks were not performed.

## Unresolved questions

Owner-defined game-rule clarifications and public Google callback configuration remain unresolved from previous stages. No additional rule, account-level cross-device preference policy or unapproved design was invented.

## Known limitations

- Appearance is saved per browser profile/origin, not synchronized to account storage, other devices or other tabs. Temporary hostname changes create separate preferences.
- Only two included designs exist; no custom uploads, extra themes, paid cosmetics, payment processing or premium table skins were added.
- An unavailable style keeps the last usable design. A back-image error shows a generic back until its component reloads or another design is selected; this does not affect card identities or gameplay.
- Motion/layout verification uses Chromium/Firefox automation and mobile-sized viewports. Physical Android/iPhone/Safari, OS background/resume, installed-mode Google login and real remote-network performance remain unverified.
- No full accessibility audit, public deployment, final hardening or production-readiness claim is made. Stage J remains unstarted.

## Instructions for local testing

Use the existing private configuration and start the built backend:

```sh
npm run build
npm run start -w @omi/server
```

In another terminal with port 5173 free:

```sh
npm run preview -w @omi/web -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173 with the exact configured APP_ORIGIN. Expand Card themes and choose either design. Reload to verify persistence; use independent browser profiles to choose differently while playing. Enable Data Saver or OS/browser reduced motion to verify decoration is suppressed. For automation, build then run `npm run test:themes` and the other commands above sequentially when they share ports. Install Chromium/Firefox with `npx playwright install chromium firefox` if needed. No environment file or database migration is required by Stage I. See [Theme guide](THEMES.md) for details.

## Recommended next stage

Stage J — Security, Testing, Optimization, and Deployment, only after explicit owner authorization. Stop here.

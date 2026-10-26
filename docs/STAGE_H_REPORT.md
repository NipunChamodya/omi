# Stage H — Progressive Web App and Mobile Optimization

## Completion status

Stage H implementation and local Chromium/Firefox verification are complete on `dev`. Prior Stage G work was preserved. No game rules, backend authentication/session logic, database data, theme system or payment feature changed. No assistant commit, push or public deployment occurred. Stop before Stage I.

Android/iOS installation support is implemented through standards-based manifest/icons, iOS metadata and existing mobile layouts. Physical-device installation, Safari/WebKit and installed-mode Google login have not been verified; these acceptance checks remain pending, not claimed complete. Public callback registration and external-network validation remain pending from earlier stages.

## Features implemented

- Standalone root web manifest with portrait preference, app identity, theme/background colors and original 192/512px PNG icons, maskable-safe artwork and Apple touch icon.
- Production-only secure-context service worker generated from exact build output. Entry JS/CSS plus a generic offline page/style are precached; lazy JS chunks cache only on demand.
- Network-only navigation with styled offline fallback, reconnect link and clear server-required gameplay messaging. API/OAuth, private data, avatars and optional audio bypass worker caching.
- Safe update lifecycle: no forced takeover/reload, waiting-update guidance, old OMI cache cleanup on activation and no deletion of unrelated caches.
- App settings with deferred native install prompt when offered, Safari/manual instructions, offline state and persisted Standard/Data Saver selection with browser Save-Data default and storage-error fallback.
- Data Saver removes optional shared avatar images, disables decorative motion and stops locally enabled music/effects until explicit opt-in. Turning it off never starts audio; live voice/game checks remain active.
- Existing mobile safe areas, dynamic viewport height, reduced motion and portrait responsive layout preserved and tested at narrow widths.
- NGINX worker/manifest revalidation and explicit manifest MIME type; existing compiled-asset caching, API routing and private-file denials preserved.

## Files created

- `apps/web/pwa.ts`: build-generated bounded static worker.
- `apps/web/pwa.test.ts`: worker generation, valid syntax, routing/privacy/cleanup tests.
- `apps/web/public/manifest.webmanifest`, `offline.html`, `offline.css`.
- `apps/web/public/icons/omi-192.png`, `omi-512.png`, `apple-touch-icon.png`.
- `infra/scripts/generate-pwa-icons.mjs`: reproducible original geometric PNG artwork with Node built-ins.
- `apps/web/src/pwa/preferences.ts`, `PwaControls.tsx`, `pwa.test.tsx`.
- `apps/web/e2e/pwa.check.ts`, `playwright.pwa.config.ts`.
- `docs/PWA.md`, `docs/STAGE_H_REPORT.md`.

## Files modified

- `apps/web/vite.config.ts`: production build plugin registration.
- `apps/web/index.html`: manifest/touch-icon links and Apple metadata.
- `apps/web/security.ts`, `security.test.ts`: self-only worker and manifest directives/assertions.
- `apps/web/src/App.tsx`: app settings/status controls.
- `apps/web/src/components/Cards.tsx`: Data Saver avatar initials.
- `apps/web/src/social/RoomControls.tsx`: disable optional local audio on Data Saver activation/room entry.
- `apps/web/src/styles.css`: accessible mobile settings and reduced decorative motion.
- `apps/web/e2e/social.check.ts`, `voice.check.ts`: Data Saver audio/avatar/voice regressions.
- `apps/web/e2e/nginx.check.ts`: real worker/manifest headers.
- `infra/nginx/omi-testing.conf`: root worker/manifest revalidation and MIME type.
- Root `package.json`: `test:pwa` command; `README.md`: Stage H status and testing link.
- Docs `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `GAME_STATES.md`, `UI.md`: implemented Stage H behavior and verification limits.

## Tests executed and results

| Command/check                                                                         | Actual result                                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run build`                                                                       | All workspaces passed                                                               |
| `npm run typecheck`                                                                   | Passed                                                                              |
| `npm run lint`                                                                        | Passed                                                                              |
| `npm run format:check`                                                                | Passed                                                                              |
| `npm test`                                                                            | 143 tests across 19 files passed                                                    |
| `npm run test:infra`                                                                  | 4 passed                                                                            |
| `npm run test:pwa`                                                                    | 4 passed, Chromium and Firefox                                                      |
| `npm run test:e2e:nginx`                                                              | 24 passed, including four-player full rounds, profile and mobile layout checks      |
| `npm run test:social`                                                                 | 2 four-client browser journeys passed, including Data Saver music/avatar behavior   |
| `npx playwright test --config playwright.production.config.ts`                        | 2 strict CSP/render checks passed                                                   |
| `npx playwright test --config playwright.nginx.config.ts apps/web/e2e/nginx.check.ts` | 4 passed after final worker/manifest header assertions                              |
| `npm run test:voice`                                                                  | 4 direct voice/logout checks passed, including live voice during Data Saver changes |
| NGINX syntax validation in browser fixtures                                           | Passed                                                                              |
| Icon decoding/dimensions                                                              | PNG responses checked in both browsers; 512px artwork visually inspected            |
| `git diff --check`                                                                    | Passed                                                                              |

The new worker test executes generated JavaScript in a VM and checks exact precache entries, lazy-asset caching, API/media/unknown/query/non-GET exclusions and unrelated-cache preservation. Preferences/UI tests check storage validation/failure, persistence and avoiding avatar image creation.

PWA browser tests install and take control under the actual CSP, inspect cache keys, stop an isolated local HTTP origin to trigger real network failure, render the styled offline page and restart the origin to verify recovery. A byte-changed real worker remains waiting while the old page stays active and the update message appears. Manifest/icon dimensions and 320px settings/persistence are verified. Existing mobile suites cover 320, 390, 430 and desktop widths, keyboard focus and reduced motion. Four independent clients still play a complete round and reconnect; account/profile tests use the existing local signed OIDC/S3 fixtures.

Initial generated-code escaping and formatting issues were corrected. Firefox's first simulated-offline navigation produced NS_ERROR_OFFLINE; the final test stops its own isolated origin instead and passes in both engines. No production bypass was introduced to accommodate testing. Existing non-failing Vite future-native-config-loader warnings remain. Relay voice was not rerun in Stage H; no TURN/signaling implementation changed.

## Security observations

Only `worker-src 'self'` and `manifest-src 'self'` were added to CSP. No unsafe-inline/eval, broad wildcard, permissive Origin or authentication exception was added. No private responses, game state, credentials, chat, avatars or optional media enter service-worker caching. Game actions always require the current server; no offline replay queue exists. OAuth callbacks remain network-only. Update workers do not replace active gameplay clients automatically. Environment files, database and owner rules were untouched.

## Performance observations

Entry JS is 254.29 kB (79.47 kB gzip), about 0.96 kB gzip above Stage G. CSS is 28.85 kB (7.68 kB gzip). Worker is about 1.87 kB; offline HTML/CSS total 1,307 bytes. Icons total 5,276 bytes. No new npm dependency, gameplay polling, background sync or audio precache was added. Static cache membership is limited to build JS/CSS and two offline files; old versions are removed on activation. Several pending build caches may remain until all app clients close and activation runs. No physical-device CPU, memory, battery or mobile-data benchmark was performed.

## Unresolved questions

Existing OMI rule clarifications and Google public-hostname registration remain unresolved. A real device/browser matrix and supported public HTTPS hostname are still required for hardware acceptance. No new game policy or authentication method was inferred.

## Known limitations

- Requires a successful previous worker installation for offline fallback; browsers can deny or evict storage. First-ever offline visits cannot install OMI.
- Offline mode is an explanatory page/status, not offline multiplayer. Account persistence does not preserve rooms across backend restart.
- Native install prompt availability varies by browser. Firefox desktop behavior does not prove Android installation; desktop automation does not prove iOS Safari support.
- Physical Android, iPhone/iPad, Safari/WebKit, installed-mode Google callback/cookie behavior, safe areas on hardware and OS background resume remain unverified.
- Updates wait until every OMI tab/app window closes. Deployments must retain old hashed files for older open clients until they finish.
- Public Google authentication, external phones/network and public tunnel behavior were not tested or deployed in this stage.

## Instructions for local testing

With existing private configuration and port 5173 free:

```sh
npm run build
npm run start -w @omi/server
```

In a second terminal:

```sh
npm run preview -w @omi/web -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173 using the exact configured APP_ORIGIN. Preview inherits the existing `/api` proxy (default backend 127.0.0.1:3000); use loopback only. Open App settings, toggle Data Saver, allow the worker to install and reload before testing disconnected navigation. Reconnect and use Try OMI again. For automated verification run `npm run test:pwa` after the build; use `npx playwright install chromium firefox` if necessary. See [PWA guide](PWA.md) for installation, deployment headers, privacy, updates and hardware checklist. No changes to private environment files are required by Stage H.

## Recommended next stage

Stage I — Premium Card Designs and Theme System, only after explicit owner authorization. Stop here.

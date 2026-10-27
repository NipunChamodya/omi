# Stage I — Card themes

## Implemented

Expand **Card themes** on the home screen or at your table, then choose **Card design**. Classic OMI uses ivory faces, emerald backs and red hearts/diamonds. Royal Black & Gold uses midnight faces, gold spades/clubs, rose-red hearts/diamonds and a crown-patterned back. All four suits retain their distinct symbols. Both themes are included without purchases.

The preview shows all four suits and a back. The same selected design styles your hand, public played cards, home decorations and generic face-down opponent backs. It does not reveal opponent cards. Existing accessible card/action names remain unchanged. Theme controls use native labeled select input; decorative artwork stays hidden from screen readers. A 320px preview and 320–430px real gameplay layouts are verified in Chromium/Firefox; no full accessibility audit or physical-device sign-off is claimed.

## Data and artwork separation

`apps/web/src/themes/registry.ts` owns two fixed, typed IDs, public names/descriptions and trusted local stylesheet/SVG URLs. It contains no game logic. `store.ts` validates persisted values against this registry, loads a design and keeps the last usable design while loading or after failure. Only successful selection is persisted under `omi-card-theme`. Invalid values fall back to Classic; blocked storage keeps the choice usable in memory. A stale asynchronous success/failure cannot replace a newer choice.

Preferences belong to this browser profile/origin, not the account database. Different players using independent browser contexts can choose independently. Preferences remain on this device after logout, are not synchronized between devices/tabs and are not broadcast to other players. Changing or losing a temporary tunnel hostname creates a different origin and therefore different storage. No account migration or server theme endpoint was introduced.

Card values still come from the shared Card model. `CardFace` renders rank and suit text; CSS supplies appearance. `CardBack` draws only a generic trusted SVG, with a plain spade fallback if the image cannot load. The renderer is independent of engine ranking, trump selection, card ownership and hidden history. No engine/server/private projection file changed.

## Lazy loading and failures

Registry URL strings do not download assets. Only the selected stylesheet is inserted as a same-origin external link, preserving the existing CSP. Artwork is requested by lazy image elements for the active design. The alternative theme's CSS/SVG is not fetched on an initial Classic visit. Both loaded stylesheets are scoped to `data-card-theme`; an older sheet cannot overwrite the current theme. At most two successful stylesheet promises/links are retained. Failed links are removed, the load entry is cleared, and a 12-second deadline prevents indefinite loading. A safe error offers Retry card design; existing cards stay playable and retry fetches and applies the stylesheet again.

The PWA now derives precached CSS from the actual entry chunk's Vite metadata. It does not precache alternate theme CSS. Exact build JS/CSS may cache when requested, as before; SVG artwork uses existing fingerprinted HTTP caching and never enters service-worker caching. No arbitrary CSS URL, HTML fragment or external theme upload is accepted. Both original SVG sources contain no script or external resource. See the artwork README for provenance.

Data Saver and reduced motion disable the new movement/transition effects. They do not force a different card design or block a deliberate theme choice: each selected stylesheet is about 300 bytes and each original back is under 600 bytes. The existing optional avatar/music policies are unchanged. An artwork failure falls back to the generic back; unavailable styles keep the last loaded design. No new polling or rendering loop exists.

## Animations

A played card uses a 240ms opacity/scale/translation entrance from its public table position, preserving the existing placement transform and authoritative action flow. Selecting a hand card uses a short easing transition. No 3D rendering, new animation library, optimistic move or animation timer was added. Reduced motion and Data Saver use `animation: none` and remove transitions; card selection and game actions still work.

## Local use and verification

Use existing private settings. Run the normal backend and the compiled loopback frontend in separate terminals:

```sh
npm run build
npm run start -w @omi/server
```

```sh
npm run preview -w @omi/web -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173 with that exact configured APP_ORIGIN and port free. Existing preview API proxy configuration remains unchanged. Vite development also supports theme selection with its existing nonce policy; never expose it publicly. For public hosting use only the existing NGINX workflow and its authentication gate. This stage does not deploy anything.

Automated checks, with Chromium/Firefox installed:

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npm run test:themes
npm run test:e2e:nginx
npm run test:pwa
npm run test:social
npx playwright test --config playwright.production.config.ts
```

Run browser suites sequentially when they share ports. Theme browser tests inspect actual computed colors, downloaded/decoded SVG artwork, lazy network/cache behavior, independent contexts, persisted reloads, stylesheet failure/retry, 320px overflow and CSP violations. Motion selectors are additionally inspected using a decorative DOM probe, without generating fake game state. Full-round tests use four players with alternating designs, switch a design during play, verify the same hand/score, reload, reconnect and finish all 32 plays. Unit tests cover unknown IDs, storage failures, stale async results, loading failures/retry, every rank/suit identity in both designs and the generic artwork-error fallback.

Physical Android/iPhone/Safari appearance, OS background/resume, installed-mode Google login and public network latency remain unverified. Real Google callbacks remain blocked on the previously documented public-hostname setup; fixtures are local only. No new account-level preference synchronization, custom card upload, extra themes, table skin, purchases or Stage J hardening/deployment was implemented.

## Adding a future approved design

Add original/trusted local CSS and artwork, scope rules to the new ID, extend the fixed registry and add equivalent tests. CSS should change presentation only; preserve card text, hit targets, contrast, reduced motion and the exact public data/actions. Do not load URLs supplied by local storage or a player. New designs require their own authorized scope.

Vite documents [hashed asset URL imports and no-inline handling](https://vite.dev/guide/assets). The PWA's entry-only CSS behavior is covered by generated-worker unit tests and real network/cache browser assertions; it does not depend on assuming all CSS belongs to the entry bundle.

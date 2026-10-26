# Stage H — PWA and mobile optimization

## Implemented

OMI has a root-scoped standalone web manifest, original 192px/512px PNG icons (including maskable artwork), an Apple touch icon and iOS metadata. Install instructions and a deferred browser install button appear in App settings. The button appears only when the browser offers its native install event. Safari uses Share → Add to Home Screen; Firefox availability depends on platform/browser. No installation is forced. HTTPS is required on a public host; loopback is suitable for local tests.

The compiled app registers `/sw.js` only in a secure context and production builds. Vite development does not register a worker. Existing safe-area padding, portrait-friendly responsive layout, dynamic viewport height and reduced-motion support remain active. Portrait is a manifest preference, not a forced browser orientation lock.

## Static caching and privacy

The build plugin generates an exact allowlist from fingerprinted JavaScript/CSS files. Installation precaches only the entry JavaScript, CSS and a small static offline page/style. Lazy table/profile/voice/social chunks cache only when requested. Music, effects, avatars, API responses, account details, session credentials, WebSocket messages, hands and game snapshots never enter this worker's cache. The application HTML is network-only. No offline game actions or background synchronization queue exists.

Navigations use the network and fall back to the static offline page on network failure. `/api` and `/api/*`, including the Google callback, always bypass the worker. Cross-origin and non-GET requests bypass it. Query-bearing static asset URLs are excluded. A query-bearing frontend navigation can receive the same generic offline page; the query itself is never cached. The offline page contains no account or room state.

Cache names are derived from the build asset names and offline-file content. The allowlist bounds entries to this build's JS/CSS and two offline files. Activation removes only older `omi-static-*` caches, preserving unrelated caches. Runtime cache-write failures do not prevent a successful network response being rendered. Browser storage may be denied/evicted; offline support requires a previous successful installation. Disabling storage or clearing site data removes this benefit. Normal browser HTTP caching remains subject to existing server headers.

The worker never calls `skipWaiting()` or `clients.claim()`. A new version waits until all existing OMI tabs/app windows close. The app displays update guidance without reloading a live table. Keep old fingerprinted assets available during a deployment transition so older open tabs can still request a not-yet-loaded chunk. NGINX explicitly revalidates `/sw.js` and the manifest and serves the manifest with `application/manifest+json`. Fingerprinted assets retain immutable caching. The CSP adds only `worker-src 'self'` and `manifest-src 'self'`; script/style and API protections remain intact.

## Standard and Data Saver modes

The accessible Data Saver checkbox persists a boolean in local storage. A browser `connection.saveData` preference supplies the initial default when no explicit valid setting exists. Disabled/unavailable storage falls back safely; toggling still works for that session. Preferences contain no account credentials.

Data Saver replaces shared Avatar components with player initials, avoiding optional avatar requests. Explicit profile editing/cropping still loads the image you choose to edit. It disables decorative animations/transitions and stops enabled music/effects when activated or when entering a room with the setting on. Turning it off never starts audio automatically. A player may explicitly re-enable local audio while Data Saver remains on; voice permission and mute controls remain independent. Music/effects already require explicit permission in Standard Mode. Optional audio is neither prefetched nor put into the service-worker cache in either mode.

Gameplay validation, server authorization, CSRF/Origin checks, reconnection and private projections are unchanged. Data Saver is not a way to play offline. A dropped connection can resume only while the backend room/session remains alive; backend restart still ends in-memory rooms.

## Local verification and use

Use existing private server configuration; do not copy secrets into frontend settings. Build and start the normal backend:

```sh
npm run build
npm run start -w @omi/server
```

In another terminal, with port 5173 available:

```sh
npm run preview -w @omi/web -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173. The existing Vite preview inherits the `/api` proxy to the configured backend; the default is loopback port 3000. Use the exact configured APP_ORIGIN. Stop your own Vite development process first if it occupies 5173. This preview command is for loopback testing, not public hosting. Existing account/database setup and migrations remain documented in ACCOUNTS.md. For a public compiled deployment use the existing NGINX/tunnel workflow and its Google hostname gate; do not expose preview/dev tooling.

Open App settings to toggle Data Saver or read installation instructions. Visit online once and wait for the worker to install, then reload so it controls the page. Disconnect and refresh to see the offline page; reconnect and choose Try OMI again. In an already-open table, disconnecting shows status and pauses/reconnects existing channels instead of pretending to accept actions.

Automated checks:

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npm run test:pwa
npm run test:e2e:nginx
npm run test:social
npx playwright test --config playwright.production.config.ts
```

Install Chromium/Firefox using `npx playwright install chromium firefox` if required. Run browser suites sequentially when they share ports. `test:pwa` uses compiled assets and an isolated temporary loopback origin. It stops and restarts that origin to verify real network-failure fallback/recovery in both engines; it does not stop any user server. It also serves a byte-changed worker to verify waiting updates without interrupting the active page. A first test using Firefox's simulated offline mode produced NS_ERROR_OFFLINE; the final test uses actual origin failure instead. Manifest/icon dimensions, cache exclusions, 320px settings/persistence and update UI are asserted. Existing four-client social tests verify Data Saver pauses local music, removes avatars and never resumes audio merely when switched off.

## Tested and pending

Chromium and Firefox desktop automation passes, including 320–430px layouts and four independent mobile-sized clients playing a full round. Manifest and icons are checked from real responses. This is not evidence of a physical Android installation, iPhone/iPad Safari installation, background resume, browser chrome/safe-area behavior on hardware, or installed-mode Google login. WebKit is not installed in this environment. Complete that hardware checklist before claiming Android/iOS acceptance. Public Google callback configuration and real remote-network testing remain pending from previous stages. No deployment, Stage I themes or payment system is included.

## Sources

The update policy follows the browser's [service worker lifecycle](https://web.dev/articles/service-worker-lifecycle), which lets new workers wait for existing clients to close. Manifest fields follow the [W3C Web Application Manifest](https://www.w3.org/TR/appmanifest/). Apple documents [home-screen installation and touch icons](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), and WebKit describes [standalone manifest behavior](https://webkit.org/blog/13878/). Browser automation limitations are described in the [Playwright service-worker guide](https://playwright.dev/docs/service-workers).

# Blank-screen investigation and CSP correction

## Evidence and limits of attribution

The original Firefox `script-src 'none'` policy could not be reproduced from this checkout. Before changes, the correctly started Vite server returned 200 HTML for `/` and 200 `text/javascript` for both `/@vite/client` and `/src/main.tsx`, with no Content-Security-Policy response header. `index.html` contained no CSP meta tag. Repository inspection found no Fastify CSP middleware, Helmet registration, or authentication code setting that directive. The proxy matched only `/api`, not frontend documents or modules. No conflicting application policies were found.

Installed Vite 8.3.5 contains `default-src 'none'` in its final error-response helper; it contains no literal `script-src 'none'`. A deliberately incorrect document-root launch returned empty 404 responses for the document and main module, without that CSP. This proves a launch failure but does not prove the source of the owner's reported policy. An external server, response override, intermediary or browser extension remains possible; none was established as the cause. Do not report the original CSP source as conclusively identified.

A separate, reproducible launch bug was confirmed: `npm run dev:web -- --port 5173 --strictPort` previously invoked the nested process as `vite --host 127.0.0.1 5173`. npm consumed the port option, leaving `5173` as Vite's positional document root. This produced missing application/modules. The root script now has a final `--` to preserve forwarded arguments. Browser fixtures now use this root command, and all Chromium flows passed with it. Vite has an explicit app root, port 5173 and strict port handling; it will fail visibly instead of silently selecting another occupied port.

## CSP implementation

`apps/web/security.ts` is the single frontend CSP owner. Its Vite plugin injects exactly one CSP meta tag before scripts. It adds no duplicate CSP response header. The Fastify API and `/api` proxy security remain unchanged. An upstream HTTP policy will still intersect with this policy; application code deliberately does not strip or override external restrictions. If the original error persists, inspect the document's actual response headers and meta policies in Firefox Network, verify the listening process and compare with a clean Firefox profile. A restrictive external header must be corrected at its source, not bypassed with broader script permissions.

Development permits same-origin modules and fresh, per-document 192-bit nonces for Vite's React preamble and injected styles. Vite's nonce placeholder is replaced only after its own tags are injected; earlier replacement was caught and corrected by browser tests. Vite's nonce meta also supports dynamically inserted styles. HTML ETags are removed in development to avoid nonce reuse through conditional documents. Exact loopback WebSocket origins at port 5173 permit HMR and the default proxied gameplay socket. No unsafe-inline, unsafe-eval or wildcard source is used. Custom HMR ports require an explicit policy update.

Production builds contain a static policy with same-origin scripts/styles, no nonce, no Vite tooling exceptions, no inline script attributes and no eval permissions. Images permit same-origin, blob gallery previews and the explicit Google image host `https://lh3.googleusercontent.com`. An absolute configured VITE_API_URL adds only its exact HTTP(S) and WS(S) origins to connect-src and its HTTP(S) origin to img-src; production requires HTTPS and rejects embedded credentials. Use an explicit production HTTPS API URL so WSS has an explicit allowlist entry across browsers. Relative `/api` remains the default for local proxy use. A deployment using a different Google picture hostname must explicitly review and allow that host; it is not implicitly trusted with a broad wildcard.

Other directives deny objects, base URL overrides and unrelated resource types. Meta CSP cannot enforce frame-ancestors: hosting should configure that HTTP response directive as appropriate. This patch does not supply or deploy hosting configuration. Do not add an upstream `script-src 'none'` to the app document. See [Vite CSP guidance](https://vite.dev/guide/features.html#content-security-policy) for the nonce mechanism.

## Authentication initialization

Inspection confirmed existing bootstrap rejection handling displays a safe alert while leaving the home mounted. Its HTTP client already aborts stalled requests after 15 seconds. New tests verify both behavior paths and ensure internal provider error details are not rendered. No authentication implementation change was required. Existing OAuth signatures, PKCE/state/nonce, cookies, CSRF, sessions, uploads and socket authorization are unchanged.

The locally edited tracked environment example contained a client secret. Its placeholders were restored; no credential is needed in frontend configuration. Rotate the credential that was present there. Do not copy secrets into tracked examples.

## Files changed

- `package.json`: forward root dev:web arguments correctly.
- `apps/web/vite.config.ts`: stable application root, explicit strict port, environment-aware security plugin and workspace-relative environment loading.
- New `apps/web/security.ts`, `security.test.ts`: CSP implementation and policy regressions.
- `apps/web/src/App.test.tsx`, new `apps/web/src/auth/api.test.ts`: safe failed/stalled bootstrap tests.
- New `apps/web/e2e/security.spec.ts`, `production.check.ts`: executable modules, nonce uniqueness, mounted UI, bootstrap failure and denied inline scripts.
- `playwright.config.ts`: test the root dev command. New `playwright.firefox.config.ts`, `playwright.production.config.ts`: Firefox suite and two-engine production smoke tests.
- `README.md`, `docs/SECURITY.md`, `docs/TESTING.md`, this report: setup and verification records.
- `.env.example`: restored safe tracked placeholders from a local credential edit; it matches its committed example.

## Verification executed

- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`: passed.
- `npm test`: 105 tests in 12 files passed, including existing OAuth/upload/CSRF/session and real WebSocket integration tests.
- `npm run test:e2e`: 11 Chromium checks passed using the corrected root dev command.
- `npx playwright test --config playwright.firefox.config.ts`: 11 Firefox checks passed, including full four-player gameplay, profile uploads and returning login.
- `npx playwright test --config playwright.production.config.ts`: production render and denied-inline-script checks passed in Chromium and Firefox (2 checks).

The first CSP draft failed browser tests because Vite injected script nonces after the transform hook; that draft was fixed and tests rerun. The final policy did not require unsafe-inline/eval. Browser checks use Playwright-managed Firefox/Chromium and local signed OIDC/S3 fixtures, not the owner's Firefox profile or live Google/cloud services. Vite emits a non-failing warning about future native config-loader extension requirements; its current loader works. No deployment, commit, push, Stage F implementation or gameplay-rule changes occurred.

## Restart locally

Stop previous OMI server processes with Ctrl-C in their terminals. Do not overwrite an existing server environment file.

```sh
cd /Users/nipunchamodya/Desktop/OMI
npm run build
npm run db:migrate -w @omi/server
npm run dev:server
```

In a second terminal:

```sh
cd /Users/nipunchamodya/Desktop/OMI
npm run dev:web -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173` and reload. Google needs the server-only settings in ACCOUNTS.md; missing settings should produce a usable unavailable-sign-in screen, not an empty document. Backend health is `http://127.0.0.1:3000/health`. A port conflict now fails visibly; stop the process owning that port rather than accepting a different application at 5173.

# Stage E — Authentication and profiles

## Completion status

Implementation and local automated verification complete on branch `dev`. Live Google and external storage verification remain pending configuration. No Stage F functionality was implemented. No commit or deployment was made.

## Features implemented

- Google authorization-code OIDC with PKCE, state, nonce, explicit signature verification and verified-subject accounts.
- Persistent SQLite/Drizzle users, hashed server-side sessions, migrations, rotation, logout and active socket revocation.
- Profile name editing with optimistic version checks, Google picture fallback and public room profile updates.
- Gallery selection, zoom/reposition/crop, metadata-stripping JPEG/PNG/WebP processing, optimized profile/thumbnail images and private external S3 storage.
- Avatar replacement/removal with persisted upload intents and retryable cleanup; upload authorization rechecked after storage operations.
- Lazy profile dialog, account bootstrap, returning-account room recovery and explicit development-only guest mode.

## Files created

- `apps/server/src/auth/`: `accounts.ts`, `oidc.ts`, `routes.ts`, `accounts.test.ts`.
- `apps/server/src/avatars/`: `images.ts`, `storage.ts`, `images.test.ts`.
- `apps/server/src/persistence/`: `schema.ts`, `repository.ts`, `migrate.ts`.
- `apps/server/migrations/0000_stage-e-accounts.sql`, `meta/_journal.json`, `meta/0000_snapshot.json`.
- `apps/server/test-fixtures/provider.ts`, `e2e.ts`.
- `apps/web/src/auth/api.ts`, `GoogleButton.tsx`, `Profile.tsx`.
- `apps/web/e2e/profile.spec.ts`.
- `docs/ACCOUNTS.md`, `docs/STAGE_E_REPORT.md`.

## Files modified

- Root `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `vitest.config.ts`, `playwright.config.ts`, `README.md`.
- Server `package.json`, `tsconfig.test.json`, `src/app.ts`, `app.test.ts`, `config.ts`.
- Server `src/multiplayer/rooms.ts`, `routes.ts`, `projection.ts`, `support.ts`, `multiplayer.test.ts`, `support.test.ts`.
- Shared `src/protocol.ts`, `src/index.ts`.
- Web `src/App.tsx`, `App.test.tsx`, `styles.css`; components `Cards.tsx`, `GameTable.tsx`, `Home.tsx`, `Lobby.tsx`; game `client.ts`, `reducer.ts`, `reducer.test.ts`.
- Documentation `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `UI.md`, `MULTIPLAYER.md`, `GAME_STATES.md`.

Owner rules and engine implementation were unchanged. Historical stage reports remain intact.

## Tests executed and results

| Command/check                                                  | Actual result                               |
| -------------------------------------------------------------- | ------------------------------------------- |
| `npm test`                                                     | 101 tests in 10 files passed                |
| `npm run test:e2e`                                             | 10 Chromium checks passed                   |
| `npm run build`                                                | All four workspaces built                   |
| `npm run typecheck`                                            | Passed                                      |
| `npm run lint`                                                 | Passed                                      |
| `npm run format:check`                                         | Passed                                      |
| `npm audit --json`                                             | Zero reported vulnerabilities               |
| Compiled migration runner twice against one temporary database | Passed; file mode 0600                      |
| `npm ls better-sqlite3`                                        | Tested 12.11.1 dependency tree deduplicated |

New tests cover signed local OIDC and malformed signature/nonce/issuer/audience/expiry/subject responses, secure cookies, CSRF/Origin, persistent account sessions, ownership, logout and sockets, invalid uploads, cropping, metadata removal, thumbnails, storage failure cleanup and profile/logout races during uploads. Browser tests cover account login, Sinhala editing, crop/upload/removal/reload, returning identity, profile synchronization and narrow screens. Existing four-player full-round and hidden-card isolation tests remain passing.

The OIDC and S3 services in these tests are local fixtures. No real Google consent flow, cloud IAM, Safari, physical-device gallery or production deployment test was executed. A SQLite 13 native crash was resolved by using the tested 12.11.1 version. No migration generator is installed.

## Security observations

Production guests are forbidden. Sessions use opaque HttpOnly secure production cookies and hashed database credentials. Mutations require exact Origin and CSRF; logout revokes the active session/socket. Uploads are validated from bytes, decoded with bounded resources, stripped of metadata and stored externally; client-chosen ownership is prohibited. OAuth callback query parameters are removed from request logs. Hidden card projections and manual cheating behavior are unchanged. A zero-advisory dependency audit is not a complete security assessment.

## Performance observations

Initial JavaScript: 251.06 kB / 78.42 kB gzip. Lazy profile: 5.77 / 2.19 kB gzip. Table: 9.37 / 3.07 kB gzip. CSS: 25.35 / 6.90 kB gzip. Cached account identity avoids database work on normal card actions. Image uploads are bounded to two concurrent pipelines and six/minute/account. No load or device performance benchmark was executed.

## Unresolved questions

Google OAuth client/callback/consent settings and private avatar bucket/credentials are not configured in this workspace. Owner/cloud configuration is required for live verification. Existing rule questions in RULE_CLARIFICATIONS.md remain unresolved; no policies were invented.

## Known limitations

One process owns ephemeral rooms and scores; accounts/sessions persist separately. PostgreSQL needs an adapter and asynchronous integration changes. Avatar deletion retries cannot erase browser caches or backups immediately. HEIC is unsupported. Physical Android/iPhone, cloud availability, backup operations and production hardening are not established. Test fixture servers must never be used for hosting.

## Local testing instructions

See [Accounts setup](ACCOUNTS.md). Run `npm ci`, `npm run build`, copy `.env.example` to `apps/server/.env`, configure Google and optional S3 settings, then run `npm run db:migrate -w @omi/server`. Start `npm run dev:server` and `npm run dev:web` in separate terminals. Open http://127.0.0.1:5173. For fixture-based tests install Chromium with `npx playwright install chromium`, then run `npm test` and `npm run test:e2e`; loopback listening must be allowed. Explicit `ALLOW_GUESTS=true` supports development gameplay without Google, but does not verify account authentication.

## Recommended next stage

Stage F — Real-Time Voice Chat, only after explicit owner authorization. Development stops here.

# Stage J — Operations and release gates

## Status and runtime

Local hardening and automated verification are implemented. Public deployment is **not approved or verified**. The existing development environment deliberately fails deployment readiness; do not change its private settings merely to turn the gate green.

Use patched Node 22. `.nvmrc` and the package engine now require **22.23.4 or newer within Node 22**. Production startup and preflight reject older/unsupported versions. This baseline follows the official [2026-10-21 security release](https://nodejs.org/en/blog/release/v22.23.4). Recheck Node security updates before each release; a minimum version is not a future security guarantee. The Mac's global Node was left unchanged. A checksum-verified official Apple Silicon archive was extracted only under ignored `.remote-testing/tools` for local verification.

With an existing nvm installation:

```sh
nvm install
nvm use
node --version
npm ci
npm run build
npm run check:build
```

For this workspace's already downloaded test runtime, from the repository root:

```sh
export PATH="$PWD/.remote-testing/tools/node-v22.23.4-darwin-arm64/bin:$PATH"
node --version
```

The local tools directory is disposable and is not committed or published. Reproduce downloads only from the official distribution, checking its published SHA-256 before extraction. Native SQLite/Sharp dependencies must support the deployment platform; the existing binaries were exercised successfully on patched Node 22/macOS arm64.

## Configuration readiness

`npm run deploy:check -w @omi/server` loads the existing workspace environment without printing values and performs read-only checks for this project's **same-origin loopback NGINX** deployment:

- Patched Node 22, production mode, loopback host and explicit local proxy trust.
- Exact HTTPS origin, disabled guests, complete Google settings and `/api/auth/google/callback` on that origin.
- Avatar bucket and remote voice TURN configuration.
- Absolute database path outside the web workspace, an owner-only regular database file, integrity, expected tables and recorded migrations. A present `.env` must be owner-only and not a symlink.

The command returns nonzero if any check fails. A passing configuration **does not verify** Google registration, S3 permissions, TURN reachability, HTTPS termination, remote devices or owner game-rule decisions. The output explicitly says public verification was not performed. The local signed-provider fixture proves the gate can pass a complete synthetic configuration; it is never a public login alternative.

Actual development settings currently fail production/proxy/secure-origin-or-guests, avatar, TURN and absolute-database-path checks. Existing database integrity/migrations and owner-only file checks passed. A real public Google callback has not been verified. The historical credential exposure recorded in Stage F still requires owner confirmation that the exposed credential was revoked/rotated; no external credentials were changed in this stage.

## Process and hosting model

Use one persistent backend process; rooms, scores and deduplication state remain memory-only. Backend restart ends active rooms. SQLite preserves accounts/profiles/reports, not games. Do not put multiple independent replicas behind a load balancer.

Use the existing NGINX template and remote-testing supervisor for foreground Quick Tunnel testing, respecting the Google registration gate. Do not expose Vite, fixture providers, the repository, database, backups or development endpoints. Keep NGINX/backend bound to loopback; only the tunnel is public. No new public metrics endpoint exists.

The template now applies a microphone-self/camera-off/geolocation-off Permissions Policy and short HSTS only for configured HTTPS origins. HSTS has no includeSubDomains/preload. Local HTTP fixtures omit HSTS. Proxy headers remain overwritten at the trusted local boundary. API upstream cache/security headers are normalized so the proxy emits one policy; the backend's restrictive API CSP never replaces frontend HTML policy. Existing host-only Secure sessions, exact Origin/CSRF, private static-file denials and WSS upgrades remain intact.

`infra/launchd/com.omi.server.plist.example` is an **optional, syntax-checked template**, not an installed service. Replace absolute Node/repository/private-log paths, create owner-only log/data directories and review environment first. It runs unprivileged with a private umask and throttled restart. No credentials belong in a plist. It has not been installed, bootstrapped or reboot-tested. Do not run it alongside the foreground supervisor on the same backend port: choose one process owner. Configuring a persistent NGINX/tunnel service and accepting public access require a separate approved operation.

On SIGINT/SIGTERM, the server closes room/socket services and database/storage resources. It terminates game sockets still waiting on room attachment, handles one shutdown request and has a 35-second failure deadline. In-flight HTTP requests may drain before close. Startup bind failure closes resources and prints only a safe failure code. Tests verify a live upgraded connection cannot keep close waiting, and the compiled production runner exits cleanly on SIGTERM.

## Private monitoring

Production logging includes a `runtime_health` aggregate once per minute: interval request count, HTTP 5xx count, mean/max response duration, process RSS/heap, event-loop p99 and uptime. The histogram and timer stop on close. A test-only short interval verifies output and cleanup. Existing request logs include method, bounded path without query/fragment, response status and generated request IDs. The path serializer also covers WebSocket plugin logs. Headers, tokens, OAuth codes, session credentials, payloads, hands and raw signaling are not included in these new events.

Keep logs in an owner-only directory and rotate them; do not stream them to an unreviewed analytics service. Suggested operator alerts: failed health checks, repeated `login_failed`/`listen_failed`/`shutdown_timeout`, sustained 5xx, memory approaching the host budget or rising event-loop delay. These are operational signals, not proof of backend health or a benchmark threshold. `/health` intentionally returns only the public service contract; it does not probe Google/S3/TURN or certify readiness. External alert delivery and log rotation have not been installed or tested.

## SQLite backup and restore drill

Do **not** copy just the active main SQLite file. The implementation uses the [SQLite online backup mechanism](https://sqlite.org/backup.html) through better-sqlite3, including committed WAL data while the writer remains open. It reserves a new destination exclusively, refuses overwrite/symlinks/web-workspace output, uses mode 0600 and a bounded backup progress deadline, and verifies integrity, foreign keys, expected tables and migration tracking. The source is opened read-only. Parent directories must already exist; keep them owner-only. Failed newly created output is removed; existing files are never overwritten.

From repository root, using the patched runtime and existing DATABASE_PATH settings:

```sh
mkdir -p .remote-testing/backups
chmod 700 .remote-testing/backups
npm run db:backup -w @omi/server -- create "$PWD/.remote-testing/backups/omi-20261027.sqlite"
npm run db:backup -w @omi/server -- verify "$PWD/.remote-testing/backups/omi-20261027.sqlite"
npm run db:backup -w @omi/server -- restore-copy "$PWD/.remote-testing/backups/omi-20261027.sqlite" "$PWD/.remote-testing/backups/restore-drill.sqlite"
```

Choose a new filename each time. `restore-copy` creates a **new** verified file and removes sessions and OAuth transactions only from that copy, forcing fresh Google login so previously revoked sessions cannot revive. It does not overwrite, reconfigure or restart the running application. Current-schema backups are supported; old/future schema compatibility needs a separate migration plan. The CLI prints integrity/migration status only, never account or credential contents.

A tested restore drill includes existing users and migration rows, WAL-visible committed data, source preservation, independent later writes, correct permissions, refusal of overwrite/symlink destinations and invalidated sessions in the new copy. No real account database was restored or reset during Stage J. The real database was checked read-only by preflight.

For a real recovery, stop the owned backend, retain the damaged/original files untouched, verify a trusted backup, create the fresh restore copy, coordinate avatar storage recovery, set DATABASE_PATH to that new private absolute path, then run migrations/preflight and restart only when reviewed. Existing migration command is `npm run db:migrate -w @omi/server`; tests execute the compiled runner twice without resetting accounts. Never silently promote a restore copy into live use.

Backups contain personal data, CSRF values and temporary OAuth secrets; mode 0600 is **not encryption**. Local-only backups do not protect against Mac loss. Arrange an approved encrypted off-device copy and test decryption/recovery. Keep retention bounded (for example seven daily and four weekly copies within 28 days), with the report-retention/privacy policy applied to archives too. No deletion schedule or off-device transfer was installed. Avatar bytes remain in private external S3-compatible storage; database backups do not contain them. A consistent avatar restore requires an approved provider export/version-retention procedure coordinated with database backup/cleanup. S3 backup/IAM recovery remains unverified and no paid storage feature was enabled.

## Reproducible local checks

```sh
npm run build
npm run check:build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npm run test:e2e:nginx
npm run test:themes
npm run test:social
npm run test:voice
npm run test:voice:relay
npm run test:pwa
npx playwright test --config playwright.production.config.ts
npm run test:load -- 8 30
npm audit
```

Browser suites must run sequentially where ports overlap. Chromium/Firefox and existing loopback coturn are required for all listed browser suites. `test:infra` now requires a build and additionally tests the compiled migration/backup/restore/readiness/production shutdown runner in temporary directories. Node 22.23.4 is required for its production startup test. `test:load` creates only its own loopback test backend, temporary guest identities and in-memory database; it never starts the public tunnel or test provider online. See LOAD_TEST_REPORT.md and SECURITY_REVIEW.md for precise limits.

## Release gates still open

Use the patched runtime in the actual service, supply complete production configuration, confirm historical credential rotation, register/verify the exact Google public callback, verify HTTPS/WSS and forwarding at the public edge, exercise real avatar storage and recovery, validate remote TURN, test physical Android/iPhone/Safari installed-mode login/background reconnection and measure phone performance. Resolve the documented game-rule questions before enabling affected gameplay. No availability, production-security certification or remote-gameplay completion is claimed by local tests. No additional development stage is authorized automatically.

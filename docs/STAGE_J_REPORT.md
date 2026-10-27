# Stage J — Security, Testing, Optimization, and Deployment

## Completion status

**Hardening implementation and local verification are complete; production acceptance remains blocked.** Work stayed on `dev`, with an initially clean worktree. No commit, push, paid resource, public tunnel/deployment or service installation occurred. No OMI rules, scoring, owner-rule document, engine code, database schema or authentication provider were replaced. No production readiness is declared.

Current release blockers are explicit: production/proxy/HTTPS-and-guest configuration, an absolute database path, real avatar storage, remote TURN, public Google callback acceptance, historical credential revocation confirmation, physical-device/installed-app validation and external recovery/monitoring. Existing unresolved game rules still gate affected workflows. The task stops here; no subsequent stage or public operation is automatically authorized.

## Features implemented

- Reviewed existing OIDC/PKCE/state/nonce/signature/session/CSRF controls, authorization and hidden-card projections, socket sequence/version/idempotency checks, input/upload processing, private persistence, PWA/theme boundaries and reverse-proxy configuration.
- Raised `.nvmrc` and package runtime minimum to Node 22.23.4; production startup and read-only readiness reject older/unsupported runtimes. Downloaded the official arm64 archive and verified its published SHA-256 in ignored project-local tooling, leaving the global installation unchanged.
- Tightened the existing server `.env` from 0644 to 0600 using metadata-only inspection; contents were neither printed nor changed.
- Sanitized plugin `path` logging as well as request URLs, removing query/fragment and bounding length. Existing credential/header redaction remains.
- Added restrictive data-only API headers, production-only HSTS, HTTP header/keep-alive/request-reuse bounds and HTTPS-conditional HSTS/microphone-self Permissions Policy at NGINX. Upstream duplicate headers are normalized; frontend CSP remains separate and strict.
- Rejected userinfo in configured OAuth/storage URLs and unsupported loopback storage schemes without changing PKCE/redirect validation.
- Added private minute-level runtime aggregates, shutdown/startup failure events, explicit pending game-socket termination and a 35-second process shutdown deadline.
- Implemented WAL-aware owner-only backup, read-only verification and new-file restore copies that invalidate sessions/OAuth transactions without changing the source or active database.
- Added read-only deployment preflight and an optional launchd example; no daemon was installed.
- Added real multi-room load testing, static gzip budgets/server-marker/source-map checks, compiled migration/backup/restore/readiness/logging/shutdown tests and operational/security/release documentation.

## Files created

- `apps/server/src/ops/node.ts`, `runtime.ts`: patched-runtime gate, safe logging helper and private aggregate monitoring.
- `apps/server/src/ops/backup.ts`, `backup-cli.ts`: safe backup/verification/restore-copy operations.
- `apps/server/src/ops/preflight.ts`, `preflight-cli.ts`: read-only same-origin NGINX configuration gate.
- `apps/server/src/ops/ops.test.ts`: seven operational/security regressions.
- `infra/tests/load.ts`: private real-socket multi-room benchmark.
- `infra/tests/ops.test.mjs`: compiled CLI, migrations, restore, sanitized real plugin logs and SIGTERM test.
- `infra/scripts/check-build.mjs`: repeatable initial bundle budget and server-marker/source-map smoke gate.
- `infra/launchd/com.omi.server.plist.example`: optional uninstalled service template.
- `docs/OPERATIONS.md`, `SECURITY_REVIEW.md`, `LOAD_TEST_REPORT.md`, `STAGE_J_REPORT.md`.

## Files modified

- `.nvmrc`, root `package.json`, `package-lock.json`: Node floor and verification commands; no dependency versions changed.
- `apps/server/package.json`: backup/readiness/load commands.
- `apps/server/src/app.ts`: safe logger serializers, API response defaults, HTTP bounds and production monitoring.
- `apps/server/src/config.ts`: callback/storage URL validation.
- `apps/server/src/index.ts`: production runtime gate, bounded one-shot shutdown and safe startup failure cleanup.
- `apps/server/src/multiplayer/routes.ts`: terminate upgraded peers still waiting for room attachment on shutdown.
- `infra/nginx/omi-testing.conf`, `infra/tests/config.test.mjs`: conditional security headers and assertions, retained proxy/cache protections.
- `apps/web/e2e/nginx.check.ts`: actual Permissions Policy and local-HTTP HSTS omission assertions.
- `apps/web/e2e/voice.check.ts`: numeric/native-media state diagnostics on speaking-indicator failure; original assertions remain. No raw media, SDP, credentials or device IDs are added to diagnostics.
- `README.md` and docs `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `GAME_STATES.md`: current evidence, status and release gates.
- Ignored `apps/server/.env`: permissions only (0600), no content change. Ignored `.remote-testing/tools`: verified local runtime/archive/checksums and disposable test artifacts; not published or tracked.

## Tests executed and results

Final checks use Node **22.23.4** on macOS arm64 unless specifically noted.

| Verification                                                   | Actual result                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Official Node archive SHA-256                                  | Verified before extraction; local binary reports 22.23.4                                                                       |
| `npm run build`                                                | All workspaces passed                                                                                                          |
| `npm run check:build`                                          | Passed: JS 79,636 bytes gzip, CSS 8,040, combined 87,676; no public maps/server-only markers                                   |
| `npm run typecheck`                                            | Passed                                                                                                                         |
| `npm run lint`                                                 | Passed                                                                                                                         |
| `npm run format:check`                                         | Passed                                                                                                                         |
| `npm test`                                                     | 155 tests across 21 files passed                                                                                               |
| `npm run test:infra`                                           | 5 passed, including real compiled operations                                                                                   |
| `npm run test:e2e:nginx`                                       | 24 gameplay/profile/mobile/proxy checks passed                                                                                 |
| `npm run test:themes`                                          | 4 passed                                                                                                                       |
| `npm run test:social`                                          | 2 four-client journeys passed                                                                                                  |
| `npm run test:voice`                                           | 4 passed on final run                                                                                                          |
| Additional Firefox speaking test, `--repeat-each 3`            | 3 isolated repetitions passed with original assertions                                                                         |
| `npm run test:voice:relay`                                     | 4 real local coturn-relay/logout checks passed                                                                                 |
| `npm run test:pwa`                                             | 4 cache/offline/update/mobile checks passed                                                                                    |
| `npx playwright test --config playwright.production.config.ts` | 2 strict production CSP/render checks passed                                                                                   |
| `npm run test:load -- 8 30`                                    | Passed: 8 rooms/32 players/8 real rounds, duplicate/reconnect/privacy assertions and idle soak                                 |
| `npm audit --omit=dev --json`                                  | Zero reported vulnerabilities on review date                                                                                   |
| `npm audit --json`                                             | Zero reported vulnerabilities on review date                                                                                   |
| NGINX syntax validation in fixtures                            | Passed                                                                                                                         |
| `plutil -lint infra/launchd/com.omi.server.plist.example`      | Passed syntax; not installed or reboot-tested                                                                                  |
| Actual development `deploy:check` under patched runtime        | **Blocked as expected**, configurationPassed=false; database integrity/migrations/private permissions and patched runtime pass |
| `git diff --check`                                             | Passed                                                                                                                         |

There are 44 distinct passing browser checks across the final named suites, plus the three isolated Firefox repetitions. One earlier patched-runtime full-suite run failed the Firefox remote-speaking assertion after receiving RTP bytes. It did not recur in three isolated repetitions or the subsequent complete direct/relay runs. Root cause was not reproduced; diagnostics were added without weakening assertions, and the intermittent result remains a reliability limitation. An initial monitoring-unit assertion matched a normal request log before the aggregate; it was corrected to wait for the intended event and the suite was rerun. Early type/format issues were corrected. Sandbox-blocked audit/IPC operations were rerun with permitted network/local IPC access. Existing non-failing Vite future-native-loader and browser color-environment warnings remain.

Compiled tests run migrations twice, preserve a committed WAL user/session, create and verify a separate 0600 backup, produce a new restore with zero old sessions, preserve the source, pass synthetic complete readiness, and start/stop the actual compiled production runner. A real unsupported WebSocket upgrade with a synthetic query marker confirms the plugin's path log is sanitized. No real account database was reset, restored or migrated as a new operation; actual preflight reads it only.

Local signed OIDC/S3 fixtures verify the OAuth/security/profile flows; synthetic native microphone sources and real peer/TURN connections verify voice. These are not real Google, private cloud IAM, physical phones or public Internet evidence.

## Security observations

Full details and threat/evidence matrix are in SECURITY_REVIEW.md. Data-only API CSP is applied only to backend responses, preserving the frontend's policy and Vite/build behavior. NGINX emits HSTS only for configured HTTPS and keeps microphone access same-origin. Origin, CSRF, secure host-only sessions, signature/PKCE/state/nonce verification, resource limits, player-specific projections and private cheating evidence remain intact. No automatic cheating penalty/warning, alternative auth system, obfuscation security or payment flow was introduced.

Backups contain sensitive account/session/OAuth/report data; mode 0600 is not encryption. New restore copies clear session/OAuth rows to avoid reviving revoked credentials. Real encrypted off-device/avatar recovery remains unverified. A zero npm audit result is not a runtime or comprehensive security certificate; the outdated Node issue was found separately and addressed by the new gate and tested local runtime. The Mac's global runtime is still old until the operator activates an approved patched one.

## Performance observations

The patched-runtime load run completes eight full rounds/320 acknowledged operations with eight duplicate checks, eight own-hand reconnects and 1,704 private-field wire checks. Action p50/p95: **1.12/2.31ms**. Event-loop p99: **22.05ms** at 20ms resolution. Peak **combined server-and-Node-client RSS: 205.2MiB**. It includes a 30-second **idle ping/pong soak after gameplay**, not sustained gameplay for that duration. Default rate/resource limits are unchanged; eight rooms stay within the single-IP HTTP budget.

The static initial gzip budget is 90KiB JS, 12KiB CSS and 100KiB combined; actual combined bytes are 87,676. No frontend runtime feature or dependency was added in Stage J. Production monitoring logs aggregate once per minute and has bounded histogram/counters. No phone CPU/FPS/battery/data, public latency, NGINX/tunnel capacity, OIDC/S3/voice load or long-duration benchmark was performed. See LOAD_TEST_REPORT.md.

## Unresolved questions and release blockers

Owner-defined dealer rotation, accusation/report windows, repeated draws and bonus combinations remain unresolved as previously documented. Public Google callback registration, historical secret rotation confirmation, actual patched service activation, production configuration, S3 IAM/storage/export recovery, external TURN and external monitoring require owner/external-state work. Physical Android/iPhone/Safari installed-mode login, safe areas, background reconnection and remote four-friend play remain unverified.

## Known limitations

One memory-only backend instance; restart ends rooms. SQLite backup preserves accounts/reports, not games or avatar objects. Only current-schema verified backups are supported. Local proxy trust assumes other local processes are trusted. Existing P2P revocation/moderation limits remain. Optional launchd and external backup/alert rotation are documented templates/procedures, not installed services. The intermittent Firefox speaking result is explicitly retained as a caution; a longer soak on real devices is still required. These limits and failed deployment preflight prevent a production-readiness claim.

## Instructions for local testing

Activate the patched runtime (`nvm install && nvm use`, or the already verified local tools PATH in OPERATIONS.md), then:

```sh
npm run build
npm run check:build
npm run start -w @omi/server
```

In a second terminal using the same selected runtime, with port 5173 free:

```sh
npm run preview -w @omi/web -- --port 5173 --strictPort
```

Use existing private configuration and exact APP_ORIGIN. Preview is loopback-only testing, not public hosting. Run the commands in the verification table sequentially for shared fixture ports. `deploy:check` is read-only and currently expected to refuse readiness; do not disable safeguards to pass it. OPERATIONS.md provides exact backup, new-copy restore, monitoring, runtime and release instructions. No public tunnel or service should be activated without a separately reviewed operation.

## Recommended next step

No next development stage starts automatically. Resolve the documented release gates, then request an explicit public/device validation milestone. Stage J local implementation stops here; production acceptance remains open.

# Remote testing troubleshooting

## Startup failure repaired

The private diagnostic showed `Production requires Node 22.23.4 or a newer patched Node 22 release`, followed by `Node.js v22.13.1`. The exception comes from `apps/server/src/index.ts` after environment parsing and before `buildApp`, SQLite initialization, session registration or port binding. The supervisor's old preflight accepted Node 22.13+, and launched the backend with its own `process.execPath`. Production build and migrations succeeding did not establish runtime compatibility. The actual deployment failure was the runtime mismatch, not the separate manual diagnostic using HTTP origins.

The production guard remains enforced. The startup wrapper first uses a supported standard Node 22 installation on PATH. Only if PATH has no compatible runtime does it fall back to the existing official Apple Silicon Node 22.23.4 distribution under `.remote-testing/tools`. “Patched” means an official security release, not a custom build; no private installation is inherently required. It never downloads or installs anything. To select another installed runtime explicitly, use `OMI_NODE_BINARY=/absolute/path/to/node infra/scripts/start-remote-testing.sh`. The supervisor rejects unsupported runtimes against `.nvmrc` before starting services and prepends its own Node directory to PATH for npm/build/migration children. Global Node is unchanged. If the private runtime is absent, install/select a trusted patched Node 22 runtime meeting `.nvmrc`; an older system Node now fails immediately.

## Configuration and startup

Keep `apps/server/.env` private (mode 600). Required for this launcher: `GOOGLE_CLIENT_ID` (Google web client ID), `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` together. Do not paste their values into issue reports. `ALLOW_GUESTS` must be false and `HOST` must be `127.0.0.1`. Backend `PORT` defaults to 3000; `OMI_NGINX_PORT` defaults to 8080. The launcher resolves relative `DATABASE_PATH` from `apps/server`, preserving the existing database. Never delete SQLite to resolve startup errors.

During deployment the launcher sets `NODE_ENV=production`, `TRUST_LOCAL_PROXY=true`, `HOST=127.0.0.1`, and `ALLOW_GUESTS=false`. It replaces `APP_ORIGIN` and `GOOGLE_CALLBACK_URL` using the actual HTTPS URL issued by Cloudflare. The callback is `APP_ORIGIN` plus `/api/auth/google/callback`. Manual production backend starts must supply valid HTTPS values too. Optional avatar storage and TURN variables are independent feature requirements; see OPERATIONS.md and VOICE.md. No external TURN relay is configured by this repair.

1. On branch `dev`, run `infra/scripts/start-remote-testing.sh` from the repository root. Keep the supervisor terminal open.
2. Wait for backend health and the public maintenance-gate check. The public application remains closed (503). Copy the exact Google callback printed by this running supervisor.
3. In Google Cloud Console, select the existing project, open Google Auth Platform → Clients (or APIs & Services → Credentials), and edit the OAuth **Web application** client matching your private client ID. Add the exact printed callback to **Authorized redirect URIs**, including HTTPS and `/api/auth/google/callback`. If the client uses Authorized JavaScript origins, add the printed HTTPS origin there. Do not add wildcards or guess the hostname. In testing mode, ensure all intended accounts are permitted test users under the OAuth consent/audience configuration. Save and allow configuration propagation.
4. Only after registration is confirmed, run `infra/scripts/start-remote-testing.sh --activate-google-registered` in a second terminal. This opens the application; inspect the original supervisor for verification results. Never expose the Vite development server.
5. Open the printed HTTPS URL, sign in with Google, refresh to verify persistence, sign out, and sign in again. This is the first real-provider verification; local fixtures do not prove real Google login.
6. **Current product limit:** production has no approved ordinary next-dealer policy or terminal match/tie policy. Next-round continuation is deliberately blocked; do not promise a complete match until those owner decisions are implemented and tested (see OMI_REMAINING_WORK_AUDIT.md and RULE_CLARIFICATIONS.md). For a controlled single-round test, invite three friends using the same current HTTPS URL and a room invite/code. Use four distinct authenticated accounts. Confirm four seats/opposite teams, reject a fifth seat, ready all four players, play a complete round, and check scores, reconnect, chat and voice on the actual networks/devices. A complete match and next-round flow require the rule decisions above. A passing local round test does not certify an external complete match.
7. Stop with Ctrl-C in the supervisor or `infra/scripts/stop-remote-testing.sh`. The connector closes first, followed by owned backend/NGINX processes. No database is deleted. A new tunnel normally needs a new Google redirect registration. Old redirect entries can be removed manually from Google later.

## Health and transport checks

- Backend: `curl --fail http://127.0.0.1:3000/health` (substitute configured PORT). Expected service `omi-server`, status `ok`.
- Closed local NGINX gate: `curl --fail http://127.0.0.1:8080/_omi/health`. Expected `awaiting-oauth-registration`; `/` and `/api/auth/session` must return 503. NGINX configuration is syntax checked automatically before launch and activation.
- Cloudflare: `infra/scripts/check-remote-testing.sh` checks the current recorded public origin. While closed, it verifies maintenance health and API denial; it does not certify OAuth/gameplay. After explicit activation it checks compiled assets, API authorization, foreign Origin denial and private paths.
- Inspect listeners locally with `lsof -nP -iTCP:3000 -iTCP:8080 -sTCP:LISTEN`. Both must bind 127.0.0.1, not a wildcard. Cloudflare targets local NGINX, not Node directly.
- For manual NGINX inspection use its exact private run configuration and prefix from `.remote-testing/current.json`; do not reload/stop a system-wide NGINX service.

## Private diagnostics and common failures

Managed service failures identify `backend`, `nginx` or `cloudflared`, their exit code, termination signal, and spawn error code when applicable. `.remote-testing/last-service-error.log` contains only allowlisted operational summaries and service status (mode 600, parent directory 700). Stream processing is bounded; arbitrary stdout/stderr, OAuth responses, cookies and tokens are not persisted or printed. Unknown failures deliberately yield a generic summary. Existing historical diagnostic files may contain raw sensitive output: inspect locally before sharing and never commit them.

- Runtime rejection: select the patched runtime as above; never remove the backend production check.
- `ENOENT` spawn/command failure: verify Node, npm, NGINX and cloudflared installation and PATH. Missing modules require a correct dependency installation/build, not disabling authentication.
- Occupied loopback port: inspect the listener or choose separate unused unprivileged ports. The launcher does not stop unrelated processes.
- Database open/permission failure: verify DATABASE_PATH, existing database permissions and parent directory access. Preserve the file and use WAL-aware backups (OPERATIONS.md).
- Environment validation: configure all three Google variables, production HTTPS origin/callback, and loopback proxy trust. Do not print the environment or secrets to debug it.
- No Quick Tunnel URL or unreachable gate: inspect connectivity/firewall and cloudflared installation. The launcher rejects inherited `TUNNEL_*` overrides and conflicting default cloudflared configuration. Do not bypass the maintenance gate.
- Google `redirect_uri_mismatch`: register the exact callback for the current running tunnel on the matching Web client. Restarting a Quick Tunnel can change its hostname. Never bypass registration/state/PKCE checks.
- Deployment record exists: run the stop script. It validates process identity before signaling; if stale it removes only the record. Never use `killall`, broad `pkill`, or remove live state manually.

No local automated suite proves real Google login, public WSS gameplay, Internet voice connectivity or a full match with four remote users. Keep those release gates explicit.

## Repair verification (2026-10-27)

Verified with the existing project-local Node 22.23.4 runtime: production build, typecheck, lint, production bundle privacy/size check; 205 unit/integration tests; 90 focused security tests (a subset of the full suite); 11 infrastructure tests including production startup with synthetic Google configuration and disposable SQLite, runtime rejection, split/bounded secret-safe diagnostics, spawn failure, exit status and termination signal. Chromium and Firefox passed 26 NGINX/game/profile/mobile/sound tests, four voice tests using synthetic audio, two social tests, and four navigation/matchmaking tests. OAuth browser tests use a local signed identity provider, not Google.

A temporary real Cloudflare Quick Tunnel reached the closed maintenance-gate-ready state with the actual private Google settings, successful build/migrations and healthy production backend. Node listened on 127.0.0.1:3000 and NGINX on 127.0.0.1:8080. The HTTPS active NGINX configuration also passed syntax validation without opening access. Public gate health and API denial were verified. The tunnel and owned services were stopped; deployment state was removed. SQLite integrity and a private before/after fingerprint confirmed all existing user records unchanged.

Current effective configuration lacks AVATAR_BUCKET, VOICE_STUN_URLS, VOICE_TURN_URLS and VOICE_TURN_SECRET: avatar uploads are disabled, and Internet voice traversal/reliability is not established. TURN provisioning requires a separately authorized provider/server configuration; this repair does not invent credentials or provision external services. Real Google login/refresh/logout, public authenticated WSS, physical-device audio, Internet four-player play and a complete match are **NOT VERIFIED**. Complete-match progression is additionally blocked by the intentional unresolved rules described above. Public application access was never activated, and Google Console was not changed.

## Standard Node installation compatibility follow-up

Node 22.23.4 is an official LTS security release ([release notes](https://nodejs.org/en/blog/release/v22.23.4)); Node 22 is maintained through 2027-04-30 ([official schedule](https://github.com/nodejs/Release/blob/main/schedule.json)). The existing local archive was checked again against the SHA-256 published in the official release notes, and the installed executable matched the archive byte-for-byte. Its private filesystem location has no special runtime behavior. A standard official installation of the same compatible Node 22 release works with the existing security guard and dependencies. Node 24/26 are not currently accepted by this repository's engine range and have not been certified by this repair.

The launcher now prefers compatible Node on PATH over the local fallback. An explicit `OMI_NODE_BINARY` remains authoritative and fails rather than silently switching runtimes. Build/migration/backend children use the chosen runtime. No global Node installation, database, branch or credential configuration is changed.

With a compatible standard installation already selected:

```sh
cd ~/Desktop/OMI
node --version # Must satisfy >=22.23.4 <23
infra/scripts/start-remote-testing.sh
```

For the existing verified official distribution on this Mac (works with the older global Node unchanged):

```sh
cd ~/Desktop/OMI
export PATH="$PWD/.remote-testing/tools/node-v22.23.4-darwin-arm64/bin:$PATH"
node --version
infra/scripts/start-remote-testing.sh
```

Alternatively select any installed compatible binary explicitly: `OMI_NODE_BINARY=/absolute/path/to/node infra/scripts/start-remote-testing.sh`. Keep access closed until the exact newly printed OAuth callback is registered, then use the separate activation command described above. `infra/scripts/check-remote-testing.sh` verifies the maintenance gate; `infra/scripts/stop-remote-testing.sh` stops the owned deployment.

Fresh follow-up verification passed: production build, bundle check, typecheck, lint, all 205 unit/integration tests, 90 focused security tests, 13 infrastructure tests (including standard PATH preference and invalid explicit executable handling), and 26 Chromium/Firefox NGINX tests. The temporary Cloudflare deployment again reached closed-gate readiness; backend health, loopback-only listeners and both local/public application/API/private-file blocking were checked, then the deployment was stopped without activation.

The actual `npm run deploy:check -w @omi/server` command was run with the supervisor's effective production settings and actual tunnel origin. It returned exit code 1: ten checks passed, while `avatar-storage-configured` and `remote-voice-turn-configured` failed. Missing configuration is AVATAR_BUCKET and the VOICE_TURN_URLS / VOICE_TURN_SECRET pair; these require real services, not placeholder values. This is a remaining feature/readiness gap, not a backend startup compatibility failure. Real Google login and public authenticated multiplayer remain unverified. No standard global installation was upgraded; the original global Node 22.13.1 remains below the application's production baseline.

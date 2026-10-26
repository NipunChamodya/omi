# Free Cloudflare multiplayer testing

## Status and scope

This infrastructure milestone implements a working local production-build → standalone NGINX → Fastify setup and real Cloudflare Quick Tunnel startup. Public multiplayer is **blocked pending Google callback registration and successful interactive sign-in**. The actual issued hostname reached HTTPS during verification, but Google's authorization page returned `redirect_uri_mismatch`. This is not proof that Google bans every trycloudflare.com hostname. No public four-player game or physical phone test has been completed. The verification tunnel was stopped after cleanup testing; its old hostname is no longer live. A new start prints a new hostname. See [detailed test report](CLOUDFLARE_TEST_RESULTS.md).

The frontend/backend/game engine architecture is unchanged. No Stage F, alternative authentication, paid resources, global Homebrew service, router forwarding, commit or push is included. Initial findings are in [CLOUDFLARE_INSPECTION.md](CLOUDFLARE_INSPECTION.md).

## Prerequisites and installation

Use macOS, Homebrew, Node **22.13 or newer within major 22**, npm, git and the existing project dependencies. The machine used for verification is Apple Silicon. Detect rather than assume the Homebrew prefix:

```sh
command -v brew
brew --prefix
node --version
npm --version
command -v nginx
nginx -v
command -v cloudflared
cloudflared --version
```

If missing:

```sh
brew install nginx cloudflared
```

Do not run `brew services start nginx` or overwrite the global Homebrew NGINX configuration. The project invokes a standalone foreground NGINX with its own generated configuration and private prefix. Homebrew installed nginx 1.31.8 and cloudflared 2026.10.3 during this milestone; its dependencies were managed by Homebrew.

From this repository on `dev`, run `npm ci` if dependencies are absent. Install browser binaries only for verification: `npx playwright install chromium firefox`.

## Configuration and persistence

Inspect your existing `apps/server/.env`; do not overwrite it. If it does not exist, copy the safe root `.env.example` and configure it privately. Never put secrets in frontend variables, Git or shared screenshots. `infra/remote-testing.env.example` contains comments only and is not sourced.

| Setting                                         | Behavior                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET         | Required existing Google **Web application** credentials, loaded privately from server .env or process environment. The supervisor requires them before creating a tunnel.                                                                               |
| GOOGLE_CALLBACK_URL                             | Must be present in existing account configuration. At runtime the supervisor derives the exact public `/api/auth/google/callback` from Cloudflare's actual output, without overwriting .env. That newly issued callback must be registered in Google.    |
| HOST                                            | Must be 127.0.0.1. The managed backend is always bound there.                                                                                                                                                                                            |
| PORT                                            | Backend port from existing configuration, default 3000. Must be free. An explicit shell override can select another free unprivileged port.                                                                                                              |
| OMI_NGINX_PORT                                  | New supervisor option; default 8080. Unprivileged loopback-only NGINX listener; must differ from PORT and be free.                                                                                                                                       |
| APP_ORIGIN                                      | Runtime value derived from the actual HTTPS tunnel origin. Existing local .env value is preserved.                                                                                                                                                       |
| NODE_ENV / ALLOW_GUESTS                         | Supervisor forces production / false. Preflight refuses existing ALLOW_GUESTS=true instead of silently accepting it. No guest fallback or fixture identity provider is available publicly.                                                               |
| TRUST_LOCAL_PROXY                               | New backend option, default false. Supervisor sets true; allowed only with HOST=127.0.0.1. Fastify trusts only the immediate IPv4 loopback peer.                                                                                                         |
| DATABASE_PATH                                   | Existing SQLite path, resolved relative to apps/server unless absolute. Default apps/server/data/omi.sqlite. Keep outside public files. The existing migration command runs with this exact resolved path. No reset, replacement or deletion occurs.     |
| AVATAR_BUCKET / AVATAR_REGION / AVATAR_ENDPOINT | Existing optional private S3-compatible storage configuration; region defaults to us-east-1. No new storage account or paid resource is created. Without a configured bucket, custom upload is unavailable and Google fallback pictures remain possible. |
| AWS credentials                                 | Existing server-only AWS SDK default credential chain. Never copied to frontend configuration.                                                                                                                                                           |
| VITE_API_URL                                    | Supervisor build override is the actual HTTPS origin plus /api, providing an explicit exact HTTPS/WSS CSP allowlist. Requests remain same-origin. Do not manually put localhost in the public build.                                                     |
| API_PROXY_TARGET                                | Existing Vite development setting; unused by NGINX production hosting.                                                                                                                                                                                   |

All runtime state, staged static files and process metadata are under ignored `.remote-testing/` with a private 0700 parent and restrictive umask. Credentials are passed as child-process environment, not command-line arguments or saved runtime files. Existing Cloudflare configuration is inspected for interference; the script refuses default home config rather than deleting or changing it. Unset inherited `TUNNEL_*` overrides before starting.

SQLite preserves mode 0600, WAL and migration tracking. Migrations run through `npm run db:migrate -w @omi/server`; startup also applies them idempotently. Do not start a second backend against an actively used deployment database. Account persistence does **not** preserve rooms: restarting ends active rooms/scores and retained action receipts. Reconnect works only while the relevant in-memory room and valid account session survive. Backups and recovery remain a separate hardening task; never copy a live WAL database casually.

## Starting and registering Google

1. Stop your own local development backend if it occupies the configured port. The scripts refuse conflicts and never kill unrelated applications. Keep the Mac awake, powered and connected during play.
2. Start the supervisor in a terminal:

```sh
cd ~/Desktop/OMI
infra/scripts/start-remote-testing.sh
```

It verifies branch/tools/auth configuration/ports, validates NGINX, starts a **closed maintenance gate**, starts cloudflared, captures its actual hostname, builds production assets for that hostname, stages only static output, runs migrations and starts the production backend. It does not expose the app yet. The initial gate permits only `/_omi/health`; all other paths return 503. Creating this gate is necessary because the hostname does not exist before cloudflared starts. No Vite process is published.

If you intentionally need a different local port, set it explicitly. For example, when the original development backend must remain untouched, use a **separate private verification database** rather than sharing its live state:

```sh
PORT=3001 DATABASE_PATH="$PWD/.remote-testing/verification.sqlite" infra/scripts/start-remote-testing.sh
```

This separate database does not import existing accounts; new logins populate it. Ordinary use should retain the configured existing database after stopping its other backend. No existing file is overwritten in either case.

3. Copy the **actual URL and callback printed by the supervisor**. Do not substitute a documentation hostname. In [Google Auth Platform Clients](https://console.cloud.google.com/auth/clients), select the existing Web OAuth client and register the exact printed callback. It includes `/api/auth/google/callback` with no trailing slash. The browser origin has no path. This app uses server-side OIDC, not a Google JavaScript SDK; an authorized JavaScript origin alone does not register the required redirect URI. If Google asks for that origin, use the exact HTTPS origin. Configure consent/test-user access for the four accounts as applicable.
4. Google must accept the hostname and URI. Its rules require an exact registered redirect and permitted HTTPS domains. A generated URL is **not** evidence of OAuth acceptance. If Google refuses the temporary domain, **stop**; do not change PKCE/state/nonce/signature checks, disable cookies/CSRF or expose the local mock identity provider. A domain you already control with a named tunnel, a Google-supported testing arrangement, or a separately approved/reviewed private test-auth design are possible next decisions. None is automatically implemented and purchasing a domain is not required by these scripts. See [Google redirect URI rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation) and [OAuth domain policy](https://developers.google.com/identity/protocols/oauth2/policies).
5. Only after real Console acceptance, explicitly request activation in another terminal:

```sh
infra/scripts/start-remote-testing.sh --activate-google-registered
```

This is your assertion that registration succeeded, not an automated Google Console change or proof of completed login. NGINX is revalidated before its managed child reloads. The supervisor checks HTTPS/static assets, account bootstrap, foreign-Origin rejection, unauthenticated room denial and private paths. It deliberately says that interactive login remains unverified. 6. Open the printed URL, complete Google login, reload, edit your name, sign out and sign back in. Confirm account restoration. Check from mobile data or a friend's network before claiming remote readiness. If Google reports mismatch/invalid domain/consent errors, keep the game private and stop this deployment until resolved. A successful `/auth/session` response is not a successful login.

Quick Tunnel hostnames change after restart. Each new hostname requires a new build, Origin/callback configuration and Google registration. The supervisor handles the build/runtime values; it cannot register or approve your Google client for you. Do not reuse yesterday's invitation URL.

## NGINX and network security

`infra/nginx/omi-testing.conf` is a full standalone template, not a global include. Generated configurations use absolute paths and explicit loopback ports. Validation is equivalent to:

```sh
nginx -t -p /absolute/private/runtime/ -c /absolute/private/runtime/nginx.conf
```

The supervisor prints the actual path and runs that command before starting or reloading NGINX. Do not launch a tunnel on failed validation.

Only staged compiled frontend files are served. SPA routes fall back to index.html; unknown API paths do not. Hidden files, source code locations, maps, SQLite/private-key/config extensions and development URLs return 404. Only real backend routes are proxied after stripping `/api`; the frontend's existing authenticated `/transport/session` call remains necessary, but production rejects guests. `/api/rooms/:roomId/ws` uses HTTP/1.1 upgrades, buffering off and 90-second idle timeout with the existing 30-second heartbeat. Cloudflare provides HTTPS/WSS externally; both internal listeners bind only to 127.0.0.1. No router changes are made.

Cloudflare edge supplies CF-Connecting-IP to local cloudflared. NGINX trusts that header only from the loopback connector and overwrites X-Forwarded-For with the resulting single client address; it does not append visitor-supplied chains. It sets Host, forwarded Host and scheme from the captured origin. Fastify trusts only the immediate loopback proxy; other peers' forwarding headers are ignored. Other local processes run by users on this Mac are within this trust boundary. Authentication/callback URLs remain based on configured origin, not these forwarded headers. Foreign/missing Origin and session/CSRF checks remain intact.

Static CSS/JS uses gzip; fingerprinted assets are immutable-cached. HTML revalidates; API/private responses use no-store and proxy caching/buffering/compression are disabled. Uploads have a 5 MiB proxy envelope around the existing 4 MiB file cap. One worker, 256 NGINX connections and existing bounded backend queues/sessions limit local resources. No Redis, containers, polling gameplay, new database connections per card or full-state card broadcasts were added. Access logging is disabled to avoid OAuth-query capture. Backend request paths are already query-stripped; supervisor does not print raw service logs or credentials.

The production build retains its full CSP meta policy with exact HTTPS/WSS API origin; NGINX adds only `frame-ancestors 'none'` as a complementary HTTP policy. There is no conflicting script restriction, unsafe-inline/eval exception, HMR or Vite client on the public server. Secure host-only __Host cookies, HttpOnly, Lax, Path=/, rotation, logout revocation and CSRF are unchanged.

## Inviting friends and playing

After Google login and external connectivity are actually verified, send three friends the current public HTTPS URL. Each uses a different Google account and independent browser profile. Four tabs sharing one account do not become four players. Create a private table, share its eight-character room code or current invite link, then have the other accounts join. All four ready up; the host starts. Follow the interactive cut, eligible trump selection and server turns through all eight tricks. Each player sees only their own hand.

Refresh/reconnect restores the still-live seat with the same valid account. Another tab for that identity replaces its old connection. Restarting the Mac/backend ends rooms; accounts remain. Existing unresolved dealer/accusation/no-trump/scoring clarifications remain gated. A first completed round does not establish owner policy for normal next-round dealing.

## Checking and shutting down

```sh
infra/scripts/check-remote-testing.sh
```

Before activation, this checks only the public maintenance gate and confirms application access is closed. After activation it verifies public assets/API/security prerequisites, not real login or four external players. The supervisor must remain in its original terminal.

Ctrl-C in that terminal shuts down only managed services. Alternatively:

```sh
infra/scripts/stop-remote-testing.sh
```

The stop script verifies the saved supervisor PID/start time before signaling it, waits for exit, and never sends commands to a global NGINX service. The supervisor stops its connector first, then its backend/NGINX child handles. It retains all databases and private runtime directories; no credentials, accounts or Cloudflare configuration are deleted. If the saved process is gone, stop removes only the stale process record. A forced SIGKILL/power failure cannot run cleanup; inspect leftover listeners/processes manually rather than killing guessed PIDs or deleting data. Closing the connector invalidates its temporary URL.

## Automated and manual verification

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npm run test:e2e:nginx
```

The NGINX browser suite requires the default same-origin `/api` production build (`VITE_API_URL=/api npm run build`), free local ports 8082/3100 and permission to bind local sockets/start browsers. It runs Chromium and Firefox with real NGINX and the existing **loopback-only** signed OIDC/S3 fixtures. Public scripts cannot select those providers. Output is isolated under ignored `.remote-testing/browser-results`.

Actual verification for this milestone: build/typecheck/lint/format passed; 106 unit/integration tests passed; four infrastructure configuration tests passed; 24 NGINX Chromium/Firefox browser checks passed. Four independent contexts played complete real engine rounds and reconnected. Local production-backend probes confirmed secure OAuth cookie attributes, guest denial, unauthenticated room refusal, foreign-Origin rejection and private-path 404s. Real public HTTPS maintenance requests passed. Google's real authorization page returned `redirect_uri_mismatch`; interactive public login/logout/session restoration and external devices remain unverified. The original `npm run test:e2e` was attempted but correctly refused to reuse the owner's occupied port 5173; no existing process was killed. Existing gameplay/profile flows were instead executed through NGINX in both engines. The first NGINX regex draft failed syntax validation and was corrected before any application activation.

## Troubleshooting

| Symptom                                 | Checks / resolution                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blank white screen                      | Check HTML/JS status and production CSP in Network. Ensure the staged build uses the current hostname. `/@vite/client` and `/src/main.tsx` must be 404 publicly. Do not remove CSP; see CSP_FIX_REPORT.md. |
| 502                                     | Confirm the managed backend is alive on its configured loopback port and /health responds locally. Do not expose the backend as a shortcut.                                                                |
| 503 before activation                   | Expected maintenance gate. Finish actual Google registration and explicitly activate; no guest bypass exists.                                                                                              |
| 404                                     | Verify current public hostname, `/api` prefix, allowlisted route and generated NGINX config. Source/private paths intentionally return 404; SPA fallback must not swallow API errors.                      |
| WebSocket failure                       | Confirm wss URL `/api/rooms/:roomId/ws`, exact Origin, session/member identity, HTTP 101 upgrade and 90s proxy timeout. Check current build origin. Replaced tabs close the older socket intentionally.    |
| Google redirect mismatch                | Register the exact current `/api/auth/google/callback` on the same Web OAuth client. Origin-only registration is insufficient. Every restarted Quick Tunnel changes the hostname.                          |
| Google invalid domain / consent refusal | Stop the public path. Do not disable validations. Ask for an approved supported domain/testing arrangement; do not publish fixture authentication.                                                         |
| Cookie rejected                         | Use the exact HTTPS public origin and one hostname consistently. Inspect Secure/HttpOnly/host-only Path=/ attributes. Do not remove Secure to accommodate HTTP.                                            |
| CSRF / Origin error                     | Refresh the account session and use its current token. Keep browser/API same-origin; do not spoof Origin or broaden CORS.                                                                                  |
| Room joining fails                      | Use the eight-character code for the current running backend, a separate valid account and a free seat. Four players maximum; one identity can occupy one live room.                                       |
| Reconnect fails                         | Confirm original account session and backend process survive. Backend restart cannot recover in-memory rooms. Cloudflare disruptions may require reload; new hostname means new cookies/login.             |
| Tunnel disconnects                      | Check internet/Mac sleep and supervisor terminal. Stop safely and restart; register the newly issued hostname again. There is no uptime guarantee.                                                         |
| Port occupied                           | Stop your own development process manually or select a separate port and verification database. No automatic kill or reuse occurs.                                                                         |
| Existing cloudflared config             | Inspect it privately. The script refuses conflicting default config; it does not rename/delete credentials or silently use a named tunnel.                                                                 |

## Costs and limitations

The intended setup uses free local software and Cloudflare Quick Tunnels, with no account/domain purchase required for the tunnel itself. This does **not** guarantee Google's acceptance of a temporary OAuth hostname. Cloudflare currently documents temporary hostnames, no uptime guarantee, 200 in-flight requests and no SSE; WebSocket gameplay is separate from SSE. Service policies/availability can change. No unlimited bandwidth, permanent free hosting or production readiness is promised. See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Mac electricity, internet/mobile-data usage and any existing optional avatar storage have their own costs. No avatar bucket or paid resource is provisioned here. Google Console configuration, actual login and four real devices/networks remain manual acceptance steps. If temporary domains are refused, this milestone remains blocked for public play until the owner approves a viable authentication/domain arrangement.

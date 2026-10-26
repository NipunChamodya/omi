# Cloudflare multiplayer infrastructure — verification report

## Outcome

Local infrastructure implementation and tests passed. **Full remote multiplayer acceptance is blocked**, because Google returned `redirect_uri_mismatch` for the issued callback. No completed public login or four-player external game was verified. No alternative authentication was introduced.

## A. Infrastructure

- Started on `dev` with a clean worktree; all requested documentation was present. No main checkout, commit or push occurred.
- Homebrew prefix detected as `/opt/homebrew`; installed nginx 1.31.8 and cloudflared 2026.10.3. No global service/configuration was started or overwritten.
- Standalone NGINX serves only compiled/staged assets, strips the verified `/api` prefix for real backend routes and supports `/api/rooms/:roomId/ws` upgrades.
- Actual public tunnel issued `https://proposal-llc-cure-benjamin.trycloudflare.com`. HTTPS maintenance health returned 200 and application paths remained 503. This historical hostname was captured from cloudflared, not invented.
- Existing backend port 3000 was occupied and left untouched. Verification used backend 3001, NGINX 8080 and a separate private `.remote-testing/verification.sqlite`; existing accounts/database were not reset or replaced.
- Managed supervisor shutdown was executed successfully. Ports 3001/8080 and fixture ports 8082/8083 were released; the original local backend remained on 3000. The temporary URL is no longer live. Application data was retained.

## B. Authentication

Production-mode probes through a separate loopback NGINX confirmed account bootstrap 200, guests disabled, unauthenticated room creation 401, foreign Origin 403, and secure host-only HttpOnly OAuth binding cookies. Existing account, PKCE, state, nonce, signature, CSRF, session persistence, logout and upload tests passed.

Google's real authorization page returned `redirect_uri_mismatch` for the generated callback; no login was completed. No `invalid_client` or `invalid_domain` classification was observed in that probe, but this does not establish acceptance of a temporary domain. Actual Console registration/consent settings and completed login are still owner-controlled requirements. The previous temporary hostname cannot be reused after shutdown.

## C. Security

Only the maintenance gate was exposed publicly during verification. Loopback NGINX/backend listeners, private staged static files, default-deny private/development paths, no-store API responses, bounded uploads and serialized game actions were retained. Forwarded chains are overwritten by NGINX and Fastify trusts only its immediate loopback peer when explicitly configured; other local processes remain within the trusted machine boundary. CSP remains production-restrictive without inline/eval exceptions. No mock provider, guest fallback, database, repository, cloud credentials or Vite process was published.

This is not Stage J or a production security certification. Live Google session cookies, live-avatar cloud IAM, external network reconnect behavior and physical devices remain unverified.

## D. Testing

| Verification executed                         | Result                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run build`                               | Passed; all workspaces and compiled frontend                                |
| `npm run typecheck`                           | Passed                                                                      |
| `npm run lint`                                | Passed                                                                      |
| `npm run format:check`                        | Passed                                                                      |
| `npm test`                                    | 106 tests, 12 files passed                                                  |
| `npm run test:infra`                          | 4 configuration/origin/injection/hostname tests passed                      |
| `npm run test:e2e:nginx`                      | 24 tests passed, Chromium and Firefox                                       |
| `nginx -t`                                    | Maintenance and final active configurations passed                          |
| Shell syntax / Node syntax checks             | Passed                                                                      |
| Real production backend behind loopback NGINX | Secure OAuth cookie, Origin/auth enforcement and private-path checks passed |
| Public Quick Tunnel HTTPS                     | Maintenance health 200; application/API gate 503                            |
| Real Google authorization-page probe          | Blocked by `redirect_uri_mismatch`; no login                                |
| `npm run test:e2e`                            | Attempted; refused occupied user port 5173, no process killed               |
| External phones / four real remote players    | Not executed                                                                |

The NGINX suite uses compiled production frontend files and four independent browser contexts playing the real authoritative engine through real WebSockets. It tests full rounds, cut/trump, updates, reconnect, profiles, loopback signed OIDC/S3 fixtures, private/development route denial, caching and per-client rate limits despite forged forwarded headers. Existing backend integration tests verify hidden-card/private-evidence filtering. These are local simulations, not external-device proof.

An initial active NGINX regex failed `nginx -t` because quantifier braces needed quoting; it was corrected and all final checks rerun. No invalid active config was published. A production probe initially failed because fetch did not preserve its explicit Host; the raw HTTP probe correctly supplied Host and passed. The public application gate was never activated without Google registration acknowledgment.

## E. Files

Created:

- `infra/nginx/omi-testing.conf`.
- `infra/scripts/config.mjs`, `remote-testing.mjs`, `start-remote-testing.sh`, `stop-remote-testing.sh`, `check-remote-testing.sh`.
- `infra/tests/config.test.mjs`, `serve-nginx.mjs`.
- `infra/remote-testing.env.example` (comments/placeholders only).
- `playwright.nginx.config.ts`, `apps/web/e2e/nginx.check.ts`.
- `docs/CLOUDFLARE_INSPECTION.md`, `CLOUDFLARE_MULTIPLAYER_SETUP.md`, `CLOUDFLARE_TEST_RESULTS.md`.

Modified:

- `apps/server/src/app.ts`, `config.ts`, `app.test.ts`: restricted optional loopback proxy trust and regression.
- `apps/server/test-fixtures/e2e.ts`: accepts an explicitly loopback-only test origin for local NGINX tests.
- `apps/web/e2e/game.spec.ts`, `profile.spec.ts`: use configured browser baseURL for independent contexts.
- `.env.example`, `.gitignore`, `eslint.config.mjs`, `package.json`: documented proxy flag, private runtime/artifact isolation and verification commands.
- `README.md`, `docs/ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`: current infrastructure notes and setup links.

Tracked browser artifacts changed by test execution were restored to their original state. No existing .env or application database was overwritten. No dependency packages were added to the npm tree.

## F. Usage

See [complete setup](CLOUDFLARE_MULTIPLAYER_SETUP.md). Stop your current development backend with Ctrl-C in its own terminal, then from `~/Desktop/OMI` run `infra/scripts/start-remote-testing.sh`. It uses your existing configured database and prints a newly issued public origin/callback. After Google accepts that exact callback, run `infra/scripts/start-remote-testing.sh --activate-google-registered` in a second terminal. Complete a real login/reload/logout test and an external-network check before sharing with friends. They need separate accounts, the current URL and private room code.

Use `infra/scripts/check-remote-testing.sh` for gate/security checks. Stop with Ctrl-C in the supervisor terminal or `infra/scripts/stop-remote-testing.sh`; only managed services stop and databases remain.

## G. Limitations / blocking work

The owner must register/validate the new callback and complete public sign-in. If Google refuses the temporary domain, stop and select an explicitly approved supported arrangement (for example a domain already controlled with a named tunnel); no purchases or authentication changes are automatic. Quick Tunnel URLs change each restart, have no guaranteed availability and do not establish permanent hosting. Mac sleep/network changes interrupt hosting. Backend restart ends in-memory rooms. No physical device, cloud-avatar or four-real-friend game was verified. Stage F and gameplay rules were unchanged.

# OMI adversarial security assessment

Assessment date: 2026-10-27. Baseline: `dev` at `b124477`. Working branch: `security/red-team-audit`. Local assessment by the coding agent; not an independent external penetration test or production certification.

## 1. Executive summary

One **CONFIRMED Medium** vulnerability was reproduced and remediated across three WebSocket services: outbound delivery did not consistently reauthorize recipients after session expiry/revocation. A silent expired game connection received a newly dealt private hand before the next heartbeat. Synthetic service fixtures also demonstrated delivery of voice membership metadata and room chat to revoked recipients.

Counts of newly confirmed findings: Critical 0, High 0, Medium 1, Low 0. These counts describe this assessment's evidence, not all possible application weaknesses. No cross-player hand disclosure, cross-room injection, authentication bypass, or score manipulation was demonstrated by the executed tests.

Status: **READY FOR FURTHER TESTING**. Current dependency advisories, public transport, external providers and specialized browser/media deployment checks remain outside verified coverage.

## 2. Scope and safety

Reviewed authentication/session routes, OIDC integration, game HTTP/WebSocket routes, validation, room orchestration and projections, voice/social services, SQLite repository and backup code, frontend CSP/PWA generation, NGINX template, runtime/readiness controls and build artifacts. Read `SECURITY.md`, `SECURITY_REVIEW.md` and `ARCHITECTURE.md` before edits.

The initial working tree was clean on `security/security-hardening`. `git log dev..HEAD` and `git log dev..fix/next-round-progression` produced no commits; the progression branch was already contained in the reviewed development baseline. Created the requested branch from `dev`. No stash, reset, commit, push, merge, deploy or public tunnel was performed.

Tests used loopback fixtures, in-memory SQLite or disposable temporary databases and synthetic identities/media metadata. No real application database, credentials, third-party endpoint or real user account was targeted. Installed Node was 22.13.1, below the project's requirement. Verification used the existing ignored local Node 22.23.4 binary; no global installation was changed. Its archive provenance was not independently reverified in this assessment.

## 3. Methodology

Source-led review was combined with actual HTTP/WebSocket integration tests, a local signed OIDC provider, mock storage, controlled clocks and service-level transport spies. Existing negative authorization and full-round privacy assertions were rerun. This was not a complete browser-first reverse engineering exercise.

The original game exploit was run before fixing delivery and failed its security assertion with an actual received private event. Voice/social regression assertions likewise failed against their original implementations. Identical assertions passed after remediation. A fixed, bounded malformed-envelope corpus covers 60 field substitutions and 15 mass-assignment probes, with a maximum generated string of 4,097 characters. There is no random corpus seed; UUIDs supply valid fixture identifiers, while the attack corpus and game entropy (`() => 0`) are deterministic. This is targeted validation fuzzing, not exhaustive fuzzing.

## 4. Attack surface inventory

| Entry point                                               | Input / identity and authorization                                | Validation / defenses                                                                                                                    | Sensitive boundary and failure modes                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /health`                                             | Public                                                            | Minimal static health response; backend security headers                                                                                 | Avoid operational diagnostics disclosure                                                 |
| `POST /auth/session`                                      | Cookie optional; exact Origin                                     | Empty strict body; account rate limiter 120/minute/IP                                                                                    | Returns own public profile and CSRF value; no-store                                      |
| `POST /auth/google/start`                                 | Exact Origin; no existing login needed                            | Strict bounded return path, single-use browser binding, PKCE/state/nonce; shared rate limiter                                            | Login transaction capacity/provider availability; no external provider test              |
| `GET /auth/google/callback`                               | Browser binding cookie and OIDC response                          | Single-use transaction, signature/issuer/audience/expiry/nonce/state/PKCE validation; fixed configured callback                          | Exchanges provider code, rotates sessions; query values must not enter logs              |
| `POST /auth/logout`, `/profile`, `/profile/avatar/remove` | Exact Origin; active account plus CSRF for authenticated mutation | Strict schemas, profile version, identity-derived owner                                                                                  | Revocation, CSRF, cross-account mutation                                                 |
| `POST /profile/avatar`                                    | Same account/CSRF checks                                          | Multipart bounds, two concurrent uploads, per-actor upload rate, actual image decoding/re-encoding, asynchronous ownership/version check | Decoder resource use, stale authorization, private storage cleanup                       |
| `GET /avatars/:id/:size`                                  | Intentionally public active avatar                                | UUID and fixed size; fixed storage keys; public image cache override                                                                     | Profile images are public by design; raw uploads must never be returned                  |
| `POST /transport/session`                                 | Exact Origin; account or explicitly enabled development guest     | Strict name; bounded session store; production guests rejected                                                                           | Opaque HttpOnly credentials, server-owned actor                                          |
| `POST /rooms`, `/rooms/join`                              | Session; actor must match credential; joining requires room code  | Strict envelope, version/idempotency, room/session limits and per-IP HTTP rate                                                           | Membership, final-seat races, forged host/actor                                          |
| Room preview GET/POST                                     | Session and exact Origin; possession of invite code               | Eight-character code; bounded descriptor only                                                                                            | Invite discovery; no private hand returned                                               |
| Room snapshot GET/POST                                    | Active session and room membership                                | UUID/strict body, queued authorization recheck, explicit recipient projection                                                            | Other-room access and accidental private-state serialization                             |
| `/rooms/:roomId/ws`                                       | Exact Origin, cookie, membership; current peer checked on actions | No query tokens; strict command union, versions/receipts, bounded queue/rates/payloads/buffering, heartbeat                              | Server-owned deck/turn/score; recipient authorization on outgoing frames now fixed       |
| `POST /rooms/:roomId/voice/config`                        | Same room member and same-session current open game socket        | Empty body, UUID, rate-limited parent route; expiring HMAC TURN credentials                                                              | Shared relay secret remains server-only; issued credentials live for one hour            |
| Voice WebSocket                                           | Session, Origin, current same-room game connection                | Target call IDs, sequences, receipts, audio-only SDP, payload/rate/queue limits                                                          | Signaling impersonation and cross-room delivery; outgoing authorization now rechecked    |
| Social WebSocket                                          | Same game/session boundary                                        | Strict text/catalog schemas, sequences/receipts, host-only music, separate limits                                                        | Private room chat and metadata; outgoing authorization now rechecked                     |
| SQLite and backup/restore CLI                             | Local trusted process/filesystem access                           | Parameterized queries, private file modes, WAL-aware backup, exclusive new destinations, restore session invalidation                    | Local file/backup confidentiality and permissions; active data never used here           |
| Frontend assets/CSP/service worker                        | Public, fully inspectable/modifiable client                       | Escaped React text, fixed themes, static-only worker cache, production CSP, no public source maps                                        | Frontend cannot authorize game actions; authenticated content excluded from worker cache |
| NGINX/runtime/config                                      | Loopback proxy trust boundary                                     | Header replacement, route allowlist, private-path denials, time/body/connection bounds, startup gates                                    | Live TLS/proxy/host permissions and operational resilience require deployment review     |

RoomService owns gameplay transitions and secure random deck generation. `projection.ts` whitelists own hand and public card/count/score fields; it never serializes the private round wholesale. A modified frontend cannot supply trusted deck, score, seat or policy fields. No new gameplay restrictions or social cheating rules were introduced.

## 5. Vulnerability findings

### OMI-RT-001 — Recipient authorization missing at WebSocket delivery

- **Classification:** CONFIRMED; **Severity:** Medium; **CWE:** CWE-863 (Incorrect Authorization), CWE-613 (Insufficient Session Expiration).
- **Affected code:** `apps/server/src/multiplayer/rooms.ts` (`send`/`advance`), `apps/server/src/voice/service.ts` (`send`), `apps/server/src/social/service.ts` (`send`/broadcast).
- **Prerequisites:** An attacker previously possessed a legitimate connected room/session credential, then keeps the connection silent after expiry or another authorization invalidation. Another valid participant triggers traffic before the periodic heartbeat removes the old peer.
- **Root cause:** Receive paths reauthorized commands and periodic heartbeats swept invalid sessions, but egress paths checked socket openness/backpressure without uniformly checking recipient authorization. A live TCP/WebSocket connection was incorrectly treated as sufficient authority to receive new data.
- **Trust boundary:** Server private/member data must only cross into a currently authorized session.
- **Impact:** Continued access to newly generated room data after authorization ends. The game reproduction exposed the expired actor's own newly dealt four cards, not an opponent's hand or the full deck. Service fixtures exposed new synthetic room chat and voice membership/call metadata. Normally bounded by the 30-second heartbeat interval; no account takeover or cross-room access demonstrated. Previously received data cannot be revoked.
- **Reproduction:** Run the `silent expired` test in `multiplayer.test.ts` against the original implementation. It creates four real loopback clients with injected 100ms session lifetimes and deterministic dealer selection. The owner is created at time 0; three others at time 50. All connect, ready and start. Advance the clock to 100 without an expired-client action or heartbeat; an authorized cutter cuts. For voice/social, run `delivery-security.test.ts`: connect a synthetic peer, revoke it in the injected authorizer, then connect a second voice peer or send a valid social chat.
- **Before evidence:** The game assertion expecting no new event received `cards-dealt`, stage `first`, with hand `clubs K/Q/J/10`, version 13. The targeted run reported 1 failed, 17 skipped. Service fixture run reported 2 failed, 1 passed: the revoked voice socket was sent `joined` with a new call ID; revoked social socket was sent `chat` containing `synthetic private room chat`.
- **Remediation:** Game `send` checks the canonical active-session callback for every delivery and closes unauthorized sockets with 1008. Voice/social peers retain their server-derived room ID; `send` invokes the existing full room/current-game-session authorizer and closes unauthorized recipients with 1008. No client-controlled authorization field, new dependency or new game rule was introduced.
- **Verification:** The exact game test passed after the change, asserting no new events, close 1008 and a four-card hand for the authorized cutter. Both voice/social tests now assert zero sends to the revoked recipient and closure 1008 while the authorized peer receives data. Full suite passed afterward.
- **Performance/compatibility:** One in-memory session lookup per game delivery; side channels additionally perform the existing membership/current-game-socket lookup (at most four members). Bounded load results below show no evident regression at tested scale, without establishing maximum production capacity.

## 6. Exploit verification and final review

Reproduction commands use the local patched binary:

```sh
.remote-testing/tools/node-v22.23.4-darwin-arm64/bin/node node_modules/vitest/vitest.mjs run apps/server/src/multiplayer/multiplayer.test.ts -t 'silent expired'
.remote-testing/tools/node-v22.23.4-darwin-arm64/bin/node node_modules/vitest/vitest.mjs run apps/server/src/multiplayer/delivery-security.test.ts
```

Review of the fixes confirmed that authorizers use server-derived identities/room IDs; failed authorization returns before transport send; closing an invalid recipient does not throw out of the broadcast loop. Existing receive-side checks, reconnect identity, explicit projections, Origin checks, payload bounds and idempotency remain intact. Regression tests exercise expiry without an incoming attacker frame, revoked side-channel recipients, and additional strict-schema/mass-assignment bypass attempts. This final review was performed by the same agent, not a separately staffed independent review.

## 7. Security fixes and changed files

- `apps/server/src/multiplayer/rooms.ts`: delivery-time active-session enforcement.
- `apps/server/src/voice/service.ts`: full recipient authorization before delivery; server-derived room ID retained on peer.
- `apps/server/src/social/service.ts`: same recipient check for social snapshots/replies/broadcasts.
- `apps/server/src/multiplayer/multiplayer.test.ts`: real four-client expired-recipient regression.
- `apps/server/src/multiplayer/delivery-security.test.ts`: synthetic voice/social revoked-recipient regressions and bounded validation corpus.
- `docs/RED_TEAM_SECURITY_REPORT.md`: assessment and evidence.
- `docs/SECURITY_COVERAGE_MATRIX.md`: coverage and explicit gaps.

## 8. Regression testing

Verification used Node 22.23.4. Commands prefixed with `PATH="$PWD/.remote-testing/tools/node-v22.23.4-darwin-arm64/bin:$PATH"` where npm spawns Node. Loopback listeners required sandbox approval. Initial socket test and infrastructure run failed with `listen EPERM`; approved reruns passed without changing assertions.

| Check                                  | Result                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full `vitest run`                      | PASS: 22 files, 159 tests                                                                                                                                                                                             |
| Exact original game exploit after fix  | PASS: 1 test, 17 unrelated tests skipped                                                                                                                                                                              |
| New service/validation regression file | PASS: 3 tests                                                                                                                                                                                                         |
| `npm run typecheck`                    | PASS: all four workspaces                                                                                                                                                                                             |
| `npm run build`                        | PASS: all four workspaces; Vite warns about future native-config import-extension compatibility                                                                                                                       |
| `npm run lint`                         | PASS                                                                                                                                                                                                                  |
| `node --test infra/tests/*.test.mjs`   | PASS on approved rerun: 5 tests, 0 failures; includes disposable WAL backup/restore and compiled production shutdown                                                                                                  |
| `npm run check:build`                  | PASS: 0 public source maps; server-marker smoke check passed; JS+CSS gzip 87,676 bytes within 100KiB budget                                                                                                           |
| `npm run test:load -- 2 2`             | PASS: 2 rooms, 8 players, 2 completed rounds, 80 actions, 2 duplicate checks, 2 reconnects, 426 private-wire checks                                                                                                   |
| Load observations                      | p50 0.33ms, p95 1.10ms; event-loop p99 22.13ms; peak combined RSS 161.2MiB. Two-second soak only; no voice/browser/OIDC load                                                                                          |
| Standard `npm run test:e2e`            | Initially blocked: port 5173 occupied; existing process left untouched. isolated rerun on port 5273 PASS: 11 browser tests, 0 failures (25.7s), including four-player round/reload, local OIDC/profile/logout and CSP |
| Formatting and final diff check        | PASS: `npm run format:check` and `git diff --check` (final checks)                                                                                                                                                    |

The isolated browser rerun used ignored `.remote-testing/red-team-playwright.config.ts`, keeping fixture backend port 3100, changing frontend/baseURL/fixture Origin to loopback port 5273 and retaining all original test assertions. Vite logged WebSocket EPIPE messages during client teardown; the 11 tests passed. The port-5173 process was not reused or terminated. Temporary config and browser artifacts remain ignored local test infrastructure.

Tests already present cover invalid OIDC nonce/audience/issuer/expiry/signature/userinfo, browser binding/state replay, CSRF, logout, strict HTTP and socket messages, forged identities, foreign/missing Origins, room membership, private projections, replay/races, reconnect, oversized/binary frames, backpressure, voice cross-room targeting, uploads, PWA caching and CSP. Passing these assertions is evidence for those tested scenarios, not comprehensive vulnerability absence.

## 9. Remaining risks and limitations

- **Current dependency advisories: NOT TESTED.** Network access to advisory databases was prohibited. Prior Stage J audit results were not reused as current evidence; neither a fresh advisory snapshot nor an offline database was available.
- **Runtime configuration risk:** Default active Node 22.13.1 is below the project's required 22.23.4. Local verification used the existing patched runtime; the owner's service/runtime activation remains a release requirement.
- Public Google registration, historical credential revocation noted in prior docs, S3 IAM/recovery and external TURN/HTTPS/NGINX behavior were not accessed or independently verified.
- TURN credentials remain usable until their one-hour expiry; signaling logout cannot revoke an established malicious P2P media path. Direct ICE may disclose network addresses. These are documented architectural/deployment limits, not newly demonstrated vulnerabilities.
- Backup tests use isolated copies. Live database permissions, backup encryption, restore operational procedures, local filesystem race resistance, WAL permissions on every target filesystem, multi-process revocation, host isolation and recovery were not exhaustively tested.
- No arbitrary upload/SQL/path/command-injection vulnerability was reproduced. Existing upload/parameterized-query/backup checks are limited to their fixture assertions, not exhaustive injection campaigns.
- No Internet-scale exhaustion, slowloris, memory-exhaustion or crash campaign. The local load test is deliberately small. No physical-device/iOS testing or complete nine-stage browser/media matrix is claimed.
- Owner-dependent game policies remain as configured. Ordinary next-round progression is tested with explicit fixture policy; this audit does not resolve rule decisions or silently install a new policy.
- Source analysis/build smoke checks do not constitute a comprehensive secret scan. Secret files and production data were not read into this report.

## 10. Production security recommendations

1. Before release, run a fresh full/production dependency advisory audit in an explicitly authorized connected environment and activate a supported patched runtime for the actual service.
2. Review the final diff and rerun the new recipient regressions in CI, keeping receive-side and send-side authorization tests.
3. Verify production HTTPS/WSS, exact Origin/callback configuration, host-only Secure cookies, guest prohibition, reverse-proxy header replacement, private database/backup ownership and object-storage IAM with synthetic accounts in an authorized staging environment.
4. Complete specialized PWA, voice, TURN relay and device/browser checks, plus an encrypted disposable restore drill and operational alert verification. Define acceptable relay credential lifetime and direct-ICE privacy policy.
5. Obtain an independent security review of authentication revocation and real-time recipient authorization. Local evidence supports further testing; it does not establish production readiness or zero vulnerabilities.

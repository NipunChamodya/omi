# Security

## Current Stage F status

Voice requires exact Origin, a valid existing session and the current game socket credential for the same room member. SDP/candidates reach only the targeted current call; cross-room delivery, forged actors, changed action retries, video SDP and binary audio are rejected. Only hashed receipt fingerprints are retained. Shared TURN secrets stay server-side; one-hour member credentials are necessarily visible to their recipient and expire independently of logout. The supported client stops capture on leave/disconnect/logout; an already established malicious peer-to-peer path cannot be revoked solely by server signaling. Direct peers may exchange network addresses; use reviewed TURN relay-only configuration when required. No recording/persistence or raw signaling logging was added. Safe example placeholders were restored where a Google credential was present; rotate the previously exposed credential. See VOICE.md.

## Current Stage E status

Stage E supersedes the historical guest-only baseline: accounts use signature-verified Google OIDC, PKCE/state/nonce, single-use browser-bound transactions, hashed persistent session credentials, session rotation/revocation and exact-Origin plus CSRF checks for account mutations. Request timeout is now 30 seconds; upload limits are separately enforced. Production guest mode is rejected. OAuth query values are stripped from request logs. Sanitized avatar uploads use private external storage, bounded decoding and durable cleanup; authorization/version checks run again before committing asynchronous uploads. Negative-token, CSRF, ownership, revocation and image regression tests pass. npm audit reported zero findings during this stage; this does not certify production security. Deployment TLS, proxy trust, live IAM and broad hardening remain unverified. See ACCOUNTS.md for precise limits and cookie behavior.

## Stage A foundation baseline

No secrets in the client. Environment files ignored by Git, example tracked. Server binds to loopback by default. Zod validates server configuration. Fastify limits request bodies to 16 KiB and sets a 10-second request timeout. Authorization/cookie headers are redacted from structured logs. Health contains no secrets or dependency diagnostics. Stage A originally exposed only health. Stage C/D add the guest transport and gameplay/UI controls described below; database/account/upload paths remain unimplemented.

## Stage B engine controls

The engine checks deck uniqueness, ranks/suits, seat bounds, action phase, cutter/selector, turn, card ownership and trick order. Randomness must be supplied by a trusted secure source; no predictable fallback exists. Readonly transitions preserve inputs, and externally supplied cards/decks are copied. Tests deep-freeze state and exercise 100 full rounds.

`PrivateRound` includes every hidden card, original deal and play evidence; the entire structure is confidential. Stage B added no frontend/shared imports or endpoint integration; Stage C integrates the engine through separate server-private orchestration. Manual accusation verification uses saved hand contents. Duplicate round awards and duplicate transfers for the same evidence are prevented within the preserved ledger. Gameplay deception never triggers automatic alerts or penalties. Unresolved timing/bonus/dealer policies cannot run through a default rule.

This engine is a trusted in-process component, not an authentication or serialization boundary. Tests do not establish WebSocket hidden-card isolation; Stage C adds specific integration coverage below. Future code must never log raw private state, accept policy/ledger/state from clients, or expose adjudication reasoning as a hand-query oracle. TypeScript readonly does not prevent runtime mutation by trusted code; callbacks must be pure and trusted. Globally unique IDs, secure RNG, persistence and bounded ledger lifetime remain caller responsibilities.

## Stage C controls and evidence

Temporary guest transport cookies are opaque 256-bit credentials stored server-side by SHA-256 hash; they are HttpOnly, SameSite=Strict and Secure with a __Host name in production. They establish temporary actors, not Google accounts. Origin allowlisting applies to HTTP including reads and WebSocket upgrades. A member cookie is required before upgrade, and actor/session/room/current-connection checks are repeated inside the room action queue. Credentials are not accepted in URLs. Outbound cookie headers are also redacted.

Strict schemas prohibit client-owned deck/score/result/policy/seat fields. The server uses secure entropy, per-room serial processing, state versions and retained idempotency receipts. Explicit projections expose only own hand and public cards/counts/scores. Ordinary card-play deltas never include violation evidence; unknown accusation windows return a uniform unresolved response. No automatic cheating warning or penalty was added.

Real network tests exercise four simultaneous clients, correct private deals, full-round public events, forged actors/cookies, foreign/missing origins, unauthorized rooms, concurrent joins/actions, duplicate IDs across reconnect, stale versions, replaced sockets, malformed/binary/oversized traffic, outbound bounds, session/room expiry and request/message/capacity limits. Manual-report tests inject hypothetical eligibility only to test mechanics. These results do not certify protection against every attack or real-world network exhaustion.

Limits, cookie scope, heartbeat and in-memory lifecycle are documented in MULTIPLAYER.md. Sessions/rooms are lost on restart; proxy rate handling defaults to Fastify's direct peer IP. Production reverse-proxy trust/limits, TLS termination, durable account/session design, revocation, operational monitoring and broader hardening remain later-stage work. No full security audit, penetration test or production readiness claim has been made.

## Stage D browser boundary

The browser imports only public shared types, never engine implementation/state. It renders recipient hands and public plays/counts; opponents have generic backs only. It does not calculate cheating violations, recommend follow-suit restrictions, guess scores or apply penalties. Names and notices are React text; an HTML-like name regression verifies no image/handler is created.

Credentials remain HttpOnly; sessionStorage contains only public room/name metadata, not tokens or cards. All actions use the server identity, fresh UUIDs/expected versions and retained original IDs for uncertain delivery. Offline/pending controls prevent accidental duplicate UI submissions; backend validation remains authoritative. Stale events, old duplicate acknowledgements and late asynchronous reconnect callbacks cannot overwrite newer confirmed state. HTTP requests/retries and connection/action/sync timers are bounded and cleaned up.

New read-only POST routes preserve the existing exact-Origin and member checks rather than allowing missing Origin on browser GETs. Production still requires HTTPS/WSS and a same-site API or reverse proxy. Client-side controls are usability measures, not authorization. Google OIDC/account/profile/upload security remains Stage E/J, with no production security certification claimed.

## Planned and unverified

Google OIDC, secure server sessions and cookies, CSRF protection, production WebSocket hardening and expanded replay/authorization/isolation regressions beyond the Stage C baseline. Avatar MIME/content validation, metadata stripping and external storage. Production HTTPS/WSS, reverse proxy limits and dependency review.

Stage A is not production hardened. The configured request timeout is not a complete slow-client or resource-exhaustion defense. No production security audit or penetration test has been performed.

## Frontend CSP correction after Stage E

The frontend now owns one environment-aware CSP meta policy through its Vite plugin. Development uses per-document nonces for the React preamble and injected styles; production has no nonce/tooling/inline/eval exceptions. Exact API and WebSocket origins are allowed when configured. External CSP headers are not removed. See [investigation report](CSP_FIX_REPORT.md) for evidence, attribution limits and hosting considerations.

## Remote-testing proxy boundary

The optional TRUST_LOCAL_PROXY setting defaults to false and requires HOST=127.0.0.1 when enabled. Fastify trusts only the immediate IPv4 loopback hop. The standalone NGINX template overwrites forwarded Host/scheme/client-IP headers and accepts Cloudflare's client address only through the trusted local connector boundary. Other local processes on this Mac share that trust boundary; this is not protection from a compromised local user. Cookie security and callback construction depend on production configuration, not spoofable forwarded input. The public tunnel begins at a maintenance-only gate and requires explicit Google registration acknowledgment before exposing account-protected routes. See CLOUDFLARE_MULTIPLAYER_SETUP.md; real public login is still blocked by redirect_uri_mismatch, and production certification is not claimed.

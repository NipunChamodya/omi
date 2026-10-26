# Security

## Implemented

No secrets in the client. Environment files ignored by Git, example tracked. Server binds to loopback by default. Zod validates server configuration. Fastify limits request bodies to 16 KiB and sets a 10-second request timeout. Authorization/cookie headers are redacted from structured logs. Health contains no secrets or dependency diagnostics. There are no user-input UI rendering paths, database queries, authentication, uploads or gameplay endpoints yet.

## Stage B engine controls

The engine checks deck uniqueness, ranks/suits, seat bounds, action phase, cutter/selector, turn, card ownership and trick order. Randomness must be supplied by a trusted secure source; no predictable fallback exists. Readonly transitions preserve inputs, and externally supplied cards/decks are copied. Tests deep-freeze state and exercise 100 full rounds.

`PrivateRound` includes every hidden card, original deal and play evidence; the entire structure is confidential. No frontend/shared imports or endpoint integration were added. Manual accusation verification uses saved hand contents. Duplicate round awards and duplicate transfers for the same evidence are prevented within the preserved ledger. Gameplay deception never triggers automatic alerts or penalties. Unresolved timing/bonus/dealer policies cannot run through a default rule.

This engine is a trusted in-process component, not an authentication or serialization boundary. Tests do not establish WebSocket hidden-card isolation; Stage C adds specific integration coverage below. Future code must never log raw private state, accept policy/ledger/state from clients, or expose adjudication reasoning as a hand-query oracle. TypeScript readonly does not prevent runtime mutation by trusted code; callbacks must be pure and trusted. Globally unique IDs, secure RNG, persistence and bounded ledger lifetime remain caller responsibilities.

## Stage C controls and evidence

Temporary guest transport cookies are opaque 256-bit credentials stored server-side by SHA-256 hash; they are HttpOnly, SameSite=Strict and Secure with a __Host name in production. They establish temporary actors, not Google accounts. Origin allowlisting applies to HTTP including reads and WebSocket upgrades. A member cookie is required before upgrade, and actor/session/room/current-connection checks are repeated inside the room action queue. Credentials are not accepted in URLs. Outbound cookie headers are also redacted.

Strict schemas prohibit client-owned deck/score/result/policy/seat fields. The server uses secure entropy, per-room serial processing, state versions and retained idempotency receipts. Explicit projections expose only own hand and public cards/counts/scores. Ordinary card-play deltas never include violation evidence; unknown accusation windows return a uniform unresolved response. No automatic cheating warning or penalty was added.

Real network tests exercise four simultaneous clients, correct private deals, full-round public events, forged actors/cookies, foreign/missing origins, unauthorized rooms, concurrent joins/actions, duplicate IDs across reconnect, stale versions, replaced sockets, malformed/binary/oversized traffic, outbound bounds, session/room expiry and request/message/capacity limits. Manual-report tests inject hypothetical eligibility only to test mechanics. These results do not certify protection against every attack or real-world network exhaustion.

Limits, cookie scope, heartbeat and in-memory lifecycle are documented in MULTIPLAYER.md. Sessions/rooms are lost on restart; proxy rate handling defaults to Fastify's direct peer IP. Production reverse-proxy trust/limits, TLS termination, durable account/session design, revocation, operational monitoring and broader hardening remain later-stage work. No full security audit, penetration test or production readiness claim has been made.

## Planned and unverified

Google OIDC, secure server sessions and cookies, CSRF protection, production WebSocket hardening and expanded replay/authorization/isolation regressions beyond the Stage C baseline. Avatar MIME/content validation, metadata stripping and external storage. Production HTTPS/WSS, reverse proxy limits and dependency review.

Stage A is not production hardened. The configured request timeout is not a complete slow-client or resource-exhaustion defense. No production security audit or penetration test has been performed.

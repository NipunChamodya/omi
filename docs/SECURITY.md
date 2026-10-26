# Security

## Implemented

No secrets in the client. Environment files ignored by Git, example tracked. Server binds to loopback by default. Zod validates server configuration. Fastify limits request bodies to 16 KiB and sets a 10-second request timeout. Authorization/cookie headers are redacted from structured logs. Health contains no secrets or dependency diagnostics. There are no user-input UI rendering paths, database queries, authentication, uploads or gameplay endpoints yet.

## Stage B engine controls

The engine checks deck uniqueness, ranks/suits, seat bounds, action phase, cutter/selector, turn, card ownership and trick order. Randomness must be supplied by a trusted secure source; no predictable fallback exists. Readonly transitions preserve inputs, and externally supplied cards/decks are copied. Tests deep-freeze state and exercise 100 full rounds.

`PrivateRound` includes every hidden card, original deal and play evidence; the entire structure is confidential. No frontend/shared imports or endpoint integration were added. Manual accusation verification uses saved hand contents. Duplicate round awards and duplicate transfers for the same evidence are prevented within the preserved ledger. Gameplay deception never triggers automatic alerts or penalties. Unresolved timing/bonus/dealer policies cannot run through a default rule.

This engine is a trusted in-process component, not an authentication or serialization boundary. Tests do not establish WebSocket hidden-card isolation, which belongs to Stage C. Future code must never log raw private state, accept policy/ledger/state from clients, or expose adjudication reasoning as a hand-query oracle. TypeScript readonly does not prevent runtime mutation by trusted code; callbacks must be pure and trusted. Globally unique IDs, secure RNG, persistence and bounded ledger lifetime remain caller responsibilities.

## Planned and unverified

Google OIDC, secure server sessions and cookies, CSRF protection, strict WebSocket origin/authentication/authorization, replay protection, per-room serialization, hidden-card isolation, rate limits and bounded room resources. Avatar MIME/content validation, metadata stripping and external storage. Production HTTPS/WSS, reverse proxy limits and dependency review.

Stage A is not production hardened. The configured request timeout is not a complete slow-client or resource-exhaustion defense. No production security audit or penetration test has been performed.

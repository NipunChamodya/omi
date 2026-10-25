# Security

## Implemented

No secrets in the client. Environment files ignored by Git, example tracked. Server binds to loopback by default. Zod validates server configuration. Fastify limits request bodies to 16 KiB and sets a 10-second request timeout. Authorization/cookie headers are redacted from structured logs. Health contains no secrets or dependency diagnostics. There are no user-input UI rendering paths, database queries, authentication, uploads or gameplay endpoints yet.

## Planned and unverified

Google OIDC, secure server sessions and cookies, CSRF protection, strict WebSocket origin/authentication/authorization, replay protection, per-room serialization, hidden-card isolation, rate limits and bounded room resources. Avatar MIME/content validation, metadata stripping and external storage. Production HTTPS/WSS, reverse proxy limits and dependency review.

Stage A is not production hardened. The configured request timeout is not a complete slow-client or resource-exhaustion defense. No production security audit or penetration test has been performed.

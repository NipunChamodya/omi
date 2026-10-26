# Accounts and avatars — Stage E

## Status

Implemented and tested locally. Real Google credentials, cloud bucket configuration, physical-device gallery tests and production deployment have not been verified. No live credentials are configured in this workspace. Test providers are isolated under `apps/server/test-fixtures`; production always uses Google's issuer.

## Local setup

Use Node 22 and npm 10. Run `npm ci`, `npm run build`, then copy `.env.example` to `apps/server/.env`. Configure `APP_ORIGIN` with the exact browser origin. Create a Google OAuth web application and configure its consent screen, authorized origin and exact redirect URI. For the default Vite proxy, register `http://127.0.0.1:5173/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` together in the server environment. In production use your HTTPS public callback, including any reverse-proxy prefix.

Run `npm run db:migrate -w @omi/server`, `npm run dev:server` and, in another terminal, `npm run dev:web`. Startup also applies migrations idempotently. Open http://127.0.0.1:5173, sign in, open My profile, edit the name, choose/crop a photo, replace/remove it, reload and sign out. Use four separate Google accounts/browser profiles to play. Without Google configuration, `ALLOW_GUESTS=true` enables development-only gameplay; it cannot test real account authentication and is forbidden in production.

## Persistence and hosting

`DATABASE_PATH` defaults to `./data/omi.sqlite` relative to the server workspace. Place it on a durable private volume. The SQLite file has mode 0600, foreign keys and WAL enabled. Ship `apps/server/migrations` alongside `dist`; compiled `node dist/persistence/migrate.js` runs migrations without tsx. SQL migrations are tracked; no migration generator is installed. Review future SQL changes and migration metadata before release. Do not copy a live SQLite database without a WAL-aware backup procedure; operational backups remain Stage J.

The repository interface isolates persistence from account logic. A PostgreSQL migration requires a new adapter and asynchronous integration changes; it is not a connection-string switch. Accounts/sessions survive restart, while active rooms, scores and room action receipts do not.

Set `AVATAR_BUCKET`, optional `AVATAR_REGION` (default us-east-1) and optional HTTPS `AVATAR_ENDPOINT`. Credentials use the AWS SDK default provider chain, including workload roles or server-only AWS environment variables. Use a private bucket with public access blocked and least-privilege GetObject/PutObject/DeleteObject access to `avatars/`. Configure bucket encryption and lifecycle/retention deliberately. No public ACL or temporary filesystem fallback is used. Without a bucket, custom uploads are disabled; Google pictures remain available.

The server writes an upload intent before external writes. Replacement/removal mark old objects for deletion; bounded maintenance retries failures. Pending writes older than ten minutes can be collected. Five retained avatar records per user bound failed cleanup backlog. Removed pictures may remain in browser caches for up to the one-hour cache lifetime. Backup retention may also retain previous images.

## Authentication and authorization

Google authorization-code OIDC uses PKCE S256, state, nonce, verified ID-token signatures and issuer/audience/expiry checks. Userinfo subject must match. A short-lived browser-bound cookie and single-use SQLite transaction protect callbacks. Users are keyed by verified Google subject. OAuth tokens are not persisted; returning login preserves edited display names.

Random opaque seven-day session cookies are HttpOnly, SameSite=Lax and Secure with a `__Host-` name in production. SQLite stores credential hashes. Login rotates the current credential; logout revokes it and closes its game socket. Each account can retain at most ten sessions; logout affects the current session. Profile, upload, removal and authenticated logout require exact Origin and a session-bound CSRF header. Account IDs determine game actors; submitted profile fields cannot choose an owner. Version checks reject concurrent profile overwrites. Login/logout also revoke the old development guest credential; guest seats are not migrated to accounts.

Account bootstrap uses POST `/auth/session`; login starts at POST `/auth/google/start` and returns through GET `/auth/google/callback`. POST `/profile`, `/profile/avatar`, `/profile/avatar/remove` and `/auth/logout` mutate account state. GET `/avatars/:id/:size` serves only active optimized profile images. Avatars are public profile media, not secret objects; the underlying bucket stays private. OAuth callback query values and raw uploads are excluded from logs.

## Image processing

Gallery input accepts JPEG, PNG or WebP up to 4 MiB. Server signature checks and Sharp decoding validate content independently of MIME/extension. Animated/multipage images, dimensions above 8192 and images above 16 million pixels are rejected. The UI offers zoom and horizontal/vertical repositioning. The backend applies orientation and normalized crop coordinates, strips source metadata through reencoding and produces a 256px WebP plus 64px thumbnail. Original images are never stored. HEIC is not supported in this stage.

Two concurrent upload readers/processors and six uploads per minute per account bound work. Native processing times out after five seconds; storage requests use bounded retries/timeouts. Session validity and profile version are checked again after asynchronous storage writes. Failed uploads do not replace the existing profile image. Google fallback URLs must use approved HTTPS googleusercontent.com hosts; the server never fetches user-provided remote URLs.

## Verification and remaining work

Tests use a signed local OIDC provider, in-memory SQLite where appropriate, real SQLite reopen tests and an HTTP S3 fixture driven by the real AWS SDK. These establish application behavior, not Google's consent configuration, real IAM policies, cloud durability or device compatibility. Never run `dev:e2e` as a production service. See STAGE_E_REPORT.md and TESTING.md for executed results.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [openid-client](https://github.com/panva/openid-client), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [Sharp output](https://sharp.pixelplumbing.com/api-output/), [S3 security guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html).

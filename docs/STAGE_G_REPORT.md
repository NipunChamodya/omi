# Stage G — Social Features and Shared Music

## Completion status

Stage G implementation and local verification complete on `dev`. Initial worktree was clean; prior stages and infrastructure were preserved. No Stage H, purchases, public deployment, commit or push occurred. Public Google callback registration and real-device/internet verification remain pending; this is not a production-readiness claim.

## Features implemented

- Room-only plain-text chat with Sinhala, English, Singlish, emoji/ZWJ support, bounded history and curated quick phrases.
- Funny Sinhala reactions, table tapping with synchronized lightweight visual/sound effects, opt-in adult-language reaction/filter controls and local reaction mute.
- Per-room/device incoming blocks for chat/reactions/voice with previous individual voice-volume restoration on unblock.
- Manual abuse reports using server-verified recent-message evidence, additive persistent storage, deduplication, retention/caps and a read-only local owner-review CLI. Reports never apply game penalties or scoring changes.
- Two bundled original synthetic CC0 music loops and three original effects, with source/provenance and no external-track/upload feature.
- Host-controlled shared play/pause/track/seek, independent music revision, clock sampling/drift correction, real HTML5 media playback, local consent and separate music/effect/voice levels.
- Dedicated authenticated social WebSocket, independent queue/rate/version/receipt budgets, reconnection history/timeline restoration and lifecycle cleanup composed with voice.

## Files created

- `packages/shared/src/social.ts`.
- `apps/server/src/social/routes.ts`, `service.ts`, `review.ts`, `social.test.ts`, `reports.test.ts`.
- `apps/server/migrations/0001_stage-g-reports.sql`.
- `apps/web/src/social/RoomControls.tsx`, `SocialPanel.tsx`, `client.ts`, `audio.ts`, `social.test.tsx`.
- `apps/web/src/social/assets/emerald-v1.mp3`, `coast-v1.mp3`, `tap-v1.wav`, `chime-v1.wav`, `chuckle-v1.wav`, `LICENSE.md`.
- `apps/web/e2e/social.check.ts`, `playwright.social.config.ts`.
- `infra/scripts/generate-social-audio.py`.
- `docs/SOCIAL.md`, `docs/STAGE_G_REPORT.md`.

## Files modified

- Shared `src/index.ts`: public social exports only.
- Server `src/multiplayer/routes.ts`: social registration; `src/persistence/schema.ts`, `repository.ts`: private bounded reports; migrations `meta/_journal.json`: new additive migration tracking; server `package.json`: owner-review CLI.
- Web `src/App.tsx`, `styles.css`: lazy room/social controls and responsive styling; `src/voice/VoicePanel.tsx`, `client.ts`: local incoming block gain; `e2e/voice.check.ts`: block/unblock regression.
- Web `security.ts`, `security.test.ts`: only same-origin media added to CSP, preserving script/style restrictions.
- `infra/nginx/omi-testing.conf`: explicit real social WebSocket route.
- Root `package.json`: social browser command; `README.md`: current stage/setup.
- Docs `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `GAME_STATES.md`, `MULTIPLAYER.md`, `UI.md`: Stage G status and practical limits.

Engine and OWNER_RULES.md are unchanged. Existing Google OIDC, session, avatar and game-command implementations were not replaced. The report migration adds one table/indexes without resetting accounts or existing migrations. No new npm runtime dependency was added.

## Tests executed and results

| Verification                                                   | Actual result                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run build`                                                | All workspaces passed                                          |
| `npm run typecheck`                                            | Passed                                                         |
| `npm run lint`                                                 | Passed                                                         |
| `npm run format:check`                                         | Passed                                                         |
| `npm test`                                                     | 139 tests across 17 files passed                               |
| `npm run test:infra`                                           | 4 passed                                                       |
| `npm run test:social`                                          | 2 four-client Chromium/Firefox journeys passed                 |
| `npm run test:e2e:nginx`                                       | 24 existing gameplay/profile/proxy browser checks passed       |
| `npm run test:voice`                                           | 4 direct-audio/block/logout checks passed                      |
| `npm run test:voice:relay`                                     | 4 real local coturn relay/block/logout checks passed           |
| `npx playwright test --config playwright.production.config.ts` | 2 production CSP/render checks passed                          |
| Compiled migration runner, twice on one temporary database     | Passed; two tracked migrations, file mode 0600                 |
| Compiled report-review CLI against empty temporary reports     | Passed read-only check                                         |
| `nginx -t` in browser fixtures                                 | Passed with social route                                       |
| Audio-generation ffprobe                                       | Both music assets exactly 32 seconds                           |
| 320px screenshot inspection                                    | Performed; no horizontal overflow in four-client browser tests |

Social tests exercise authenticated connected membership, exact actor/connection/sequence checks, duplicate/changed actions, cross-room privacy, host music authorization/conflicts, rate limits, server-derived report evidence, Unicode/control handling and unchanged game versions. Report tests start with the real Stage E migration, preserve an existing user, apply Stage G additively, reopen/deduplicate data, prune 30-day evidence and cap retained reports at 1,000. Browser UI/audio unit tests cover literal markup, local filters/blocks, tampered preference recovery, opt-in-only audio and cancellation races.

Real browser music checks verify no MP3/WAV request before opt-in, actual codec/media readiness, play/pause, seek, track switch, independent local volume, local disable and reconnect alignment within a one-second test tolerance. Four independent contexts exchange messages/reactions and submit actual reports. Existing voice tests additionally prove a blocked participant's playback drops to zero and unblocking restores the previous volume while all three peer links remain connected.

A report-status browser locator initially matched both voice and report status; it was scoped correctly. A repository cleanup edit accidentally entered the account transaction; build/authentication tests caught it, it was corrected, and full verification was rerun successfully. Media cancellation guards prevent network interruptions from being mislabeled as autoplay rejection. No failed draft is reported as a passing result.

All browser suites use real loopback NGINX/WebSockets and local signed OIDC/S3 fixtures. Voice uses synthetic microphone sources and real local TURN. No real Google public login, phone or external-network session was executed. The initial Vite config's existing non-failing future-native-loader warning remains unrelated to Stage G.

## Security observations

Social access requires the current game-session credential and exact Origin; disconnect/logout/replacement invalidates it without overwriting voice cleanup. Strict bounded payloads, catalog IDs, connection nonces, sender sequence checks and hashed receipts reject impersonation, stale envelopes and arbitrary media URLs. Chat is React text with no HTML/Markdown/link execution. Only the table host controls music. Game/voice limits and private-hand projections remain intact.

Blocks are incoming device/table controls, not server-enforced bidirectional bans. Adult filtering is limited and does not inspect voice. Reports store selected original evidence privately with a 30-day/1,000-row cap and no public moderation endpoint or automatic penalty. CLI output is escaped JSON and should remain private. The only CSP extension is `media-src 'self'`; no wildcard, unsafe-inline or unsafe-eval exception was introduced. Existing production guest restrictions, OIDC/PKCE/state/nonce/signature checks, secure cookies, CSRF and upload validation remain passing.

## Performance observations

Initial JavaScript: 251.43 kB / 78.51 kB gzip. Lazy RoomControls/social: 21.70 / 6.96 kB gzip. Voice: 14.73 / 4.96 kB gzip. CSS: 28.34 / 7.59 kB gzip. Bundled optional audio totals about 564 kB, requested only after local consent and served with existing fingerprinted caching. No music/audio bytes travel through gameplay/social WebSockets. State is bounded to 30 chat entries within 32 KiB, one music state and 128 hashed receipts per connection, with independent queue/rate/backpressure limits. No phone CPU/data-use, large-room load or long-running synchronization benchmark was performed.

## Unresolved questions

Existing game-rule clarifications and public Google callback configuration remain unresolved. The owner may review the small Sinhala reaction/adult-word catalog, moderation operations and retention settings before public use. No new game rules or automatic moderation decisions were inferred.

## Known limitations

- Chat/music are room memory and disappear on backend restart; only reported evidence persists. A reported message must still be in the retained recent history when submitted.
- Report review is a local owner CLI, not a staffed service or public administration UI. No automatic ban/kick/cheating penalty occurs.
- Local incoming blocking does not prevent others hearing your outgoing voice or receiving blocked users' messages.
- Adult annotation is a small word list/curated catalog, not comprehensive moderation or age verification.
- Music synchronization is best effort with periodic corrections, not sample-accurate playback. Mobile OS background/autoplay restrictions may require another gesture.
- Only bundled tracks/effects are supported; no arbitrary URLs, user audio uploads, streaming service or spoken Sinhala reaction recording was added.
- Public Google/OAuth, external TURN/NAT, physical Android/iPhone/Safari and internet latency remain unverified. No production readiness is declared.

## Local testing instructions

Run `npm run build` and `npm run db:migrate -w @omi/server`. Start `npm run dev:server` and `npm run dev:web` in separate terminals, using existing private settings. Open http://127.0.0.1:5173 with separate player accounts/profiles, enter a table and expand Friends, chat & music. Test chat, incoming blocks, adult preferences and report submission. Explicitly enable local music/effects; the host controls the shared track and each client controls their own volume. Review reports privately using `npm run reports:review -w @omi/server`.

For automation, install Chromium/Firefox and run the commands above sequentially where they share ports 8082/3100. Relay checks require the existing loopback coturn fixture. See [Social guide](SOCIAL.md) for protocol, licensing, moderation, consent and synchronization details. No public test provider or development server should be exposed.

## Recommended next stage

Stage H — Progressive Web App and Mobile Optimization, only after explicit owner authorization. Stop here.

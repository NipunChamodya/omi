# Stage F — Real-Time Voice Chat

## Completion status

Stage F implementation and local automated verification complete on `dev`. This report covers voice only; the earlier uncommitted Cloudflare infrastructure work is preserved. No Stage G functionality, commit, push, public deployment or game-rule changes were made. Public Google callback registration and physical/external-network voice acceptance remain pending.

## Features implemented

- Four-member opt-in audio-only WebRTC mesh, usable in lobby or game independently of card actions.
- Dedicated same-origin voice WebSocket and member-only ICE configuration endpoint; audio never travels over WebSockets.
- Current game-session/room authorization, targeted SDP/ICE delivery, fresh call IDs, voice-local sequence versions and bounded replay receipts.
- Separate signaling queue/rate limits, shared existing frame cap, backpressure, heartbeat, logout/replacement cleanup and private-room isolation.
- Deterministic initial offerer plus polite/impolite perfect negotiation for later offer collisions; ICE restarts, bounded reconnects and temporary credential refresh.
- Microphone permission/errors, mute/unmute, speaking indicators, per-person Web Audio gain, autoplay retry and 320px controls.
- Track/peer/audio-context/socket/timer cleanup on leave, home, logout or disconnection, including late permission grants.
- Reviewed STUN/TURN URL settings and one-hour coturn-compatible HMAC credentials; server-only shared secret.
- Real local TURN relay fixture and deterministic synthetic microphone input for browser testing; no recordings or external paid services.

## Files created

- `packages/shared/src/voice.ts`: JSON-only public signaling/configuration types.
- `apps/server/src/voice/config.ts`, `routes.ts`, `service.ts`, `voice.test.ts`.
- `apps/web/src/voice/client.ts`, `client.test.ts`, `VoicePanel.tsx`.
- `apps/web/e2e/voice.check.ts`.
- `playwright.voice.config.ts`, `playwright.voice-relay.config.ts`.
- `infra/tests/serve-voice-relay.mjs`, `audio-source.mjs` (test-only tools).
- `docs/VOICE.md`, `docs/STAGE_F_REPORT.md`.

## Files modified for Stage F

- `packages/shared/src/index.ts`: exports voice types.
- Server `src/app.ts`, `config.ts`, `multiplayer/routes.ts`, `multiplayer/rooms.ts`: ICE configuration, authorized voice registration, separate socket accounting and game-peer lifecycle cleanup.
- Web `src/App.tsx`, `styles.css`: lazy voice controls, lifecycle ownership and mobile styling.
- `apps/server/test-fixtures/e2e.ts`: optional explicitly local relay settings for tests; never selected by public startup.
- `infra/nginx/omi-testing.conf`: allowlists only the two real voice routes under /api.
- `.env.example`, `package.json`: safe credential/ICE examples and voice verification commands.
- `README.md`; docs `ARCHITECTURE.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `GAME_STATES.md`, `MULTIPLAYER.md`, `UI.md`: current Stage F status and limits.

Previously dirty infrastructure files remain uncommitted and are not claimed as newly created voice features. Engine and OWNER_RULES.md are unchanged. No schema migration, authentication-provider change or avatar implementation change was required.

## Tests executed and results

| Command / check                                        | Result                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `npm run build`                                        | Passed, all workspaces                                   |
| `npm run build -w @omi/web` after final client changes | Passed                                                   |
| `npm run typecheck`                                    | Passed                                                   |
| `npm run lint`                                         | Passed                                                   |
| `npm run format:check`                                 | Passed                                                   |
| `npm test`                                             | 121 tests in 14 files passed                             |
| `npm run test:infra`                                   | 4 infrastructure tests passed                            |
| `npm run test:voice`                                   | 4 Chromium/Firefox checks passed                         |
| `npm run test:voice:relay`                             | 4 Chromium/Firefox relay checks passed                   |
| `npm run test:e2e:nginx`                               | 24 Chromium/Firefox gameplay/profile/proxy checks passed |
| `nginx -t` in browser fixtures                         | Passed with new voice routes                             |
| Test coturn cleanup                                    | Loopback 3479 TCP/UDP listeners released after suite     |

New server/client regressions cover connected membership and Origin, four-member targeting, unchanged game versions, idempotent retry, changed retry rejection, actor/call/sequence/room forgery, strict audio-only messages, binary frame rejection, cross-room privacy, immediate logout closure, credential expiry/HMAC and invalid ICE configuration. Frontend unit tests verify opt-in permission requests, safe denied/insecure-context errors and cancellation before a delayed permission grant.

Browser tests use four isolated contexts and real native peer connections. Synthetic capture goes through getUserMedia and actual ICE/DTLS/RTP. Every participant receives RTP and observes decoded PCM speaking meters from all three peers. Relay mode additionally verifies each selected local candidate is relay. Tests cover mute track.enabled, remote mute state, volume controls, offline/rejoin, stopped tracks after leave, authenticated logout and narrow-screen layout. Screenshots were visually inspected at 320px. These results do not claim a human conversation or actual phone/speaker quality test.

Initial Chromium tests exposed permission-fixture issues and intermittent initial offer/media-readiness behavior. Explicit test permissions, a native deterministic test input, deterministic initial offering, track-unmute playback and bounded initial recovery corrected the failures. The final direct/relay suites passed with per-peer decoded-audio assertions. Chromium's synthetic-source RTP energy field remained zero despite observed decoded PCM; it is not used as proof of silence. No RTP, SDP, ICE or peer-connection implementation was mocked by browser tests. Existing unit fakes remain scoped to error/cleanup tests.

## Security observations

Exact Origin and existing account/session checks remain required. Only a currently connected member under the same game-session credential may request ICE data or connect signaling. Private game state is not imported into voice messages. SDP/ICE is privately targeted and never logged/persisted; receipt fingerprints are hashes. Audio is encrypted WebRTC, not recorded or sent to Fastify. Shared TURN secrets stay on the server; member-issued credentials expire after one hour and cannot be instantly revoked by logout alone, so real relays need quotas and network restrictions. Modified malicious peers can continue an already established direct media path outside the supported client's lifecycle; the server cannot physically revoke that path. Direct peers may learn network candidate addresses.

The tracked environment example contained a Google credential; placeholders were restored. Rotate the exposed credential. Actual private server .env, existing accounts and Cloudflare configuration were not overwritten. No alternative authentication or production guest mode was added.

## Performance observations

Final frontend: initial JS 251.42 kB / 78.51 kB gzip; lazy voice chunk 14.33 / 4.84 kB gzip; CSS 26.24 / 7.12 kB gzip. Profile/table chunks remain lazy. No new npm dependencies or database queries per audio/card frame. One local track feeds three senders; meters sample 2,048 PCM values per participant every 150ms and update React only when indicators change. Media bypasses the gameplay backend. Queues, frames, receipts, candidates, retries and socket buffering are bounded. No mobile CPU, measured data-use, public TURN capacity or long-duration soak benchmark was performed.

## Unresolved questions and known limitations

- Public Google callback registration remains blocked as documented in the infrastructure milestone. No real internet room voice was tested.
- A reachable reviewed TURN service is needed for restrictive networks; no public relay was provisioned. Cloudflare HTTP tunnels do not replace TURN.
- Local coturn 4.18.0_2 was installed through Homebrew for verification only; no global service was started. Its allow-loopback fixture must never be copied to a public relay.
- Physical Android/iPhone, Safari, hardware permission/speaker quality, external NAT/TURN TLS/TCP and hour-long credential refresh behavior are not verified.
- Background/mobile OS policies may suspend voice or require playback permission again. Refresh defaults to voice off; reconnect resumes only an opted-in call.
- Larger/multi-video/data-channel SDP is intentionally unsupported; this is bounded audio-only four-player voice.
- Existing owner rule questions remain gated and unchanged. Backend restarts still lose in-memory rooms.
- The existing non-failing Vite future native-config-loader warning remains unrelated to voice.

## Local testing instructions

See [Voice guide](VOICE.md) and ACCOUNTS.md. Run `npm run build`, then `npm run dev:server` and `npm run dev:web` in separate terminals using the existing private configuration. Open http://127.0.0.1:5173, enter a room with separate player accounts and press Join voice. Allow the microphone; test mute, individual volume, reconnect and leave. Real devices require HTTPS. Do not expose Vite or the test provider.

Automated direct tests: `npm run test:voice` after `npx playwright install chromium firefox`. For relay tests install `coturn` if absent with `brew install coturn`, then run `npm run test:voice:relay`. Test ports 3100/8082/3479 and relay ports 51000–51031 must be free. Run suites sequentially. Use VOICE_STUN_URLS / VOICE_TURN_URLS / VOICE_TURN_SECRET / VOICE_ICE_POLICY only as documented; no public credential service is selected automatically.

## Recommended next stage

Stage G — Social Features and Shared Music, only after explicit owner authorization. Stop here.

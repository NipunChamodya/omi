# Room voice — Stage F

## Implemented and verified scope

Up to four existing room members can opt into audio from the lobby or game. Each shares one audio-only microphone stream with three WebRTC peers (six bidirectional peer connections total). Includes mute/unmute, local speaking meters, individual playback gain, explicit autoplay recovery, bounded signaling/ICE recovery and credential refresh. Voice is independent of cut/deal/play/score actions. No voice is recorded, persisted or streamed through the server/WebSockets. No chat, reactions, music or PWA functionality was added.

Local Chromium and Firefox tests exercised four independent clients, real RTCPeerConnections, inbound RTP audio statistics, speaking indicators, mute, volume, offline/rejoin and stopped microphone tracks. A separate real coturn test forced relay-only ICE and verified relay candidates in selected pairs. Browser microphones were synthetic test sources, not human conversations. Assertions check RTP reception and each remote PCM speaking meter; Chromium synthetic-source RTP energy counters are not used as proof of silence. Physical Android/iPhone, Safari, external networks and public TURN capacity/quality remain unverified. The previous public Google callback registration blocker is unchanged.

## Local use

Use the existing Google account setup in ACCOUNTS.md, then build and run the backend/frontend normally. Explicit non-production guest mode remains available for existing local gameplay tests; production forbids it. Enter a room, then press **Join voice** and grant microphone permission. No permission request or microphone capture happens before this action. Use Mute microphone / Unmute microphone, each person's Volume slider, or Leave voice. A denied/missing microphone shows a safe error and a retry button. If autoplay is blocked, press Enable voice playback.

HTTPS is required outside localhost/loopback. For real devices use the same-origin HTTPS deployment; a phone's `http://192.168…` URL is not a secure microphone context. Four tabs sharing one account still share one player identity and replace connections; use separate accounts/profiles. Keep headphones available to avoid speaker echo; browser echo cancellation/noise suppression are requested.

A pending browser permission prompt can be cancelled using Leave voice. If permission arrives after cancellation, its new tracks are immediately stopped. Leave, home navigation, logout, room changes and game disconnection stop tracks, close peers/socket/audio context, remove audio elements and clear timers. Previously opted-in voice can reacquire the microphone after the game reconnects; it is not enabled for someone who never joined. Browser permission/autoplay policies may require another click. Reload defaults to voice off. Mute preferences/volumes are local to this room panel, not database preferences.

## Signaling and authorization

POST `/rooms/:roomId/voice/config` and GET `/rooms/:roomId/voice/ws` are backend paths. Through the verified proxy they are `/api/rooms/:roomId/voice/config` and `/api/rooms/:roomId/voice/ws`. Vite's existing `/api` proxy supports them; the standalone NGINX allowlist now explicitly includes both. The browser derives ws/wss from its actual API origin, never from a hardcoded public hostname.

Both routes inherit exact Origin, cookie authentication and HTTP rate limits. A current connected game member with the same session credential is required; a room invitation or membership from another account is insufficient. Logout, game socket replacement/detach and expiry invalidate voice. Only one voice connection per actor and at most four per room are retained. Heartbeat checks run every 30 seconds; binary audio frames are rejected. The unchanged 4 KiB WebSocket frame cap applies to voice too.

The server creates a fresh call ID for each connection and sends a voice-only roster. Client actions include authenticated actor, room, unique action UUID, call ID and expected **voice** sequence. This sequence is independent of game state/version so signaling cannot invalidate card actions. Targets include their current call ID; stale/departed targets are dropped without revealing another room. Strict schemas admit one audio SDP media section (max 2,800 characters) or bounded ICE candidate data, never arbitrary game fields. The browser never requests video or creates data channels.

A separate bounded 64-task queue per voice room and 90-message/10-second actor budget isolate signaling from gameplay limits. Voice action retries are idempotent within 128 hashed receipts per connection; changed contents under an ID and invalid actor/call/sequence close only that voice channel. SDP/candidate contents are forwarded only to the named current participant and never logged or persisted. Each receiver has at most three peers and 32 pre-description candidates; socket backpressure is capped at 64 KiB. Media flows through encrypted WebRTC, directly or through TURN; it is not a WebSocket payload.

A deterministic initial offerer avoids initial offer collisions. Later perfect negotiation uses polite/impolite roles and rollback for simultaneous renegotiations, with serialized incoming messages per peer. ICE restart attempts are bounded to three per failed link. Signaling reconnect attempts are bounded to four; game disconnection stops capture and resumes only after game reconnect. Fatal signaling errors require an explicit rejoin. Temporary ICE credentials refresh after 30 minutes for a one-hour lifetime.

## TURN configuration

Without ICE settings, same-network/local host candidates are used. No external STUN or relay service is silently selected. For restrictive NAT/mobile networks, configure an existing reviewed TURN service compatible with coturn's shared-secret REST credentials in the **server** environment:

```dotenv
# Replace these placeholders with your own reviewed server; do not use literally.
VOICE_STUN_URLS=stun:your-stun-host:3478
VOICE_TURN_URLS=turns:your-turn-host:5349?transport=tcp
VOICE_TURN_SECRET=your-server-only-random-secret-at-least-32-characters
VOICE_ICE_POLICY=all
```

Each URL list supports up to four comma-separated URLs. TURN URL and secret must be configured together. Policy `all` allows direct ICE with relay fallback; `relay` requires TURN configuration and permits only relay candidates. Invalid schemes, embedded credentials, excessive lists and invalid ports are rejected at startup. The shared secret is never included in browser bundles or API responses. Authenticated connected members receive a one-hour username (`expiry:actorId`) and HMAC-SHA1 credential as required by the coturn REST convention. Short-lived credentials are inspectable by their recipient and can remain usable until expiry after logout; enforce TURN quotas and short-lived access rather than pretending they are instantly revocable secrets.

Configure the relay with authentication, a matching shared secret, TLS certificates for turns, bounded allocations/bandwidth and denied loopback/private/multicast peer ranges as appropriate. Do not run an anonymous open relay. TURN has its own public listener and relay port requirements; a Quick Tunnel forwarding HTTP to NGINX does **not** provide TURN connectivity. This stage does not provision or expose a public TURN service, change router ports, purchase infrastructure or promise cross-network reliability. The separate Cloudflare/Google testing blocker remains documented in CLOUDFLARE_MULTIPLAYER_SETUP.md.

Direct WebRTC peers exchange network candidates, potentially including IP information. Relay-only mode can avoid sharing direct candidates when correctly configured. The server cannot revoke an already established media path between deliberately modified malicious clients; the supported client stops media on revocation/disconnect. No private hand or cheating history enters signaling in either mode.

References: [WebRTC TURN](https://webrtc.org/getting-started/turn-server), [W3C perfect negotiation](https://www.w3.org/TR/webrtc/#perfect-negotiation-example), [coturn REST credentials](https://github.com/coturn/coturn/blob/master/README.turnserver).

## Automated verification

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npx playwright install chromium firefox
npm run test:voice
```

Voice browser tests use compiled production assets served by real loopback NGINX, existing signed OIDC/S3 fixtures and four isolated browser contexts. They never enable fixture authentication publicly. Test audio is synthetic, but ICE/DTLS/RTP connections, media tracks and statistics are real. Chromium receives an explicit microphone permission grant and a generated deterministic WAV as its native test capture source; Firefox uses its synthetic-media preferences. No actual microphone conversation is captured. Artifacts are under ignored `.remote-testing/voice-results`.

For actual local TURN relay verification, install the free tool if absent:

```sh
brew install coturn
npm run test:voice:relay
```

The fixture starts coturn on loopback port 3479 with relay ports 51000–51031, a random private test-only shared secret, quotas and only loopback peer access. It starts no global service and stops its child process with the fixture. **Its allow-loopback test configuration must never be copied to a public relay.** Artifacts/configuration are private under ignored `.remote-testing`; no real deployment secret is needed. Selected candidate-pair statistics must report relay for all three peers per client. These tests establish local authenticated relay behavior, not real mobile-NAT, public TLS/TCP TURN or internet availability.

Run `npm run test:e2e:nginx` for existing game/profile regressions under both browsers. All browser suites need free loopback ports 3100/8082 and listening/browser-launch permission. Do not run suites sharing these ports simultaneously. No Vite development server needs to be public.

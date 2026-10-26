# Social features and shared music — Stage G

## Scope and local use

Inside a lobby or game, expand **Friends, chat & music**. Send Sinhala, English, Singlish or emojis, use quick phrases, tap the table or choose a curated reaction. The social connection is independent of gameplay and voice, and never changes cards, turns, scores or game versions.

Use the existing setup: `npm run build`, `npm run db:migrate -w @omi/server`, then `npm run dev:server` and `npm run dev:web` in separate terminals. Open http://127.0.0.1:5173 and join a room with separate accounts/browser profiles. Current Google setup and optional non-production guest testing are unchanged. Never publish test identities or the Vite server. No new environment variables or paid services are required.

## Chat, reactions and safety controls

Chat is plain text, max 400 UTF-16 code units and four lines. Valid Sinhala joiners/emoji sequences are retained; unsafe control characters, bidi overrides and malformed surrogates are rejected. React renders messages as text; HTML, Markdown, links and media embeds are not interpreted. Author IDs come from authenticated membership, not submitted display names. Quick phrases and reaction IDs are server allowlisted.

Adult-language content is off by default for each new room/device. An opted-in sender can choose the mild Sinhala adult reaction. Recipients who have not opted in do not display or play it. Chat annotation uses a small disclosed Sinhala/English word list; default viewers see a placeholder for detected adult messages. This is not comprehensive profanity detection, age verification or an abuse-prevention guarantee. Original text remains in the authorized room history and may be submitted for owner review.

**Mute and hide all reactions** stops reaction effects and visual notifications locally. Reaction sound playback is separately opt-in and has its own volume. Table taps use a short original knock and a lightweight felt/panel pulse when reactions are allowed. Reduced motion disables that animation. Incoming reactions are transient (six visible entries, about 3.5 seconds) and are not replayed when reconnecting.

Social preferences include a checkbox for each other participant. Blocking hides incoming chat/reactions and sets that participant's voice playback gain to zero on this device. Unblocking restores the previous individual voice volume. It does not kick a player, hide game moves, prevent other people from receiving that player's messages, or prevent a blocked participant from hearing your outgoing voice. It is an incoming local block, not server-enforced bidirectional account isolation. Preferences/volumes are validated and saved under a room-and-account-specific localStorage key. No hand, cookie, session token or audio is stored there. Audio-enabled flags are not persisted; reload starts silent.

## Abuse reports and owner review

Use **Report** on a recent other-player message, choose a reason and optionally add up to 280 code units. The server retrieves the original retained message/author; clients cannot supply alternate evidence or a target account. Self/unknown/expired message reports are refused. Confirmation is displayed only after persistent storage succeeds. No automatic game penalty, cheating warning or score transfer occurs.

Reports persist privately in SQLite via additive migration `0001_stage-g-reports.sql`. Evidence includes room/message IDs, reporter/subject actor IDs, original message text/time, reason, optional note and report time. There is one stored report per reporter/message, a three-per-ten-minute actor limit, a maximum of 1,000 retained reports and a 30-day retention window. Older reports can be removed by maintenance or cap enforcement even if not reviewed. Chat itself is not generally persisted; only explicitly reported evidence is stored. Reports are not broadcast or emailed and have no public read endpoint.

The owner can inspect recent reports on the server machine after migrations:

```sh
npm run reports:review -w @omi/server
```

This local CLI reads the configured database read-only and outputs JSON lines with escaped control/newline characters. Keep its output private; it includes selected message content. It does not apply moderation actions. A future administration workflow can consume reports only after separate authorization. Running from a compiled server directory also supports `node dist/social/review.js` with the correct private DATABASE_PATH.

## Shared music and separate audio volumes

Two bundled original synthetic instrumental loops, Emerald evening and Coastal breeze, plus three short reaction effects are included with a scoped CC0 1.0 notice. See `apps/web/src/social/assets/LICENSE.md` and `infra/scripts/generate-social-audio.py`. No user recordings, external tracks, samples, external music URLs or audio-upload endpoints are used. Regeneration requires Python 3, FFmpeg/libmp3lame and ffprobe; runtime hosting does not. MP3 is used for broad browser support. The tracks are exactly 32 seconds as verified by ffprobe.

The existing table host controls shared play, pause, track and seek. Track selection resets position to zero and pauses until Play is pressed. Non-hosts cannot change shared state. Every player explicitly selects **Enable music locally** before any music file is requested; enabling does not change the shared timeline. A server Play action cannot force someone else's local audio on. **Disable music locally** pauses and unloads that local media source. Reaction sounds also require explicit local opt-in. Browser autoplay restrictions show a Retry audio control rather than breaking gameplay.

Music volume, reaction sound volume and per-person voice volumes are independent. HTML5 Audio elements decode/play local files; Web Audio gain supports individual local levels where native element volume is limited. There is no microphone capture in the social audio engine, and neither user audio nor music is recorded. Music bytes are served as static fingerprinted files, never through gameplay/social WebSockets.

Shared state stores track ID, playing flag, anchor position, server update time and music revision. Only the host may submit a control with the current revision; stale controls return authoritative state rather than overwriting it. Position is calculated against server time and wraps at the fixed track duration. Clients estimate clock offset with round-trip samples and a monotonic performance clock; they correct drift above 350 ms and resample time every 15 seconds while music is enabled. Native playback is checked once a second only while enabled/online. This is best-effort synchronized background music, not sample-accurate shared audio. Internet latency, browser scheduling and mobile background policies can increase skew.

On disconnection the local audio pauses. On reconnection, previously opted-in/unlocked elements recover the current server timeline; new/reloaded clients remain silent until enabled. Chat/music survive social socket reconnect while their game room exists. Backend restart still ends all active rooms and shared timelines, even though profiles/reports remain in SQLite. Host departure does not transfer host authority; existing game host/seat policies remain unchanged.

## Protocol and limits

New backend route: WebSocket `/rooms/:roomId/social/ws`; the same-origin proxy exposes `/api/rooms/:roomId/social/ws`. No URL credentials or query strings are accepted. The route inherits exact Origin, session authentication and HTTP rates, and requires the current game connection under the same session credential. Logout, game disconnect/replacement and session expiry close social access. Lifecycle cleanup composes with the existing voice callback rather than replacing it.

A snapshot contains only a fresh social connection ID, public host ID, bounded recent chat, shared music state and server time. Actions include authenticated actor/room IDs, action UUID, current connection ID and expected sender sequence. These versions are independent of game/voice versions. Messages use strict schemas; arbitrary URLs, unknown fields, forged actors and old connection envelopes are rejected. The last 128 hashed action receipts deduplicate identical retries in the connection and reject changed contents. The supported client does not replay unconfirmed actions across reconnect; users are told to check room history before retrying manually.

Each room retains at most 30 chat entries within a 32 KiB UTF-8 budget and one small music state. History and music expire with the game room; idle room cleanup remains the existing backend policy. Each social room has its own 64-task queue, at most four connections, a 4 KiB incoming frame cap and 64 KiB outgoing backpressure cap. Actor budgets across reconnect: 40 raw messages/10 seconds, six chat/quick messages/10 seconds, eight reactions/10 seconds, eight music controls/10 seconds and three reports/10 minutes. Clock samples do not consume game-action limits. Invalid protocol traffic closes only the social socket; ordinary limits return a safe cooldown error. No raw messages or report evidence are written to application request logs.

NGINX explicitly allowlists the new route. The frontend CSP adds only `media-src 'self'` for the new bundled Audio elements; script/style/connect protections remain unchanged and no unsafe-inline/eval or wildcard permission was added. Assets are immutable-cached by their existing fingerprinted asset route, while authenticated APIs remain no-store. Initial music/effect downloads are zero until local consent; optional files total about 564 kB. Code is lazy-loaded only inside a room.

## Verification and limits

```sh
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:infra
npm run test:social
npm run test:e2e:nginx
npm run test:voice
npm run test:voice:relay
```

Install browser binaries with `npx playwright install chromium firefox`; local relay tests require the already documented coturn tool. Suites sharing ports 8082/3100 run sequentially. Tests use the compiled frontend, real NGINX/WebSockets, real MP3 playback and explicit loopback identity/S3 fixtures. They do not establish public Google OAuth, external phone behavior or production readiness. See STAGE_G_REPORT.md for actual executed results, including additive migration/retention tests. The existing public Google callback and real-network/TURN limitations remain unchanged. Stage H PWA/install/offline caching is not implemented here.

References: [HTML media playback](https://html.spec.whatwg.org/multipage/media.html), [OWASP framework/text rendering guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode).

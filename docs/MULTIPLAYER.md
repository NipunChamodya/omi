# Multiplayer backend and wire protocol — Stage C

**Implemented and tested:** four-player private rooms, opposite seats/teams, ready/start, server-owned engine actions, serial processing, idempotency, versions, private snapshots, reconnect replacement and compact events. Stage D implements the frontend flows; see UI.md. Google accounts/profiles remain Stage E. This is a single-process in-memory backend, not production certification.

## Transport identity and origin

Before account authentication exists, `POST /transport/session` creates a temporary guest transport identity. The body is `{ "displayName": "අමිල" }`. Names are trimmed, nonempty, limited to string length 32 and reject control characters. Names are plain JSON data; no HTML is rendered by the server. Existing valid cookies retain their original identity/name; this endpoint is not profile editing or Google authentication.

The response contains `actorId`, `displayName`, `expiresAt`, with no credential. A cryptographically random 256-bit opaque token is placed in an HttpOnly, SameSite=Strict, host-only cookie; only its SHA-256 hash is stored. Absolute TTL is six hours. Development uses `omi_transport`; production uses Secure `__Host-omi_transport` with Path=/. Google login and durable sessions are not implemented here.

All multiplayer HTTP routes, including reads and preflight, and WebSocket upgrades require the exact configured `APP_ORIGIN`. Missing, null and foreign origins are refused. `GET /health` remains public. Cookies are checked on upgrades, room access and messages. Browser requests use `credentials: 'include'`; WebSockets carry the host cookie automatically. Credentials are forbidden in WebSocket query strings. Production APP_ORIGIN must be HTTPS. HTTP(S) origin configuration does not itself install TLS.

Cookies require same-site frontend/backend hosting (for example app.example.com and api.example.com), or a same-origin reverse proxy. Separate unrelated hosting domains will not work with SameSite=Strict. Local examples use 127.0.0.1 consistently; do not mix it with localhost.

## HTTP endpoints

All multiplayer responses use `Cache-Control: no-store`. Credentialed CORS allows the configured origin only, GET/POST/OPTIONS and Content-Type.

| Endpoint                          | Input                                                         | Output / authorization                                                                   |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST `/transport/session`         | displayName                                                   | Temporary guest identity and HttpOnly cookie                                             |
| POST `/rooms`                     | actorId, actionId (UUID), expectedVersion: 0                  | Room descriptor; creator occupies seat 0 and is host                                     |
| GET `/rooms/:code/preview`        | Eight-character uppercase room code                           | Authenticated guest gets roomId, code, version, memberCount, invitePath; no roster/hands |
| POST `/rooms/join`                | actorId, actionId, roomId, code, expectedVersion from preview | Queued join; seats 1, 2, 3 in order; fifth refused                                       |
| GET `/rooms/:roomId/snapshot`     | Member cookie                                                 | Explicit player-specific snapshot; outsiders receive ROOM_NOT_FOUND                      |
| GET `/rooms/:roomId/ws` (upgrade) | Member cookie and Origin; no query                            | One active socket per identity; initial private snapshot                                 |

Room IDs and action IDs are UUIDs. Codes use eight secure random characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789. Invite metadata is `/?room=CODE`, relative to the frontend. Stage D consumes it in the browser join form.

Room creation starts at version 0 and assigns the ID server-side, so it has no pre-existing room identifier. All subsequent room mutations include that identifier and expected version. Authenticated actor claims must match the cookie identity. One identity can occupy only one unexpired room. The same successful create/join request is idempotent; changed contents under a committed ID are refused. HTTP version conflicts require fetching a fresh preview and submitting a new request ID. Retried HTTP receipts return their original descriptor/version; use a fresh snapshot for current state.

## WebSocket commands

Example shape (use real IDs from responses):

```json
{
  "roomId": "11111111-1111-4111-8111-111111111111",
  "actorId": "22222222-2222-4222-8222-222222222222",
  "actionId": "33333333-3333-4333-8333-333333333333",
  "expectedVersion": 7,
  "type": "ready",
  "payload": { "ready": true }
}
```

Strict Zod schemas reject unknown fields, unexpected payloads, invalid cards/IDs and invalid numeric bounds. Binary frames are closed; only text JSON is accepted. The server derives seat/team from authenticated membership, never a client claim. Clients never submit deck order, hands, trick winners, score totals, policies or replacement dealers.

| type            | payload              | Behavior                                                                                                |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| ready           | `{ready:boolean}`    | Lobby only                                                                                              |
| start           | `{}`                 | Host only; exactly four ready connected members; server chooses initial dealer, shuffles and awaits cut |
| cut             | `{offset:1..31}`     | Dealer's left; interactive cut and first four-card deal                                                 |
| trump           | `{suit}`             | Selector only, suit in first four; completes deal                                                       |
| play            | `{card:{suit,rank}}` | Engine validates turn and ownership; accepts deliberate follow-suit deception silently                  |
| accuse          | `{playId:0..31}`     | Manual entry point; UNRESOLVED_RULE by default, with no private-evidence oracle                         |
| report-no-trump | `{}`                 | Manual entry point; UNRESOLVED_RULE until timing/basis confirmed                                        |
| restart         | `{}`                 | Host and cancelled round; replacement-dealer policy required; fresh shuffle and interactive cut         |
| next-round      | `{}`                 | Host and settled complete round; normal dealer policy required, otherwise UNRESOLVED_RULE               |
| sync            | `{}`                 | Authenticated read control; returns a fresh snapshot even when expectedVersion is stale                 |

`sync` uses the same validated envelope but does not mutate state or consume the mutation receipt budget. Its snapshot has `requestId` equal to actionId and produces no ack. Repeating a sync only reads current private state.

Every membership, presence and game mutation is serialized in one bounded queue per room. Within that task the server checks identity/current connection, detects duplicate IDs and compares expectedVersion. Failed game actions do not advance the version. Successful commands commit a versioned event, then an actor-only ack. Client action IDs are scoped to identity and room. Exact duplicate mutations return their original ack with `duplicate:true` and never rebroadcast/reapply. Different contents under the same processed ID return ACTION_ID_REUSED. Processed mutation errors are retained too; use a new action ID after a version conflict or other rejection. After uncertain delivery, retry the identical original envelope before changing it, then sync if needed.

## Public events and private snapshots

`event` messages carry roomId, fromVersion, version and an explicit event union: member-joined, presence, ready, round-started, cards-dealt, card-played, score-transferred, round-cancelled. Membership/ready/presence changes advance the same version stream as gameplay.

Deal events are constructed independently for each recipient and contain only that player's four/eight cards plus public hand counts. Ordinary card plays contain the played card, turn/phase, hand counts, optional completed public trick, public score/result. They do not contain whole snapshots, replacement hands, the deck, opponents' unplayed cards or cheating flags. A complete trick is at most four public cards.

Snapshots are explicit whitelist projections: room metadata, own seat/team, public roster/presence, public round header, own current hand, public hand counts, current and previously completed public tricks, and totals/carry/result. No engine object or ledger history is spread onto the wire. `PrivateRound`, original deals, hand-before evidence, violation flags, session token hashes, receipts and private ledger entries never leave the server. Saved evidence is used only by a manual report path with trusted policy.

The Stage D client applies an event only when `fromVersion` matches its local version, ignore already-applied event versions, and request sync on a gap. Ack versions can be old on duplicate retries; an ack alone is not a state snapshot. Stage D implements this reducer/reconnect behavior; see UI.md.

## Reconnection and lifecycle

Opening the same room socket with the same valid cookie preserves actor, seat, team, ready status, hand and ledger. The new connection receives a current snapshot; the old socket closes with 4001. Old callbacks cannot mark the replacement offline or submit actions through it. A direct replacement does not create a false presence/version change. A real disconnect marks the seat offline and advances version; reconnect marks it online and advances again. Seats are reserved; no automatic substitution, forfeits, host migration or team reassignment exists.

The server pings every 30 seconds and drops sockets still lacking a pong at the next heartbeat. Expired sessions are refused on every action and terminated during heartbeat maintenance. Disconnected rooms become eligible for removal after 30 minutes with no pending queue work. Maintenance runs every 30 seconds and room creation also sweeps eligible rooms. No game result or score penalty is generated by disconnect or idle cleanup. Sessions, rooms, IDs/receipts and scores disappear on process restart; reconnect cannot recover a crashed process.

Default bounds: 100 rooms, 1,000 temporary identities, four seats per room, 64 pending tasks per room, 4 KiB inbound WebSocket frames, 64 KiB queued outbound data, 120 HTTP requests/minute/IP and 60 messages/10 seconds/identity. Rate windows survive socket replacement. WebSocket upgrades also check the current global socket count against four times room capacity plus four reconnect slots. Mutation history allows 512 processed IDs/member/room (at most 2,048/room); successful HTTP receipts allow 64/identity. Capacity exhaustion refuses further work rather than evicting accepted IDs and reopening replay attacks. Cleanup tasks can still drain a full queue. Logs redact cookies/authorization/set-cookie; protocol failures never echo frames or raw engine errors.

These application bounds are not a load-test result or a complete network-exhaustion defense. Reverse-proxy connection/upgrade limits, trusted-proxy configuration, TLS and production capacity testing remain Stage J.

## Unresolved rule gates

No owner-confirmed accusation window, no-trump timing/basis, replacement-dealer selection or ordinary dealer rotation policy is installed. Production defaults return UNRESOLVED_RULE. Tests alone inject explicitly hypothetical callbacks to verify mechanics, including exactly-once manual transfers, cancellation/restart and score-preserving continuation. Those callbacks cannot be supplied by clients and are not decisions about the rules. Test entropy injection is likewise server-only; the default source is `node:crypto.randomInt`.

A first round can play all eight tricks and settle confirmed scoring. Subsequent normal rounds remain gated until ordinary dealer rotation is confirmed. Repeated draws and Kapothi carry remain blocked in the engine. No automatic cheating warnings/penalties or unrequested scoring mechanics were added.

## Local verification

```sh
npm ci
npm run build
npm test -- apps/server/src/multiplayer/multiplayer.test.ts
npm test
npm run typecheck
npm run lint
npm run format:check
```

The integration tests create four independent cookie jars and real WebSocket clients on ephemeral loopback ports. Local listening must be permitted. They exercise a complete round, private hand delivery, races, retries across reconnect, stale versions, replaced sockets, early sync frames, isolation, malicious frames, rate/capacity/TTL bounds and explicit test-only policy mechanics. No external service or Google credentials are needed. The Stage D browser interface now supports a complete first round; see UI.md.

For manual API exploration, copy `.env.example` to `apps/server/.env`, run `npm run dev:server`, and use an Origin header with a cookie jar:

```sh
curl -i -c /tmp/omi-guest.cookies -H 'Origin: http://127.0.0.1:5173' -H 'Content-Type: application/json' -d '{"displayName":"Player"}' http://127.0.0.1:3000/transport/session
```

Use the returned actorId, a fresh UUID actionId and expectedVersion 0 to POST `/rooms` with the same Origin and cookie jar (`-b /tmp/omi-guest.cookies`). Other players need independent jars and join using a fresh preview's version. Do not share credential files or put them in URLs/repository files.

Transport lifecycle references: [Fastify WebSocket documentation](https://github.com/fastify/fastify-websocket), [ws heartbeat examples](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections). Listeners are attached synchronously, authorization runs before upgrade, and oversized/binary messages are handled separately from HTTP lifecycle errors.

## Stage D browser read equivalents

POST `/rooms/preview` accepts `{code}` and POST `/rooms/snapshot` accepts `{roomId}` with the same session/member authorization as the GET counterparts. They remain read-only and strict-schema validated. The frontend uses these because same-origin browser GETs can omit Origin; mandatory Origin checks were not relaxed. Vite proxies `/api` to the local backend for HTTP and WebSockets. UI-specific recovery, metadata and deployment details are in UI.md.

# Mobile game interface — Stage D

## Current Stage G status

The collapsed-by-default Friends, chat & music section now provides Unicode chat/quick phrases, lightweight table taps/reactions, optional adult-language filtering, incoming block/mute controls, report submission and opt-in shared music with separate local levels. The host controls the shared timeline; all players choose local playback. HTML-like messages remain visible literal text. The four-client 320px layout and real media behavior are tested locally in both browsers; physical phones and mobile-background audio are not established. See SOCIAL.md.

## Current Stage F status

A lazy Room voice panel is now available in lobby/game views. Microphone access is opt-in with join/leave, mute, speaking, individual playback gain, safe denial/errors and autoplay-retry controls. The 320px layout and all existing gameplay/profile flows are tested locally; physical iOS/Android voice and speaker quality remain unverified. Voice lifecycle cleanup does not remove the saved game seat. See VOICE.md.

## Current Stage E status

Stage E now adds Google sign-in, persistent profile names, custom gallery upload/crop/reposition, optimized avatars, logout and account-based room recovery. The profile dialog is lazy-loaded and tested at 320px. Google login is the default; entering a guest name requires explicit development-only ALLOW_GUESTS=true. One account remains one room actor across tabs; signing into an account does not adopt an existing guest seat. Voice/chat/music/PWA/themes remain future stages. The historical Stage D instructions below assume guest mode; use ACCOUNTS.md for the current setup.

**Implemented and tested:** home/create/join, room-code invite links and copy/fallback controls, four-seat lobby/readiness, relative seating, public scores/trump/turns, interactive cut, eligible trump selection, explicit card selection/play, lightweight throws, history/manual report entry points, round results, reload/resync/reconnect and offline recovery. Google login/profiles, voice, chat, music, PWA/data saver and replaceable themes remain later stages.

## Local play

```sh
npm ci
npm run build
cp .env.example apps/server/.env
npm run dev:server
# In another terminal:
npm run dev:web
```

Visit http://127.0.0.1:5173. Backend health is http://127.0.0.1:3000/health. Vite forwards `/api` HTTP and WebSocket requests to the backend, stripping that prefix and preserving the browser Origin. Defaults require no frontend environment file. Optional configuration can be copied from `apps/web/.env.example`:

- `VITE_API_URL`: public API base; default `/api`. For a same-site external backend, set its absolute HTTPS URL at build time. It must not contain secrets or credentials.
- `API_PROXY_TARGET`: development server target; default http://127.0.0.1:3000. Read only by Vite config, not shipped to browsers. Both process environment and the web workspace `.env` are supported.

Production static hosting needs a reverse proxy for default `/api`, including WebSocket upgrades, or a configured same-site API URL. Vite's development proxy is not included in the static build. Strict transport cookies and Origin checks still apply; see DEPLOYMENT.md.

Use separate browser profiles/contexts/cookie jars for four players. Tabs sharing the same cookie are the same temporary actor; one takes over the other's socket. No Google account is required yet. Anonymous identity is room transport scaffolding, not a profile/login system.

## Player flows

1. Enter a name and create a table, or follow `/?room=CODE`/enter the eight-character code to join.
2. Share the code or invite link. Clipboard failure shows selectable text in an accessible status message.
3. Four assigned seats show names, initials, team, readiness and presence. Each player readies up; only the host starts once all four are ready/connected.
4. The dealer's left receives the cut slider, keyboard-adjustable from 1–31. The backend performs the cut and first deal.
5. The selector sees suit choices present in their own first four cards. Others wait. The backend validates and completes the deal.
6. Tap a card, then press Play. Selection alone submits nothing. All owned cards remain selectable on the player's turn, including an intentional off-suit play; the UI never automatically warns about deception. It does not pick a card, score a trick or predict an authoritative outcome.
7. Opponents have only generic backs/public counts. Current/last completed public tricks are displayed; the last winner is identified below the felt. Team scores are server totals; round trick counts use public completed trick winners.
8. After eight tricks, the UI shows confirmed round outcome, totals and any carry. It does not invent the next dealer. The host's Next round action receives an honest rule-pause message under the default unresolved policy.

Local seat is always bottom, teammate top, opponents left/right using relative counterclockwise seat indices. Initial circles are presentation placeholders; avatar upload/profile work remains Stage E.

## State and transport

`game/api.ts` uses credentialed JSON POSTs and at most two identical HTTP attempts after uncertain delivery. Each attempt has a ten-second timeout; navigation aborts active form/resume requests. Mutating retries retain the same action ID/body. Join version conflicts fetch a fresh preview and use a new request ID, bounded to five attempts.

Two read-only POST equivalents were added to the Stage C backend: `/rooms/preview` with `{code}` and `/rooms/snapshot` with `{roomId}`. Same-origin browser GETs can omit Origin, so using POST allows mandatory Origin validation to remain unchanged. Existing GET endpoints remain supported. The new reads retain session/member checks and strict payload schemas; they do not mutate room state.

`game/reducer.ts` applies only contiguous public events, ignores old/duplicate/foreign-room events and requests a private snapshot on a gap. It removes a card from the displayed hand only after a confirmed local-play event. Acknowledgements do not overwrite state or advance versions. Opponents' unplayed hands and engine evidence never enter the browser.

`game/client.ts` owns sockets, pending action identity, timeouts and reconnection around a Zustand store. There is at most one pending mutation. Lost acknowledgements are retried using the identical original envelope, including after reconnect; an old duplicate ack cannot roll a newer snapshot back. State conflicts refresh through sync and ask the player to retry rather than automatically playing a different card or inventing a newer action version.

A five-second action acknowledgement timeout permits up to three sends of the same envelope. Sync requests are coalesced and time out to reconnect. Socket connection attempts time out at eight seconds; recovery uses six bounded backoff steps (0.5/1/2/4/8/8 seconds), plus bounded HTTP attempts. Manual reconnect is available. Native offline events immediately disable gameplay, close the stale socket and preserve any uncertain pending action; the matching online event reads/reconnects to the same cookie-bound table. Tab takeover (4001) does not trigger an automatic reconnection battle. Cleanup cancels timers/requests and ignores late callbacks after navigation/unmount.

Only public room ID/code/name metadata is saved in sessionStorage. No credentials, hidden hand, scores or engine state is persisted in web storage. The credential remains in the HttpOnly server cookie. On reload, the client confirms the transport identity and membership, then obtains a fresh private snapshot. If storage is blocked, live play still works but reload recovery is not guaranteed.

Home navigation closes the socket while preserving room metadata/seat. Return to your table reconnects. There is no backend leave/kick/forfeit/substitution action; an existing active identity cannot create a different room until its old room is released. Room cleanup/session expiry and process-restart limitations remain Stage C behavior. Cross-tab room discovery without saved metadata is not implemented.

## Manual reports and unresolved rules

History lists only public plays. Report controls require an explicit click and send the chosen public play index. The no-trump button is available to the opposing team; nothing is inferred about the teammate's hidden hand. Default backend rules return unresolved without penalties or private evidence. The UI explains that reporting/dealer rules need confirmation. No automatic violation detection, highlighting, warning or penalty is performed by the client.

No-trump restart and next-round controls submit actions only; the client never supplies a replacement dealer or scoring result. Repeated draws/Kapothi carry remain engine-gated. No owner clarification was inferred from authorization to build Stage D.

## Layout and accessibility

Dark emerald CSS table, warm neutral accents, system fonts and local HTML/CSS card faces. No new images, remote fonts or icon packages. These are baseline faces, not the Stage I theme registry or premium theme assets. Gameplay code is lazy-loaded after the lobby.

Portrait widths 320–430 are primary, with responsive desktop home/table layouts. At 320 pixels, eight cards use two rows of four with large targets. At 390+ they fit in one row with at least 44-pixel card controls; smaller hand sizes rearrange. Short screens scroll vertically so actions remain reachable. No horizontal document overflow was observed in the tested layouts. Safe-area padding and reduced-motion CSS remain supported.

Native buttons/forms/range/summary controls support keyboard input. Cards have text names and pressed-state selection; actions are disabled while offline/pending/out of turn. Skip link, focus outlines, alert/status feedback and real connected/turn text supplement visual indicators. Names are rendered as React text, never HTML. Accessibility work is verified only by the listed tests and visual review; no full assistive-technology audit is claimed.

## Verification and artifacts

`npm test` covers public projection, explicit actions, off-suit selection, name escaping, seats, offline controls, lost-ack retry, gap recovery, tab replacement, late callback suppression and bounded HTTP behavior, alongside the previous engine/server tests.

`npm run test:e2e` starts dedicated backend port 3100 and frontend 5173 with no reuse of unknown servers. It opens four separate mobile contexts, creates/joins via invites, readies all players, keyboard-cuts, selects trump, plays 32 cards, verifies results, reloads a hand, and tests offline/online recovery. It also exercises 320×568 short-screen play, home/join widths 320/390/430/1280, invalid invites and reduced-motion/keyboard focus.

Screenshots are generated under ignored `test-results/` for home layouts, three mobile tables, a completed trick and round results. They were visually inspected during Stage D. These files are regenerated by Playwright and are not permanent repository assets. Actual executed counts/build sizes appear in STAGE_D_REPORT.md.

Chromium viewport emulation does not establish real Android/iOS, Safari/WebKit or installed-PWA behavior. Physical-device testing and later-stage browser/PWA hardening remain outstanding.

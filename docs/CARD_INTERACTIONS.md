# Phase 16 — Card interactions, motion and sound

Later layout/navigation work is documented in [OMI_REMAINING_WORK_AUDIT.md](OMI_REMAINING_WORK_AUDIT.md). It preserves this interaction/audio implementation and replaces the earlier page-scrolling layout with a bounded game stage and accessible tools dialog. The original Phase 16 verification below is historical evidence, separate from the newer audit's fresh results.

Implemented directly in the existing web client. Server rules, private projections, command schemas, session/room authorization, action IDs and version validation remain authoritative and unchanged. No new dependency was added.

## Playing cards

- Mouse/pen: hover to lift, click to select, drag to the center to play. Touch: hold for 140ms before moving; an early swipe cancels rather than playing. A drop requires at least 24px travel into the visible center zone on the player's turn.
- Keyboard: Tab to a card, Space/Enter to select; Enter on a selected card plays it. The existing **Play selected card** button remains available. Escape cancels the lift/selection.
- Selected cards lift, scale, rotate slightly with horizontal movement and gain a deeper shadow. The center highlights only when a local play can be submitted. Outside/out-of-turn drops return to the hand.
- Pointer capture, primary-pointer checks, cancellation, lost capture, blur, hidden tabs, scrolling, resize, orientation and visual-viewport changes clean up active dragging. Only cards use `touch-action: none`; the rest of the page retains browser behavior.
- The card remains in the authoritative hand while awaiting confirmation. A translucent visual moves toward the center; an accepted server event removes it through the existing reducer. Rejection/pending completion restores its transform; the existing client error feedback remains visible. Synchronous submission and transport pending guards prevent repeated submissions.

`interactions/InteractiveCard.tsx` stores pointer coordinates in refs and updates a transform at most once per animation frame. It caches the drop bounds for pointer movement and checks live bounds on release; resizing cancels rather than using stale coordinates. React updates only selection and changes to the active/inside-zone indicator, not each pointer sample. A Profiler regression verifies that twenty additional drag movements do not create React commits.

## Authoritative animation boundary

`game/client.ts` exposes an ephemeral `presentation` marker only when its existing reducer accepts a new ordered delta. Duplicate/stale events do not change the marker. Snapshots, offline transitions, sync and socket replacement clear it. No animation is inferred from a restored hand, and no animation data is sent to the server.

`interactions/TableMotion.tsx` and table CSS show a short gather/split/interleave/recombine/straighten sequence on `round-started`, and staggered generic card backs from the deck to the four positions on `cards-dealt`. Recipient hand faces still come only from the existing private snapshot/event. Opponent animation cards are generic backs with no rank/suit metadata. Accepted public plays animate from the corresponding relative seat and completed tricks gather toward their winner.

Shuffle duration is configurable from 400–1600ms (900ms default). All animation is decorative: controls and authoritative state advance immediately, even if the sequence is interrupted or a reduced-motion client skips it. Device reduced-motion settings remove travel/shuffle/collection motion; Data Saver also removes decorative motion. No frontend randomness affects deals or scores.

## Audio

`audio/gameAudio.ts` is a shared lightweight game-effects engine. It creates one reusable AudioContext after a trusted pointer/keyboard gesture, supports the Safari-prefixed constructor fallback, resumes suspended contexts on later gestures, fetches same-origin MP3 assets lazily, caches decoded buffers, caps simultaneous sources at eight and throttles repeated cues. Missing assets and denied autoplay fail quietly. Old pending loads, hidden-tab effects and scheduled cues are cancelled on teardown/recovery. Slow loads beyond 700ms are dropped rather than landing late.

Accepted events use room/version IDs plus cue suffixes for once-only sounds. The audio manager keeps a bounded 256-ID suppression set, including events received while muted; enabling sound does not replay history. Placement sounds follow accepted server events, not drag success predictions. Deals use four subtle staggered flicks per batch. Shuffle foley includes paper gathering, splitting, interleaving and a deck tap. Trick gathering and round results are delayed briefly for presentation without delaying gameplay.

Other cues include touch, release, soft rejection, trump, join/disconnect, your turn, and UI buttons. Strong placement, optional drag, and win/loss variants are available in the cue catalog. There is deliberately no continuous drag sound. The existing protocol defines round settlement but no terminal **match won/lost** event or match-winning threshold; win/loss variants are reserved for a future authoritative match result, rather than inventing a rule from the score.

Eight original synthesized mono MP3 assets total **20,614 bytes**. Their generator and provenance are in `infra/scripts/generate-card-audio.py` and `apps/web/src/audio/assets/README.md`. No commercial game recordings or third-party samples were used. Assets are separately emitted, not embedded in JS or service-worker precached.

## Settings and mobile layout

**Sound & motion** provides master on/off, effects volume (35% default), card/UI/celebration categories, optional very quiet ambience (off by default), independent voice-chat volume (80% default) and shuffle duration. Preferences use bounded localStorage values with storage-error fallbacks. Master mute also silences existing social music/reactions; microphone/voice playback uses its separate controls. Existing per-peer voice volumes compose with voice master volume and blocks always remain zero.

During gameplay the board and hand appear before ancillary settings/voice/social panels, with a **Sound** shortcut in the room toolbar. Short-screen layout, smaller cards and safe-area padding keep hands accessible. Normal page scrolling remains available to reach settings and history; dragging itself cannot pan the page. Browser tests check every hand card within 320×568, 375×667, 390×844, 393×852, 430×932 and 667×375 landscape viewports.

## Verification

All test listeners/providers are local, use synthetic identities/media or disposable databases, and do not access production services. Verification uses the existing local Node 22.23.4 runtime because the shell's default Node is below the repository baseline.

| Check                                               | Result                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                          | PASS: 25 files, 187 tests, including existing server authorization/private-hand and expired-recipient regressions                                                     |
| `npm run typecheck`                                 | PASS: all workspaces; final web build also typechecks the web application and tests                                                                                   |
| `npm run build` / final `npm run build -w @omi/web` | PASS; existing Vite warning about future native-config extension requirements remains                                                                                 |
| `npm run lint`                                      | PASS                                                                                                                                                                  |
| `npm run check:build`                               | PASS: entry JS+CSS gzip 89,191 bytes, under the existing 100 KiB combined budget; no public source maps; server-marker check passes                                   |
| `npm run test:e2e:nginx`                            | PASS: 26 Chromium/Firefox tests, including physical drag/drop, keyboard, viewport/orientation, reconnect, native audio, preferences and existing NGINX/account checks |
| `npm run test:voice`                                | PASS: 4 Chromium/Firefox tests using real peer connections and synthetic microphone audio; block/mute/reconnect/logout regressions                                    |
| `npm run test:social`                               | PASS: 2 Chromium/Firefox tests; opt-in shared music/reactions, synchronization and social protections                                                                 |
| Changed-file Prettier and `git diff --check`        | PASS                                                                                                                                                                  |

The final first-turn alert adjustment also has a dedicated hook regression: changing from trump selection to playing announces the local turn even when the selector keeps the lead, without repeating on unrelated state updates or restored snapshots. The focused final game/audio browser rerun passed all **6 tests** across Chromium and Firefox against the final compiled application.

An initial combined 32-test browser experiment shared one server across all suites and exhausted loopback-IP request budgets; final runs use the supported isolated suite configurations with fresh fixtures. Production rate limits were not loosened. The expanded checks also caught and corrected a blocked-player slider display regression, an overly broad social-test asset filter and a native audio resume/decode cancellation race. The social test still enforces zero **social** music/reaction asset requests before opt-in; gesture-enabled game foley is tested separately. A new unit test protects the resume/decode race. No failing assertion was disabled.

Covered regressions include mouse/pen/touch drag, early touch swipe, outside drop, keyboard play, interruption/cancellation, repeated submissions, authoritative rejection/hand retention, remote public animation, snapshot/stale/duplicate suppression, audio preferences/volume/autoplay/suspension/missing assets/cache/cleanup, optional ambience and voice master/block composition. Existing server security/privacy tests are preserved.

Browser coverage includes four-player real mouse drag, real Chromium touch events with unchanged page scroll, keyboard play, hand containment, reconnect without old animations, production NGINX/CSP, native audio startup/decoding, preference persistence, and existing social/voice regressions. Screenshots/traces are ignored local artifacts.

Physical Samsung Galaxy S24 Ultra, iPhone SE 2, iPhone 12 and iPhone 15 hardware were not available. Viewport emulation and desktop engines do not establish device frame rates, speaker quality, Safari audio interruption behavior or real-world battery/thermal performance. Those require a physical-device acceptance pass. No commit, push or deployment was performed.

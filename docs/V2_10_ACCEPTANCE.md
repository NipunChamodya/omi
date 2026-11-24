# V2.10 acceptance checklist

| Gate | Evidence or remaining acceptance |
| --- | --- |
| Preserve repository | Private verified checkpoint before development |
| Authoritative Create and Join seat recovery | Transport session descriptor, client reconciliation and room queue checks |
| Distinct join errors | Format, unavailable code, started match, full lobby and seat ownership |
| Lobby, completed and active-casual release | Existing release path and restart regressions retained |
| Ranked assignment | Four authenticated players assigned correctly in Chromium and Firefox. The seeded Chromium test completed nine ranked hands, reconnected the four app sessions to results, and started a new match by rematch vote. |
| Consistent UI | Tropical panel styling extends to profile, settings and tutorial. Full screen-by-screen visual acceptance remains open. |
| Approved design rules | The referenced upload was unavailable through the repository and connected search. No substitute file was created. |
| Accessibility and responsive widths | Targeted browser checks. Full WCAG 2.2 AA and physical-device acceptance remain open. |
| English, Sinhala and Tamil | Targeted corrections. Complete review and Tamil coverage remain open. |
| Required end-to-end scenarios | Four authenticated Chromium clients completed nine casual hands, saw the match result, and started a rematch. Dedicated SQLite recovery tests passed. Chromium and Firefox now cover abrupt SQLite-backed restart, browser reload and completion of a casual round. A four-human restart through final match results remains open. |
| Automated inventory | [374 distinct passing cases](V2_10_TEST_INVENTORY.csv) across 310 Vitest, 15 infrastructure, and 49 Playwright scenarios. The 1,200-case gate remains open. |
| Production and safety | No production changes or resource provisioning. Existing policy gates retained. |

## Final acceptance matrix

The [screen inventory](V2_8_SCREEN_INVENTORY.md) lists the existing routes and intentional scope exclusions. A browser assertion, a visual inspection, and a device check provide separate evidence.

| Area | Evidence available | Open acceptance |
| --- | --- | --- |
| Welcome, splash, connection, errors | Opening screen visually inspected on desktop. Loading and authentication exercised in selected browser journeys. | Inspect startup, offline recovery, and error states across required viewports. |
| Mode picker, Create, Join, saved table | Browser navigation, cross-tab reconciliation, server ownership and queued lobby removal regressions. | Inspect each saved-seat state and error dialog on mobile and desktop. |
| Lobby, matchmaking, invitations | Four independent ranked sessions reached their assigned lobby. Persistence coverage includes eligible lobbies and invitations. | Visual inspection of host transfer, pending invitations, and ranked queue states. |
| Board, hands, timers, trick replay, results, rematch | 320px board visually inspected. Eight-trick browser journey includes replay and drag. Seeded full casual match and rematch. | Verify timer expiry and reconnect in the same browser journey. Inspect result and replay layouts across sizes. |
| Profile, avatar, friends, statistics, leaderboard | Mobile crop editor visually inspected. Fixture account upload, replacement, and removal have browser coverage. | Inspect all nested panels and verify complete localized statistics and leaderboard flows. |
| Settings, music, voice, tutorial, install | Selected settings navigation, tutorial, bundled music, synthetic voice, and PWA browser cases. | Inspect all controls and permission states. Live TURN, physical installation, and provider acceptance remain unverified. |
| Reporting, Protected Play, moderation | Defensive service checks cover reporting, permissions, and protected communication. | Browser and visual acceptance across player and moderator flows. |
| Persistence and recovery | Isolated SQLite service restart and match-state cases. | Browser journey that interrupts and restarts the server mid-hand, then finishes the match. |
| Accessibility and localization | Selected reduced-motion, keyboard, mobile wrapping and Sinhala persistence scenarios. | Full string audit, approved Tamil scope, screen-reader acceptance and WCAG 2.2 AA review. |
| Production readiness | Single-instance Azure templates and local infrastructure checks. | Owner environment mount, restore drill, DNS/TLS, real-network performance, provider credentials and approval. |

### Physical-device acceptance

Use a private authorized HTTPS test endpoint with four test identities. Record device model, OS/browser version, viewport, language, and the build SHA. Physical-device acceptance remains unverified.

1. On iPhone Safari, use Share → Add to Home Screen. Launch from the icon and check session recovery. On Android Chrome, use Install OMI when offered and launch the installed app.
2. Switch to Sinhala, reload, then check headings, form inputs, error dialogs, timer labels and score summaries in portrait and landscape. Repeat with OS reduced motion enabled and test keyboard/focus and VoiceOver or TalkBack.
3. Create a casual table and join from three independent sessions. Complete eight tricks using both taps and drags. Verify the card fan, trick replay, score, turn timer and results. Start a rematch and confirm new match state.
4. Background one phone during an active hand, switch networks, and resume. Verify the same seat and private hand return. In a separate ranked match, verify the forfeit warning before any deliberate departure.
5. In a permitted account, test photo selection and microphone prompts. In Protected Play, verify restricted media controls cannot be used and reporting is available. Repeat with an interrupted connection and record each outcome.

### Reproducing full browser matches

Build the workspaces and run each scenario against a freshly started fixture. The test uses fixture identities and an authorized WebSocket driver for deterministic card play. It uses the actual UI to enter ranked matchmaking, display results, reconnect the ranked pages, and vote for a rematch.

```sh
npm run build
OMI_TEST_SEEDED_MATCH=1 npx playwright test -c playwright.seeded.config.ts --project=chromium --grep 'fresh ranked'
OMI_TEST_SEEDED_MATCH=1 npx playwright test -c playwright.seeded.config.ts --project=chromium --grep 'fresh casual'
```

Run the scenarios in separate invocations so each uses the same opening random seed. The fixture sends no requests to live identity providers.

### Recorded failures and retained evidence

- The first combined Chromium attempt failed the casual roster assertion because it read a cached join snapshot. The scenario now requests an authoritative snapshot for each seat.
- The first ranked attempt finished gameplay, but the app still displayed the expected seat-transfer warning after the test driver opened a second socket for each player. The corrected test returns control through the visible Reconnect action and verifies the results and rematch.
- The 390px ranked and casual results captures were visually inspected. It exposed small replay and reveal-speed controls, which now target 44 CSS pixels and passed the four-player Chromium and Firefox browser regression. The replay dialog was visually inspected after the change. The prior desktop opening, 320px game board, and 390px avatar editor images cover selected surfaces only.

### Inspected screenshot inventory

| Screenshot | Viewport | Evidence |
| --- | --- | --- |
| `tropical-1280.png` | 1280px desktop | Opening screen and create/join presentation |
| `tropical-board-320.png` | 320px portrait | Seats, score, cards and curved fan |
| `profile-crop-390.png` | 390px portrait | Avatar crop editor |
| `ranked-results.png`, `casual-results.png` | 390px portrait | Eight-trick summary, loan-loss result, score and rematch action |
| `replay-390.png` | 390px portrait | Replay dialog, captured by the targeted four-player browser test |

The full-match reproduction commands write screenshots to the Playwright output directory. The game, profile and shell specs produce the supporting captures.

## Cartoon UI follow-up

The [per-screen visual inventory](V2_10_VISUAL_ACCEPTANCE.md) records the implemented treatment, inspected widths, and remaining screenshots. The broad browser pass first had four failures. The four-player game test still tried to open inline lobby settings, and the returning-profile test still expected a saved seat to open automatically after sign-in. Both were updated to use the visible application actions. The next concurrent run hit a Chromium reload timeout and a Firefox guest-join timeout in profile cases. Both profile scenarios passed serially in Chromium and Firefox. The timeout history remains recorded for follow-up under load.

The local Chromium fixture passed synchronized bundled music, four-peer voice with synthetic microphone input, microphone teardown on logout, card-theme persistence, and fallback when a card theme fails to load. No production providers were exercised.

## Ultimate directive traceability

| ID | Requirement | Implementation and evidence | Remaining gate |
| --- | --- | --- | --- |
| ENTRY-01 | Startup splash and failed-service retry | App shows the mascot during the real session request. Browser test delays a real request, returns 503, and exercises Retry. | Separate offline PWA and physical launch acceptance. |
| RECOVERY-01 | Consistent game reconnect and seat ownership | Game client aborts obsolete reads, bounds socket retries and waits for an authenticated socket snapshot before enabling actions. Terminal session loss clears the private view and saved seat. Separate browser interruption and unit stale/replacement checks. | Full four-human restart-to-match-results journey. |
| RECOVERY-02 | Abrupt process recovery | Dedicated loopback fixture with a private SQLite database and an isolated child process. The test restores the table and local hand, reloads the browser and completes the round through real browser controls. | Broader restart cases and end-of-match multi-player settlement. |
| VISUAL-01 | Cartoon active table and startup | Brighter patterned felt, layered wooden border, avatar and active-seat accents, tropical startup background. Inspected selected browser captures. | All screens, dynamic states, required widths and full accessibility. |
| AUDIO-01 | Four-way voice and hold-to-talk | Existing authorized mesh. Synthetic microphone RTP delivery, bundled music and a real card play, reconnect and logout. Hold-to-talk changes the actual outgoing track and releases on lost focus or visibility. | Live devices and TURN. Microphone selection and full accessible media redesign remain open. |
| AUDIO-02 | Local-file music and independent mix | Bundled music remains available under the current permissions. | Local-file broadcast is unimplemented. A separate authorized media track and broadcaster lifecycle are required. Combined local music, voice and gameplay remains open. |
| LANG-01 | English, Sinhala and Tamil | Initial startup, connection and hold-to-talk labels added in English and Sinhala. | Complete language audit, Tamil, long strings and physical shaping. |
| COVERAGE-01 | 1,200 independently useful passing cases | Cumulative results in the [test inventory](V2_10_TEST_INVENTORY.csv), deduplicated across browsers and reruns. | Case-count and coverage-category minima remain open. |

### Restart reproduction

```sh
npm run build
OMI_TEST_RESTART_DIR="$(mktemp -d)" npx playwright test -c playwright.recovery.config.ts --project=chromium
```

Use a fresh directory for each run. The restart marker is only consumed by the loopback fixture runner. The backend child process is disposable and the fixture's SQLite database is isolated. The game server's production entry point does not expose a restart route.

The first Firefox restart run read card DOM immediately after the socket status changed, while the lazy table was still loading. The first rerun still used the ungated assertion. After correcting the assertion to wait for eight rendered cards, Firefox passed. The test uses one human and three bots and settles a round. Four-human full-match recovery remains a separate acceptance gate.

# OMI V2 development status

This document records the current implementation. Stages A–J and earlier audits describe their original baselines.

## V2.6 changes

- The Home and multiplayer menus use a brighter palette, rounded panels, a CSS card mascot, a large Play OMI button and a menu dock. The opening animation is decorative, observes reduced-motion and Data Saver preferences, and is suppressed when restoring an active table. Gameplay grid, card rendering, drag behavior, and server rules were preserved.
- Settings and profiles participate in browser history. Settings opens as a dialog from the menu and during play. Lobby tools remain available inline. Exiting a lobby or active game requires confirmation and leaves the authoritative seat recoverable. Ranked games explain the existing reconnection deadline and forfeit. Home shows the saved seat with Create/Join guidance. Releasing an unfinished seat is still governed by the existing server lifecycle.
- Profile photo editing has an explicit picker action when a configured server permits uploads. Voice and music share a discoverable table control and preserve existing permission gates and listener opt-in. Music currently uses the curated bundled tracks. User-selected media ingestion and sharing are not implemented.
- Install uses a captured native prompt on supporting browsers, an iPhone/iPad Safari Share guide, and suppression in standalone mode. Service-worker update and offline notices stay visible outside Settings. Added Sinhala strings for navigation, installation, voice controls and synchronized music. Remaining English includes parts of game announcements, profile statistics, and secondary social messages.
- From clean `dev` at `5d80e4d`, verified a non-destructive checkpoint of 269 tracked and untracked project files. No server changes or live deployments were made.

### V2.6 verification

- The final Vitest run passed 234 unit/integration tests. The focused defensive suite passed 109 of those cases and the infrastructure suite passed 15 tests. TypeScript, lint, production build and the bundle gate passed. The compressed entry totaled 96,572 bytes.
- Thirteen distinct browser scenarios passed across the selected shell, gameplay, avatar, PWA, shared-media and voice runs, counting different viewport cases and counting cross-browser reruns once. Initial gameplay, PWA and music checks failed around changed settings visibility and the lobby-leave confirmation. The corrected flows passed on Chromium and Firefox. The four-peer voice check passed on Chromium with synthetic microphone input.
- A disk-backed loopback benchmark served eight rooms and 32 clients, completed 320 actions and eight reconnects, and measured action p50/p95/p99 of 2.19/5.95/6.71 ms, 4.7% average combined CPU and 187.1 MiB peak combined RSS. Cloud and physical-device results remain unverified.
- The 1,200-case target was not met. Major gaps include full-match and rematch browser journeys, broader Sinhala coverage, mobile hardware and installed-PWA acceptance, Internet relay tests, and overload scenarios beyond the loopback harness.

## V2.5 changes

- Signed-in table members can report another human player without opening chat or voice. The report collects a reason category, the two internal account or seat IDs, table and timestamp. It stores no free text, chat transcript, audio or cards. The existing moderator workflow sees the report. The route requires exact Origin, session, CSRF and room membership, limits submissions per account and deduplicates the same target within a match generation.
- HTTP create and join receipts now commit atomically with SQLite room changes. They are scoped to the authenticated actor, expire after 24 hours, and are bounded at 64 per account and 16,384 overall. A replay requires current membership in the original table and an identical request fingerprint. The browser already retries an uncertain response with the same action ID.
- Table errors use stable server codes for English and Sinhala feedback. The reporting form is bilingual. Complete translation of dynamic profile, statistics, game announcements, settings and secondary social surfaces remains pending.
- Azure systemd startup now requires a verified existing database on the mounted data directory. Production Elo, existing gameplay, white cards and opening-only sponsor gating were preserved.

Protected-play deactivation and child account onboarding remain gated pending an owner-approved age and guardian workflow. Before public operation, verify applicable jurisdictions, data retention and deletion, consent and parental access requirements where applicable, and provider policies. [FTC COPPA guidance](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy) · [Sri Lanka Data Protection Authority](https://www.dpa.gov.lk/) · [Google child-directed treatment](https://support.google.com/adsense/answer/3248194)

### V2.5 verification

- From clean `dev` at `d1e15dc`, verified a private checkpoint of 265 project files. Final checks passed 232 unit and integration tests, 109 in the focused defensive suite, 15 infrastructure tests, four selected Chromium/Firefox checks and four PWA checks. Production build, typecheck, lint and the 100,036-byte compressed entry passed. An initial test expected rate limiting one call early; the corrected regression verifies enforcement on the sixth authenticated attempt. The selected browser checks covered 320 px Sinhala and mobile gameplay with reload recovery.
- The disposable SQLite load run served eight rooms and 32 clients across 320 actions and a 10-second idle soak. Local action p50/p95/p99 were 1.93/3.57/4.29 ms. Combined CPU averaged 4.8% and combined RSS peaked at 187.4 MiB. Physical-device acceptance, real network throughput, extended overload scenarios and cloud recovery are unverified.

## V2.4 changes

- Expanded the existing Sinhala catalog across navigation, login and profile controls, friends, lobby, gameplay feedback, moderation and PWA settings. English fallback is safe for unknown copy and the compiler checks keys used by the typed catalog. Dynamic errors and some settings, moderation, match statistics, and game-state copy still need translation.
- Account-level protected play requires an authenticated, same-Origin, CSRF-protected request. The user confirms activation in their profile. The application cannot turn this setting off pending the owner’s guardian policy. Protected play disconnects live voice and chat, blocks new connections and friend or room invitations in both directions, suppresses opening sponsorship, and hides profile photos and friend-code sharing. Existing friend removal and blocking remain available. Production guest and ranked communication restrictions stay in force.
- The existing dashboard can restrict or restore communication for a reported registered account. Configured moderator IDs, CSRF, and rate limits apply. Restrictions leave gameplay available and write a separate audit record on state change. Active restrictions can be lifted after the original report evidence expires. Guardian/age verification, account suspension and legal or provider acceptance remain open.
- Unstarted lobbies and expiring invitations now use SQLite alongside active matches. Invitation acceptance commits the seat assignment and consumes the invitation in the same transaction. Restart recovery rechecks expiry, idle lobby age and friendship eligibility. Gameplay command receipts remain durable. HTTP create/join idempotency receipts remain process-local.
- The local `/ready` probe checks that SQLite can read the match-state table. The public health check still reports liveness. Scheduled account and room maintenance failures log fixed event names without private state. Production Elo remains gated; approved game rules, table arrangement, white faces, card backs and artwork references were preserved.

## V2.4 verification

- Started from a clean `dev` at `a565d3c`. The final checks passed 229 unit and integration tests, including the 107-test focused defensive security selection, and 15 infrastructure tests. Eight selected browser checks and four PWA checks passed. Build, TypeScript, lint and the bundle gate passed; the compressed entry totaled 98,815 bytes. The test suite covered account privacy, moderation, transactional rating and duplicate settlement, clean restart with an invite, and abrupt termination with committed match and lobby state.
- The 320 px Sinhala join flow, English join flow, friend codes, four-player play/reload and PWA checks ran in Chromium and Firefox. Two Firefox checks timed out in the initial parallel selection and passed on serial rerun. Physical mobile devices and real network behavior remain unverified.
- The supported loopback load run used a disposable SQLite WAL database, eight rooms, 32 clients, 320 actions, eight reconnects, eight replay checks and a 15-second idle soak. Action p50/p95/p99 were 2.32/4.00/8.17 ms. Combined process CPU averaged 4% and peak combined RSS was 209.4 MiB. The harness rejects a 12-room run. This run did not model reconnect storms, slow peers, cloud latency or production capacity.
- The local production preflight reported missing production mode, loopback proxy and secure-origin settings, avatar storage and TURN, an absolute database path and the expected migration level on the configured development database. The production database, Azure deployment and public provider checks remain pending.

## V2.3 changes

- The same table can start a new match once all human players accept and reconnect. Newly added permanent bots carry across automatically. The prior generation is archived in the same SQLite transaction that activates the new one. Room code and seats remain stable and the room version sequence continues, while each generation has a separate idempotency key for results and ratings.
- Private lobby hosts can invite an accepted friend as a player or teammate. Invitations are bound to the recipient, expire after ten minutes, and are checked again at join. A blocked or removed friendship revokes pending invitations. Teammates take opposite seats before a match starts. Invitations and unstarted lobbies are process-local, so restart clears both.
- Profiles show newly recorded settled-hand summaries and aggregate outcomes with account-backed partners. Existing experimental rating history and leaderboard remain opt-in. Proposed defaults can be configured with `ELO_INITIAL`, `ELO_K`, and `ELO_FLOOR`. Competitive updates are still rejected in production.
- Production casual guest entry requires two explicit flags and uses secure host cookies. A valid guest cookie can recover a saved server-side seat even if the tab has no saved room. Guests cannot enter ranked matchmaking or use production chat or voice. Production private communications are also off for signed-in accounts by default.
- The moderator dashboard requires a configured account UUID, a valid session, same Origin, and CSRF. It presents bounded recent report evidence and writes revisioned review actions to an audit table. Account suspension controls and a child-specific guardian workflow remain open.
- A persisted Sinhala/English preference translates common navigation, lobby actions, game controls, and selected profile labels. Full settings, error, statistics and moderation localization remains incomplete.
- A configured first-party sponsor still appears only on eligible initial Home. A separate per-creative approval flag is required and sponsor URLs with query strings or fragments are declined. No third-party integration or personalization was enabled.

## V2.3 verification

Development started on clean `dev` at `13c5761`. The private ignored checkpoint at `.remote-testing/omi-v23-checkpoint-13c5761/worktree.tar` includes tracked and untracked workspace files, excludes Git metadata and the checkpoint itself, and passed SHA-256 and file-by-file comparison across 26,724 entries.

The V2.2 focused baseline passed 49 tests. V2.3 passed 224 unit and integration tests, 105 within the focused defensive security selection, and 15 infrastructure tests. Six selected Chromium and Firefox checks passed for gameplay, the friend-code flow, and 320px layout. The final targeted selection covering auth, production communication defaults, recovery and the web client passed 40 tests. Production build, typecheck, lint and bundle checks passed with 95,063 compressed entry bytes.

The disk-backed loopback run handled eight rooms and 32 clients. Action p50/p95/p99 were 2.26/4.72/7.88 ms, with 187.6 MiB combined peak RSS. The read-only local preflight still failed production-mode, proxy, secure-origin, avatar storage, TURN, absolute database path, and current-migration checks. The live database and Azure resources were unchanged.

## V2.2 changes

- A 4–4 hand leaves one pending Sepuru, even after consecutive draws. The next ordinary hand or Kapothi clears it. Kapothi transfers three kata kola. Previously saved Kapothi and repeated-draw gates are normalized on recovery.
- A player with eight cards and zero trump may request a redeal before the first play. The server atomically replaces the hand with a fresh shuffle at the same dealer and preserves the ledger. A V2 pending vote is discarded on recovery. An eligible player can make a fresh request. Previously cancelled V2 hands can still use the legacy restart control.
- The earliest expired ranked deadline wins precedence. Equal opposing deadlines settle both teams as forfeiting, with no winner. Recovered seats that lack a persisted deadline share one recovery timestamp. Ranked chat and voice are disabled at both the interface and server boundaries. Private-room reporting and opt-in voice remain available.
- Local opt-in Elo uses proposed defaults of 1,000, K=32, and floor zero. Each partnership uses its average against the opposing partnership. A double forfeit leaves ratings unchanged. Current rating, recent adjustments and a bounded leaderboard appear in the profile when the flag is enabled. Production rejects that setting. The match and rating records share a transaction and historical matches are not backfilled.
- A configured first-party sponsor may appear on the initial home screen once in the browser tab session, after successful account bootstrap confirms there is no match to restore. Navigation, busy state, join links and saved matches suppress it. Third-party ads and personalization remain disabled.
- The existing 32-card renderer, layout, backs and tap/drag controls are reused. White backgrounds and the pip counts are already implemented.
- See [Azure deployment](AZURE_DEPLOYMENT.md) for the single Linux VM, mounted managed disk, direct TLS and future scaling plan.

## V2.2 verification

The worktree started clean on `dev` at `d881f40`. V2.2 passed 218 unit/integration tests and 15 infrastructure tests. The recovery cases include abrupt SIGKILL after a committed snapshot, retired V2 rules, double forfeits, and duplicate settlement with experimental rating history. Six selected Chromium/Firefox checks covered the mobile round and the card themes. Build, typecheck, lint, and the bundle gate passed, with 93,273 compressed entry bytes. The generated Azure nginx configuration passed a local syntax check with a disposable certificate.

The disk-backed benchmark used eight rooms and 32 clients. Action p50/p95/p99 were 2.24/5.45/7.13 ms. The combined benchmark process measured 196.4 MiB peak RSS and 7.5% average single-core-equivalent CPU over gameplay and a five-second idle socket soak. Eight reconnects and eight duplicate-action checks passed. The benchmark does not measure remote network capacity or SQLite latency in isolation.

## Remaining V2.2 acceptance

Competitive Elo parameters still require approval. Same-table rematches, fixed partnerships and in-app invitations, complete Sinhala/English localization, detailed partnership and per-hand statistics, production guest entry, and an administrator dashboard remain incomplete. Age and guardian rules, private-room child-safety acceptance, and advertising policy review remain open. Apple, public Google, live TURN, physical devices, and Azure cost and deployment acceptance remain unverified. Court artwork still needs an authorized source.

The sections below describe the historical V2 baseline and retain the previous verification record.

## Gameplay

Two teams begin with 10 kata kola each. Settlement transfers ownership without changing the total of 20. A payable transfer that empties the payer's inventory is terminal. An unaffordable obligation is recorded as unpaid and ends the match immediately in loan loss. The payer keeps its remaining counters. A settled round rotates the dealer counterclockwise. Successful Baldu ends the hand with a three-counter obligation. The server validates a report for an opponent's completed trick while the hand is still in progress. Validation is synchronous inside the serialized room command, so a card cannot interleave with adjudication. Invalid reports leave the hand unchanged.

Sepuru creates a pending flag. An ordinary selector win costs the other team one, and an ordinary selector loss costs the selecting team three. Kapothi costs the loser three even with pending Sepuru. A nonterminal Kapothi immediately after Sepuru settles first and gates the next deal pending clarification. A repeated Sepuru also gates settlement. Baldu leaves pending Sepuru available for a later ordinary settlement.

After the second deal, the server checks that the requesting player currently holds zero trump cards. A cancellation vote pauses play. The other three seats may vote once. Two approvals cancel the hand and the host can start a fresh shuffle and cut with the same dealer. Two rejections resume the current hand. The requester cannot vote. Repeat requests following rejection are gated pending an owner policy. There is no vote timeout.

## Multiplayer and recovery

Private rooms are casual. The host can fill open seats with bots. Existing public account matchmaking assigns ranked tables with four distinct signed-in people. The server applies a 40-second grace period when a seat disconnects during a match. At expiry casual bot control uses only the seat's own cards and the public trick. A returning player reclaims the seat through the serialized room queue. A ranked disconnection can settle a terminal forfeit without a counter transfer. Simultaneous opposing-team deadlines require a decision. Bots do not cast cancellation votes. An active vote can remain pending if eligible voters never return.

The existing SQLite repository stores started matches and accepted action receipts in a private, checksummed snapshot. Server-side command mutations write the new version before publication. Final results and deduplicated participant records are written in the same SQLite transaction. Reopening the database restores accounts' existing match membership and the private match snapshot. A restart starts a recovery window for previously connected seats and preserves deadlines already committed. Configured casual guest identities keep their hashed credentials across restart until normal expiry or revocation. Production continues to disable guest entry. Unstarted lobbies and the matchmaking queue remain process-local. Players can release a finished seat and return home to start a new match. Finished idle matches are archived with the ledger and participant summaries and without the last private hand or receipts in the current row. Backups contain private state and must be protected as carefully as the live database.

Profiles show aggregate completed-match, win, loss, win rate, casual/ranked win, loan loss, and ranked-forfeit loss counts. Profiles also list up to ten recent match outcomes without exposing opponents’ private data. Ranking formula, leaderboard, and per-hand and partner statistics remain open. Account profiles include friend-code requests, accept/reject, removal, and blocking. The endpoint requires the account session, exact Origin and CSRF token. Request rates and contact edges are bounded. This block covers account friend requests. Existing room chat and voice controls retain their own block state. The existing owner report-review CLI remains available.

## Presentation and services

The supplied 2616 × 386 PNG shows A♣, 10♣, Q♦ and J♦ on cream faces, with no card-back view. The original screenshot is preserved. Its artwork license and original full deck are unavailable. Both existing themes now use white faces with red/black markings, mirrored indices, and scalable number-card pip layouts. The existing original backs and compact rank/suit court fallback remain. Traditional illustrated courts await authorized, suitable originals. Match result, transfer, and loan-loss cues reuse local audio and respect existing preferences. The beginner practice quiz supports English and Sinhala. Full interface localization remains open.

Optional first-party text advertisements can appear on Home and in the lobby with both public build values set. The default contains no ad content, script, tracking integration, or provider credentials. Any external provider and its consent flow require separate integration and verification.

## Open acceptance

- Confirm Sepuru after a nonterminal Kapothi, repeated Sepuru, repeat cancellation requests, and how to resolve simultaneous opposing-team ranked forfeits.
- Complete same-table rematch, production guest configuration, Apple sign-in, in-app room invitations and fixed-team seating, expanded stats, rankings, and an administrator moderation dashboard.
- Verify public Google sign-in, durable cloud storage, public WSS Internet play, TURN and real-device Safari/PWA behavior. No public deployment is part of this run.
- Evaluate production disk growth, quota/retention policy, host recovery and alerting, and real-network performance. This implementation assumes a single authoritative process using local SQLite.

## Local verification on 2026-11-23

- Repository baseline was `dev` at `bb02de2`, with only the owner's card screenshot untracked. Baseline build and all 205 tests passed with the existing Node 22.23.4 runtime and loopback permission.
- V2 build, TypeScript, lint, diff whitespace and bundle checks passed. The entry payload was 93,124 compressed bytes against a 100 KiB combined budget. No public source maps were emitted.
- 212 unit/integration tests passed, including 95 focused defensive security tests. A real WebSocket regression finished four successive Baldu hands, verified the 19–1 loan loss, and replayed the terminal accusation without changing the outcome. Thirteen infrastructure tests passed, including disposable compiled migration, backup, restore, preflight and shutdown.
- Chromium and Firefox passed the 28-check NGINX suite (including landscape Next Round and Sinhala tutorial), four theme checks, four matchmaking and navigation checks, two friend-code checks, four PWA checks, two social checks, four direct voice checks and four local TURN-relay checks. Earlier runs caught a real landscape collision between the history control and Next Round, stale assertions about dealer-rotation gating, and a tutorial dialog locator issue. An earlier Firefox voice run missed one client's table transition. The final direct-voice run passed without weakening the assertion.
- The disposable SQLite WAL load run completed eight concurrent rounds with 32 clients, 320 actions, eight replays, eight reconnects, and 1,704 privacy assertions. It measured 6.49 ms p95 acknowledgements and 202.8 MiB peak combined process RSS. The in-memory run measured 7.32 ms p95 and 166 MiB peak combined RSS. Both used 30 seconds of idle socket soak after gameplay. These are separate loopback smoke runs on one machine, not a controlled disk-versus-memory comparison, a backend-only memory measurement, or a hosting capacity guarantee.
- The read-only `deploy:check` against the local development configuration failed its production-mode, proxy, secure-origin, avatar storage, TURN, absolute database path, and current-migration checks. The real database was left untouched. The disposable production fixture passed compiled preflight.

## File inventory

### Created

- `apps/server/migrations/0002_match_state.sql`
- `apps/server/src/auth/friends.ts`
- `apps/server/src/multiplayer/match-storage.ts`
- `apps/server/src/multiplayer/recovery.test.ts`
- `apps/web/src/auth/FriendsPanel.tsx`
- `apps/web/src/components/SponsorPlacement.tsx`
- `apps/web/src/components/Tutorial.tsx`
- `docs/V2_DEVELOPMENT_STATUS.md`

### Modified

- `README.md`
- `apps/server/migrations/meta/_journal.json`
- `apps/server/src/app.ts`
- `apps/server/src/auth/accounts.test.ts`
- `apps/server/src/auth/routes.ts`
- `apps/server/src/multiplayer/multiplayer.test.ts`
- `apps/server/src/multiplayer/projection.ts`
- `apps/server/src/multiplayer/rooms.ts`
- `apps/server/src/multiplayer/routes.ts`
- `apps/server/src/multiplayer/support.ts`
- `apps/server/src/multiplayer/transitions.test.ts`
- `apps/server/src/multiplayer/validation.ts`
- `apps/server/src/ops/backup.ts`
- `apps/server/src/ops/ops.test.ts`
- `apps/server/src/ops/preflight.ts`
- `apps/server/src/persistence/repository.ts`
- `apps/web/.env.example`
- `apps/web/e2e/game.spec.ts`
- `apps/web/e2e/profile.spec.ts`
- `apps/web/e2e/remaining.check.ts`
- `apps/web/e2e/shell.spec.ts`
- `apps/web/e2e/themes.check.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/audio/gameAudio.ts`
- `apps/web/src/audio/useGameAudio.ts`
- `apps/web/src/auth/Profile.tsx`
- `apps/web/src/auth/api.ts`
- `apps/web/src/components/Cards.tsx`
- `apps/web/src/components/GameTable.tsx`
- `apps/web/src/components/Home.tsx`
- `apps/web/src/components/Lobby.tsx`
- `apps/web/src/components/MultiplayerMenu.tsx`
- `apps/web/src/game/client.ts`
- `apps/web/src/game/reducer.ts`
- `apps/web/src/styles.css`
- `apps/web/src/themes/ThemeControls.tsx`
- `apps/web/src/themes/classic.css`
- `apps/web/src/themes/registry.ts`
- `apps/web/src/themes/royal.css`
- `apps/web/src/themes/themes.test.tsx`
- `docs/OWNER_RULES.md`
- `docs/RULE_CLARIFICATIONS.md`
- `infra/nginx/omi-testing.conf`
- `infra/tests/load.ts`
- `infra/tests/ops.test.mjs`
- `packages/game-engine/src/engine.test.ts`
- `packages/game-engine/src/index.ts`
- `packages/game-engine/src/round.ts`
- `packages/game-engine/src/scoring.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/protocol.ts`

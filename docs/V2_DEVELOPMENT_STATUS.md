# OMI V2 development status

This document records the current implementation. Stages A–J and earlier audits describe their original baselines.

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

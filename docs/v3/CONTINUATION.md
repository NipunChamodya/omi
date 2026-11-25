# OMI V3.0 continuation

**Release status: OMI V3.0 INCOMPLETE.**

## Working changes

The shared stage identifies boot, the existing introduction, the main menu, multiplayer modes, room entry, recovery, the lobby, gameplay, round results, match results and settings. Scene changes use a cancellable entrance animation on the existing main element. The live game client and room controls keep their original lifetime. The animation respects reduced motion and cancels when the document is hidden.

The tropical menu and lobby now use the same dark-green environment treatment. Four original illustrated portraits are available as local avatar fallbacks. Attached account photos and the Data Saver initials remain supported. Gameplay seats display an accessible speaking icon based on the existing voice analyzer. The subscriptions are scoped by room and disposed with the voice panel.

Completed tricks now move toward the winning seat at the end of the existing reveal timer. The Pixi card layer follows the same live geometry as the HTML presentation and skips the animation-delay period. Hidden and disconnected tables discard pending reveal visuals. Results use distinct entrance motion for the standard medallion and defeat. Server actions and scoring remain in the original game engine.

Settings now include a persistent high-contrast palette for primary surfaces and stronger keyboard focus. Tamil copy covers every key in the shared media dictionary, including file audio, voice, permission descriptions and playback controls. Localization outside those dictionaries still has gaps.

## Visual review

| Screen | Evidence | Observation |
| --- | --- | --- |
| Home | [390 portrait](continuation/home.png) | The illustration and green Play control are prominent. The guest form still makes Home a longer scroll than the supplied full-screen reference. |
| Multiplayer | [320 portrait](continuation/multiplayer.png) | The hierarchy follows the existing create/join and ranked flows. The reference has a denser icon-based mode grid. |
| Room entry | [Create](continuation/create.png), [Join](continuation/join.png) | The form controls are still accessible, with the island treatment behind both flows. The forms retain the existing authentication and guest choices. |
| Lobby | [Four players](continuation/lobby.png), [568 landscape](continuation/lobby-landscape.png) | The initial captures exposed a pale lobby shell between dark menu and dark gameplay. The lobby now shares the menu treatment and preserves the two-column seat arrangement. |
| Gameplay | [390 portrait](continuation/gameplay.png), [568 landscape](continuation/gameplay-landscape.png), [Trump](continuation/trump.png) | The illustrated portraits and relative seating remain legible. The short-landscape hand and play control were exercised in the viewport test. |
| Settings and history | [Settings](continuation/settings.png), [high contrast](continuation/high-contrast.png), [trick replay](continuation/replay.png) | Menus retain native dialog semantics. Full keyboard and screen-reader sign-off is open. |
| Leave and results | [Leave dialog](continuation/leave.png), [Round results](continuation/round-results-landscape.png), [Ranked result](continuation/match-results.png) | The leave dialog still provides the existing keep-playing and leave-with-seat actions. A dedicated pause menu and bespoke illustrated results backgrounds are open. |

The supplied 16-image reference set remains under [design references](../design/references). The menu, lobby, results and gameplay comparisons are desktop-browser captures at mobile viewport sizes.

## Rollback

The previous archive checksum matched the historical report. A new starting-worktree archive was made and checked against the tracked and unignored untracked member list and file contents. The adjacent files record the source commit, Git status and index patch.

- Archive: `/private/tmp/omi-v3-continuation-ja12w4ih/workspace.tar`
- SHA-256: `dfa3c50bca26e0a784b23a77af373f1ae467633bd6008a137029d8ba8811452e`

Extract to a fresh directory for comparison and selective restore. The archive is in local temporary storage. Native scaffolding present at kickoff remains outside the web build.

## Work still open for release

- Complete the remaining screen compositions, shared control components, artwork and motion acceptance, including profile, help, error/reconnection and pause.
- Finish all English, Sinhala and Tamil interfaces and announcements. Obtain language review and verify script shaping on physical mobile browsers.
- Complete accessibility review with TalkBack, VoiceOver, keyboard and contrast testing beyond the shared surfaces.
- Run physical-device sessions on Samsung and iPhone hardware. Measure frame time, memory, GPU use and battery, and exercise real microphone capture, interruption recovery and Bluetooth audio routing.
- Meet the 1,200 distinct-case minimums and record case-level evidence. Repeated viewport, browser and fixture executions are not counted as new cases.

## Verification and measurements

The baseline and post-change Vitest runs each passed 327 cases. Baseline infrastructure passed all 15 cases. Chromium and Firefox each completed the four-player casual round and reload scenario. An isolated Chromium fixture passed ranked results and rematch. The Chromium media run passed four synthetic scenarios, including reconnect, local-file sharing and logout stopping capture. This does not verify a physical microphone.

The browser selections exercised 13 distinct scenarios in this continuation. Browser-engine repetitions and retries are excluded. The 359 historical cases were not all replayed as an independent run.

The final palette run passed in Chromium and Firefox. Its computed-color assertion identified a dark settings label on the dark panel before the correction. The GPU-only scenario passed in Chromium and was skipped by design in Firefox. The production Vite build and source lint passed. The entry is 96,825 bytes gzip, comprising 84,567 bytes of JavaScript and 12,258 bytes of CSS. This measurement excludes lazy scene dependencies. Device startup, FPS, frame duration, memory, GPU and battery measurements remain open.

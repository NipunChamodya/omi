# OMI V2.10 visual acceptance

The four referenced owner screenshots and the separate design-rules file were unavailable in this checkout. The written Tropical Adventure specification guided this pass. The existing original island art was reused. The card reference remains limited to card artwork. The 290-file pre-edit worktree checkpoint was verified against the original bytes at `/private/tmp/omi-art.qoYWHA/worktree.tar`.

| Surface | Route or component | Defect or change | Mobile / desktop evidence | Function, language and access acceptance |
| --- | --- | --- | --- | --- |
| Splash and loading | App startup and match restoration | Illustrated startup with original mascot and actual session status | Startup capture inspected on desktop | Startup retry passed in Chromium and Firefox. Physical/PWA startup matrix open |
| Home and authentication | Home, root | Existing original island, logo and authentication retained | Prior captures | Live identity and full language review open |
| Mode selection | MultiplayerMenu | Existing mode panels retained | Matrix open | Full visual review open |
| Create table | Home, create view | Existing form and authoritative seat checks retained | Matrix open | Selected browser checks available |
| Join and invite URL | Home, join view | Existing code entry retained | Matrix open | Existing error and authorization checks |
| Saved table | Home and MultiplayerMenu | Existing recovery and release controls retained | Matrix open | All seat states still need visual acceptance |
| Waiting lobby | Lobby | Dark grid replaced with landscape header, ribbon, light player frames and room ticket | Before and after at 320px and 1280px | Four seats and host actions tested. Selected English and Sinhala copy. Full access and Tamil open. |
| Ranked queue | MultiplayerMenu | Existing queue retained | Matrix open | Four-human assignment and full match have prior browser evidence |
| Ranked lobby | Lobby | Shares new lobby treatment | Full visual matrix open | No bot control in ranked |
| Table, seats and card hand | GameTable | Framed utility button, brighter patterned felt, layered wood, framed avatars and an active-seat nameplate. Existing card fan and seating retained | Targeted browser captures | Touch, drag, keyboard and timing evidence in selected scenarios |
| Trump and round actions | GameTable | Existing server-authoritative controls retained | Matrix open | Full visual and language acceptance open |
| Replay | TableTiming | Existing replay dialog and 44px trigger retained | Targeted browser captures | Keyboard and pointer regression coverage selected |
| Round results and cancellation | GameTable | Shared cream surface with ribbon for round results | Matrix open | Counter and special-outcome review open |
| Victory, defeat and rematch | GameTable | Result ribbon and original trophy illustration | Prior before captures. Final full visual matrix open. | Prior full casual and ranked results evidence |
| Profile and avatar editor | Profile | Ribbon, light detail groups and styled file picker | Crop screenshot captured by profile spec | Fixture avatar workflow. Full account screen matrix open. |
| Friends and invitations | Profile | Light detail surfaces via shared profile rules | Matrix open | Existing service checks |
| Statistics, history and leaderboard | Profile, GameTable | Shared profile surface where mounted | Matrix open | Complete language and accessibility acceptance open |
| Settings and motion | App settings dialog, SoundSettings | Light surfaces, ribbon, larger summaries and custom checkbox presentation | Before and after at 320px and 1280px, with a separate 320px Sinhala capture | Modal and language interactions tested. Full keyboard and screen-reader review open. |
| Card themes | ThemeControls | Shared settings surface and select treatment | Matrix open | Selected theme switching and card identity checks |
| Music and voice | RoomControls | Shared light settings container and summaries | Matrix open | Prior bundled music and synthetic voice checks. Live TURN open. |
| Tutorial | Tutorial | Existing lesson cards retained | Matrix open | Prior interactive tutorial checks |
| Reporting, moderation and Protected Play | Profile, PlayerReport | Shared styling where mounted. Policy retained. | Matrix open | Defensive service evidence. Browser visual review open. |
| PWA install, update and offline | PwaControls | Shared settings surface. Existing install flows retained. | Matrix open | Prior automated PWA checks. Physical installation open. |
| Reconnect, errors and notifications | App | Consistent restoring and reconnecting labels, light alert surfaces and terminal cleanup | Matrix open | Browser restart through full match remains open |
| Leave confirmation | App | Cream panel and gold rim | Matrix open | Selected browser and server seat lifecycle checks |

## Reproduction

Run a build, then use `npx playwright test -c playwright.adventure.config.ts`. The specs save named screenshots to the configured Playwright output directory. The before run used the pre-edit build and the same 320px and 1280px viewports. The [release acceptance checklist](V2_10_ACCEPTANCE.md) contains the full-match commands and physical-device procedure.

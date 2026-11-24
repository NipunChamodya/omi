# V2.8 screen and feature inventory

| Route or surface | Existing behavior | V2.8 disposition |
| --- | --- | --- |
| Root, welcome and login | Saved seat or create/join form and configured Google action | Main Play and Play Online open modes, with Resume independent |
| Registration and account recovery | Google handles identity, and OMI revalidates the account session | Existing provider flow retained |
| Splash and loading | Artwork animation, Suspense and connection status | V2.7 presentation retained |
| Mode picker `?screen=multiplayer` | Separate friends and online entry points | Cards for private create, code join, friends and ranked; separate saved-seat panel |
| Friends play `?screen=friends` | Private table entry | Existing shortcuts retained in the updated mode panel |
| Ranked `?screen=online` | Authenticated human-only matching | Dedicated ranked choice, active-seat feedback and completed-seat release before queue entry |
| Quick Match | No independent casual public queue | No new control |
| Create/Join `?screen=create`, `?screen=join`, and invite URLs | Server-owned membership checks | Retained entry forms, completed-seat release on deliberate create/join |
| Unstarted lobby and recovery | Ready state, bots, code and invitations | Server-authorized release from modes, host/seat update for retained casual lobbies |
| Active board `?room=…` | Four seats, dealing, trump, tricks, hand controls | Tropical artwork and carved-rim treatment with existing arrangement |
| Card theme picker and preview | Classic/Royal themes | Adds optional Tropical faces, mirrored court art and back |
| Scoring, Sepuru/Kapothi/Baldu, results and rematch | Authoritative engine and existing panels | Raised treasury/trump frames, results accents and selected Sinhala messages |
| Profile, avatar editor, friends, invitations, statistics and leaderboard | Existing account dialog and tabs/details | Existing layouts and policies retained |
| Settings, install guide, notifications and offline | Existing app settings and PWA | Existing layouts and behavior retained |
| Voice, music, reports and moderation | Authorized room controls, bundled audio, report collection and moderator UI | Existing workflows retained |
| Protected Play | Server-enforced communication, photo and sponsor restrictions | Existing policy retained |
| Tutorial and confirmation dialogs | Existing interactive lessons and exit warning | Existing layouts retained |
| Adventure progression, achievements and rewards | No server implementation | Deferred |
| User-selected file music | No media distribution workflow | Deferred |

An unfinished match cannot be permanently released from the new endpoint. Returning home preserves the authorized seat and existing bot takeover or ranked disconnect behavior. A lobby or completed match can be released explicitly. Releasing a casual lobby host transfers ownership to a remaining human, while releasing an unstarted ranked lobby disbands it so it cannot start short-handed.

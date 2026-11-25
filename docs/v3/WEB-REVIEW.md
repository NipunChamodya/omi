# Latest web review

This increment adds Tamil practice for all 13 lessons and starts practice in the selected game language. Tamil also covers the shared room-error codes, core lobby and invitation controls, and additional sound and recovery copy. Intro and menu music have independent volume controls while preserving opt-in playback. The profile and practice surfaces, turn changes and results received additional visual polish.

| Review surface | Evidence |
| --- | --- |
| Tamil practice and lobby at 320×568 | [Practice](final-review/practice-ta-320.png), [lobby](final-review/lobby-ta-320.png) |
| Profile and round results | [Profile](final-review/profile-390.png), [landscape results](final-review/round-results-landscape.png), [portrait results](final-review/round-results-portrait.png) |
| Splash and earlier game screens | [Splash and motion verification](POLISH.md), [screen-by-screen review](CONTINUATION.md) |

The local runs passed 328 unit and integration cases and 15 infrastructure cases. Chromium and Firefox exercised private-room gameplay, Tamil and Sinhala practice, soundtrack settings, keyboard focus, profile controls, and startup recovery. Chromium passed synthetic four-peer voice and shared music. Repeated runs across browser engines are not new cases.

The updated Next round control stayed in view at 375×667 and 844×390 without scrolling. The final web build, lint and bundle gate passed at 98,316 bytes gzip. This set of runs passed 13 distinct browser scenarios.

The remaining release requirements include full screen-by-screen visual approval, remaining interface and announcement translations, physical Android and iPhone audio and accessibility checks, device performance measurement, and the 1,200 distinct passing case gate. No native game app or deployment was produced.

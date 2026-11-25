# Splash, motion and voice polish

The browser splash shows the OMI mark and deck illustration during the real session check. The existing skippable intro follows normal launch, with reduced-motion and Data Saver behavior retained.

The table settings overlay offers Keep playing and a Live voice shortcut. The shortcut focuses the existing WebRTC controls. Joining still requires the explicit microphone action. Private-table permissions and ranked restrictions use the existing account and room policy. The overlay leaves the live match and its rules in place.

Shuffle and deal illustrations are removed after their animation or when the page is hidden. Trump and score updates pulse on live changes. The existing card fan and trick collection continue to use authoritative server presentation events. Modal entrances and the new table motions honor reduced motion and Data Saver. Replay now frames the played cards with the hardwood board artwork.

## Evidence and remaining acceptance

- [Mobile splash](polish/splash-390.png), [trick replay](polish/replay-390.png), [practice](polish/practice.png) and [profile](polish/profile-390.png) extend the [previous visual review](CONTINUATION.md).
- The local Chromium voice fixture verified the shortcut, opt-in capture, four-peer audio, speaking detection, reconnect, shared music and logout cleanup using synthetic input. No physical Android phone was attached. The listed iPhone was unavailable to the test host. Real microphones, TalkBack, VoiceOver and mobile Safari were outside the verified results.
- The production build, bundle gate and source lint passed. The initial entry measured 96,961 bytes gzip. The 327-test unit and integration run passed.
- The browser selections passed 16 distinct scenarios. Repeated executions across browser engines are excluded from that count. The Chromium GPU path was intentionally skipped in Firefox.
- Full screen-by-screen release approval, complete accessibility acceptance and the 1,200-distinct-case gate remain open. No native game apps or packages were built.

The continuation checkpoint is `/private/tmp/omi-v3-finish-lmh4g2j1/workspace.tar`. SHA-256 is `13232706d742a6c8f57fa8ad108f39dfb98f5f588502419a66c756f7f121a265`. The archive was compared to the tracked and unignored untracked worktree files before these edits.

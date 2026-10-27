# Performance

## Current Stage J status

Stage J adds repeatable initial gzip budgets (JS 90KiB, CSS 12KiB, combined 100KiB) and source-map/server-marker smoke checks. Actual combined gzip is 87,676 bytes. The patched-runtime eight-room/32-client loopback benchmark completes eight rounds, duplicate/reconnect/privacy checks and a 30-second idle soak: action p95 2.31ms, event-loop p99 22.05ms at 20ms resolution, peak combined backend+client RSS 205.2MiB. These are local smoke results, not phone/Internet/voice/NGINX capacity. See LOAD_TEST_REPORT.md.

## Current Stage I status

Stage I measured build: initial JS 257.53 kB / 80.47 kB gzip, CSS 30.90 / 8.08 kB gzip, worker about 1.93 kB. Each optional design stylesheet is about 300 bytes; Classic SVG is 456 bytes and Royal 572 bytes. Only the selected design loads; PWA installation precaches entry CSS rather than every build stylesheet. New motion uses short CSS transforms/opacity and respects Data Saver/reduced motion. No runtime dependency, game polling or device benchmark was added. See THEMES.md.

## Current Stage H status

Measured build: entry JS 254.29 kB / 79.47 kB gzip; CSS 28.85 / 7.68 kB gzip; worker about 1.87 kB. Installation caches entry JS/CSS plus the tiny offline files; lazy chunks cache on demand. Audio is excluded. Data Saver avoids shared avatar downloads, suppresses decorative motion and stops optional local audio until explicit opt-in. No new runtime dependency, background polling or game-state cache was added. No hardware CPU/battery/data benchmark was run. See PWA.md.

## Current Stage G status

Stage G keeps audio disabled until local opt-in and code lazy until a room opens. Music/effect files total about 564 kB and use existing fingerprinted asset caching; no audio is streamed over WebSockets. The social channel retains at most 30 messages within 32 KiB, one music state and 128 hashed receipts per connection. Separate 64-task queues and actor budgets prevent chat/reaction traffic consuming game action allowances. One-second media drift checks and 15-second clock probes run only for enabled music; no full-state gameplay polling was added. Report writes are rare/bounded and SQLite remains the existing synchronous adapter. No physical-device or public load benchmark is claimed.

## Current Stage F status

Stage F adds no npm runtime dependency. The initial bundle is 251.42 kB (78.51 kB gzip); voice loads as a 14.33 kB chunk (4.84 kB gzip) only in a room. CSS is 26.24 kB (7.12 kB gzip). One microphone track feeds three peers per participant. Speaking meters sample locally every 150ms and update UI only when indicators change. Server signaling uses bounded separate queues, 4 KiB frames, 64 KiB backpressure, 90 messages/10 seconds/actor and 128 small hashed receipts/call. Audio bypasses Fastify/gameplay WebSockets and SQLite entirely. Direct/relay browser tests are functional evidence, not device CPU/bandwidth or public TURN load benchmarks.

## Current Stage E status

Stage E production build: initial JavaScript 251.06 kB (78.42 kB gzip), lazy profile chunk 5.77 kB (2.19 kB gzip), table chunk 9.37 kB (3.07 kB gzip), CSS 25.35 kB (6.90 kB gzip). Sizes are build artifacts, not device benchmarks. Account identity caching is bounded to 1,000 entries and session validity checks avoid database queries on ordinary card actions. There are at most ten sessions per account, two concurrent upload pipelines, six uploads/minute/account and bounded cleanup batches. Native SQLite/Sharp dependencies increase backend footprint. No load or physical-device benchmark has been executed. See ACCOUNTS.md for image/storage constraints.

## Implemented

Small static shell, CSS background and suit text; no external fonts, image payloads, audio, polling or animation loops. Production Vite build supports compressed-size reporting. Backend health uses no database calls. Engine package has no runtime dependencies.

## Stage B

The engine has zero runtime dependencies and no network, browser, filesystem or background work. Fisher–Yates shuffles 32 cards. Per-play hand checks scan at most eight cards; resolution examines four. A round retains at most 32 copied hand-before evidence records plus the original deal, eight tricks and four hands. Immutable updates copy small bounded round arrays.

Ledger entries and round-settlement IDs grow across rounds; settlement/duplicate detection currently scan history. Room resource bounds, retention and persistence are Stage C/J concerns. No capacity or latency benchmark has been run. The 100 seeded-round regression is a correctness test, not a load benchmark. Since the engine is not imported by the frontend, the production frontend remains 69.25 kB JavaScript and 2.00 kB CSS gzipped in the measured Stage B build.

## Stage C

Active rooms and sessions use bounded in-memory maps. Ordinary card plays send a compact event rather than a full snapshot. Private hands are sent on deals and authenticated snapshots, not ordinary throws. There are no database queries, audio streams, new frontend assets or background gameplay loops. A 30-second maintenance timer handles ping/liveness and cleanup.

Defaults cap rooms, seats, identities, room queue depth, mutation receipts, HTTP receipts, inbound frames and outbound buffering; see MULTIPLAYER.md. Retrying a processed ID reuses a small cached reply instead of replaying the engine. Per-room actions, receipt lookup/counting and small immutable engine copies remain straightforward; no horizontal scaling or persistent room coordination exists.

The four-client full-round integration test establishes behavior, not capacity. No load test, mobile-device profile or production latency benchmark was performed. Frontend build sizes remain 69.25 kB JavaScript / 2.00 kB CSS gzipped.

## Stage D

Baseline cards, initials and table surfaces use local HTML/CSS with no image/font/audio payloads. GameTable is a separate lazy-loaded chunk; the browser never bundles the engine. Zustand projects public events instead of fetching full snapshots after ordinary card throws. There is no polling loop, optimistic rule engine or background audio. Short transform/opacity animations respect reduced motion.

HTTP attempts, socket/ack/sync retries, timers and concurrent mutations are bounded. Native offline detection stops stale sockets and disables actions. Initial production JavaScript, lazy-table JavaScript and CSS sizes are recorded from the final actual Vite build in STAGE_D_REPORT.md. Browser simulations and bundle sizes do not establish device memory, network usage or production capacity guarantees. Physical-device, load and detailed rendering profiles remain later work.

## Planned

Lazy-load gameplay and themes, local audio, compact socket events, reconnect snapshots, bounded active rooms, data saver and asset caching in their authorized stages.

No mobile device profiling, network simulation, load testing or production capacity measurement yet. Build artifact sizes are recorded in the Stage A report; these are not runtime performance guarantees.

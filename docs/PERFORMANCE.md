# Performance

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

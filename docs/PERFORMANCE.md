# Performance

## Implemented

Small static shell, CSS background and suit text; no external fonts, image payloads, audio, polling or animation loops. Production Vite build supports compressed-size reporting. Backend health uses no database calls. Engine package has no runtime dependencies.

## Stage B

The engine has zero runtime dependencies and no network, browser, filesystem or background work. Fisher–Yates shuffles 32 cards. Per-play hand checks scan at most eight cards; resolution examines four. A round retains at most 32 copied hand-before evidence records plus the original deal, eight tricks and four hands. Immutable updates copy small bounded round arrays.

Ledger entries and round-settlement IDs grow across rounds; settlement/duplicate detection currently scan history. Room resource bounds, retention and persistence are Stage C/J concerns. No capacity or latency benchmark has been run. The 100 seeded-round regression is a correctness test, not a load benchmark. Since the engine is not imported by the frontend, the production frontend remains 69.25 kB JavaScript and 2.00 kB CSS gzipped in the measured Stage B build.

## Stage C

Active rooms and sessions use bounded in-memory maps. Ordinary card plays send a compact event rather than a full snapshot. Private hands are sent on deals and authenticated snapshots, not ordinary throws. There are no database queries, audio streams, new frontend assets or background gameplay loops. A 30-second maintenance timer handles ping/liveness and cleanup.

Defaults cap rooms, seats, identities, room queue depth, mutation receipts, HTTP receipts, inbound frames and outbound buffering; see MULTIPLAYER.md. Retrying a processed ID reuses a small cached reply instead of replaying the engine. Per-room actions, receipt lookup/counting and small immutable engine copies remain straightforward; no horizontal scaling or persistent room coordination exists.

The four-client full-round integration test establishes behavior, not capacity. No load test, mobile-device profile or production latency benchmark was performed. Frontend build sizes remain 69.25 kB JavaScript / 2.00 kB CSS gzipped.

## Planned

Lazy-load gameplay and themes, local audio, compact socket events, reconnect snapshots, bounded active rooms, data saver and asset caching in their authorized stages.

No mobile device profiling, network simulation, load testing or production capacity measurement yet. Build artifact sizes are recorded in the Stage A report; these are not runtime performance guarantees.

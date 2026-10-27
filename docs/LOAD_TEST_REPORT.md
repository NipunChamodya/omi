# Stage J — Local load test

Executed 2026-10-27 on macOS arm64 using checksum-verified project-local Node 22.23.4. Command: `npm run test:load -- 8 30`.

| Measurement                                       | Actual result  |
| ------------------------------------------------- | -------------- |
| Concurrent rooms / independent players            | 8 / 32         |
| Completed real engine rounds                      | 8              |
| Acknowledged actions, including duplicate replays | 320            |
| Duplicate checks / reconnects preserving own hand | 8 / 8          |
| Parsed wire messages checked for private fields   | 1,704          |
| Idle socket ping/pong soak after gameplay         | 30 seconds     |
| Overall rounded elapsed time                      | 30 seconds     |
| Action acknowledgement p50 / p95                  | 1.12 / 2.31 ms |
| Event-loop p99, 20ms sampling resolution          | 22.05 ms       |
| Peak combined Node process RSS                    | 205.2 MiB      |

The real Fastify app listens only on a fresh loopback port, with its existing bounded development/test guests and in-memory SQLite. It does not load the user's .env, Google provider, avatar bucket or public tunnel. Four distinct cookie identities per room join, ready, cut, choose trump from their actual hand, follow suit when possible and play all 32 cards. The public client reducer consumes actual recipient messages. Each room checks 32 unique disjoint private cards, no private engine fields on the wire, compact ordinary plays without hands, an idempotent replay and a reconnect preserving own cards. Configured default room, queue, HTTP, message, receipt and backpressure controls remain active. No hypothetical owner policy, next round or cheating penalty is injected.

Rooms are intentionally limited to eight so the single loopback IP stays within the default HTTP budget during setup and reconnection. The soak sends socket ping/pong after the full rounds; it is **not** 30 seconds of continuous gameplay. Assertions require completed rounds, valid wire/state, p95 acknowledgements below 250ms and combined process RSS below 512MiB. These are local smoke budgets, not service-level guarantees.

The process contains **both** backend and Node test clients, SQLite, imported SDK code and measurement overhead. RSS is not backend-only memory. This does not benchmark NGINX/Cloudflare, Google login, S3, browser rendering, voice traffic, real phone CPU/battery/data use, Internet RTT/loss, hours of activity or the configured maximum 100 rooms. Event-loop measurements have 20ms resolution. No capacity extrapolation or production-readiness claim is valid from these numbers.

An earlier baseline run on the old Node 22.13.1 passed at p95 1.97ms and peak combined RSS 181.6MiB; it is superseded for release evidence by the patched-runtime run above and is not a controlled performance comparison.

# Content-cache read traffic repair — 2026-10-13

The cache updates read ages in memory and flushes them through one scoped
two-second timer, or immediately on writes, eviction and pagehide. A verified
release hashes its durable bytes once; raw and legacy cache ports still hash.
Whole owned ArrayBuffers avoid the extra copy. Corruption, offline, quota and
transport-lifetime refusals are retained.

Opus attribution: [home-grid report](../spawn-sim-sp-o132-2026-10-13/README.md).
The previous spawn p95 ranged from 34 to 39 ms; no single first-bad commit was
proven. The transport read series was 6c4cfd6ae, c3d5078c0 and 91e2f8953.

Private clean build: `42ae550b57896486cf10a78dfc6f138966a61e5b`. Both source
files match the landed repair; other source was pinned at 3e2001845. Commands:
`frame-floor --shards=grid --grid-scenario=baseline --devserver --surface=sim
--rev=42ae550b57896486cf10a78dfc6f138966a61e5b`. Live Simulator Safari, phone
tier, 2x rendering, Developer on, 120 drawn frames per pose; no profiling,
GL observer, routes, clock substitution or cap change. The normal CPU owner
meter is unchanged. Each run closes its preview and Simulator.

| Run | Seconds | 1-min load min–max | p95 spawn / deck-east / crossroads |
| --- | ---: | ---: | --- |
| first | 114.63 | 3.24–9.51 | 34/34/34 ms |
| second | 109.02 | 3.95–17.72 | 34/34/34 ms |
| third | 117.04 | 4.61–19.00 | 34/34/34 ms |

All nine pose rows pass the unchanged 35 ms p95 and 200 ms max gates, with
zero page errors. Only run one qualifies for the requested load <=15 condition
throughout. Builds raised load in the later runs; their 34 ms results are
loaded confirmations, not a second low-load qualification. The coordinator
approved landing with that limitation and repeating at the next milestone.
The ordinary floor entry rebuilds even when the same SHA was already served.

Validation: 32 focused cache/product/transport tests, touched typed lint and
clean-export narrowed types pass. Tests prove 75 read ages coalesce into one
write per window, forced flushes cancel their resources, owned/sliced/shared
buffer treatment and exactly one verified release hash. No physical-phone
performance or every-gameplay-moment claim is made.

# G717 entry looks

Real Chromium captures: iPhone 16 Pro, phone tier, CPU 4x, render scale 2,
live clock, muted. App `653f0abe856bd6019818ba92f8ee9c8910bbe7d1`.
The unchanged `scripts/grid-ready-chromium.mjs` captures each entered view
after its six-second look window; these are not images of the exact hitch.

| Image | Retained G717 worst | New entry / look / leave maximum |
|---|---:|---:|
| [Night Market](night-market.jpg) | 300.1 ms | 150.1 / 33.5 / 66.6 ms |
| [Signal](signal.jpg) | 266.6 ms | 116.7 / 33.5 / 33.5 ms |
| [Nalati](nalati.jpg) | 300.0 ms | 200.0 / 83.3 / 50.1 ms |
| [Sky](sky.jpg) | 233.3 ms | 183.3 / 50.1 / 50.0 ms |
| [Alien](alien.jpg) | 216.6 ms | 50.1 / 33.4 / 33.5 ms |
| [Thin Ice](thin-ice.jpg) | 249.9 ms (leave) | 50.1 / 33.5 / 50.0 ms |

All 18 windows pass the unchanged inclusive 200 ms gate, with no errors,
skipped frames or context loss. Nalati is exactly at the limit. The
maintained strict grader qualifies all six observations; the existing
latch writer adds only their six missing look passes, preserving all 42
prior measurements. The full set is now 24 memory + 24 look latches.

Night Market's retained G717 entry miss was 300.1 ms. Source
`7274c0de3f` rejects only disjoint collision/entry projections; its actual
64-chunk kernel median is 22.31 → 1.87 ms (21 alternating pairs).
The new uninstrumented visit overlapped a separate browser CPU profile
06:55:45–06:56:50 UTC, so it does not isolate a causal frame improvement.

The five other entries run sequentially in one fresh browser, without a
profiler or added observers. The shared app also includes sp-x1's selected
uniform resolution (`997273e20d`) and pool-channel admission indexing
(`3b2886d33c`); this cohort does not isolate which change helped each shard.
No additional per-shard source edit was needed after these measured passes.

Raw visits and strict qualifications:
`tmp/sp-x6-g717-look/{night-market-after,five-after}/`. The latter raw file
exceeds the existing reader's 5 MB cap; the maintained G717 analyzer's
qualification summary preserves every gate, profile, route and peak
metric while omitting large diagnostic witnesses. The strict grader and
latch writer both consume that summary without changing the cap.

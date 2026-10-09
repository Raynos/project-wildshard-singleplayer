# Pine desktop floor at the gpuLabels fix

**FAIL**, exact gameplay pin `64b9b57ef84dc41cd19ddd62ed033dd8d33dca88`. The run completed in 393.1 seconds with no game errors or context loss. Simulator idle; other lanes' browsers and machine work remained active.

Command: `node scripts/frame-floor.mjs --rev=64b9b57ef --surface=desktop --shards=pine-hollow`. Developer on, desktop tier, 1440×900 at 2×, live vsync, 120 frames per pose. No CPU throttle or continuous GL observer.

| Pose | Median fps | Frame p95 | Trusted Pine CPU p95 | Frame work p95 |
| --- | ---: | ---: | ---: | ---: |
| Spawn | 59.524 | 66.7 ms | 0.7 ms | 17.7 ms |
| Cabin | 20 | 83.4 ms | 0.7 ms | 16.4 ms |
| Gate | 20 | 66.7 ms | 0.9 ms | 17.7 ms |

The existing floor requires rounded median ≥60 fps and p95 ≤17.5 ms; every pose fails the p95 threshold. Each trusted content CPU owner passes its 4.167 ms threshold. These observations do not isolate GPU work from frame scheduling or contention.

The one-minute host load during page boot and measurements had median **16.35**, range **14.07–19.60** (64 samples). Across the detached run, including build and lane waits, median was 23.70, range 13.52–48.61. No rerun or threshold change is used to turn this failure into a pass.

An earlier attempt stopped before browser acquisition because this historical pin lacks `vite/preview.ts`. The pure host-preview fallback landed in `af7e01750`; the completed run above preserves the historical game's built bytes. Proof id: `20261009T171007-pine-floor-fixed-host-78942`. Raw output stays outside version control; compact fields are in [summary.json](summary.json).

SF22 remains deferred while the separate G270 soak memory failure is investigated.

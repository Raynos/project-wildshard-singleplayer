# Pine desktop floor: FAIL under load

The one coordinator-authorized repeat completed at `c7de9850eaf05c9b1890e2b850f70b9b530f36df`, which includes the `64b9b57ef` gpuLabels fix. It recorded **FAIL**, with no game errors or context loss. This is an under-load result, not a low-load performance verdict. The coordinator retained it and assigned Pine headroom work; no further repeat is claimed.

| Pose | Median fps | Frame p95, ms | Main-thread work p95, ms | Pine content CPU p95, ms |
| --- | ---: | ---: | ---: | ---: |
| Spawn | 30.03 | 33.4 | 28.9 | 0.8 |
| Pond | 59.88 | 33.3 | 23.5 | 0.8 |
| Cabin | 59.88 | 33.4 | 22.1 | 0.6 |

The unchanged desktop criteria are integer-rounded median ≥60 fps and frame p95 ≤17.5 ms; strict p95 ≤16.7 ms is also reported. Each trusted content owner must stay ≤4.167 ms CPU p95. All three cadence rows fail; Pine's content CPU passes.

The 72 one-second load samples covering measurement (22:38:14–22:39:26 UTC, 2026-10-09) have median **43.73**, range **41.07–48.96**. The coordinator's browser/Simulator quiet could not stop non-platform work, including encoding and observers. A MOSS process configured to prefer MPS was found afterward, but no process-level journal establishes its activity during the measured window. No GPU-cause attribution is claimed.

Protocol: production pinned build, desktop Developer on, fps Auto, 1440×900 at 2× render scale, muted Chromium ANGLE Metal / Apple M5 Max, 120 frames per pose. Command: `node scripts/frame-floor.mjs --rev=c7de9850eaf05c9b1890e2b850f70b9b530f36df --surface=desktop --shards=pine-hollow`. Harness revision: `6f049ac157be030bb995d698928aa54ff9b25ef2`. Whole run: 468.5 s. Own browser and preview closed; browser and Simulator lanes were empty at final release.

The scalar result is [summary.json](summary.json). Local detached proof id: `20261009T173138-pine-floor-quiet-current-41606`; raw output is retained in the lane scratchpad, not committed. Earlier contended evidence remains explicitly invalid in [the prior receipt](../pine-64b9b57ef/README.md). This floor does not close SF22 or the phone-memory gate, which rests on G269 phone runs.

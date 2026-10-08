# Pre-release catalogue experiment: incomplete / red

E435, grid boot and template-copy performance investigation, 2026-10-08. This receipt retains an experiment run before the coordinator corrected G233 to **needs pick** (`826b96c0c`). It is not a Jake-picked public catalogue, permission to open the grid, or a public memory/fps clearance. No work depending on that pick continues.

App pin: `a1c4f02b3ecd66ba255822ecdb4b8cd22edf6ef0`. Developer saved/effective OFF; Memory saver OFF; phone tier, render scale 2, muted. The existing expiring grid intent selected borrowed Driftwood; no admission bypass. Pine, Nalati and Far were absent from this experiment's catalogue. Three completed cold runs witnessed real road/template entry and residency, no game errors, stable document, sampler exit 0 and three fresh independent timestamps per pose.

## Native settled observations

Decimal MB: WebContent physical footprint + separately labelled GL allocations. Three completed cold runs; two earlier failed attempts retained in full.

| Pose | Combined median | Min–max | Spread |
| --- | ---: | ---: | ---: |
| Home | 789.325 | 755.438–814.753 | 59.315 |
| Road | 929.662 | 887.190–936.522 | 49.332 |
| Template-1 centre | 934.867 | 894.988–950.333 | 55.345 |

Worst individual sample among completed runs: **951.251 MB**. Worst observed including failed attempts: **1006.919 MB**, on the road in attempt 2 before its later route failure. The completed runs do not erase that over-cap observation. These are settled Simulator readings, not loading/transient peaks or physical-iPhone cap readings.

Attempts 1 and 2 hit the authored hut back wall on the new south approach and timed out. Attempt 2's retained diagnostic places the feet at local `(0.000629, 0.37294, -15.55006)`, while Template-1 is the admitted/current/entered resident. The shared hut back wall is at local z=-15. A real-input west detour (`f6647a9d4`) avoids the wall; no world, collider, catalogue or endpoint was changed. Attempts 3–5 used that detour and completed. Native diagnostic-only forward `15c7dbc69` records failure feet/state. Helper source trees and every frozen helper hash are in the archived manifests; the app stayed pinned throughout.

## Frame floor: red / incomplete

Official command: `node scripts/frame-floor.mjs --rev=a1c4f02b3ecd66ba255822ecdb4b8cd22edf6ef0 --developer=off --shards=grid --surface=both --grid-scenario=template`. Harness `f6647a9d4`; unchanged deadlines and grade. Elapsed 375.079 s, exit 3. [Original artifact](../../frame-floor/a1c4f02b3-34443-1791472018070.json).

Desktop never reached its first pose within 240 s; no fatal/page errors were recorded, but the world/probe was unavailable. This does not yet distinguish a real boot wait from harness readiness.

Simulator home, deck, crossroads and road passed at 30.303 fps, p95 34–35 ms. Template travel **16.393 fps / p95 64 ms**; template centre **16.949 fps / p95 62 ms**. Median calls/triangles: travel 192/666168; centre 199/567976. Measured frame-work p95 15/13 ms; content owner p95 4/3 ms (borrowed page owner `driftwood-isle`), with isolated owner maxima 924/690 ms. CPU-share assertions passed; cadence failed. The route and template residency witness succeeded. This is an open grid boot/template-copy regression, not accepted performance.

## Raw preservation and verification

`raw.tar.gz` holds all five reports, samplers, logs, phase files, native footprint/vmmap captures, attempt ledger, every helper manifest, driver/summarizer and floor log. `raw-manifest.json` gives every original byte length and SHA256. All 76 files (44,467,908 original bytes) were verified by extracting the archive before commit; committed-object roundtrip is checked after landing. `summary.json` preserves per-side/per-pose values and failed-attempt observations. No failed run was substituted, subtracted, hidden or rescored as green.

All owned browsers, Safari, Inspector and samplers closed; Simulator/browser lanes released to sp-x3 before source-only diagnosis. Further rendering/boot proof waits for the soak quiet window to end.

# Current-main frame floors — 2026-10-09

Measured app/harness pin **`116f25a06426c1d35bc4084a0127875e2f338980`**, pushed origin/main when this job started. One clean preview, HTTP==disk `116f25a-mv0w4kyg`, 2× render scale. Pinned `scripts/frame-floor.mjs --worker`, seven standalone shards with Developer ON (includes Nine), separate public grid with Developer OFF. Chromium desktop1440×900; Simulator iPhone17Pro portrait phone tier. No game-code changes. Coordinator owns pushes.

**Verdict: all seven standalone shards pass both surfaces after the low-load Pine controls. Public grid passes the real template scenario on the Simulator and the labelled GL_INIT-off desktop control. The unmodified desktop template-scenario harness remains RED from diagnostic overhead; it is not a qualifying green run.** Initial standalone desktop19/20 rows PASS; template has two poses. Pine cabin initially p9533.3ms while machine load was high. Three first repeats saw cabin33.4/33.4/16.8 as load fell49.34→24.11; another three after the gate drained PASS at p9516.8/16.7/16.8, median59.88 each and completion load8.99/7.75/5.98. No reproduced low-load Pine regression, so no app bisect.

Public grid uninstrumented baseline standing3/3PASS (p9516.7), but correctly refused a final verdict because no real template-entry witness occurred. The existing template scenario then proved road/template admission with seven cadence rows RED (p9533.4, beach/template median30.03); the concurrent SF57 Simulator was still drawing on the same Mac GPU. After SF57 and our Simulator floor both closed, the standard template scenario still had seven RED cadence rows: median59.88, p9533.3–33.4, completion load7.66. Therefore Simulator overlap alone does not explain the miss. The immediately following **same app and route, GL_INIT-off** control passed7/7 rows, median59.88, p9516.7–16.8, completion load5.86, with real entry/residency complete. No app/build change. This isolates the existing diagnostic allocation hooks as sufficient to produce the cadence miss on this Mac. Scan-selected cameras vary (the hooks also perturb ranking); the road/template routes are identical. Do not rebaseline or count the unmodified harness as green. Proposed follow-up: give performance travel a light census observer, keeping exact GL mutation tracing for separate diagnostics. No shared harness source was changed in this measurement lane.

Simulator standalone **20/20PASS**, median30.303, p9534–35. Initial public scenario6/7PASS: template travel p9536 against the35ms floor, median30.303, interior34, completion load9.36. Same-pin repeat **7/7PASS**: template travel35/interior34, completion load12.79 (still recorded as contended). The36ms miss was not reproduced, so it is retained as a narrow transient, not attributed to an app commit. Early Simulator poses ran at high load; the coordinator paused heavy lanes and later poses ran below12. No GPU loss or skipped/lost frame was reported in the complete Simulator or desktop control runs.

## Measurement and load

The standing tool reports **median FPS**, not average; the coordinator approved reporting its real metric. Floor: rounded median≥60 desktop/≥30 Simulator, p95≤17.5/≤35ms, no skipped/lost frames and each content CPU owner p95≤one-quarter frame. Strict16.7/33.3 criteria remain in raw rows. Passing 59.88 medians round to60. This is stationary spawn/heaviest-camera coverage plus public-road/template scenario, not every gameplay instant or physical iPhone proof.

`*-load.jsonl` records one-minute/five-minute/fifteen-minute load averages every second before/during/after each batch; `*-timing.json` retains timestamped command/log events. Table load is the **one-minute load average at pose completion**, not an average across an inferred frame window. Travel/standing pairs share the event emitted after their real route witness completed; their exact ongoing load series remains raw. Load>12 is contended. A running Simulator is separately recorded as GPU overlap even at low CPU load. `quiet-wait-load.jsonl` records the decay before the low-load control. The initial build followed the heavy-lane queue, and all browsed workers used browser-lane or sim-lane. Worker deadlines start after lane acquisition, avoiding a queued Simulator consuming the parent's10-minute clock.

## Pose table

| Batch | Shard | Surface | Pose | Median FPS | p95 ms | 1-min load | Row |
|---|---|---|---|---:|---:|---:|---|
| desktop-grid-public-entry | grid | desktop | spawn | 59.88 | 33.4 | 6.54 | RED |
| desktop-grid-public-entry | grid | desktop | wreck | 59.88 | 33.4 | 6.54 | RED |
| desktop-grid-public-entry | grid | desktop | beach | 30.03 | 33.4 | 7.71 | RED |
| desktop-grid-public-entry | grid | desktop | grid-public-road-travel | 59.88 | 33.4 | 8.21 | RED |
| desktop-grid-public-entry | grid | desktop | grid-public-road | 59.88 | 33.4 | 8.21 | RED |
| desktop-grid-public-entry | grid | desktop | grid-public-template-travel | 59.88 | 33.4 | 13.50 | RED |
| desktop-grid-public-entry | grid | desktop | grid-public-template | 30.03 | 33.4 | 13.50 | RED |
| desktop-grid-public-no-gl | grid | desktop | spawn | 59.88 | 16.7 | 5.50 | PASS |
| desktop-grid-public-no-gl | grid | desktop | beach | 59.88 | 16.7 | 5.30 | PASS |
| desktop-grid-public-no-gl | grid | desktop | wreck | 59.88 | 16.7 | 5.20 | PASS |
| desktop-grid-public-no-gl | grid | desktop | grid-public-road-travel | 59.88 | 16.8 | 4.86 | PASS |
| desktop-grid-public-no-gl | grid | desktop | grid-public-road | 59.88 | 16.7 | 4.86 | PASS |
| desktop-grid-public-no-gl | grid | desktop | grid-public-template-travel | 59.88 | 16.7 | 5.86 | PASS |
| desktop-grid-public-no-gl | grid | desktop | grid-public-template | 59.88 | 16.8 | 5.86 | PASS |
| desktop-grid-public-post-sim | grid | desktop | spawn | 59.88 | 33.4 | 8.69 | RED |
| desktop-grid-public-post-sim | grid | desktop | pier | 59.88 | 33.4 | 8.63 | RED |
| desktop-grid-public-post-sim | grid | desktop | beach | 59.88 | 33.4 | 8.50 | RED |
| desktop-grid-public-post-sim | grid | desktop | grid-public-road-travel | 59.88 | 33.4 | 8.22 | RED |
| desktop-grid-public-post-sim | grid | desktop | grid-public-road | 59.88 | 33.3 | 8.22 | RED |
| desktop-grid-public-post-sim | grid | desktop | grid-public-template-travel | 59.88 | 33.3 | 7.89 | RED |
| desktop-grid-public-post-sim | grid | desktop | grid-public-template | 59.88 | 33.4 | 7.89 | RED |
| desktop-grid-public | grid | desktop | spawn | 59.88 | 16.7 | 42.36 | PASS |
| desktop-grid-public | grid | desktop | grid-crossroads | 59.88 | 16.7 | 42.36 | PASS |
| desktop-grid-public | grid | desktop | grid-deck-east | 59.88 | 16.7 | 41.69 | PASS |
| desktop-pine-low-1 | pine-hollow | desktop | spawn | 59.88 | 16.8 | 9.51 | PASS |
| desktop-pine-low-1 | pine-hollow | desktop | cabin | 59.88 | 16.8 | 8.99 | PASS |
| desktop-pine-low-1 | pine-hollow | desktop | gate | 59.88 | 16.7 | 8.99 | PASS |
| desktop-pine-low-2 | pine-hollow | desktop | spawn | 59.88 | 16.8 | 7.75 | PASS |
| desktop-pine-low-2 | pine-hollow | desktop | cabin | 59.88 | 16.7 | 7.75 | PASS |
| desktop-pine-low-2 | pine-hollow | desktop | gate | 59.88 | 16.7 | 8.17 | PASS |
| desktop-pine-low-3 | pine-hollow | desktop | spawn | 59.88 | 16.7 | 6.07 | PASS |
| desktop-pine-low-3 | pine-hollow | desktop | cabin | 59.88 | 16.8 | 5.98 | PASS |
| desktop-pine-low-3 | pine-hollow | desktop | gate | 59.88 | 16.8 | 5.98 | PASS |
| desktop-pine-quiet-1 | pine-hollow | desktop | spawn | 59.88 | 33.4 | 51.34 | RED |
| desktop-pine-quiet-1 | pine-hollow | desktop | cabin | 59.88 | 33.4 | 50.68 | RED |
| desktop-pine-quiet-1 | pine-hollow | desktop | pond | 59.88 | 33.4 | 49.34 | RED |
| desktop-pine-quiet-2 | pine-hollow | desktop | spawn | 59.88 | 16.8 | 44.28 | PASS |
| desktop-pine-quiet-2 | pine-hollow | desktop | gate | 59.88 | 33.3 | 41.37 | RED |
| desktop-pine-quiet-2 | pine-hollow | desktop | cabin | 59.88 | 33.4 | 39.66 | RED |
| desktop-pine-quiet-3 | pine-hollow | desktop | spawn | 59.88 | 16.7 | 27.86 | PASS |
| desktop-pine-quiet-3 | pine-hollow | desktop | gate | 59.88 | 16.8 | 26.03 | PASS |
| desktop-pine-quiet-3 | pine-hollow | desktop | cabin | 59.88 | 16.8 | 24.11 | PASS |
| desktop-shards-dev | driftwood-isle | desktop | spawn | 59.88 | 16.8 | 59.69 | PASS |
| desktop-shards-dev | driftwood-isle | desktop | beach | 59.88 | 16.7 | 56.91 | PASS |
| desktop-shards-dev | driftwood-isle | desktop | pier | 59.88 | 16.7 | 56.91 | PASS |
| desktop-shards-dev | pine-hollow | desktop | spawn | 59.88 | 16.7 | 40.75 | PASS |
| desktop-shards-dev | pine-hollow | desktop | pond | 59.88 | 16.7 | 37.96 | PASS |
| desktop-shards-dev | pine-hollow | desktop | cabin | 59.88 | 33.3 | 37.96 | RED |
| desktop-shards-dev | nalati-grasslands | desktop | spawn | 59.88 | 16.8 | 36.64 | PASS |
| desktop-shards-dev | nalati-grasslands | desktop | plains | 59.88 | 16.7 | 37.55 | PASS |
| desktop-shards-dev | nalati-grasslands | desktop | bridge | 59.88 | 16.7 | 38.15 | PASS |
| desktop-shards-dev | far-reach | desktop | spawn | 59.88 | 16.7 | 37.43 | PASS |
| desktop-shards-dev | far-reach | desktop | spawn | 59.88 | 16.8 | 41.24 | PASS |
| desktop-shards-dev | far-reach | desktop | hover | 59.88 | 16.8 | 42.90 | PASS |
| desktop-shards-dev | sunscar-dunes | desktop | spawn | 59.88 | 16.7 | 43.36 | PASS |
| desktop-shards-dev | sunscar-dunes | desktop | spawn | 59.88 | 16.7 | 43.36 | PASS |
| desktop-shards-dev | sunscar-dunes | desktop | whip | 59.88 | 16.8 | 43.73 | PASS |
| desktop-shards-dev | _template | desktop | spawn | 59.88 | 16.8 | 43.55 | PASS |
| desktop-shards-dev | _template | desktop | spawn-reverse | 59.88 | 16.7 | 44.31 | PASS |
| desktop-shards-dev | nine-dragon-stack | desktop | spawn | 59.88 | 16.7 | 46.09 | PASS |
| desktop-shards-dev | nine-dragon-stack | desktop | well-edge | 59.88 | 16.8 | 45.21 | PASS |
| desktop-shards-dev | nine-dragon-stack | desktop | spawn-rail | 59.88 | 16.7 | 45.21 | PASS |
| sim-grid-public-entry | grid | sim | spawn | 30.30 | 35.0 | 23.36 | PASS |
| sim-grid-public-entry | grid | sim | grid-deck-east | 30.30 | 34.0 | 21.89 | PASS |
| sim-grid-public-entry | grid | sim | grid-crossroads | 30.30 | 34.0 | 20.85 | PASS |
| sim-grid-public-entry | grid | sim | grid-public-road-travel | 30.30 | 34.0 | 17.67 | PASS |
| sim-grid-public-entry | grid | sim | grid-public-road | 30.30 | 34.0 | 17.67 | PASS |
| sim-grid-public-entry | grid | sim | grid-public-template-travel | 30.30 | 35.0 | 12.79 | PASS |
| sim-grid-public-entry | grid | sim | grid-public-template | 30.30 | 34.0 | 12.79 | PASS |
| sim-grid-public | grid | sim | spawn | 30.30 | 34.0 | 7.24 | PASS |
| sim-grid-public | grid | sim | grid-deck-east | 30.30 | 34.0 | 7.45 | PASS |
| sim-grid-public | grid | sim | grid-crossroads | 30.30 | 35.0 | 7.73 | PASS |
| sim-grid-public | grid | sim | grid-public-road-travel | 30.30 | 35.0 | 8.58 | PASS |
| sim-grid-public | grid | sim | grid-public-road | 30.30 | 34.0 | 8.58 | PASS |
| sim-grid-public | grid | sim | grid-public-template-travel | 30.30 | 36.0 | 9.36 | RED |
| sim-grid-public | grid | sim | grid-public-template | 30.30 | 34.0 | 9.36 | PASS |
| sim-shards-dev | driftwood-isle | sim | spawn | 30.30 | 35.0 | 108.88 | PASS |
| sim-shards-dev | driftwood-isle | sim | pier | 30.30 | 34.0 | 100.96 | PASS |
| sim-shards-dev | driftwood-isle | sim | wreck | 30.30 | 34.0 | 87.38 | PASS |
| sim-shards-dev | pine-hollow | sim | spawn | 30.30 | 34.0 | 45.81 | PASS |
| sim-shards-dev | pine-hollow | sim | cabin | 30.30 | 34.0 | 43.26 | PASS |
| sim-shards-dev | pine-hollow | sim | gate | 30.30 | 34.0 | 37.69 | PASS |
| sim-shards-dev | nalati-grasslands | sim | spawn | 30.30 | 34.0 | 28.60 | PASS |
| sim-shards-dev | nalati-grasslands | sim | plains | 30.30 | 34.0 | 24.96 | PASS |
| sim-shards-dev | nalati-grasslands | sim | bridge | 30.30 | 34.0 | 23.12 | PASS |
| sim-shards-dev | far-reach | sim | spawn | 30.30 | 34.0 | 17.78 | PASS |
| sim-shards-dev | far-reach | sim | hover | 30.30 | 34.0 | 16.84 | PASS |
| sim-shards-dev | far-reach | sim | spawn | 30.30 | 34.0 | 15.18 | PASS |
| sim-shards-dev | sunscar-dunes | sim | spawn | 30.30 | 34.0 | 12.08 | PASS |
| sim-shards-dev | sunscar-dunes | sim | spawn | 30.30 | 34.0 | 11.99 | PASS |
| sim-shards-dev | sunscar-dunes | sim | ray | 30.30 | 34.0 | 11.99 | PASS |
| sim-shards-dev | _template | sim | spawn | 30.30 | 34.0 | 9.60 | PASS |
| sim-shards-dev | _template | sim | spawn-reverse | 30.30 | 34.0 | 8.90 | PASS |
| sim-shards-dev | nine-dragon-stack | sim | spawn | 30.30 | 34.0 | 7.96 | PASS |
| sim-shards-dev | nine-dragon-stack | sim | spawn-rail | 30.30 | 34.0 | 7.72 | PASS |
| sim-shards-dev | nine-dragon-stack | sim | well-edge | 30.30 | 34.0 | 7.42 | PASS |

## Reproduction and ownership

`driver-source.txt` is the exact receipt-only batch launcher: normal tasks use the unchanged pinned floor worker, DeveloperON seven shards then DeveloperOFF public-grid/template. `pin.json` records source/base/build. `harness-controls.json` records the standard/control hashes and sole one-line change. `gl-init-off-worker.diff` preserves that exact patch; the control lives only in the disposable clean export. It omits observer hooks, preserves frame/admission/route/document/CPU grading and compiled app/assets. No CLI GL-off option exists. Raw worker JSON remains unchanged; timestamps and load are external passive host samples. Initial desktop public baseline used baseline; corrected public tasks use template. No URL variant, capture clock, hidden frame-limit bypass, CPU throttling or game fix. No shared floor, shader or renderer source committed.

Owned preview: :4402 /PGID62579, under `/private/tmp/claude-501/sp-builders/sp-x3/floors-2026-10-09/serve/20261009-063548-4402`. All desktop contexts, owned Safari/Inspector/proxy and Simulator closed before finalization; sim-lane0/1 verified. Owned `floor-sp-x3-20261009` (816DBD49-A3DA-4460-A01D-AC74BB7F1221) waited behind both SF57 sessions; its deadline started only after acquisition. Preview and owned shutdown device are removed at close. The other lane's SF57 device/helpers were left untouched. Quiet release sent to the coordinator after both desktop controls.

Plan-State: unchanged.

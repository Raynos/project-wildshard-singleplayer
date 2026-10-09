# Current-main frame floors — 2026-10-09

Measured app/harness pin **`116f25a06426c1d35bc4084a0127875e2f338980`**, pushed origin/main when this job started. One clean preview, HTTP==disk `116f25a-mv0w4kyg`, 2× render scale. Unchanged pinned `scripts/frame-floor.mjs --worker`, seven standalone shards with Developer ON (includes Nine), separate public grid with Developer OFF. Chromium desktop1440×900; Simulator iPhone17Pro portrait phone tier when its lane becomes free. No game-code changes. Coordinator owns pushes.

**Status: desktop covered; Simulator batch queued behind SF57; final all-surface verdict remains open.** Initial standalone desktop19/20 rows PASS; template has two poses. Pine cabin initially p9533.3ms while machine load was high. Three first repeats saw cabin33.4/33.4/16.8 as load fell49.34→24.11; another three after the gate drained PASS at p9516.8/16.7/16.8, median59.88 each and completion load8.99/7.75/5.98. No reproduced low-load Pine regression, so no bisect.

Public grid uninstrumented baseline standing3/3PASS (p9516.7), but correctly refused a final verdict because no real template-entry witness occurred. The existing template scenario then proved road/template admission with seven cadence rows RED (p9533.4, beach/template median30.03); the concurrent SF57 Simulator was still drawing on the same Mac GPU. Coordinator notes G242's known desktop~30fps under Simulator overlap. A repeat after the Simulator releases is required before a real-regression claim or bisect. Travel scenario also adds existing GL_INIT allocation census; baseline does not. No claim that hooks caused the miss. The tool has no GL-off CLI option.

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

## Reproduction and ownership

`driver-source.txt` is the exact receipt-only batch launcher: two sequential tasks using the unchanged pinned floor worker, DeveloperON seven shards then DeveloperOFF public-grid/template. `pin.json` records source/base/build. Raw worker JSON remains unchanged; timestamps and load are external passive host samples. Initial desktop public baseline used baseline; corrected public task uses template. No URL variant, capture clock, hidden frame-limit bypass, CPU throttling or game fix. No floor, shader or renderer source committed.

Owned preview: :4402 /PGID62579, under `/private/tmp/claude-501/sp-builders/sp-x3/floors-2026-10-09/serve/20261009-063548-4402`. Desktop contexts closed after each worker. Simulator queued for owned `floor-sp-x3-20261009` (816DBD49-A3DA-4460-A01D-AC74BB7F1221), max25min after acquisition; queued time does not spend its floor deadline. Stop only this preview and delete only this owned shutdown device when the work closes. Do not touch the SF57 soak's device/helpers.

Plan-State: unchanged.

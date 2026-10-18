# Grid entry hitches: bounded warm-up, paced cached reads (OP, 2026-10-17)

Queue row "Grid entry hitches: warm-up timeout + chunked runtime build" (open-x-queue.md).

## What landed

- `cf2ce60fc` fix(grid): bound the entered-frame warm-up. The region's sky build (`beforeWarm`) and
  `Game.warmEnteredFrame` run under one bound counted in presented time (rAF gaps capped at 100 ms, so a
  hidden page never expires it): 5 s with no drawn frame, or 30 s in all, rejects with an
  `EntryWarmupStallError` naming the stage. afterPlay fails, the cell records it as its admission issue,
  and the next crossing retries. Before, `waitForDrawnFrame`, `isReady` polling, `compileAsync` and the
  sky's `warmSkyLayer` could all wait forever with no issue.
- `578db2198` perf(grid): pace cached reads in runtime builds. `pacedResolve` hands a held value back on
  its microtask, or after the next drawn frame once the presenting frame's 8 ms build budget is spent.
  Cached `ClientAssets.read`, admitted product reads and the grid runtime's `step()` use it.
- `85d49b650` docs(engine): both, in ENGINE.md.

## Measured, under the coordinator's CPU hold

`scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone --devserver
--grid-routes=pine-hollow-road-entry,driftwood-isle-road-entry,nalati-grasslands-road-entry`, before =
`9f217a47d`, after = `578db2198`, the same served builds, desktop once and the Simulator twice per pin.

Travel p95 (ms), Simulator, before / before2 → after / after2:

| Route | before | after |
| --- | ---: | ---: |
| Pine Hollow | 76 / 60 | 65 / 61 |
| Driftwood Isle | 38 / 48 | 48 / 42 |
| Nalati | 76 / 46 | 45 / 47 |

Whole-drive max (ms): Pine 99 / 110 → 102 / 111; Driftwood 105 / 98 → 98 / 97; Nalati 153 / 96 → 85 / 85.
Standing rows (spawn, deck, crossroads, each cell's interior) read 34-35 ms on both pins. Desktop passes on
both pins: every travel, drive and standing p95 is 16.7-16.8 ms, drive max ≤ 66.6 ms.

**Verdict:** no regression anywhere, and no road gain beyond this machine's run-to-run noise (Pine
before read 76 then 60). The paced reads do not fix Pine's Simulator road.

## Where Pine's Simulator road time goes

A Safari sampling profile of the Pine drive (diagnostic, before pin) puts the entered warm-up first:
`runPrecompile`'s TSL node builds (`WebGLNodesHandler.build`, ~15 % of all samples). The warm-up already
issues one program per drawn frame, so each long afterPlay frame is a single material's node build
(60-130 ms on the Simulator) that slicing cannot split. Pine's warm-up compiles 144 programs from 648 jobs
(compile 5.0 s, upload 1.7 s for 198 textures / 245 MB, parked draws 1.5 s, all paced). The world hook's
long frames are single units: Rapier `convexHull` per hull collider (1.4 %), the place / weld units, and
one 49 ms link query from the region sky's `prepareSceneRoots`.

What remains (open): fewer or cheaper node builds per entry (memoise TSL builds across materials that
share a program key, or bake the region's programs on the road earlier), and a shard-side split of Pine's
heaviest world units. The first intermittent desktop Sky stall did not reproduce; if it recurs, the cell
now shows an admission issue naming the stalled stage.

## Staged node-build comparison, 2026-10-17

One served pin, `e5aba0e01`, coordinator CPU hold, phone tier at 2x,
120 travel frames, `--textures=ktx2 --ktx2-probe=skip`. All four roads
completed without runtime errors. Staging off/on, p95 ms:

| Shard | Travel off/on | Whole drive off/on |
| --- | ---: | ---: |
| Pine | 55 / 56 | 55 / 53 |
| Nalati | 53 / 55 | 46 / 46 |
| Driftwood | 68 / 59 | 53 / 51 |
| Sky | 36 / 44 | 44 / 45 |

There is no consistent win. The diagnostic Pine trace exercised 27 staged
builders, so the comparison reached the experiment. `0a2117a9d` removes
the row, stager and staging-only tests, retaining ordinary compilation.

[Pine's interval list](pine-long-frames.csv) records every travel and drive
interval over 33 ms, including nominal 34 ms quantization at the 30 fps
cap. `trace` is the quiet run; `visiblecalls` and `weldcalls` are diagnostic under shared machine load
and carry no frame-floor credit. All three use the same pin.
Hook overlap locates the interval; it does not charge the whole interval
to that hook. Game update/render columns are the synchronous work at each
endpoint. GL columns measure synchronous API wall time, included in JS
work, rather than GPU execution. Blank GL cells are unavailable in the
older trace; they do not mean zero. Exact-call records may overlap their
parent callbacks and must not be added together. WebKit's zero profile
clocks prevent a complete JS/GPU partition of the remaining interval.

Six quiet intervals over 50 ms overlap `world` (480 ms combined); the
other three overlap `play` (86 ms), `afterPlay` (58 ms), and activation
(94 ms, with only 4 ms actually inside the activation hook). The first
visible callback itself spends 27 ms updating and 28 ms rendering, with
1 ms GL API time; the diagnostic repeat reads 31 / 33 ms. Wrapped calls
in that repeat locate 9 ms in `fixed.post`, 17 ms in `update`, and 32 ms
in the renderer. Two sphere calls in a different repeat (5 and 8 ms at 63104 / 63114 ms)
map to `farView.ts:137`, called by `nearPlaceholderView.ts:133`. They
occupy a 46 ms interval (63079–63125 ms), about 0.9 s before that run's
first-visible callback (63981–64014 ms, update 30 / render 36 ms). Proxy
installation now consumes the same exact packed bounds path, but those
scans do not explain the first-visible callback. Other diagnostic repeats
place one proxy scan inside intervals of 23 and 31 ms, so this is an
identified unit cost, not a repeatable frame-floor improvement.

An additional exact-call diagnostic locates `UnitParts.draw` at 25 ms,
including four bounds scans totalling 20 ms, in a 74 ms world interval.
A different world interval contains a 19 ms `JSON.parse`. No slow Rapier hull call was recorded at the 4 ms threshold; this does
not exclude unwrapped paths.
The packed Float32 bounds path retains three's coordinate order, scalar
arithmetic, publication and yield boundaries; synchronous welds consume
that existing scan. A 400,000-vertex Node benchmark reads 3.51 ms for
three's sphere scan and 0.82 ms for the optimized existing helper. This
microbenchmark measures the unit, not a road p95 improvement.

## Streamed-entry follow-up (2026-10-17, sp-x6)

**Verdict:** the missing timeout is fixed. The existing `on` pacing remains
the default. The new `entry` choice in that same Developer row remains off:
the ABBA readings do not establish a repeatable entry-time improvement.
The standing frame-floor goal stays open in the plan.

`cf2ce60fc` already bounded entered-frame preparation, but streamed far/near
views call `Game.warmSceneRoots` outside that bound. It now uses the same
presented-time bound; `waitForDrawnFrame` is independently bounded too. An
owner disposed before or during preparation rejects, including a stage that
never settles. A synchronous preparation error retains its original error.
After the known render fault stopped a probe's loop, streamed preparation
reported its stage and 5002 ms without a drawn frame instead of hanging.

The `entry` experiment slices scene inventory under the shared frame budget,
borrows ordinary instance buffers for compile-only stand-ins, preserves
specialized constructors, and keeps desktop drawn program selections while
preparation yields between completed game draws. No geometry, material,
collider or map input changes. A single native shader build/link remains
indivisible; the desktop and Safari profiles both contain that first-use
work. Hook durations include yielded waits and are not CPU attribution.
Both samplers place `getProgramInfoLog` among their top active frames;
scalar leaf-sample counts are retained in the measurement JSON as
diagnostics, without converting them to frame-time savings. The desktop
profiler records a 273 ms task with 159 ms sampled in `getProgramInfoLog`,
and a 230 ms task with 202 ms there; these instrumented task readings
are attribution evidence, not production frame-floor credit.

### Simulator ABBA

A = `d860db471`, build pacing `on`; B = `53e8e3631`, build pacing `entry`
(on the canonical map seal `c302012dd`). That seal adds map input/stamp
metadata and ruler display data; runtime code and public assets match A.
Fresh production pages per cell;
real road input and residency witnesses, phone tier, 2x render scale, 120
travel samples, KTX2 pinned with the Simulator capability probe skipped.
The standard travel GL observer/census is on for both pins; CPU/Safari
sampling and the frame timeline are off for the timing series.
The measured B pin predates the final guard preserving custom instance
constructors; no performance credit is claimed for either form.
These are timing readings, not Simulator colour/parity evidence. Shared
machine load and shader-cache warmth remain sources of variation.

Each cell is **p95/max milliseconds**. A1 -> B1 -> B2 -> A2:

| Cell / window | A1 | B1 | B2 | A2 |
| --- | ---: | ---: | ---: | ---: |
| DW travel | 34/69 | 34/87 | 34/36 | unavailable |
| DW whole drive | 34/192 | 34/151 | 35/175 | unavailable |
| DW interior | 34/35 | 34/35 | 34/35 | unavailable |
| Pine travel | 37/103 | 35/88 | 36/105 | 36/110 |
| Pine whole drive | 36/103 | 35/88 | 38/105 | 38/110 |
| Pine interior | 34/35 | 34/35 | 34/40 | 35/36 |
| Sky travel | 34/49 | 34/45 | 34/39 | 34/34 |
| Sky whole drive | 37/176 | 34/152 | 34/172 | 34/183 |
| Sky interior | 34/35 | 34/34 | 34/36 | 43/60 |

DW's A2 did not produce a valid entry sample: the pre-existing retired
`rock_moss_set_01_diff` allocation fault stopped rendering during source
admission. No value was substituted. Both parent and candidate multi-road
desktop runs reproduce that same fault after leaving Pine (plan TX1).
B1 passes every row for all three cells; B2 Pine misses the floor. This is
not evidence for enabling the experiment by default.

### Desktop and functional checks

Desktop travel/drive p95 remains 16.7-16.8 ms on completed parent/candidate
rows. Pine whole-drive max is 83.3 -> 66.7 ms. Sky's parent max is 133.3 ms;
the candidate reads 33.3 ms. The multi-road DW
comparison and the separate candidate DW return are incomplete because of
the same retired-texture fault. A complete desktop floor is not claimed.

The actual home -> template -> home route passes with the `entry` pick
verified: 409 movement samples, zero route failures and zero page errors.
It uses the existing held-input route and its crossing/residency witnesses.
The older `physics-baseline --mode=grid` harness times out before movement
because it waits for peer residency while the exclusive home is active;
that existing harness row stays open.

Grid boot smoke and the mandatory real Signal crossing pass, zero faults,
25.5 s to ten gameplay frames; 29.9 s including Signal. The landed-commit
iPhone 16 Pro Pine-entry check is reported separately to the coordinator
after the source landing.

Exact source candidate `e8b031986`: STRICT `CI=1` all ten products, zero
map-stale messages; root/layer types and typed lint; 37 focused tests
including the 17 headless cases. The same checks pass on released-main
composition `69d12f9c2` (parent `f934de980`), also zero map-stale messages.
No map inputs or baked assets changed. An additional cold iPhone 16 Pro
grid smoke at 8x CDP CPU slowdown passes on `69d12f9c2`: zero faults,
zero admission issues, ready rings, ten game frames and the real Signal
crossing. Its 210.7 s wall duration is functional evidence only; it gives
no frame-floor or Simulator timing credit.

The sealed-parent source-basis ruler pair is identical before/after: DW
4371, Pine 5303, Sky 518, Signal 392, Nalati 20486. AS stays DW 96 / Pine
433 for that pair. Seventh-window integration `69509b5cd`, on the frozen
schema/C1 parent `575fa937`, also passes all ten products, root/layer
types, typed lint and 37 tests. Its one inherited stale-map notice is
expected during the source-only window; no maps were refreshed. This
newer post-generation ruler pair is identical too: DW 3709, Pine 4923,
Sky 518, Signal 392, Nalati 20486. Final C5 integration `7463690b6`
also passes all ten products, types, lint and 37 tests. Its runtime tree
matches actual C5 `470436a99`; parent/candidate post-generation rulers
match at DW 3708, Pine 4800, with the other shards unchanged. This is
source-only validation with the inherited stale-map notice.
**Net shard lines 0; platform +55** (engine source only).

[Scalar measurements and failed-run identities](entry-followup.json) retain
the pins, run IDs, completeness and row metrics, including failed attempts.

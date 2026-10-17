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

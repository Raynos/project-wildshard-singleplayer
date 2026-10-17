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

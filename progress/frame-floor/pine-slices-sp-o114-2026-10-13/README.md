# Pine Hollow grid entry: Pine's build steps sliced (sp-o114, 2026-10-13)

sp-o100 ([receipt](../pine-grid-sp-o100-2026-10-13/README.md)) named the Pine build units
that run unbroken between drawn frames while a grid cell builds on the road. This lane
sliced, or moved ahead into their own tasks, the ones in Pine's runtime and world build.
What a player sees, what the game does and every collider stay the same.

## What landed

| Unit | Before | After | How |
| --- | --- | --- | --- |
| Crossbow hands (in `new Crossbow`) | ~22 ms desktop | taken prepared | `prepareCrossbowHands`: the coat canvas and each hand in its own task |
| Lever hands (in `new LeverRifle`) | ~8–10 ms | taken prepared | `prepareLeverHands` |
| Longbow fists and rider sleeves (in `new Bow`) | 18–41 ms (Node 17–20 ms) | view 1.3–4.8 ms; prepare stretches 2–8 ms | `prepareStaveBowHands`; the engine's `riderArmSteps` yields every 24 rings |
| Forest trees and six floor kinds (`placeDrawnModels`) | a 47 ms busy run | `placeSliced` per model | the same draws and registrations |
| The crags' cave punch of the ground | ~10 ms of a 30 ms run | pauses every 8192 triangles | engine `Terrain.punchSliced`, under the entered owner |
| The King's and two thralls' models (combat prewarm) | inside one ~45–106 ms run | each model in its own task first | the factory's cached models, each seeded from its key |

Commits: `4b239382f` (kit hands), `b88736b9f` (forest placing, punch, thralls), `f9fc85c59`
(the punch keeps its owner), `65e123136` (the King's model).

In the desktop CPU profile after the change, the `buildEquipment` run (128 ms busy) is gone.
The forest placing is now 24 ms busy across slices.

## Measured

Command: `scripts/frame-floor.mjs --rev=<sha> --shards=grid --surface=<sim|desktop>
--grid-scenario=milestone --devserver --grid-routes=pine-hollow-road-entry`, with
`--task-clock` on the Simulator and `--frame-timeline --cpu-profile` on desktop. There was no
quiet window: the load average ran from 7 to 13.

| Run | Pin | Travel p95 / max ms | Travel frames > 50 ms | Drive p95 / max ms |
| --- | --- | ---: | ---: | ---: |
| Sim before 1 | `ddf8e4e24` | **62** / 134 | 12 | 42 / 134 |
| Sim before 2 | `ddf8e4e24` | **63** / 102 | 8 | 35 / 102 |
| Sim after 1 | `6a6acd2a3` (the first two commits' content) | **50** / 138 | 6 | 39 / 138 |
| Sim after 2 | `b88736b9f` | **57** / **226** | 6 | 40 / **226** |
| Sim after 3 | `65e123136` (all four commits) | **63** / 199 | 13 | 41 / 199 |
| Sim after 4 | `4b804d070` (HEAD, with Nine's assembler fix `77bfbba70`) | **51** / 145 | 7 | 37 / 145 |
| Desktop before, profiled | `1b39cec67` | **33.3** / 50 | 0 | 16.8 / 50 |
| Desktop after, profiled | `b88736b9f` | 16.8 / 50 | 0 | 16.8 / 50 |

**The desktop now passes** (travel p95 16.8 ms, max 50 ms). **The Simulator still FAILS.** Its
travel p95 read 50, 57, 63 and 51 ms after the change, against 62 and 63 ms before. That is
within this machine's run-to-run noise (±9 ms, sp-o105), so the Simulator's gain is not proven.
What is clear is that the kit hook's long frames (`afterKit`, 2–3 per run, up to 76 ms) are gone
in every run after the change.

The remaining long frames are in Pine's `world` hook (5–9 per run, up to 138–226 ms), in
`activate` and in `afterPlay`. The last two are the warm-up (`warmEnteredFrame` and its image
uploads; the KTX2 pick is pending). After 2's 226 ms frame was a single 213 ms task, resumed
from a `macrotask()` hop in the world hook. Pins 2 and 3 also carry sp-x4's crag tiles
(`a2fe95b04`). A desktop profile at `b88736b9f` names the world hook's largest remaining
stretches:

- the cabins' weld join (`placeCabins` → `place` → `weld.join`, a 119 ms busy run);
- the timber and crag tiles' geometry assembly (`WholeGeometryAssembler.add` through
  `glbNodes`, 108 ms). Nine's `77bfbba70` sped up that shared assembler, and pin 4 is the first
  run to include it;
- the homesteads' baked-building decode (`cabinBake`, 42 ms per building task);
- the rigged creature hulls' parse (`riggedHulls`, ~14 ms each).

## Proofs

- `test/pine-kit-ahead.test.ts`: stepped sleeves are byte-identical to `riderArm`. Each
  weapon takes the prepared geometry object (identity), which is byte-identical to the
  one-task build.
- `test/terrain-punch-sliced.test.ts`: the sliced punch sets the same index array.
- Pine look parity (`scripts/proof-pine-look-parity.mjs`, base `1939737b3` against candidate
  `6a6acd2a3`, both tiers, 20 poses): the pixels, draws, triangles, GPU bytes, programs,
  colliders and pieces are identical. The desktop shader-set hash differs only in one
  `SHADER_NAME` define, which of `stone-a`/`stone-b`'s two LOD materials compiled their
  shared program first. Two base runs differ from each other the same way.
- Pine headless, replay and ledger, every Pine shard test, and the Driftwood, Far Reach and
  Nine checkpoint freshness tests pass.

Raw results, profiles and parity captures stayed in scratch and were deleted.
[summary.json](summary.json) holds every run's Pine rows.

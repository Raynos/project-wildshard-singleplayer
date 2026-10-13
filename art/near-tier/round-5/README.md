# Near tier, round 5: every shard has a near view (G342 / G380)

Boards: [`board-iphone.jpg`](board-iphone.jpg) and [`board-desktop.jpg`](board-desktop.jpg), A beside B beside C, one
row a view: the four road views from the roundabout (toward Driftwood, Pine, Nalati and the template) and the shipped
hero SQ-NW-b (G378). Every panel is a real canvas capture of a clean HEAD build (`8546ae1`, which has `17279180a`), with
a label band burned in: A / B / C, the view, the device, then **each cell's drawn tier read from that frame**
(`grid.state().cells[].shows`, near distances from `frame.near`). Shot with
`scripts/capture-main-menu-hero.mjs --round=near --enter` and labelled by `scripts/near-tier-board.py <capture> <art> 5`.
The single panels are beside the boards (`<A|B|C>-<view>-<device>.jpg`).

- **A**: Debug > Look > Neighbour detail A, the far proxies. Still the shipped default.
- **B**: Neighbour detail B, the near tier as the game would run it: the four nearest cells by distance.
- **C**: Neighbour detail C, every cell on its near view. This is for captures only, never a game setting.

Near is not in the public build. Per Jake ("keep iterating, don't ship yet") it stays default A behind its Debug row.

## New this round: Sky Reach and the Blender template have near views (`17279180a`)

Before this round they had no near view, so C drew them as far proxies. Both bakes are generic SDK paths. There are no
slug branches and no per-shard tables:

- **Sky Reach** (its land is floating island models): the far bake's model tools (the GLB reader that samples the paint
  per vertex, and meshoptimizer's decimation) moved into the SDK as `placeholderModelTools`. The far runner uses them
  and its `far.glb` bytes are unchanged. The near runner builds the same declared island parts from them at 16× the
  far's triangle share, then reduces the whole land to a 60k-triangle budget. **4.15 MB**, 59.7k triangles, one draw.
- **Blender template** (an authored mesh world with no height field): its coarse L1 tile meshes stand on a flat floor
  just under them. **0.70 MB.** Its world is low-poly at every LOD (L1 6.6k / L0 7.2k triangles), so this is the whole
  hall. `wildshard build` does the same for any terrain-less shardfile.

In C both now read `near`: Sky's islands in turf and stone over its cloud sheet (right of the hero), and the clay hall
(far left of the hero, 912 m).

## What each mode costs on the `near` line

| Mode | Near cells (road views) | Near resident |
| --- | --- | --- |
| A | none | 0 |
| B | Pine, template, Driftwood, Nalati | 25.6 MB |
| B, hero SQ-NW-b (desktop, Nalati entered) | template, Driftwood, Sky Reach, Ink-cel | 15.5 MB |
| C | all nine (all eight on the hero, with Nalati entered) | 35.4 MB (27.5 MB on the hero) |

Every cell stays under the 8.5 MB ceiling (Driftwood 8.33, Pine 8.22 and Nalati 7.86 MB are the largest). B stays inside
the 1.0 GB Explorer envelope. Nothing runs per frame that A doesn't already run.

## What the views show

- **Toward Pine**: A is a grey boundary wall. B and C show the forest.
- **Toward Nalati**: the near ground leans back from the cell edge above the 14 m seam (round 5's lean, `a6424d8f8`),
  so the tall grey cliff of round 4 is gone. The snowy crags stand behind the leaned rim.
- **Toward Driftwood**: the island keeps its cliffs and huts. Toward the template, its plaza and tower are the same in
  all three modes (its world is its own L1 / L0 tiles).
- **On the iPhone hero**, Nalati draws its near view, not its runtime. The phone-tier entry from 300 m up times out in
  this harness (as in round 4), and the label says so.

Still open: Nalati's crags read spiky against the sky from the road. The template's `near.glb` is older than its
current tiles (a rebake gives 7.7k content triangles and it would then own its cell); it was not rebaked here.

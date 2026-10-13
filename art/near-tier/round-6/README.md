# Near tier, round 6: crags that keep their ridges (G342)

Boards: [`board-iphone.jpg`](board-iphone.jpg) and [`board-desktop.jpg`](board-desktop.jpg), A beside B beside C, one
row a view: the four road views from the roundabout (toward Driftwood, Pine, Nalati and the template) and the shipped
hero **SQ-NE-b** (G383, round 5 showed SQ-NW-b). Every panel is a real canvas capture of a clean HEAD build
(`9b5af5e`, which has `2d4b6b8a0`), with a label band burned in: A / B / C, the view, the device, then each cell's
drawn tier read from that frame (`grid.state().cells[].shows`, near distances from `frame.near`). Shot with
`scripts/capture-main-menu-hero.mjs --round=near --enter` and labelled by `scripts/near-tier-board.py <capture> <art> 6`.
The single panels are beside the boards (`<A|B|C>-<view>-<device>.jpg`).

- **A**: Debug > Look > Neighbour detail A, the far proxies. Still the shipped default.
- **B**: Neighbour detail B, the near tier as the game would run it: the four nearest cells by distance.
- **C**: Neighbour detail C, every cell on its near view. For captures only, never a game setting.

Near is not in the public build. Per Jake ("keep iterating, don't ship yet") it stays default A behind its Debug row.

## New this round: Nalati's crags (`2d4b6b8a0`, generic SDK bake, no shard code)

Round 5's crags read spiky against the sky from the road. Two causes, both in the shared near bake:

- **Every prop lost the same 90 %.** The bake cut every prototype by one common share of its own triangles, so the
  100 m rings of rock fins kept 10 % and each fin became a sliver. Now the whole cell is simplified to **one world-space
  error** (bisected to the content budget): one error is one screen error at one distance, so a ridge keeps the
  vertices its skyline needs (the fins keep ~78 %) and a 1 m chest gives its triangles up. Nothing keeps under 4 % of
  itself (a palm's thin fronds), a cell that fits its budget is untouched, and a cell that overflows even at the
  coarsest error keeps round 3's ratio (Driftwood, byte-identical).
- **Fins floated over the leaned edge.** Round 5 leans the near ground back from the cell border; a prop sank with it by
  its origin. The crag ring is one merged mesh with its origin at the centre, so the fins on the leaned flank stayed in
  the air. Now a copy wider than 32 m sinks **piece by piece**, and a piece wider than that drapes vertex by vertex.

Toward Nalati the fins now stand on the snow ridges, with no floating spikes in the sky. Rebaked: Nalati near
(error 0.31 m, 7.73 MB), Pine near (0.78 m, 8.40 MB) and Sky Reach near (its island land at one error, 4.18 MB), all
under the 8.5 MB ceiling. Nothing runs per frame that A doesn't already run.

The tall peaks still standing on the left of the Nalati view are its ground (the terrain's own arêtes at the 0.5 m
ground error), not props.

## What each mode costs on the `near` line

| Mode | Near cells | Near resident |
| --- | --- | --- |
| A | none | 0 |
| B, road views | Nalati, Pine, template, Driftwood | 25.6 MB |
| B, hero SQ-NE-b, desktop (Nalati entered) | Ink-cel, template, Driftwood | 11.3 MB |
| B, hero SQ-NE-b, iPhone | Nalati, template, Driftwood, Ink-cel | 19.1 MB |
| C | all nine (eight on the desktop hero, Nalati entered) | 35.4 MB (27.7 MB) |

Per cell: Pine 8.40, Driftwood 8.33, Nalati 7.73 and Sky Reach 4.18 MB are the largest, all under the 8.5 MB ceiling;
B stays inside the 1.0 GB Explorer envelope. On the iPhone hero Nalati draws its near view, not its runtime: the
phone-tier entry from 520 m up times out in this harness (as in rounds 4 and 5), and the label says so.

## The template's near view: held, needs a look (before / after)

[`template-near-refresh-iphone.jpg`](template-near-refresh-iphone.jpg) (iPhone portrait) and
[`template-near-refresh-desktop.jpg`](template-near-refresh-desktop.jpg), road view toward the template, Debug C:

- **A, before (committed):** the template's `near.glb` is its ground only (content 0), so it does not own its cell and
  its own L1 / L0 tiles refine it: the orange plaza and the tower.
- **B, after (a fresh bake at HEAD):** the runner now builds a shardfile shard's near view from its 16 L1 tile meshes
  (content 7662), so the near view owns the cell and the tiles stop refining it: grey, untinted meshes, plus blocks the
  tiled view does not show.

That is a visible change, so it is **not committed**; the boards above use the committed bytes. Ink-cel and Pastel
already draw this way (they were rebaked in round 5). Recommendation: a near view built from a shard's own tiles should
not own its cell (as `wildshard build`'s shardfile near row already never does), and should take its tiles' look
materials, before the template is rebaked.

## The template's near view, refreshed (sp-o87)

Fixed as recommended above, generically (SDK bake + grid, no shard code):

- **No takeover.** A baked near view built from a shard's own coarse tiles carries `near.tiles: true` in its `near.json`
  and never owns its cell, as a shardfile's own near row never does: its L1 / L0 tiles keep refining over it and the near
  view is masked out wherever they draw. A view that carries the shard's authored props (Driftwood, Nalati, Pine, Sky
  Reach's islands) still owns its cell.
- **Tile materials.** `shardfileWorld` colours each tile mesh as the client draws it: the catalogue entry its material
  name binds (else `props.family`) tints the GLB's colour and vertex colours; a graph draws its preset or its plain
  fallback (the Graph materials row is off by default); a measure layer paints its role colours from the measure UVs
  (structure orange, trim grey, floor light grey). Colour maps are not sampled.
- **Ink-cel, Pastel and the Blender template** (also built from their tiles) rebake byte-identical GLBs (their tiles'
  fallback materials are plain vertex colour); only `tiles: true` lands in their `near.json`. They stop owning their
  cells, which no road view or hero frame shows: their rings plan no tiles at that range.
- **The template** rebaked: 1.81 MB resident (was 1.19 MB), content 7662 triangles, under the 8.5 MB ceiling.

**Proof:** [`template-near-proof-iphone.jpg`](template-near-proof-iphone.jpg) (iPhone 16 Pro portrait) and
[`template-near-proof-desktop.jpg`](template-near-proof-desktop.jpg): one camera over the template's far corner. Panel 1
shows its real tiles (player on its far roundabout, Debug B: 13 of 16 regions refined). Panel 2 shows the committed near
view alone (player far away, Debug C): ground only. Panel 3 shows the refreshed near view in the same frame: the plaza,
the tower and the trim in their tiles' colours.

**The game's views do not change.** All 30 round-6 panels (A / B / C, four road views + NE-b, iPhone + desktop) were
re-shot on one base (`fea6e01b6`) before and after. The pixel diff is noise: a mean of at most 0.03 / 255 and no
changed area. From the roundabout the template's rings refine every region its props stand in, so no round 7 board.

Left as it was: the near view's ground is the template's far look (mid grey), not its floor's light grey. The 42 m block
district in its far corner shows in the near view. Its real tiles at that range sit beyond the template's own fog (far
180 m), so they fade out.

## Sky Reach: near view and island tiles

Since `fd1b0a9a4` Sky Reach draws its twelve static islands from props tiles (11 L0 tiles, bound by its runtime). Its
near view (built from its far row's island models, rebaked unchanged at that HEAD) carries its own world (content
59 990 triangles), so it **owns its cell**: while it draws, the rings plan no L1 / L0 tile for Sky and retire any they
hold (`session.ts`'s ring cost, covered by `grid-render-rings`' "a covered cell retires its L1 / L0 tiles"). No rule
changed.

Checked on a clean build of `fd1b0a9` standing on the road 25 m off Sky's edge
([`sky-near-vs-tiles-desktop.jpg`](sky-near-vs-tiles-desktop.jpg)): in A Sky draws its far proxy with 0 L1 / 0 L0 ring
tiles; in B (desktop and iPhone) its near view draws, the far proxy is hidden and the rings still hold 0 L1 / 0 L0 tiles.
One copy of each island, no double draw and no z-fight. (At that spot the rings do not stream Sky's new L0 props tiles
in A either; they are its runtime's, drawn when the cell is entered.)

## Signal Dunes' far proxy

Refreshed in `2d4b6b8a0`: its `far.glb` was baked from the terrain collider before G350; heights move at most 0.19 m, so
nothing shows.

# Lantern Bayou: the G983 look loop

G983 (Jake, 2026-11-03 00:35): every built open plot gets a finish step. Capture its hero views in the engine, have
codex `image_gen` remaster each capture into the target look, then run the look loop (`docs/design/LOOK-LOOP.md`) over
9 fixed angles until the gap closes. sp-o2 decides each round from the boards and logs the pick (G872); the last board
goes to Jake.

## The 9 fixed angles

The OP4 dome capture of the activated plot (`scripts/open-plots/capture.mjs`: iPhone 16 Pro, phone tier, 2x, 62°
horizontal FOV, 402 x 603), each dome's hero view plus the plaza's look-up:

| # | dome | view |
|---|---|---|
| 1 | A1 road stand | 5 hero |
| 2 | A2 road look | 5 hero |
| 3 | B1 40 m stand | 5 hero |
| 4 | B2 40 m look | 5 hero |
| 5 | C1 100 m stand | 5 hero |
| 6 | C2 100 m look | 5 hero |
| 7 | D1 plaza stand | 5 hero (the cypress) |
| 8 | D1 plaza stand | 1 look up (the crown and its lanterns) |
| 9 | D2 gate look | 5 hero |

## Round 0: capture cfbc0220db, targets

- `sheet-r0-capture-vs-target.jpg`: each angle's capture beside its target.
- `target-1.jpg` … `target-9.jpg`: the targets, from codex `image_gen`. Each run got two images, the capture to edit
  and the round-62 board `art/grid/round-62-open-plot-palettes/18-lantern-bayou.jpg` as a style reference, plus one
  shared prompt (KEEP the camera, layout and silhouettes; REMASTER the materials, light and finish). All 9 were usable
  and none were re-rolled.

### Gap list (what the targets have that the game lacks), by area × frames

| # | gap | frames | track | round 1 |
|---|---|---|---|---|
| 1 | the cypress's bark is brown and its hanging moss olive-green, where the game draws lilac-pink bark and near-white moss | 7, 8, 9, 4 | landmark light | fixed: `landmarkDusk` graph (b4078da34d); moss swatches olive (d4bf5c9495) |
| 2 | the boardwalks are dark planks with grain and per-board shade, where the game draws grey flagstones | 1–7, 9 | kit ground | fixed: `kitPlanks` ground rule (d4bf5c9495, 69fffe4c19) |
| 3 | the water is teal-black and mirrors the lanterns, where the game draws flat navy | 3–6 | water | partly: water #245e5c (d4bf5c9495); the reflections need the water kind |
| 4 | the lane posts carry no red banners | 2, 9 | palette | fixed: banner, cloth and stall slots in the bayou's moss-teal (b4078da34d) |
| 5 | the sky is a dark, clouded teal dusk; the road views show the grid's pale lavender | 1, 3, 5 | sky (outside the plot) | out of scope (the grid's shared sky) |
| 6 | more warm lantern light pools along the walks | 3, 4, 6 | lights | open |

## Picks (G872, logged)

- **R1** (sp-o2, 2026-11-03): land gaps 1, 2 and 4, and the water colour of 3, as one round. Each row is the targets'
  unanimous direction, and none trades away anything the old look had. The entry poster drops from 448 to 384 px, which
  frees 40 KB of phone wire for the later rounds (5.44 of 5.48 MB) and doesn't show on a 10 m board seen from the road.

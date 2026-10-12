# sky47: every grid cell's own sky (SHARD-PLATFORM G321, sp-o2, 2026-10-12)

Jake (G321, 2026-10-10): *"when you enter a shard, you enter it with its sky"*. Each shard keeps its own sky, light and
grade inside its grid cell, the road keeps the generic grid sky (G242 B), and the two blend across the 16 m edge band.

## What landed

| commit | what |
|---|---|
| `cd9f8486c` | the `gridSkyEnvironment` Debug row (Sky & weather ▸ Grid cell sky light) is deleted with its off path: a backdrop-less painted-sky level's cell (Nalati, Nine Dragon) always lays its standalone sky environment at half owner weight on its `sim-sky:` claim (1,572,864 B) |
| `a65a4043e` | a shardfile cell with no runtime (the templates: template-2 in the public grid, blender-template / pastel-plain / ink-cel-valley in the Developer grid) lays its data look's own sky (gradient dome, key light, ambient, its day clock) on the page's one sky, weighted by its owner weight; before this it drew the road's grid sky inside its cell. 0 B (no texture) on its `sim-sky:` claim |

Every other cell already carried its own sky through `regionSky.ts` (G223 / G232: Driftwood is the page's own, Pine,
Sky Reach and Signal Dunes lay their level backdrops) or `ownSky` (Nalati, Nine; `fbf4097b7`, `00170b45d`).

## Proof

`capture.mjs` (one muted Metal context per surface: iPhone 16 Pro portrait, phone tier 2×; desktop 1440×900, desktop
tier), build `a65a404` (`serve-build.sh --rev a65a4043e`), Developer on. Each cell is entered from the road by
frame-floor's `cell` plan, then posed 200 m from its centre (inside: owner weight 1) and on its edge line (the 16 m band's
middle: weight 0.5), facing the centre. `sheet.py` makes one labelled board per cell (`<cell>-board.jpg`).

Readout (phone, inside → edge): every non-home cell hangs exactly one region sky, `drawn` at weight 1 → 0.5, and the
road sky goes 0 → 1 (its base layer takes the share the cell leaves).

| cell | region sky (reserved B) | env inside | key intensity inside → edge |
|---|---|---|---|
| Pine Hollow | backdrop (29,360,128) | 384×512 @1.41 | 4.46 → 3.43 |
| template-2 | data dome (0) | none | 1.50 → 1.95 |
| Signal Dunes | backdrop (covered by its sim lease) | none | 1.85 → 2.13 |
| Nalati | sky environment (1,572,864) | 384×512 @0.6 | 2.80 → 2.40 |
| blender-template-1 / pastel-plain-1 / ink-cel-valley-1 (Developer grid) | data dome (0) | none | 1.7 / 1.6 / 1.7 |
| Sky Reach | backdrop (covered by its sim lease) | none | entered by posing inside: the flat road drive stops at its islet's portal edge |
| Driftwood (home) | the page's own sky | — | dropped onto its own ground (its world stands at its datum) |

Boards (iPhone inside · iPhone edge · desktop inside over desktop edge): `pine-hollow-board.jpg`, `template-2-board.jpg`,
`sunscar-dunes-board.jpg`, `nalati-grasslands-board.jpg`, `far-reach-board.jpg`, `driftwood-isle-board.jpg`, and the
Developer grid's `blender-template-1-board.jpg`, `pastel-plain-1-board.jpg`, `ink-cel-valley-1-board.jpg`. 0 page errors
and 0 console errors on both surfaces. Nine Dragon is not in this grid (DEVSERVER only); its cell is op-sky46's.

## Frame floor (desktop, quiet window 20:58–21:02Z)

`node scripts/frame-floor.mjs --rev=<sha> --shards=grid --grid-scenario=cell --grid-cell=template-2 --road-approach
--surface=desktop` (a clean pinned export each; 1440×900 / 2×):

| row | before `56de6e642` fps / p95 / max ms | after `a65a4043e` |
|---|---|---|
| spawn | 59.88 / 16.7 / 16.8 | 59.88 / 16.7 / 16.8 |
| grid-deck-east | 59.88 / 50.1 / **116.6** (its samples overlapped another lane's generator for ~2 s) | 59.88 / 16.8 / 16.8 |
| template road-entry travel | 59.88 / 16.7 / 100 | 59.88 / 16.7 / 16.8 |
| whole drive (1,440 frames) | 59.88 / 16.8 / 100 | 59.88 / 16.7 / 16.8 |
| template-2 interior | 59.88 / 16.7 / 16.8 | 59.88 / 16.8 / 16.8 |

After: PASS on every row (gates p95 ≤ 17.5, max ≤ 100). The Simulator before / after was not run (its queue was held by
other lanes' Simulator legs within this lane's cap).

Memory: a template cell's sky reserves 0 B (a 24×12 gradient sphere, no texture); Nalati / Nine's carried environment is
the 1,572,864 B op-sky46 measured, now always on, inside each cell's `sim-sky:` claim.

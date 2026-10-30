# Nine Dragon tiling: a vertical megacity on the 62.5 m tile lattice

**State:** `open` (grilled ~14:05: G948 tiles are a bake / detail unit for Nine, G949 the far copy, G950 the check reports and blocks only a Nine regression); was `draft` 2026-10-30 ~14:10 Cancun, waiting for Jake's grill. Written by wildshard-v's subagent from its own
tiling audit; wildshard-new hands the rows to lanes after the grill. Ask E516. Jake: *"Nine Dragon is an example of a
really complicated, massive world where the tiling system might be failing. So do a special mini plan that's called
like Nine Dragon Tiling Audit. Like, how do you make something this vertical, this massive, and this detailed
compatible with the tiling system? Make it a separate mini plan, like Nine Dragon Tiling mini plan. It's gonna have some
overlap. Use a sub agent for that."*

This plan owns only what is about tiles: how Nine's content is cut, held, picked and checked by the 8 × 8 lattice of
62.5 m tiles. Frame cost, the GLSL back-end, the dressing restores and the slab bake stay in
[nine-fix](nine-fix-mini-plan.md) (NF rows) and the [engine performance plan](engine-performance-mini-plan.md) (EP rows).
Each row below names the rows it touches. It keeps the format and fixes the bake and the runtime (G934). Visual rows are
Opus-only (G848). Jake checks his phone once, at the end (G942).

Measured on live previews `6939959` and `970b390` (both carry NF1 `87f7d2c37a` and NF4), muted Chromium through
`scripts/browser-lane.sh`, "iPhone 16 Pro", phone tier, 2x, the 27 golden cameras of the E512 dressing census. The
shardfile's own tile rows were read from the built `sections/world/tiles.json` of every shard. Scratch (not committed):
`tmp/wildshard-v-nine-tiling/` (`sightline.py`, `tilecensus.py`, `tiling.js`, `held.js`, raw receipts).
Board: [tiling audit](../../../art/nine-dragon/e516-tiling-audit/tiling-audit-board.jpg).

## What the audit found

1. **Nine is not wide. It is a tall, dense column.** The city covers about 125 × 190 m of the 500 m cell and stands
   from −40 to +249 m. Five of the 64 tiles hold 90 % of the GPU bytes and 92 % of the triangles. One tile, (3,3), holds
   30 MB of GPU data, 241k triangles and 34 draws, and is 268 m tall. The per-tile caps in the format are 4 MB resident,
   40k triangles and 8 draws. Nine is the only shard over any cap: five tiles exceed all three. The bake only prints a
   warning ("provisional caps").
2. **The ring decides nothing inside the city, and it hides the city from outside.** From the 21 cameras inside the
   city, a 5 × 5 ring around the eye already holds 97–99 % of the city. From the two portal decks that face the city,
   98–100 % of what the camera sees lies outside that ring, 158–229 m away. From the two aerials, 13 % and 69 % does.
   The median camera has 83 % of the whole cell in its frustum. A ring around the player is the wrong tool for a city
   that you can see from every point in it.
3. **NF1 declares "hold the whole cell", but the driver that holds the city never reads it.** Nine's fabric and facade
   dressing attach through the world.assembly tile driver: `residentTiles(owner, scenes.tiled(), …)` at
   `src/game/shardfile/clientWorldAssembly.ts:119` passes no radius, so it uses the device's ring (5 × 5, plus NF6's one
   tile of slack). Only `clientPlan.ts:296` passes `productTileRing(source)`. `forestPage.ts:152` and
   `sceneDressing.ts:217` have the same gap. Measured: on a jump from spawn to the east deck and then to the west deck,
   20 of the 25 fabric unions are empty at the west deck. That leaves 6.7k fabric triangles against legacy's 540k, and
   still 6.7k after 8 s. The view is a plain grey slab where legacy shows the lit city (board, panel B). Facade dressing
   at the decks and aerials draws 56–72 % of legacy's triangles. This is most likely why NF1's zero-upload bar still
   fails (124 big `bufferData` calls after the reveal) and why NF7 is still open.
4. **The tile is the wrong unit for culling and for level of detail.**
   - The fabric is joined into whole-part unions. Their bounds are whole-part spheres of 126–222 m radius, so they
     never cull. `facade-shell` and `kit:crown` each span all 49 occupied tiles.
   - Every tile row declares `geometricError: 0`, both L0 and L1, so nothing could pick a level by screen error.
   - The only coarser level, L1, is a 2 % copy (14.9k of 704k triangles). Other shards keep 6–27 %. The 2 % comes from
     Nine's generator squeezing each 125 m parent into the L1 caps of 10k triangles and 2 draws.
   - At the decks the city sits at 19–28 cm per pixel. In the city the near tiles are at 0–2 cm per pixel. A far level
     at about 20 % of the triangles, with the full paint, would be invisible at the decks. The 2 % copy is not.
5. **Memory is fine; the copies are not.** The whole L0 is 81.6 MB of GPU data, about 7 % of the 1.2 GB per-shard cap.
   The loader already reads 38 of 64 tiles (86.4 of 86.7 MB) before the reveal. But SHARDFILE's JS heap reads 86 MB
   against legacy's 21 MB, and its scene geometry holds 119 MB of CPU arrays against 61 MB, because the run time keeps the
   tile pieces *and* the joined union. Slabs (NF10 / NF11) and half floats (NF19) remove most of that.
6. **What is fine.** Colliders on a 3 × 3 ring by x / z work for a stack: collision is local, and a tile's levels from
   −40 to 249 m are cheap. Draws per frame match legacy at every measured camera (107–154 against 133–153). The format
   can already express everything Nine needs (see the model below).

### A. The lattice (shardfile tile rows, L0)

| Tile (x, z) | GPU MB | Triangles | Draws | Height (m) | Over cap (4 MB / 40k / 8) |
|---|---|---|---|---|---|
| (3,3) | 30.0 | 240,585 | 34 | −40 … 228 | all three |
| (4,4) | 13.5 | 129,914 | 24 | 0 … 243 | all three |
| (4,3) | 11.7 | 146,216 | 31 | 0 … 243 | all three |
| (3,2) | 9.4 | 65,741 | 12 | −40 … 249 | all three |
| (3,4) | 9.0 | 64,072 | 13 | −40 … 243 | all three |
| 29 other occupied tiles | 8.0 | 57,654 | 61 | | none |
| 30 empty tiles | 0 | 0 | 0 | | |
| **cell** | **81.6** | **704,182** | **175** | | |

L1 (125 m): 12 occupied parents, 0.66 MB, 14,916 triangles, `geometricError` 0.

### B. Sightlines: what a 2-D 5 × 5 ring around the eye holds (offline frustum test of the tile boxes)

| Camera | Eye y | In-view L0 triangles | In view but outside the ring | Heavy tiles: nearest point, size of a pixel |
|---|---|---|---|---|
| 1 square (spawn) | 127 | 674k | 3 % | 0–70 m, 0–8 cm |
| 25 P4 stair top | 148 | 663k | 0 % | 14–102 m, 2–12 cm |
| 17 east portal deck | 3 | 694k | **98 %** | 158–229 m, 19–28 cm |
| 18 west portal deck | 3 | 691k | **100 %** | 158–220 m, 19–27 cm |
| 21 aerial south | 200 | 702k | 13 % | 58–183 m, 7–22 cm |
| 22 aerial west | 230 | 702k | **69 %** | 78–206 m, 9–25 cm |
| all 27 | | median 83 % of the cell | 24 of 27 cameras cut something | |

### C. Live census with NF1 declared (per frame; SHARDFILE / LEGACY)

| Camera | Draws | Triangles drawn | Fabric triangles | Facade dressing triangles |
|---|---|---|---|---|
| 1 square | 148 / 148 | 1.31M / 1.46M | 708k / 710k | 113k / 203k |
| 17 east deck | 130 / 133 | 1.18M / 1.57M | 426k / 540k | 305k / 482k |
| 18 west deck | 107 / 134 | **0.44M / 1.58M** | **6.7k / 540k** | 3.7k / 491k |
| 21 aerial south | 153 / 153 | 1.45M / 1.70M | 577k / 656k | 350k / 485k |
| 22 aerial west | 144 / 141 | 1.40M / 1.55M | 577k / 540k | 322k / 467k |

Programs: 95 / 67. JS heap: 86 / 21 MB.

### D. Every shard against the per-tile caps

| Shard | L0 MB | Occupied tiles | Top 5 tiles' share | Biggest tile MB / k tris / draws | Tiles over cap | Tallest tile | L1 / L0 triangles |
|---|---|---|---|---|---|---|---|
| nine-dragon-stack | 81.6 | 34 | 90 % | 30.0 / 241 / 34 | **5** | 289 m | **2.1 %** |
| driftwood-isle | 4.9 | 17 | 83 % | 1.4 / 20 / 7 | 0 | 47 m | 14.1 % |
| pine-hollow | 5.2 | 64 | 25 % | 0.6 / 7 / 6 | 0 | 63 m | 27.4 % |
| nalati-grasslands | 5.7 | 64 | 10 % | 0.1 / 2 / 1 | 0 | 74 m | 23.3 % |
| far-reach (ring cell) | 1.4 | 22 | 44 % | 0.1 / 6 / 2 | 0 | 44 m | 1.5 % |
| sunscar-dunes | 3.7 | 64 | 8 % | 0.1 / 2 / 2 | 0 | 29 m | 5.6 % |

## The tiling model for Nine

**For Nine, a tile is a unit of baking and of level of detail, not of loading.**

- **Residency: the whole cell, always** (NF1, made real by NT1). That is 82 MB of GPU data, about 55 MB with NF19's half
  floats. The JS heap drops once slabs end the run-time pieces and unions.
- **Near level: L0 tile slabs.** These are pre-merged at bake per tile × material × distance band (NF10 / NF11 /
  EP6). NT3 also cuts them into **height bands**, so each chunk has a tight 3-D box: a camera on the stair top looking
  down does not draw the decks above it.
- **Far level: the L1 tiles.** Nine's generator spends the cell's whole L1 budget on the four parents that hold the city
  (NT4). That gives about 15–20 % of the triangles instead of 2 %, with the full look: EP12 / NF4's paint, and signs and
  neon as emissive geometry. Each level states its real `geometricError` (NT2).
- **The camera picks the level, by screen error, not by the player's ring.** Each tile is scored by the projected error
  of its far level at the camera eye: 3-D distance to the chunk box, at the phone's pixels at 2x, under 1 px with
  hysteresis (NT5).
  - In the city every near chunk is under ~80 m, so L0 draws everywhere and the picture is pixel-identical to today.
  - From the decks and the aerials the core switches to the far level.
  - The same far level is what a grid neighbour sees (G663).

The decks are within the draw bar today (130–134 draws), so the far level is a below-legacy win (G937), not a parity
fix. NT5 decides with numbers: it flips on only where it beats L0 at matched poses.

**What the format must express: nothing new (G934).** Each need maps onto something the format already has:

| Need | Where it lives today | Change |
|---|---|---|
| Whole cell resident | `ring: 'cell'` (`format/shardSchema.ts:86`) | none; the runtime must read it (NT1) |
| Near slabs per tile × material × band | tile files and world-scene rows | bake (NF10, EP6) |
| Height bands | chunk boxes, draw `sphere` (`format/worldSceneModels.ts:20`) | bake (NT3) |
| Far level per district | L1 tile rows (`lod: 1`) | bake budget per cell (NT4) |
| Error per level | tile row `geometricError` (`format/shardSections.ts:31`, 0 today) | bake fills it (NT2) |
| Level selection | runtime | NT5 |
| Per-tile caps | `CONTENT_CAPS` constants (`format/contentBounds.ts:39`, warnings only) | NT7 reports per chunk and per cell |

What the format cannot say: a third level (`lod` is the picklist `[0, 1]`), and tile rows off the lattice (admission
checks every row's bounds against it, `shardSchema.ts:262-265`). Nine needs neither. Its whole L0 fits in memory, and
two levels cover the 0–80 m street views and the 140–230 m deck and aerial views.

**Rejected options:**

| Option | Why not |
|---|---|
| Vertical or 3-D cells | A format change (rows are `lod`, `x`, `z` on the lattice), and not needed. Height lives in chunk boxes (NT3), and selection uses 3-D distance (NT5). |
| Districts instead of square tiles | The same format change. Districts already exist as content (world-scene models and weld parts) inside the tile files; the lattice only says which file holds which bytes. |
| An always-resident skyline plus streamed near detail | For Nine the near detail *is* the city: 82 MB under the cap and seen from everywhere. Streaming it buys nothing and costs the hitches NF10–NF12 remove. |
| Smaller tiles or a smaller ring | The same five tiles of content end up in more files, with more retires. |
| Per-tile slabs alone (NF10) | Needed, but not enough. Per-tile frustum culling saves little when 83 % of the cell is in view; slabs also need height bands and a far level. |
| Impostor cards for the far city | The decks and aerials are walkable views inside the cell ("no screenshot cheats", JAKE.md). Real geometry at 15–20 % costs little. |
| A cluster-LOD (Nanite-lite) city | That is EP11's spike. It stays a spike; this model needs no new renderer path. |

## Rows

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| NT1 | **Every tile driver reads the product's ring.** `residentTiles` at `clientWorldAssembly.ts:119`, `forestPage.ts:152` and `sceneDressing.ts:217` pass `productTileRing(source)`, as `clientPlan.ts:296` does. The `radius` parameter becomes required, so no caller can fall back to the device ring. `wholeRefinementCover`'s spawn order reads the same ring. **Overlap:** this is NF1's missing half and closes NF1's open done-when. It likely closes NF7 (far dressing) too. Land it under NF1's lane at once. | A focused test fails a `residentTiles` call without the product ring. At HEAD, for cams 1 → 17 → 18 in one session, every fabric union is non-empty and the west deck's fabric draws ≥ 95 % of legacy's 540k triangles. NF1's own bars hold: no `bufferData` ≥ 256 KB after the reveal, no frame > 100 ms. Facade dressing at cams 17 / 21 / 22 is within 5 % of legacy's, or what remains is handed to NF7 with numbers. | **done** `06d86f2c22` + `39525aafe4` (sp-o5): census on the 06d86f2c22^ / 06d86f2c22 previews, Chromium phone 2x: west deck cam 18 frustum tris 1,047,519 → 1,534,244 (LEGACY 1,534,254), kit / fabric 451,046 → 482,490 (= LEGACY), no empty kit union; east deck cam 17 1,160,136 → 1,510,626 (1,510,840); cam 21 1,659,118 (1,659,862). Dressing at cams 1 / 5 / 14 / 27 equals LEGACY copy for copy (NF7). NF1's upload / 100 ms / Simulator bars: sp-x6's re-measure on this pair | S |
| NT2 | **Every level states its error.** The bake writes each L0 / L1 tile row's real `geometricError`: L0 states storage loss (the quantization-cell radius for rounded compact positions); L1 adds the simplifier's achieved error in metres. Slab chunks carry theirs too. | Refuse a zero error for lossy geometry. Exact zero stays legal for genuinely lossless (grid-aligned or unquantized) geometry and empty tiles, never an arbitrary epsilon (G872). Nine's L1 reads the actual returned simplifier error; other shards use the same storage and simplifier measurements. | **in flight (2026-10-30, sp-x1)**: scratch patch only until **16:45** (release window, no shared generator SDK edit). Six focused behavior cases, scoped SDK/shard types and typed lint pass on the draft. Nine NT4 `8b5c3d946d` geometry A/B: all 47 payloads / 96,368,792 B plus triangle/draw rows identical; L1 1.447–1.915 m, 18 rounded L0 rows 1.69–6.77 mm, 16 genuinely lossless L0 rows zero. Same empty external atlas on both sides; this is payload parity, no pixel claim. Publication and all-shard qualification remain open. | S |
| NT3 | **Height bands in the slab cut.** Each NF10 / EP6 chunk is at most 62.5 m tall as well as ≤ 4 MB, with a tight 3-D box. Small neighbouring bands merge so draws stay within the bar. **Overlap:** a rule inside NF10's bake. NT3 owns the rule and its test, not the slab writer. | No Nine chunk box taller than 62.5 m (parts reach 168 m, tiles 289 m today). An offline frustum census over the chunk boxes at the 27 cameras culls ≥ 15 % more triangles than quadrant-only chunks. Draws at P1–P5 within NF11's gate and ≤ 150. | **open, measured draft (2026-10-30, sp-x1)**: EP6 designer sp-o3 accepts draw priority: start one chunk per tile/key and split by quadrant then height only above 4 MB. This reduces 404 chunks to 96, with 56 box-visible at derived P4; 50 chunk boxes exceed 62.5 m (maximum 195 m), with original triangles intact. P4 culls 4.68 % more triangles than quadrant-only, below the 15 % bar; some poses regress slightly, stair-mid improves 59.85 %. Thus NT3's original height/culling bars are not met or waived. NF11 measures actual draws before any finer per-view split. Current catalogue is 24 cameras, not the audit's historical 27. | S |
| NT4 | **The far level: Nine's L1 spends the cell's budget where the city is.** Nine's coarse bake (`generators/scene.ts`, `COARSE_TRIANGLES` 9,000 per parent today) budgets the cell, not the tile: 16 parents × 10k = 160k triangles go to the parents that hold the city, with ≤ 8 draws each. It keeps every Nine channel, so EP12 / NF4's paint, eave bands and painted neon apply; signs and neon go in as emissive geometry. **Overlap:** EP12 owns the look of coarse copies; NT4 owns their geometry budget. DP4's coarse branch is superseded by NT1. | L1 / L0 triangles ≥ 15 % (today 2.1 %); L1 GPU ≤ 20 MB. A capture at cams 17 / 18 / 22 with the far level forced (a harness override, not a Debug row) against L0 at the same pose: mean pixel difference ≤ NF4's 10 per channel, with no missing tower in a silhouette diff. G844 before / after board. | Opus | M |
| NT5 | **The camera picks the level by screen error.** The refinement mask (`wholeRefinementCover` `rendered(tile)`, today ring membership) chooses per L0 tile between its slabs and its L1 quadrant by the projected `geometricError` at the camera eye: 3-D distance to the chunk box, the phone's 2x pixels, 1 px with 20 % hysteresis, MF13's fade on a switch. It ships behind one Developer Debug row, **Nine far level: off / screen error**, default off until the bars hold, then the row and the off path go (E451). | In-city cams 1–16, 19, 20 and 23–27 are pixel-identical to off. At cams 17 / 18 / 21 / 22, triangles drawn ≤ 60 % of off and work p50 below off at Chromium 4x and WebKit. No crack or pop in a 10 s aerial pan capture. No frame > 50 ms on a deck ↔ city jump. | Opus | M |
| NT6 | **A copy belongs to every tile its bounds touch.** Ranged placements and the per-copy resident filter (`worldScenePlacement.ts:179-184`, `tileContent.ts` `bucketByTile`) test each copy's bounds, not its origin. A tower or bridge whose origin is outside the ring but whose body is inside draws once. **Overlap:** moot for Nine once NT1 lands; matters for every ring shard. It goes with EP9's cluster culling. | A focused test: a 3-tile bridge whose origin is outside the ring draws while any tile it touches is resident. Pine and Driftwood census: no copy whose bounds touch the ring is missing. Draws unchanged ± 2. | Opus | S |
| NT7 | **The tiling check in the bake** (rules below). `build-shardfiles` prints one table per shard: tile census, caps per chunk and per cell, height, spanning parts, L1 / L0, zero errors and the sightline audit, plus a verdict line. It is report-only, like the memory gates. It fails only a regression on a pinned shard: Nine losing `ring: 'cell'`, or a chunk over the per-chunk cap after NF10. | On HEAD it prints this plan's tables A, B and D within 5 s for all shards. It flags Nine "hold the cell" (24 of 27 cams cut) and no other shard. A focused test pins the thresholds. | **done (2026-10-30, sp-x8)**: normal full 24-product build/reuse prints A/B/D and checks the unchanged all-product tile ratchet; all 24 report readers admitted at the measured boundary, report time 0.196 s total. Separate Nine-only ring/coordinate regression baseline plus 4 MB declared-chunk cap; source section/index bytes verified. Current Nine: 90.23 % top-five GPU share, 5 over-cap L0 tiles, 288.9 m tallest, L1/L0 17.36 %, 46 occupied zero-error rows reported for inspection (lossless zero legal), 9 spanning parts/max 34 tiles. Current tracked 24 declared cameras: 22 cut any in-view triangles, 3 exceed 20 %; with spawn/4 entries, 27/29 cut. Historical 24/27 is not forced. Only Nine gets the dense/vertical hold-cell recommendation; other sightline/thin/height warnings remain visible. 26 original/new build/guard controls, root/helper strict types and typed lint pass. No live-memory/pixel claim. Later Pine source-freshness refusal retained after the successful point-in-time 24-product read; no unchanged rebuild. | S |
| NT8 | **Stream by the camera, not the player.** `TileDriver` and `ControlRefinement` rank the wanted tiles by in-view first, then 3-D distance from the camera eye. The spawn-view fence (`SPAWN_VIEW_M` 221 m in x / z) becomes the spawn camera's frustum plus a 3-D radius. Moot for Nine (whole cell before the reveal); for any tall shard that streams. | A focused test: a high eye over a tile edge ranks the tiles it sees before those behind it. Pine / Driftwood reveal time not worse; no extra after-control attach in the spawn view. | **open; landed, partial** (sp-x9): `26138a5e13` + `4efb4ea3fd`; camera ranking and high-eye tests pass; player-first collider order retained. Phone qualification below fails the Pine reveal bar; attachment bar remains unproven. | S |

**NT8 phone qualification (2026-10-30).** Parent `79bca1916c`
(`79bca19-mvvcexon`) versus candidate `4efb4ea3fd`
(`4efb4ea-mvvd2l9a`), one pinned preview at a time. Chromium phone preset:
10x page CPU, 10 Mbps down / 2 Mbps up, 100 ms latency; CDP cannot throttle
worker CPU. Each cold / warm pair shares its browser context. Native control
witnesses qualify in all eight legs; these are single pairs, not steady-state
performance estimates. Intervening rendering commits prevent attributing
whole-reveal differences solely to NT8.

| Tap to native control (s) | Parent cold / warm | Candidate cold / warm | Delta cold / warm |
| --- | --- | --- | --- |
| Pine Hollow | 130.295 / 88.068 | 134.938 / 91.669 | +4.643 / +3.601 |
| Driftwood Isle | 51.634 / 36.520 | 51.177 / 35.625 | -0.456 / -0.895 |

Pine's Spawn detail stage rose 32.034 / 14.869 to 34.579 / 17.853 s.
The first spawn-detail fence runs before `game.stepFrame()` poses the camera;
the new camera reader can therefore use the initial origin view. This is a
source-ordering lead, not a measured causal attribution or a completed fix.

Read-only scene observers ran for 10 s from native control, without overflow.
Pine candidate cold / warm recorded 17 / 13 geometry or draw-range changes:
12 cabin meshes were outside the spawn frustum; the cold ground union rebuilt
after two off-frustum raw tiles, and the later knife mesh was hidden. Parent
had 5 / 1 changes. Driftwood parent had none; candidate had 9 / 9 draw-range
changes on existing boulder, seabed, palm, hibiscus and ground-cover meshes.
Their aggregate boxes intersect the spawn frustum, but the observer does not
locate the newly included triangles, so **no-extra-in-view-attachment is not
qualified**. Retain the events rather than treating union bounds as proof of
a new visible tile.

All legs retain local `/api/telemetry` 405 errors, so the complete CLI verdict
is not green. Candidate Pine cold / warm and Driftwood cold each additionally
retain one navigated-away response-body accounting failure; Driftwood warm
accounting is complete. No request guard was weakened. Raw phone JSON lives
under `tmp/phone-loading/2026-10-30T19-{11,17,25,31}-*`; attachment observations
and logs are in `tmp/sp-x9-nt8/`. All browsers and both owned previews closed.
Source checks: 61 focused streaming/refinement cases, 61 original platform
cases and 19 collider-priority cases pass; root types, scoped lint and ratchet
passed at their source boundaries. NT8 stays open for the first-camera fence,
Pine reveal bar and precise post-control attachment attribution.

**NT8 first-camera correction.** Locally committed `3d14d956e7` keeps the
player reference for the initial `prepareSpawnView` call only. The existing
shader step still poses the camera at the same point; final readiness and
controlled streaming use the real camera. A focused test with the player far
from the origin camera verifies that the first fence never samples the camera,
then the next fence uses its posed view. All 35 focused refinement, camera,
collider and finish-order cases pass (313 ms); game types and scoped lint pass.

One Pine cold / warm pair on pinned `3d14d95-mvvdsy9c` measured
**129.872 / 90.219 s**, versus parent **130.295 / 88.068 s**:
**-0.423 / +2.151 s**. Spawn detail returned to **31.978 / 15.020 s**,
versus parent **32.034 / 14.869 s**. The initial-camera defect is fixed,
but **the overall warm reveal bar remains unmet**. Other warm stage increases
include Region world +0.694 s, gameplay / saved state +0.377 s and world
program links +0.497 s; no causal explanation is inferred from one pair.
Both native control witnesses qualify. Cold retains one telemetry response-body
accounting loss and its 405; warm accounting is complete and retains two 405s.
The full CLI exits 1 with those retained errors.

Both 10-second observers complete without overflow (122 / 123 frames,
15 changes each): one hidden off-frustum ground tile and its aggregate rebuild,
12 off-frustum cabin draw-range changes, and one hidden knife mesh. Aggregate
triangle locations remain unmeasured, so this does not close the attachment
bar. Raw pair: `tmp/phone-loading/2026-10-30T19-45-27-989Z-3d14d95-mvvdsy9c/`;
observations: `tmp/sp-x9-nt8/posed-pine-attachments-{0,1}.json`.
Browser and preview closed. No extra pair or deadline change. Source and
results stay local during the coordinator's push hold.

**NT8 visible-first correction `9634ee80f0` (pushed).** The old horizontal
camera-cone rule deferred seen tiles for 3 s before NT8's 3-D ranking could
consider them. Supplying both camera ports in the high-eye behavior test
reproduced an off-view attach with the visible tile blocked. Full camera
ranking now takes precedence; camera-less callers retain the old rule,
and collider priority/membership are unchanged. All 31 streaming/refinement
controls, game types and scoped lint pass.

Second corrected Pine pair, `9634ee8-mvvec1k4`: **129.962 / 90.486 s**
cold / warm, versus the earlier corrected pair **129.872 / 90.219 s**.
Warm remains above the earlier parent's 88.068 s. This repeats the difference
but does not isolate NT8 from intervening rendering changes or host drift.
Spawn detail is 31.916 / 15.169 s; both native controls qualify. Telemetry
405s and one navigated-away response accounting gap per leg remain visible.

**Withdrawn triangle attribution:** the first refined observer compared triangle multisets from prior geometry/draw
ranges to their successors and clips additions against all six spawn-frustum
planes. Ground unions compare against the prior union members, including
replaced mesh identities. In each leg, **10,722 added triangles from visible
world meshes, zero intersecting the spawn frustum**; hidden source tiles and
knife are recorded separately. Each full 10 s observation completes without
overflow or unsupported geometry (99 / 107 sampled frames). This closes the
Pine geometric attachment ambiguity only provisionally; that claim is withdrawn
because the observer retained a live mutable index buffer (correction below).
Raw pair: `tmp/phone-loading/2026-10-30T20-00-40-070Z-9634ee8-mvvec1k4/`;
exact additions: `tmp/sp-x9-nt8/visible2-pine-attachments-{0,1}.json`.
An earlier wrong-port launch hit `db9f363-mvve9bzo`, was interrupted before
control and is explicitly excluded (`visible-pine.log`). NT8 remains open
for warm timing attribution and Driftwood's precise attachment check.

**Observer correction:** `tiledMesh` compacts its index buffer in place. Keeping
the prior geometry reference did not preserve its prior triangle order. The
reported Pine zero / Driftwood 122 in-frustum triangle counts are both invalid
and are not qualification evidence. The corrected observer copies index bytes;
two scratch behavior controls prove an inserted off-view tile does not falsely
count an old visible triangle moved in the compacted index, while an actual
new visible triangle is detected. Original raw observations remain retained;
cause-directed attachment reads on the same source follow. The independent
dual-camera ordering regression test and source fix remain valid.

**Corrected attachment qualification (copied index bytes).** On unchanged
`9634ee8-mvveu99q`, Driftwood cold / warm each adds 6,361 world triangles,
**zero inside the captured spawn frustum**. Full 10 s intervals: 123 / 131
frames, 14 changes each, no overflow or unsupported geometry. Pine cold / warm
each adds 10,722 visible-world triangles, **zero inside that frustum**;
105 / 103 frames, 17 changes each, no overflow or unsupported geometry.
Hidden source tiles / knife remain separately recorded. Position access is
checked for retained finite CPU data. These replace the withdrawn live-index
counts. Scratch controls reproduce index compaction and a real visible addition.
Raw: `tmp/sp-x9-nt8/indexcopy-{driftwood,pine}-attachments-{0,1}.json`.
The warm Pine CPU sampler is attribution only, not an uninstrumented timing leg.

Reverse-order parent `79bca19-mvvem0ac` measured **131.136 / 88.943 s**,
native control qualified and request accounting complete (telemetry 405s stay).
The unprofiled candidate's **129.962 / 90.486 s** is -1.174 / +1.543 s
against that reference, so the warm gap cannot be dismissed as noise. The
source-mapped warm page CPU sample, including 10 s after control, attributes
14.36 ms inclusive / 4.94 ms self to `streamingView`, 209.86 / 48.66 ms
to `tileDriver`, and 139.22 / 9.16 ms to `controlRefinement`. This does not
attribute the remaining multi-source wall-time gap to NT8. Raw profile/rank:
`tmp/sp-x9-nt8/indexcopy-pine-warm.cpuprofile` and `warm-profile-rank.json`.

A same-source camera/player fallback counterfactual is pending; its first
launch failed the class-readiness prerequisite and is excluded, and the next
was stopped for the higher-priority G925 commit-snapshot CI repair. A tiny
preflight now verifies the lazy pure camera declaration initializer before
patching that measurement-only port. Neither launch qualifies the timing bar.
All browsers and the owned preview were closed at the P0 boundary. NT8's
geometric attachment bar is now qualified; warm timing attribution remains open.

NT7 preserves the existing all-product `checkTileBake` ratchet exactly (G872 ruling). Its new report is advisory; its separate Nine baseline refuses a lost `ring: 'cell'`, worsened exact L0 coordinate debt, or a declared slab chunk above 4 MB. Uncut long-triangle heights remain explicit advisory exceptions for NT3, never disguised as zero or trimmed geometry. Products without declared slab metadata print **not declared** for max chunk, rather than claiming zero. Published NF10 slab rows are read only after the defining section schema admits them. Recommendations distinguish dense vertical concentration (> 80 % in five tiles and > 125 m tall) from small, spread-out or open-sky sightline warnings; every measured warning is printed. The current declared-camera catalogue hash is `359156f0cfabb3c4915ec46217daaa85a2aaeaf57d74db48e3db303c927029f4`.

**Order.**
1. NT1 now: it is a one-line class of bug with the largest visible effect, and it makes NF1 true.
2. NT2 and NT7 now, in parallel (bake, no look change).
3. NT3 inside NF10 / EP6 as they land.
4. NT4 then NT5, after NT2. G943 runs the batch stage now, and NT5's measurement decides whether it flips on.
5. NT6 and NT8 when a lane is free.

**Plan done when:** NT1's bars hold on HEAD. Every occupied tile row states its error. The tiling check runs in every
build. At cams 17 / 18 / 21 / 22 SHARDFILE draws the whole city with legacy's look and a frame cost below legacy's
(G937), on Chromium 4x, WebKit and the Simulator. Jake's single phone check (G942) covers it.

## General rules for dense or vertical shards

1. **Hold by memory, not by area.** Hold the whole cell (`ring: 'cell'`) when two things are true: the whole L0 is at
   most ~10 % of the per-shard cap (≤ 120 MB), and the content is seen from the cell's edges. Stream by ring only when
   content is spread out and hidden from far away.
2. **Every driver obeys the product.** A tile radius is never a default the caller can forget (NT1).
3. **Tiles are bake units.** After the bake, no chunk is over 4 MB, 62.5 m tall or 8 draws. Content over that is cut at
   bake, never joined at run time (NF10–NF12).
4. **Every level states its error, and the camera picks by it** (NT2, NT5). No level is picked by the player's x / z
   ring.
5. **The far level carries the full look:** paint passes, signs, neon and silhouettes (EP12, NT4). No grey slabs (G576).
6. **Spanning things belong to their bounds** (NT6). Streaming order follows the camera (NT8).

**The bake check (NT7).** It prints per shard and flags, without failing:

| Check | Threshold | Nine today | Other shards today |
|---|---|---|---|
| Tile over a per-tile cap | > 4 MB, > 40k triangles or > 8 draws | 5 tiles | 0 |
| Content concentration | top 5 tiles > 80 % of L0 bytes | 90 % | Driftwood 83 % (5 MB, so fine), others ≤ 50 % |
| Tall tile | height > 2 × 62.5 m | 289 m | ≤ 74 m |
| Spanning part | one part over > 4 tiles | 22 fabric parts, up to 49 tiles | to be listed |
| Thin far level | L1 / L0 triangles < 5 % | 2.1 % | Far Reach 1.5 % (open sky, ring cell) |
| Missing error | occupied row with `geometricError` 0 | all | all |
| Sightline audit | from spawn, entries and declared cameras, > 20 % of in-view triangles outside the device ring | 24 of 27 cameras, up to 100 % | to be listed |

The verdict line recommends one of three things:
- hold the cell, when the sightlines fail and L0 is ≤ 120 MB;
- re-cut, when caps fail after chunking;
- re-budget L1, when the far level is thin and seen.

## Questions for Jake (the grill)

1. **For Nine, should a tile stop being a unit of loading?** The whole city stays in memory (82 MB of 1.2 GB). Its
   tiles become a near level and a far level, and the camera picks between them by what it sees.
   - Skip for now
   - **Yes: hold the whole cell, pick the level by screen size** *(recommended: the ring holds 97–99 % of the city
     from inside it and cuts 69–100 % of the view from the decks and aerials; NT1 makes NF1's hold real)*
   - No: keep streaming Nine by rings
2. **Should Nine's far level spend the cell's budget where the city is?** That is about 15–20 % of the city's
   triangles instead of 2 %, about +15–20 MB of GPU, with the full paint.
   - Skip for now
   - **Yes, build it now with the batch stage (G943); it switches on only where it beats L0** *(recommended: the decks
     see the city at 19–28 cm a pixel, and the grid neighbours see the same level)*
   - Only repaint the 2 % copy (EP12) and keep L0 at the decks
3. **Should the tiling check block builds or only report?**
   - Skip for now
   - **Report in every build; block only a regression on Nine** *(recommended: the memory gates are report-only until
     SHARD-PLATFORM closes, and Nine is the only shard over any cap)*
   - Block any shard over the caps

# Generic 62.5 m tile streaming: mini plan (draft for G6xx; read at HEAD 1c1dd3ab92, 2026-10-22)

Jake, 2026-10-22 ~23:45 Cancun: *"the tiling and the streaming and the 62.5 meter grids … the only way of fixing the
memory problem … generically implemented in the engine … 62.5 meters plus the neighbors, so 3x3 … Can we make the road
62.5 meters? … keep just tiles of shards in memory and evict everything else … it's also going to fix the loading problem"*.

Code read only. Nothing built or run.

## 1. What exists today

**The tile lattice already exists, but only for drawing, and mostly only for neighbours.**

- **Format.** `tiles` rows are L0 62.5 m or L1 125 m with integer x/z 0–7 (`format/wireLimits.ts` `WIRE_TILE_SIZES`,
  `CONTENT_CAPS.l0` 4 MB resident / 0.3 MB wire / 40k tris / 8 draws, `l1` 2 MB). The SDK bake clips render triangles at
  62.5 m (L0), simplifies and clips at 125 m (L1), and makes a one-draw far proxy (docs/SHARDFILE.md §bake). Collision
  can be clipped to the same lattice (`sdk/bake/worldCollision.ts`, WMC1, SF55a), but runtime use is still pending.
- **What the shards actually ship differs a lot** (correction to the brief's "every shard has 8 × 8"):
  - Sunscar: 64 L0 + 16 L1 (10 MB).
  - Driftwood: **17 L0 props tiles and no L1.** That is 27 MB decoded + GPU; 47 of its 64 tiles are open sea. Tile 6/4
    is 3.98 MB, which is at the cap, and four tiles exceed the 0.3 MB wire cap.
  - Sky Reach: 11 L0.
  - Hybrid terrain shards (Pine, Nalati): 64 L0 + 16 L1 terrain tiles bound by their runtime (`runtimeWorld.ts`).
- **Two residency implementations already stream these tiles. They are near-duplicates.**
  - `game/grid/rings.ts` (`RenderRings`, SF18b) streams every *neighbour* cell:
    - far proxy → L1 to 400 m → L0 to 150 m, plus speed-based lookahead;
    - parent-first, with no holes (coarse quadrant masks);
    - one `ResidencyAllocator` lease per tile;
    - uploads budgeted per frame;
    - an evictable cache with hysteresis.
  - `game/shardfile/clientWorld.ts` + `residency.ts` streams the *entered* data or terrain shard. Its 16 L1 tiles stay
    resident. L0 tiles live inside a 150 m disc (80 m casts shadows), one child `Scope` per tile, leased and disposed with
    it. Both SHARD SELECT (`shardfile/client.ts:250`) and grid regions (`grid/regionalWorld.ts:164`) use it.
- **What does not stream: the entered runtime world, which is where the memory is.**
  - Driftwood, Nalati, Pine and Nine build their world whole from their client plan: `world.scenes` placements (each row
    is a whole-shard `poses[]`, up to 8,192), welds/merged geometry, `world.baked` Blender tile sets (`installBakedTiles`
    draws every tile node of one GLB at once), creatures, quest figures, ground cover and colliders (2,102 on the
    Driftwood home, H4).
  - Driftwood's own L0 tiles are "bound whole geometry belonging to the entered runtime" (`productCost.ts:367`).
  - Entering Driftwood adds about 300 MB: road 450 → entry 740 MB WC + GL (dw-g258-2026-10-15). Its runtime claim is
    284–305 MB and its GL 196 MB (SF57).
- **Crossings.** `live.ts:194` keeps up to 4 whole live worlds: the source's 5 s cold dwell, the warm build-ahead
  (`warmAhead`, G580 T1) and anything inside the readiness radius. That is the "two full shards nuke it" case. On top of
  it, the O18 leak (≈120 MB ArrayBuffer + 50 MB heap per round trip) stays after every retirement.
- **G607 (render-everything) is already this model for neighbours.** Every cell draws its far proxy, or a near
  placeholder (merged content, `PHONE_NEAR_CELLS` = 4 on the phone). The rings refine to L1 and L0 only near the player.
- **G626 / H3 has started.** `shardfile/tileOrder.ts` (70b87ccb4b) ranks a cell's 64 tiles. Rank 0 is the spawn tile,
  its ring and every entryway's tiles: 12 on Driftwood. The rest go nearest first. sp-o1 owns H3.

**What in a shard is not tile-local, and how it behaves under streaming**

| Part | Today | Under tiles |
|---|---|---|
| Sim, scripts (wasm), state, quests, ledger, hooks | whole region | always resident (small: sim ≤ 25 MB by cap) |
| Terrain heightfield collider (257²), edges, 4 entryways | whole | always resident; entries always built (G626) |
| Sky, look, LUT, fog, sea/water bodies | page / region | always resident (one per page, swap on enter) |
| Library (shared models, materials, textures ≤ 25 MB) | whole | ref-counted by resident tiles; programs kept by look (T2 of crossing plan) |
| L0/L1 render tiles, props tiles | streamed (neighbours) / whole (runtime) | per tile |
| World-scene placements, welds, Blender baked sets, ground cover | whole | per tile (bucketed by pose / triangle centroid) |
| Static colliders (registry pieces) | whole | per tile (the registry is already scope-owned) |
| Creature / NPC presentation (rigs, coats) | whole | per tile; brains stay shard-global, dormant outside the full ring |
| Navmesh | tiled layers (`tileSize`) | per tile |
| Audio buffers (Pine SFX 30.7 MB) | whole | index always resident; buffers by proximity (later row) |
| Shader programs | per world | kept per look and family, so they never multiply per tile |

## 2. The 62.5 m lattice

**If the gap became 62.5 m:**

- The pitch becomes 562.5 = 9 × 62.5. Every tile edge in the world sits on a multiple of 62.5, and each cell centre is a
  tile corner.
- Every road segment becomes one tile wide (8 tiles long), and every junction is exactly one tile. The 31 m roundabout
  fits.
- The road keeps 15 m of asphalt. The side strips grow from 20 m to 23.75 m.
- **What changes:**
  - Constants: `CONTENT_CAPS.pitch` and `GAP_HALF`, plus `555` in `engine/sim/strips.ts` (4) and 277.5 in 21 files.
  - Seam strip geometry (`SEAM_OFFSETS`, the G90 gradient lattice) and its certification.
  - The `roadLook` junction canvas (55 → 62.5 m) and the rail box.
  - Road residency, far-proxy and near-view placement, the minimap blend and the grid map, sign distances.
  - Grid positions saved in world metres (to verify).
  - About 100 test, proof and parity files that hold 555: frame-floor-grid poses, Nine runtime-owner proofs, the
    steam-trailer shots.
  - The shipped hero camera (G625 retake: same camera, but the cells move 7.5 m each).
- **What does not change:** shard internals (500 m, 8 × 8, entries at edge midpoints, edge profiles), bakes, products.
- **Cost:** ~2 lane-days plus re-recording the grid proofs and baselines. **Risk:** seam certification and hero framing.
  **Benefit for memory or loading: ≈ 0.** The whole grid's road is ~25 MB (deck 17.7, junctions 5.6), and a junction
  already fits in one tile.
- **Alternative (recommended):** keep the 55 m gap. The streamer takes rectangular tiles of any size: road-segment tiles
  of 55 × 62.5 (8 per segment) and junction tiles of 55 × 55, as their own tile types in the same residency. This costs
  0.5 d, inside T2.

## 3. Streaming model

- **Full detail (render L0 + placements + creatures):** 5 × 5 tiles around the player's tile (312.5 m, ≥ 125 m margin).
  Physics colliders and creature sim run on 3 × 3 (187.5 m), with the soft walls (`readinessWalls`) holding anything not
  ready.
- **Coarse beyond:**
  - The rest of the cell stays on its L1 tiles, or its near placeholder (the merged content GLB) where it has no L1.
  - Other cells use their far proxy or near view, unchanged (G607: every cell stays visible).
  - Speed lookahead stays (`readinessSeconds` 4 s × hover speed).
- **Evicted:** everything else, with real disposal. Each tile owns one `Scope`, which disposes its geometry, instance
  ranges, textures, colliders, creature views and allocator lease. A per-tile ghost counter (a FinalizationRegistry,
  memory-strip M6) proves the memory is freed.
- **Budgets:**
  - One tile ≤ `CONTENT_CAPS.l0` (4 MB resident). 25 full tiles ≈ ≤ 100 MB per region, plus the always-resident state.
  - At most 1 tile and 4 MB uploaded per frame. Builds are sliced at `WORK_SLICE_MS` (12 ms).
  - Instanced placements stay in one `InstancedMesh` per model per region, with each tile owning a range. This keeps the
    draw count from multiplying.
- **SHARD SELECT and the grid share one streamer.** Both already go through `clientWorld` and `regionalWorld`. A single
  shard is one region with an empty neighbour ring.
- **Loading:** only the shard-global state and the rank-0 tiles (`tileOrder`) are built before controls. Driftwood has 12
  of them. The rest streams nearest first (G622 D3, G626).
- **Memory on a crossing:** the neighbour's region is admitted as small state at the road (sim, collider, entries). Its
  tiles stream in by distance, and the source's tiles evict behind the player. The page never holds two whole worlds.
  The 4-whole-world cap and the whole-world `warmAhead` go.
- **Frame:** G622 D4, no frame over 100 ms after controls, measured on the stream.
- **Honest caveat:** the engine base (~300 MB), page components (~320 MB) and the shard-global state stay. The share that
  is tile-local is unmeasured; T0 measures it first.

## 4. Rows

| Row | What | Code | Lane | Size | Done when (measured) | Deps |
|---|---|---|---|---|---|---|
| T0 | Census: each shard's entered world split into tile-local and shard-global MB (DW, Nalati, Pine, Nine, Sky) | glbytes census + allocator claims | Codex | 0.5 d | table in the commit message; sets the expected saving | — |
| T1 | Leak-free disposal: finish O18 (sp-o3); ghost counter per tile and region scope | `grid/live.ts`, new `grid/ghosts.ts` | Codex | 1 d (+ sp-o3) | 20 tile load/evict cycles and 5 DW→Sky→DW round trips each return to baseline ±20 MB; ghosts 0 | sp-o3 |
| T2 | Engine tile residency host (`engine/world/tileResidency`): rect tiles of any size, N×N full ring + coarse ring, parent-first, no holes, hysteresis, per-frame bytes and ms budget, scope + lease per tile. `rings.ts` and `clientWorld.ts` become users (net deletion); road and junction tile types | `game/grid/rings.ts`, `shardfile/clientWorld.ts`, `residency.ts` | Codex | 2 d | host-bar six tests; Node 1 km drive: resident ≤ 25 + ring, 0 hole frames; same trace as today at 150 m | — |
| T3 | Per-tile content: placements bucketed by pose (no rebake) into per-model instance ranges; welds / merged / baked sets by triangle centroid; registry colliders per tile scope | `worldScenes.ts`, `worldScenePlacement.ts`, `bakedTiles.ts`, `sdk/bake/worldGlb.ts` | Codex + Opus | 3 d | DW draw count ±10 % of today at the same pose; no visual diff in the 5 × 5 | T2 |
| T4 | The entered world streams (H3 generalised, joined with sp-o1): shard-global state + rank-0 tiles before controls, the rest via T2; SHARD SELECT and grid | `grid/liveSession.ts` `enterInitialHome`, `shardfile/client.ts` | Opus | 2 d | DW SHARD SELECT + grid: tap → controls −30 % vs M1; worst frame ≤ 100 ms | T2, T3 |
| T5 | Debug row "Tile residency: 3 × 3 / 5 × 5 / whole shard" (A/B/C, E451) and a Developer overlay (tile borders, resident colour, MB per tile) | Settings Debug, minimap | Opus | 0.5 d | Jake can feel it on Driftwood (first playable slice: T2 + T3 (DW only) + T4 + T5) | T4 |
| T6 | Creatures, NPCs and figures by tile: presentation in resident tiles; brains global, dormant outside 5 × 5; patrols that cross tiles hand over | population, quest figures | Codex | 1.5 d | DW boar / captain fights unchanged; memory drops by its T0 share | T3 |
| T7 | Crossings by tiles: neighbour region = small state; tiles by distance; the source evicts behind the player; delete whole-world `warmAhead` and the 4-world cap | `grid/live.ts`, `liveSession.ts`, `hybrid.ts` | Opus + Codex | 2.5 d | DW↔Sky ×5 on Chromium phone tier: peak ≤ 1.2 GB per shard, back to baseline ±20 MB, crossing < 5 s, worst frame ≤ 100 ms | T1, T4, T6 |
| T8 | Every shard on tiles (Nalati, Pine, Nine, Sky, Sunscar, open plots, template): bake checks, the four over-cap DW tiles split | shard generators | Codex | 3 d | grid-ready latches hold; 5 × 5 census per shard | T3 |
| T9 | Lattice: B (keep 55 m, road tile types: in T2) or A (62.5 m gap, pitch 562.5, seams, junction canvas, proofs re-recorded) | strips, roadLook, roadLayout, config | Codex | 0 / 2 d | per D1 | T2 |
| T10 | Milestone: M1 Simulator recording + soak; delete the whole-shard path when Jake picks; Jake's iPhone check (G558) | — | coordinator | — | Sim < 5 s warm / < 15 s cold; Jake's word | all |

Order: T0 + T1 + T2 at once → T3 (DW) + T4 + T5 = **the first playable slice on Driftwood (SHARD SELECT, then the grid
home)** → T6, T7 (the memory fix on crossings) → T8 → T9 → T10.

## 5. Decisions for Jake (option 1 is always Skip)

- **D1 · Lattice.**
  - Skip.
  - **A, recommended:** keep the 55 m gap. Road and junction strips become their own tile types (55 × 62.5, 55 × 55).
    The memory is in the shards; the road is ~25 MB.
  - B: change to a 62.5 m gap now (pitch 562.5; ~2 lane-days; every grid proof and the hero camera re-recorded).
  - C: B, but after crossings by tiles land.
- **D2 · Ring size.**
  - Skip.
  - A: 3 × 3 for everything (pop-in from 62.5 m).
  - **B, recommended:** 5 × 5 at full detail, colliders and creature sim on 3 × 3, L1 / near view beyond. All three ship
    as a Debug A/B/C row so he can feel them.
  - C: today's 150 m disc.
- **D3 · What stays whole-shard.**
  - Skip.
  - **A, recommended:** sim, scripts, quests, ledger, the terrain collider, the entries and edges, sky, look, sea and
    water, the map, the audio index. Everything drawn or collidable goes by tile, and creature brains stay global.
  - B: as A, and creature brains also per tile.
  - C: as A, and audio buffers also per tile.
- **D4 · First shard.**
  - Skip.
  - **A, recommended:** Driftwood in SHARD SELECT, then DW↔Sky on the grid. He named it, and it shows the crossing win.
  - B: Nalati, the biggest saving.
  - C: the template or open plots, which are already tile-native.
- **D5 · Legacy and proofs.**
  - Skip.
  - **A, recommended:** "whole shard" stays only as the Debug option until he picks, then it is deleted. The whole-world
    build-ahead (G580 T1) is deleted when T7 lands. Grid-ready, frame-floor and memory baselines are re-recorded at the
    milestone. The `*-legacy` shards are untouched.
  - B: keep the whole-world path for the shards he hasn't tried.

## 6. Estimate

About 16 lane-days, plus ~2 for B on D1. With 1 Opus + 2 Codex that is **~6–8 calendar days**. The **first playable
Driftwood slice (T0–T5) is ~3 days**. The memory fix on crossings (T7) is ~day 5–6. The saving is unproven until T0: if
~60 % of a world is tile-local, a 5 × 5 window keeps 40–60 % of the island and 25 of 64 tiles on a dense shard, and a
crossing stops holding 2–4 whole worlds (an estimated 300–600 MB off the peak).

## Uniform tile grid (Jake, 2026-10-23, G638 follow-up)

Jake asked how shards can have 17 or 64 + 16 tiles if everything is one grid. The grid is the same everywhere (8 × 8 L0
of 62.5 m + 4 × 4 L1 of 125 m over the same 500 m); today a shard ships files only for occupied squares, Driftwood never
baked L1, and Pine/Nalati draw their terrain tiles with their own code. Rows added:

| Row | What | Done when |
|---|---|---|
| U1 | Every shard bakes all 64 L0 squares (empty sea / sky squares as near-empty tiles) | the census shows 64 L0 per shard |
| U2 | Every shard bakes all 16 L1 squares (Driftwood and Sky first) | 16 L1 per shard |
| U3 | Pine and Nalati terrain tiles go through the one shared streamer (T2), not shard code | no shard-owned tile drawing left |

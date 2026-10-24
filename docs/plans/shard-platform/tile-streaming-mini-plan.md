# Generic 62.5 m tile streaming: mini plan (draft for G6xx; read at HEAD 1c1dd3ab92, 2026-10-22)

Jake, 2026-10-22 ~23:45 Cancun: *"the tiling and the streaming and the 62.5 meter grids … the only way of fixing the
memory problem … generically implemented in the engine … 62.5 meters plus the neighbors, so 3x3 … Can we make the road
62.5 meters? … keep just tiles of shards in memory and evict everything else … it's also going to fix the loading problem"*.

The opening trace below is historical (2026-10-22); later decisions and source rows follow it.

## T0 census baseline (2026-10-24, sp-x8)

T0 is **in flight**. The five original entered-world receipts from
`7434c9f366` were rechecked offline; no new browser, build or measurement was run.
They all name app `ffa26b824a94cd9af8fbfd94b1968ec0b087bf1e`, Chromium iPhone 16 Pro,
phone tier, 4x CPU and 2x render scale. These are historical capacities, **not current main**.
The [exact-byte rollup](../../../progress/shard-platform/tile-streaming/t0-ffa26-baseline.json)
records each receipt's SHA-256, build stamp, node coverage and classification limits.

Observed GPU MiB, identity-deduplicated and reconciled to every observed context:

| Shard | Total | Engine | Known global | Single-node buffers | Shared | Unknown |
|---|---:|---:|---:|---:|---:|---:|
| Driftwood | 181.05 | 78.98 | 24.70 | 27.60 | 24.16 | 25.60 |
| Nalati | 230.02 | 73.46 | 0.00 | 48.52 | 87.99 | 20.04 |
| Pine | 281.90 | 78.72 | 0.00 | 35.66 | 129.57 | 37.95 |
| Nine | 278.78 | 67.73 | 0.00 | 122.29 | 66.93 | 21.83 |
| Sky | 161.83 | 67.94 | 0.00 | 12.86 | 54.15 | 26.88 |

Known global preserves the original Driftwood ocean/seabed and horizon policy. A zero
means no owner was classified there; it does not establish that a shard has no global
resources. Driftwood/Nalati still have 65/57 unlabelled GL resources. Shared includes
textures and buffers referenced by multiple scene nodes. A single scene node may span
the whole shard, and caches may retain its source after its tile retires.

Tracked RAM capacities, **separate from GPU and allocator claims**, in MiB:

| Shard | Total RAM | ArrayBuffers | Audio | Wasm | Images / bitmaps / canvases | Allocator claims |
|---|---:|---:|---:|---:|---:|---:|
| Driftwood | 162.08 | 51.62 | 83.15 | 5.38 | 21.95 | 318.44 |
| Nalati | 301.23 | 71.32 | 140.08 | 27.75 | 62.08 | 244.29 |
| Pine | 318.68 | 186.87 | 108.32 | 13.13 | 10.35 | 226.43 |
| Nine | 161.20 | 46.77 | 87.14 | 1.69 | 25.60 | 402.66 |
| Sky | 99.21 | 67.57 | 0.00 | 2.44 | 29.20 | unavailable |

All ledger identities and per-domain totals reconcile; all scene buffer references
resolve to an observed GL allocation. The receipts contain no join from RAM backing
identities to scene nodes, no geometry tile footprints and no last-consumer/cache
retirement proof. Empty node buffer lists are not evidence of zero geometry: they
include never-uploaded or otherwise unlinked attributes.

**Historical baseline gap (closed by the current census below):** capture those
identity/footprint links before claiming tile-local RAM or an expected saving. No positive retirement saving is established by this table;
neither the 39/64 area fraction nor a GPU capacity can be substituted for one. The plan's
whole-shard terrain, simulation, audio and shared-library policies still constrain what
can retire. Keep the unknown column until the missing links are observed.

## 1. What exists today

### T0 fixed-source census on `5137a05e63` (2026-10-24)

One pinned preview and five sequential standalone entered-world censuses, Chromium
iPhone 16 Pro, phone / 4x CPU / 2x render scale, visiting every authored standing pose.
All pages reported zero errors. All GPU totals, RAM-ledger totals and scene backing
identities reconcile. The tables below are the pre-implementation cost model; raw
receipts remain in `tmp/sp-x8-t0/current/`. This is a source pin, not a claim about
a later main tip. No new proof artifact is committed under `progress/`.

| Shard | Observed GPU MiB | RAM ledger capacity MiB | Scene geometry backing MiB | Single-node / shared backing MiB | Nodes with existing bounds / all nodes |
|---|---:|---:|---:|---:|---:|
| Driftwood | 166.21 | 213.17 | 41.74 | 36.38 / 5.36 | 111 / 353 |
| Nalati | 213.39 | 480.88 | 40.84 | 39.53 / 1.31 | 68 / 329 |
| Pine | 249.19 | 286.81 | 78.57 | 68.89 / 9.67 | 217 / 859 |
| Nine | 268.48 | 164.76 | 44.41 | 34.03 / 10.38 | 42 / 598 |
| Sky | 147.51 | 87.25 | 20.22 | 14.68 / 5.53 | 16 / 544 |

These columns **must not be added**. Scene backing may overlap the RAM ledger;
ledger capacity includes weak targets not yet collected. Neither is native resident
RAM. GPU unknown bytes remain 15.37 / 33.88 / 45.40 / 20.71 / 27.03 MiB respectively;
unlabelled resources are 52 / 104 / 212 / 0 / 0. The GL attribution gate remains red
for the first three shards. No historical-to-current gain is attributed to a slice.

The first reader used separate browser evaluations. Pine exposed four scene GL ids
absent from its earlier GL sample. That receipt is refused, retained at
`tmp/sp-x8-t0/current/pine.json`, and excluded from this report. Reader `9574d3ab83`
captures GL, scene and ledger in one synchronous job; its queued-frame regression
and six related cases pass, as do root/scripts types and typed lint. Only Pine was
replaced, on the same app source pin (a separate build stamp). The other four
receipts have complete identity links but are not claimed to be atomic frame reads.
No performance cohort or retry of a frame-floor measurement was run.

Footprints use **only existing** non-instanced, non-skinned, non-morph affine bounds.
No box, pose or geometry is computed or mutated by the reader. A backing shared by
several nodes uses the union of all their footprints; offset views count their full
backing once. Unknown bounds stay unknown. Capacities in MiB:

| Shard | Bounded inside the cell | Unknown bounds | Camera / outside cell | Current bounded backing outside a 5x5 window, min–max |
|---|---:|---:|---:|---:|
| Driftwood | 19.51 | 20.26 | 1.96 | 0.01–2.69 |
| Nalati | 12.42 | 17.54 | 10.88 | 1.93–6.77 |
| Pine | 13.56 | 61.25 | 3.76 | 0.87–7.19 |
| Nine | 23.11 | 13.23 | 8.07 | 0.00–0.00 |
| Sky | 2.37 | 17.08 | 0.77 | 0.00–0.62 |

The last column enumerates all 16 interior 5x5 windows of the 8x8 cell, counting
only whole backings whose every known scene use lies outside that window. It is
**scene exclusion, not a RAM saving**: off-scene caches and other consumers may keep
the allocation alive. Nine's bounded whole backings intersect every such window,
despite 120.70 MiB of single-node GPU buffers. Repartitioning is necessary there;
neither a single node nor the uniform 39/64 area fraction proves a removable buffer.

The lifetime gap is real policy, not just a missing number: `AssetService.release`
keeps retained entries at zero refs (`engine/app/assets.ts`); the residency bridge
maps observed consumers to a covering runtime and automatic unused eviction waits
for retirement with no remaining users (`grid/assetResidency.ts`). Idle reusable
caches have a separate pressure-eviction path. A scene-only footprint cannot prove
which path owns its final reference.

**T0 done (pre-implementation census / cost model):** the current tables establish
per-shard CPU/GPU capacity, known bounded outside-5x5 ranges and explicit unknowns,
including Pine's 61.25 MiB and instanced/skinned/morph geometry. Expected retired
RAM/GPU bytes are not measured savings. T1/T3 own the actual tile-last-consumer
retirement proof, including cache consumers and unknown footprints. All census
browsers and the owned preview are closed; no Sim was used.

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
| T0 | Census: each shard's entered world split into tile-local and shard-global MB (DW, Nalati, Pine, Nine, Sky) | glbytes census + allocator claims | Codex | 0.5 d | done (2026-10-24, sp-x8): pre-implementation cost model above; CPU backing DW/N/P/Nine/Sky 41.74/40.84/78.57/44.41/20.22 MiB; bounded outside-5x5 0.01–2.69/1.93–6.77/0.87–7.19/0–0/0–0.62 MiB; unknowns retained; retirement proof T1/T3 | — |
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
| T11 | Far landmarks survive the ring: authored landmarks beyond the N×N ring (Pine crag spires, waterfall) draw a coarse stand-in from their LOD / impostor in the coarse ring, evicted only at its edge (found by sp-o1 at 5 × 5, 10-23) | tile residency, landmark LODs | Opus sp-o1 | 0.5–1 d | Pine spawn view at 5 × 5 shows the spires and waterfall | T2 |

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

## One streamer, Pine and Nalati on it (2026-10-23, replaces T2's text and U3)

Traced at HEAD f81d5aade9 (full write-up below). **Correction:** Pine has **no terrain tiles** — its ground is the engine's whole `Terrain` (one 257² mesh, 4 splat layers), all 2,600 trees, ground cover, buildings and props are built whole on entry and stay loaded; its 26 L0 tiles are timber props only the grid draws. Nalati's painted ground is one mesh; its 64 L0 ground tiles sit behind an off-by-default Debug row. The four streaming modules: `grid/rings.ts` (full scheduler, neighbours only), `shardfile/clientRings.ts`, `shardfile/clientWorld.ts` + `residency.ts` (entered shard; copy-paste of reads, masks, distance; dead `rings` branch); `clientResidency.ts` is the home budget claim, not streaming. Terrain + Forest are also built twice (`bootstrap.ts:81-97`, `regionalWorld.ts:278-293`).

| Row | What | Lane | Size |
|---|---|---|---|
| S1 | `engine/world/tileStreamer.ts` from RenderRings, with road/junction tile types; host-bar tests; same trace as today at 150 m, no hole frames | Codex | 2 d |
| S2 | One tile-content module; SHARD SELECT, grid region and neighbours all on S1; delete clientWorld, residency, the dead branch, rings.ts (≥ 200 lines gone, worst frame ≤ 100 ms) | Codex | 1 d |
| S3 | Road tiles on the 62.5 m lattice (after T9) | Codex | 0.5 d |
| S4 | Delete `runtimeWorld.ts` with sunscar-dunes-legacy (on legacy deletion) | — | — |
| P1 | Pine: bake 64 L0 + 16 L1 ground tiles from its heightfield + splat; boreal look as a material row on `clientSplatTerrain`; canopy a per-tile channel; collider shard-wide | Opus | 1.5 d |
| P2 | One ground path: no whole `Terrain` build for a tiled shard in bootstrap or regionalWorld | Opus | 1 d |
| P3 | Pine trees as per-tile instance ranges, colliders in the tile scope | Opus | 1.5 d |
| P4 | Pine ground cover per tile | Codex | 0.5 d |
| P5 | Pine buildings and props per tile (logic, doors, saves, lanterns shard-wide) | Codex + Opus | 1.5 d |
| N1 | Nalati (after its zero): painted ground on the streamer + 16 L1 tiles; delete the one-mesh path and the groundTiles row | Opus | 1 d |
| N2 | Nalati WorldAssembly + SceneDressing per tile | Codex + Opus | 1.5 d |

Pine done when: memory drops by Pine's tile-local share (T0) × 39/64, no frame over 100 ms after controls, Pine↔Driftwood peak ≤ 1.2 GB. Decisions D-S1 (Pine ground: bake splat tiles vs keep whole Terrain), D-S2 (order: Driftwood → Pine → crossings → Nalati), D-S3 (delete the whole-shard Terrain build vs keep as Debug) — for Jake.

<details><summary>Full streamer trace</summary>

# One shared streamer: map, Pine and Nalati truth, rows (read at HEAD f81d5aade9, 2026-10-23)

Code read only. Nothing built or run. Pine's generated JSON is gitignored; its shape was read from the on-disk
`src/shards/pine-hollow/data/timberWorld.generated.json` (Oct 17), so the tile counts for Pine need a fresh bake to
confirm.

## 1. The streaming map

| Module | What it streams | Radii / LOD | Budgets / disposal | Called by |
|---|---|---|---|---|
| `game/grid/rings.ts` `RenderRings` (411 lines) | neighbour cells: far proxy → L1 → L0 | L0 `nearRadius` 150 m + lookahead (speed × 4 s); L1 400 m; far ring 9 × 1.6 MB, nearest first; caps l0 40 / l1 32 | allocator lease per tile (`evictSync`), parent holds, evictable cache, hysteresis + one tile size, 2 uploads and 8 MB a frame, 8 in flight, retry backoff, quadrant/region masks, shadow ≤ 80 m | `grid/session.ts:550` only (+ tests and sim fixtures) |
| `game/shardfile/clientRings.ts` (99) | the content of a ring tile: terrain (worker decode) + props tile + extra files, in the tile's scope | — | scope per tile | `grid/session.ts:181,546` |
| `game/shardfile/clientWorld.ts` (124) | the entered data shard | all 16 L1 always resident; L0 inside a 150 m (+ overhang) disc; shadow 80 m; refresh when the viewer moves 5 m (`FOLLOW`) | `needed: true` lease, so no eviction, no cache, no hysteresis; main-thread decode; its own remask; `slicer` 30 ms | `shardfile/client.ts:250` (SHARD SELECT), `grid/regionalWorld.ts:164` (the entered grid region's data page), `shardfile/runtimeWorld.ts:61` (legacy only, see below) |
| `game/shardfile/residency.ts` (19) | the 150 m disc math for clientWorld | literals 150 / 80 | — | clientWorld |
| `game/shardfile/clientResidency.ts` (26) | **not streaming**: the page's home budget claim (`admitHome`) | — | — | `plugin/ui.ts:1588`; stays shard-global |

**Copy-paste:**
- The per-file lease-and-read and the terrain/props reads (`clientWorld.ts:58-72` vs `clientRings.ts:54-70`).
- The quadrant mask (`clientWorld.ts:85-95` vs `rings.ts:384-394`).
- Tile distance (`residency.ts:2-5` vs `rings.ts:104-107`).
- 150 / 80 m appear as literals in `residency.ts` but as `CONTENT_CAPS` in rings.

**Dead or legacy code:**
- The `rings` branch of `clientWorld` (`ClientWorldRings`, lines 19-42) has **no caller**.
- `runtimeWorld.ts` `bindRuntimeTerrain` / `runtimeProduct.ts` `bindRuntimeProductTerrain` are used only by
  `sunscar-dunes-legacy/look/groundTiles.ts`.

**What genuinely differs:**
- Rings: the far level, lookahead, eviction cache, worker decode, multiple cells.
- clientWorld: keeps L1 resident always, installs the props library, `assets.releaseTiles()` admission ordering, overhang.

**Neighbouring tiers (they don't decide tile residency):**
- `nearPlaceholderPlan`/`View`: G342; at most 4 cells on the phone; one `near.glb` per shard; `near` category.
- `farView`/`farProxy`: draw the far level that rings schedules.
- `prefetch`: disk only.
- `allocator`, `pageResidency`, `assetResidency`, `renderResidency`: accounting.
- `tileOrder`: rank only (H3).

**Whole builds:**
- `bakedTiles` (`world.baked`: every node of one GLB at once).
- `worldScenes` (whole placements).
- A **second duplication**: the native world builds a whole `Terrain` + `Forest` twice, in `engine/core/bootstrap.ts:81-97`
  (SHARD SELECT) and `grid/regionalWorld.ts:278-293` (grid region).

## 2. Pine Hollow today

Pine is a client-plan shardfile: `generators/product.ts`, runtime `kind: 'client-plan'`,
`binds: ['terrain','props',…]`. Its README "Its custom code" table is stale; those folders are gone.

- **Terrain: there are no Pine terrain tiles.**
  - `terrain.form = 'query'`, 0 tiles, with a 257² collider/sampling file. The plan's "64 + 16 terrain tiles their own
    runtime draws" is wrong for Pine.
  - The ground is the engine's **whole `Terrain`**: one 257² mesh + a rock slab + 4 PBR splat layers as 1024 arrays and
    the boreal shader (`engine/world/Terrain.ts:398-420`).
  - It is built in `bootstrap.ts:81` (SHARD SELECT) or `regionalWorld.ts:278` (grid entered), and stays for the whole
    visit.
  - It never goes through clientWorld: `withoutRuntimeRows` strips bound terrain/props (`client.ts:191`,
    `plugin/headless.ts:78`).
- **Trees:** `Forest` builds all 2,600 trees whole: `bootstrap.ts:91` / `regionalWorld.ts:291`, then
  `placeForestPageModels` places all of them sliced (`forestPage.ts:152-168`). There is a culling view, but every instance
  and its capsule colliders stay resident.
- **Ground cover (ferns, shrubs, litter):** `ForestGround.prepare` reads the whole-shard layout
  (`looks/forestGround.ts:21-40`), instanced with cell culling (`forestPage.ts:170-176`). Every matrix is resident.
- **Grass is already streamed by the camera:** `engine/world/Grass` is a 28 × 28 toroidal grid of 4 m cells (75k slots)
  that follows the player (`forestPage.ts:67`). It is fixed memory, so it is not the problem.
- **World scenes:** cabins, living buildings, crags, the cave, timbers, streams, landmarks and props are all built whole:
  - `installWorldScenes(..., residentWorldScope)` (`forestPage.ts:64`);
  - cabins (`:72-87`);
  - landmarks and props with their colliders in `finish` (`:93-96`);
  - the cave (`clientForestPage.ts:62-74`).
- **Props tiles:** Pine's 26 L0 props tiles (timber world, ~15.9 MB) are runtime-bound. The entered world draws none of
  them; only the grid rings draw them for Pine as a *neighbour*, and not while its near view owns the cell
  (`session.ts:550`).
- **Water, weather, sky:** page-wide.
- **Why it is all whole:** it is legacy carry-over from the native runtime. The forest page ports the old `world/` build
  as rows. The engine `Terrain` is the only splat-boreal path for the entered world, although `clientSplatTerrain.ts`
  already compiles the same `splatTerrainMaterial` for props tiles (with `boreal` and tints).

## 3. Nalati today

Nalati keeps `runtime/index.ts` and `state.ts` (custom TS). Its runtime binds terrain and props; the terrain is query
form.

- **Ground:** painted. `paintedGroundPainter` (`game/looks/painterlyLook.ts:46-88`) is a `TerrainPainter` run by the same
  `Terrain.build` in bootstrap / regionalWorld. It builds one whole mesh from `world/terrain/<id>.glb`.
- **64 L0 render tiles exist** (`data/renderTiles.json`, 15.1 MB, painterly family, cut from that mesh). But:
  - they draw only behind Debug `groundTiles` (default **off**);
  - when on, **all 64 load at once** (`painterlyLook.ts:70-82`);
  - there is no L1.
- **World:** `WorldAssembly.construct` (whole world prefix) and `SceneDressing` (whole-shard dressing) build everything,
  with their colliders (`runtime/state.ts:43-54,76`).
- **Grass:** camera rings (`looks/grassPresentation.ts`), fixed memory.
- **Water and the painted sky dome:** page-wide.

## 4. Rows (proposed for tile-streaming-mini-plan.md; they replace T2's text and U3)

### (a) One streamer

| Row | What | Files | Lane | Size | Done when |
|---|---|---|---|---|---|
| S1 | `engine/world/tileStreamer.ts`, built from `RenderRings`: wanted sets by distance (N × N full ring, coarse ring, far, near); keys `{instance, level, x, z, type: shard\|road\|junction}`; parent-first masks; hysteresis; a lease per tile through an injected budget port (the engine can't import `grid/allocator`); per-frame count + bytes + ms budgets; a Scope per tile; `ready()` / `waiting()` | new engine module; `rings.ts` → deleted (tests move) | Codex | 2 d | host-bar six tests; Node 1 km drive gives the same trace as today's rings at 150 m; 0 hole frames |
| S2 | One tile-content adapter (clientRings + clientWorld's reads merged). SHARD SELECT (`client.ts:250`), the grid region (`regionalWorld.ts:164`) and grid neighbours (`session.ts:546`) all register instances on the one streamer; an entered cell is just the instance with the full ring | `clientRings.ts` → `tileContent.ts`; delete `clientWorld.ts`, `residency.ts` and the dead `rings` branch | Codex | 1 d | net deletion ≥ 200 lines; DW SHARD SELECT + grid: same tiles at the same pose; worst frame ≤ 100 ms |
| S3 | Road and junction tiles as streamer types on the 62.5 m lattice (after T9 A, G638 D1) | `roadCull`, `roadLook`, `roadLayout` | Codex | 0.5 d | road resident only in the ring; road MB down; seams certified |
| S4 | Delete `runtimeWorld.ts` and `bindRuntimeProductTerrain` with sunscar-dunes-legacy | legacy-deletion plan | Codex | 0.2 d | 0 callers |

### (b) Pine onto it (after the DW slice)

| Row | What | Files | Lane | Size | Done when |
|---|---|---|---|---|---|
| P1 | Bake Pine's ground as 64 L0 + 16 L1 splat terrain tiles from its existing heightfield + splat. The boreal look becomes a **material row** (`props.splat` with `boreal` + tints, drawn by `clientSplatTerrain`, the engine's own `splatTerrainMaterial`). The canopy map becomes a per-tile `_canopy` channel. The 257² collider stays shard-wide | `pine-hollow/generators` (terrain bake), `sdk/bake/terrain.ts` | Opus | 1.5 d | Pine renders from tiles with roughly the same look (G415 side-by-side) |
| P2 | One ground path: `bootstrap.ts:81` and `regionalWorld.ts:278` build no whole `Terrain` when the shard declares tiled ground; the two native-world assemblies (bootstrap vs regional) share one builder | engine `Terrain`, `bootstrap`, `regionalWorld` | Opus | 1 d | Pine entered: no 257² mesh or slab; memory drop measured |
| P3 | Trees per tile: `Forest` placements bucketed by tile into per-variant instance ranges (one InstancedMesh per variant per region); trunk colliders in the tile scope; the 5 × 5 is full, beyond it the L1 tile / near view | `engine/world/forest`, `forestPage.ts:152-168`, `models/place` | Opus | 1.5 d | draws ±10 %; 25 / 64 of the tree instances resident; 0 stuck in the physics walk |
| P4 | Ground cover per tile (the `ForestGround` layout bucketed; ranges per tile) | `looks/forestGround.ts`, `forestPage.ts:170-176` | Codex | 0.5 d | cover instances resident ≤ the 5 × 5 share |
| P5 | Pine world scenes per tile (T3 for Pine): placements, welds, the cave and landmark/prop colliders per tile scope; living-building logic, doors, saves and lanterns stay shard-global | `worldScenes.ts`, `forestPage.ts:64-96`, `clientForestPage.ts` | Codex + Opus | 1.5 d | the cabins, the cave and the King fight unchanged |

Stays shard-wide: sky, look, LUT, weather, water rows, the grass camera ring, sim, quests, audio index.

**Pine done when:** SHARD SELECT Pine entered memory drops by its T0 tile-local share × (1 − 25/64); no frame
over 100 ms after controls; Pine↔DW crossing at peak ≤ 1.2 GB.

### (c) Nalati (after its zero, G639)

| Row | What | Files | Lane | Size | Done when |
|---|---|---|---|---|---|
| N1 | Painted ground on the streamer: its existing 64 L0 tiles + 16 new L1 (U2); the painterly ground material becomes a material row (painted-terrain family); delete the one-mesh path, the all-at-once tile path and the `groundTiles` row when Jake picks (T5's row) | `painterlyLook.ts:46-88`, `bake-render-tiles.mjs` | Opus | 1 d | memory drop measured; no frame over 100 ms |
| N2 | `WorldAssembly` and `SceneDressing` bucketed per tile, with their colliders in tile scopes | `worldAssembly.ts`, `sceneDressing.ts` | Codex + Opus | 1.5 d | physics walk 0 stuck; the Titan and the King unchanged |

## Rule (G663): neighbours are LOD only

A neighbour shard is only scene-graph level of detail (far proxy → L1 → L0 tiles), with no shard logic or runtime. Logic runs only in the shard you're in. No whole neighbour world is ever built: `warmAhead` and the 4-whole-world cap go in T7. **Order:** Driftwood slice (T0–T5) → **T7** → Pine P1–P5 → Nalati.

## 5. Decisions (decided G652, order amended by G663: tonight first extra; D-S1 A bake splat tiles; D-S2 A DW → Pine → T7 → Nalati; D-S3 A delete the whole-shard Terrain build)

- **D-S1 · Pine's ground.**
  - **A, recommended:** bake 64 + 16 splat tiles from its heightfield and splat, with the boreal shader as a material
    row.
  - B: keep the whole engine Terrain and stream only content (trees, cover, scenes).
- **D-S2 · Order.**
  - **A, recommended:** the DW slice (T2–T5) first as G638 D4 says, then Pine P1–P5 before crossings (T7), then Nalati
    after its zero.
  - B: Pine first.
- **D-S3 · One ground path.**
  - **A, recommended:** the whole-shard `Terrain.build` goes for every tiled shard, so the engine has one ground path.
  - B: keep it as the Debug "whole shard" option until T10.

</details>

## Far-view quality (Jake, 2026-10-23: *"When we try the low detail stuff, it just looked like shit … when we made it render everything, then all of a sudden it looked good"*)

The far views looked bad because today's stand-ins are crude (decimated ~1.6 MB far proxies), not because stand-ins can't look good. The menu hero is a picture, so it is rendered offline at full detail (no run-time budget). In game, stand-ins are baked from the full-detail render (silhouette, colours, lighting; impostors captured from render-everything), shaded to match, behind mild haze (G631) with cross-fades instead of pops; a generous 5–10 MB per neighbour is still tiny next to a whole world (~300 MB). Render-everything (G607) stays the Debug option until Jake picks.

| Row | What | Lane | Size | Done when |
|---|---|---|---|---|
| F1 | Variant sheet (iPhone portrait, labelled): render-everything vs today's stand-ins vs improved baked stand-ins, from inside Driftwood looking out (3 views) and the hero angle, each with WebContent + GPU MB | Opus | 0.5 d | Jake picks by eye |
| F2 | The picked stand-in for every shard (bake step per shard, far budget per G658 crash-line count) | Opus + Codex | 1.5 d | far views match the pick; memory recorded |
| F3 | Menu hero rendered offline at full detail and shipped as an image (no run-time streaming) | Opus | 0.5 d | hero matches the original framing; costs no run-time memory |

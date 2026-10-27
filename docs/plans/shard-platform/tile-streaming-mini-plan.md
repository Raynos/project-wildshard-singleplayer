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
| T1 | Leak-free disposal: finish O18 (sp-o3); ghost counter per tile and region scope | `grid/live.ts`, new `grid/ghosts.ts` | Codex | 1 d (+ sp-o3) | **done (2026-10-24, sp-x9; G710 settled sample):** 196 observed tile lifetimes / five returns; settled R4→R5 +10.62 MB, ghosts 0/0; old warm-up-baseline grade remains FAIL as detailed below | sp-o3 |
| T2 — done (2026-10-27, sp-o4; G790 as written): the host is `engine/world/tileStreamer` (moved there by `30dcc15182`, named so rather than tileResidency), rings.ts its first user and deleted there, clientWorld.ts folded into `game/shardfile/tileContent` by `c2a06d82e6` (-277 net lines); rectangles of any size, full N x N ring (`setFullRing`) + coarse L1 / far ring, parent-first, no holes, hysteresis cache, per-frame uploads / bytes / ms, scope + lease per tile (`scopedTilePorts`), road and junction kinds; host bar 6 / 6 (docs/HOST-BAR.md, Audits); the original 1 km trace holds (`test/tile-streamer.test.ts`) and a 5 x 5 full ring on that drive keeps <= 25 fine tiles a cell with 0 holes (this commit) | Engine tile residency host (`engine/world/tileResidency`): rect tiles of any size, N×N full ring + coarse ring, parent-first, no holes, hysteresis, per-frame bytes and ms budget, scope + lease per tile. `rings.ts` and `clientWorld.ts` become users (net deletion); road and junction tile types | `game/grid/rings.ts`, `shardfile/clientWorld.ts`, `residency.ts` | Codex | 2 d | host-bar six tests; Node 1 km drive: resident ≤ 25 + ring, 0 hole frames; same trace as today at 150 m | — |
| T3 | Per-tile content: placements bucketed by pose (no rebake) into per-model instance ranges; welds / merged / baked sets by triangle centroid; registry colliders per tile scope | `worldScenes.ts`, `worldScenePlacement.ts`, `bakedTiles.ts`, `sdk/bake/worldGlb.ts` | Codex + Opus | 3 d | DW draw count ±10 % of today at the same pose; no visual diff in the 5 × 5 | T2 |
| T4 | The entered world streams (H3 generalised, joined with sp-o1): shard-global state + rank-0 tiles before controls, the rest via T2; SHARD SELECT and grid | `grid/liveSession.ts` `enterInitialHome`, `shardfile/client.ts` | Codex (sp-x2, G708) | ≤1 h slices below | **done (latest path qualifications):** grid30f cold/warm9.899/12.478s,45/41ms worst; compiled730f cold/warm7.108/7.424s,81/96ms worst, PASS100ms. Pins differ and one cohort each supplies no causal gain claim; no standalone M1 exists for a percentage claim. | T2, T3 |
| T5 — reopened by G775 (Jake: build as written: overlay + 3x3/5x5/whole Debug row); in flight (reading at plan end, G780). **T5.1** code landed (sp-o5, this commit): Developer ▸ Debug ▸ Performance ▸ Tile residency (5 x 5 shipped / 3 x 3 / whole cell, a reload; `tileRing()`); **T5.2** done (sp-o5, this commit): with Developer on, a SHARD SELECT world's minimap shows every tile border, the resident render ring (green) and collider 3 x 3 (amber), and each tile's declared MB (`tileOverlay.ts`, `Minimap.setDebugExtras`); **T5.3** done (sp-o5, this commit): the same borders and resident ring on a grid page's entered cell (`GridSession.tileOverlayState`), and each resident tile's declared MB from the entered cell's admitted product (sp-o2, this commit) | Debug row "Tile residency: 3 × 3 / 5 × 5 / whole shard" (A/B/C, E451) and a Developer overlay (tile borders, resident colour, MB per tile) | Settings Debug, minimap | Opus | 0.5 d | Jake can feel it on Driftwood (first playable slice: T2 + T3 (DW only) + T4 + T5) | T4 |
| T6 | Creatures, NPCs and figures by tile: presentation in resident tiles; brains global, dormant outside 5 × 5; patrols that cross tiles hand over | population, quest figures | Codex | 1.5 d | DW boar / captain fights unchanged; memory drops by its T0 share | T3 |
| T7 — in flight (reading at plan end; T7.1 source `379647e12b` + `e5f73af853`) | Crossings by tiles: neighbour region = small state; tiles by distance; the source evicts behind the player; delete whole-world `warmAhead` and the 4-world cap | `grid/live.ts`, `liveSession.ts`, `hybrid.ts` | Opus + Codex | 2.5 d | DW↔Sky ×5 on Chromium phone tier: peak ≤ 1.2 GB per shard, back to baseline ±20 MB, every crossing under 5 s warm and under 8 s cold (G782; was < 5 s), worst frame ≤ 100 ms | T1, T4, T6 |
| T7.1 — in flight (reading at plan end; source `379647e12b` + `e5f73af853`) | Approach declared tiled destinations through the existing render scheduler, pinning only their entry ring. No regional constructor or entered-root replacement on a guess. Abort the pin on redirect, distant departure, owner retirement or completed entry. While pinned, the whole-near fallback permits fine refinement; masks still cover partial parents. Releasing the final pin restores its old refinement policy, and registration disposal releases all pins. Actual demand retains all runtime/save/collider/readiness gates; non-tiled adapters retain their existing construction path. Two-resident guard unchanged. | `grid/live.ts`, `liveSession.ts`, `session.ts`, `shardfile/tileContent.ts` | sp-x8 | bounded slice | types + typed lint + scoped ratchet clean; full ratchet stops on D37; D47 fixed `15f149539c`; cause-fixed preview `8422baac07` passes generation then refuses new Nine coarse L1 debt (`82ac81812d`, sp-o5), zero browser samples; runtime/G782 qualification still blocked | T2, T4, T6 |
| T8 | Every shard on tiles, all seven as written (G790: Nalati, Pine, Nine, Sky, Sunscar, open plots, template): bake checks and DW cap work; preserve Jake’s B pick | shard generators | Codex (sp-x2) | 3 d | **in flight (2026-10-24):** 24-product 64-L0 / full-5×5 bake census done `7093891d97`; old four-tile split is **not done**. Current DW has 8 wire overruns (308,860–2,343,200 B) and tile 6/4 resident 4,673,742 B, retained under Jake’s B pick / exact exception. Splitting files cannot lower a row’s summed cost; no grid/cap change. Lossless meshopt audit below: 3/1 and 3/3 are held because delivered gzip grows; only 2/4 (-6,778 B delivered) merits a later slice. GC lifetime regression `0126cffe30` is landed; no producer, cap or policy change. Live grid-ready proof remains | T3 |
| T9 | G638 picked A: 62.5 m gap, pitch 562.5; asphalt unchanged at 15 m, side strips 23.75 m, seams/junction/routes follow the lattice | strips, roadLook, roadLayout, config | Codex (sp-x6) | 2 d | **done** (2026-10-24): runtime `ae2dca27dc`; native 15/30 m/s peer routes each 4 crossings / 0 stuck; labelled phone road/junction witnesses; current-origin `57d1344dc1` EWNS held walks all complete / 0 stuck / gates open. [Compact receipts](../../../progress/shard-platform/tile-streaming/t9-lattice.md); T1 retirement and T10 broader milestone stay separate | T2 |
| T10 — in flight (reading at plan end; G780), source `45086a7db8` | Delete the whole-shard loading path after all-seven T8: no missing-L1 permanent fine coverage and no Whole cell Debug choice | tileContent.ts, tileResidency.ts, debugOptions.ts, strings.ts | sp-x2 | eight files | Coarse parents cover the world; bounded3×3/5×5 fine rings, overlay and coarse/far landmarks remain. Engine/game types, scoped registration-fixture types and touched typed lint pass. Frozen LEGACY untouched. The one final Simulator/soak reading remains at the plan end (G780), not a pre-land gate or new PASS claim. | T8 |
| T11 (stays open, G775; G761 had closed it because Pine and Nalati draw far content whole) | **in flight (reading at plan end, G780):** code `325c4e38db` + `8bfa934fe4` (sp-o5): Pine's crag cliff, boulder and scree places tile with a coarse copy drawn beyond the ring up to its edge; the crag skin and the waterfall and streams draw whole, so they never leave. The Pine spawn 5 × 5 reading waits on a HEAD preview (D41). Far landmarks survive the ring: authored landmarks beyond the N×N ring (Pine crag spires, waterfall) draw a coarse stand-in from their LOD / impostor in the coarse ring, evicted only at its edge (found by sp-o1 at 5 × 5, 10-23) | tile residency, landmark LODs | Opus sp-o1 | 0.5–1 d | Pine spawn view at 5 × 5 shows the spires and waterfall | T2 |

### RM8.1 quantized authored tiles (2026-10-26, sp-x2)

Coordinator priority: finish the active C4 slice, then RM8.1 before further C4;
afterward C4 → T4 milestone → T10. Use KHR_mesh_quantization plus meshopt for
every authored shard. Target 10–15 B/triangle wire and about half the resident
geometry, within existing look oracles and unchanged tile caps. Producer before
reader; shared SDK/build changes run all affected behaviour groups (G746).

| Slice (≤1 h) | Status | Contract / exit |
|---|---|---|
| RM8.1a0 Raw near-view contract | done (bb1e7fa958) | Pin the existing raw GLB intake before changing its codec: original vertex/index counts and first position, nonidentity transform, colours, material skip/LOD selection, deterministic final near bytes, malformed refusal and successful next read. Test-only. This serves RM8.1. |
| RM8.1a1 Existing meshopt near intake | done (sp-o1, 850a6efb5f) | shardfileWorld registers EXT_meshopt_compression (MeshoptDecoder) and KHR_mesh_quantization. Two cases: compressGlb output feeds identical near prototypes and baked near bytes; a corrupt meshopt payload refuses without poisoning the next read. |
| RM8.1b Quantized tile producer | done (sp-o1: A 850a6efb5f; B/C this commit) | Every L0 tile primitive is welded (identical complete vertices only), Int8 normals; a tile (not a panel) goes onto one shared power-of-two grid (`tileGrid`: 1/512 m, coarsened only for a tile too tall for 16 bits; origin on the grid, so a shared point quantizes alike in both tiles): unnormalized Int16 positions dequantized by the node, Uint8 colours, 4-byte strides, vertex-cache and fetch reorder (meshopt), then `compressGlb`. Night Market kit-on S tiles 121 → 53.9 (A) → 17.7 B/tri, 251 KB a geometry tile; default layout fits. |
| RM8.1c Geometry and budget readers | done (sp-o1, this commit) | glbCost / glbTriangles admit unnormalized Int16 POSITION (node-dequantized) and read Int8/Int16; GLTFLoader and the near reader already decode both. Open: `gpu` counts packed sizes, not padded strides (1-2 B/vertex low, alike for every meshopt-packed model; a global fix moves other ceilings). |
| RM8.1d Authored activation and per-shard sizing | done (this commit) | Active in bakeAuthoredWorld for every authored shard; sp-x1's all-24 refresh on the frozen source exit 0 (109 s, no tile-bake/T8 refusal). |
| RM8.1e Milestone and RM8 handoff | open | Normal products and tile caps green for every authored shard; exact/accepted pixel parity, then hand the defining SHA and Night Market numbers to sp-o1. No kit density activation or cap waiver in this codec row. |

### T4 / T6 / T8 bounded slices (G711)

Each engineering slice below is at most one hour; milestone measurements stay separate.

| Slice | Status | Contract / exit |
|---|---|---|
| T4.1 Required entered tiles | done (`436b14b3ed`) | Rank-0 render/collider errors refuse boot; concurrent entries await the same preparation; failed/retired residents never publish a driver. Background movement cancellation and no-retry behavior stay pinned. |
| T4.2 Standalone / grid caller coverage | done (this code commit) | Restore evicted rank-0 tiles on re-entry; attach appended scene stages to existing tile scopes; prepare each coarse stand-in once. Required callers await in-flight background errors. |
| T4.3 Entered-stream milestone | done (grid30f; compiled730f) | Latest cold/warm path gates pass below; historical failed cohorts stay retained. This is not a same-pin combined cohort or causal attribution. |
| T4.3a Compiled measurement window | done (this code commit) | Official compiled-card reader retains eight seconds of post-controls frames; first-controls timestamp and first-ready byte/phase snapshot stay fixed. Loading gaps are excluded; a freeze across the window end counts in full. Nine related contracts, scripts types and typed lint pass. Grid M1 clocks/deadlines unchanged; actual T4 acceptance remains below. |
| T4.3b Matched entry qualification | done (original30f four-visit cohort; compiled miss repaired at730f) | Original matched grid/compiled cold/warm visits completed; grid point comparison vs35.8/18.6s M1 is−72.3%/−32.9%. The original compiled cold110ms failure remains recorded; new730f compiled pair passes81/96ms. No standalone M1 or causal gain claim. |
| T4.3c Compiled frame qualification | done (this code commit) | The one `dd2d8d6164` compiled pair completed/errors 0: controls 16.120/7.027 s cold/warm, eight-second worst 372/81 ms. Cold FAIL / warm PASS; no repeat or standalone percentage claim. Summary now reports the 100 ms gate across every visit, exit 2 for a measured miss and exit 1 for incomplete/refused evidence; eleven related cases, narrow strict contract types and typed lint pass. Offline classification of that saved pair exits 2; grid M1 behavior stays unchanged. T4 remains open pending attribution and matched grid evidence. |
| T4.3d Post-controls observer work | done (this code commit) | Stop serializing the frozen loading/resource bank and rescanning performance measures on each 500 ms post-controls poll; keep live readiness, document identity and late-error refusal. Saved-pair loading-details JSON is 910,752/763,369 B cold/warm before, 13 B after (common fields excluded); first-ready byte/phase evidence stays fixed. Twelve related cases, narrow strict contract types and typed lint pass after G723 cancelled its unstarted quiet window. No new capture or claim that this caused the cold 372 ms gap. |
| T4.3e Warm-grid attribution | done (diagnostic only; this code commit records the boundary) | One 653f grid pair: cold/warm controls 15.157/14.534 s, worst 43/201 ms. One approved warm Timeline on the same pin, original clocks/deadline and no quiet: controls 12.578 s, worst 50 ms; the 201 ms miss did not recur. Drift +0.3 ms/drops 0, but rAF coverage 59.9% <80% refuses partition. No causal shader attribution or acceptance gain; shared with sp-x1, which retains G717 shader ownership. T4 stays open; next source work is G734 L18.2–4. |
| T4.3f Post-J5 entry qualification | done (730f compiled source milestone) | Original30f grid9.899/12.478s,45/41ms worst; its compiled cold110ms FAIL remains retained. After tile-stage budget fencing730f/build730f748-mvo1wz2u: one original compiled cold/warm pair complete/errors0, controls7.108/7.424s, worst81/96ms, PASSrc0 under100ms. Full preview127.33s/all24 products. Different pins/one cohort each: no isolated or all-current-grid gain claim. No standalone M1, Timeline/Profiler or cause assigned to110ms. Quiet/Sim/browser/preview closed; no repeat queued. |
| T4.4 Tile-stage frame admission | done (this code commit; native qualification remains T4.3f) | Check the existing shared drawn-frame budget between matching content stages, including cached render/collider callbacks. Controlled24 one-unit stages formerly share one frame; paced maximum8, order/readiness unchanged. Stop later content if its tile retires while paused; loading retains its original task admission. Exact110ms frame cause remains unassigned; no native gain or acceptance claim. |
| T4.4a Far boot wait diagnosis (≤1 h) | done (diagnostic code); release red unresolved | Smoke40371580877 actually tested2b11287c5f: ready/entered/frameGate true,7 far fetching at the unchanged90s deadline,5 later, no errors or omissions. Retained title trace ends before grid preparation and the capture network is empty; fetching conflates load/decode with hidden shader work. Record per-request phase/total/phase ages plus bounded oldest existing boot waits in the scalar grid snapshot; no resources, scheduling, deadlines or caps change. No causal attribution to posted cache put3a503 or named scalar2b112, no smoke retry or green claim. 14 focused cases/3 suites,25 existing cache queue/worker cases,221 related cases/57 suites, touched game/test types and named typed lint pass. Next ordinary smoke must identify the held boundary. |
| T4.5a Template world.data decoder graph | done (producer `dfa2feca44`, reader this commit) | Preserve every bounded GLB admission check but keep complete product validation outside equipment/skin entry; commons retain original validation on demand. Static local closure 635→632 files, 6,559,793→6,520,336 raw B, 1,754,790→1,743,836 gzip B; source sizing, not emitted bytes or native RAM. Regression RED before/GREEN after; 32 focus, touched format/game types and typed lint pass. |
| T4.5b Two Template native memory rows | measured FAIL (2026-10-25, app `5f99d999e6`, reader `688f7e1d78`) | Original cold compiled entry, native10/60/120s WC+GPU method, both complete/errors0: 267.398/245.507 MiB vs fixed198.538 MiB, 0/2 PASS. Earlier50d Template260.664/249.679 remains historical; no consistent source-isolated gain. Peer CPU overlap retained; no repeat. Remaining excess68.860/46.969 MiB is open. |
| T4.5c Runtime model contracts | done (this test commit) | Actual compressed equipment entry preserves position/normal/UV words and index width/order, shares the live decoded model, disposes only after its last owner, and refuses hash-valid malformed GLB before publication. No look or allocator policy changes. |
| T10.1 Retire whole-cell entered-ring override | done `89f7d3598a` (G769) | Remove radius8/every-tile selection from the entered-content ring contract: only0/1/2 remain (up to5×5 render,3×3 colliders). Shipping standalone/grid/resident callers already select2; retained smaller fixtures stay valid. Whole-cell fixtures now assert refusal and unchanged existing ownership. Game production/test types and touched typed lint pass; no tests/builds/soaks/readings under G769. Generic engine residency, coarse/far landmarks and G606 frozen LEGACY paths stay intact. Remaining whole-world construction deletion and final milestone are not claimed complete. |
| T10.2 Skip temporary full splat ground | done `9e6e110d3e` (G769) | A declared page with actual splat tile rows marks its ground as tile-drawn. The engine retains the sampled field/collision policy and builds the original cliff slab, but skips full-ground vertices and PBR layer arrays that the client would immediately retire. Empty invisible compatibility mesh remains for canopy/punch callers; painter-owned preparation retains its original path. Manifest-to-level adapter carries the data flag; G606 frozen LEGACY sources and native recipe collision choices are untouched. Engine/game types and touched typed lint pass; no tests/products/previews/readings, no measured saving or final T10 acceptance claim. |
| T10.3 Whole-shard deletion after T8 | source landed `45086a7db8`; reading at plan end (G780) | Defining T8 landed: DW806ea146aa, Nine82ac81812d, Nalati4177cc91fc, Sky earlier; all seven confirmed by coordinator. Delete permanent distant-L0 coverage requirements and require actual occupied fine rows to have rendered coarse parents before registration. Remove Whole cell choice/label; stale saved picks resolve to5×5. Keep3×3/5×5, the overlay, generic engine residency, far/coarse content and G606 LEGACY. Original registration fixture now refuses missing parent with no ownership/budget/pin mutation; positive offered entry uses valid coarse coverage. Native engine/game and scoped fixture types plus touched typed lint pass; no tests/builds/readings under G769. Preparatory TS6 overlay found unrelated compiler-version diagnostics and is not qualification; final native TS7 checks are the authority. First game emit caught x8 dirty recovery.saved TS18048; defining optional read repaired and failed-only game emit passed. |
| G720 Data-cell entry coverage | done (`cb756b79df` + this capture commit) | Data-only entry awaits admitted views and required coverage; existing uploaded views survive same-root borrowing. On phone tier, first in-cell sample has 16 L1/15 L0 and no far proxy, 0 ms waiting inside. [Capture and timings](../../../art/grid/round-63-night-market-entry/README.md); no frame-floor claim. |
| G721.1 Board structural collision | done (`22248f9b6a`) | Separate terrain filtering from surface material: admitted structural meshes stop the board after fresh install and native restore; terrain springs retain their existing heightfield bypass. |
| G721.2 Shared plot kit and walk | done (`49af17b6b6` + this capture commit) | Shared lamp/stall posts register through the existing physics bake; eight render hashes exact. Full pinned build 0; Night Market walk 3/3 complete, 0 stuck, board escape 0 outside frames. Four-second held-forward check stops outside the wall, 0.16 mm final-second travel. [Phone capture and route](../../../art/grid/round-64-night-market-collision/README.md); no new collider ring policy. |
| G721.3 Routed data-entry stall | done (`1138f0564c` + this capture commit) | Exact 0dd Blender stops on the unchanged edge-tagged transfer fence after passing the road mouth; its required tiles starve behind eight Sunscar background fetches. Prioritize pinned tiles/parents and cancel only unfinished unpinned fetches, same cap and readiness fences. Actual phone-tier Blender/Ember/Night Market entries all ready/errors 0; [failure and fixed portraits](../../../art/grid/round-66-required-entry/README.md). |
| G724.1 Immediate-return retention | done (`54c753f9ca`; guarded G723 extension `2888459ba9`) | Keep the last entered source on the road; prediction cannot retire it. Opaque/over-budget factories keep retire-before-allocation. Explicitly isolated preparation may hold source + incoming under the strict 1.8 GB page / 1.2 GB owner checks, with complete source disposal before destination entry; a U-turn cancels incoming and reuses source. Save/refusal and activation fences stay intact. G723's native memory/timing witness remains separate. |
| G725.1 Grain ownership | done (`774305c6a4`) | Trace the real cinematic carrier/strength across cell exit; grain is zero on the road and cannot stack. Preserve each live region's authored strength. |
| G724/G725.2 Phone milestone | done (this capture commit) | Real road → DW → road → DW: retained activate 17.7 ms; 0 loading panels/static; one resident world. Request-to-ready 1.033 s includes walking the existing 6 m pre-interior strip, not a loading stall. [Phone portraits and exact timing boundaries](../../../art/grid/round-65-warm-return/README.md). |
| G630 Aerial terrain follow-up | done (`0ce626a8f5` + this capture commit) | Detached painted ground stays cell-local after grid rebasing. Red-before regression and attached-transform control pass. Exact shipped hero camera now shows complete Nalati terrain at both 62°/43°, same 18 L0 draws, errors 0; [shipped/fixed board](../../../art/main-menu-hero/round-6-nalati-terrain/README.md). Tile counts/caps/artwork and shipped title images unchanged. |
| T6.1 Dormancy / snapshot contract | done (contract-only slice below) | Current-position membership, exceptions and exact snapshot/RNG pins; no brain or native-sim schedule change. |
| T6.2 Presentation lease / rebind | waits: low value (sp-o5, 2026-10-26) | Dormant animals are already undrawn and shadowless (`AnimalManager.ts:624`); T0 bounds all outside-5x5 tile-local memory at DW 0.01–2.69 / Nalati 1.93–6.77 / Pine 0.87–7.19 MiB, so a rig lease (with its parity, pins and save work) saves under 3 MiB on DW. |
| T3.I Instanced recipe parts by tile | done (sp-o5, `06d63e5b21`) | A step's instanced part sorts its instances once by tile; one draw whose first `count` instances are the resident tiles', every per-instance channel compacted alike. Parts with their own per-frame hook (a culler) or in one tile stay whole. Measured at Driftwood's spawn: 253/334 draws and triangles unchanged before/after (its foliage already streams as cove dressing); generic for recipe parts. |
| T8.1 Complete-L0 bake fences | done (`7093891d97`) | All 24 products declare 64 L0 slots; strict caps and the exact 6/4 exception remain. |
| T8.2 Driftwood lossless route | waits: low value (50–80 build-only lines for 6,778 B delivered) | Read-only sizing complete: tile 2/4 bypasses named-blob compression and needs an opt-in encoder before the compiler derives hashes/costs, plus parity/GC proofs and registered-job output refresh. Coordinator says skip this route; no implementation or geometry writes. 3/1 and 3/3 remain held because gzip grows. Seek a larger delivered-byte or frame saving. |
| T8.3 Occupied L1 appearance | in flight (reading at plan end, G780) (sp-o5; G748.5 Sky `60535f5995`, G748.6 Driftwood `806ea146aa`, Nine `82ac81812d`, Nalati `4177cc91fc`, G748.7 Pine `f18c504569`) | Real coarse stand-ins for occupied tiles beyond the render ring, per shard in its own style. |
| G748.1 Entered far stand-in | done (sp-o5, this code commit; Developer) | The entered cell draws its own near view beyond the render ring: ground triangles (all corners within 1.2 m of its terrain) left to the real ground, the ring's tiles masked per fragment (8 x 8 positional far mask). No new bake or file. |
| G748.2 Per-shard check | done (sp-o5, `dc2e445ae6`) | Opt-in per shard (`world.assembly` row `farStandIn`): Driftwood gains its far palms; Pine and Nalati draw their far content whole today (no change); Nine draws its city whole and the stand-in only darkened it (left out). Sky, Sunscar, template and plots run no world assembly. |
| G748.3 Boards | done (sp-o5, this commit) | `art/tiles/round-1-l1-standins/board.jpg`: Driftwood today vs stand-in, aerial and from the pier, iPhone portrait; for wildshard-v to take to Jake. |
| G748.4 Ship | done (sp-o5, this commit; Jake G761) | Driftwood draws its stand-in in the public build (the Developer gate is gone). Nothing else is superseded: past the ring it drew only its landmarks' coarse copies (T11), which stay. Other shards opt in (`farStandIn`) as their boards are approved. |
| G748.5 Sky coarse L1 | in flight (reading at plan end, G780) (sp-o5, `60535f5995`, build-output fix `76de4af8d8`; G769 recommended look) | Sky's 11 occupied L1 parents draw its isles simplified in their own toon look (`coarseCopy`: meshopt 10 %, 2 m error, borders locked) as the props bake's coarse source; 16 / 16 L1 squares, every tile under the provisional 200 KB cap (largest 191 KB). |
| G748.6 Driftwood, Nine, Nalati coarse L1 (T8, G786) | in flight (reading at plan end, G780): Driftwood done (sp-o5, this commit): 16 / 16 L1, its 9 occupied parents draw the fixed world's coarse copy (`coarseTiles.ts`: rows from the fixed-models job, bytes from the product's output hook, nothing under src); Nine done (sp-o5, this commit): its 12 occupied parents draw the city's coarse copy with every Nine channel kept (props bake `coarseWhole`, one piece per L1 parent; 5 %, 3 m; largest 1.0 MB resident), its library keeps L0 tiles only. Nalati done (sp-o5, this commit): its 16 L1 squares are tile rows too (`bakeNalatiWorldRowsLod`, the 1 m policy, largest 340 KB; runtime-bound like its L0 rows, so the painted ground never draws them twice). T8: every shard now has coarse L1 for its occupied parents (Driftwood's rows return through sp-x10's fixedProgram move). |
| G748.7 Pine far stand-in | in flight (reading at plan end, G780) (sp-o5, this commit; G769 recommended look) | Since P3 Pine's trees draw only on the resident tile ring, so its far hills went bare like Driftwood's; the forest page row's `farStandIn` (format/forestPage) adds the page's own near view beyond the ring (the same `farStandIn` content as Driftwood's world assembly, G761). |
| T8.4 Exact indexed transport sizing | dropped (2026-10-25, sp-x2): gzip grows431,654B | Read-only/in-memory only, all8 over-cap B tiles /27 whole parts. 239,539 native vertex records yield238,486 unique records; all attributes are mapped native channels (0 unused bytes). Raw8,306,872→8,762,272B; gzip-9 2,371,499→2,803,153B. Expanded triangle attribute words match bitwise, existing indexed parts/indices stay exact, but current whole projection cannot consume the reindexed nonindexed parts without an ordinal-expansion change. Reject before decoder/producer work; no geometry file, schema, cap, exact6/4 pin or Jake B change. |

**T4 caller audit:** the non-native `clientWorldAssembly.ts` awaits `residentTiles`
before installing its follow system, using the cached `SceneHandles.tiled()` list.
`forestPage.ts` finishes its landmarks on that same resident/scene list;
`sceneDressing.ts` uses a separate `scene.dressing.tiles` child for its contacts.
`ShardfileClient.world()` awaits the ordered world phase, and `installClientPhase`
awaits each feature. The owned initial grid home waits for activation/gameplay
readiness before its first fixed tick (`liveSession.enterInitialHome`). The native
assembly branch keeps its existing counted construction and global owners.

The second contract slice fixes the stale one-shot tile latch: re-entry reacquires
rank-0 tiles evicted during the prior entry, and appended scene content attaches
under the same surviving tile scopes without replaying prior content. New coarse
stand-ins prepare once; background tiles pick up appended content too. Failure
and cancellation stay distinct even when required/background callers share work.
No global state, brain scheduling, geometry or render material changed; the
loading/frame acceptance remains T4.3, not a claim from these Node contracts.

**G720 repro (phone tier, `acf56cf5c4`):** Night Market committed at
5.990 s after walking from the road; the first far-hidden sample was at
15.123 s (+9.133 s), while the loading panel reported no wait.
Data-only admissions previously awaited their simulation, while neighbour
render admission ran independently. Required entry now awaits both the
admitted view and the shared scheduler's coarse/entry coverage; failure
refuses the crossing and disposes the uncommitted region. The existing
per-frame upload budget is unchanged. No on-device or after-build timing
claim is made by the source contract tests. The defining `e80c55ee25`
phone-tier capture records entry at 6.038 s and geometric entry at 7.409 s;
its first in-cell sample already has 16 L1/15 L0 tiles and no far proxy.
All subsequent entered samples remain covered; no error/context loss.

**T8 lossless route audit (2026-10-24, sp-x2):** the existing decoder
releases both the original wire and its copied encoded BIN/parser. With the
decoded scenes held alive, the real-GC weak backing ledger retains exactly
419,904 / 373,896 / 304,812 B for both raw and meshopt versions of 2/4,
3/1 and 3/3. `0126cffe30` pins that lifetime; this is backing capacity,
not a native resident-RAM measurement. The proposed +542,456 B conservative
decode-peak declaration would remain intact, with no accounting discount.
`ProductInputs.releaseUnused`, `ClientAssets.releaseTransport` and the whole
geometry reader's release already retire transport through verified rereads.

| B tile | Raw GLB B | Meshopt GLB B | Raw gzip-9 B | Meshopt gzip-9 B | Decision |
|---|---:|---:|---:|---:|---|
| 2/4 | 421,392 | 204,840 | 112,760 | 105,982 | Skip: 50–80 build-only lines for -6,778 B delivered is low value |
| 3/1 | 375,648 | 188,156 | 96,999 | 101,823 | Hold tested lossless route; +4,824 B delivered |
| 3/3 | 308,860 | 156,748 | 83,325 | 97,667 | Hold tested lossless route; +14,342 B delivered |

All decoded buffer views matched bitwise. Nevertheless, the existing named-blob
compiler correctly keeps raw bytes for 3/1 and 3/3: lowering their unencoded
wire debt with this candidate would worsen delivery. The three-tile route is
held (+12,388 B gzip total). GR0 also forbids new generated `src` blob paths;
any later 2/4 slice must return bytes through the compiler. All unlanded
producer/metadata/policy candidates were removed and original registered
outputs restored. Jake's B, the exact 6/4 exception, all eight wire debts,
the grid and caps remain unchanged. U2 parent/decoder audit proceeds next.

### T6 ownership audit (2026-10-24, sp-x2)

T6 is **in flight**, not complete. `c145edf02a` already installs animal
dormancy in standalone and regional worlds. The contract-only slice pins
that behaviour; it changes no brain, native-sim schedule or render owner.

| Owner / reader | Current contract and evidence | Remaining presentation work |
|---|---|---|
| Animal roster / decisions | `AnimalManager.ts:571-627`: player-following 5×5, membership from each actor's current position; outside-ring legacy actors skip decision/body/pose. Pinned, driven, harness-held, brain-pinned and native-simulation-bound actors remain exceptions. `loadout.ts:40` and `regionalWorld.ts:467` install the same ring. | Preserve actor identity, snapshot, RNG and exceptions; moving actors must transfer their view lease rather than respawn. Ring membership is desired coverage, not proof that a render tile has finished attaching. |
| Animal rig / models | `AnimalManager.ts:494-534` eagerly creates and retains each rig; `AnimalFactory.ts:255-296,561-630` shares cached variant geometry/materials but gives rigs their skeleton and visual ports. `AnimalView.ts:87-215` retains bone/pose references. | Hiding is not disposal. Releasing one view must never dispose a shared model still read by another view. A presentation lease needs explicit detach/rebind and last-reader rules. |
| Physics / held gear / view programs | `physics/creatures.ts:69-110` poses hitboxes from original actor bone queries before dormancy. `client.ts:478-480` binds the original view to its native actor; `speciesViewSlots.ts:32-55` retains stable actor slots and reads `actor.mesh`. Page-home dressing runs once (`pageHomes.ts:48-71`). | Keep hitboxes, posed queries, equipment attachments and view-program slots valid while views leave/re-enter. Do not remove the native-bound exception to simulate visual eviction. |
| Animal retirement / saves | `AnimalManager.ts:464-473` removes the actor, hunt memory, tokens, scheduler and bodies; non-native actors become dead. `pageHomes.ts:56-71` uses this for page retirement and real respawn. | `retire()` is not a presentation-only sleep API. Tile retirement must not invoke it or consume spawn/adoption RNG. |
| Quest figures / prompts | `quest/figures.ts:53-155` builds and publishes kit figures in page scope; trader pieces/counters share that lifetime. `FigureRows.ts:90-125,154-159` owns scoped publications and cancels late skins on disposal. | Retain logical prompt/joint/socket identities and quest state. Current disposal unpublishes them; it cannot be attached directly to an evictable tile. |
| Moving merged figures | `quest/figures.ts:194-270` keeps orbit state, moving collider anchors, attention channels and atlas bones together; a distance gate already sleeps the group. | Split state/anchors from atlas presentation before tile ownership. Preserve row order, orbit phase, collider and prompt continuity. |
| Tile scope | `tileContent.ts:29-40` attaches static tile content under a disposable child scope. `tileDriver.ts:46-85` retires scopes on ring movement and cancels late attachment. | There is no moving-actor lease-transfer contract. Reusing static pose buckets would strand a patrol at its spawn tile. |

**Contract-only coverage:** `test/creature-residency-contract.test.ts` drives
the real manager with its existing renderer-free fixture. It pins all five
exceptions, engagement unpinning, camera independence, current-position and
player-ring crossings, null residency, no retirement, exact dormant actor
snapshot and unchanged population/shared RNG continuation. The existing
`creature-ring.test.ts` remains the independent ring/hysteresis check.

**Separate presentation lease/rebind design (open, requires Opus parity):**
keep the original actors, quest state and logical anchors in the region;
give only detachable render instances a tile presentation lease. Prepare
the destination before transferring a moving actor, preserve its stable
publications, and release shared source assets only after their last view.
The design must cover pending hull/skin cancellation, re-entry, held/boss
pins, native view bindings and save/restore before runtime changes. Add
lease-transfer / stale-callback / last-reader tests, then prove identical
DW boar and captain fights plus Opus render parity. No memory reduction or
completed T6 claim follows from the contract tests alone.

**T1 in flight (2026-10-24, sp-x9):** the latest [plain retirement cohort](../../../progress/shard-platform/tile-streaming/t1-retirement-3d1.json)
on `3d1d45f087` (includes `75d81fca9b`) completed 12 clean legs / 199 observed
tile lifetimes, errors 0, all six boundaries zero tile/region ghosts. It still
**FAILS** the unchanged ±20 MB native gate: +74.777/+70.517/+45.171/+67.060/
+89.326 MB. Approved finite Node proofs/hooks overlapped; no timing claim.

The authorized [same-source resource diagnostic](../../../progress/shard-platform/tile-streaming/t1-resources-3d1.json)
completed 12 clean legs / 207 observed lifetimes, errors 0, after L9. **Depth
accumulation is absent:** `EffectComposer.Buffer/depth/Texture` is zero at all
six boundaries; the live depthbuffer stays exactly 4,380,192 B throughout.
The former +4,380,192 B/return is gone. `75d81fca9b` excludes generated depth
from eager image preparation; the [Metal kernel](../../../progress/shard-platform/tile-streaming/t1-depth-preparation-kernel.json)
independently proves retired preuploads stay released. This is no acceptance
or isolated causal claim.

Diagnostic deltas from its warm baseline (decimal MB; columns overlap):

| Return | Native renderer + GPU | Tracked GPU | Tracked RAM | Used JS heap | Programs |
|---|---:|---:|---:|---:|---:|
| 1 | -97.321 | -21.774 | -41.801 | +65.956 | 520 (+79) |
| 2 | +41.697 | +3.863 | +17.613 | +131.244 | 575 (+134) |
| 3 | +94.405 | +3.863 | +63.236 | +66.997 | 580 (+139) |
| 4 | +96.993 | +3.863 | +25.972 | +150.353 | 582 (+141) |
| 5 | +59.032 | +3.863 | +4.841 | +63.865 | 584 (+143) |

Final native growth is renderer **+0.426 MB**, GPU process **+58.606 MB**;
backing storage is +4.184 MB. The net GPU ledger increase is near-placeholder
buffers; other owners churn/relabel. RAM peaks then falls; it is a weak
backing-capacity ledger, not retained/resident bytes. Heap is uncollected,
backing includes external strings, and program storage is not byte-censused.
**Browser-internal-only growth is not proven. Recommendation: do not rebase
the ±20 MB native gate on this evidence.** T1 stays open; guard unchanged.
The [same-build program-key diagnostic](../../../progress/shard-platform/tile-streaming/t1-program-keys-3d1.json)
(`4fbe8d8958` scalar reader) completed 12 clean legs/errors 0, not acceptance.
Programs: **445/522/579/584/586/588**. Returns 4/5 each add 67 keys and remove
65; the net two are `graph:material`. Dome, unnamed and shadow-depth counts
plateau after return 2. The recurring retained 32,517/40,055-character keys
match earlier keys except the scene-hash substring; graph text, raw output,
mesh shape and WebGL parameters match. The stock scene hash folds light/env/
fog node cache keys. Not all 67 arrivals are proven hash-only changes.
Baseline-surviving keys gain +688 `usedTimes`, +686 already at return 1.
**Authorized follow-up (sp-x9):** identify the changing scene node, stabilize
keys only for identical content, prove pixel parity and flat warm program
counts, then one T1 rerun. No look change or native-gate rebase. Region ghosts at returns 2/4 (one retired
Driftwood each) clear at the next boundary; final ghosts are zero.

The bounded first slice landed in `f2bcc81c08`, with custom-patch cache
invalidation tightened in `41dbfacf01`. Only compiler-certified unlit graphs
with fog disabled and no scene-reading ops omit the unused scene hash;
material env/lights overrides, layer bindings and custom shader patches
retain it. The [real Metal GL kernel](../../../progress/shard-platform/tile-streaming/t1-scene-key-kernel.json)
reuses one program over six independent scenes (before: six), with all
18 before/after RGBA pairs byte-identical. Lit and fog-input controls keep
their six distinct programs. This is not a live program-count, memory or
phone result. After GR4 repair `59b1b7df1e`, the plain T1 remained FAIL:
baseline ghosts 12 tiles / 2 regions, final 0 / 0, with native deltas
-153 to -286 MB (no causal saving claim). A baseline-only diagnostic then
reproduced 24 / 1; its heap snapshot and finalizer delivery cleared 0 / 0
without a lifecycle edit. The FR-pending counter and native gate stay intact.
The next slice shares built-in lit/fog/PMREM shader shapes, with fresh
per-scene JS bindings and explicit pure-patch certificates. Real Metal GL
parity is 252 / 252 exact pairs; eligible programs stay flat after warm-up.
The plain `eec878c1f4` run completed 12 clean legs / 196 observed tile
lifetimes, errors 0, original phone-4x protocol and 45-second boundary waits.
Programs were 406 / 453 / 497 / 541 / 541 / 541; ghosts were 13/1, 0/0,
0/1, 1/1, 0/0, 0/0. **T1 is done under G710's settled-sample ruling:**
returns 4→5 keep 541 programs and zero ghosts, with renderer+GPU private
footprint 2,647,285,760→2,657,902,592 B (+10,616,832 B, within 20 MB).
The unchanged old warm-up-baseline grader remains FAIL: all five native
deltas are negative (-251,953,152 / -232,620,032 / -199,426,048 /
-219,529,216 / -208,912,384 B), with transient FR-pending counters above.
No gate or ghost meter changed; no further ghost diagnosis, phone or
broader grid-clearance claim. No forced GC or committed receipt.

| Follow-up | Status | Evidence / remaining boundary |
|---|---|---|
| Nine title programShare warning | done (`d247df6cf03`, sp-x9; origin ancestry rechecked 2026-10-26) | False collision warning with a real sharing cost: `7b6d50836d` stabilized buffer names after the older guard compared shader text. The Nine held-weapon body for `R_jian` and another mesh differed only by transient `buffer30310`/`buffer40441` names; final emitted shaders were identical. The landed repair compares after stable names and uniform lowering; real final-code differences still disable sharing. Native GL evidence: five draws keep 1 program instead of 4, warnings 1→0, all 1,280 pixels exact including a live palette update. Completed original related run passes 1,903 cases / 391 suites (415.46 s); current defining three-suite rerun passes all 22 cases (12.15 s). The title warning build measured 3.7 ms; this closes only that warning, not the separate CF2 native title-capture timeout. No new browser/build or frame-gain claim. |

The follow-up TIME-key audit is sizing only: 16 authored Driftwood look
graphs use boxed wind-time/gust references. `graphShape` serializes the
numeric payload, but `shareKeyOf` caches that shape per material. Advancing
time alone does not re-key an existing material. The final 20 seconds of
each of the six diagnostic standing windows contained zero node builds.
No ReferenceNode key or clock binding has changed.

Prior [fbb acceptance](../../../progress/shard-platform/tile-streaming/t1-retirement-fbb.json),
[fbb resource evidence](../../../progress/shard-platform/tile-streaming/t1-resources-fbb.json),
[794 acceptance](../../../progress/shard-platform/tile-streaming/t1-retirement-794.json)
and [794 resource evidence](../../../progress/shard-platform/tile-streaming/t1-resources-794.json)
remain separate. Lifecycle fixes: touch callbacks `7941053755`, site clones
`0e3432322b`, borrowed LUTs `67b5ab6f2d`, stable depth `acda59debf`, retired
preparation `75d81fca9b`. No Simulator or physical-device clearance here.

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
| U1 | Every shard bakes all 64 L0 squares (empty sea / sky squares as near-empty tiles) | **done** `7093891d97`: exact `3c488ee9ab` preview, all 24 products have 64 L0 / full 5 × 5; strict receipts and section hashes |
| U2 | Every shard bakes all 16 L1 squares (Driftwood and Sky first) | **in flight (reading at plan end, G780) (sp-o5, T8/G748: Sky, Driftwood, Nine and Nalati 16/16 with coarse occupied parents; Pine, Sunscar, the plots already 16/16):** safe Codex slice done `9b179032ff`: L0-only exact-reader fences and 7 DW / 5 Sky proven-empty parents. Remaining 9 DW / 11 Sky occupied parents need real coarse proxies: Opus or Jake look pick, not a Codex row. All 16 L1 per shard remains the bar |
| U3 | Pine and Nalati terrain tiles go through the one shared streamer (T2), not shard code | no shard-owned tile drawing left; **in flight (reading at plan end, G780; sp-o5 audit 10-27):** no shard folder draws tiles. Pine's 64 L0 + 16 L1 splat ground files are its props tiles' first file (`withPineGround`, P1), attached by the shared T2 driver (`residentTiles`, `c010d0a9f5`). Nalati's painted ground is drawn by the game's painterly look (`painterlyLook.ts`, N1: spawn ring first, L1 squares beyond); its own ring loop follows the merged mesh's draws, so it works in a grid neighbour too, and stays until T2 can follow a non-entered view |

U1 source slices (sp-x2, 2026-10-24): `6fc5b91533` completes the two full-world
SDK emitters and treats explicit zero-cost/no-file rows as empty readiness;
`9e0aee064b` completes Sky root metadata while its island payload list stays sparse.
Registered producers preserve every declared binary byte. Retired 119 missing-L0
allowances (DW 47, Nine 30, Sky 42); L1 debt and cost caps are unchanged. Current
source metadata is 64 L0 for all six primary shards.

U1 product census (2026-10-24, sp-x2): pinned full preview `3c488ee9ab` exits 0
(gen 32 s / 24 products 17 s / Vite 15 s). All 24 published products have exactly
64 L0 rows and every interior 5 × 5 contains 25 rows, including Template, the
Blender template and all 14 open plots. Every index receipt and tile-section
hash/size passes the existing strict reader. The six primary products are:

| Product | L0 | L1 | Explicit empty L0 |
|---|---:|---:|---:|
| Driftwood | 64 | 0 | 47 |
| Pine | 64 | 16 | 0 |
| Nalati | 64 | 0 | 0 |
| Nine | 64 | 0 | 30 |
| Sky (`far-reach`) | 64 | 0 | 42 |
| Sunscar | 64 | 16 | 0 |

U1 is done; U2 L1 completion and the remaining T8 streaming work stay open.
U2's first safe slice (sp-x2, 2026-10-24, `9b179032ff`) excludes L1 from exact
`readWholeGeometry` defaults and Sky's exact island file list; explicit refs
keep their strict decoder and order. Complete, validated L0 rows prove only
these empty parents (no files or costs):

**T8 indexed-transport proposal verdict (2026-10-25, sp-x2): reject.**
This is a different route from skipped T8.2, sized entirely in memory.
No geometry files or producers were written. Original blob/section hashes
were checked before and after. Each candidate keeps material/node metadata,
transforms and triangle order; an independent packaged-buffer read expands
its index and compares every original attribute word. Already indexed parts
retain all original vertices and exact indices, including unused vertices.
The original whole-partition ordinal metadata is unchanged, so the current
native projection intentionally cannot accept the reindexed nonindexed parts.
Even before that decoder work, the transport is larger:

| B tile | Original GLB B | Indexed candidate B | Original gzip-9 B | Candidate gzip-9 B |
|---|---:|---:|---:|---:|
| 2/4 | 421,392 | 456,628 | 112,760 | 144,533 |
| 2/5 | 1,763,416 | 1,866,512 | 574,798 | 670,179 |
| 3/1 | 375,648 | 407,056 | 96,999 | 125,174 |
| 3/2 | 755,768 | 808,552 | 191,987 | 238,385 |
| 3/3 | 308,860 | 331,284 | 83,325 | 103,355 |
| 5/5 | 1,037,232 | 1,090,312 | 199,262 | 247,530 |
| 6/3 | 1,301,356 | 1,353,608 | 415,200 | 471,539 |
| 6/4 | 2,343,200 | 2,448,320 | 697,168 | 802,458 |

Only1,053 of239,539 native vertex records deduplicate (0.44%). All27 parts
retain source ordinals; there are no unmapped attributes to strip. The index
overhead defeats the small sharing. Keep B, its exact6/4 resident exception,
the grid and every cap. This is gzip-9 transport sizing, not a live network,
GPU, native-peak or retained-memory measurement. No implementation follows.


| Full-world emitter | Empty L1 parents | Occupied parents still needing actual coarse proxies |
|---|---|---|
| Driftwood | 0/0, 3/0, 0/1, 0/2, 0/3, 2/3, 3/3 (7) | 9 |
| Sky (`far-reach`) | 0/0, 3/0, 3/1, 0/3, 3/3 (5) | 11 |

Partial inventories and no-file children with nonzero cost/error refuse;
existing L1 rows and every sparse render/library payload remain unchanged.
Occupied parents are a far-LOD look question for Opus or Jake, not a Codex
row. Aliasing child files is not a proxy: e.g. DW parent 3/2 would sum
2,343,200 B wire / 4,673,742 B resident / 19,551 triangles / 7 draws;
Sky parent 2/1 sums 343,844 B / 661,096 B / 12,088 triangles / 9 draws.
These are child sums, not proposed L1 measurements; caps stay unchanged.
Both registered jobs reproduce all binary bytes: only their root tile metadata
changes among 340 declared outputs. Retired 12 exact missing-parent allowances.
19 focused cases pass; the related walk passed 1,612 cases plus its one repaired
peer case on a fresh run (15 product suites explicitly CI-deferred). Layer/root
types and named typed lint pass; the two-product build exits 0 in 23.02 s.
Verified index receipts confirm DW 64/7 and Sky 64/5 L0/L1 counts. No runtime
memory or frame-floor gain is claimed from empty declarations.
Sparse library payloads, geometry, budgets and current L1 debt are unchanged.

Isolated-stage repair `3a98cba178` adds the defining tileGrid input to all 13
full-emitter recipes. All cold stages pass (38 outputs, 6.86 s); 37 match the
checkout. The one difference was stale Signal sand R8 GPU metadata, not texture
bytes. `fcffbf03db` regenerates that file through registered `signal-sand`: only
shadow/trail GPU costs change (3,211,264 → 802,816 each), following the R8
calculation introduced by `ff8b90f6125`. All texture hashes and six other job
outputs remain exact. This corrects 3a98cba178’s overbroad all-output parity
sentence; no full CI generation result was claimed.

## One streamer, Pine and Nalati on it (2026-10-23, replaces T2's text and U3)

Traced at HEAD f81d5aade9 (full write-up below). **Correction:** Pine has **no terrain tiles** — its ground is the engine's whole `Terrain` (one 257² mesh, 4 splat layers), all 2,600 trees, ground cover, buildings and props are built whole on entry and stay loaded; its 26 L0 tiles are timber props only the grid draws. Nalati's painted ground is one mesh; its 64 L0 ground tiles sit behind an off-by-default Debug row. The four streaming modules: `grid/rings.ts` (full scheduler, neighbours only), `shardfile/clientRings.ts`, `shardfile/clientWorld.ts` + `residency.ts` (entered shard; copy-paste of reads, masks, distance; dead `rings` branch); `clientResidency.ts` is the home budget claim, not streaming. Terrain + Forest are also built twice (`bootstrap.ts:81-97`, `regionalWorld.ts:278-293`).

| Row | What | Lane | Size |
|---|---|---|---|
| S1 | **in flight (reading at plan end, G780):** source `30dcc15182`; host-bar and full-ring drive extended by `49aee2a303` (sp-o4 reports6/6 and1km/0holes). `engine/world/tileStreamer.ts` from RenderRings, with road/junction tile types; host-bar tests; same trace as today at 150 m, no hole frames | Codex | 2 d |
| S2 | **in flight (reading at plan end, G780):** shared adapter source `c2a06d82e6`; clientRings/clientWorld/residency retired and all three page/grid entry points use tileContent. Retained net-deletion/frame acceptance remains to be reconciled at final reading. One tile-content module; SHARD SELECT, grid region and neighbours all on S1; delete clientWorld, residency, the dead branch, rings.ts (≥ 200 lines gone, worst frame ≤ 100 ms) | Codex | 1 d |
| S3 | **in flight (reading at plan end, G780):** S3.1–S3.5 source below; Developer road-tile comparison is default-off. Final road MB, seam and frame acceptance remains open. Road tiles on the 62.5 m lattice (after T9) | Codex | 0.5 d |
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
| S1 | **in flight (reading at plan end, G780):** source `30dcc15182`; host-bar and full-ring drive extended by `49aee2a303` (sp-o4 reports6/6 and1km/0holes). `engine/world/tileStreamer.ts`, built from `RenderRings`: wanted sets by distance (N × N full ring, coarse ring, far, near); keys `{instance, level, x, z, type: shard\|road\|junction}`; parent-first masks; hysteresis; a lease per tile through an injected budget port (the engine can't import `grid/allocator`); per-frame count + bytes + ms budgets; a Scope per tile; `ready()` / `waiting()` | new engine module; `rings.ts` → deleted (tests move) | Codex | 2 d | host-bar six tests; Node 1 km drive gives the same trace as today's rings at 150 m; 0 hole frames |
| S2 | **in flight (reading at plan end, G780):** shared adapter source `c2a06d82e6`; clientRings/clientWorld/residency retired and all three page/grid entry points use tileContent. Retained net-deletion/frame acceptance remains to be reconciled at final reading. One tile-content adapter (clientRings + clientWorld's reads merged). SHARD SELECT (`client.ts:250`), the grid region (`regionalWorld.ts:164`) and grid neighbours (`session.ts:546`) all register instances on the one streamer; an entered cell is just the instance with the full ring | `clientRings.ts` → `tileContent.ts`; delete `clientWorld.ts`, `residency.ts` and the dead `rings` branch | Codex | 1 d | net deletion ≥ 200 lines; DW SHARD SELECT + grid: same tiles at the same pose; worst frame ≤ 100 ms |
| S3 | **in flight (reading at plan end, G780):** S3.1–S3.5 source below; Developer road-tile comparison is default-off. Final road MB, seam and frame acceptance remains open. Road and junction tiles as streamer types on the 62.5 m lattice (after T9 A, G638 D1) | `roadCull`, `roadLook`, `roadLayout` | Codex | 0.5 d | road resident only in the ring; road MB down; seams certified |
| S4 | Delete `runtimeWorld.ts` and `bindRuntimeProductTerrain` with sunscar-dunes-legacy | legacy-deletion plan | Codex | 0.2 d | 0 callers |

### (b) Pine onto it (after the DW slice)

| Row | What | Files | Lane | Size | Done when |
|---|---|---|---|---|---|
| P1 | **in flight (reading at plan end, G780):** `a6d1bf76c3` (SDK splat-ground bake), `4eaedf23bf` (Pine streams 64 L0 splat tiles), `410ade21d2`, `c3de94e718`, `574303b191` (the coarse L1 far ground). Bake Pine's ground as 64 L0 + 16 L1 splat terrain tiles from its existing heightfield + splat. The boreal look becomes a **material row** (`props.splat` with `boreal` + tints, drawn by `clientSplatTerrain`, the engine's own `splatTerrainMaterial`). The canopy map becomes a per-tile `_canopy` channel. The 257² collider stays shard-wide | `pine-hollow/generators` (terrain bake), `sdk/bake/terrain.ts` | Opus | 1.5 d | Pine renders from tiles with roughly the same look (G415 side-by-side) |
| P2 | **in flight (reading at plan end, G780):** a tiled ground builds no whole mesh (`9e6e110d3e`, sp-x2, after the retire path); bootstrap and regionalWorld share `Terrain.build`. The slab (perimeter walls, ~1.2k triangles) stays: no tile carries it. One ground path: `bootstrap.ts:81` and `regionalWorld.ts:278` build no whole `Terrain` when the shard declares tiled ground; the two native-world assemblies (bootstrap vs regional) share one builder | engine `Terrain`, `bootstrap`, `regionalWorld` | Opus | 1 d | Pine entered: no 257² mesh or slab; memory drop measured |
| P3 | **in flight (reading at plan end, G780):** `798fd807c6` (only the ring's trees draw), `7727dd0649` (the 3 × 3's trunks collide, one piece per tile). Trees per tile: `Forest` placements bucketed by tile into per-variant instance ranges (one InstancedMesh per variant per region); trunk colliders in the tile scope; the 5 × 5 is full, beyond it the L1 tile / near view | `engine/world/forest`, `forestPage.ts:152-168`, `models/place` | Opus | 1.5 d | draws ±10 %; 25 / 64 of the tree instances resident; 0 stuck in the physics walk |
| P4 | **in flight (reading at plan end, G780):** `b628882e61`. Ground cover per tile (the `ForestGround` layout bucketed; ranges per tile) | `looks/forestGround.ts`, `forestPage.ts:170-176` | Codex | 0.5 d | cover instances resident ≤ the 5 × 5 share |
| P5 | **in flight (reading at plan end, G780):** `c010d0a9f5` (the page runs the tile driver; landmarks by tile), `325c4e38db`. Pine world scenes per tile (T3 for Pine): placements, welds, the cave and landmark/prop colliders per tile scope; living-building logic, doors, saves and lanterns stay shard-global | `worldScenes.ts`, `forestPage.ts:64-96`, `clientForestPage.ts` | Codex + Opus | 1.5 d | the cabins, the cave and the King fight unchanged |

Stays shard-wide: sky, look, LUT, weather, water rows, the grass camera ring, sim, quests, audio index.

**Pine done when:** SHARD SELECT Pine entered memory drops by its T0 tile-local share × (1 − 25/64); no frame
over 100 ms after controls; Pine↔DW crossing at peak ≤ 1.2 GB.

### (c) Nalati (after its zero, G639)

| Row | What | Files | Lane | Size | Done when |
|---|---|---|---|---|---|
| N1 | **in flight (sp-o5, 2026-10-27):** N1a tiles on the ring and N1b far ground from the 16 L1 squares done (DR10 `488ca90929`, `ca190c4e97`); the spawn's ring loads first instead of all 64 tiles (`7c4ea78495`); the L1 tile rows (T8, `4177cc91fc`); a tiled ground never decodes its one whole mesh (this commit); the product no longer ships `world/terrain/ground.glb` (this commit; the minimap bake still reads the generated file). N1 done but its reading (memory drop, no frame over 100 ms) waits for a quiet window (G769). Painted ground on the streamer: its existing 64 L0 tiles + 16 new L1 (U2); the painterly ground material becomes a material row (painted-terrain family); delete the one-mesh path, the all-at-once tile path and the `groundTiles` row when Jake picks (T5's row) | `painterlyLook.ts:46-88`, `bake-render-tiles.mjs` | Opus | 1 d | memory drop measured; no frame over 100 ms |
| N2 | **in flight (reading at plan end, G780):** colliders by tile `03d72389ff`; WorldAssembly through T3's tile driver. The dressing's draws stay whole on purpose: each instance already culls at its own far range, and boulders reach ~300 m with no L1 stand-in (Nalati's L1 rows are runtime-bound), so a ring gate would empty the skyline. `WorldAssembly` and `SceneDressing` bucketed per tile, with their colliders in tile scopes | `worldAssembly.ts`, `sceneDressing.ts` | Codex + Opus | 1.5 d | physics walk 0 stuck; the Titan and the King unchanged |

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

## S1–S3 source slices (sp-x2, 2026-10-27)

| Slice | State | Change and validation |
|---|---|---|
| S3.1 Shared road lattice | source landed `920756cfb8`; reading at plan end | Platform road/deck/curtain clipping, bin identity, LOD edge protection and exact byte preflight use the same world-aligned62.5m grid. Retain single indexed draws/material, every interpolated attribute, turn-in geometry and full collision strips. Centred half-pitch arithmetic remains for explicitly unconverted callers and the original golden fixture. Added source-only lattice/UV/count assertions; tests not executed underG769. Game production/test types and four-path typed lint pass. Required ratchet attempted; D37 missing discovery refuses before counting, unavailable check skipped per coordinator. This is geometry preparation only: no ring eviction, resident saving or full S3 acceptance claimed. |
| S3.2 Owned compact tile producer | source landed `06d2536afb`, producer before residency reader | Compact every fine/LOD run into one independent vertex table per tile, preserve scalar type/normalization/attributes and triangle order, reject missing/range-invalid inputs, yield bounded copies and dispose partial geometry on cancellation. No whole-road array aliases escape. Return CPU/GPU byte plan including immutable and dynamic indices; caller must admit before publication. Game production/test types and two-path typed lint pass; two source-only ownership/refusal cases added, not run underG769. Required ratchet unavailable on D37 missing discovery; no generator/check bypass. Reader activation, eviction, road MB and seam acceptance remain open. |
| S3.3 Durable road tile backing | source landed `08d59cd2d0`, before residency activation | Bounded lossless archive preserves original scalar bytes, normalized attributes, all fine/LOD runs, tile identity and exact decoded admission bytes. Existing content store only: pin before durable publication, scope-owned release, quota/corruption/length/cost refusal; reloaded geometry is scope-owned and never aliases stored bytes. Original geometry stays owned on refused storage. Game production/test types and two-path typed lint pass; four new source-only codec/storage cases not run underG769. Required full ratchet attempted (foreign rises recorded in damage list); exact two-file shrink-only ratchet passes against an identical scratch baseline, with no baseline changes. Rendering/ring consumer still open; no memory or seam reading claimed. |
| S3.4 Scoped road residency consumer | source landed `b5e24085ae`, activation next | One indexed material draw joins only resident compact tiles, preserves every per-bin LOD and drops old plan/native buffers on replacement. Scope cleanup removes just its owned generation; no whole-road arrays retained by the pool. Existing TileStreamer/scopedTilePorts handle bounded reads/publication/cancellation, actual road/junction types and shared platform-owner budget, including explicit replacement working bytes; no invented parents or zero-cost claims. Source namespaces prevent independently prepared road pieces borrowing an allocator identity; existing initial/outer builds now use distinct allocation namespaces. Game production/test types, six-path typed lint and exact scoped ratchet pass with unchanged scratch baseline. Required whole-tree ratchet remains foreign debt (D53); three source-only pool cases, no executed tests/readings. Runtime archive capture/activation still open; no saving/seam claim. |
| S3.5 Archive capture and runtime handoff | in flight (reading at plan end), source landed `58badebecd` | Capture each detached road material on the62.5m lattice before first GPU upload; bounded compaction flushes one durable write before construction advances. Seal after both road halves, reveal the admitted ring, dispose whole-road buffers, then shrink their old claims to shared texture bytes. Per-tile scopes own eviction/reload; pools retain source shadow/order and one indexed draw/material. Run once per drawn view with clamped travel velocity. Developer Debug Road residency compares resident/current with tiles; default remains resident pending final reading, optional implementation loads lazily. Module-scoped native cleanup callbacks avoid retaining whole construction environments. Engine/game production+test types, twelve-path typed lint and exact scoped ratchet pass (same allowance counts, live baseline untouched); full-tree debt D53 remains. Two source-only shrink/refusal cases added; no tests/builds/readings underG769, no measured saving/closure claim. |

## Far-view quality (Jake, 2026-10-23: *"When we try the low detail stuff, it just looked like shit … when we made it render everything, then all of a sudden it looked good"*)

The far views looked bad because today's stand-ins are crude (decimated ~1.6 MB far proxies), not because stand-ins can't look good. The menu hero is a picture, so it is rendered offline at full detail (no run-time budget). In game, stand-ins are baked from the full-detail render (silhouette, colours, lighting; impostors captured from render-everything), shaded to match, behind mild haze (G631) with cross-fades instead of pops; a generous 5–10 MB per neighbour is still tiny next to a whole world (~300 MB). Render-everything (G607) stays the Debug option until Jake picks.

| Row | What | Lane | Size | Done when |
|---|---|---|---|---|
| F1 | Variant sheet (iPhone portrait, labelled): render-everything vs today's stand-ins vs improved baked stand-ins, from inside Driftwood looking out (3 views) and the hero angle, each with WebContent + GPU MB | Opus | 0.5 d | Jake picks by eye |
| F2 | The picked stand-in for every shard (bake step per shard, far budget per G658 crash-line count) | Opus + Codex | 1.5 d | far views match the pick; memory recorded |
| F3 | Menu hero rendered offline at full detail and shipped as an image (no run-time streaming) | Opus | 0.5 d | hero matches the original framing; costs no run-time memory |

T7.2 (2026-10-27, sp-x8; source `eb322baa11`), in flight (reading at plan end): render-only approach pins start after the admitted neighbour tile offer rather than awaiting life-script and panel construction. Actual entered data still waits for complete admission and original input cleanup. No residency, readiness, transfer or memory-cap widening; G782 warm/cold numbers remain unqualified. Game/test types, typed lint and scoped ratchet pass.

T7.3 (2026-10-27, sp-x8; source `7bdee7d1ad`), in flight (reading at plan end): retarget one render-only approach pin when the destination-local entry tile changes, aborting the old pin first. Same-tile movement keeps its request; destination and pose jumps retain original heading and distance fences. No world/resident/readiness widening. Types, typed lint and scoped ratchet pass; controls unexecuted under G769, G782 times unqualified.

T7.4 critical entryway prepin (2026-10-27, sp-x8; source `7e6ab09316`), in flight (reading at plan end): after the approached spawn ring is resident, pin the missing tiles from the same declared entryway set required by actual entry. Keep spawn-first priority, parent-first scheduling, the single approach owner and original allocator/readiness fences; release both phases on abort. No extra whole-cell coarse pin. Game/test and fixture types, typed lint and scoped ratchet pass; ordered-coverage controls added but unexecuted under G769. G782 cold/warm timing remains unqualified.

T7.5 tile caster CPU (2026-10-27, sp-x8; source this commit), in flight (reading at plan end): scan missing ordinary static geometry boxes in exact incremental steps under the existing construction budget before tile shadow classification. Preserve native world-box arithmetic, traversal order and every floor/glow/caster rule; custom, shared and dynamic sources retain native bounds. Owner/mutation fences abandon partial scans. Game/test and fixture types, typed lint and scoped ratchet pass; native-box/shadow controls added but unexecuted under G769. No G782 gain claimed.

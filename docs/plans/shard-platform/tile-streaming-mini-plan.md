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
| T0 | Census: each shard's entered world split into tile-local and shard-global MB (DW, Nalati, Pine, Nine, Sky) | glbytes census + allocator claims | Codex | 0.5 d | done (2026-10-24, sp-x8): pre-implementation cost model above; CPU backing DW/N/P/Nine/Sky 41.74/40.84/78.57/44.41/20.22 MiB; bounded outside-5x5 0.01–2.69/1.93–6.77/0.87–7.19/0–0/0–0.62 MiB; unknowns retained; retirement proof T1/T3  Plan-end Chromium current-share ranges (5f1/bc0): observed GPU25.48–212.49 MiB, scene CPU2.19–54.73 MiB; unknown GPU0–41.25 MiB retained. Per-shard values below; Nalati/Nine unavailable, no causal savings or native-budget PASS.  Repaired-pin a423 recovery adds Nine: GL233.77 MiB, scene CPU43.71 MiB, unknown GL20.08 MiB in both rings; detailed capacity/closure table below. Nalati remains unavailable.  Final Nalati325 continuation measures GL213.28/214.06 MiB and scene CPU39.33/40.10 MiB; all eight families now have spawn observations across explicitly different repaired pins, not one matched-source cohort. | — |
| T1 | Leak-free disposal: finish O18 (sp-o3); ghost counter per tile and region scope | `grid/live.ts`, new `grid/ghosts.ts` | Codex | 1 d (+ sp-o3) | **done (2026-10-24, sp-x9; G710 settled sample):** 196 observed tile lifetimes / five returns; settled R4→R5 +10.62 MB, ghosts 0/0; old warm-up-baseline grade remains FAIL as detailed below | sp-o3 |
| T2 — done (2026-10-27, sp-o4; G790 as written): the host is `engine/world/tileStreamer` (moved there by `30dcc15182`, named so rather than tileResidency), rings.ts its first user and deleted there, clientWorld.ts folded into `game/shardfile/tileContent` by `c2a06d82e6` (-277 net lines); rectangles of any size, full N x N ring (`setFullRing`) + coarse L1 / far ring, parent-first, no holes, hysteresis cache, per-frame uploads / bytes / ms, scope + lease per tile (`scopedTilePorts`), road and junction kinds; host bar 6 / 6 (docs/HOST-BAR.md, Audits); the original 1 km trace holds (`test/tile-streamer.test.ts`) and a 5 x 5 full ring on that drive keeps <= 25 fine tiles a cell with 0 holes (this commit) | Engine tile residency host (`engine/world/tileResidency`): rect tiles of any size, N×N full ring + coarse ring, parent-first, no holes, hysteresis, per-frame bytes and ms budget, scope + lease per tile. `rings.ts` and `clientWorld.ts` become users (net deletion); road and junction tile types | `game/grid/rings.ts`, `shardfile/clientWorld.ts`, `residency.ts` | Codex | 2 d | host-bar six tests; Node 1 km drive: resident ≤ 25 + ring, 0 hole frames; same trace as today at 150 m | — |
| T3 | Per-tile content: placements bucketed by pose (no rebake) into per-model instance ranges; welds / merged / baked sets by triangle centroid; registry colliders per tile scope | `worldScenes.ts`, `worldScenePlacement.ts`, `bakedTiles.ts`, `sdk/bake/worldGlb.ts` | Codex + Opus | 3 d; **in flight, reading at plan end** (2026-10-27): graphical half landed: placements one draw per model with per-tile ranges `c7fea585c9` + `05f36994af` + collider fix `f0b26c3831` (sp-o1), welds by tile `160b8c4bb4` and baked sets + collider scope `5df7f9f615` (sp-o5), on T3.I `06d63e5b21`; non-graphical placement buckets sp-x1. **Row-end proof** (iPhone 16 Pro, phone tier, 60 frames once draws held 3 s; before = deployed pin `653f0abe85`, after = `5f1eadb19e`): DW draws spawn 253-372 → 257-338, beach 266-363 → 270-367, wreck 78-129 → 78-129 (minimum +1.6 / +1.5 / 0 %, inside ±10 %), triangles within the same spread; 5 × 5 spawn, beach and wreck frames match (no weld or baked tile missing; only clouds and the new minimap tile overlay differ). Walk baseline on `f0b26c3831`: DW 8 legs 0 stuck twice (bridge end 12.243 / 12.298 against 12.289; the first run on `5f1eadb19e` stuck the bridge once, drawn-hull tile colliders, fixed in `f0b26c3831`). Pine legs not run: Pine fails to load on HEAD ('Missing admitted raw return module loan', routed to sp-ci-deploy) | DW draw count ±10 % of today at the same pose; no visual diff in the 5 × 5 | T2 |
| T4 | The entered world streams (H3 generalised, joined with sp-o1): shard-global state + rank-0 tiles before controls, the rest via T2; SHARD SELECT and grid | `grid/liveSession.ts` `enterInitialHome`, `shardfile/client.ts` | Codex (sp-x2, G708) | ≤1 h slices below | **done (latest path qualifications):** grid30f cold/warm9.899/12.478s,45/41ms worst; compiled730f cold/warm7.108/7.424s,81/96ms worst, PASS100ms. Pins differ and one cohort each supplies no causal gain claim; no standalone M1 exists for a percentage claim.  Plan-end control observations on repairedbc0: Pine18.941/18.511s; compiled-only Night Market6.464/6.088s (3x3/5x5). These are fresh-context first-observed control walls, not warm crossings. Nalati/Nine readiness unqualified; no new T4 milestone PASS.  Latest a423 recovery: Nine controls17.388/18.558s (3x3/5x5), both miss15s cold; Nalati2x120s readiness refuses. Historical cold/warm path passes do not qualify these rows.  Final Nalati325 controls14.710/15.047s:3x3 below15s,5x5 misses47ms. Nine a42317.388/18.558s remains a cold miss. No extra warm or grid acceptance. | T2, T3 |
| T5 — reopened by G775 (Jake: build as written: overlay + 3x3/5x5/whole Debug row); in flight (reading at plan end, G780). **T5.1** code landed (sp-o5, this commit): Developer ▸ Debug ▸ Performance ▸ Tile residency (5 x 5 shipped / 3 x 3 / whole cell, a reload; `tileRing()`); **T5.2** source landed, runtime reopened (sp-o5, this commit): with Developer on, a SHARD SELECT world's minimap shows every tile border, the resident render ring (green) and collider 3 x 3 (amber), and each tile's declared MB (`tileOverlay.ts`, `Minimap.setDebugExtras`); **T5.3** source landed (sp-o5, this commit): the same borders and resident ring on a grid page's entered cell (`GridSession.tileOverlayState`), and each resident tile's declared MB from the entered cell's admitted product (sp-o2, this commit) | Debug row "Tile residency: 3 × 3 / 5 × 5 / whole shard" (A/B/C, E451) and a Developer overlay (tile borders, resident colour, MB per tile) | Settings Debug, minimap | Opus | 0.5 d | Jake can feel it on Driftwood (first playable slice: T2 + T3 (DW only) + T4 + T5)  Plan-end: DW clipped paint18/24 rectangles +2 labels, Pine18/24 +1; Sky/Signal/Template/Night Market0/0 despite resident fine tiles. Generic data-world telemetry source fixedf1222a6cfd; both reading pins predate it, so this remains in flight.  Latest a423 Nine native overlay observed24/26 rectangle records and9 unique MB strings. This does not reread the previously missing generic data-world overlay; f1222a6cfd remains source-fixed, not broadly browser-qualified.  Final Nalati325 paints18/24 rectangle records but0MB strings, so label coverage is still unqualified; source audit finds the collider-only sceneDressing driver registers without tile-byte metadata (candidate seam, not a proven fix). | T4 |
| T6 | Creatures, NPCs and figures by tile: presentation in resident tiles; brains global, dormant outside 5 × 5; patrols that cross tiles hand over | population, quest figures | Codex | 1.5 d | DW boar / captain fights unchanged; memory drops by its T0 share | T3 |
| T7 — in flight (G782 reading completed; misses open; source `d27bab4e35`, `17a5b1a5c0`, `7a06597f33`, `e38c4ef905`; retained controls `4dbf4b1160`); G780 `5f1eadb19e` reading completed, G782 still open (three cold/warm runs below) | Crossings by tiles: neighbour region = small state; tiles by distance; the source evicts behind the player; delete whole-world `warmAhead` and the 4-world cap | `grid/live.ts`, `liveSession.ts`, `hybrid.ts` | Opus + Codex | 2.5 d | DW↔Sky ×5 on Chromium phone tier: peak ≤ 1.2 GB per shard, back to baseline ±20 MB, every crossing under 5 s warm and under 8 s cold (G782; was < 5 s), worst frame ≤ 100 ms  Called plan-end5f1 cohort: both road modes refused initial home seed streaming at120s before any crossing/census. Zero measured legs; cold8s/warm5s,100ms and memory-return gates remain unqualified. Routed sp-x8; no retry.  Latest authorized a423 recovery still misses initial staging: Resident120.341s/Tiles120.315s, home ready/entered/crossing settled but8far preparations in flight and0publishedfar. Zero measured legs/returns, not a crossing or memory PASS. Exact boundary routed sp-x8, D110. | T1, T4, T6 |
| T7.1 — superseded by T7.7–T7.10 ( source `379647e12b` + `e5f73af853`) | Approach declared tiled destinations through the existing render scheduler, pinning only their entry ring. No regional constructor or entered-root replacement on a guess. Abort the pin on redirect, distant departure, owner retirement or completed entry. While pinned, the whole-near fallback permits fine refinement; masks still cover partial parents. Releasing the final pin restores its old refinement policy, and registration disposal releases all pins. Actual demand retains all runtime/save/collider/readiness gates. T7.7–T7.10 remove every speculative whole-world constructor, paired-world budget port and the four-product selection cap; neighbour preparation owns tiles only. | `grid/live.ts`, `liveSession.ts`, `session.ts`, `shardfile/tileContent.ts` | sp-x8 | bounded slice | types + typed lint + scoped ratchet clean; full ratchet stops on D37; D47 fixed `15f149539c`; cause-fixed preview `8422baac07` passes generation then refuses new Nine coarse L1 debt (`82ac81812d`, sp-o5), zero browser samples; runtime/G782 qualification still blocked | T2, T4, T6 |
| T8 | Every shard on tiles, all seven as written (G790: Nalati, Pine, Nine, Sky, Sunscar, open plots, template); complete grid plus bounded tile costs and fine-file ownership | shard generators / shared SDK tile producer | sp-x2 / sp-x10 / sp-o3 / sp-o5 | ≤1h slices | **in flight (2026-10-27):** the old four-tile split is not done merely because metadata now has64L0. Current audit below: Pine wire cut in this commit; Nine dense L0 work sp-o3; Sky whole fine-library ownership sp-x10; open-plot cost/draw work sp-x2. Nalati/Sunscar/Template retained64/16 grids have no cap debt, not fresh runtime qualification. Preserve Driftwood B and its exact6/4 exception; D87 lossless coarse repair b80fee8ea6 is separate. No previews/readings until plan end (G780).  Plan-end measured6/8 families at both ring choices: DW6/15, Pine6/15, Sky8/14, Signal9/25, Template9/25, Night Market9/25 observed render keys (edge-clipped actual scopes, not proof of every expected key). Nalati/Nine unavailable. Declared resident closures and whole-fine comparisons below; no all-seven runtime PASS.  Authorized a423 recovery now measures Nine9/11 render scopes and9collider scopes,132.93/151.55 MiB declared fine closure versus160.49 MiB all-fine. Nalati remains blocked before controls. No all-seven runtime qualification.  Final source-repaired Nalati325 now reaches controls with6/15 render and6collider scopes:1.35/3.40 MiB declared closure versus14.38 MiB all-fine. Every family has a spawn record across pins; cold/overlay/T7 memory misses keep the full milestone in flight. | T3 |
| T9 | G638 picked A: 62.5 m gap, pitch 562.5; asphalt unchanged at 15 m, side strips 23.75 m, seams/junction/routes follow the lattice | strips, roadLook, roadLayout, config | Codex (sp-x6) | 2 d | **done** (2026-10-24): runtime `ae2dca27dc`; native 15/30 m/s peer routes each 4 crossings / 0 stuck; labelled phone road/junction witnesses; current-origin `57d1344dc1` EWNS held walks all complete / 0 stuck / gates open. [Compact receipts](../../../progress/shard-platform/tile-streaming/t9-lattice.md); T1 retirement and T10 broader milestone stay separate | T2 |
| T10 — in flight (source complete; official Simulator reading last, G777) | Delete whole-shard entered loading and Whole cell Debug choice after all-seven T8 | tileContent.ts, tileResidency.ts, debugOptions.ts, engine/strings.ts | sp-x2 | Source deletions89f7d3598a,9e6e110d3e,45086a7db8,404b717e02; final source audit2026-10-27 | All-seven T8 producer/runtime ownership confirmed by coordinator. No permanent distant-L0 coverage or radius8 choice remains. Entered render rings stay3x3/5x5, colliders at most3x3, occupied fine rows require nonempty coarse parents. Preserve coarse/far landmarks, shared library/state and G606 frozen LEGACY. Current engine/game tsc-b and four-file typed lint pass. No new preview, product, tests or Simulator; final reading stays last, and recorded T7/S3.7 misses remain open. | T8 |
| T11 (stays open, G775; G761 had closed it because Pine and Nalati draw far content whole) | **done (sp-o1, plan-end reading on `db62fede6c`, 2026-10-27):** code `325c4e38db` + `8bfa934fe4` (sp-o5): Pine's crag cliff, boulder and scree places tile with a coarse copy drawn beyond the ring up to its edge; the crag skin and the waterfall and streams draw whole, so they never leave. Reading (Pine standalone, Chromium iPhone 16 Pro phone tier, Developer on, facing the north ridge, 3 × 3 and 5 × 5): the waterfall, its spray and the crag skin draw at every pose; the coarse cliffs draw every on-screen copy the ring leaves out (62 of 81 in view from spawn, the rest off the frustum); full + coarse copies are equal across rings (z 0: cliffs 62 = 62, boulders 5 = 5; z 40: 62 = 62, boulders 0 + 32 = 22 + 10) and the 3 × 3 / 5 × 5 views show the same spires and lookout (only the trees take their far stand-in). Crag boulders draw coarse past the 3 × 3 ring (z 80: 22 tiled + 33 coarse), scree up to its own far; past the rows' authored phone `far` (boulders 170 m, scree 110 m, cliffs 900 m) they cull as the whole build did, which is not ring eviction. Mossy boulders are tile props, not landmarks, and leave with the ring. Draws / triangles 3 × 3 vs 5 × 5: spawn 208 / 1.02 M vs 241 / 1.11 M; z 40 214 / 1.05 M vs 309 / 1.21 M; z 80 252 / 1.01 M vs 366 / 1.11 M. One gap: the coarse cells test the frustum and the tiled cliff rows do not (`frustum: false`), so 11 off-screen cliff copies at z 80 cast no shadow at 3 × 3. The walk on to z 110 crashed both rings (T6.2's lease × mip retirement, `boar-albedo … lost its allocation after mip retirement`), fixed in `7ebe3b9fac` (sp-o3, D121): on `4715cf3491` the walk (0,-235) → (0,140) passes at 3 × 3 and 5 × 5 with 0 errors. Far landmarks survive the ring: authored landmarks beyond the N×N ring (Pine crag spires, waterfall) draw a coarse stand-in from their LOD / impostor in the coarse ring, evicted only at its edge (found by sp-o1 at 5 × 5, 10-23) | tile residency, landmark LODs | Opus sp-o1 | 0.5–1 d | Pine spawn view at 5 × 5 shows the spires and waterfall | T2 |

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
| T10.4 Refuse empty coarse declarations | in flight (reading at plan end), source landed `404b717e02` | An occupied rendered fine tile requires a declared and nonempty coarse parent (draws or triangles), before any instance/root/lease mutation. Empty metadata cannot stand in for actual T8 coverage. Keep original missing-parent guard and every other entry/prediction phase. Game types, scoped root fixture types and touched typed lint pass. One new source-only no-mutation case; no tests under G769. Plan-end preview ofc2f refused the stale Storm Titan catalogue, repaired byf9c82f42b2; containing291c84c140 passes generation then refuses Driftwood coarse wire (D87), so no browser/sample/parity/memory/frame verdict. No more preview queued; caps and G606 unchanged. |
| G720 Data-cell entry coverage | done (`cb756b79df` + this capture commit) | Data-only entry awaits admitted views and required coverage; existing uploaded views survive same-root borrowing. On phone tier, first in-cell sample has 16 L1/15 L0 and no far proxy, 0 ms waiting inside. [Capture and timings](../../../art/grid/round-63-night-market-entry/README.md); no frame-floor claim. |
| G721.1 Board structural collision | done (`22248f9b6a`) | Separate terrain filtering from surface material: admitted structural meshes stop the board after fresh install and native restore; terrain springs retain their existing heightfield bypass. |
| G721.2 Shared plot kit and walk | done (`49af17b6b6` + this capture commit) | Shared lamp/stall posts register through the existing physics bake; eight render hashes exact. Full pinned build 0; Night Market walk 3/3 complete, 0 stuck, board escape 0 outside frames. Four-second held-forward check stops outside the wall, 0.16 mm final-second travel. [Phone capture and route](../../../art/grid/round-64-night-market-collision/README.md); no new collider ring policy. |
| G721.3 Routed data-entry stall | done (`1138f0564c` + this capture commit) | Exact 0dd Blender stops on the unchanged edge-tagged transfer fence after passing the road mouth; its required tiles starve behind eight Sunscar background fetches. Prioritize pinned tiles/parents and cancel only unfinished unpinned fetches, same cap and readiness fences. Actual phone-tier Blender/Ember/Night Market entries all ready/errors 0; [failure and fixed portraits](../../../art/grid/round-66-required-entry/README.md). |
| G724.1 Immediate-return retention | done (`54c753f9ca`; guarded G723 extension `2888459ba9`) | Keep the last entered source on the road; prediction cannot retire it. Opaque/over-budget factories keep retire-before-allocation. Explicitly isolated preparation may hold source + incoming under the strict 1.8 GB page / 1.2 GB owner checks, with complete source disposal before destination entry; a U-turn cancels incoming and reuses source. Save/refusal and activation fences stay intact. G723's native memory/timing witness remains separate. |
| G725.1 Grain ownership | done (`774305c6a4`) | Trace the real cinematic carrier/strength across cell exit; grain is zero on the road and cannot stack. Preserve each live region's authored strength. |
| G724/G725.2 Phone milestone | done (this capture commit) | Real road → DW → road → DW: retained activate 17.7 ms; 0 loading panels/static; one resident world. Request-to-ready 1.033 s includes walking the existing 6 m pre-interior strip, not a loading stall. [Phone portraits and exact timing boundaries](../../../art/grid/round-65-warm-return/README.md). |
| G630 Aerial terrain follow-up | done (`0ce626a8f5` + this capture commit) | Detached painted ground stays cell-local after grid rebasing. Red-before regression and attached-transform control pass. Exact shipped hero camera now shows complete Nalati terrain at both 62°/43°, same 18 L0 draws, errors 0; [shipped/fixed board](../../../art/main-menu-hero/round-6-nalati-terrain/README.md). Tile counts/caps/artwork and shipped title images unchanged. |
| T6.1 Dormancy / snapshot contract | done (contract-only slice below) | Current-position membership, exceptions and exact snapshot/RNG pins; no brain or native-sim schedule change. |
| T6.2 Presentation lease / rebind | in flight (reading at plan end; `0bec059f9f`, sp-o3) | Entry 5x5 census: Pine dormant-only ~14.4 MB GPU (antler-king and two bear rigs, 5 bear coats), above its T0 band; DW ~0 (one shared creature bank); Nalati marginal (bitmap coats, not leasable). Last-reader lease of file-backed KTX2 textures: a model asleep 10 s gives them back unless an awake model of any factory reads them; a waking model stays dormant until they are refilled into the same textures (no rebind, no pop-in); generic, Debug Tile residency only. DW boar-fight Chromium capture at plan end. |
| T3.I Instanced recipe parts by tile | done (sp-o5, `06d63e5b21`) | A step's instanced part sorts its instances once by tile; one draw whose first `count` instances are the resident tiles', every per-instance channel compacted alike. Parts with their own per-frame hook (a culler) or in one tile stay whole. Measured at Driftwood's spawn: 253/334 draws and triangles unchanged before/after (its foliage already streams as cove dressing); generic for recipe parts. |
| T8.1 Complete-L0 bake fences | done (`7093891d97`) | All 24 products declare 64 L0 slots; strict caps and the exact 6/4 exception remain. |
| T8.2 Driftwood lossless route | in flight (reading at plan end; source `39441c439c`, sp-x9) | G790 supersedes low-value wait: generic named-tile encoder runs before hash/cost derivation; Driftwood opts only 0/2/4 into strict gzip-9 lossless meshopt. Exact retained words/scene and byte/cost record below. Remove only its old wire debt; all other caps/rows and Jake B remain. Product/GC reading stays at plan end. |
| T8.3 Occupied L1 appearance | in flight (reading at plan end, G780) (sp-o5; G748.5 Sky `60535f5995`, G748.6 Driftwood `806ea146aa`, Nine `82ac81812d`, Nalati `4177cc91fc`, G748.7 Pine `f18c504569`) | Real coarse stand-ins for occupied tiles beyond the render ring, per shard in its own style. |
| G748.1 Entered far stand-in | done (sp-o5, this code commit; Developer) | The entered cell draws its own near view beyond the render ring: ground triangles (all corners within 1.2 m of its terrain) left to the real ground, the ring's tiles masked per fragment (8 x 8 positional far mask). No new bake or file. |
| G748.2 Per-shard check | done (sp-o5, `dc2e445ae6`) | Opt-in per shard (`world.assembly` row `farStandIn`): Driftwood gains its far palms; Pine and Nalati draw their far content whole today (no change); Nine draws its city whole and the stand-in only darkened it (left out). Sky, Sunscar, template and plots run no world assembly. |
| G748.3 Boards | done (sp-o5, this commit) | `art/tiles/round-1-l1-standins/board.jpg`: Driftwood today vs stand-in, aerial and from the pier, iPhone portrait; for wildshard-v to take to Jake. |
| G748.4 Ship | done (sp-o5, this commit; Jake G761) | Driftwood draws its stand-in in the public build (the Developer gate is gone). Nothing else is superseded: past the ring it drew only its landmarks' coarse copies (T11), which stay. Other shards opt in (`farStandIn`) as their boards are approved. |
| G748.5 Sky coarse L1 | in flight (reading at plan end, G780) (sp-o5, `60535f5995`, build-output fix `76de4af8d8`; G769 recommended look) | Sky's 11 occupied L1 parents draw its isles simplified in their own toon look (`coarseCopy`: meshopt 10 %, 2 m error, borders locked) as the props bake's coarse source; 16 / 16 L1 squares, every tile under the provisional 200 KB cap (largest 191 KB). |
| G748.6 Driftwood, Nine, Nalati coarse L1 (T8, G786) | in flight (reading at plan end, G780): Driftwood done (sp-o5, this commit): 16 / 16 L1, its 9 occupied parents draw the fixed world's coarse copy (`coarseTiles.ts`: rows from the fixed-models job, bytes from the product's output hook, nothing under src); Nine done (sp-o5, this commit): its 12 occupied parents draw the city's coarse copy with every Nine channel kept (props bake `coarseWhole`, one piece per L1 parent; 5 %, 3 m; largest 1.0 MB resident), its library keeps L0 tiles only. Nalati done (sp-o5, this commit): its 16 L1 squares are tile rows too (`bakeNalatiWorldRowsLod`, the 1 m policy, largest 340 KB; runtime-bound like its L0 rows, so the painted ground never draws them twice). T8: every shard now has coarse L1 for its occupied parents (Driftwood's rows return through sp-x10's fixedProgram move). |
| G748.7 Pine far stand-in | in flight (reading at plan end, G780) (sp-o5, this commit; G769 recommended look) | Since P3 Pine's trees draw only on the resident tile ring, so its far hills went bare like Driftwood's; the forest page row's `farStandIn` (format/forestPage) adds the page's own near view beyond the ring (the same `farStandIn` content as Driftwood's world assembly, G761). |
| T8.N1 Nine empty parent declarations | in flight (reading at plan end; sp-x10; b1f6916531) | Shared completeEmptyL1Tiles fills four proven-empty parents (0/0,3/0,0/3,3/3),12 to16 L1, without changing any original row or byte. Types, named lint and staged ratchet pass. Nine dense L0 and fine-library reader migration handed to sp-o3 at this natural boundary; its G773 build budget was unused (0/1). sp-x10 owns Sky and Sunscar confirmation; sp-x2 owns Pine/open plots/Nalati/Template and lossless props transport. |
| T8.N2 Nine on tiles via T3 | in flight (reading at plan end; sp-o3, proof only, no new code) | Nine draws its city as boot-resident whole weld kits assembled from all 64 L0 files (86.7 MB wire, 168 MB resident, 181 tile draws; centre 3/3 31.9 MB / 240,585 tris, exact debt rows). T3's weld slice `160b8c4bb4` already ranges each kit by tile in one draw. Chromium phone capture at spawn on `836305c49e`: 5x5 249 draws / 1.28 M tris, 12 of 29 kits ranged; 3x3 203 draws / 1.08 M tris, 19 of 29 ranged (the rest lie wholly inside the ring); same picture, 0 errors. Streaming the L0 bytes would save 5.4 MB of 168 MB at spawn (1.5 MB at centre 4/3) with kit buffers whole, so it is not built. |
| T8.P1 Open-plot L1 render states | in flight (reading at plan end; sp-o3, `1361eb295e`) | Generic tiledPlot.mjs: water, pools, posters, landmark and ring paving draw only at L0; L1 stand-ins on the kit material in vertex colours (no texture). Night Market: every L1 tile 2 draws (Kit, Glow), 23-49 KB compressed (was up to 3.0 MB), 114-224 KB resident (was up to 11.1 MB); 40 L1 debt rows removed, L0 unchanged; wire 16.05 -> 15.07 MB. Plaza aerial on `bc0c7cf54f`: near 110 draws, far 150 draws, 60 fps, 0 errors, gate and posters unchanged at L0. |
| T8.S1 Named whole tile surfaces | in flight (sp-x10;8e100aab26; reading at plan end) | Generic bakeProps opt-in materialName names merged and whole surfaces for the existing props.materials reader; whole overrides the merged fallback. Omitted names preserve predecessor output. Types, named lint and staged ratchet; no product build or test run. |
| T8.S2 Scoped cold whole reader | in flight (sp-x10;fd2d774de7; reading at plan end) | Explicit Explorer-only models borrow admitted L0 GLBs through the original product/scope/cache/cancellation reader. Resident libraries retain the library membership guard; coarse and non-GLB files refuse. Cold/cached fixtures added; types, named lint and staged ratchet pass. No product build or test run. |
| T8.S3 Sky fine ownership | in flight (sp-x10;8bf41b2b33 + T8.S4; reading at plan end) | Static island draws move to the generic named-material tile reader; resident ground keeps only original identity/transform/contact anchors. All22 fine GLBs leave the resident library, with their real library costs removed; every tile channel/transform/partition ordinal stays exact (33 L0/L1 binary and non-material JSON comparisons). Original paint IDs and the coarse toon surface are retained. Explorer-only whole models borrow only each island's1–4 admitted fine files; maps keep the original ground recipe and cosmetic stream. Types and named lint passed; staged ratchet refused the pre-existing direct format type import, repaired in T8.S4; no test run. The earlier11.8s Sky64/16 build is pre-migration bake evidence only,1/1 G773 spent; exact new ownership qualification remains for plan-end reading. Sunscar source confirmation:11.1s fresh build64/16,16 full5x5,zero debt; all80 terrain rows have the generic reader, no fine GLB in its resident library. Sunscar G7731/1; runtime reading remains open. |
| T8.S4 Author scene type repair | in flight (sp-x10; reading at plan end) | Immediately repair T8.S3's staged ratchet refusal: groundScene's pre-existing direct format type import (e52f0fcd174; raw count1 before/after8bf41b2b33) had a zero recorded allowance. Derive those same types from the existing SDK worldSceneRecipe author API, raw count1 to0 with no policy bump or runtime wire change. The T8.S3 commit started before its failed result was inspected; its message's ratchet-pass claim was incorrect. This repair lands only after types, named lint and required staged ratchet are actually green. |
| T8.S5 Sky source oracle migration | in flight (sp-x10; reading at plan end) | Resolve the routed scene-buffers Sky case: exact island reconstruction inspects only fine partitions, never L1 proxies without assembly ordinals; strengthen containment to exact per-model file equality and require the Explorer-only declaration. Advance complete ground/world scene pins for T8.S3's intended anchor/cold ownership change (1849B /313596B), preserving every identity, transform and geometry-channel assertion. T8.S4 import repair is ea17216743. Types, named lint and scoped ratchet pass; no tests/build/preview run. |
| T8.S6 Original island receiver flags | in flight (sp-x10;3f011d28a7; reading at plan end) | Preserve the original scene's receiveShadow=false on fine island meshes through opt-in PropWhole.receiveShadow and the generic props reader. Omitted flags retain predecessor bytes and the existing true reader default; no shard branch or material edit. All33 binary channels, transforms and partition ordinals still match the original; only material names and explicit receiver extras differ. Add default/false/true reader coverage and preserve full scene/publication hash checks, including the mill intake's complete world/blob inventory. T8.S5 routed oracle fix landed5f1eadb19e. Types, named lint and staged ratchet pass; the routed foreign boot-test allowance was retired in8cc9699c0e. No extra product build, tests or preview. Sky/Sunscar source queue complete; exact runtime qualification remains open for plan end. |
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
| 2/4 | 421,392 | 204,840 | 112,760 | 105,982 | In flight T8.2 / G790: source `39441c439c`, -6,778 B gzip; decoded charge recorded below |
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
| S3 | **in flight (reading at plan end, G780):** S3.1–S3.6 source below; Developer road-tile comparison is default-off. Final road MB, seam and frame acceptance remains open. Road tiles on the 62.5 m lattice (after T9) | Codex | 0.5 d |
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
| S3 | **in flight (reading at plan end, G780):** S3.1–S3.6 source below; Developer road-tile comparison is default-off. Final road MB, seam and frame acceptance remains open. Road and junction tiles as streamer types on the 62.5 m lattice (after T9 A, G638 D1) | `roadCull`, `roadLook`, `roadLayout` | Codex | 0.5 d | road resident only in the ring; road MB down; seams certified |
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
  - B (historical alternative) is superseded by T10: only3x3/5x5 remain; actual tiled pages skip full-ground drawing (`9e6e110d3e`).

</details>

## S1–S3 source slices (sp-x2, 2026-10-27)

| Slice | State | Change and validation |
|---|---|---|
| S3.1 Shared road lattice | source landed `920756cfb8`; reading at plan end | Platform road/deck/curtain clipping, bin identity, LOD edge protection and exact byte preflight use the same world-aligned62.5m grid. Retain single indexed draws/material, every interpolated attribute, turn-in geometry and full collision strips. Centred half-pitch arithmetic remains for explicitly unconverted callers and the original golden fixture. Added source-only lattice/UV/count assertions; tests not executed underG769. Game production/test types and four-path typed lint pass. Required ratchet attempted; D37 missing discovery refuses before counting, unavailable check skipped per coordinator. This is geometry preparation only: no ring eviction, resident saving or full S3 acceptance claimed. |
| S3.2 Owned compact tile producer | source landed `06d2536afb`, producer before residency reader | Compact every fine/LOD run into one independent vertex table per tile, preserve scalar type/normalization/attributes and triangle order, reject missing/range-invalid inputs, yield bounded copies and dispose partial geometry on cancellation. No whole-road array aliases escape. Return CPU/GPU byte plan including immutable and dynamic indices; caller must admit before publication. Game production/test types and two-path typed lint pass; two source-only ownership/refusal cases added, not run underG769. Required ratchet unavailable on D37 missing discovery; no generator/check bypass. Reader activation, eviction, road MB and seam acceptance remain open. |
| S3.3 Durable road tile backing | source landed `08d59cd2d0`, before residency activation | Bounded lossless archive preserves original scalar bytes, normalized attributes, all fine/LOD runs, tile identity and exact decoded admission bytes. Existing content store only: pin before durable publication, scope-owned release, quota/corruption/length/cost refusal; reloaded geometry is scope-owned and never aliases stored bytes. Original geometry stays owned on refused storage. Game production/test types and two-path typed lint pass; four new source-only codec/storage cases not run underG769. Required full ratchet attempted (foreign rises recorded in damage list); exact two-file shrink-only ratchet passes against an identical scratch baseline, with no baseline changes. Rendering/ring consumer still open; no memory or seam reading claimed. |
| S3.4 Scoped road residency consumer | source landed `b5e24085ae`, activation next | One indexed material draw joins only resident compact tiles, preserves every per-bin LOD and drops old plan/native buffers on replacement. Scope cleanup removes just its owned generation; no whole-road arrays retained by the pool. Existing TileStreamer/scopedTilePorts handle bounded reads/publication/cancellation, actual road/junction types and shared platform-owner budget, including explicit replacement working bytes; no invented parents or zero-cost claims. Source namespaces prevent independently prepared road pieces borrowing an allocator identity; existing initial/outer builds now use distinct allocation namespaces. Game production/test types, six-path typed lint and exact scoped ratchet pass with unchanged scratch baseline. Required whole-tree ratchet remains foreign debt (D53); three source-only pool cases, no executed tests/readings. Runtime archive capture/activation still open; no saving/seam claim. |
| S3.5 Archive capture and runtime handoff | in flight (reading at plan end), source landed `58badebecd` | Capture each detached road material on the62.5m lattice before first GPU upload; bounded compaction flushes one durable write before construction advances. Seal after both road halves, reveal the admitted ring, dispose whole-road buffers, then shrink their old claims to shared texture bytes. Per-tile scopes own eviction/reload; pools retain source shadow/order and one indexed draw/material. Run once per drawn view with clamped travel velocity. Developer Debug Road residency compares resident/current with tiles; default remains resident pending final reading, optional implementation loads lazily. Module-scoped native cleanup callbacks avoid retaining whole construction environments. Engine/game production+test types, twelve-path typed lint and exact scoped ratchet pass (same allowance counts, live baseline untouched); full-tree debt D53 remains. Two source-only shrink/refusal cases added; no tests/builds/readings underG769, no measured saving/closure claim. |
| S3.6 Coarse road parents and bounded handoff | in flight (reading at plan end), source landed `c2f248e33e` | Group62.5m patches into125m parents from the existing first road LOD, preserving four independent quadrant runs. Archive v2 keeps their identity/spheres/scalar bytes; one pooled material draw supports per-bin LOD and immediate parent mask flags without geometry reallocation. Reuse native parent holds/count/byte policies. Pin at most40 fine and32 coarse initial requests, then retire the old geometry only after those ready promises settle; release requirements on handoff/retirement. Default Resident keeps the old centred clipping; only the streamed Debug variant uses62.5m clipping/backing. Game production/test types and twelve-path typed lint pass. Three source-only parent/mask/negative-coordinate cases added; positive sphere fixtures now use valid finite radii without changing any assertion/guard. Required full/scoped ratchet attempted with exact HEAD policy, but D37 pre-count fails on a concurrently retired Pine lookout path outside this scope; unavailable check skipped, live policy untouched. No tests/builds/readings or saving/seam claim underG769. |
| S3.7 Plan-end reading | in flight; authorized repaired-pin cohort still misses staging | Latest a423 shared4404: Resident120.341s/Tiles120.315s in initial home seed (total145.618/146.073s). Entered/ready/settled home has8far prepares in flight,0publishedfar,0queued/refused. Streamed road has9materials/3254backed tiles but started/primed/ready=false. Immediate blocker is the undrained global far stream; deeper cause unproven, routed sp-x8/D110. No baseline/final census, crossings or returns reached: road MB delta, seams and memory gates unavailable. No cap/deadline/default change, retry, GC or Simulator. |

## Far-view quality (Jake, 2026-10-23: *"When we try the low detail stuff, it just looked like shit … when we made it render everything, then all of a sudden it looked good"*)

The far views looked bad because today's stand-ins are crude (decimated ~1.6 MB far proxies), not because stand-ins can't look good. The menu hero is a picture, so it is rendered offline at full detail (no run-time budget). In game, stand-ins are baked from the full-detail render (silhouette, colours, lighting; impostors captured from render-everything), shaded to match, behind mild haze (G631) with cross-fades instead of pops; a generous 5–10 MB per neighbour is still tiny next to a whole world (~300 MB). Render-everything (G607) stays the Debug option until Jake picks.

| Row | What | Lane | Size | Done when |
|---|---|---|---|---|
| F1 | Variant sheet (iPhone portrait, labelled): render-everything vs today's stand-ins vs improved baked stand-ins, from inside Driftwood looking out (3 views) and the hero angle, each with WebContent + GPU MB | Opus | 0.5 d | Jake picks by eye |
| F2 | The picked stand-in for every shard (bake step per shard, far budget per G658 crash-line count) | Opus + Codex | 1.5 d | far views match the pick; memory recorded |
| F3 | Menu hero rendered offline at full detail and shipped as an image (no run-time streaming) | Opus | 0.5 d | hero matches the original framing; costs no run-time memory |

T7.2 (2026-10-27, sp-x8; source `eb322baa11`), in flight (reading at plan end): render-only approach pins start after the admitted neighbour tile offer rather than awaiting life-script and panel construction. Actual entered data still waits for complete admission and original input cleanup. No residency, readiness, transfer or memory-cap widening; G782 warm/cold numbers remain unqualified. Game/test types, typed lint and scoped ratchet pass.

T7.3 (2026-10-27, sp-x8; source `7bdee7d1ad`), in flight (reading at plan end): retarget one render-only approach pin when the destination-local entry tile changes, aborting the old pin first. Same-tile movement keeps its request; destination and pose jumps retain original heading and distance fences. No world/resident/readiness widening. Types, typed lint and scoped ratchet pass; controls unexecuted under G769, G782 times unqualified.

T7.4 critical entryway prepin (source `7e6ab09316`), superseded by T7.10 (`e38c4ef905`): neighbour prediction now pins only the approached local ring. The original full critical-entryway requirement stays on actual entry.

T7.5 tile caster CPU (2026-10-27, sp-x8; source `3cfa15a0ff`), in flight (reading at plan end): scan missing ordinary static geometry boxes in exact incremental steps under the existing construction budget before tile shadow classification. Preserve native world-box arithmetic, traversal order and every floor/glow/caster rule; custom, shared and dynamic sources retain native bounds. Owner/mutation fences abandon partial scans. Game/test and fixture types, typed lint and scoped ratchet pass; native-box/shadow controls added but unexecuted under G769. No G782 gain claimed.

T7.6 tile transport batches (2026-10-27, sp-x8; source `e6bf0d6b4e`), in flight (reading at plan end): overlap independently verified terrain, props and additional-file reads in batches of four. Keep lease acquisition first, drain each started batch before refusal, retain terrain-before-props construction and recheck the tile owner before allocation. No readiness/publication or byte-budget weakening. Game/test and fixture types, typed lint and scoped ratchet pass; bounded-read/drain controls added but unexecuted under G769. Cold/warm timing unqualified.

### T7.7 — render-only neighbours (2026-10-27, sp-x8)

In flight (reading at plan end), source `d27bab4e35`. Delete speculative whole-region constructors from radial, direct-heading and boulevard preparation. Only actual `prepare` entry demand can call regional `ensure`; neighbour approach retains one verified render-tile pin while runtime-module admission remains inert. Delete paired-world guessing/redirect/cancel machinery and the hard four-product selection count; metadata remains distance-selected, with existing verified IO/admission budgets. Actual destination entry still retires a different source durably before allocation and keeps every readiness/frame-transfer fence.

Game/test types, typed lint and scoped ratchet pass; required full `pnpm lint:ratchet` still refuses D37 missing Pine discovery before counting. New constructor-free approach and uncapped metadata controls are added but unexecuted under G769. Prior whole-world warm-ahead assertions describe the deleted behaviour and require the recorded fixture migration; no assertion was deleted. Small-state runtime/leave lifetime and source tile eviction remain in flight, not claimed complete by this slice. G782 timing runs once D82 permits the plan-end Chromium reading.

### T7.8 — requested-entry installation (2026-10-27, sp-x8)

In flight (reading at plan end), source `17a5b1a5c0`. Remove the hybrid `installAhead`/abandon machinery and its speculative-scope maps. `prepareEntry` requires the neutral road, rejects an active source and supports only explicit requested-entry cancellation; a new active owner fences late stage completion. `LiveGridSession` uses this path only from actual region creation; inert module preparation remains available to neighbours. Entered services and parent slots still publish only at frame activation. Retain cancellation/restore/activation and source-isolation assertions with the new contract. Game/test and root fixture types, typed lint and scoped ratchet pass; full ratchet remains blocked on D37. Controls unexecuted under G769, no reading or timing credit.

### T7.9 — departed world retirement (2026-10-27, sp-x8)

In flight (reading at plan end), source `7a06597f33`. Delete the kept-source and five-second whole-world dwell paths. Only the active frame, an in-flight actual constructor or a prepared transfer reservation may hold a full region. After entered hooks leave, the next live tick checkpoints and retires its source through the existing sliced disposal; the page-owned neighbour tile streamer retains its independent distance views. Durable metadata/continuations remain the reconstruction authority. Failed cleanup stays fully charged and blocks new allocation.

A new actual crossing request invalidates older prepared transfers; late actual constructors cannot publish a stale frame. Drain superseded work and retire every unentered world before a different destination allocates. Typed controls cover leave/re-entry, superseded construction and failed-disposal charging. Game/test types, typed lint and scoped ratchet pass; full ratchet remains blocked on D37, controls unexecuted under G769. No native memory or G782 timing result is claimed.

### T7.10 — distance-only neighbour pins (2026-10-27, sp-x8)

In flight (reading at plan end), source `e38c4ef905`. Approach pins keep only their arrival tile and clipped local ring; delete T7.4's distant-entryway residency pins. Preserve H3 arrival-first ordering and the original full critical-entryway requirement on actual entry. The source's entered owner releases refinement on retirement and restores the independent neighbour fallback; the page streamer owns distance eviction/reload. Remove the unused paired-world budget port after speculative constructors are gone.

Original approach ownership/cleanup controls remain, now also proving the full critical set is required on real entry. Game/test and root fixture types, typed lint and scoped ratchet pass. Required full ratchet still stops on D37; no tests/builds/reading under G769. T10 occupied-parent preflight belongs to sp-x2 and is excluded from this packet. D82 is now fixed by its producer tier markers and measured phone-byte accounting (`767d620f2e`, `0d44614d3a`, `47e8a93d33`, `347091ca58`); the next cause-fixed plan-end Chromium candidate includes this source. No memory/frame/crossing acceptance is claimed before that reading.

### T7.11 — requested-entry controls (2026-10-27, sp-x8)

In flight (reading at plan end), source `c4b3e3e65a`. Migrate the four cardinal approach cases and four consumed-admission/queue/disposal cases to actual entry demand. Keep metadata reuse, original refusal identity, failed-constructor claim release, source-disposal ordering and stale-request refusal; proximity itself must not allocate. Remaining old retained-world controls stay explicitly open in D85. Game/test types, named typed lint and scoped ratchet pass; full ratchet still refuses D37. No tests executed under G769.

The cause-fixed plan-end candidate `96cf4467ca46152a047c1e0cd75ae4adfe57114e` includes T7.7–T7.10 and the D82 producer fix. It refuses Nalati config Node/compiler imports before product completion after 3.70 s (`tmp/serve/failed-20261027-050933-4407.log:21`). Routed to sp-x6, zero browser samples. G782 cold/warm and frame/memory qualification remain open; no unchanged preview retry.

### T7.12 — retained contract migration (2026-10-27, sp-x8)

In flight (reading at plan end), source `4dbf4b1160`. D85 actual focus found23 old retained-world expectations. Keep every case, retargeting heading/redirect/pose controls to the verified render pin and real constructor controls to explicit demand. Retain readiness separation, priority release after draining, stale-frame refusal, refused-disposal charging, cancellation at a real scoped yield and original error identity. A superseded actual constructor drains before its claim releases; speculative motion cannot cancel it. Immediate U-turns may reuse an unretired source; a road tick retires it and later return reconstructs from durable state. Game/test types, typed lint and scoped ratchet pass. Full ratchet still refuses D37. Post-landing focused pair refuses before collection: Driftwood discovery line11 imports missing boot/ground.generated.json (`tmp/sp-x8-g717/t7-retained-recovery.log`). Routed to sp-ci-deploy; zero executed tests in this recovery, prior23 reds retained until it can run. No G782 or frame acceptance.

T7 plan-end build continuation (2026-10-27, sp-x8): exact `0a00371960dfc8556e40734eadcf201506d382c9` passes D88 config-closure admission, then refuses Nalati `_os.platform is not a function` after 3.88 s (`tmp/serve/failed-20261027-051135-4407.log:23`). D89 attributes the TypeScript compiler pulled through weatherFxChannels to `84f8c96ab8`, sp-x6. Both failed preview parents exited, no served URL or browser/Sim sample; no unchanged retry. T7 remains in flight pending the one plan-end cold/warm Chromium reading.

Plan-end producer continuation (2026-10-27, sp-x8): exact `05f36994af3abdba6cf24434be062b2feba1c364` includes weather parser fix `44f066b767`. D89 passes and all six products build. Final wire census refuses Nalati 95,433,261 B against 89,713,980 B (delta 5,719,281 B); all other five shards pass their wire ceilings. Build exits1 after 58.53 s (`tmp/serve/failed-20261027-051828-4407.log`). This is existing D92; per-file tier/content attribution routed to sp-x6. No ceiling change, unchanged retry or browser/Sim samples. T7 and G782 cold/warm/frame/memory qualification remain in flight.

T7.13 / D85 pin stability (2026-10-27, sp-x8), in flight (reading at plan end), source `8343e669f8`: the actual retained focus after migration is49pass/3fail; the three strict pin cases expose stationary proximity fallback repeatedly choosing the departed home. Preserve the verified render owner until an explicit heading or the distance fence replaces it, and exclude the departed cell from wall-only fallback. Constructor, readiness, pin retarget/abort and source retirement rules stay unchanged. Original ownership assertions remain unchanged; current game/test types, named typed lint and scoped ratchet pass. Repository-wide ratchet still reports independent shared count drift. Post-landing focused recovery follows.

Current T7 source task is built in `d27bab4e35` (render-only neighbours/four-product cap deletion), `17a5b1a5c0` (requested-entry installation), `7a06597f33` (departed-world retirement/stale-request fences) and `e38c4ef905` (local ring pins). No whole-world warmAhead/installAhead or paired-world budget port remains in live/liveSession/hybrid. Sp-o4 owns the disjoint T2 shader-prebuild seam. Per the coordinator G780 call, no further per-slice previews: D92 is fixed `fffc90950a`, and the one plan-end cold/warm Chromium reading runs only when every row is built and the coordinator calls it. Timing/frame/memory acceptance remains in flight.

D85 pose-only continuation (2026-10-27, sp-x8), source `3070a9a067`: `8343e669f8` fixes departed-home selection, reaching50pass/2fail of52. Retaining a cell identity must also retain its exact pin: stationary/teleported samples cannot reproject it to another local tile. Only a genuine named moving/boulevard approach may retarget the held owner; distance release and actual crossing authority remain unchanged. Both strict redirect assertions and the real diagonal-retarget control remain unchanged. Types, typed lint and scoped ratchet pass; post-landing focus follows. No preview or timing reading is queued.

D85 closed (2026-10-27, sp-x8): `4dbf4b1160` migrates every retained oracle; `8343e669f8` prevents departed-home pin theft, and `3070a9a067` prevents pose-only retarget. The same isolated real-Rapier retained group now passes52/52cases in3.81s (48warm-neighbour +4cardinal; tmp/sp-x8-g717/t7-retained-final-verdict.log). The strict pin order/abort assertions and genuine diagonal retarget remain unchanged; stale-frame, source retirement, failed-disposal charging and original refusal identity controls all pass. Root app setup separately refuses missing FarReach discovery; no global-suite pass is claimed. Types, typed lint and scoped ratchet pass. T7 source is built; G780 timing/frame/memory acceptance stays in flight. The coordinator latest call authorizes one waiting HEAD preview/reading after `fc3adf7d8e`; no per-slice retries are queued.

Called HEAD preview (2026-10-27, sp-x8): exact `efcc132fd740ced2ce34cab4b24b447fbfdf6c89` includes the complete D85 source fix and T7 deletion slices. All six products and phone-wire ceilings pass (Nalati93.53/96.25 MB). Generation tail then refuses Pine manifest generator-spawn binding after28.88s (`tmp/serve/failed-20261027-053643-4407.log`, authored-manifest.mjs:116). This is D58, already fixed forward by later `d1308217c1`, not a T7 assertion failure. Zero browser/Sim samples, no ready server or owned build remains. No second preview/retry queued; the one G780 timing/frame/memory reading remains at plan end on the coordinator call.

## T8 implementation audit (2026-10-27)

A lattice/metadata census alone does not prove that fine content stopped being a
whole-shard library. The seven-shard audit separates the producer and ownership
gaps; no preview or render acceptance is claimed. Retained entries below are
read-only prior products, not a new current-source build.

| Family | Current source / retained evidence | Remaining T8 work / owner |
|---|---|---|
| Nalati | Retained64L0/16L1, all occupied, zero tile-cap debt | Fresh product is blocked by the Nalati build/wire owner sp-x6; leave D89 there. Final runtime/read acceptance at plan end. |
| Pine | This packet: own product26.69s,64L0/16L1,16 full5x5 windows,zero tile-cap debt | Source ready, reading at plan end; sp-o5 takes remaining Pine ownership/render confirmation after this packet. |
| Nine | Retained64L0/12L1 with complete occupied parents; b1f6916531 fills four proven-empty metadata parents | Dense L0 remains: centre0/3/3 has240585 triangles/38 draws, and large wire/resident debt. sp-o3 owns dense producer/library-to-streamer work; not done. |
| Sky | sp-x10 build11.8s:64L0/16L1,16 full5x5,zero bake debt (pre-migration evidence only) | Fine render ownership source migrated in T8.S3:22 L0 GLBs leave the resident library; ground anchors draw no islands; generic tile reader uses original named paint. Explorer borrows1–4 files per model. Exact runtime ownership reading remains open at plan end. |
| Sunscar | sp-x10 fresh build11.1s:64L0/16L1,16 full5x5,zero tile-cap debt | Source confirmed: generic terrain producer/reader owns all80 rows; no fine GLB belongs to its resident library. Types and named lint pass. G773 build1/1; final runtime reading remains open at plan end. |
| Open plots | Generic tiledPlot L1 producer `1361eb295e`: Night Market own build0, every L1 tile2 draws/no texture,23468–48768B wire/114376–223736B declared resident;40 obsolete L1 debt rows removed | Source in flight (reading at plan end), sp-o3; L0 rows unchanged apart from names, no debt/cap increase. No duplicate build or capture by sp-x2. |
| Template | Own current-source G773 product PASS4.86s:64L0/16L1,16 full5x5 windows,zero cap debt | T8 producer qualified once; final runtime/read qualification remains at plan end. No source or cap changes needed. |

| Slice | State | Change and checks |
|---|---|---|
| T8.P1 Pine compact timber transport | in flight (reading at plan end), source `88fd3ebe2b` | Generic opt-in PropsBakeSource.tileCompression emits the existing lossless meshopt GLB only when it is smaller; hashes and all file/tile costs come from selected bytes. Default, panels/library/far keep their original byte path. Pine uses existing WholeShape compact channels/shared position grid and run ordinals, no triangle removal/reorder. Its offline reader accepts padded interleaved portable channels, restores the shared grid and retains pose/layout/complete/shared-vertex refusals; strict metadata parsers live on the defining SDK authoring surface. Retained tile0/1/3 wire447440→210768B, declared resident830580→669700B;0/4/7 wire690720→263188B,resident1273984→925082B. Triangles6116/7450 and draws5/6 unchanged. Own product passes26.69s after original grid/channel refusals;64/16 and all16 full5x5 windows have zero cap debt. Then unchanged parsing moved to SDK to satisfy the author import ratchet, no further build. SDK/test and scoped Pine types, touched typed lint and selected shrink-only ratchet pass, no allowance increase. One source-only transport/view/hash/cost case added, not run under G769. Remove only the two obsolete wire exceptions. No pixel/native memory claim, previews, related walk, soak or Simulator. |
| T8.P2 Pine render confirmation | done (sp-o5, reading 2026-10-27) | Shared HEAD preview `bc0c7cf54f` (D97 fixed), Chromium as iPhone 16 Pro, phone tier, muted: Pine loads and plays at spawn (0, 0, -235; tile 4/0), 239-241 draws, 1.10 M triangles, 0 page errors. Outside the 5 x 5 ring (instance bounds) about 245 k triangles, all by design: the crag skin (50.6 k), the far stand-in (34.1 k, G748.7), the coarse crag-cliff copies (46 k, T11), the pond (14.1 k), the streams and waterfall (17 k), the L1 coarse ground ring (16.7 k), the lookout's coarse copy (7.6 k) and the sky dome; no fine tile content draws beyond the ring. Physics walk (colliders changed): 7 legs, 0 stuck, end heights within 0.07 m. Phone wire after sp-x2's packet, own product at `89283ef150`: 109.48 of 112.24 MB. |

### T8 open-plot cost boundary (2026-10-27, sp-x2)

Pine's source handoff is `88fd3ebe2b`; its actual product and final selected
checks are recorded above. This retained audit identified the L1 material/texture
blocker, now source-fixed by sp-o3 in `1361eb295e` through generic L0 detail
and L1 vertex-colour stand-ins. The before data remains below; it is not the
current producer result or a new acceptance run.
Night Market retained product `8b1243d3d0250c022af95ed03ef0275fc4ab63a498aeb0d069d3c6c66e1c1a0f`
already uses quantized meshopt and complete64L0/16L1 rows:

| Tile | Geometry wire / declared resident B | Texture dependencies wire / declared resident B | Total wire / declared resident B | Triangles / draws |
|---|---|---|---|---|
| L0 3/3 | 259032 / 1224056 | 1593920 / 8738112 | 1852952 / 9962168 | 13213 / 9 |
| L1 1/1 | 101472 / 417444 | 1593920 / 8738112 | 1695392 / 9155556 | 5169 / 6 |

The L1's real material slots are Kit, Water, Glow, Pool, Poster and Landmark;
its cap is2 draws. The dependency rows have0 triangles/draws: there is no
geometry double charge to remove. These distinct look/blend states and the
full original texture footprints require a graphical producer change to fit;
lossless transport alone cannot solve them. Do not relabel the same assets as
library/global cost or fabricate empty occupied parents. Existing exact debt,
wire/resident/draw caps, source geometry and texture pixels stay unchanged.
Historical T10 boundary: this cost audit preceded the all-seven ownership
migrations. They are now confirmed; the source deletion audit below closes
that wait. No new preview, product build or render gain is claimed.

| Slice | State | Current source qualification |
|---|---|---|
| T8.Template | in flight (reading at plan end), source already tiled | One own G773 product build PASS4.86s,64L0/16L1,16 full5x5 windows and no debt under the maintained hash/receipt/cap checker. Critical272KB, tile closure4120KB, library909KB,far571KB,total unique5862KB (rounded decimal KB). No geometry/cap/fixture change or repeated product build; no preview/reading. |


### T8.2 named-tile lossless encoder (2026-10-27, sp-x9)

**In flight (reading at plan end G780; source `39441c439c`).** G790
supersedes the old low-value wait. Split agreed with sp-x2: x9 owns
this compiler/Driftwood slice; x2 keeps T8/T10 and its Pine work.
Consume the defining 88fd3ebe2b tileCompression/save producer and its
encodeTileBlob option without carrying any peer WIP.

`bakeProps` invokes the optional named byte encoder after existing
compression selection and before store derives the hash and GLB cost.
Copy input/output to prevent retained callback storage mutating emitted
assets. Only tile blobs invoke it; default bytes, libraries, panels and
far proxies keep their existing paths. Driftwood opts only
`props.0.2.4` into `meshoptTileBytes`; every other name returns unchanged
bytes. The shared build-only codec preserves views/scene data and keeps
raw bytes unless gzip-9 strictly improves. No quantization, reordering,
shard branch in SDK, runtime codec, Vite plugin or generated-src payload.

Exact read-only retained 0/2/4 asset measurement (not a rebuilt current
product/native-memory result), sourceHash
`1b64ab19d42410d4f85b0531e8e25b7e571d0c3f21dd29b5adb3ef1bc5d5ed57`:

| Parsed metric (bytes except geometry counts) | Raw | Encoded | Delta |
|---|---:|---:|---:|
| Wire | 421,392 | 204,840 | -216,552 |
| gzip-9 | 112,760 | 105,982 | -6,778 |
| Decoded charge | 421,364 | 624,716 | +203,352 |
| GPU charge | 419,904 | 419,904 | 0 |
| Decoded + GPU | 841,268 | 1,044,620 | +203,352 |
| Triangles / draws | 5,832 / 1 | 5,832 / 1 | 0 / 0 |

Raw SHA256 `ef3ade4b13725e381932f3297c8af756a40ab5d20455e5b960eb6d02334188bb`;
encoded SHA256 `1e22b047aef8e82678d6b1de691913245b451c0c6d458b18a1e84d9182aaad7d`.
Both decoded buffer-view hashes and all nontransport scene metadata are
exact. Original section/asset hashes and index immutability are checked
before/after reading. Full facts: tmp/sp-x9-t82/bytes-costs.json.
The compiler uses current admission costs, not a manual decoded discount;
the historical abandoned proposal's reserve above is not a new native
measurement. Remove only the 421,392 B tile/0/2/4 wire debt, now below
the unchanged 300,000 B L0 cap. Keep all other debts, Jake's B/6/4,
3/1 and 3/3 unchanged. No cap or resident accounting is relaxed.

Source controls cover exact decoded views, hash/cost-before-emission,
unselected rows, library isolation and callback backing ownership.
Scoped types and touched typed lint/ratchet pass. SDK declaration build
passes within the affected-layer check, which still reports existing
Nine signAtlasOutput node:zlib type admission (D95). Full ratchet retains
the independent global audit (D94). No test suite, product build,
browser, GC or Simulator reading under G769; retained-byte encoding is
the requested exact cost record, not plan-end product/GC qualification.

### T8 open-plot source handoff and T10 boundary

`1361eb295e` closes the routed coarse-material source blocker. The generic
producer keeps water, pools, posters, landmark and ring paving in L0 detail;
its existing source-colour stand-ins join Kit at L1, retaining Glow separately.
Night Market's one owner build passes with every L1 tile2 draws/no texture,
23468–48768B wire and114376–223736B declared resident (old maxima about3.0MB
and11.1MB). Forty exact L1 debt rows are removed, none raised. Owner phone
wire16.05→15.07MB; L0 rows keep their original geometry, renamed. This is
producer qualification, not a pixel or native-memory acceptance claim.

No sp-x2 rebuild/preview is started for this already-checked source. The one
plan-end reading remains outstanding. The current T10 source audit confirms
whole-cell ring selection and permanent missing-L1 fine coverage are already
removed by `45086a7db8`, `89f7d3598a` and `404b717e02`. Sky fine-library migration is now landed in `8bf41b2b33`; consume that
producer boundary. Nine migration was unlanded at this historical audit; its T3 ownership is
now confirmed through `c1a7396a78`. Preserve still-used reader/Explorer paths
and G606 frozen sources; they are not whole-shard loading fallbacks.

### One plan-end Chromium reader (G780/G777, sp-x2)

S3.7 joins the single `scripts/tile-plan-reading.mjs` cohort, on one shared
HEAD preview, not a Simulator or a quiet-window reading. The queued source
is `5f1eadb19e95c38e376efaecd1e86ad4b8e48553`, D96 fixed, shared4402.
Eight families (DW plus G790's seven) each visit spawn once at3x3 and once
at5x5: actual SHARDFILE button, phone tier, iPhone16Pro,4xCPU,2x render.
Read the existing live scope names / admitted fine keys without adding an
app probe or altering rendering. Whole comparison is the declared unique
fine-file dependency closure, not a reintroduced Whole-cell Debug option.
Observed GPU/CPU backing capacities, allocator claims and Chromium private
footprints remain separate; T0 share is a same-source spawn census, with
unknown classifications retained. Actual clipped minimap border/ring/MB
paint is the T5 sanity witness; it is not assumed to cover offscreen cells.

S3 has one Resident-road reference and one streamed-road cohort in that same
browser. The original maintained DW/Sky declared-portal route runs five
round trips with held input, preserving document/ownership/retirement gates.
Initial staging uses the maintained seed only before travel. Record phase
walls (first cold8s, then warm5s) and100ms frame misses without rerunning;
structural route failures stop dependent legs. No forced GC or app/cache
mutation for a lower memory number. Raw scalar/trace/JPEG output stays under
`tmp/sp-x2/tile-plan-reading/reading-5f1`; final numbers go into T0/T5/T7/S3.7.
One browser-lane invocation owns cleanup; the distinct preview borrower is
`sp-x2-tile-plan-reader`, released after reading. No new preview build.

Reader preflight retained one Node import refusal before Chromium opened;
its corrected invocation uses `--import ./scripts/shard-platform-format.mjs`.
The one actual cohort is running on shared5f1/4402, no new build. The first
DW3x3 row retains two actual page errors (`reading waiting`) routed to
sp-ci-deploy, and a separate reader predicate miss: levelDebugRows excludes
global tile-residency rows. The final reusable reader labels that absent
counter unavailable. Original run scripts/tool hashes and all raw failures
remain retained; no sample is replaced or promoted to a PASS.


### T5 data-world readout repair (2026-10-27, sp-x2)

The called plan-end Chromium cohort on `5f1eadb19e` observed fine
residency in Sky, Signal and Template but no T5 minimap rectangles or MB
labels. Only the native TileDriver had published the overlay readout.
The generic entered-tile binding now reads actual data-streamer fine keys
and the admitted tile costs. Its owner releases the readout on disposal;
a departed owner cannot clear a newer world's reader. Data-world collider
ownership is unavailable, represented by null rather than invented amber
tiles. Existing minimap colours, layout, Debug choices and tile scheduling
are unchanged. This is in flight (reading at plan end), not a new parity
or performance PASS. Touched game/test types and typed lint pass; selected
source ratchet is checked before landing. The original preview is immutable
and its zero-overlay evidence remains retained.

## T7 plan-end crossing qualification (2026-10-27, sp-x8)

DW/Sky pin `5f1eadb19e`, Pine/Nalati repair pin `bc0c7cf54f`, phone4x, iPhone16Pro/DPR2/muted: DW: cold 16.482/15.518/17.170s; warm 13.534/13.384/16.067s; Sky: cold 24.668/24.946/26.716s; warm 20.366/22.767/22.297s; Pine: cold 35.665/36.115/35.845s; warm refused×3 (no commit); Nalati: cold refused×3 (no commit); warm refused×3 (no commit).

T7 source remains built; G782 acceptance stays open. The complete paired table, frame intervals and top three preparation/long-frame windows are in [grid-crossing](grid-crossing-mini-plan.md#g780--g782-plan-end-reading--5f1eadb19e-2026-10-27-sp-x8). Pine/Nalati use the separately recorded bc0c7cf54f repair pin; the old D97 and Nalati fetch refusals remain historical, with no failed cold entry called priming. No timeout, resident guard or visibility/source fence change; no Simulator or isolated-gain credit. Independent x2 Resident/Tiles retirement seeds on5f1 both refuse at120s before legs/census (tmp/sp-x2/tile-plan-reading/reading-5f1/reading.json); eviction proof stays unqualified, not0ms/0MB.


### Called plan-end Chromium result (2026-10-27, sp-x2)

**In flight, not plan PASS.** The original full cohort finished on
`5f1eadb19e95c38e376efaecd1e86ad4b8e48553` (shared4402). It attempted
all16 spawn rows, measured8, and retained8 unavailable rows. After the
coordinator supplied defining Pine D97 repair pin
`bc0c7cf54f8529d6923584e4f57d0fa79dca66c2` (shared4403), only the
unavailable Pine/Nalati rows continued. Pine measured both; Nalati again
refused readiness at120s. Nine was explicitly skipped on bc0 because it
predates its defining2d0cabc1c6 fix. Night Market's original selector attempts
never entered it: its declared compiled-only title is hidden from SHARD
SELECT. Correcting the reader to its existing chunk entry route supplied
its first actual two spawn measurements on the same bc0 borrow.

All visits retain iPhone16Pro, phone tier,4xCPU,2x render, muted Chromium,
120 drawn settle frames and an8s rAF sample. Fresh contexts use the chosen
3x3/5x5 Debug setting; the global effective-setting probe is absent on these
pins, so observed key counts support bounded ownership, not a complete
expected-set/no-holes proof. Native-driver and data-world collider scope
counts below are observed names: data-world0 is unavailable collider
telemetry, not evidence of no physics. The original reader's absent-global-
row mismatch remains a reader diagnostic in raw failures, not an app fault.

T4 first-observed controls on bc0: Pine18.941/18.511s and Night
Market6.464/6.088s (3x3/5x5). Pine misses15s cold; these fresh-context
observations do not qualify warm crossing5s. Original5f1 did not retain
this wall; it cannot be reconstructed from the later census. No unchanged
successful DW/Sky/Signal/Template row was repeated.

T0/T8 cost and capacity observations (MiB); R/C are observed render/collider
scope counts. **Declared closure** counts each admitted fine dependency
once; **whole-fine** is the declared all-L0 dependency closure, not a
restored whole renderer or a native memory saving. GL allocation capacity,
scene CPU backing and renderer+GPU private footprints remain separate.

| Pin | Shard | Ring | R/C | Declared closure / whole-fine | GL capacity | Scene CPU backing | Renderer+GPU footprint | Worst / p95 ms | T5 rects / labels |
|---|---|---|---|---|---|---|---|---|---|
| 5f1 | driftwood-isle | 3x3 | 6/6 | 0.89/18.12 | 146.12 | 43.78 | 1508.86 | 66.7/50.1 | 18/2 |
| 5f1 | driftwood-isle | 5x5 | 15/6 | 2.72/18.12 | 146.12 | 43.78 | 1480.60 | 50.1/50.0 | 24/2 |
| 5f1 | far-reach | 3x3 | 8/0 | 1.36/2.76 | 121.94 | 19.49 | 1228.32 | 50.1/50.1 | 0/0 |
| 5f1 | far-reach | 5x5 | 14/0 | 1.75/2.76 | 122.10 | 19.67 | 1171.25 | 66.7/50.1 | 0/0 |
| 5f1 | sunscar-dunes | 3x3 | 9/0 | 1.29/9.16 | 95.94 | 7.00 | 1123.68 | 16.8/16.7 | 0/0 |
| 5f1 | sunscar-dunes | 5x5 | 25/0 | 3.58/9.16 | 96.72 | 7.48 | 1148.93 | 16.8/16.8 | 0/0 |
| 5f1 | _template | 3x3 | 9/0 | 1.85/12.51 | 25.48 | 2.19 | 847.44 | 33.4/16.8 | 0/0 |
| 5f1 | _template | 5x5 | 25/0 | 5.05/12.51 | 26.53 | 3.11 | 846.52 | 33.3/16.8 | 0/0 |
| bc0 | pine-hollow | 3x3 | 6/6 | 70.28/81.30 | 212.06 | 53.52 | 1747.96 | 66.8/66.7 | 18/1 |
| bc0 | pine-hollow | 5x5 | 15/6 | 71.72/81.30 | 212.49 | 54.73 | 1621.72 | 99.9/66.7 | 24/1 |
| bc0 | open-plot-night-market | 3x3 | 9/0 | 17.59/58.95 | 30.19 | 5.37 | 855.71 | 33.4/16.8 | 0/0 |
| bc0 | open-plot-night-market | 5x5 | 25/0 | 32.11/58.95 | 35.95 | 11.93 | 884.35 | 33.4/16.8 | 0/0 |

T0 observed GL share (MiB), same-source spawn classification; single-node
buffers are candidates, not removable bytes. Ocean/seabed buffers can be
candidates because no explicit global-owner set was supplied. Unknowns
remain explicit. RAM ledger is a capacity ledger, not physical process RAM.

| Pin / shard / ring | Engine | Known global | Single-node candidate | Shared | Unknown | RAM ledger |
|---|---|---|---|---|---|---|
| 5f1/driftwood-isle/3x3 | 60.22 | 21.33 | 40.83 | 15.03 | 8.70 | 205.69 |
| 5f1/driftwood-isle/5x5 | 60.22 | 21.33 | 40.83 | 15.03 | 8.70 | 183.18 |
| 5f1/far-reach/3x3 | 31.61 | 0.00 | 11.80 | 43.34 | 35.19 | 102.90 |
| 5f1/far-reach/5x5 | 31.61 | 0.00 | 11.96 | 43.34 | 35.19 | 83.19 |
| 5f1/sunscar-dunes/3x3 | 22.56 | 0.00 | 5.94 | 48.57 | 18.87 | 81.47 |
| 5f1/sunscar-dunes/5x5 | 22.56 | 0.00 | 6.72 | 48.57 | 18.87 | 84.99 |
| 5f1/_template/3x3 | 22.10 | 0.00 | 2.47 | 0.91 | 0.00 | 13.09 |
| 5f1/_template/5x5 | 22.10 | 0.00 | 3.52 | 0.91 | 0.01 | 14.43 |
| bc0/pine-hollow/3x3 | 31.71 | 0.00 | 27.81 | 111.31 | 41.24 | 368.91 |
| bc0/pine-hollow/5x5 | 31.71 | 0.00 | 28.10 | 111.43 | 41.25 | 259.74 |
| bc0/open-plot-night-market/3x3 | 22.09 | 0.00 | 4.52 | 2.95 | 0.63 | 28.68 |
| bc0/open-plot-night-market/5x5 | 22.09 | 0.00 | 10.01 | 2.95 | 0.90 | 35.45 |

DW/Pine renderer+GPU footprints exceed1.2GiB, but these page/process totals
include platform state and reused GPU process capacity; they do not isolate
per-shard physical content. No per-shard1.2GB memory PASS is claimed.
DW/Sky p95 about50ms and Pine66.7ms also do not demonstrate a30fps floor.
The8s frame windows exclude the subsequent expensive census/dump; the saved
HUD maxima include that instrumentation (Pine5x5 screenshot max1500ms).
No soak, native-GC release, five-return retirement or Simulator verdict.

T5 clipped viewport paint is positive only in DW/Pine. Data-world zero paint
is a real missing readout binding, repaired generically in`f1222a6cfd` with
scope-owned telemetry and explicit unavailable collider ownership. Both
pins predate that repair; no post-fix browser was run. T6 brains/patrol
handoff and T11 all-landmark parity are not proven by these spawn counts.

T7/S3.7: both original Resident/Tiles road contexts refused initial home
seed streaming at the unchanged120s fence. They never reached before/after
census or a measured held-input crossing. Claims, road memory delta,
seam/pixel handoff, cold8s/warm5s and baseline-return±20MB remain unavailable.
The exact retained failure was routed to sp-x8; no route/road retry or
zero-cost claim. Resident remains the default; source caps are unchanged.

Original selector pageerrors are D100, mapped to host-blocked service
worker registration resolving undefined. sp-ci-deploy fixed source83574a090e.
A body-free Runtime observer attached only after2026-10-27T11:28:47.711Z
and retained subsequent stacks; that interval is instrumented and supplies
no isolated timing claim. It sent no Network/body/GC or app mutations.
Nalati refusals are retained alongside owner-routed D106; readiness timeout
alone does not prove that encoding cause. No duplicate damage row.

Raw original:`tmp/sp-x2/tile-plan-reading/reading-5f1/reading.json`;
repair:`tmp/sp-x2/tile-plan-reading/repair-bc0/reading.json`;
first Night Market:`tmp/sp-x2/tile-plan-reading/night-market-bc0/reading.json`.
Original loaded runner/page bytes and their receipt hashes match the saved
`.used` copies. Offline Markdown reports retain raw failures and absent
values. All owned browser/context/Inspector processes exited naturally;
both distinct preview borrows released, peers' parent servers preserved.
No new build, forced GC, official quiet or Simulator was started.


### Authorized unqualified-row recovery reader (2026-10-27, sp-x2)

Coordinator supplies Nalati D106 c4ddbdb2cf and Nine f2f8c38b9a and calls
only Nalati/Nine plus T7/S3.7 again. No existing ready pin contains both;
one shared HEAD preview a423f4d305 was built, all products/app passing,
ready4404. The original5f1/bc0 observations stay unchanged.
The maintained body-free reader retains the original phone profile and
deadlines, now preserves exact failure phase/wall, full scalar grid state,
stack, partial crossings and portrait refusal capture. Five completed
returns, if reached, each retain renderer+GPU private footprint delta
against the original baseline with the unchanged absolute20MB bar.
Dumps remain outside measured travel windows, with no forced GC.
The offline report prints these observed walls/returns and leaves missing
values unavailable. Scoped runner/report types and typed lint pass.
Required full ratchet is attempted; existing shared deletion snapshot
refuses missing vite/backdropPrefix.ts before measuring, no allowance edit.
This reader is in flight and confers no new acceptance PASS.


### Authorized unqualified-row recovery result (2026-10-27, sp-x2)

**In flight, not plan PASS.** One new shared HEAD preview
`a423f4d305c6bba986effd311b394095cd32ecf2` (4404) contains both
Nalati c4ddbdb2cf and Nine f2f8c38b9a. No ready preview contained both,
so the official shared builder ran once (products65s, app22s). One
muted body-free Chromium cohort reused that pin for only the four
Nalati/Nine spawn rows and the original Resident/Tiles grid rows.
Browser admission waited its existing finite lease, then cleared naturally;
no other process was killed, interrupted or asked to yield. Original5f1/bc0
results remain unchanged. iPhone16Pro/phone/4xCPU/2x render, all old
readiness/frame/memory bars, no forced GC or official quiet.

Spawn recovery numbers (MiB, 8s rAF windows):

| Shard | Ring | First-observed controls s | Render/collider scopes | Declared fine closure / all-fine | GL capacity | Scene CPU backing | Renderer+GPU private | Worst / p95 ms | T5 rect records / unique MB strings |
|---|---|---|---|---|---|---|---|---|---|
| nalati-grasslands | 3x3 | unavailable (120s refusal) | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable |
| nalati-grasslands | 5x5 | unavailable (120s refusal) | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable | unavailable |
| nine-dragon-stack | 3x3 | 17.388 | 9/9 | 132.93/160.49 | 233.77 | 43.71 | 2102.55 | 50.1/33.4 | 24/9 |
| nine-dragon-stack | 5x5 | 18.558 | 11/9 | 151.55/160.49 | 233.77 | 43.71 | 2041.49 | 50.1/50.0 | 26/9 |

Nine's freeze is no longer observed, but17.388/18.558s exceeds15s cold;
33.4/50.0ms p95 does not demonstrate30fps in both rows. Declared closures
are unique admitted dependencies, not observed memory savings. Both Nine
rows observe GL233.77 MiB classified engine58.71, candidate88.04, shared66.94,
unknown20.08, known-global0. CPU backing43.71 MiB is unchanged; RAM ledger
379.74/338.06 MiB. Renderer+GPU private2102.55/2041.49 MiB includes platform
and reused GPU capacity, not an isolated per-shard physical memory PASS.

T5 is actual clipped paint. Rectangle records are deduplicated by style
and position; MB strings are deduplicated by text, not labelled-tile counts.
The older generic data-world zero-paint rows were not repeated.

Nalati is still unqualified on this pin. Both rows retain the unchanged
120s readiness refusal. One read-only same-page observation at
2026-10-27T12:07:36.148Z (the5x5 attempt, before controls) retained
880/880 downloads complete and visible level.world failure:
`Binary source was not prepared: models/cover-phone.bin`. The stack goes
binarySource → specimenCatalogue → wildlife; no renderer/game was exposed.
The observation sent zero Network/body or mutation commands and closed
its socket immediately. This is separate from repaired D106 encoding.
Sp-o5 owns the defining prepare/read seam and reports source fixb8e3c244f4:
the forager draw omitted the prepared file map. Its later4715 preview
passes level.world, then reports a separate camp.phone.glb404/HTML at
level.play (e39fb70e9b, owner being checked by sp-o5). We did not change
pins, build or rerun Nalati again. No controls/memory number is invented.

T7/S3.7 measured failure boundaries, not measured crossings:

| Road mode | Staging phase s | Total grid attempt s | Home/frame/controls | Far/L1/L0 published | In flight / queued / refused | Measured crossings / returns |
|---|---|---|---|---|---|---|
| resident | 120.341 | 145.618 | DW/2621/true | 0/0/0 | 8/0/0 | 0/0 |
| tiles | 120.315 | 146.073 | DW/2822/true | 0/0/0 | 8/0/0 | 0/0 |

Immediate top boundary: `seedTileRetirementHome` requires the global rings'
inFlight/queued counters to drain, despite the original home already being
entered/gameplayReady/inside/current DW with crossing settled, no pending
or retiring regions and zero ghosts. At both refusals all eight original
far cells remain fetching/prepare, with no far published. Their final
prepare-phase ages are3.77–4.64s (not a proven single120s network wait);
asset-wait count0. Both retain13,285,524B charged of14,400,000B far budget,
no omitted cells and no refusal/pageerror. The deeper reason far preparation
does not publish is unproven; no cap, source decoder or network failure is
attributed from these counters. The exact boundary was sent to sp-x8,
T7 route/streaming owner; D110 carries both original and recovery evidence.

S3 Tiles has9materials/3254backed tiles but started=false, primed=false,
ready=false. It never reaches baseline or final census. Resident has no
road-tile archive. Road MB difference, five-return±20MB, cold8s/warm5s,
travel100ms and seam gates stay unavailable, not zero or PASS. Default
Resident, original120s staging fence and all content caps remain unchanged.
No second grid attempt beyond the two requested road modes.

Exact raw:`tmp/sp-x2/tile-plan-recovery/reading-a423/reading.json`,
portrait refusals in that folder, UI stack in`pending-page-diagnostic.json`,
offline`final-report.md`. Loaded reader/page sources are retained beside
this data; the source hash in limits identifies the actual invocation.
All contexts/browser/Inspector processes exited; the distinct owner released
and stopped4404 after the cohort. No local browser/build/Sim remains.

Recovery diagnostics source9842feaae6 passes scoped runner/report types
and typed lint; this report wording change passes them too. Required full
ratchet attempted, but missing vite/backdropPrefix.ts census input refuses
before counting during the shared Vite deletion. No allowance, gate or
foreign hunk changed; no related walk, extra product or acceptance run.


### Final Nalati-only source-repair continuation (2026-10-27, sp-x2)

Sp-o5 supplied the already-ready shared preview325740f3a5 on4405 after
fixing the new failures discovered during our a423 recovery: b8e3c244f4
prepares forager cover bytes, and325740f3a5 uses one camp skin identity per
identical tier payload. It contains c4ddbdb2cf/f2f8c38b9a as well.
We borrowed it, built nothing and continued **only** the two unavailable
Nalati spawn rows. Nine and the two T7/S3.7 road misses were not repeated.
Both old Nalati120s refusals remain retained against their original pins.

Exact source325740f3a59b747cd0bf8c8606fd889d807e5dcc. Same muted
iPhone16Pro/phone/4xCPU/2x render,120 drawn settle frames then8s rAF;
no forced GC, quiet window, scene mutation or Simulator.

| Ring | First-observed controls s | Render/collider scopes | Declared closure / all-fine MiB | GL capacity MiB | CPU backing MiB | Renderer+GPU private MiB | Worst / p95 frame ms | T5 rect records / unique MB strings |
|---|---|---|---|---|---|---|---|---|
| 3x3 | 14.710 | 6/6 | 1.35/14.38 | 213.28 | 39.33 | 1801.66 | 66.7/50.1 | 18/0 |
| 5x5 | 15.047 | 15/6 | 3.40/14.38 | 214.06 | 40.10 | 1837.35 | 83.4/50.1 | 24/0 |

Both visits have zero pageerrors/HTTP errors. The remaining raw failure in
each is the T5 MB-paint predicate: rectangles exist but no MB text was
observed. SceneDressing's collider-only driver calls residentTiles without
noteTileBytes; that is a source-audit candidate for the latest readout's
empty byte map, not a browser-proven causal repair. T5 owner sp-x2 retains
the gap in the damage list; no extra fix/read is bundled with this result.

The3x3 wall passes15s,5x5 misses by47ms; no waiver or repeat to chase it.
P95 about50.1ms does not demonstrate30fps. GL classification engine71.62,
single-node candidate62.65/63.42, shared76.10, unknown2.91, known-global0 MiB;
RAM ledger418.88/476.18 MiB. Declared costs, GL capacity, CPU backing, ledger
and process-private bytes remain separate. These reused-browser page/GPU
totals do not isolate per-shard physical RAM or establish1.2GB acceptance.

T7/S3.7 remains the a423 result recorded above:120.341/120.315s initial
staging, eight far prepares and zero far published despite settled/ready
home. Sp-x8 received the exact boundary; D110 carries its numbers/top cause.
No crossings, returns or road MB delta are claimed. All eight spawn
families now have observations across5f1/bc0/a423/325, **not** one matched
all-shard PASS. T4 cold, T5 labels and T7/S3.7 keep qualification in flight.

Raw:`tmp/sp-x2/tile-plan-recovery/nalati-325/reading.json`; offline
`nalati-final-report.md`, portrait snapshots alongside. The owned browser
closed naturally and distinct4405 borrow released, preserving peer owners.
No owned build, browser, Sim or observer remains. Source repairs belong to
their defining owner SHAs; the earlier reports are not silently regraded.


### T10 final source deletion audit (2026-10-27, sp-x2)

Coordinator confirms T8 on all seven: Pine88fd3ebe2b/0dac41902a, Sky,
Nine through T3 c1a7396a78, open plots1361eb295e, Nalati, Sunscar and
Template. The requested source deletions already landed; no second deletion
of coarse/far or native landmark content is needed:

- `89f7d3598a` removes entered radius8; ring() accepts only0/1/2.
- `9e6e110d3e` skips temporary whole splat-ground allocation for tile-drawn pages.
- `45086a7db8` removes permanent missing-L1 distant fine requirements and the
Whole cell Debug option/label; saved unknown/old choices resolve to5x5.
- `404b717e02` rejects empty occupied coarse declarations before instance/root/
lease mutation. The retained original fixture checks missing and empty
parents with no ownership, pin or allocator mutation.

Current source audit: tileContent.enter uses bounded spawn/entry rings and
coarse L1 coverage; standaloneClientTiles enters the same scheduler, without
an all-L0 constructor branch. tileResidency and debugOptions expose only
3x3/5x5; engine/strings holds only those labels. The game strings facade
contains no Whole choice. Restoring an admitted neighbour view on departure
and retaining its far proxy while coarse coverage fills are required
coverage/lifetime paths, not whole-shard fine loading. Shared libraries,
coarse/far landmarks and frozen LEGACY remain intact.

Remove only stale source comments about whole-near or uncovered distant-L0
fallbacks, and clear obsolete plan waits. Runtime behavior is unchanged by
this audit commit; the defining runtime source SHAs are listed above.
Current engine/game tsc-b and typed lint on tileContent, tileResidency,
debugOptions and engine/strings pass. Required ratchet is attempted before
landing; no allowance edits. No tests, generation, product build, preview,
soak, memory claim or Simulator reading. **Source complete, qualification
in flight:** G777 official Simulator reading stays last. Existing T7/S3.7
D110 and T4/T5 misses are not erased or turned into a T10 acceptance PASS.

### T8 Pine timber exact-source repair (2026-10-27, sp-x2)

Immediate G754 red: CI40529017541 P1 traces the original26 timber-GLB
aggregate change02d3a547->16a5ef92 to88fd3ebe2b, not output ordering.
That packet's meshopt transport is lossless, but its separate
WholeShape compact:true opt-in quantizes positions/normals/colours.
Calling the resulting native source route lossless was incorrect.

Remove only that Pine source opt-in. Preserve Float32 native channels,
original partition ordinals, indices and matrix64 data. Keep ordinal-run
metadata and the existing lossless meshopt tile transport; no shader,
material, collider, tile cap or frozen LEGACY change. The original26
byte oracle02d3a54716563d0691ba9cd50a76ca441821d8157d4faf8ef795eca121ca66c3
stays unchanged. Do not repin or introduce a tolerance. Touched source
types/lint/ratchet pass; land source before the exact failed-only oracle
recovery under G769. Any remaining difference stays red and is audited.

### P1 exact timber oracle restored (2026-10-27, sp-x2)

Source repair d24e460d2d removes the lossy compact:true opt-in introduced
by88fd3ebe2b. A direct original26 source rebuild now asserts exactly
26 members and the unchanged aggregate
02d3a54716563d0691ba9cd50a76ca441821d8157d4faf8ef795eca121ca66c3.
Every original GLB hash, including its serialized channels/topology,
is restored; no repin, tolerance or alternate expected bytes.

The exact-channel source makes L0 4/7 measure359636 compressed bytes
in both retained c6a9/7e3 preview products. Coordinator-approved
8505673985 records only pine-hollow/tile/0/4/7/compressed=359636;
the global300000 bar remains. This current overflow follows d24's
exact-source restoration, not b5ef2ff17c cabin scheduling. All other
coordinates/metrics remain unchanged; do not describe this as zero debt.

The registered quest-catalogue-sites test refused before collection
because its DW/Pine product prerequisites were stale. One ordinary
required product build then refused concurrent scriptAdmissionV2.ts
input mutation. The independent direct source rebuild executes the
original26 aggregate assertion and passes (Node transform-types plus
the maintained simulation resolver); it is not a whole-suite pass.
No preview or browser was started for this recovery. Plan-end runtime
reading remains separate. G804 hands the next I2 cohort to the plan
coordinator while sp-x2 moves to the generators plan.

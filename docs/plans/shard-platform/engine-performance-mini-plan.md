# Engine performance: batch like Unreal, a stable 30 on the phone

**State:** `open` 2026-10-30 ~13:35 Cancun (G943). Written by wildshard-v's research subagent; grilled 13:00–13:15 (G934 keep the format and fix the runtime, G935 GLSL Nine first, G936 forest / crags batch again, G937 the bar below legacy). **G943 (Jake, 13:35): every row starts now, the batch stage in parallel with the GLSL back-end; supersedes G940.** Jake: *"Let's do the shader switches and the Unreal style batching. Let's just fucking do it. Let's just do it properly. Let's just get the performance up. There's no point in having this if we can't have a stable 30 FPS on the phone."* Ask E515. Jake's words:
*"Once all the mini plans are done, put them all in an artifact each and show them to me. And then we do the grilling,
the brainstorming, the questions. I really want to push hard on this. I don't want these regressions. It sounds like
the shard files are harder to optimize, harder to use the bulk drawing and the smart stuff. A lot of the things are
really dumb. It looks like nothing in the engine was designed for performance. Spawn a sub-agent whose job it is to
research and come up with a draft plan to explain why the new engine and its hundreds of hosts and its hundreds upon
thousands of custom sections, why the whole system fundamentally is not compatible with Unreal Engine level of
performance or Unreal Engine levels of raw GPU batching, genius level optimizations and performance. Maybe it is. Maybe
that sub-agent can convince me that it is. Maybe we can just fix it. Bonus points if we can fix it. If that sub-agent
in that draft plan finds any low-hanging fruit that would impact Pinewood and Nine Dragon and overlap with the Pinewood
and Nine Dragon mini plans, we can slam those into the mini plans, just the low-hanging fruit component."*

Related plans: [nine-fix](nine-fix-mini-plan.md) (NF rows), pine-fps (`shard-platform/pine-fps-mini-plan.md`,
being written), [three r187, dropped G938](../../../project/archive/2026-10-30-three-r187.md), [qa 10-30](../../../project/archive/2026-10-30-qa-2026-10-30.md)
QC1 / QC4. This draft does not repeat their rows. It names them where they are the fix.

## 1. The verdict

**It is compatible, and it is fixable. No redesign is needed.** The shardfile format, the sections and the hosts are not
what makes the frame slow. They exist at load time and none of them draws. All 157 draws in a Nine frame come from
47 engine and game files (no shard runtime file creates a mesh), and Nine's shardfile frame has **the same draw list as
legacy, almost one for one: 157 draws against 154**. What is slow is the **runtime layer underneath**, which has four
fixable faults. First, the graph looks run on three's node-material (TSL) adapter: each draw costs 76 % more on Nine,
and graph looks are banned from the batched path, so Pine draws its trees in 45 calls where legacy uses 9. Second,
streaming tiles split and cut draws, and they re-join meshes at run time. Third, six bookkeeping hooks run on every draw
and cost 1–2 ms a frame, in legacy too. Fourth, nothing merges draws across placements. Legacy is not
Unreal-level either: it is hand code with 83 one-off meshes in a Nine frame. Because the shardfile content is data,
the bake can do what Unreal's cooker does: merge static meshes per cell, share one program per material family, pack
textures into arrays and build HLODs offline. That is easier than hand-tuning each legacy shard. The plan: first the
cheap fixes (section 7) and the GLSL back-end the Nine plan already has (NF13–NF18). Then a "batch stage" that bakes
and draws cells by material family, with a draw budget (section 5). Target: Nine and Pine **below legacy's frame
cost**, not just at parity.

## 2. Today's frame, measured

Live `14dd10d-mvv7k9qd`, Chromium CPU 4x as "iPhone 16 Pro", phone tier, 2x, muted, refine dither off, through
`scripts/browser-lane.sh`. One frame's draws were attributed per object by a page probe, the GL calls were counted
over 60 frames, and a 6 s CPU profile was taken at the held pose. Nine P4 is the stair top looking down the neon
street. Pine Q4 is the crossroads (x 0, z −28, yaw 90°, pitch −4°). The scratch harness is in
`tmp/wildshard-v-engine-perf/` (`run.mjs`, `census.js`, `merge.py`; never committed).

### 2.1 Counts per frame

| | Nine LEGACY | Nine SHARDFILE | Pine LEGACY | Pine SHARDFILE |
|---|---|---|---|---|
| main-thread work p50 | **9.1 ms** | **13.8 ms** (+52 %) | **13.2 ms** | **20.8 ms** (+58 %) |
| draws (main / shadow) | 154 (152 / 2) | 157 (155 / 2) | 134 (115 / 19) | **200 (162 / 38)** |
| one-copy (non-instanced) draws, main | 83 | 84 | 98 | 103 |
| node-material draws | 0 | **136** | 0 | 56 |
| distinct programs drawn | 46 | 63 | 62 | 66 |
| `useProgram` / frame | 52 | 72 | 80 | 98 |
| `gl.uniform*` / frame | 245 | 459 | 1,092 | **1,629** |
| distinct materials / geometries | 64 / 146 | 71 / 144 | 95 / 110 | 94 / 159 |
| triangles drawn | 1.70 M | 1.64 M | 1.32 M | 1.41 M |
| tree draws (main + shadow) | — | — | **5 + 4** (4 `BatchedMesh`) | **29 + 16** (instanced per variant × LOD × part) |
| WebKit (Mac, 1x) work, mean | — | — | 4.2 ms | 5.8 ms (+38 %) |

Driftwood SHARDFILE (spawn area, same probe): 153 draws, 80 of them node draws, 73 `useProgram` and 1,139 uniform calls
a frame, 15.6 ms work. Nine's WebKit gap (+1–2 ms at P1–P5) is in `tmp/wildshard-v-nine-plan/frame-cost.md`.

### 2.2 Where the render CPU goes (profile, inclusive ms per frame at 4x)

| | Nine LG | Nine SF | Pine LG | Pine SF |
|---|---|---|---|---|
| `renderWorld` | 5.86 | 10.49 | 10.10 | 15.96 |
| three `renderBufferDirect` (the draw itself) | 3.08 | 5.68 | 6.03 | 8.91 |
| our wrappers stacked on it (outer − three) | **0.92** | **1.08** | **1.25** | **1.99** |
| our `renderer.properties.get` hooks | 0.22 | 0.42 | 0.91 | 1.07 |
| node handler `beforeDraw` | — | 1.85 | — | 1.52 |
| shadow map render | 0.33 | 0.35 | 1.84 | 2.62 |
| shard / world update (`runPhase`) | 2.47 | 1.78 | 2.65 | 4.49 |

**Render cost per draw** (`renderWorld` ÷ draws): Nine legacy 38 µs, Nine shardfile **67 µs**; Pine legacy 75 µs,
Pine shardfile 80 µs (Pine's lit PBR programs cost more per draw in both modes).

### 2.3 What the numbers say

1. **Nine's gap is the cost of each draw, not the number of draws.** It has the same draws, owners and kit meshes
   (`kit:paifang`, `kit:stair-terraces` … one draw each in both modes), and +29 µs per draw on average (≈ +34 µs on each of the 136 node draws). The
   frame-cost report measured the split: 3.0 ms of the 5 ms gap is the handler hook. The rest is three's node path in
   `setProgram` and 20 extra program switches (22 programs for one coarse graph).
2. **Pine's gap is the number of draws.** The cost per draw is about the same. It has +66 draws: +36 are trees (45 vs 9),
   +10 are boulders (`InstancedBatch` makes one mesh per geometry: 6 main and 6 shadow vs 1 + 1), and the rest are
   crags, barrels and crates split per variant. All of them trace back to one line: a graph look may not use the batched
   path (`src/engine/models/place.ts:814`, `src/engine/world/forest/Forest.ts:95`, since `7727599482`). Pine also
   spends +1.8 ms in update (the pine-fps plan's job).
3. **Both modes pay 1–2 ms of bookkeeping per frame.** Six engine modules wrap `renderBufferDirect`
   (`render/memorySaver.ts:228`, `render/shadowMaterialOwnership.ts:69`, `render/compressedTextureRetirement.ts:47`,
   `render/uploadOwnership.ts:262`, `render/gpuLabels.ts:419`, `render/nodes/engineNodesHandler.ts:770`), and two
   hook three's `properties.get` (`compressedTextureRetirement.ts:31`, `uploadOwnership.ts:256`), which three calls
   many times per draw. None of this draws anything.
4. **The uniform calls are lights.** Pine's 1,092–1,629 uniform calls a frame come from lit programs (CSM, lights)
   re-sending light uniforms at each program switch. three sorts opaque objects by `material.id`, not by program
   (`node_modules/three/src/renderers/webgl/WebGLRenderLists.js` `painterSortStable`), so one program can be switched
   to several times a frame: Pine SHARDFILE switches programs 98 times for 66 programs.
5. **"Hundreds of hosts, thousands of sections" never reach the frame.** Measured: 387 custom and named sections
   (472 identities, 33.6 MB) over six shards, 63 section kinds, and 250 modules named as hosts ([custom sections](../host-audit/custom-sections-mini-plan.md),
   [HOST-AUDIT](../HOST-AUDIT.md)). At frame time Nine shardfile's 157 draws come from 45 owners, against legacy's 68.
   The sections are decode-and-build work at load time. That is a real cost, but a loading-screen cost, not a frame cost.

**Structural or incidental?** Incidental to the format, structural to the runtime. Nothing in the data model forces a
small draw or an expensive one. The costs come from four runtime choices: the TSL back-end (SF59, cost knowingly
deferred by G436 / G437), the tile split (T3 / FC12, D179 B), per-placement draw ownership, and hot-path bookkeeping.
Each one can be changed without touching a shard.

## 3. What AAA engines do, against what WebGL2 on an iPhone allows

WebGL2 on iOS Safari has instancing, MRT, integer and float textures, `sampler2DArray`, UBOs, `gl_VertexID` /
`gl_InstanceID`, occlusion queries and `WEBGL_multi_draw`. It has no compute, no indirect draws, no bindless and no
64-bit atomics. On iOS, ANGLE-Metal re-encodes uniform blocks on every draw (the 10-20 finding behind `ea0ab7baa9`).
Facade multi-draw is banned everywhere (E271 / E272, [the incident](../../audits/nine-dragon-mobile-multidraw.md)).

| Technique (Unreal name) | WebGL2 + iOS | Our state | What it would need |
|---|---|---|---|
| Instancing (ISM / HISM) | Yes, core | Used widely (`models/cull.ts` `InstancedCull`, `models/instancedBatch.ts`) | Fewer splits: today one `InstancedMesh` per variant × LOD × part × tile |
| Merged static batches per cell (HLOD merge, static mesh merge) | Yes | Partial: welds (`models/weld.ts`), merged placements, FC16 still-merge, refine unions (joined at run time) | Bake per cell × material family; drawn as plain meshes (section 5) |
| Multi-draw / GPU-driven indirect (MDI) | `WEBGL_multi_draw` only; no indirect | Banned for facades; legacy Pine's forest uses it on Jake's phone today (`Forest.ts:186-195`); graph looks barred since `7727599482` | Jake's ruling on non-facade multi-draw (question 2) |
| Material instances, uber shaders (MIDs, material layers) | Yes. Params as uniforms, per-instance attributes or data textures; avoid UBOs on iOS | One TSL program per graph × shape × coarse tile (22 for `nine-coarse-facade`), per-draw JS | IR → GLSL back-end (NF13–NF18), then families with parameters, not one program per variant |
| Texture arrays / atlases ("bindless-lite") | `sampler2DArray` + KTX2 (ASTC on iOS) | Per-material textures; one sign atlas (Nine) | Bake packs a family's textures into arrays; layer index per vertex or instance |
| HLOD / impostors | Yes, offline | Coarse L1 copies (`sdk/bake/coarseCopy.ts`), far impostors (`game/grid/farImpostorView.ts`) | The coarse bake must carry the full look (Nine's coarse towers lost the paint: NF4 / DP4) |
| State sorting (sort by PSO) | Yes, CPU | three's default: by `material.id` | `renderer.setOpaqueSort` keyed by program, then material, then depth |
| GPU culling, occlusion (HZB) | No compute. Occlusion queries are async (1-frame lag) | CPU per-copy cull, re-run on every camera change, whole prefix re-uploaded (`cull.ts:123`, `:359`) | Cell clusters + legacy's thresholds + delta upload (NF5, engine-wide) |
| Visibility buffer / deferred | Possible (MRT + R32UI) | Forward | **No**: on a tile-based phone GPU at 2x it costs bandwidth and buys little with few lights |
| Nanite (cluster LOD, software raster) | No (needs compute and atomics) | — | Only a "lite" form: offline cluster LODs plus vertex pulling (`texelFetch` by `gl_InstanceID`), so one instanced draw covers many meshes of one family. A spike, not a promise (EP11) |
| PSO / shader precache | Yes | `render/precompile.ts` warm-up | Fewer programs to warm (GLSL back-end) |

The two levers that matter on this hardware are **fewer draws** (merge and instance at bake) and **cheaper draws**
(classic GLSL, one hook, sorted by program). The frame budget makes the point. At ~25 µs a classic draw (4x), 150
draws cost ~4 ms of render CPU. At today's 67 µs (Nine shardfile) they cost 10 ms. The phone throttles about 2x within
minutes (JAKE.md), so 33 ms at 30 fps leaves no room for that.

## 4. Where the shardfile design blocks batching, and where it helps

### It blocks (each fixable, each in the runtime or the bake)

| # | Blocker | Evidence | Layer to change |
|---|---|---|---|
| B1 | **Graph looks run on TSL's WebGL adapter.** Per-draw JS hook, per-draw uniform compare, a program per variant, and no batched path for graph looks | Nine ≈ +34 µs a node draw; Pine trees 45 vs 9 draws; `place.ts:814`, `Forest.ts:95`, `instancedBatch.ts:22` `graphLook` | Engine render back-end (IR unchanged, G32) |
| B2 | **Streaming tiles split and cut draws.** T3 draws a placement per tile, or filters copies to the 5×5 ring. Refine unions re-join at run time | Far dressing cut (`game/shardfile/worldScenePlacement.ts:180` `residentCopies`, `:234`); 4 hitches of 161–389 ms (streaming.md); FC12 found 86 of 244 draws were per-tile repeats | Bake (tile slabs, NF10) and game (ring, NF1; slabs, NF11) |
| B3 | **Each placement owns its draws.** The draw strategy is authored per placement row (`format/worldScenePlacement.ts:19`, `draw: single \| instanced \| batched \| merged`), and nothing merges two placements that share a material | Nine: 70 static one-copy draws over 40 materials; Pine: 98 over 67 (`merge.py` on the census) | Game + bake: a batch stage that treats `draw` as a hint |
| B4 | **Bookkeeping on the hot path**: six `renderBufferDirect` wrappers, two `properties.get` hooks | 0.9–2.0 ms + 0.2–1.1 ms a frame, in both modes (§2.2) | Engine |
| B5 | **Repeats split by part and variant**: `place` draws "one per part per variant per LOD level in view" (`place.ts:20`); `InstancedBatch` makes one mesh per geometry | Pine boulders 12 draws vs legacy's 2; Nine crowd 22 draws for 501 copies (5 colourways × 4 LODs, both modes) | Bake: parts of one family merged per LOD; colourways as instance colour |
| B6 | **Light uniforms re-sent at each program switch**, and the order follows material id | Pine 1,629 uniform calls for 98 switches of 66 programs | Engine: program-sorted opaque list; fewer lit programs (families) |
| B7 | **The coarse HLOD lost the look** (only a tone and a lit grid) | dressing.md: no eave bands, neon or roofs past the ring | Bake (NF4 / DP4) |

### It helps (why a fix is easier here than in legacy)

| # | Advantage | Evidence |
|---|---|---|
| A1 | **One choke point.** All drawing happens in 47 engine and game files (plus 7 build-time SDK bakers); no shard runtime file creates a mesh | `grep "new (Instanced\|Skinned)?Mesh("` over `src/shards` outside `-legacy` and `generators` finds 0 files |
| A2 | **Content is data at build time**, so the bake can merge, dedupe, atlas and build HLODs offline. Legacy built Nine's whole city at boot in hand code | `sdk/bake/*`, the tile writer, `coarseCopy`; streaming.md's slab design |
| A3 | **One material language.** Every graph is IR (118 ops, `render/graph/compile.ts`). One GLSL compiler makes every graph a classic program, and identical IR gives an identical program | frame-cost.md §6 |
| A4 | **Data-only hosts** (G454): a batch stage takes rows and returns draws. It is host-bar clean, with no shard branch | HOST-BAR.md tests 2–6 |
| A5 | **Pieces already exist**: FC16 still-merge, welds, `tiledMesh`, celled culling, `ring: 'cell'` (Nine since `87f7d2c37a`), precompile | — |

## 5. The target architecture: a batch stage between the hosts and three

```
 shard data (sections, placements, graph IR)          ← unchanged (G32, G306)
        │  bake (Node, per product)
        ▼
 cell batches: per tile × material family × distance band, ≤ 4 MB chunks with bounds
 instance tables: per (geometry LOD, family), parts merged, colourways as instance colour
 texture arrays per family (KTX2), HLOD per cell carrying the full look
        │  load (no join, no clone, no CPU transform)
        ▼
 batch stage (engine): one Mesh per chunk, one InstancedMesh per (LOD, family),
 culled by cell cluster, sorted by program → material → depth, counted against a budget
        │
        ▼
 three WebGLRenderer, classic GLSL programs only, one draw hook
```

1. **Baked static batches per cell.** The game's tile writer merges every static, one-copy draw of a tile by material
   family and distance band. It takes in what the placements, welds and refine kits emit today, and keeps each weld
   node's `until` as a band. NF10's tile slabs are its first case. A family is a classic program plus its constant
   parameters. Two placements with the same family land in one chunk. The partition checks run at bake time.
2. **A small fixed set of uber-materials.** Graphs compile through IR → GLSL (NF13) into classic families: unlit
   graph, lit PBR, toon, painterly, foliage (alpha-test plus wind) and additive. Materials that differ only in
   parameters share one program. In a merged chunk the parameters ride per vertex, or in one row of a small
   per-family data texture. They never go in UBOs on iOS.
3. **Instancing for every repeat.** One instance table per (geometry LOD, family). The parts of a model that share a
   family are merged at bake (a tree's bark and twigs, a boulder's variants as one geometry where they share a
   material). Colourways that differ only in colour become instance colour. If Jake allows non-facade multi-draw, the
   forest and crags take the batched path again (question 2).
4. **Atlas and texture-array packing at bake.** The textures of each family are packed into one `sampler2DArray`
   per tier, and a per-vertex or per-instance layer selects one. Merging no longer stops where the textures differ.
5. **HLOD per cell.** Past the near band a cell draws one coarse batch that carries the full look (NF4's paint, eave
   bands, neon), plus the far impostor at grid range.
6. **A draw budget per frame.** Phone: ≤ 150 draws (G913) and ≤ 30 µs of render CPU per draw at 4x, read by one
   Developer counter and by the frame-floor rows. A shard over budget fails its frame-floor row, as long frames do
   (SF63).
7. **State-sorted submission.** Opaque objects are sorted by program, then material, then front to back. Transparent
   objects keep back-to-front.
8. **One draw hook.** The memory, ownership and label bookkeeping run per resource once, or on Developer census frames,
   never per draw.

**What changes.** *Format:* one generic output schema for cell batches and instance tables, written by the bake and
never by hand; the per-row `draw` becomes a hint; the graph IR does not change. *Bake:* the batch writer, texture-array
packing, a coarse bake with the full look, and the IR → GLSL validation. *Engine:* the GLSL back-end (NF13–NF18), the
batch library, the program sort, one hook, cluster culling and the budget readout. *Hosts:* placement, weld and refine
hosts hand their static copies to the batch output instead of building meshes. Dynamic things (crowd animation, movers,
creatures, the viewmodel) keep their hosts.

**What stays.** The host bar and data-only APIs, no shard branches, E271 / E272 for facades, G32 / G306 (graphs stay
the public material path), G884 (the spawn view loads under the loader), legacy as the A/B baseline until Jake's QA
(G933), and the 1.2 GB per-shard memory cap (G534 / G556). Merged chunks replace the unions and per-tile copies, so
memory should go down. EP6 measures it.

## 6. Rows

All readings use matched poses, Chromium CPU 4x and WebKit (Mac), "iPhone 16 Pro", phone tier, 2x and muted, with
legacy and shardfile in one session. The numbers go in the commit message (G506). Visual rows are Opus only (G848).
Every look-changing commit carries a before / after capture (G844).

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| EP1 | **The draw census as a script** (`scripts/perf/draw-census.mjs`, from `tmp/wildshard-v-engine-perf/census.js`): per frame, draws by pass and owner, µs per draw, programs, `useProgram`, uniform calls, wrapper overhead | Prints this draft's §2.1 table for Nine P4 and Pine Q4 in both modes in one run; no Debug row and no URL switch | **done** `b6907b9d7e` (sp-x1): five behavior controls; private-map, four-mode phone 4x census on `2db7659-mvv9uizu`, 60 frames per window. Native draw medians Nine LG/SF 153/152, Pine 140/213; every attributed frame reconciles. Native paired render CPU is separate from hooks and sampled wrapper overhead; zero/unmapped costs stay null. | S |
| EP2 | **One draw hook** (low-hanging fruit L1): fold the six wrappers into one; ownership and upload observation once per resource; labels only on Developer census frames | Wrapper overhead (outer − three `renderBufferDirect`) ≤ 0.3 ms a frame at Nine P4 and Pine Q4, both modes (today 0.9–2.0); `properties.get` hooks ≤ 0.1 ms; memory and ownership tests green | **in flight** (2026-10-30, sp-x2): one draw/property dispatcher; original ownership, nested-failure, residency and real-GC controls pass. G958 parity is now proven for the ownership cut and `74f9e94`: each causal pair has 18 fresh M3 A/A + 18 A/B zero-pixel captures (Nine P1-P5, Pine P1-P4, both modes), plus 11 native component A/A + 11 A/B exact. Runtime is unfrozen. Actual `74f9e94` PWA 402x874 / DPR2 / 4x results are mixed: Nine LG/SF wrappers 0.495/0.644 ms, properties 0.245/0.431; Pine 0.674/1.177 and 0.758/0.839. Both 0.3/0.1 ms limits remain open. `cc9336974a` retains the matched numbers and source-function attribution for the next cut; rejected label-flag and branch-order trials are withdrawn. No general frame-time win or completion claim. | S |
| EP3 | **Program-sorted opaque list** (L2) | Pine Q4 shardfile: `useProgram` ≤ distinct programs + 10 (98 → ≤ 76); uniform calls −20 %; captures pixel-identical at Q1–Q4 and P1–P5 | **closed: measured** (2026-10-30, sp-o5 on GLSL, golden cams 1 / 5 / 14): a program-first sort on each draw's actual program saves ~1 switch on Nine (55 → 54; opaque 19 switches / 18 programs, already near-optimal; transparent 31 stays back-to-front) and ~4 on Pine (59 total); pixel-identical. Bars met without it: Nine 55 ≤ NF15's 55, Pine 59 ≤ PF15's 70. Not built (G872, wildshard-new; NF22 / PF15 close with it). Earlier TSL prototype: `8b5c3d946d` | S |
| EP4 | **GLSL graph back-end** = NF13–NF18 (nine-fix), shared with pine-fps | As NF15 / NF17: Nine work ≤ legacy + 0.5 ms; 0 `beforeDraw` a frame on every shard | Opus | L |
| EP5 | **Graph looks back on the batched path**: Pine's forest and crags on `BatchedMesh` as legacy (stopgap L3, until EP4 makes the looks classic); facades stay instanced | Pine Q4: tree draws ≤ 9 (main + shadow); boulders ≤ 2; total draws ≤ 140; work ≤ legacy + 1 ms; behind a Debug row until Jake's Pine QA | **done** = PF1 / PF2 (`8a59427b63`, `5326499f61`): graph looks ride the batched path by default; Pine spawn 165 → 109 draws | S |
| EP6 | **Baked static batches per cell** (NF10 / NF11 generalized): every static one-copy draw merged at bake by tile × family × band | Nine P4: main draws ≤ 110 (155); Pine Q4 ≤ 120 (162); GPU memory ≤ today's at spawn; before / after board at P1–P5, Q1–Q4 **Pine bar met (2026-10-30, sp-o5)**: `0e43573dbd` draws each merged cabin prop once (the barrel drew its merged geometry 4 times, crate / bucket twice): Pine Q4 shardfile main draws 124.3 → 120.3 (draw-census, 120 in 51/60 frames). Nine P4 184 rides on sp-x1's slab re-chunk (96 → 24). Next: Pine cabin groups per cell (board). | Opus | L |
| EP7 | **Families with parameters, texture arrays per family**: materials differing only in constants share a program; textures packed per family at bake | Distinct programs drawn: Nine ≤ 40 (63), Pine ≤ 45 (66); KTX2 arrays on iOS Simulator with no upload errors; parity per golden still (≥ 40 dB PSNR, < 1 % of pixels > 8 off) **First piece landed (2026-10-30, sp-o5, PF7b)**: `render/layeredMaps.ts` builds a family's same-format KTX2 textures into one compressed array and patches a classic material to read `map` at a per-vertex layer; Pine's creature coats use it (`08e2f62a2a`), per-slot constants on data bones (`farHerd.ts`). **Nine bar restated (G872, 2026-10-30): ≤ 43 programs** once NF16's post merge (sp-o3) and the fabric kit / facade-shell instancing land; the last 3 to 40 are look changes on unrelated one-offs (sky planet body vs ring, MeshBasic one-offs). Nine GLSL programs drawn 53 → 49 at golden cams 1/5/14: held graphs one shape `2164737243` + `30d2059416`, colourless instances share the coloured program `5c84e5ee0f`. Pine's ≤ 45 arrives with NF17 (its 5 under-* cover programs are byte-identical shaders split only by TSL's per-texture key). **Nine at 48 (2026-10-30)**: `15a9322a19` slab chunks as one identity instance, `8950f3c90e` slab anchors draw nothing, `4fe6619330` fixed the black diners (white instance colours set inside onBeforeRender stayed unbound in three's cached vertex array; now handed over after the frame). With NF16 → 44, the accepted bar. | Opus | M |
| EP8 | **Repeats merged by part, colourways as instance colour** (B5): one instance table per (LOD, family) | Pine boulders, barrels, crates: one draw per LOD; Nine crowd ≤ 8 draws (22); captures match **in flight (2026-10-30, sp-o5)**: Nine crowd dye merge `42a294a34f` + fix `c95ce392e0` (the kit read aDye as a constant 0, so dyed umbrellas drew near black): crowd draws 24–26 → 14, frame calls 146–150 → 135–137 at cams 1/5/14, board `3eea4b0b67` (`art/nine-dragon/ep8-crowd-dye/`). **≤ 8 needs a crowd re-bake**: the 14 left are one table per walker / sitter family per LOD, so fewer draws means baking the families into shared tables. **Driftwood measured, no cheap part merge left** (HEAD `f11d022a01`, cams 1/5/14): the palms (15 draws at cam 1) and cover families (≈ 25 at cam 14) are one table per shape proto × LOD on one material (instancing cannot merge shapes; cover is cell-culled, so FC12's `merge` would draw every copy); the coarse props tiles `props1xy` (12–14) are tile streaming; `mesh-shadow-pieces` are E153's shadow-only chunks. What is left is ≈ 13 static view draws sharing `kit-still` / `kit-rock` / `kit` across separate world-scene steps (pier, hut, shrine, rocks, zipline, plaques), plus their cascade draws: a runtime still merge across scenes, ≈ 16 MB of duplicated vertices unless the originals are dropped, so default-off behind a Debug row. Coordinator's call; PF7 next. | sp-o5 | M |
| EP9 | **Cluster culling engine-wide** (NF5 generalized): copies bucketed by cell, legacy's thresholds (7° / 3.5° / 1 m), delta upload | Pine, Driftwood and Nine 360° pan at 4x: moving-frame work within 0.5 ms of still; buffer calls a moving frame ≤ legacy's | **done** (G941, wildshard-new) `e43772077d` (sp-x6; capture sp-x9, native cameras bit-identical): Pine P1–P4 A/A + A/B exact, Driftwood P1 exact; Nine A/B 4 / 210 / 0 / 0 / 0 px kept (board `6c23d7d7a6`: P2 restores a copy pre-EP9 culled, as legacy; P1 a 4 px cull edge). Pan bars met: NF5 / PF16 (Nine 11.4 vs 12.2 still, Pine 17.8 vs 18.9; `d60f431cc9`) | S |
| EP10 | **Draw budget as a gate**: ≤ 150 draws and ≤ 30 µs render CPU per draw at 4x on the phone tier, in the frame-floor rows and a Developer counter | A frame-floor row fails above budget at any matched pose; Nine, Pine and Driftwood pass after EP2–EP8 **in flight (2026-10-30, sp-x8)**: gate/counter `e084a14dfa` delivered; 21 controls, engine/root types and typed lint pass. Pinned 4x phone floor completes 120 paired samples/pose: Nine spawn 150 calls / 89.33 us max per draw, stair-street 129 / 105.43, so both correctly fail CPU while cadence passes. Developer counter visible on, absent off (same pin). Nine/Pine/Driftwood budget acceptance stays open for EP2–EP8; no performance pass claimed. | sp-x8 | S |
| EP11 | **Spike: cluster instancing** (Nanite-lite): one instanced draw per family pulls vertices from a data texture by cluster id; no multi-draw | A throwaway in `tmp/` draws Nine's kit fabric in ≤ 5 draws on Chromium and the Simulator; reports vertex cost and memory; a go / no-go for Jake, nothing landed | Opus | M |
| EP12 | **HLOD with the full look** (NF4 / DP4 for every shard with coarse copies) | Grid neighbours and Nine's decks match the legacy goldens (cams 17 / 18 / 21 / 22) | Opus | M |

Order: EP1 → EP2 + EP3 + EP5 now (cheap, independent) → EP4 (the Nine plan's NF13–NF18) → EP6 + EP8 + EP9 in
parallel → EP7 → EP10 as the gate → EP11 when a lane is free. EP12 follows NF4. Every row is safe to start before the
grill except EP5, which waits on question 2.

**Plan done when:** at every matched pose, Nine and Pine shardfile have main-thread work **below** legacy's on Chromium
4x and WebKit, ≤ 150 draws and ≤ 30 µs per draw, and the iOS Simulator holds 30 fps with max frame ≤ 50 ms. Jake's phone
QA (G933) is the final check.

## Approved Debug retirements (G944–G947)

| Row | Kept default / source | Verification |
|---|---|---|
| TRUST meter (phone), G944 | **done** `1550680178` (sp-x1): B status row; desktop arc retained. Debug A/C, selector and low-arc CSS removed. | Actual RideHUD/HudSlots/App component, phone B and desktop arc at trust 0/50/100: six matched captures, zero changed decoded pixels and identical DOM. No HUD layout change. |
| Phone bloom, G945 | **done** `03cf658f60` (sp-x1): phone Off, desktop On; Debug setting/module/strings removed. Existing borrowed effect settings and live custom post-graph bloom remain. | Actual before/after engine inclusion expression in the same three/postprocessing HDR component: both tier profiles zero changed decoded pixels. Not a whole-world or performance claim. |
| Hook zip, G946 | **done** `9f82c22737` (sp-x1): browser Rise fixed; Debug/query/module/strings removed. Explicit native course API retained for existing behavior oracles. | Real Rapier/SimHost course: 96 ticks, peak Y 6.050000000745058, every snapshot/event/position/velocity f64 bit identical. Native trajectory component captures: zero changed decoded pixels; three original guard controls pass. |

| Early 3x3 reveal, G946 | **done** (sp-x8): initial full coverage; readiness experiment, Debug row and saved selector removed. | Actual ClientAssets/TileStreamer/registration component: 804 × 1200, zero changed decoded pixels; all 64 tiles covered and every lease released. Original first/return/refusal laws remain. [Labelled component capture](../../../art/debug-retirements/g946-early-default.webp). |

| Idle-frame reuse, G946 | **done** (sp-x8): normal cascade cadence; still-view detection, alternate cadence and Debug row removed. | Actual cascade policy and WebGL shadow maps: identical 16-frame decisions and 804 × 1200 pixels. Normal cascadeRedraws stays. [Labelled component capture](../../../art/debug-retirements/g946-idle-default.webp). |

| Refine dither, G946 | **done** (sp-x8): immediate fine/coarse publication; Debug row, fade tables, channels and unused shader helper removed. | Actual TileDriver/tiledMesh scoped component: identical resident sets, index buffer and 804 × 1200 pixels. Retained rings and fine/coarse completion masks stay. Handler no-op removal was carried in ace8409509, acknowledged by sp-x2. [Labelled component capture](../../../art/debug-retirements/g946-dither-default.webp). |

All six approved rows are retired. FXAA stays merged (G947).
The component captures above do not claim full-world screenshot parity. For the sp-x8 rows, same-build whole-world repeats changed 43 Nine pixels; that live-view evidence is retained without a zero-pixel claim. Six native coverage/residency/cadence/tile suites pass 63 assertions; root types and named typed lint pass. All component browsers are closed.

## Approved Debug retirements (G953–G956)

All five selected paths are **done** on origin/main (sp-x8):

| Row | Source | Verification |
|---|---|---|
| Graph batches: Batched; facades stay instanced | `1955c4e49f` | Actual place/Node material/native multi-draw plus explicit instanced component: kinds and buffers identical, 804 × 1200 pixels unchanged; 14 original behavior checks. [Capture](../../../art/debug-retirements/g953-graph-default.webp). |
| Animal pose rate: stepped | `7556e1f5fe` | Actual pose cadence over 96 frames: 96/96/48/48/24/24 bone updates, root/bone matrices and pixels identical. [Capture](../../../art/debug-retirements/g954-pose-default.webp). |
| Road residency: Tiles | `153a2cf63f` | Before deletion, held-input phone drives cross 45 seams: Chromium 2,384 m and WebKit 2,800 m after publication, maintained witnesses/errors/context-loss all zero. Chrome's initial far-seed construction prefix is excluded. Actual compact tile component has identical attributes/indices/byte plans and pixels; 12 original native controls. [Default component](../../../art/debug-retirements/g955-road-default.webp), [seam samples](../../../art/debug-retirements/g955-road-seams.webp). |
| Grid boot programs: dropped experiment | `de0b050da0` | Complete finishStage executable with the old pick Off is byte-identical (12,273 bytes). Actual default/legacy/standalone ordering, refusal and native program keeper: 13 original assertions pass. No material/program key changes; bounded retirement keeper stays. |
| Tile residency: 5x5 | `5768a89ca6` | Actual TileDriver/tiledMesh: resident sets across three positions, indices and pixels identical; 39 original driver/collider/mesh assertions. Exact 3x3 colliders, visual slack, explicit cell declarations and NT8 ranking stay. [Capture](../../../art/debug-retirements/g956-tile-default.webp). |

All component comparisons use matched 804 × 1200 decoded images; they are not whole-world parity or performance claims. Root types and named typed lint pass. `617668ffaf` + `4cb6f34ccc` add the real authoredRows.add census without double-counting unchanged parameter-forwarding adapters; unresolved ordinary rows still refuse. Five focused census controls pass and the full 7,719-file ratchet passes. Peer NF14 Graph back-end row/strings remain unlanded and preserved for its board. All owned browsers/previews are closed.

## 7. Low-hanging fruit for the Pine / Nine plans

Each is ≤ 1 day, measured on live `14dd10d` (Chromium 4x). wildshard-v slams these into the plans named.

| # | Fix | File:line | Expected | Proof | Plan row |
|---|---|---|---|---|---|
| L1 | **Fold the per-draw wrappers into one hook.** `uploadOwnership` observes object, geometry and material on every draw and on every `properties.get`. `shadowMaterialOwnership` runs `admitObjectDraw` and `instanceof` checks. `memorySaver` asks a `seenGeometry` set. `gpuLabels` checks `developer()`. `compressedTextureRetirement` counts depth. Make each one per resource once (a `WeakSet` seen check), with labels on census frames only | `render/uploadOwnership.ts:256-269`, `render/shadowMaterialOwnership.ts:69-90`, `render/memorySaver.ts:228-240`, `render/compressedTextureRetirement.ts:31-50`, `render/gpuLabels.ts:418-428` | **−1.0 to −2.0 ms a frame at 4x** on both shards and both modes (measured wrapper overhead 0.92–1.99 ms + `properties.get` 0.22–1.07 ms) | Census: outer − three `renderBufferDirect` ≤ 0.3 ms at Nine P4 and Pine Q4; memory-saver, upload-ownership, shadow-ownership tests green | **New row in both**: nine-fix NF21, pine-fps (next free row); = EP2 |
| L2 | **Sort opaque objects by program.** `renderer.setOpaqueSort((a, b) => programId(a) − programId(b) ‖ a.material.id − b.material.id ‖ a.z − b.z)`, reading `renderer.properties.get(material).currentProgram` | where the engine creates the renderer (`src/engine/render/renderer.ts`) | Pine: `useProgram` 98 → ~70 and fewer light re-uploads, **~−0.5 ms** (estimate, measure first). Nine: 72 → ~63, ~−0.2 ms | Census `useProgram` and uniform calls; pixel-identical captures (only same-depth opaque order changes) | pine-fps new row; nine-fix NF22; = EP3 |
| L3 | **Pine's trees and crags back on `BatchedMesh`.** `render/nodes/nodeInstancing.ts:102-107` now hoists the `#extension` lines above the batching prefix, which looks like the fix for the compile error `7727599482` worked around (prove it: 0 shader errors). Let the forest and crag graph looks batch again: the facade ban stays, and legacy Pine already draws its forest this way on Jake's phone. Debug row **Forest batching: batched / instanced** (RENDERING.md: a risky render change ships behind a row) | `engine/world/forest/Forest.ts:95`, `engine/models/place.ts:814`, `test/no-graph-batches` (narrow to facades) | Pine Q4: −36 draws (45 → 9), boulders −10; **−2 to −3 ms at 4x** (≈ 46 draws × 45–80 µs, plus their `beforeDraw`) | Census at Q1–Q4: tree draws ≤ 9, total ≤ 150; Pine captures match; 0 shader errors on Chromium and WebKit | pine-fps (the QC4 "batched trees again" call); = EP5. Needs question 2 |
| L4 | **Nine's coarse facade on one program** (already NF2) | `render/nodeCoarseMask.ts:13`, `engineNodesHandler.ts:370-379` | 22 programs → 1; program switches 72 → ≤ 55; ~−0.5 ms (estimate) | NF2's done-when | nine-fix NF2 (no new row) |
| L5 | **Re-cull like legacy, for Pine and Driftwood too** (NF5 is engine code). Pine and Driftwood make 18–99 buffer calls a walking frame from the same culler | `engine/models/cull.ts:123` (`View.changed`), `:359` (`Sinks.commit`) | Nine −2.7 ms a moving frame (streaming.md); Pine and Driftwood: their walk segments' share, measured by NF5's probe | NF5's done-when, plus the Pine / Driftwood walk | nine-fix NF5; add a Pine line to its done-when |
| L6 | **Far dressing comes back with NF1.** With `ring: 'cell'` (`87f7d2c37a`, not yet live at `14dd10d`), every tile is held, so the `residentCopies` filter passes every copy | `game/shardfile/worldScenePlacement.ts:180`, `:234` | 0 ms (draws unchanged); restores eaves 395 → 790 at spawn | NF7's census at cams 1 / 5 / 14 / 27 on a build with `87f7d2c37a` | nine-fix NF7 (proof only) |

L1 + L2 + L3 together aim at **−3.5 to −5.5 ms** on Pine's 20.8 ms frame (legacy 13.2). L1 + L2 + L4 aim at about
**−1.7 to −2.7 ms** on Nine's 13.8 ms (legacy 9.1), before the GLSL back-end. These are estimates. Each fix proves its
own number.

## 8. Questions for Jake

1. **Do you accept the verdict: keep the format and the hosts, and fix the runtime layer (GLSL back-end, batch stage,
   one draw hook)?**
   - Skip for now
   - **Yes, fix the runtime: no format redesign** *(recommended: Nine's draw list already equals legacy's; the gap is
     per-draw cost and lost batching, both in the engine)*
   - No, plan a format redesign first
2. **May non-facade content use multi-draw (`BatchedMesh`) again, as legacy Pine's forest does on your phone today?**
   - Skip for now
   - **Yes for forest and crags, behind a Debug row until your Pine QA; facades stay instanced** *(recommended: −36
     draws on Pine at once, and the iPhone kill was the facade path only)*
   - No: instancing only, and Pine waits for EP6 / EP8 to cut tree draws
3. **What is the frame bar: parity with legacy, or below it?**
   - Skip for now
   - **Below legacy at every matched pose, ≤ 150 draws, ≤ 30 µs per draw** *(recommended: legacy is not Unreal-level,
     since its Nine frame has 83 one-off meshes)*
   - Parity with legacy (+0.5 ms), as the Nine plan's done-when
4. **When does the batch stage (EP6–EP8) start?**
   - Skip for now
   - **After the GLSL back-end lands (NF13–NF15), with Opus lanes; EP1–EP3 and EP9 start now** *(recommended: merging
     classic programs is simpler than merging node materials, and the cheap fixes are safe under every answer)*
   - Now, in parallel with NF13

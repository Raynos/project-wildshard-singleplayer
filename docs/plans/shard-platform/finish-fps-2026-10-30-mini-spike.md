# Finish the fps plans tonight (mini spike)

**State:** spike 2026-10-30 ~22:00 Cancun, by wildshard-v's subagent, for wildshard-new. Ask E518. Jake: *"Dude, BS.
Finish all the rows. Use the subagent to spike how to finish all these rows over here. In these four plans. And once
that's done, the mini spike. Send the mini spike to the builder."* He QAs Nine Dragon and Pine Hollow fps on his iPhone
tomorrow (G942, G960). The four plans: [nine-fix](nine-fix-mini-plan.md), [pine-fps](pine-fps-mini-plan.md),
[engine-performance](engine-performance-mini-plan.md), [nine-tiling](nine-tiling-mini-plan.md). Rows are read at
HEAD `ec0488bbfc` (the working tree carries stale copies of nine-tiling and pine-fps; HEAD is newer).

## The verdict in 5 lines

1. **Nine is GPU-bound on the phone** (Jake's meter, live `55eaf50`, 21:33): frame 79 ms at (a), 44–47 at (b); CPU is
   only update 3 + render 7 ms. Every cut today was CPU, and Chromium 4x and the Simulator do not model the phone GPU.
   **The GPU rows (G1–G5 below) go first tonight.** Lead found: the silhouette pass shades its 10-step silk fog on every pixel.
2. **All open rows but one can finish tonight** (24 rows, plus G1–G5 and PF18 / PF19 from this spike). Only **NF18** (delete the TSL runtime) truly waits for Jake's QA
   (G933 / G935). PF13's last sentence and the plans' final checks are his phone check itself (G942).
3. "Parked till after QA" on EP12, PF17 and NT5 rests on no decision. Build them or close them as measured tonight.
4. Expected after tonight: Nine CPU P1 ~6.9 ms vs legacy 7.4. Nine's phone GPU must fall from ~79 ms to ≤ 30 at pose (a)
   (G1 measures, G2–G5 cut). Pine P1 12.6 → ~10.2 ms vs legacy 9.3: PF13's 12 / 16 met; below legacy not certain.
5. Rule for the night: **no lane stands down while a row in these four plans is open** (G960, G872).

## The GPU plan for Nine (new rows, top of the schedule)

**What the phone says.** `gpu~` is `frame − max(update + render, 33.3 ms)` (`src/engine/core/frameCost.ts:129`), so
at (a) the GPU and compositor take about the whole 79 ms frame, and about 44 ms at (b). On screen: 1.41–1.6 M
triangles, 128–133 draws, 72 programs, DPR 2 (804 × 1748 drawing buffer). A 30 fps hold needs the GPU frame ≤ ~30 ms,
which is −60 % at (a). Render scale stays 2× (Jake's rule); no dynamic resolution.

**Lead, read from the emitted GLSL tonight.** `compositeRow()`'s silhouette program
(`src/shards/nine-dragon-stack/generators/compositeGraph.ts:53-76`, lowered by `emitGraphGlsl`) is 4,047 nodes,
~6,110 estimated instructions, 1,176 GLSL lines. Its 10-iteration silk-fog band loop sits at the top level (line 86 of
the emitted body), and so do ~600 of its statements. Only the final line colour is inside `if (lineOn)` (line 935). So
**every pixel of the 1.4 Mpx frame runs the fog march**. Legacy runs `silkFog()` only inside `if (e > 0.002)`
(`nine-dragon-stack-legacy/look/render/jiehua.ts:127-132`), on edge pixels only.

Why it is hoisted: `fogged.transmission` is read outside the `lineOn` select, through `choose(near, 1, transmission)`
and the `edge` term. So the fog cone has more than one reader, and `glsl.ts` (`GLSL_BRANCH_LIGHT_COST`, the readers rule
at `:363` / `:724`) evaluates it on every pixel.

| Row | What | Next step | Done when | Lane | Size |
|---|---|---|---|---|---|
| **G1** | **Nine GPU census** (and Pine's PF11) | Extend `scripts/pine-hollow-gpu.mjs` (frozen-frame GPU ms; per-pass and per-group SUBTRACT; overdraw heat) with `--chunk=nine-dragon-stack`. Poses: golden cams 1 / 5 / 14 / 27 plus the phone's (a) (looking down on a rainy street from a height) and (b). Toggles: `shadow`, the `NdJiehuaGraph` silhouette and jiehua draws, the display `TextureEffect`, FXAA, depth copy, `alpha-tested`, and groups (rain streaks, canopy cards, crowd and umbrellas, facade kit and slabs, neon / signs / glyphs, lanterns, wet-street reflection, movers). LEGACY and SHARDFILE on one served build, Chromium `--use-angle=metal` (the Mac GPU is the same tile-based Apple family), 804 × 1748. Write the table into nine-fix and the json into `tmp/`, never `progress/`. Calibrate the phone/Mac ratio from Jake's (a) = 79 ms. | A per-pass and per-group GPU ms table at 6 poses in both modes, where the parts add up to the whole within 10 %; the top 5 GPU costs named, with SHARDFILE − LEGACY for each | Codex (measure only) | S–M |
| **G2** | **Silk fog only on line pixels** | In `silhouette()` put the fog behind one select: `choose(lineOn, vec4(lineC, edge), vec4(0))`, with `transmission` read only inside it (no outer `choose(near, 1, T)`). Or, in the compiler, branch a cone that only selects on the same condition read. Check the emitted GLSL: the loop sits inside `if (lineOn)` | Silhouette emitted GLSL has 0 top-level loop statements; M3 post capture pixel-identical at P1–P5 (same math on line pixels, 0 elsewhere); G1's silhouette SUBTRACT drops ≥ 70 %, and the phone-scaled GPU saving at (a) goes in the commit | **done** (sp-o2, 4801c23feb; sp-o4's uncommitted prototype): emitted silhouette loop depth 0 → inside `if (lineOn)`. Fixed-clock post capture (composer through, post clocks pinned) before vs after: P3 / P4 / P5 0 px, P1 / P2 2 px inside the A/A floor (2–3 px). Silhouette draw GPU (paired skip, Chromium ANGLE Metal, night rain, 804×1362): P1 1.39 → 1.02, P2 0.69 → 0.58, P4 1.57 → 1.05, P5 1.44 → 0.41 ms (P3 noisy). ≥ 70 % only at P5: dense views keep line pixels in most GPU groups | S |
| **G3** | **No heavy select arm runs unconditionally, anywhere** | A compiler report (`emitGraphGlsl` already returns `selects.light / branch` and `cost`): per shipped graph, the estimated instructions evaluated outside branches vs inside. List the top 10 by `unconditional cost × pixels drawn` (from G1). Then fix the top ones the G2 way. Suspects: the facade kinds 1–12 paint terms (NF4 ported legacy's per-kind paint; check it is not evaluated for every kind), the canopy haze loop, rain, wet street | Behavior-tested emitted-cost report (no fixed output pins); each fixed program pixel-identical; G1 re-run shows the GPU drop For sp-o1 (sp-o2's notes): sp-o4's P1–P5 ablation (tmp/sp-o4-nf13/fc/raw/g3-P{1..5}) puts all 39 transparent draws at 1.11 / 0.75 / 0.42 / 1.06 / 0.85 GPU ms; NOT yet split by owner (rain, crowd, umbrellas, cards): per-draw timer queries break Apple tiling (absolute numbers invalid), so split it with paired per-group skips (tmp/pf10-mine/gpusil.js is a one-material paired-skip template). **In flight (10-30, sp-x6):** compiler/census `0c03f5c570` / `f2f7765bff`, exact shader-identity join `6da0b2ceb7`, observed phone-only rank and strict capture loan `c14a822129`. The measured a2dc products admit 77 graphs; all supplied hashes match, zero saturation. Material coverage currently covers only Nine approx-a; the remaining five Nine/four Pine colour captures are pending. Fullscreen coverage is exact; material colour samples are a proxy, not shader invocations. Desktop-only reflect/haze are excluded. Facade colour/ink packing remains unlanded until exact captures; no GPU gain is claimed. | Codex for the report (non-visual); Opus for any fix that is not pixel-identical | M |
| **G4** | **Post-chain bandwidth** (NF16's measured remainder, now a GPU row) | At `0971464` the chain is RenderPass → PostGraphInputs → silhouette → jiehua → `TextureEffect` copy → FXAA: 7 target switches, 2 full-frame copies on a tile-based GPU. Fold the display copy into the composite's last draw (the design is in NF16's row). Also check G1's `depthcopy` | Target switches 7 → 6, programs 72 → 71, a fixed-clock post capture pixel-identical; GPU ms per G1 | **closed as measured for the grid** (sp-o2; wildshard-new): ad54714092 the Jiehua composite keeps display-colour pixels (scene alpha < 0 → scene rgb, alpha 1; no pixel change today); 18c89c2234 a post look with no display events draws its composite into the composer buffer and FXAA becomes the colour pass. But Nine on the grid runs `frame.ts` `composite()`: its display effect is how the region's frame crossfades in by cell weight (NORMAL blend, opacity = weight), so the copy stays there (P1 census at 18c89c2: still 7 switches, 72 programs; post capture vs parent P3–P5 0 px, P1 / P2 at the 1 px A/A floor). Folding it on the grid needs a weight-1 switch with no recompile hitch. **sp-o1, 23:40:** 8f591b94bc gives standalone Nine 18c89c2234's no-copy path (its `practice.active` display 0/1 blocked it, and never changed a pixel: the SRC copy ignores opacity, 4 px of 1.1 M); chain 5 → 4 passes there, the copy measured 0.11–0.31 ms M5 at (a). The grid's cell build binds no events, so its crossfade copy is unchanged. Per-pass bill at (a), M5 frozen frame, in-page shader edits: NdJiehuaGraph pass 0.9–1.0 ms, of which the silhouette's ALU is ≤ 0.2 (its 24 depth taps ≤ 0.1, the line-only fog branch 0.1–0.18) and the jiehua ALU ~0; FXAA 0.3–0.6. The rest is per-pass full-screen cost. **Fusion design** (silhouette into the jiehua draw, one target fewer): fused today the graph is 4,652 nodes (cap 4,096; instructions 7,068 / 8,192 fine), because the silk fog is inlined (~3,400 of the silhouette's 4,049). Let a post graph name a catalogue fog graph and call it as a function, as material graphs' `effectState.fog` does (`wsGraphFog`; transmission = fog(1) − fog(0), only on line pixels). The fused graph is then ~1,300 nodes and one draw. Host work: the post-graph format row, glsl emission of the fog function in the post context, the six host-bar tests | M |
| **G5** | **Look trades where G1 says the GPU goes** (G941: the builder decides from a board) | Only after G1. Typical candidates at (a): rain-streak layer count and size (alpha overdraw), canopy card overdraw, the wet-street reflection's resolution. Each one is a labelled before / after board (G844), logged in STATE "Autonomous decisions". Never render scale | Phone-ratio GPU at (a) ≤ 30 ms with G2–G4 + G5 For sp-o1 (sp-o2's notes): the viewmodel draws 18–20 skinned hull + mesh parts (CPU 0.84 ms at Nine P5 vs legacy's 0.46, where 8 parts draw rigid); sp-x8 cut the static rig palettes' uploads (1920 → 1200 texSub calls); merging the rigid hulls per material is the remaining draw cut. **sp-o1, 23:40:** census at (a) (hover 0.95,135,7.5, yaw −12, pitch −60, night rain; EXT timer K16 × 9–21 paired): rain, canopy, crowd and neon each < 0.1 ms; the kit's uber fragment is ~55 % of the frame (a flat fragment saves 1.6–2.0 of ~3.0 ms, as a quarter of the pixels does), spread thin (6 Perlin 0.3, silk fog 0.25–0.45, paint 0.2, the kind chain's registers). 1c3b618319: the flagstones (kind 3, 72 % of (a)'s pixels) draw on a kind-3 program, −0.23 ms mean, 0 px. Next: the plain walls (kind 0), −0.4…−1.0 ms at (a) / P1 in an in-page split, the program exact (0 px alone); its patch is ready and lands once the 4c5501a6ea crowd / balustrade regression is fixed (a failing crowd program skews the frozen-frame A/B) | Opus (o1) | M |

**Pine on the GPU:** PF11 is the same G1 run with `--chunk=pine-hollow` (the tool's home). Pine's earlier FC9 halved its
post on the GPU; check it is still not GPU-bound at the 2× buffer.

**Why not the Simulator for GPU:** it renders on the Mac GPU through Simulator Metal, so it is no closer to the phone
than Chromium on Metal, and it is slower to drive. The phone meter's A/B buttons (anim / blur / elite / map / hud /
post) exist, but Jake does no A/B toggling (JAKE.md). His one phone check tomorrow reads the result.
Instruments / Metal System Trace on the Simulator stays optional, only if G1's parts do not add up.

## Tonight's run: every open row

| Row | What's left (checked at HEAD) | Next step (file:line) | Lane | Size | Order | Done when |
|---|---|---|---|---|---|---|
| G1–G5 | above | above | x8, o2, o1 | | **1** | above |
| NF11 | Built: `SlabLibrary` (`src/game/shardfile/slabLibrary.ts`, `6a7af70264`, `15a9322a19`, `8950f3c90e`), and the join is gone (NF12 `857dc8b781`). Only the route proof and the mark are missing | Run the Nine route (spawn → two bridges → stairs → stair-top → arch tunnel) on a HEAD preview with the NF1 probe (`bufferData` / frame log) at Chromium 4x and WebKit | Codex | S | 2 | No frame > 50 ms; no upload > 4 MB after the reveal; 0 union rebuilds; board `4152abcd85` stands |
| NF17 (the "NF17½" close-out) | Parity done for every shard (Sunscar pass, Sky Reach accepted, Nalati 7/8 + crag, Driftwood and Pine). The frame half of the done-when has no per-shard readings | One `draw-census` (`scripts/perf/draw-census.mjs`) work p50 per shard at its golden P1: Driftwood, Nalati, Far Reach, Sunscar, TSL `180df449c9^` vs GLSL HEAD (legacy where it exists) | Codex | S | 3 | Each shard ≤ legacy + 0.5 ms where legacy exists, else ≥ 25 % under TSL, or a miss logged as its own row |
| NF16 remainder | = G4 | | o2 | M | 1 | as G4 |
| NF18 | **Waits for Jake's QA (G933, G935).** Prepare without landing: list the import graph of `EngineNodesHandler` (`render/nodes/*`, the TSL half of `graph/compile.ts`, the `three/webgpu` chunk) and the measured gzip saving | Read-only inventory in the row; nothing deleted | Opus | M | after QA | As the row |
| NF19 | The half-float prototype loses packed integers (`_AMISC` up to 15; 24,841 px). The design was wrong, not the idea | Halve only the true float channels (`_ASPILL`, `_AOFF` if they are floats); keep `_AMISC` as UNSIGNED_SHORT / BYTE integers. Find the slab channel writer in the bake (`fa1c6212aa`'s stager) and the attribute reader | Codex if pixel-identical (G958), else Opus with a board | S | 5 | Nine L0 GPU ≤ 56 MB; P4 A/B pixel-identical (or a G941 board); `vitest related` green |
| NF21 = PF14 = EP2 | The hooks are folded (`5503829cf5`, `src/engine/render/drawHooks.ts:127` is the one `properties.get` hook). Over bar: property reads 0.43–0.65 ms on Pine Q4 (bar 0.1); wrappers 0.33–0.62 (bar 0.3). The top cost is 523–528 texture property reads a Pine frame | At `drawHooks.ts:127`: skip the texture branch for resources already seen this frame (a `WeakSet` per frame, reset at frame start). Upload / ownership observation runs once per texture per frame, not per read | Codex (x2) | S | 2 | `properties.get` ≤ 0.1 ms and wrappers ≤ 0.3 ms at Nine P4 and Pine Q4 in both modes; M3 pixel-identical; ownership / memory tests green |
| NF23 | Open, unstarted | `src/game/plugin/channelPrograms.ts:79-93` (the non-copied branch): after the shared reads (`sharedAt`, 138 fields), evaluate the group's lanes as one merged program from `planMergedChannels(selected, names)`, with `names` = the shared keys in first-read order, as `mergedPlan` does for copied poses (`:39-46`, `:68`). On a refusal, run the lanes as today | Codex | M | 3 | Nine P5 `evaluate` self ≤ 0.1 ms (0.24–0.31); outputs bit-exact against the lanes over the route; refusals unchanged |
| PF5 | Partial (`5fbb571fc5`, `8cfbb131ca`). Elites still 0.48–0.57 ms vs legacy 0.11 (this session: legacy `elites` 0.115) | sp-o5 is on it. Profile `update:elites` self at P1; the rule loop's per-frame observation of every idle elite is the cost. The row allows the `ai` band for idle elites beyond 1.5 × `awareR` | Opus (o5) | S | 2 | Elites ≤ 0.15 ms; update p50 ≤ legacy + 0.3 at P1–P4; the elite e2e passes |
| PF7 | **Done at HEAD**: `41f6037981`, 5 / 5 / 0 draws at cams 1 / 5 / 14. The lane column was never marked | Mark it done | coordinator | — | now | — |
| PF9 | Guide uploads (`5432a07f12`) and trample uploads (`f77b6e3926`, −33 % bytes) done. Per-draw CPU (`interact-lit` 0.147 ms for 1 + 1 draws in legacy too; `pine-wildlife`) still open | Attribute with the census per draw: uniform count, `onBeforeRender`, morph / skin. `interact-lit` costs 0.15 ms in legacy too, so it is shared code | Codex (pixel-identical) | S | 4 | Each ≤ 0.1 ms attributed; captures identical |
| PF11 | Unmeasured | = G1 with `--chunk=pine-hollow` | Codex (x8, inside G1) | S | 1 | Pine GPU ms per pass at P1–P4; under the CPU frame, or a row with a board |
| PF12 | Not met on SHARDFILE update (+1.2–2.2 ms over legacy at `a677b86`) | Re-read on HEAD after PF5 / EP2 with `budget.mjs` (the plan harness) | Opus (o5, after PF5) | S | 4 | ≤ legacy at every pose; Simulator 30 fps (already PASS) |
| PF13 | After PF12. 12 ms / 16 ms at Chromium 4x | The same reading; WebKit ≤ 4 ms p50 at P1 | Opus (o5) | S | 6 | 12 / 16 at every pose and the walk, then Jake's QA (G942) |
| PF18 (new) | Update parity (Pine gap below) | Profile `main.world`, `main.equipment`, `engine.player.hud`, `pine.movers` self at P1 | Codex (x9) | S–M | 3 | Each ≤ legacy + 0.05 ms |
| PF19 (new) | Per-draw parity, 58 vs 46 µs | Terrain draw set, then `ShaderMaterial` per-draw work | Codex (x1) | S | 3 | ≤ 48 µs a draw at P1; identical |
| PF17 | "After Jake's QA" is not a decision. The design in the row is exact (flat per-vertex roughness / metalness / tint, layered normal and ORM arrays; `render/layeredMaps.ts` from PF7b) | Build it on the cabin unit at author time | Opus (o1, after G5) | M | 5 | Cabin textured parts ≤ 2 draws; P4 −0.4 ms; captures identical at P4 and a cabin close-up |
| EP2 | = NF21 | | x2 | | 2 | |
| EP4 | = NF13–NF18: all done but NF17 (close-out) and NF18 (QA) | Mark EP4 "done but NF18" when NF17 closes | coordinator | — | 3 | — |
| EP6 | Pine met (120.3). Nine P4 main draws ≤ 110 not re-read since the cell slabs (NF15 reads 91–139 frame draws) | `draw-census` Nine P4 on HEAD. If over: merge the remaining static one-copy draws per cell (sp-o2's lane today) | Opus (o2, after G4) / Codex reading **Read 2026-10-30 22:08 (sp-o2, 18c89c2 GLSL, Chromium phone): Nine P4 main draws 135.** The largest share is the NF11 slab chunks, each a one-instance `InstancedMesh` under its key's anchor (`slabLibrary.ts` `bind` → `publications`): `kit:paifang` 14, `kit:stair-terraces` 3, `kit:well-l-deep` 3 (+ `kit:cut` 1); the viewmodel is ~20 draws. Design: one `BatchedMesh` per anchor (its key's material and flags, `perObjectFrustumCulled` = the key's `frustumCulled`, castShadow / receiveShadow / layers / renderOrder from the key), each published chunk `addGeometry` + one identity instance with a white colour, retired chunks `deleteInstance` / `deleteGeometry`, capacity grown with `setGeometrySize`; chunks of one key must share an attribute layout (else keep instanced). ~−15 to −17 draws, per-chunk culling kept, pixel-identical. Costs: a batched program variant per slab material (warm it in precompile, or the first draw links in play) and programs 72 → ~75. Hard rule (wildshard-new): no facade multi-draw (E271 / E272): any anchor whose key is a facade stays instanced and `scripts/test-facade-instancing.mjs` keeps passing. Alone it leaves P4 ~118–120; ≤ 110 also needs the viewmodel's rigid hull draws. **Closed as measured (G872, wildshard-new)**: (a) adds programs and a hitch risk and still lands ~118–120; per-tile merging costs GPU while the phone is GPU-bound | S | 4 | Nine P4 main ≤ 110 |
| EP7 | Nine 44 accepted (G872). Pine drawn programs ~55 vs ≤ 45 | Two shadow depth programs sample a map without alpha test (`shadowMaterialOwnership.ts`): share the texture-less depth programs (−2, exact). Then the census of drawn-program twins split by `HAS_NORMAL` / `USE_COLOR` | Codex (exact) | S | 5 | Pine drawn programs ≤ 45, or the rest logged as distinct states and the bar restated (G872) |
| EP8 | Nine crowd at 14 (bar ≤ 8): needs walker / sitter families baked into shared tables. Pine boulders / barrels done by PF2 / EP6 | Bake the crowd's per-family tables into one table per LOD (Nine generators: crowd), dye as instance colour (the `42a294a34f` path) | Codex if pixel-identical, else Opus | M | 5 | Crowd ≤ 8 draws; captures match |
| EP10 | Gate delivered (`e084a14dfa`). the old max is a worst whole-frame CPU/draw ratio, not an individual draw | Report mean render CPU ÷ draws (the meter's "60.2 µs/draw unscaled") at 4x beside the max. Mean reader `93db94eb65` delivered. **Measured miss (10-30, sp-x6, `bb68a5376f`):** 480 paired frames per shard, Metal, phone 2×, acknowledged 4× CPU. Nine/Pine max draws 133/145 pass 150; pooled means 49.854/99.705 µs miss 30. All four actual authored/spawn rows per shard are complete. Acceptance remains open; no floor or physical-device timing credit | Codex (x6) | S | 4 | Nine and Pine ≤ 150 draws and ≤ 30 µs mean per draw at 4x |
| EP11 | Not started; throwaway spike | `tmp/ep11-cluster/`: Nine kit fabric as one instanced draw that pulls vertices from a data texture by cluster id | Opus (any lane free at the end) | M | 7 | A go / no-go note in the row: draws, vertex ms, memory on Chromium and the Simulator |
| EP12 + NT4 look | NT4's geometry landed (`8b5c3d946d`: L1 17.4 %, 19.3 MB). Its look bar ≤ 10 is EP12's fix: L1 draws with `nine-coarse-facade` (diff 18.7); L0's own graphs give 6.85 in-page | The bake keeps each coarse set's look (kit / kit-cut / shell) and names its materials in `props.materials`. Name the unnamed L0 tile materials in the Nine bake first | Opus (o5, after PF13) | M | 6 | Forced-L1 capture at cams 17 / 18 / 22 ≤ 10 per channel mean vs L0; G844 board; NT4 and EP12 done |
| NT5 | Measured, not built (sp-o1): the 1 px rule flips no tile; forcing L1 gives no frame win (130 vs 128 draws, 11.2 vs 11.1 ms) | Close as **measured / no value** (G872, the NT3 precedent). No Debug row (G952) | coordinator | — | now | Closed with its numbers |

## The lane schedule (3 Opus + 5 Codex, G960 at ~88 %)

Every lane finishes its current task first: no interrupt, kill or re-brief mid-task (AGENTS.md). Hand over at the next
boundary. **Hard rule: no lane stands down while any row in these four plans is open.** When its list runs out, a lane
takes the next open row from the table above, else G3's next program.

| Lane | Now | 1st | 2nd | 3rd |
|---|---|---|---|---|
| o2 (Nine) | Nine below legacy (P2 / P3 / P5, EP6) | **G2** silk fog branch | **G4** post fold (NF16 remainder) | EP6 Nine P4 ≤ 110, then G3's fixes that are not pixel-identical |
| o1 (Pine → Nine GPU) | Pine creatures LOD | **G5** look trades from G1 (boards) | PF17 cabin | EP11 spike |
| o5 (Pine) | PF5 elites | PF12 → PF13 readings | EP12 + NT4 look | NF18 inventory (read-only) |
| x8 | Pine texture uploads | **G1** Nine + Pine GPU census (PF11) | NF11 route proof | NF19 float-only channels |
| x2 | EP2 + CI10 | EP2 / NF21 / PF14 texture reads | NF23 merged frame group | EP7 Pine depth programs |
| x6 | CI7 → CI9 | **G3** compiler unconditional-cost report | EP10 mean µs / draw acceptance | G3's pixel-identical fixes |
| x9 | CI9 prepare | NF17 per-shard frame close-out | **PF18** update parity | PF9 per-draw CPU |
| x1 | CI12 tapes | **PF19** per-draw parity | EP8 crowd tables | G3 fixes; NF11 if x8 is still on G1 |

## The Pine gap (Chromium 4x, P1, live `34220ae`, one session)

Plan harness (`budget.mjs` + `probe.js`, copied to `tmp/wildshard-v-finish-fps/`), "iPhone 16 Pro", phone tier, 2×,
muted, midday / clear, through `scripts/browser-lane.sh`, the same live build in both modes. The Mac was shared, so the
absolute numbers read higher than the builder's 12.6 / 9.3; the gap is the same size.

| | LEGACY | SHARDFILE | Gap |
|---|---|---|---|
| Work p50 / p95 | 12.0 / 13.7 | 15.9 / 18.0 | **+3.9** |
| Update p50 | 3.5 | 5.7 | **+2.2** |
| Render p50 | 8.3 | 9.8 | **+1.5** |
| Systems attributed (sum) | 3.29 | 6.04 | +2.75 |
| Main pass (draws, ms, µs per draw) | 92, 4.24, 46 | 98, 5.69, 58 | +1.45 |
| Shadow pass ms | 1.19 | 0.92 | −0.27 (SHARDFILE ahead) |
| Programs / `useProgram` / uniform calls | 105 / 64 / 756 | 111 / 60 / 668 | not the cost |
| GC (profile self, ms a frame) | not in top 22 | 0.17 | +0.17 |

**Update, +2.2 ms** (each system's attributed ms, SHARDFILE − LEGACY):
- `elites` 0.62 vs 0.12 (**+0.51**): PF5.
- `main.equipment` 0.68 vs 0.27 (**+0.41**): the drawn crossbow poses live (`608bcc949e`). PF6's accepted ~0.3 does not hold at P1.
- `main.world` 0.49 vs 0.13 (**+0.36**).
- `engine.creatures.update` 1.06 vs 0.79 (+0.27): o1's LOD task.
- `shard.pine.weather` 0.31 vs 0.05 (+0.25): `efdfa9e4f8` (night lights read once a frame) landed after this build.
- `engine.player.hud` 0.35 vs 0.18 (+0.17).
- `pine.movers` 0.13 (legacy has none).
- Shardfile tile / forest / presentation systems 0.11; `world.life` 0.14 vs 0.04; input and contexts +0.10; `hud.combat`
  and compendium +0.08.

**Render, +1.5 ms.** It is per-draw cost, not draw count: 58 µs vs 46 µs a draw.
- The terrain is split: `ground.fine` 4.4 draws (0.19 ms) plus 6.6 standard draws (0.66), against legacy's 9.9 draws
  (0.61). That is +0.24.
- `Mesh:ShaderMaterial` 7.7 draws, 0.33 ms, vs 5.5 draws, 0.10 (+0.23).
- Crags, boulders and logs +0.27, the forest +0.12, the viewmodel +0.09, projectiles +0.08, the sky dome +0.07.
- The far herd is ahead (−0.14), and so is the shadow pass (−0.27).

**New rows from this** (pine-fps; Codex where exact, G958):
- **PF18 update parity:** `main.world`, `main.equipment` (drawn pose), `engine.player.hud` and `pine.movers` each to
  ≤ legacy + 0.05 ms, `vitest related` plus the elite / quest e2e. Expected −1.0 ms. Codex (x9 after NF17), S–M.
- **PF19 per-draw parity:** the terrain as legacy's draw set (fold `ground.fine` into the standard tiles' draws, or
  attribute why it is a separate material), and the `ShaderMaterial` draws' per-draw uniform and `onBeforeRender` work.
  Done: µs per draw ≤ 48 at P1, captures identical. Expected −0.5 ms. Codex (x1), S.

**Expected Pine P1 after tonight**, on the builder's scale: 12.6 − PF5 0.4 − PF18 1.0 − EP2 0.3 − weather 0.2 − PF19 0.5
≈ **10.2 ms vs legacy 9.3**. That meets PF13's 12 / 16 at P1. "Below legacy" (G937) needs the rest of `creatures`
(o1) and the GC hunt, and is not certain tonight.

**Nine P1 check:** not re-measured. The phone evidence moved Nine's question to the GPU. On the CPU side, the levers
already measured in NF15 are EP2 (−0.3), NF23 (−0.1 to −0.15), the post fold (−0.1), cull `changed` (0.14) and the
day-sky push (0.07). Together they put Nine P1 ~0.5 ms under legacy's 7.4.

## What waits for Jake's QA, and why

- **NF18** (delete the TSL runtime): G933 keeps legacy and the old runtime as the A/B baseline until his fps QA; G935
  says TSL leaves the WebGL runtime *after* that QA.
- **LD5–LD10** (legacy deletion): G933 / G908, his word only, never inferred.
- **The final checks** of each plan (PF13's "then Jake's phone QA", nine-fix and nine-tiling done-when): G942, his one
  phone check tomorrow.

Nothing else. EP12, PF17 and NT5's "after QA" have no decision behind them. G941 lets the builder decide look trades
from boards, and G872 closes measured rows.

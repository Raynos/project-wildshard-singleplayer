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
| **G1** | **Nine GPU census and Pine PF11** | **closed, measured (G963; `a9cadc076b`, `f14504f650`, refreshed `f33d642372`)**: all 20 immutable a2dc rows complete across six Nine poses / four Pine poses and both modes. Full tables: [G1/PF11](nine-fix-mini-plan.md#g1--pf11-gpu-census-2026-10-30-sp-x8-e518). | G872 restated the impossible additive-sum bar: retain paired skips, no-op/drift and depth-passing coverage instead. No independent GPU clock, physical-phone budget or Simulator-process acceptance is claimed. | sp-x8; closed | S–M |
| **G2** | **Silk fog only on line pixels** | In `silhouette()` put the fog behind one select: `choose(lineOn, vec4(lineC, edge), vec4(0))`, with `transmission` read only inside it (no outer `choose(near, 1, T)`). Or, in the compiler, branch a cone that only selects on the same condition read. Check the emitted GLSL: the loop sits inside `if (lineOn)` | Silhouette emitted GLSL has 0 top-level loop statements; M3 post capture pixel-identical at P1–P5 (same math on line pixels, 0 elsewhere); G1's silhouette SUBTRACT drops ≥ 70 %, and the phone-scaled GPU saving at (a) goes in the commit | **done** (sp-o2, 4801c23feb; sp-o4's uncommitted prototype): emitted silhouette loop depth 0 → inside `if (lineOn)`. Fixed-clock post capture (composer through, post clocks pinned) before vs after: P3 / P4 / P5 0 px, P1 / P2 2 px inside the A/A floor (2–3 px). Silhouette draw GPU (paired skip, Chromium ANGLE Metal, night rain, 804×1362): P1 1.39 → 1.02, P2 0.69 → 0.58, P4 1.57 → 1.05, P5 1.44 → 0.41 ms (P3 noisy). ≥ 70 % only at P5: dense views keep line pixels in most GPU groups | S |
| **G3** | **No heavy select arm runs unconditionally, anywhere** | A compiler report (`emitGraphGlsl` already returns `selects.light / branch` and `cost`): per shipped graph, the estimated instructions evaluated outside branches vs inside. List the top 10 by `unconditional cost × pixels drawn` (from G1). Then fix the top ones the G2 way. Suspects: the facade kinds 1–12 paint terms (NF4 ported legacy's per-kind paint; check it is not evaluated for every kind), the canopy haze loop, rain, wet street | Behavior-tested emitted-cost report (no fixed output pins); each fixed program pixel-identical; G1 re-run shows the GPU drop For sp-o1 (sp-o2's notes): sp-o4's P1–P5 ablation (tmp/sp-o4-nf13/fc/raw/g3-P{1..5}) puts all 39 transparent draws at 1.11 / 0.75 / 0.42 / 1.06 / 0.85 GPU ms; NOT yet split by owner (rain, crowd, umbrellas, cards): per-draw timer queries break Apple tiling (absolute numbers invalid), so split it with paired per-group skips (tmp/pf10-mine/gpusil.js is a one-material paired-skip template). **Historical report/capture work (10-31, sp-x6):** behavior-tested compiler/census `0c03f5c570` / `f2f7765bff`, exact source join `6da0b2ceb7`, wrapped fragment accounting `bdce449eaa` with real grade-context control repaired in `8681f7b2de`. Phone-only weighted ranking is still partial: the material pilot covers Nine approx-a, while the additional colour capture refused unapproved restoration pixels. The expired preview is not reused under another build. Facade colour/ink packing **landed `fd1d0af320`**, accepted under the explicit G941 coordinate/RGBA ruling: all five independent A/A, A/B and restoration poses completed, only the already-ruled P1 pair differed. The separate P2 ruling is retained in its code body. Both real facade aliases draw; all other differences still refuse. Cost and capture numbers are in the code commit, with no measured GPU saving claimed. Desktop-only reflect/haze stay excluded; complete weighted coverage and a GPU drop were not established by this exact cut. **Closed, measured (G963; `fd1d0af320`, refreshed G1 `f33d642372`)**: compiler/census guards remain and facade colour/ink branching is qualified under the existing G941 ruling. Full wrapper unconditional estimate 1,966 → 1,391; no measured GPU saving or blanket weighted-coverage claim. | Codex for the report (non-visual); Opus for any fix that is not pixel-identical | M |
| **G4** | **Post-chain bandwidth** (NF16's measured remainder, now a GPU row) | At `0971464` the chain is RenderPass → PostGraphInputs → silhouette → jiehua → `TextureEffect` copy → FXAA: 7 target switches, 2 full-frame copies on a tile-based GPU. Fold the display copy into the composite's last draw (the design is in NF16's row). Also check G1's `depthcopy` | Target switches 7 → 6, programs 72 → 71, a fixed-clock post capture pixel-identical; GPU ms per G1 | **closed as measured for the grid** (sp-o2; wildshard-new): ad54714092 the Jiehua composite keeps display-colour pixels (scene alpha < 0 → scene rgb, alpha 1; no pixel change today); 18c89c2234 a post look with no display events draws its composite into the composer buffer and FXAA becomes the colour pass. But Nine on the grid runs `frame.ts` `composite()`: its display effect is how the region's frame crossfades in by cell weight (NORMAL blend, opacity = weight), so the copy stays there (P1 census at 18c89c2: still 7 switches, 72 programs; post capture vs parent P3–P5 0 px, P1 / P2 at the 1 px A/A floor). Folding it on the grid needs a weight-1 switch with no recompile hitch. **sp-o1, 23:40:** 8f591b94bc gives standalone Nine 18c89c2234's no-copy path (its `practice.active` display 0/1 blocked it, and never changed a pixel: the SRC copy ignores opacity, 4 px of 1.1 M); chain 5 → 4 passes there, the copy measured 0.11–0.31 ms M5 at (a). The grid's cell build binds no events, so its crossfade copy is unchanged. Per-pass bill at (a), M5 frozen frame, in-page shader edits: NdJiehuaGraph pass 0.9–1.0 ms, of which the silhouette's ALU is ≤ 0.2 (its 24 depth taps ≤ 0.1, the line-only fog branch 0.1–0.18) and the jiehua ALU ~0; FXAA 0.3–0.6. The rest is per-pass full-screen cost. **Fusion design** (silhouette into the jiehua draw, one target fewer): fused today the graph is 4,652 nodes (cap 4,096; instructions 7,068 / 8,192 fine), because the silk fog is inlined (~3,400 of the silhouette's 4,049). Let a post graph name a catalogue fog graph and call it as a function, as material graphs' `effectState.fog` does (`wsGraphFogSample`, returning colour plus the admitted transmission directly, only on line pixels). The fused graph is then ~1,300 nodes and one draw. Host work: the post-graph format row, glsl emission of the fog function in the post context, the six host-bar tests. **00:10:** no author-side trim fits: the fused graph is 1,535 real nodes (0 duplicates, 9 identity wrappers); the 4,652 budget is the fog's 10-band loop body counted per iteration. **10-31, sp-x6:** named post-fog provider `6539ace4d818` landed with full call-instruction/array/sampler admission, private-branch accounting and scoped typed feeds; 29 focused cases/root types/typed lint green. It extends the G599 client-only post platform. The direct transmission avoids cancellation and a second 4,219-instruction fog call (which would exceed 8,192). **Fusion closed as measured (2026-10-31, sp-x6; G872 timebox)**: safe named-fog and storage APIs stay; author activation is withdrawn. Original named-fog fusion differs at all five fixed-clock poses. A private linked-program calibration is exact at P1/P3–P5, but P2 A/A 6 px and A/B 2 px are outside G941. No production pass-count or GPU gain. The two precision frontiers and remaining exact-link lever are detailed below. | M |
| **G5** | **Look trades where G1 says the GPU goes** (G941: the builder decides from a board) | Only after G1. Typical candidates at (a): rain-streak layer count and size (alpha overdraw), canopy card overdraw, the wet-street reflection's resolution. Each one is a labelled before / after board (G844), logged in STATE "Autonomous decisions". Never render scale | Phone-ratio GPU at (a) ≤ 30 ms with G2–G4 + G5 For sp-o1 (sp-o2's notes): the viewmodel draws 18–20 skinned hull + mesh parts (CPU 0.84 ms at Nine P5 vs legacy's 0.46, where 8 parts draw rigid); sp-x8 cut the static rig palettes' uploads (1920 → 1200 texSub calls); merging the rigid hulls per material is the remaining draw cut. **sp-o1, 23:40:** census at (a) (hover 0.95,135,7.5, yaw −12, pitch −60, night rain; EXT timer K16 × 9–21 paired): rain, canopy, crowd and neon each < 0.1 ms; the kit's uber fragment is ~55 % of the frame (a flat fragment saves 1.6–2.0 of ~3.0 ms, as a quarter of the pixels does), spread thin (6 Perlin 0.3, silk fog 0.25–0.45, paint 0.2, the kind chain's registers). 1c3b618319: the flagstones (kind 3, 72 % of (a)'s pixels) draw on a kind-3 program, −0.23 ms mean, 0 px. Next: the plain walls (kind 0), −0.4…−1.0 ms at (a) / P1 in an in-page split, the program exact (0 px alone); its patch is ready and lands once the 4c5501a6ea crowd / balustrade regression is fixed (a failing crowd program skews the frozen-frame A/B). **sp-o1, 00:10:** 3a1b02062a the plain walls (kind 0) draw on their own program too (rows kindKits, kitKinds.ts + kitKindGraphs.ts): kinds 0 + 3 save 0.27–0.35 ms at (a), 0.38–0.41 at P1, 0 px at (a). 12738017cf hides Nine's chunk boundary (engine Boundary.ts on the flat y = 0 ground, 125 m under the streets): 0 px at (a), P3–P5; whole frame at (a), alternated × 3, median 2.77–3.15 → 2.13–2.19 ms, draws 105 → 96, phone tier. A scene-root sweep finds no other unseen cost (largest 0.03 ms). Open lead: Pine's boundary read +0.26 / −0.3 ms in two paired runs (too noisy, needs a build A/B). The viewmodel's shading is ~0.33 ms, but its transparent-queue draw is engine design **sp-o3, 11-03 01:30 (G872):** Jake's 13 fps / gpu~ 45.7 ms at (a) is the 10-30 TSL read on live 55eaf50: it predates GLSL, G2, kinds 0 / 3, Boundary, NT4 and every cut below; the phone's number now is unknown until his QA. Metal census on 6838fb680e (frozen frame, whole): (a) 1.73, cams 1 / 5 / 14 / 27 1.88 / 2.00 / 1.84 / 1.33 ms; live (a) GL calls clean (10 texSub, 4 bufferSub, 6 FBO binds a frame). Kit / facade fragment ~0.57 of (a)'s 1.73 (flat bound). Landed: 25130c518a silhouette taps only where lines show (0 px), ab77c51ba3 kit colour + ink one select (0 px), e31e8f5672 the emitter groups same-condition selects (uber kit unconditional 1,440 -> 898, facade 909 -> 511; whole (a) 1.644 -> 1.575, cam 14 1.825 -> 1.694; Pine 0 px, Nine <= 706 px window-line edges). Not built: kinds 5 / 9 apart (slab chunk cap), a window cell per reader (96 KB graph cap). | Opus (o1) | M |

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
| NF11 | **done (2026-10-31, sp-x8; G872 / G941)**: serialized hidden first draws, complete native upload reserve and covered loading; `e853b2f8e8` privately prepares grapple fonts during loadout | Cold Chromium 4x / WebKit 1x routes: 1,758 drawn frames each, native max **36 / 47 ms**, work 17.9 / 13 ms; upload **582,944 / 3,999,982 B**; 49 chunks / 704,182 triangles retained, no errors or missed samples. Whole-packet five-pose hashes match parent repeats (G941 known P2 pixel only); font-cut five-pose A/B and real grapple mark/chip A/A + A/B are zero pixels. G872 uses native Clock delta: separate WebKit observer's 52 ms gap remains a diagnostic (native 33 / work 3), not a miss. Explicit NF1 between-leg board starts retained; no physical-phone claim. Both bars pass; full detail in nine-fix NF11 | Codex (x8) | S | 2 | No native frame > 50 ms; no upload > 4 MB after reveal; 0 union rebuilds; board `4152abcd85` stands |
| NF17 (the "NF17½" close-out) | **closed, measured (2026-11-02, sp-x6; E518 / G872)**: parity stands and all requested current work readings are present. | Reserved committed HEAD `f5537e3c07` / `f5537e3-mw04gryl`, golden P1, Chromium Metal phone 2× / CPU4×, 180 native frames each: Driftwood **11.2 ms**, Nalati **11.6**, Pine **12.5**, Far Reach / Sky Reach **13.2**, Sunscar **5.8**. Far/Sky are one product, not two independent readings. | sp-x6; measured close | S | closed | NF17c retains the historical TSL reference; current numerical misses are recorded in NF17d/f/g and the table below, not waived or reported as universal CPU-bar passes. |
| NF16 remainder | = G4 | | o2 | M | 1 | as G4 |
| NF18 | **Waits for Jake's QA (G933, G935).** Prepare without landing: list the import graph of `EngineNodesHandler` (`render/nodes/*`, the TSL half of `graph/compile.ts`, the `three/webgpu` chunk) and the measured gzip saving | Read-only inventory in the row; nothing deleted | Opus | M | after QA | As the row |
| NF19 | **closed, measured / not viable in scope (G963; `a9cadc076b`)** | Immutable a2dc storage census: 82,099,948 B native channels/indices; true-float-only halving saves 10,359,220 B and still leaves 71,740,728 B before other geometry. Packed/fractional aMisc cannot be silently converted. | sp-x8; closed | S | closed | 56 MB bar not met; no production half-float edit or relaxed pixel/storage guard. [Full verdict](nine-fix-mini-plan.md) |
| NF21 = PF14 = EP2 | The hooks are folded (`5503829cf5`, `src/engine/render/drawHooks.ts:127` is the one `properties.get` hook). Over bar: property reads 0.43–0.65 ms on Pine Q4 (bar 0.1); wrappers 0.33–0.62 (bar 0.3). The top cost is 523–528 texture property reads a Pine frame | At `drawHooks.ts:127`: skip the texture branch for resources already seen this frame (a `WeakSet` per frame, reset at frame start). Upload / ownership observation runs once per texture per frame, not per read | Codex (x2) | S | 2 | `properties.get` ≤ 0.1 ms and wrappers ≤ 0.3 ms at Nine P4 and Pine Q4 in both modes; M3 pixel-identical; ownership / memory tests green |
| NF23 | Open, unstarted | `src/game/plugin/channelPrograms.ts:79-93` (the non-copied branch): after the shared reads (`sharedAt`, 138 fields), evaluate the group's lanes as one merged program from `planMergedChannels(selected, names)`, with `names` = the shared keys in first-read order, as `mergedPlan` does for copied poses (`:39-46`, `:68`). On a refusal, run the lanes as today | Codex | M | 3 | Nine P5 `evaluate` self ≤ 0.1 ms (0.24–0.31); outputs bit-exact against the lanes over the route; refusals unchanged |
| PF5 | **closed, measured (G963; `a1396948e9`, `bb68a5376f`, `4b88f10f24`)** | Idle/unhit elite fixed steps and paused frame inputs are gated by the original wake/aggro/engage conditions. P1–P4 elites 0.210 / 0.179 / 0.127 / 0.194 ms at Chromium 4×; only P3 meets 0.15 ms. Original G941 look/wake rulings and native tests remain. | sp-o5; closed | S | closed | Measured close, not all-pose CPU-bar acceptance. [Pine verdict](pine-fps-mini-plan.md#pf5-measured-verdict-2026-10-30) |
| PF7 | **Done at HEAD**: `41f6037981`, 5 / 5 / 0 draws at cams 1 / 5 / 14. The lane column was never marked | Mark it done | coordinator | — | now | — |
| PF9 | Guide uploads (`5432a07f12`) and trample uploads (`f77b6e3926`, −33 % bytes) done. Per-draw CPU (`interact-lit` 0.147 ms for 1 + 1 draws in legacy too; `pine-wildlife`) still open | Attribute with the census per draw: uniform count, `onBeforeRender`, morph / skin. `interact-lit` costs 0.15 ms in legacy too, so it is shared code | Codex (pixel-identical) | S | 4 | Each ≤ 0.1 ms attributed; captures identical |
| PF11 | **closed via G1, measured (G963; `a9cadc076b`, `f14504f650`)** | Four Pine poses / both modes complete. SHARDFILE whole throughput 1.431 / 1.700 / 1.594 / 2.000 ms; CPU submission 1.131 / 1.381 / 1.269 / 1.644 ms. | sp-x8; closed | S | closed | Diagnostic Metal census only; no new physical-phone or Simulator GPU-process acceptance. Full G1 tables retain no-op/drift/shared-host qualifiers. |
| PF12 | Not met on SHARDFILE update (+1.2–2.2 ms over legacy at `a677b86`) | Re-read on HEAD after PF5 / EP2 with `budget.mjs` (the plan harness) | Opus (o5, after PF5) | S | 4 | ≤ legacy at every pose; Simulator 30 fps (already PASS) |
| PF13 | After PF12. 12 ms / 16 ms at Chromium 4x | The same reading; WebKit ≤ 4 ms p50 at P1 | Opus (o5) | S | 6 | 12 / 16 at every pose and the walk, then Jake's QA (G942) |
| PF18 (new) | Update parity (Pine gap below) | Profile `main.world`, `main.equipment`, `engine.player.hud`, `pine.movers` self at P1 | Codex (x9) | S–M | 3 | Each ≤ legacy + 0.05 ms |
| PF19 (new) | **closed measured miss (2026-10-31, sp-x8; G872)** | Final ground merge/EP2 included in `4fb407395b`: P1 LEGACY/SF pooled **78.897/79.328 µs**, 180 native pairs each; SF hooks only ~11.175 µs/profile draw. Remaining stock matrix/submission/program/uniform/bind work has no safe exact skip. Full call table and shared-host qualifier: engine-performance §9 | Codex (x8) | S | 3 | ≤ 48 µs a draw at P1 missed; no waiver |
| PF17 | "After Jake's QA" is not a decision. The design in the row is exact (flat per-vertex roughness / metalness / tint, layered normal and ORM arrays; `render/layeredMaps.ts` from PF7b) | Build it on the cabin unit at author time | Opus (o1, after G5) | M | 5 | Cabin textured parts ≤ 2 draws; P4 −0.4 ms; captures identical at P4 and a cabin close-up |
| EP2 | = NF21 | | x2 | | 2 | |
| EP4 | **done but NF18 (waits for Jake's Nine QA)** (2026-11-02, sp-x6): NF17 HEAD P1 readings are recorded below; GLSL implementation/parity is complete. | Keep NF18 TSL deletion open under G933/G935; no runtime deletion or new QA claim. | sp-x6; closed except NF18 | — | closed | NF18 is the sole QA dependency, not a completed deletion. |
| EP6 | **Met (2026-11-02, sp-o2): Nine P4 main draws 110** on `43471277fa` (116 on `f5537e3c07`), pixel-identical; cuts and captures in engine-performance EP6. Pine met (120.3). Nine P4 main draws ≤ 110 not re-read since the cell slabs (NF15 reads 91–139 frame draws) | `draw-census` Nine P4 on HEAD. If over: merge the remaining static one-copy draws per cell (sp-o2's lane today) | Opus (o2, after G4) / Codex reading **Read 2026-10-30 22:08 (sp-o2, 18c89c2 GLSL, Chromium phone): Nine P4 main draws 135.** The largest share is the NF11 slab chunks, each a one-instance `InstancedMesh` under its key's anchor (`slabLibrary.ts` `bind` → `publications`): `kit:paifang` 14, `kit:stair-terraces` 3, `kit:well-l-deep` 3 (+ `kit:cut` 1); the viewmodel is ~20 draws. Design: one `BatchedMesh` per anchor (its key's material and flags, `perObjectFrustumCulled` = the key's `frustumCulled`, castShadow / receiveShadow / layers / renderOrder from the key), each published chunk `addGeometry` + one identity instance with a white colour, retired chunks `deleteInstance` / `deleteGeometry`, capacity grown with `setGeometrySize`; chunks of one key must share an attribute layout (else keep instanced). ~−15 to −17 draws, per-chunk culling kept, pixel-identical. Costs: a batched program variant per slab material (warm it in precompile, or the first draw links in play) and programs 72 → ~75. Hard rule (wildshard-new): no facade multi-draw (E271 / E272): any anchor whose key is a facade stays instanced and `scripts/test-facade-instancing.mjs` keeps passing. Alone it leaves P4 ~118–120; ≤ 110 also needs the viewmodel's rigid hull draws. **Closed as measured (G872, wildshard-new)**: (a) adds programs and a hitch risk and still lands ~118–120; per-tile merging costs GPU while the phone is GPU-bound | S | 4 | Nine P4 main ≤ 110 |
| EP7 | **closed, measured (G963; `ad3571fe2e`, `32142e8928`, `bbc01a75b5`)** | Nine 44 accepted by G872. Pine P1–P4 submitted programs 53 / 54 / 55 / 59; unused opaque-depth map flags removed, remaining native side/layout states are distinct. Old 45 miss retained; accepted four-pose bar ≤59. | sp-x9; closed | S | closed | Both Pine modes: 16 A/A +16 A/B full-RGBA comparisons exact; camera/clock/calls/triangles match. No FPS claim. |
| EP8 | **done (G963; `433030231b`)** | `4c5501a6ea` pairs original crowd colourways per family/LOD; fixes `7f50179cc2` + `3d493a97c1` restore ordinary-kit vertex slots and live crowd uniforms. All eight raw/packed source contracts remain (`d7d292fb2d`). | sp-x1 / sp-o5; closed | M | closed | ≤8 plain crowd draws enforced by placed-source controls. Immutable P1–P5 A/A exact; A/B exact except the explicit G941 P4 palette edge. No widened tolerance or GPU-time claim. |
| EP10 | **closed measured miss (2026-10-31, sp-x8; G872)**; gate/counter/mean/software delivery retained | Historical all-pose Nine/Pine **49.854/99.705 µs** remains distinct. Fresh `4fb407395b` Pine P1 native pooled LG/SF **78.897/79.328 µs**, max draws 87/93; separate SF call split: stock remainder 2.948, hooks 0.985, setProgram 0.861, uniforms 0.746, onBeforeRender 0.498, textures 0.200 ms/frame. Hooks ~11.175 µs/profile draw cannot bridge 79 to 30; no safe exact lever left. Detailed method/overlap/table in engine-performance §9; no official physical-phone claim | Codex (x8) | S | 4 | ≤ 150 draws retained; ≤ 30 µs missed, not waived |
| EP11 | **closed, measured no-go** (2026-11-02, sp-x6; existing 2026-10-30 sp-o1 spike, HEAD `4f68386`) | 21 slab meshes / 643,210 triangles became one 5,026-cluster draw. P4/P1 work p50: slabs 8.4/8.6 ms (repeat 8.2/7.7), cluster+cull 10.0/10.2, no-cull 7.8/8.2; JS cull alone 3.4–4.2 ms. Float textures 61.8 MB versus 75.9 MB slab buffers. | sp-x6; measured close | — | closed | No-go: marginal noisy no-cull saving, costly JS cull, GPU vertex-fetch cost unmeasured, no Simulator injection. No runtime change or new experiment; full original limits remain in engine-performance EP11. |
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


## G4 fusion measured close (2026-10-31)

The hour-bounded calibration closes the fusion attempt as measured, per
G872. Safe APIs `6539ace4d818` / `15767b7c1f5d` and precision representation
`fa8abbcdc038` stay landed; Nine retains its original two-pass programs.
No approximate activation, new pixel allowance, or GPU gain ships.

Both ordinary causal publishers passed their original source fences:
three owned author leaves differed and all 6,996 other inputs matched.
Chromium Metal, phone 804×1748, native composer, fixed post clocks and
cameras: normal named-fog fusion changed P1–P5 by **263,308 / 266,059 /
248,332 / 251,124 / 235,588 pixels**. Parent A/A was 3 / 5 / 0 / 0 / 0;
these are retained refusals, not an acceptance floor.

Two independent precision frontiers remain:

- **Intermediate half-float storage.** At P3, putting native half packing
  into the original silhouette alone changed 33,042 native half pixels
  and 3,909 final pixels. Actual Metal RGBA16F stores of 0.3 / 0.7 were
  0.2998046875 / 0.69970703125; native pack/unpack produced
  0.300048828125 / 0.7001953125. Storage rounded toward zero while packing
  rounded to nearest. The public `float16` op promises representation,
  not bit identity with every device's target store.
- **Jiehua arithmetic / UV addressing.** Replacing only the original
  UV-to-texel division with `gl_FragCoord.xy` changed 805,538 native half
  pixels and 363,985 final pixels. Software toward-zero packing alone
  still left 547,269 half / 246,317 final differences in fused P3.
  Matching CPU and actual GPU uniforms, clocks and cameras did not cure it.

The remaining lever is preserving both original program bodies in
separate function scopes, plus target-specific storage rounding. A
**private injected-program calibration**, not an admitted product, did
that and reduced one actual submission: P1/P3/P4/P5 A/A, A/B, restored
final RGBA and native-half hashes were exact. P2 still refused: A/A 6
non-G941 pixels, A/B 2 (738,669 and 571,721, each +1 green); all five
restorations were 0 pixels. This needs a data-only callable-post design,
actual storage-mode qualification and a complete ordinary product proof
before activation; raw shader linking is not a shipping API.

Retained evidence: `tmp/sp-x6-g4/post-pixels/reading.json`,
`post-cause-storage-coordinates/reading.json`,
`post-cause-highp-calibration/reading.json`,
`post-cause-software-rtz/reading.json` and
`five-linked-post/reading.json` under the same task root. No timing
acceptance is inferred from these shared-host, non-timing captures.

## NF17 HEAD work census (2026-11-02, sp-x6)

**Closed as measured, not universal acceptance of the original speed bar.**
The sole run used committed HEAD at reservation
`f5537e3c07fe5e889e17cf86cc82ab02c94d293b`, immutable build
`f5537e3-mw04gryl`, through `scripts/perf/draw-census.mjs` unchanged:
SHARDFILE only, golden midday/clear, iPhone 16 Pro PWA 402×874 CSS /
804×1748 canvas (2×), Chromium ANGLE Metal and CPU4×. Each product has
180 original completed native frames before its separate 180-frame GL
attribution and sampled profile; all five original guards passed with no
page errors or zero-draw baseline frames. No runtime or look change.

| Requested shard | Actual product / P1 | Work p50 ms | Render p50 ms | Native draws p50 | Retained reference and limit |
|---|---|---:|---:|---:|---|
| Driftwood | driftwood-isle / pier | 11.2 | 7.3 | 142 | TSL 14.4 → target ≤10.8: this point misses; shared-host overlap retained. |
| Nalati | nalati-grasslands / camp | 11.6 | 5.3 | 77 | TSL 12.0 → target ≤9.0: measured miss (NF17d). |
| Pine | pine-hollow / maintained P1 | 12.5 | 7.9 | 90 | Legacy retired; historical Pine-plan P1 13.5 is context, not a new matched legacy acceptance. |
| Far Reach | far-reach / spawn | 13.2 | 9.3 | 154 | TSL 15.8 → target ≤11.85: current point misses; historical exact HUD cut NF17e stays done. |
| Sunscar | sunscar-dunes / spawn | 5.8 | 3.3 | 61 | TSL 5.8 → target ≤4.35: measured miss (NF17f). |
| Sky Reach | same far-reach product / same spawn row | 13.2 | 9.3 | 154 | Display-name alias, not an independent sixth product or duplicate sample. |

The four non-Pine poses are camera 1 from the maintained golden table.
Pine uses the maintained census `--pine-pose=P1` at x=0, z=−235,
yaw=π, pitch=0; it is explicitly not the legacy golden gate at z=−200.
`far-reach` is authored and displayed as Sky Reach in the current product
and loading catalogue. No deleted legacy was revived or substituted.

Actual cohort: **2026-11-03 03:30:26.344–03:33:53.373 UTC**. PF13's
second count-only browser overlapped until its literal 03:31:09 closure:
this includes Driftwood's whole leg and Nalati's initial entry, so retain
shared-host provenance and make no isolated-host or compiler-causal gain
claim. The old TSL and legacy values above are retained references across
many runtime changes, not a new matched before/after experiment. All own
browsers closed, browser lane 0/4, and own 4402 lease normally released;
the other owner's immutable server remains available. No Simulator run.

Raw source/version/pose/180-frame rows and separate profiles:
`tmp/sp-x6-nf17-close/{reading.json,state.json,binding.json,census.log}`
and `<slug>/census.json`. Each raw census has its SHA-256 in `reading.json`.
The G872 established measured-close class is self-applied: keep numerical
misses explicit; do not waive the old limits or invent a pass.


## Grid spawn draw ledger (2026-11-03, sp-x8)

**Measured; the 150-draw cap remains open. No runtime change or exact
cut is claimed.** Self-apply G872's measured-close class to this
engineering census and assign the look-changing families to Opus.
The historical Simulator miss remains 173 against 150 at
`5c72cf6cf03568412d53b9df6e8efe4d75964076` / `5c72cf6-mvx8peek`.
It had no material/program/geometry ledger. Current content differs;
the new counts cannot establish a matched improvement or attribute
the old miss to a specific family.

One immutable preview at `b616c06a02dfcf6d49a333ec35ad6a24a471c1d0` /
`b616c06-mw0dyp5q` supplied this native Metal reading. Browser interval:
2026-11-03 07:48:50.637–07:49:06.920 UTC. Maintained title-button
navigation entered the actual grid: Developer/phone/live/seed 357,
spawn x≈0, z=−194, yaw π, pitch 0. iPhone 16 Pro context, 402×714 CSS /
804×1428 canvas (2×), all shadows/post/held passes retained. This is
Mac Metal attribution, not Simulator cadence or physical timing.

The first 120 clean frames measured **156–163 calls**, with 94 at 157.
The next 120 attributed frames measured 165–186; the four final clean
frames each measured 186. Streaming continued at the unchanged spawn;
these successive windows do not measure instrumentation overhead.
The attributed peak needs 36 calls removed, independently of the old
Simulator's 23-call gap.

| One actual peak frame | Calls | Finding |
|---|---:|---|
| Shadows |42| Shared depth materials already cover 22 and 17 calls, plus three single calls. Preserve cascade-selected geometry/callbacks. |
| Main scene |143| Ranked subsets below. |
| Screen effect |1| No redundant screen copy identified. |
| **Total** |**186**| Strict native material/program/geometry joins; 60 linked programs observed across the full attribution window. |

These rows are subsets of the main scene, not additional passes:

| Ranked family | Calls | Next work |
|---|---:|---|
| Driftwood grid L0/L1 ring draws |23| Preserve resident coverage, transition masks and frusta. Dropping a tier or reducing coverage is Opus look work. |
| Driftwood small + large cover |22| Two already-shared materials, 11 calls each. Fewer variants/density is Opus work; one program does not prove mergeable vertex/wind state. |
| Driftwood island props |20| Already one material over 20 geometries. Palm partitions have distinct instance populations/LOD contracts. Material sharing alone saves no calls; variant simplification is Opus work. |
| Driftwood kit-still |9| Already one material over 9 geometries. Authored simplification is Opus work. |
| Grid far proxies |7| No proved fully offscreen submission. Do not suppress visible neighbours. |
| Boulevard asphalt/junctions/signs |6| Already material-merged geometry; no duplicate submission identified. |

Driftwood's resident region owns 134 of 186 calls, including 42 shadows;
the separate ring draws above own 23. Caster density/shadow distance
reductions are also Opus look work, not exact culling.

Of 170 observed geometries, 82 had a nonempty declared channel whose
CPU array had already been released after upload. Empty-array hashes
are **not** original channel equality. Complete instance palettes are
also uncaptured. Apparent palm geometry matches cannot authorize exact
instancing. Zero omissions passed the conservative offline culling
check: changing camera matrices, moving/skinned objects and unavailable
bounds were excluded. This limits the evidence; it does not prove no
future exact implementation can help. No facade multi-draw, speculative
renderer edit, LOD/cap change or unnecessary pixel A/A/B was made.

Page/console/HTTP-response/GL errors and context losses were zero.
Five title→grid `ERR_ABORTED` requests remain raw; no clean loading-CLI
claim. All hooks restored, browser/context closed, own 4401 lease
normally released; X9 retained its independent OP4 lease.

Raw source/version/cells/helper hashes, native frame IDs and drawn
shader/resource joins: `tmp/sp-x8-grid-draws/{native-ledger.json,
summary.json,audit.json,census.log,preview.log,retained-audit.json}`.
Keep the cap open until an exact landed implementation earns capture
parity, or an explicitly approved Opus look change meets it.

**Met (2026-11-03, Opus; G872 ruling, G844 board
`art/driftwood-grid-draws/round-1-g913/before-after-board.jpg`).**
Native draws a frame, Chromium ANGLE Metal, iPhone 16 Pro 402 × 714 at
2×, phone tier, Developer, seed 357, live clock, after a 20 s settle.
Before: HEAD `0c3e3ca`, 120 frames a pose. After: `13bbae2567`,
1440 frames at spawn and 360 at each other pose.

| Pose | Before max (p50) | After max (p50) |
|---|---:|---:|
| Spawn (0, −194, yaw π) | 191 (191) | **144 (142)** |
| Cove (spawn, yaw −2.2) | 199 (177) | 137 (135) |
| Trail (−22, −90, yaw 0.75π) | 153 (153) | 126 (124) |

The before cove maximum is one streaming frame after the pose jump.
Simulator before, same SHA (sp-x1 OB8-GRID-HOME-DRAWS, official window
on `0c3e3ca16b`): home spawn 181 max draws, 1,055,435 median triangles,
p95 35 / max 47 ms, with 6 residents still pending. No Simulator after
reading is claimed: it belongs to the next milestone Simulator run.
Four cuts, all Driftwood-only (Pine and Nine untouched, G908; no
multi-draw, E271):
- **Grid double L1 (`afddc7b6f9`, ~10 draws, no visible change):**
  Driftwood's `farStandIn` assembly installed every coarse L1 props tile
  itself (`wholeRefinementCover`) while the grid's T8 ring drew the same
  tiles (same bounds and index counts, 0.8 m apart). A grid cell now
  skips the stand-in (`clientWorldAssembly.ts`); standalone keeps it.
- **Cove variant folds (`afddc7b6f9` + `13bbae2567`, look trade,
  ruled):** `coveFamilies.json` `fold` draws a folded prototype's copies
  as a kept one of its family. Every copy, tint, scale and collider
  stays; only the shape repeats. Palms 5 → 1 and broad palms 4 → 1 (each
  kept variant costs 2 LODs × main + shadow), shell / star / pebble /
  beach grass / yellow / white / fern / hibiscus / bush / flowering bush
  → 1, tufts 4 → 2. Ruling: these hide best of the listed trades.
  Low-poly toon copies differ in lean, scale and tint, so the trail
  close-up still reads as a grove. Cover density and the ground wear are
  unchanged. Kit-still merges and ring coverage were not needed.
- **Sky env rebuild spike (`af99979cd0`, exact):** a 120-frame window
  missed it. Every 15 s the toon sky rebuilt its PMREM environment whole
  in one frame (6 faces × box + dome, 10 GGX passes: +22 draws, 172 after
  the first cut). It now uses the stepped refresh, with a scene source's
  top level one cube face a step (`skyEnvironment.ts`). Pine's equirect
  keyed sky keeps its steps. The env-step frames now add ≤ 2.
- Margin 6 at spawn. Next lever, if content grows: phone-only far-LOD
  palm shadows (palms past 110 m are outside the phone's 80 m cascade,
  −2 draws now). It needs a per-tier LOD shadow field, because desktop's
  cascade reaches 220 m.

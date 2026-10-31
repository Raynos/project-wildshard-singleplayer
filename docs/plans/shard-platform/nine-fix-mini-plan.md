# Nine Dragon, fixed properly: frame cost, hitches and every missing dressing

**State:** `open` 2026-10-30 ~13:15 Cancun, grilled (G934–G942: fix the runtime, GLSL Nine first, slabs after wave 1, the bar below legacy, the builder decides look trades, Jake's phone check once at the end). Written by wildshard-v from three research
reports by its subagents; wildshard-new hands the rows to lanes and marks them after the grill. Ask E512. Jake, 12:15:
*"can you come up with a mini plan, like a brand new mini plan, to address all the 9 dragon issues we found, like in
detail, no matter what it takes, fixing everything properly, in the engine, in the shard file, all that stuff in 9
dragon. I don't know what the fix is, but you need to think hard, research exhaustively, and come up with a permanent
fix of doing it properly. Any dressing that's missing has to be added back."* It replaces the fix half of
[qa 10-30 QC1](../../../project/archive/2026-10-30-qa-2026-10-30.md); QC1 closes when this plan's done-when holds. G933 keeps legacy Nine as the
A/B baseline until Jake's phone QA of these fixes. Visual rows are Opus-only (G848). The engine-wide rows (NF13–NF18)
are shared with [pine-fps](pine-fps-mini-plan.md) and the [engine performance draft](engine-performance-mini-plan.md)
(E515); their low-hanging fruit for Nine lands here when that draft reports.

The research, measured on live `899682f` / `ff31df0` (Chromium 4x CPU and Playwright WebKit, iPhone 16 Pro, phone tier,
2x, legacy and SHARDFILE at matched poses):
- Frame cost: `tmp/wildshard-v-nine-plan/frame-cost.md`.
- Hitches: `tmp/wildshard-v-nine-plan/streaming.md`.
- Dressing: `tmp/wildshard-v-nine-plan/dressing.md`.
- Boards: [fps](../../../art/nine-dragon/e510-popin-fps/fps-table-board.jpg), [freeze and wall](../../../art/nine-dragon/e510-popin-fps/popin-board.jpg), [dressing parity](../../../art/nine-dragon/e512-dressing-parity/dressing-parity-board.jpg).

## What Jake saw, and why

| Jake saw (phone, 11:32) | Cause | Evidence |
|---|---|---|
| 7–19 fps the whole minute | **Every frame costs +60–72 % over legacy.** 141 of 156 objects draw with SF59 graph materials: three node materials on the WebGL renderer through `EngineNodesHandler`. Every node draw runs a JS hook (`beforeDraw`, `engineNodesHandler.ts:1402-1436`: program key ×144 a frame, variant, update nodes, uniform staging), then re-sends uniforms in `setProgram` (`nodePlainUniforms.ts:155-171`). The coarse mask gives every coarse tile its own program (`nine-coarse-facade`: 22 programs, `engineNodesHandler.ts:370-379`). | P4 stair top: 12.9–14.7 vs 7.5–9.3 ms work; 95 vs 67 programs; 72 vs 52 program switches; 462 vs 245 uniform calls a frame. Skipping the hook alone gives 11.4 ms. The cost was deferred knowingly on 10-15 (G436 / G437); ~100 handler commits since have not closed it, because the cost is the design. |
| Freezes and 98–460 ms frames | **Tile retire re-joins the city fabric synchronously.** 22 refine models are each one mesh whose geometry is the union of every held tile. A retire rebuilds the union in that frame (`refiningWholeLibrary.ts:149` → `joinWholePieces`, `wholePieceJoin.ts:107-136`), once per retired tile, and re-uploads 5–26 MB. | 161 / 302 / 389 / 182 ms on Chromium 4x, 73–134 ms on WebKit; legacy's worst is 15.8 ms. sp-o5's `dd70b795ab` (11:58) already makes retire skip the re-join. |
| "Untextured" cream walls, plain window squares | **Not loading. A paint pass was dropped in the port.** The wall is the facade shell's painted far face (kit kind 11). Legacy's shader (`look/facadeMaterial.ts:260-304`) paints glazed blue / green eave bands, paired windows, balconies and painted neon; the graph port (`077b7eeb59`, `architectureGraphs.ts:170-173`) kept only one big cream window per cell. | The same wall in both builds by a hide-one-mesh probe; unchanged after 40 s. |
| (not seen yet) A thinner city | **Everything outside the 5×5 tile ring is cut** (`worldScenePlacement.ts:179-184`): at spawn eaves draw 395 of 790 and lantern dots 562 of 698, and 4 of 5 portal rings are gone. Past the ring, towers are coarse copies with no signs, neon or roof dressing. **Movers sit at double height** (train y 301, not 150.5) because their rest pose is applied twice. **~7 % of neon and sign geometry is missing.** | 27 matched cameras: portal deck 0.44M vs 1.51M tris drawn; west aerial 0.85M vs 1.50M. |

Not real gaps: the "missing set meshes" (every set matches 1.00 across 27 cameras); "Sets 6 / 0, fp-arms 1 / 0" (a
blind spot in the legacy-deletion checker; both draw at runtime); crowd, lions, canopy, rain streaks and audio all match.
No decision or damage-list row approves any of the cuts above, so every one is restored.

## Wave 1: relief this week (each S, each lands on its own)

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| NF1 | **Nine holds its whole cell** (`ring: 'cell'` in Nine's product, as Far Reach does). In play no tile retires, and the city past the ring is resident (+82 MB GPU on ~400 MB, under the 1.2 GB cap). | Chromium 4x route: no `bufferData` ≥ 256 KB after the reveal; no frame > 100 ms; Simulator Explorer memory ≤ 1.2 GB (one reading). | landed 87f7d2c37a + consumer 06d86f2c22 (sp-o5); **open, measured 2026-10-30 (sp-x6)**: exact `06d86f2c22` vs parent `c739e64e8c`: `bufferData` ≥ 256 KiB after reveal **61 vs 124**, walking-only **9 vs 52**; max observed rendered-frame interval 99.9 vs 100.1 ms. Guarded Nine World Explorer, 60.1 s: NF1 parent `170c542e0b` native / Inspector **0.595 / 1.252 GB**, after NF1 + NT1 `06d86f2c22` **0.615 / 1.252 GB**. Inspector already exceeds 1.2 GB on the parent (+15,462 B after); both pins predate NT4. The existing watchdog uses native footprint / interval high (1,200 MB, report-only), not Inspector categories; GL budgets are separate. Earlier 0.837 / 1.863 GB belonged to Driftwood and is retracted. Zero-upload bar fails; not done. | S |
| NF2 | **One program per coarse graph**: the coarse mask shares one uniform pair per graph, with per-tile values in the tile's `onBeforeRender`. A stopgap; NF18 deletes it. | P4: programs 95 → ≤ 75, program switches ≤ 55 a frame; pixel-identical at P1–P5. | **closed at 77** `a05007be26` (sp-o5; G: wildshard-new 10-30: the 5 programs no scene object uses come from precompile's family warm at load, no per-frame cost; the count carries into NF13–NF15): golden cams 1 / 5 / 14 programs **95 → 77** (`nine-coarse-facade` 20 → 2; Pine 117 and Driftwood 96 unchanged); 2 short of ≤ 75, switches not yet measured. Pixels: no mask error; Nine's coarse facades never draw under NT1's whole cell, and Pine's 23–38 shared-mask draws differ from a same-build rerun only by foliage / weapon sway. | S |
| NF3 | **Movers at their height**: mover copies at identity under the posed `nds-*` object; a test pins each rest position. | Train y 150.5, gondola ~109.7, drones ~181.6 / 200.4; cams 1 / 2 / 8 / 9 show movers as legacy. | **done** 970b3906ae (sp-o5) | S |
| NF4 | **The painted facades back**: port legacy `facadeMaterial.ts:260-304` kind 11 term for term into `architectureGraphs.ts` (openings, paired windows, balcony lip and rail, glazed eave bands, painted neon with emission), then audit kinds 1–12 the same way. 0 draws, 0 tris, 0 MB. | Cam-27 wall shows the bands; the wall rect within 10 / channel of legacy's `[108,124,146]` / `[101,143,129]`; Chromium and WebKit; G844 before / after board. | **kind 11 done** `d6f1822f09` (sp-o5): cam 27 blue / green / wall rects within 2 / channel of LEGACY on the same build, Chromium and WebKit ([board](../../../art/nine-dragon/e512-nf4-facade/cam27-board.jpg)). Kinds 1–12 audit **done** `e802c073cf`: 2, 5, 7–10, 12 matched; 1, 3, 4, 6 took LEGACY's missing terms; mean pixel diff to LEGACY drops at all 7 checked cams ([board](../../../art/nine-dragon/e512-nf4-facade/kinds-audit-board.jpg)). | S–M |
| NF5 | **Re-cull like legacy**: per-copy culling uses legacy's thresholds (7° / 3.5° / 1 m) and uploads only the changed tail (`cull.ts:123-152`, `:340-352`). | Nine 360° pan at 4x: work p50 within 0.5 ms of the still hold (today +2.7 ms); buffer calls per moving frame ≤ legacy's ~41; no instance missing at the frame edge in a 4-shot pan. | Opus · **done** (2026-10-30, sp-x1, G958; EP9 cull `e43772077d` on HEAD `b609e7179b`): Chromium phone 4x Nine P4 pan 11.4 ms vs 12.2 still (−0.8); buffer calls per moving frame mean 7.3 / p50 0 / max 62 (legacy ~41 mean); zero edge omissions, full-turn frustum test `d60f431cc9` | S |
| NF6 | **Retire slack for render tiles**: attach at radius r, retire at r + 1; collider ownership stays at the exact 3 × 3 (D2 B), so walking along a ring edge never thrashes (matters for every ring shard once NF1 makes Nine's whole cell resident). | A focused test on `TileDriver`; Pine / Driftwood probe: no retire-attach pair within 5 s. **done** `c3356249ed`: 18 focused cases, root types, named lint and 7,696-file ratchet pass. Pinned `c335624-mvv96v5q`, phone-tier Chromium 4x / 2x scale: eight actual walking crossings each; Pine 13 attaches / 0 retires, Driftwood 20 / 8, both **0 pairs within 5 s**, 0 page errors. **Release correction:** `c3356249ed` also widened collider retirement; restore the exact physical ring. Original `tile-colliders` no-gap/identity/retirement oracle stays unchanged; focused collider + driver suites pass with visual owner reuse and coarse cover retained through eight crossings. | **done** sp-x1 | S |
| NF7 | **Far dressing whole**: facade placements, lanterns and portal rings draw every copy within legacy's LOD distances (small pieces `far: 85`), not just resident tiles; colliders stay on the collider ring. With NF1 this is NF1's proof. | At cams 1 / 5 / 14 / 27, copies in view within 5 % of legacy (eave, box, windows, rail, lantern / cage LODs, lantern dots, 5 portal rings); draws ≤ 150 (G913). | **done** by NT1 `06d86f2c22` (sp-o5): at cams 1 / 5 / 14 / 27 every listed copy count equals LEGACY's (box, eave, windows, cage / lantern / rail and their far LODs, lantern near / far / dots, portal rings); draws 120 / 146 / 149 / 147 (LEGACY 118 / 148 / 153 / 148). | S |
| NF8 | **Neon and signs complete**: find and restore the ~7 % legacy draws that SHARDFILE does not (603 tris of neon, 128 of signs). | Cam 1: neon 8,938 tris, signs 1,862, as legacy. | **done** by NT1 `06d86f2c22`, measured 2026-10-30 (sp-x6): exact parent `c739e64e8c` → child, boards 5,222 → 5,640, glyphs 3,113 → 3,298, signs 1,734 → 1,862. All vertex positions equal LEGACY. The omitted resident index prefix contained 209 board quads, 92 glyph quads plus one half, and 64 sign quads; the product ring restores every triangle. Cause: `clientWorldAssembly` device ring → `tiledMesh` centroid selection / draw range, not the bake. No new source fix. | S |
| NF9 | **Declarations whole**: Nine's six place Sets as `world.sets` rows and fp-arms as a `held` row; drop the native roster hook. | `scripts/legacy-explorer-lists.ts` reads Models 1 / 1, Sets 6 / 6; Explorer unchanged. **done**: `0215806142`; normal Nine refresh 45.78 s + independent strict reader pass; unchanged collector Models 1/1 and Sets 6/6, exact IDs; 9 declaration/equivalence/retained controls pass, types/lint green. | sp-x8 | S |

## Wave 2: the permanent fix (no run-time join; graphs cost what legacy costs)

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| NF10 | **Tile slabs at bake**: each tile's fabric pre-merged per material and distance band (`kit`, `kit` 169 / 213 m, `kit-cut`, `facade`), chunked ≤ 4 MB with their own bounds; the join's invariants become a build test. | Every tile's slabs hold exactly the pieces' triangles (count + bounds per part); ≤ 5 slab draws per tile (+ chunks). | **done (2026-10-30, sp-x1; G941 B)**: `fa1c6212aa` stages exact slabs; resident-cell correction keeps 5 keys / 22 anchors but reduces 34 tile owners / 37 files / 96 chunks to one actual fabric owner (tile 3) / 8 files / 24 chunks. All 704,182 source triangles and literal native channel words remain exact; maximum upload 3,999,988 B, GPU/upload 82,099,948 B. Other ring products keep per-tile partitioning. Far-corner retention is covered. M3 native-camera P1-P5 draws 143/138/143/157/76 → 109/109/112/116/66; whole-frame A-D 171/163/140/171 → 137/126/121/137. Five A/A controls are exact; A/B 15/15/1/6/0 pixels are coplanar z-fight/order winners, accepted as B by G941 after Opus board `4152abcd85`, not a pixel-identity claim. Raster triangle trade reported to the coordinator; source triangles stay unchanged. Forty-three controls, root types and named lint pass. NF12 is released by that ruling; NT3 height/culling and NF11 route timing remain their own bars. | M |
| NF11 | **Slab library at run time**: attach adds one chunk mesh a frame inside the 4 MB budget; retire removes the mesh; no join, clone or CPU transform; the dither is a uniform. Gate: draws and triangles at the five route poses ≤ today's. | Chromium 4x **and** WebKit route: no frame > 50 ms; no frame uploads > 4 MB after the reveal; no union rebuilt after the reveal; before / after board matches. | **in flight (2026-10-31, sp-x8; original producer sp-o3)**: `552517d012` serializes every key/tile publication; `8aef7597ca` first-draws each connected hidden chunk through the native parked warmer before exposure; `be9bf77a58` counts its 64 B identity matrix and 12 B instance colour inside the unchanged 4,000,000 B cap. Immutable Chromium 4x / WebKit 1x routes complete all walked legs, retain all 704,182 triangles and emit no graphics errors: peak buffer upload 12,316,742 / 12,317,166 → **3,999,996 B on both (pass)**. Current source proof keeps every original triangle/channel word, 49 chunks / 8 files; direct focused run 130/130 passes. **50 ms gate remains open / miss**: Chromium native max 75 ms at the first between-leg relocation; WebKit 68 / 57 ms during spawn warm-up. Full raw frames and observed draw gaps retained in `tmp/sp-x8-nf11/complete-upload-{chromium,webkit}.json`; no cadence waiver. Route legs use the NF1 board's explicit start poses between walks, not a seamless route. Immutable M3 and remaining hitch attribution are pending; no run-time union returned. | M |
| NF12 | **Delete the run-time join** (`joinWholePieces`, the union path) once NF11 is green, and retire the original fine whole files from Nine's phone set (the slabs replace them; nothing reads them at run time). **Done (2026-10-30, sp-x8):** pure runtime cut `857dc8b781`; this landing publishes identity-only fine rows with verified shared-bank coverage, retires 35 original GLBs (86,682,152 B), and restores the 41,230,366 B ceiling. Phone wire 47,493,245 → 30,154,490 B. All 704,182 fine triangle/channel words remain exact; live entry passes 20 frames / zero errors. G941 accepts parent 1-LSB flicker at P1 (569,1139) and P2 (591,715); candidate equals a parent repeat at every pose. | `joinWholePieces` appears only in the bake oracle; tsc, lint and `vitest related` green; Nine's phone wire back to ≤ 41,230,366 B (raised to 47,855,381 B for NF10's staged slabs, 9c6a26f16d, G438). | Codex | S |
| NF13 | **Graph → GLSL compiler**: the SF59 graph IR compiles to classic GLSL for every op in `GRAPH_OPS` (118), with `compile.ts`'s safety rules. The shardfile format does not change (G32 / G306). | Every graph every shard ships compiles and links on Chromium and WebKit with 0 GL errors; an op-coverage test pins all 118; output byte-stable across two builds. | **done** `698fd2f439` (sp-o4): all 190 unique graphs of the six built products, one probe graph per op (118) and a toon graph compile and link as mesh, instanced, vertex-colour, batched, skinned, points, outline, post and fog-host draws: 1,162 draws and 1,103 programs, 0 shader and 0 GL errors on Chromium and on Playwright WebKit. `graph-glsl.test.ts` checks every op lowers and the output is byte-stable. Not drawn yet (NF14). | M |
| NF14 | **The classic graph material**: graphs draw as `ShaderMaterial` with fog, coarse mask (one program for all tiles), layer frame, MF13 part fade, instancing, displaced shadow depth and outline through classic chunks. Behind Debug **Graph back-end: GLSL / TSL** (Developer, default TSL) while it proves out. | Nine's unlit graphs at the golden stills ≥ 40 dB PSNR and < 1 % of pixels off by > 8 against TSL; 0 GL errors over the route; `beforeDraw` 0 calls a frame. | **done, bar restated** (sp-o4; G872 decision): the classic material ships behind Developer ▸ Debug ▸ Performance ▸ Graph back-end (default TSL; 7208bb44f8 with its [A/B board](../../../art/nine-dragon/nf14-graph-backend/graph-backend-ab-board.jpg); fixes 5e9070678b, d4bd76640e, a45877ea84; sp-o3's 742cdb7407, 030d197cd6, b34287feb5, 63bc32240d). Nine's look materials draw 0 node materials on GLSL (0 `beforeDraw` from them; its post stays TSL until NF16); 0 page errors over the 24 golden cameras. Bar restated: a free-running capture cannot reach 40 dB (TSL against itself is ~30 dB: rain, crowd), so parity is a per-graph harness (frozen clock, float target, no fog/post) at 3 m and 150 m: all 29 Nine graphs ≥ 40 dB except the canopy's two haze-loop graphs at range (23 dB). There TSL is the one off: its lowering of a branched select inside a loop drops part of the haze (the D204 class), and the tree region reads TSL 98 / 109 / 105, GLSL 101 / 113 / 110, LEGACY 108 / 119 / 116 (GLSL is closer to LEGACY). Scene captures: median 29.5 dB, min 27.6 dB against TSL. | M |
| NF15 | **Nine on GLSL**, then the row's default flips. | Chromium 4x work p50 at P1–P5 ≤ legacy + 0.5 ms (P4 ≤ ~9.8 ms against 14.1–14.7 today); programs ≤ 70; program switches ≤ 55; uniform calls ≤ 270 a frame; draws within ±3 of legacy; WebKit p50 ≤ legacy + 0.5 ms; Simulator holds 30 fps at P1–P5, max frame ≤ 50 ms. | **done (2026-10-30): frame bars met (sp-o4); programs accepted at 72 (G872, wildshard-new: NF16 closed at composite 3 → 2, engine display + SMAA stay unfolded, so its −4 is not coming)**. Programs compiled on GLSL at cam 1, 75 → 72 (sp-o5): `eaa7e67969` slab anchors keep their channel-less stand-ins, so the warm-up links no plain `nine-facade` / `nine-architecture-cut` for them (−2); `5e62a3b775` the warm-up gives a colourless instanced mesh its white colours before it copies the stand-in (one holder of the colourless `nine-architecture` variant fewer; the last is a transient mesh `firstFrame`'s render draws, `Game.ts`); `94e03bbbdf` + `ab792cd85f` + `610ec75da3` the swords' and pendant knot's rigid ink hulls draw on one identity bone, sharing the skinned hull program (−1, same lines; `ab792cd85f` fixed the joint-order check `94e03bbbdf` broke Nine's entry with). The default flipped with `180df449c9` (sp-o1). Chromium 4x LEGACY / GLSL p50 work ms, median of 3, at `cc9336974a`: P1 9.30 / 9.40, P2 8.70 / 8.65, P3 9.75 / 9.60, P4 9.30 / 9.20, P5 7.70 / 8.50; after the update-side cuts P5 8.00 / 8.30 (`c05e36d266`), then P5 10.40 / 9.00 and P1 9.80 / 9.60 (`20b5d20bf9`, a busier machine: legacy rose too). GLSL a frame: `useProgram` 50–55, uniform calls 229–258, draws 91–139 (legacy 91–153: fewer, not within ±3), 0 buffer uploads (legacy 620 KB). WebKit 1x mean work: GLSL +0.18 to +0.37 ms over legacy at every pose. Simulator frame-floor (Developer, TSL vs GLSL; no legacy mode): 30 fps at every pose on both, GLSL work p95 4–6 ms against 7–8, max render CPU per draw 26–38 µs against 49–53. Update-side cuts: `d8f8f5b907` and `a27b3ed540` (params by name, flat uniform lists), `c05e36d266` (repeat param writes skip the check), `e61c968c9e` (lent param writers cached per owner), `20b5d20bf9` (coarse mask written on change), `1de32de8d6` (scaled post feeds allocate nothing). Left on the GLSL-only update side (P5 self ms): channel programs' evaluate 0.23–0.25 plus `channels.ts` 0.06 and cull `changed` 0.14 (sp-o3), the day-sky param push 0.07 (skipping repeats there would leave a later lend on its defaults), and the lent param fan-out 0.07–0.09. | S |
| NF16 | **One post pass**: Nine's three Jiehua node passes and three effect materials become effects merged into one pass. | Post programs 6 → ≤ 2; render-target switches ≤ legacy's; post GPU ms ≤ legacy's; parity as NF14. | **done (2026-10-30, sp-o3; G872 ruling: the bar counts Nine's own composite, the engine display effect and SMAA stay)**: 85059ed4a7 folds the grade into the jiehua program, 3 → 2 programs and full-size draws (the silhouette stays alone: its silk-fog march is ~4,050 of a graph's 4,096 nodes). Nine A–D: draws −1, triangles equal; TSL 3-pass vs folded 30.1–32.0 dB, inside the run-to-run floor (29.2–31.3). **Remainder measured, not built (2026-10-30 ~20:50, pine-frame):** at `0971464` Nine's post is RenderPass → PostGraphInputs → `NdJiehuaGraph` (silhouette + jiehua, 2 draws) → `EffectPass[TextureEffect]` → `EffectPass[FXAAEffect]` to screen: 7 render-target switches, 72 programs. The phone's AA here is FXAA (one pass; SMAA's three passes are gone since G749), so the foldable piece is the display copy: `postGraphLook`'s `TextureEffect` (SRC) of the composite into the colour pass, which `protectDisplayColour` also uses to restore the scene's raw colour where it marked alpha < 0 (`markDisplayColour`: the grid far views' opaque light layers). An exact fold: the composite's last draw writes the composer buffer (a `screen`-like `buffer` output, needsSwap), the restore moves into the composite program (its `input` is the scene buffer), the chain goes empty and `Game.colourPass` makes FXAA the colour pass. Gain: −1 program (72 → 71, not ≤ 70), −1 target switch (7 → 6), one full-frame copy fewer. Not landed the night before QA: proving it pixel-identical needs a fixed-clock capture that includes post (M3 renders the world only), not built yet | M |
| NF17 | **Lit graphs on GLSL** for every other shard (Driftwood, Pine, Nalati, Far Reach, Sunscar): the lighting stage as a light-model patch in the classic families (`pbr.ts`, `toon.ts`, `painterly.ts`). Shared with [pine-fps](pine-fps-mini-plan.md). | Per shard: parity as NF14; Chromium 4x work p50 ≤ legacy + 0.5 ms where legacy exists, else ≥ 25 % under today. **Parity sweep after the default flip (2026-10-30; M3 world render, TSL on 180df449c9^ vs GLSL, symmetric clock pin, golden poses)**: Sunscar Dunes passes (sp-o2: 5 exact, rest ≥ 61 dB). **Sky Reach accepted (G872, wildshard-new; sp-o5)**: it failed at 30.3 dB / 19 % px > 8 at every pose (the only shard whose graphs carry a lighting stage). Fixes: `c9354ebb83` the painted look's painter light and far haze skip GLSL graph programs (they reached them through three's chunks; TSL graphs never took them), `df7b76d110` props surfaces bound to a GLSL graph skip family variants (the GLB's vertex colours were multiplied in twice), `4380e952b7` + `62f2e8590a` a lit graph's lent colour / bump map reads at the slot's uv and transform (the mill's bump is on uv1). At 62f2e85: spawn 47.7 dB / 0.16 %, windmill 46.5 / 0.18 %, keeper 50.4, grove 58.7, rim-south 57.1, high-step 45.8, rim-roost exact; windmill-isle 39.6 dB / 1.13 % (the mill tower's texel detail at a close-up, noted). Template and Blender Template: pixel-identical at spawn and three turns. 20-frame phone entries (Sky Reach, both templates): enter, 0 errors. | Opus | L |
| NF17b | **Driftwood creatures on GLSL**: a lit classic graph is an `AnimalMaterial`, so Driftwood loads on the GLSL back-end. | Per-graph harness exact; Driftwood TSL vs GLSL in sun within the floor. | **done (2026-10-30, sp-o3)**: bb0e95dd6b (creatures), b6c14d119b (precompile depth defaults: 2,082 warnings gone), 7b5217dc01 (the toon gloss gate follows the node path, which reads rough 0 inside the sun hook: all toon surfaces take sun specular, the shipped look; restoring the family's roughness gate is a look call for Jake). Harness: creature graphs and every Driftwood toon row ≥ 114 dB. Deterministic M3 (sp-o1's tool, clocks pinned the same on both back-ends: the stock helper pins the classic programs' clocks only, so its Driftwood 23.6 dB was the harness): Driftwood P1 45.7 dB, 0.59 % px > 8, the far horizon sea +7 red (not the fog zenith); Pine P1–P4 43.9–54.9 dB in sun. | S |
| NF17c | **Per-shard frame close-out (E518)** | **measured (2026-10-30, sp-x9)**: TSL `be099881ad` (`180df449c9^`) versus GLSL `4c7ab83f27`, golden camera 1, native 180-frame Chromium Metal 4x / iPhone 16 Pro / PWA 804×1748 / midday clear. Work p50: Driftwood 14.4 → 9.3 ms (−35.4%, pass); Nalati 12.0 → 11.7 (−2.5%); Far Reach 15.8 → 13.8 (−12.7%); Sunscar 5.8 → 5.6 (−3.4%). These four have no current advertised legacy, so the 25% bar applies. All entries/error/frame/independent attribution guards pass. Shared Mac point-time, not phone GPU or an isolated compiler gain. Earlier GPU-overlapped Driftwood/Nalati legs retained separately. Three misses remain NF17d–f; no blanket NF17 frame pass. | sp-x9 | S |
| NF17d | **Nalati frame cost**: close the measured NF17 miss | **open**: golden P1 Chromium 4x work p50 ≤ 9.0 ms (TSL 12.0; current 11.7). Profile the current native update/render split before an exact cut; retain look and gameplay. | unassigned | S–M |
| NF17e | **Far Reach frame cost**: close the measured NF17 miss | **in flight (2026-10-31, sp-x6)**: golden P1 Chromium 4x work p50 ≤ 11.85 ms (TSL 15.8; current 13.8). Current main/shadow total 154 draws; 9 remaining basic-node draws are sky dressing/sea/sun, not the compiled lit graphs. Profile before an exact cut; retain look and gameplay. The retained profile leads to the native HUD pin projection; a viewport-read cache is under paired runtime/product, DOM/pixel and frame-cost qualification. The candidate is unlanded and no gain is claimed. | sp-x6 | S–M |
| NF17f | **Sunscar frame cost**: close the measured NF17 miss | **open**: golden P1 Chromium 4x work p50 ≤ 4.35 ms (TSL 5.8; current 5.6), 61 native draws in both revisions. Profile before an exact cut; retain look and gameplay. | unassigned | S–M |
| NF18 | **Delete the TSL runtime** after Jake's fps QA (G933): `EngineNodesHandler` (1,514 lines), `render/nodes/*` (~2.2k), the TSL half of `graph/compile.ts`, the `three/webgpu` chunk, the node halves of fog / mask / precompile / shadow depth, NF2 and the Debug row. Build-time authoring may keep TSL as a DSL. | No runtime chunk imports `three/webgpu` or `three/tsl`; boot download ≥ 100 KB gzip smaller; NF15 / NF17 numbers still hold on HEAD; frame-floor and golden checks green on every shard. **Inventory (2026-10-30, sp-o5, read-only, bb68a5376f build)**: the TSL runtime is two lazy chunks, `late-engineNodesHandler-compile` 481 KB raw / 142 KB gzip / 116 KB brotli (`three.webgpu` + `three.tsl` + the 22 `render/nodes` modules) and `late-compile` 49 KB / 15 KB gzip (the TSL half of `graph/compile.ts`). Still opened by `render/dataLook.ts:532` (data looks), `game/looks/staticCapture.ts:84` and `game/shardfile/client.ts:289` (the shard post stack); the other importers are type-only or build-time shard generators. | Opus | M |
| NF19 | *(Optional)* **Half-float slab channels** (`_AMISC`, `_ASPILL`, `_AOFF`). | Nine L0 GPU ≤ 56 MB; no visible change at the five poses. | **closed, measured / not viable within scope (2026-10-30, sp-x8; G872)**: read-only immutable `a2dc011b0c` census verifies all eight slab blob hashes. Native channel/index storage is **82,099,948 B**; halving only true-float `aOff` / `aSpill` saves **10,359,220 B**, leaving **71,740,728 B**, already above 56 MB before other L0 geometry. `aFace` / `aPat` are already half. `aMisc` mixes fractional emission/line-width/wet values with packed flags, so whole-channel integer/half conversion requires a new layout; the earlier half prototype lost flags and changed 24,841 pixels. No production edit, preview or guard change. Census: `tmp/sp-x8-nf19/a2dc-storage-census.json`. | S |
| NF20 | **The loading card counts wire bytes**: "Spawn view 81.2 MB" is the decoded size; the wire is ~18 MB. | Nine's cold card reads encoded wire bytes, equal to the network log at the card's precision. **Measured 00e6dd0ea7:** cold card **15.5 MB**, matching **15,480,918 encoded body B** across all 690 spawn URLs (0 missing / duplicate / incomplete); the 18 MB was a research estimate. Build representation facts 15,473,256 B also round to 15.5; decoded admission remains **81,262,108 B**. HTTP headers add 245,332 B and are separate. Phone-tier Chromium pinned preview; no layout/read/scheduling change. | **done** 00e6dd0ea7 (sp-x9) | S |
| NF21 | **One per-draw hook, not six** (low-hanging fruit L1 from the [engine performance draft](engine-performance-mini-plan.md) §7, E515): six engine bookkeeping wrappers plus two `properties.get` hooks run around every draw, in legacy too (0.9–2.0 ms + 0.2–1.1 ms a frame at Chromium 4x). Fold them into one hook. Shared with [pine-fps](pine-fps-mini-plan.md) PF14. | Nine P4 work p50 −1.0 ms or more at Chromium 4x against the parent build, same draws, pixel-identical at P1–P5. | **in flight** (2026-10-31, sp-x2), shared EP2. `3da9099562` narrows per-texture re-enrollment; five poses in both modes have G941-qualified fresh M3 A/A and A/B, plus exact native components. Latest matched-source P4 LG work 7.3 -> 8.0 ms and SF 7.4 -> 8.7 ms, with unchanged 153/142 draws; no -1 ms gain. Child wrapper/property .309/.213 LG and .511/.249 SF ms. **Matched-draw gain and 0.3/0.1 ms bars remain open.** Raw cohorts and both ruled pixel coordinates/hashes remain in code bodies.| NF22 The next checked native-row memo is undergoing its source-controlled whole-world G958 proof; it is not yet landed and earns no native bar credit. | S |
| NF22 | **Opaque draws sorted by program** (L2, E515): opaque objects sort by material id, not by program. Measure first. Shared with pine-fps PF15. | Nine P4 program switches a frame ≤ legacy's 52, work p50 not worse; pixel-identical. | **closed: measured on GLSL (2026-10-30, sp-o5, G872)**: Nine cam 1 55 switches = opaque 19 (18 programs), transparent 31 (25), Jiehua 2, effect 2, shadow 1; a sort keyed on each draw's actual program gives 55 → 54, pixel-identical (the material's `currentProgram` was the wrong key). NF15's ≤ 55 is met without it; not built (EP3). Earlier, on TSL **measured, folds into NF13–NF15** (sp-o5, `8b5c3d946d`, golden cams 1 / 5 / 14, Chromium phone 2x): switches a frame SHARDFILE / LEGACY Nine 62 (53 distinct programs) / 52 (47); Pine 61–65 (55–58) / 53–60 (47–52); Driftwood 48–66 (38–54). A program-first `setOpaqueSort` prototype at 4x made it worse: Nine 62 → 77–79 switches and 0.3–1.3 ms slower, Pine 65 → 60 but slower, Driftwood 71 → 77, because the node handler picks a program per material × object variant, so a material's last program is the wrong key and the sort splits runs already grouped. Not built; the per-draw program key comes with the GLSL back-end. | S |
| NF23 | **Merge Nine's frame-group channel lanes**: the frame group reads 544 owner fields (138 distinct) across separate lanes every frame; evaluate its non-copied lanes as one merged program, as copied poses already do (`mergedPlan`, `channelPrograms.ts`), so the per-lane gather runs once. Refusal stays per lane: a merged frame that refuses falls back to the lanes, which refuse exactly as today. | Nine P5 phone 4x: `channelPrograms` `evaluate` self ≤ 0.1 ms/frame (0.24–0.31 today; est. saving 0.1–0.15 ms), outputs bit-exact against the lanes over a route, refusals unchanged. Not the interpreter (0.05 ms): no closure compiler (G960 ruling 2026-10-30). | **done** (2026-10-31, sp-x2), runtime `ccee2c6a79`/`9ae0b15fdd`, qualification `396e6f9294` on origin with normal gate green. Matched P5 phone Chromium 4x: 180 samples/81 draws per side, host evaluate self .321978 -> .036733 ms/frame, meeting <=.1 ms; inclusive .403500 -> .297667. An authored P1-P5 camera-observation component route uses real projection matrices and uniform defaults: 854 outputs over 1,200 frames, 1,024,800 Float64 comparisons exact with zero faults. This is presentation-component route parity, not a physics playthrough. All 18 world poses are fresh A/A and A/B G941-qualified; the sole approved Nine SF P1 pixel and hashes are in `33468b0fc4`. Seven alias/reentry/refusal/clock controls pass; original per-lane interpreters, publication, cadence and refusal guards remain. No closure compiler. | M |

Order: wave 1 in parallel now, with NF21 / NF22 (E515's low-hanging fruit, about −1.2 to −2.2 ms on Nine before the GLSL back-end). NF1 first, since it alone removes in-play retires. NF4 and NF5 next, as the biggest
visible and frame wins. Then NF10 → NF11 → NF12 and NF13 → NF14 → NF15 → NF16 in parallel, NF17 after NF15, and NF18
last, after Jake's phone QA.

Found on the way, not Nine's (needs an owner): Nalati's grass re-uploads the full `aTile` / `aHole` arrays at 82 MB/s
on camera turns (`grassPresentation.ts:305-327`).

## Done when (the whole plan)

On the Nine route (spawn → first two bridges → stairs → stair-top → arch tunnel), Chromium 4x and WebKit:
- no frame over 50 ms;
- work p50 at P1–P5 below legacy (G937);
- draws ≤ 150, programs ≤ 70.

Also:
- The dressing parity board on HEAD matches legacy at all 27 cameras (paint, far dressing, movers, neon).
- The iOS Simulator holds 30 fps with max frame ≤ 50 ms and Explorer memory ≤ 1.2 GB.
- **Jake's phone QA** of Nine passes. Then legacy Nine can go (G933).

## Questions for Jake (the grill)

1. **Hold Nine's whole city in memory (NF1)?** +82 MB GPU (~400 MB total, cap 1.2 GB), no tile ever retires in play, and the far city is full again. *Recommend yes.*
2. **Replace the node-material runtime with compiled GLSL (NF13–NF18)?** The graph format stays, every shard gets cheaper draws, and ~3.7k lines and 117 KB of download go away. It is the biggest engine change in the plan, behind a Debug row until it matches. *Recommend yes; Nine first.*
3. **Restore every missing piece to legacy parity (NF3, NF4, NF7, NF8)?** You said yes ("any dressing that's missing has to be added back"); the only cost is NF7's extra copies, held at ≤ 150 draws. *Recommend yes; confirm.*
4. **Bake tile slabs (NF10–NF12) even with NF1 holding the whole cell?** NF1 hides the hitch on Nine; slabs remove the cause for any shard that streams refine tiles later. *Recommend yes, after wave 1.*


## G1 / PF11 GPU census (2026-10-30, sp-x8; E518)

**Measured, diagnostic scope.** Maintained `scripts/pine-hollow-gpu.mjs` uses native loading cards,
Chromium ANGLE Metal, iPhone 16 Pro, CSS 402×874 / buffer 804×1748, phone tier, night/rain,
acknowledged CPU rate 1, seeded frozen native frames, five paired 16-frame batches per skip.
Tool: `da36bcdc7d`, `67c1661ef3`; coverage: `f14504f650`. All twenty rows completed on one immutable
`a2dc011b0c` build. Whole-frame throughput includes CPU submission and the fresh-write/readPixels
synchronization; it is not an independent GPU clock or official phone budget reading.

G872 restates the additive-sum bar: overlapping skips, occlusion and tile flushes prevent a sum.
Segmented EXT queries inflated 5.1 ms whole to 21.7 ms pass / 45.6 ms group sums. Raw paired
skips, no-op and drift are retained instead. Shared-host overlap and projection differences are
spelled out below; small deltas are not attributed as performance gains.

Raw: `tmp/sp-x8-g1/nine-a2dc-corrected/reading.json`,
`tmp/sp-x8-g1/pine-a2dc/reading.json`; first classified-gap run remains separate.

### nine-dragon-stack — source a2dc011-mvvu4ju0

| Pose | Mode | Whole throughput ms | CPU submit ms | Shadow skip | Depth-copy skip | Silhouette skip | Jiehua skip | Display skip | FXAA skip | No-op | End-start drift ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cam-1 | legacy | 1.488 | 0.856 | -0.044 | 0.050 | fused | fused | — | 0.006 | -0.050 | 0.187 |
| cam-5 | legacy | 1.456 | 0.788 | 0.044 | 0.025 | fused | fused | — | 0.000 | -0.012 | 0.306 |
| cam-14 | legacy | 1.525 | 0.631 | 0.019 | -0.006 | fused | fused | — | 0.025 | -0.025 | 0.188 |
| cam-27 | legacy | 1.169 | 0.756 | -0.019 | -0.019 | fused | fused | — | 0.000 | -0.031 | 0.144 |
| approx-a | legacy | 1.425 | 1.119 | 0.012 | 0.031 | fused | fused | — | -0.050 | 0.000 | 0.287 |
| approx-b | legacy | 1.525 | 0.963 | -0.006 | 0.000 | fused | fused | — | -0.000 | 0.013 | 0.544 |
| cam-1 | shardfile | 2.200 | 0.950 | -0.006 | -0.037 | 0.256 | 0.069 | -0.031 | -0.000 | 0.012 | 0.819 |
| cam-5 | shardfile | 2.212 | 1.287 | -0.031 | 0.112 | 0.469 | 0.219 | -0.063 | 0.063 | -0.088 | 0.644 |
| cam-14 | shardfile | 2.256 | 1.088 | 0.025 | 0.019 | 0.256 | 0.081 | 0.019 | 0.013 | -0.025 | 0.819 |
| cam-27 | shardfile | 1.563 | 1.113 | 0.000 | 0.012 | 0.156 | 0.113 | -0.012 | 0.031 | -0.006 | 0.537 |
| approx-a | shardfile | 2.025 | 1.175 | 0.025 | -0.050 | 0.325 | 0.112 | 0.037 | -0.031 | 0.000 | 0.431 |
| approx-b | shardfile | 2.238 | 1.081 | -0.031 | 0.031 | 0.400 | 0.131 | 0.025 | 0.006 | 0.006 | 0.356 |

| Pose | Mode | Rain | Canopy | Crowd / umbrellas | Facades / slabs | Neon / signs | Lanterns | Wet reflection | Movers | Viewmodel |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cam-1 | legacy | 0.262 | -0.025 | 0.012 | 0.625 | -0.050 | -0.038 | — | -0.037 | 0.156 |
| cam-5 | legacy | 0.144 | 0.006 | -0.031 | 0.431 | 0.000 | -0.006 | — | 0.031 | 0.069 |
| cam-14 | legacy | 0.119 | — | 0.050 | 0.600 | 0.025 | -0.025 | — | -0.006 | 0.094 |
| cam-27 | legacy | 0.006 | — | 0.031 | 0.400 | 0.038 | 0.012 | — | — | 0.137 |
| approx-a | legacy | 0.056 | -0.019 | 0.119 | 0.663 | -0.056 | -0.012 | — | -0.031 | 0.244 |
| approx-b | legacy | 0.056 | 0.025 | 0.119 | 0.544 | -0.056 | -0.006 | — | 0.019 | 0.138 |
| cam-1 | shardfile | 0.106 | 0.006 | 0.106 | 1.063 | -0.025 | -0.019 | — | — | 0.162 |
| cam-5 | shardfile | 0.269 | 0.106 | -0.012 | 1.069 | -0.069 | 0.087 | — | — | 0.269 |
| cam-14 | shardfile | 0.169 | — | 0.038 | 1.100 | -0.012 | 0.031 | — | 0.050 | 0.206 |
| cam-27 | shardfile | -0.025 | — | 0.037 | 0.694 | -0.025 | -0.006 | — | — | 0.269 |
| approx-a | shardfile | 0.019 | 0.000 | 0.175 | 1.087 | 0.006 | -0.025 | — | 0.006 | 0.244 |
| approx-b | shardfile | 0.100 | -0.019 | 0.194 | 1.281 | -0.019 | 0.031 | — | — | 0.212 |

| Pose | SHARDFILE − LEGACY whole ms | SHARDFILE − LEGACY CPU ms | Largest five SHARDFILE skip savings (overlapping) |
|---|---:|---:|---|
| cam-1 | 0.712 | 0.094 | group:facades-slabs: 1.063; pass:2: 0.531; silhouette: 0.256; group:other: 0.188; group:viewmodel: 0.162 |
| cam-5 | 0.756 | 0.500 | group:facades-slabs: 1.069; silhouette: 0.469; pass:2: 0.456; group:rain-streaks: 0.269; group:viewmodel: 0.269 |
| cam-14 | 0.731 | 0.456 | group:facades-slabs: 1.100; pass:2: 0.594; silhouette: 0.256; group:viewmodel: 0.206; group:rain-streaks: 0.169 |
| cam-27 | 0.394 | 0.356 | group:facades-slabs: 0.694; pass:2: 0.425; group:viewmodel: 0.269; group:other: 0.200; silhouette: 0.156 |
| approx-a | 0.600 | 0.056 | group:facades-slabs: 1.087; pass:2: 0.444; silhouette: 0.325; group:viewmodel: 0.244; group:crowd-umbrellas: 0.175 |
| approx-b | 0.712 | 0.119 | group:facades-slabs: 1.281; pass:2: 0.469; silhouette: 0.400; group:viewmodel: 0.212; group:crowd-umbrellas: 0.194 |

### nine-dragon-stack — after tonight's GPU cuts, HEAD b124f46e8d (sp-o1, 00:40)

Same harness and settings (`scripts/pine-hollow-gpu.mjs --chunk=nine-dragon-stack`, phone tier, 804×1748, night/rain,
whole throughput only: `--subtract=0`), two full passes on one `--head` preview; a2dc011 columns from the table above.
Between them: G2 silk fog on line pixels (4801c23feb, already in a2dc), kinds 3 + 0 on their own programs (1c3b618319,
3a1b02062a), the standalone display copy cut (8f591b94bc), Nine's buried chunk boundary hidden (12738017cf), plus every
other lane's landings since a2dc. LEGACY reads within its run-to-run spread of a2dc (host drift ±0.07).
This throughput floors at the CPU submit (~0.8–1.0 ms here), so it shows less of each GPU cut than the EXT-timer frozen-frame A/Bs in the commits (the boundary: −0.6…−0.95 ms there, −0.15…−0.34 on the whole SHARDFILE row here, with everything else).

| Pose | a2dc LEGACY | a2dc SHARDFILE | a2dc gap | HEAD LEGACY (pass 1 / 2) | HEAD SHARDFILE (pass 1 / 2) | HEAD gap | SHARDFILE change |
|---|---:|---:|---:|---:|---:|---:|---:|
| cam-1 | 1.488 | 2.200 | +0.712 | 1.500 / 1.456 | 1.919 / 1.913 | +0.438 | -0.284 |
| cam-5 | 1.456 | 2.212 | +0.756 | 1.519 / 1.456 | 2.025 / 2.038 | +0.544 | -0.181 |
| cam-14 | 1.525 | 2.256 | +0.731 | 1.631 / 1.544 | 1.981 / 1.981 | +0.394 | -0.275 |
| cam-27 | 1.169 | 1.563 | +0.394 | 1.181 / 1.156 | 1.244 / 1.200 | +0.053 | -0.341 |
| approx-a | 1.425 | 2.025 | +0.600 | 1.500 / 1.381 | 1.856 / 1.887 | +0.431 | -0.153 |
| approx-b | 1.525 | 2.238 | +0.713 | 1.438 / 1.544 | 2.012 / 2.025 | +0.528 | -0.219 |

### pine-hollow — source a2dc011-mvvu4ju0

| Pose | Mode | Whole throughput ms | CPU submit ms | Shadow skip | Depth-copy skip | Silhouette skip | Jiehua skip | Display skip | FXAA skip | No-op | End-start drift ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 | legacy | 1.450 | 1.344 | 0.044 | -0.031 | — | — | — | — | 0.000 | 0.469 |
| P2 | legacy | 1.625 | 1.506 | 0.188 | -0.050 | — | — | — | — | 0.069 | 1.100 |
| P3 | legacy | 1.956 | 1.775 | 0.262 | -0.025 | — | — | — | — | -0.025 | -0.300 |
| P4 | legacy | 2.744 | 2.025 | 0.519 | 0.263 | — | — | — | — | -0.100 | 0.706 |
| P1 | shardfile | 1.431 | 1.131 | 0.100 | 0.038 | — | — | — | — | -0.013 | -0.169 |
| P2 | shardfile | 1.700 | 1.381 | -0.044 | -0.025 | — | — | — | — | 0.012 | -0.225 |
| P3 | shardfile | 1.594 | 1.269 | -0.094 | 0.019 | — | — | — | — | -0.044 | -0.063 |
| P4 | shardfile | 2.000 | 1.644 | -0.050 | -0.012 | — | — | — | — | 0.031 | -0.375 |

| Pose | Mode | Rain | Canopy | Crowd / umbrellas | Facades / slabs | Neon / signs | Lanterns | Wet reflection | Movers | Viewmodel |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 | legacy | 0.019 | -0.075 | — | — | — | — | -0.012 | — | 0.106 |
| P2 | legacy | 0.006 | -0.094 | — | — | — | — | 0.075 | — | 0.169 |
| P3 | legacy | 0.031 | -0.063 | — | — | — | — | -0.037 | — | 0.131 |
| P4 | legacy | 0.181 | -0.256 | — | — | — | 0.094 | 0.056 | — | 0.488 |
| P1 | shardfile | 0.006 | 0.031 | — | — | — | — | 0.044 | — | 0.144 |
| P2 | shardfile | -0.038 | 0.038 | — | — | — | — | -0.019 | — | 0.200 |
| P3 | shardfile | -0.000 | -0.012 | — | — | — | — | 0.063 | — | 0.138 |
| P4 | shardfile | 0.063 | -0.006 | — | — | — | 0.081 | 0.063 | — | 0.137 |

| Pose | SHARDFILE − LEGACY whole ms | SHARDFILE − LEGACY CPU ms | Largest five SHARDFILE skip savings (overlapping) |
|---|---:|---:|---|
| P1 | -0.019 | -0.212 | group:other: 0.225; alpha-tested: 0.194; group:viewmodel: 0.144; shadow: 0.100; effect:1:7: 0.075 |
| P2 | 0.075 | -0.125 | group:other: 0.394; alpha-tested: 0.281; group:viewmodel: 0.200; group:canopy-cards: 0.038; group:sky: 0.038 |
| P3 | -0.363 | -0.506 | group:other: 0.394; alpha-tested: 0.206; group:viewmodel: 0.138; effect:1:7: 0.069; group:wet-reflection: 0.063 |
| P4 | -0.744 | -0.381 | group:other: 0.519; alpha-tested: 0.206; group:viewmodel: 0.137; group:lanterns: 0.081; group:wet-reflection: 0.063 |

### Approximate (a): five named components, matched skip deltas

| Component | LEGACY ms | SHARDFILE ms | SF − legacy ms |
|---|---:|---:|---:|
| Facades / slabs | 0.663 | 1.087 | 0.425 |
| Full Jiehua composite (fused effect / two draws) | 0.013 | 0.444 | 0.431 |
| Silhouette (legacy fused) | — | 0.325 | — |
| Viewmodel | 0.244 | 0.244 | 0.000 |
| Crowd / umbrellas | 0.119 | 0.175 | 0.056 |

Calibration model only: 79 ms / 2.225 ms = 35.506 from approximate (a), pre-G2 source 587a960-mvvsn4rn. The newer table is not renormalized to 79 ms. No physical phone GPU, fps or official timing credit.

G872: skip values are non-additive (overlap, occlusion, CPU submission floor). Per-span EXT queries changed a 5.1 ms whole into 21.7 ms pass / 45.6 ms group sums; the 10% sum bar is not measurable. Signed no-op and drift rows are retained.

Shared-machine diagnostics: o5 PF12/PF5 Chromium 4x measurements overlapped; the short root Sky entry near 03:40 UTC overlapped early corrected Nine rows. The later 7400 entry ran between Nine and Pine. Maximum absolute no-op delta was 0.100 ms, maximum whole-frame end/start drift 1.100 ms. These descriptive mode gaps are not an isolated performance acceptance reading; small differences are not attributed as gains.

Approximate (a)/(b) are by-eye phone screenshot matches, not exact phone coordinates. Golden XYZ/angles are reference poses; actual native FOV was 100.107 degrees, rather than overriding it with the historical 93.01-degree catalogue projection. Raw JSON records actual camera matrices/FOV/eye, shader identities and submitted draw counts. A dash means no observed matching submitted group/effect; raw noise is retained, not a hidden GPU cost. Unclassified submitted meshes remain in other rather than being assigned to an invented owner.

The optional `--coverage=1 --subtract=0 --rounds=1 --frames=1` colour diagnostic retains native
vertex transforms, discard and depth order, replacing final colour with additive counters.
Approximate (a): architecture **2,252,169 depth-passing samples / 1,395,036 covered pixels**,
steam 399,639, streaks 152,662, zero saturation. Full native RGBA restoration: **0 pixels**.
These are not shader-invocation counts; exact fragment hashes join the admitted G3 programs.
Raw: `tmp/sp-x8-g1/coverage-pilot/nine-dragon-stack-shardfile-approx-a.json`. Remaining five Nine
and four Pine coverage views belong to sp-x6; no global pixel-weighted ranking is claimed here.

**Held-palette follow-up done:** `587a960cb5` + `c0680975dd`, matched `a9601a481f` parent.
At each of P1–P5 over 120 frames, texture calls **1,920 → 1,200**, bytes
**1,413,120 → 1,228,800**; only six unchanged one-bone palettes stop uploading.
All ten animated palettes remain live. Held-inclusive M3: five A/A + five A/B, **0 RGBA pixels**,
24 actual viewmodel draws per pose. World-only P1/P2 differences are the accepted G941 parent-repeat
coordinates (569,1139) / (591,715); P3–P5 exact. Twenty controls include native parent-motion
vertex equivalence over 36 poses. This is upload traffic, not a measured FPS improvement.

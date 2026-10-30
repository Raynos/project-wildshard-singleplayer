# Nine Dragon, fixed properly: frame cost, hitches and every missing dressing

**State:** `draft` 2026-10-30 ~12:40 Cancun, waiting for Jake's grill. Written by wildshard-v from three research
reports by its subagents; wildshard-new hands the rows to lanes and marks them after the grill. Ask E512. Jake, 12:15:
*"can you come up with a mini plan, like a brand new mini plan, to address all the 9 dragon issues we found, like in
detail, no matter what it takes, fixing everything properly, in the engine, in the shard file, all that stuff in 9
dragon. I don't know what the fix is, but you need to think hard, research exhaustively, and come up with a permanent
fix of doing it properly. Any dressing that's missing has to be added back."* It replaces the fix half of
[qa 10-30 QC1](qa-2026-10-30-mini-plan.md); QC1 closes when this plan's done-when holds. G933 keeps legacy Nine as the
A/B baseline until Jake's phone QA of these fixes. Visual rows are Opus-only (G848). The engine-wide rows (NF13–NF18)
are shared with [pine-fps](pine-fps-mini-plan.md) and the [engine performance draft](../../ENGINE-PERFORMANCE-DRAFT.md)
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
| NF1 | **Nine holds its whole cell** (`ring: 'cell'` in Nine's product, as Far Reach does). In play no tile retires, and the city past the ring is resident (+82 MB GPU on ~400 MB, under the 1.2 GB cap). | Chromium 4x route: no `bufferData` ≥ 256 KB after the reveal; no frame > 100 ms; Simulator Explorer memory ≤ 1.2 GB (one reading). | landed 87f7d2c37a (sp-o5); **open, measured 2026-10-30 (sp-x6)**: HEAD `b8aa02d4b1` vs NF1 parent `170c542e0b`: `bufferData` ≥ 256 KiB after reveal **124 vs 198**, walking-only **17 vs 83**; max observed rendered-frame gap 83.3 ms both. Simulator Explorer: native WebContent peak **0.837 GB**, Inspector categories **1.863 GB** (requested cap 1.2 GB; distinct meters). Zero-upload bar fails; no done claim. | S |
| NF2 | **One program per coarse graph**: the coarse mask shares one uniform pair per graph, with per-tile values in the tile's `onBeforeRender`. A stopgap; NF18 deletes it. | P4: programs 95 → ≤ 75, program switches ≤ 55 a frame; pixel-identical at P1–P5. | Opus | S |
| NF3 | **Movers at their height**: mover copies at identity under the posed `nds-*` object; a test pins each rest position. | Train y 150.5, gondola ~109.7, drones ~181.6 / 200.4; cams 1 / 2 / 8 / 9 show movers as legacy. | Opus | S |
| NF4 | **The painted facades back**: port legacy `facadeMaterial.ts:260-304` kind 11 term for term into `architectureGraphs.ts` (openings, paired windows, balcony lip and rail, glazed eave bands, painted neon with emission), then audit kinds 1–12 the same way. 0 draws, 0 tris, 0 MB. | Cam-27 wall shows the bands; the wall rect within 10 / channel of legacy's `[108,124,146]` / `[101,143,129]`; Chromium and WebKit; G844 before / after board. | **kind 11 done** `d6f1822f09` (sp-o5): cam 27 blue / green / wall rects within 2 / channel of LEGACY on the same build, Chromium and WebKit ([board](../../../art/nine-dragon/e512-nf4-facade/cam27-board.jpg)). Kinds 1–12 audit **done** `e802c073cf`: 2, 5, 7–10, 12 matched; 1, 3, 4, 6 took LEGACY's missing terms; mean pixel diff to LEGACY drops at all 7 checked cams ([board](../../../art/nine-dragon/e512-nf4-facade/kinds-audit-board.jpg)). | S–M |
| NF5 | **Re-cull like legacy**: per-copy culling uses legacy's thresholds (7° / 3.5° / 1 m) and uploads only the changed tail (`cull.ts:123-152`, `:340-352`). | Nine 360° pan at 4x: work p50 within 0.5 ms of the still hold (today +2.7 ms); buffer calls per moving frame ≤ legacy's ~41; no instance missing at the frame edge in a 4-shot pan. | Opus | S |
| NF6 | **Retire slack**: attach at radius r, retire at r + 1, so walking along a ring edge never thrashes (matters for every ring shard once NF1 makes Nine's whole cell resident). | A focused test on `TileDriver`; Pine / Driftwood probe: no retire-attach pair within 5 s. **done** `c3356249ed`: 18 focused cases, root types, named lint and 7,696-file ratchet pass. Pinned `c335624-mvv96v5q`, phone-tier Chromium 4x / 2x scale: eight actual walking crossings each; Pine 13 attaches / 0 retires, Driftwood 20 / 8, both **0 pairs within 5 s**, 0 page errors. | **done** sp-x1 | S |
| NF7 | **Far dressing whole**: facade placements, lanterns and portal rings draw every copy within legacy's LOD distances (small pieces `far: 85`), not just resident tiles; colliders stay on the collider ring. With NF1 this is NF1's proof. | At cams 1 / 5 / 14 / 27, copies in view within 5 % of legacy (eave, box, windows, rail, lantern / cage LODs, lantern dots, 5 portal rings); draws ≤ 150 (G913). | Opus | S |
| NF8 | **Neon and signs complete**: find and restore the ~7 % legacy draws that SHARDFILE does not (603 tris of neon, 128 of signs) in the sign bake. | Cam 1: neon 8,938 tris, signs 1,862, as legacy. | Opus | S |
| NF9 | **Declarations whole**: Nine's six place Sets as `world.sets` rows and fp-arms as a `held` row; drop the native roster hook. | `scripts/legacy-explorer-lists.ts` reads Models 1 / 1, Sets 6 / 6; Explorer unchanged. **done**: `0215806142`; normal Nine refresh 45.78 s + independent strict reader pass; unchanged collector Models 1/1 and Sets 6/6, exact IDs; 9 declaration/equivalence/retained controls pass, types/lint green. | sp-x8 | S |

## Wave 2: the permanent fix (no run-time join; graphs cost what legacy costs)

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| NF10 | **Tile slabs at bake**: each tile's fabric pre-merged per material and distance band (`kit`, `kit` 169 / 213 m, `kit-cut`, `facade`), chunked ≤ 4 MB with their own bounds; the join's invariants become a build test. | Every tile's slabs hold exactly the pieces' triangles (count + bounds per part); ≤ 5 slab draws per tile (+ chunks). | Codex (bake) | M |
| NF11 | **Slab library at run time**: attach adds one chunk mesh a frame inside the 4 MB budget; retire removes the mesh; no join, clone or CPU transform; the dither is a uniform. Gate: draws and triangles at the five route poses ≤ today's. | Chromium 4x **and** WebKit route: no frame > 50 ms; no frame uploads > 4 MB after the reveal; no union rebuilt after the reveal; before / after board matches. | Opus | M |
| NF12 | **Delete the run-time join** (`joinWholePieces`, the union path) once NF11 is green. | `joinWholePieces` appears only in the bake oracle; tsc, lint and `vitest related` green. | Codex | S |
| NF13 | **Graph → GLSL compiler**: the SF59 graph IR compiles to classic GLSL for every op in `GRAPH_OPS` (118), with `compile.ts`'s safety rules. The shardfile format does not change (G32 / G306). | Every graph every shard ships compiles and links on Chromium and WebKit with 0 GL errors; an op-coverage test pins all 118; output byte-stable across two builds. | Opus | M |
| NF14 | **The classic graph material**: graphs draw as `ShaderMaterial` with fog, coarse mask (one program for all tiles), layer frame, MF13 part fade, instancing, displaced shadow depth and outline through classic chunks. Behind Debug **Graph back-end: GLSL / TSL** (Developer, default TSL) while it proves out. | Nine's unlit graphs at the golden stills ≥ 40 dB PSNR and < 1 % of pixels off by > 8 against TSL; 0 GL errors over the route; `beforeDraw` 0 calls a frame. | Opus | M |
| NF15 | **Nine on GLSL**, then the row's default flips. | Chromium 4x work p50 at P1–P5 ≤ legacy + 0.5 ms (P4 ≤ ~9.8 ms against 14.1–14.7 today); programs ≤ 70; program switches ≤ 55; uniform calls ≤ 270 a frame; draws within ±3 of legacy; WebKit p50 ≤ legacy + 0.5 ms; Simulator holds 30 fps at P1–P5, max frame ≤ 50 ms. | Opus | S |
| NF16 | **One post pass**: Nine's three Jiehua node passes and three effect materials become effects merged into one pass. | Post programs 6 → ≤ 2; render-target switches ≤ legacy's; post GPU ms ≤ legacy's; parity as NF14. | Opus | M |
| NF17 | **Lit graphs on GLSL** for every other shard (Driftwood, Pine, Nalati, Far Reach, Sunscar): the lighting stage as a light-model patch in the classic families (`pbr.ts`, `toon.ts`, `painterly.ts`). Shared with [pine-fps](pine-fps-mini-plan.md). | Per shard: parity as NF14; Chromium 4x work p50 ≤ legacy + 0.5 ms where legacy exists, else ≥ 25 % under today. | Opus | L |
| NF18 | **Delete the TSL runtime** after Jake's fps QA (G933): `EngineNodesHandler` (1,514 lines), `render/nodes/*` (~2.2k), the TSL half of `graph/compile.ts`, the `three/webgpu` chunk, the node halves of fog / mask / precompile / shadow depth, NF2 and the Debug row. Build-time authoring may keep TSL as a DSL. | No runtime chunk imports `three/webgpu` or `three/tsl`; boot download ≥ 100 KB gzip smaller; NF15 / NF17 numbers still hold on HEAD; frame-floor and golden checks green on every shard. | Opus | M |
| NF19 | *(Optional)* **Half-float slab channels** (`_AMISC`, `_ASPILL`, `_AOFF`). | Nine L0 GPU ≤ 56 MB (today 81.6); no visible change at the five poses. | Codex (bake) | S |
| NF20 | **The loading card counts wire bytes**: "Spawn view 81.2 MB" is the decoded size; the wire is ~18 MB. | Nine's cold card reads encoded wire bytes, equal to the network log at the card's precision. **Measured 00e6dd0ea7:** cold card **15.5 MB**, matching **15,480,918 encoded body B** across all 690 spawn URLs (0 missing / duplicate / incomplete); the 18 MB was a research estimate. Build representation facts 15,473,256 B also round to 15.5; decoded admission remains **81,262,108 B**. HTTP headers add 245,332 B and are separate. Phone-tier Chromium pinned preview; no layout/read/scheduling change. | **done** 00e6dd0ea7 (sp-x9) | S |
| NF21 | **One per-draw hook, not six** (low-hanging fruit L1 from the [engine performance draft](../../ENGINE-PERFORMANCE-DRAFT.md) §7, E515): six engine bookkeeping wrappers plus two `properties.get` hooks run around every draw, in legacy too (0.9–2.0 ms + 0.2–1.1 ms a frame at Chromium 4x). Fold them into one hook. Shared with [pine-fps](pine-fps-mini-plan.md) PF14. | Nine P4 work p50 −1.0 ms or more at Chromium 4x against the parent build, same draws, pixel-identical at P1–P5. | Opus | S |
| NF22 | **Opaque draws sorted by program** (L2, E515): opaque objects sort by material id, not by program. Measure first. Shared with pine-fps PF15. | Nine P4 program switches a frame ≤ legacy's 52, work p50 not worse; pixel-identical. | Opus | S |

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

# Night Market remaster: the dome method (E503)

**State:** `active` 2026-10-24 — Jake ruled D1–D4 (G726): the **4 hero cameras** only (8 domes; the inside corner stays consistent), Blender + TRELLIS.2/Hunyuan3D-2, budget **+300 MB**, Codex RM1–RM3 now, Opus from Tue 13:00. Read at HEAD a8a15bb462.
Graphical work is Opus, and Opus lanes are 0 until **Tue 10-27 13:00** (G605); Codex can prepare data and tooling before
then (D4). Builds on the [Night Market pilot](night-market-pilot-mini-plan.md) (NM0–NM14, G632/G633/G641/G681/G684/G700)
and feeds the [remaster of the 18 other plots](remaster-open-plots-mini-plan.md) (RP2, G712/G714).

Jake, 2026-10-24 ~22:20 Cancun, after three phone screenshots of the Night Market plot on build 0b1ca136e (iPhone
portrait, 29–30 fps, MEM 0.92 GB, 2 worlds): *"lol fucking night market looks like trash fire. Have a dedicated agent come
up with a mini plan to remaster it using the Nine look dome technique."* At 22:21 he added that the screenshots were partly
a streaming problem: two minutes later, in the same spot, the real tiles loaded (red-roof stalls with lanterns, pennant
string lights, trees, lamp posts with light pools, darker paving; MEM 1.06 GB, 30 fps).

The two problems need separate fixes: **(a)** the near tiles stream in late, so the far proxy shows at eye height. That is a
tile-streaming fix, not art. **(b)** Even fully loaded, the plot is far below the mockups. That is this remaster.

## 1. Diagnosis

### 1a. Streaming: the far proxy drew at eye height (a tile-streaming fix, not this plan's art)

- **What the 22:19 screenshots show is the far proxy.** Each tile has a far stand-in (`generators/kit.mjs:378-385`
  `farTile`). For an S tile it is two red boxes 12 m wide, 5.6 m high and 54 m long. From a distance these were the "line of
  red boxes on the horizon"; from 3 m away, one was the "giant dark-red wall". The flat grey-blue ground is the stand-in's
  single-colour floor quad. The faceted red gate is `far_landmark` (`landmark-far.glb`, 2.5k triangles, the texture's colours
  baked into vertex colours, no normals). Neither the L0 tiles nor the near view (`near: 'coarse'`,
  `generators/product.ts:30`, which keeps the L1 shapes and a light layer) had arrived.
- **Cause:** the entered cell's tiles became resident late. `436b14b3ed` (22:01, T4.1: missing required tiles now refuse
  entry instead of handing over controls) and `acf56cf5c4` (22:16, T4.2: re-entry restores the rank-0 tiles evicted on the
  previous entry) both landed **after** build 0b1ca136e (19:34). T4.3, the entered-stream milestone, is in flight (sp-x2).
  The Bag world map filling in "based on exploring" (G719) is the same symptom.
- **Owner:** [tile-streaming](tile-streaming-mini-plan.md) T4.3, plus G719's up-front map atlas. Row RM0 below is only the
  acceptance check on the Night Market walk; this plan builds nothing for it.

### 1b. The art gap once loaded (22:21 screenshots; NM11 board `art/grid/round-56-night-market-nm11/board.jpg`; round 58/59)

| # | What Jake sees | Why (file:line) | What the mockup / Nine does instead |
|---|---|---|---|
| 1 | **Flat, untextured ground** | `generators/tiledPlot.mjs:112-118`: the paving is a 10 m vertex-colour checker in two shades about 3 % apart (`#8b91a2` / `#838a9b`, `data/layouts/night-market.json`). The `kit` material is plain PBR, roughness 0.9, with no maps (`data/source.json:256`). There are no joints, kerbs or block edges. | The mockup's plaza (`round-46…/r7-plaza.jpg`) has ~3 m flagstones with dark joints, warm where the lanterns light them. Nine's ruled kit (`nine-dragon-stack/generators/kit/ruledKit.ts`) draws flagstone rows and edges analytically in the material, with no texture. |
| 2 | **Black, untextured poles; black stall undersides** | Lantern posts are 0.18 m bars (`kit.mjs:181`), stall and banner posts are 0.36 m and 0.24 m boxes (`kit.mjs:262`, `:422`), all in dark wood `#5b3a24`. The only light is a low dusk sun (`source.json:197` `dayOverride 0.72`) plus a flat 0.8 ambient. There is no AO and no light from the lanterns on geometry, so every face turned away from the sun goes near black. | Nine bakes light volumes from ~9 500 emitters (`generators/lightVolumes.ts`, falloff law in `data/lightPools.json`), so lanterns light the posts, eaves and walls round them. |
| 3 | **Plain stall boxes** | `kit.mjs:256-286` `stalls()`: a counter box, four square posts, a 4-face gable and one lit quad, 10 per S tile. No awning cloth, stripes, valance, goods, signs or people. | Nine's hero stall (`nine-dragon-stack/generators/stalls.ts`, 620 lines): striped awning with a scalloped valance, banner, lit name board, a counter crowded with goods, bulbs, cooks. |
| 4 | **Hard-edged light pools** | `kit.mjs:154-160` `pool()`: an 8-triangle octagon whose colour fades linearly to black at the rim, additive, 4–6 m radius, orange `#9a4a14`. The octagon edges show, and the overlapping smudges are bigger than the lights that cast them (5.5k triangles). | Nine uses a smooth per-pixel falloff (`k`, `r`, `cut` per emitter kind, `data/lightPools.json`) and a glossy lobe. |
| 5 | **Lights read as cubes and floating triangles, with no glow** | Lanterns are 0.6 m cubes (`kit.mjs:182`); bulbs and sky lanterns are tetrahedra (`kit.mjs:171-178`, `:436-437`). **Bloom is off for every open plot** (`open-plots/manifest.json:47` `bloomIntensity 0`, threshold 1; Nine has 0.6 / 0.9, Pine 0.55, Driftwood 0.4). The look is `style: greybox` with AO off (`manifest.json:152-159`). | Nine's lanterns are lathed with sagging cords (`generators/lanternGeometry.ts`) and drawn by the `nine-lantern` graph material, with bloom on. |
| 6 | **Trees like gems** | `kit.mjs:186-192`: two hexagonal cones back to back, i.e. an octahedron. | Round, lumpy crowns in clusters. |
| 7 | **Empty at eye height** | The plot is 500 m across. The whole world is ~94k triangles (kit 44k, glow 29k, pool 5.5k, landmark 15k), about **1.5k per 62.5 m tile** against an L0 cap of 40k (`src/format/contentBounds.ts:38`). That is 4 % of the budget. Each plaza quarter (`kit.mjs:364-375`) is 62.5 m of bare paving with 10 lanterns and one planter; the four make a 125 m square. | The mockup reads as a dense town: stall rows, house courts and gardens touch, and the plaza has gardens, canal stubs and bridges right by the gate. |
| 8 | **The gate is a dark silhouette** | The Hunyuan 2.1 textured gate (`landmark.glb`, 15k triangles) carries no lanterns, no lit gold trim and no uplight beyond two pools, so it is backlit against the dusk (NM11 plaza shot). | Bright red pillars, gold brackets, ~10 hanging lanterns. |
| 9 | **Coarse from the road and from 100 m** | The near view is vertex colours only (`src/sdk/bake/placeholders.ts:394-400`), so the posters show as flat mean colours (round 61 README). The far proxy is ≤ 40 triangles per tile. | The road-entry and 100 m mockups are the same rich scene seen from further away. |
| 10 | Neighbour noise (not this plan) | Thin Ice's cyan far hologram shows through the arch and over the skyline (round 61 README). | It goes when RP2 remasters the other plots. |

## 2. The dome method applied to Night Market

The method is NINE-DRAGON-STACK §7 and LOOK-LOOP "Two domes". Round 15's eight domes
(`art/nine-dragon-stack/round-15-eight-domes/`) are the template. Each mockup camera gets two domes:

- a **stand dome** at the mockup's camera, whose view 5 is the mockup itself;
- a **look dome** at what that camera looks at, whose 9 views include one looking back at the stand dome.

The cameras are round 46's (`art/grid/round-46-night-market-nine-angles/`). Jake G726 selected r1, r3, r4 and r7: **4 mockups and 8 domes**. E1/E2 below are historical consistency references only, not additional target/capture scope. Anchors
are in plot-local metres: south entry at z = −250, gate at (0, 0), y = height above the paving.

| Dome | Mockup | Anchor | Must hold (assets · density · light) |
|---|---|---|---|
| **A1 road stand** | r1 road entry | (0, −262, eye 1.7; round 60's 8 m camera as view 5) | Road, kerb and the 1.2 m curtain (G700), entry posters, both N forecourts, the lantern avenue running to the gate. The lit gate must read at 260 m. |
| **A2 road look** | r1 | (0, −205, eye), facing the gate | Forecourt planters, ornate lantern posts every 8 m, string lights over the lane, the first canal bridge, H house fronts with lit windows, stall rows starting. View 7 looks back to the road and its posters. |
| **B1 40 m stand** | r3 40 m over the road | (0, −300, 40 up) | The south half from above: tiled roofs (ridge, eaves, texture), turquoise canals, lawns, the lantern grid reading as a pattern, soft pools. Tests L0 and L1. |
| **B2 40 m look** | r3 | (0, −120, 40 up), orbit | Every south tile type from 9 sides at mid height; no bare paving > 15 m between pieces. |
| **C1 100 m stand** | r4 100 m over the neighbour | (0, −400, 100 up) over the road cell | The whole plot as the near view and L1 draw it: roofs, canals, gardens, gate and lights all read. Tests the near view and far proxy. |
| **C2 100 m look** | r4 | (0, 0, 100 up), orbit and top-down | The north half and the plot's silhouette from every side, including the far proxy at 600 m (view 9). |
| **D1 plaza stand** | r7 plaza | (0, −45, eye) = spawn, facing the gate | Flagstones with joints, planters with round trees, the canal stubs and bridges either side, the lit gate with hanging lanterns, the plaza poster, bloom halos. |
| **D2 gate look** | r7 | (0, −18, eye) in front of the gate | The gate close up (pillars, brackets, gold trim, lanterns, uplight), looking up, and back toward D1 across the plaza; crowd at the stalls nearby. |
| **E1 corner stand** | r8 inside corner, 25 m up | (−215, 215, 25 up) over the NW H tile | House courts and gardens from roof height: tiled roofs, court lawns, a lantern in every court, the market beyond. |
| **E2 corner look** | r8 | (−180, 180, eye) in a garden / court | Eye height inside an H/G pair: walls with timber frames and lit windows, round trees with lanterns, a pond, hedges. No black faces, no gems. |

**Eye-height detail bar** (A1, A2, D1, D2, E2; in every view under the horizon):

1. No plain-colour floor: every ground surface shows joints or a pattern within 30 m.
2. Nothing under 8 % luminance bigger than a door, except a deliberate silhouette against the sky.
3. At least 12 distinct lit things within 30 m, each with a soft round pool and a bloom halo.
4. No bare stretch longer than 15 m along a lane.
5. Every repeated piece (stall, lantern, tree, house) is a real model with at least 3 variants, so no two neighbours are
   identical.
6. Each palette region within ΔE00 ≤ 8 of the target (LOOK-LOOP step 5).

The aerial domes (B, C) carry the pattern, light and LOD read: the tile layout, canal colour and lantern grid must match
the mockup at 40 m and 100 m.

**Targets.** The plot isn't built yet, so the targets are imagined from the mockup (LOOK-LOOP):

1. Write `cameras.json` per dome.
2. Draw a floor plan from `data/layouts/night-market.json`, with the cameras as numbered dots and view wedges.
3. Make one codex `image_gen` 3×3 grid per dome from [mockup, floor plan], two candidates, and keep the one whose tiles face
   the way the cameras say.
4. Upscale each tile with the mockup as the detail reference.

The output is 72 targets in `art/grid/round-63-night-market-domes/<dome>/`, every sheet labelled
"<dome> · n · view · TARGET".

**The loop, per dome and round:**

1. Capture the 9 views on a served build of HEAD through `scripts/browser-lane.sh` (iPhone 16 Pro portrait, phone tier, 2×
   render scale, muted).
2. Put the capture 3×3 beside the target 3×3.
3. Write a gap list and merge it into a TOP-10.
4. Fix.
5. Eye-check: previous | this | target. Revert anything that looks worse.
6. Report triangles, draws and MB per dome in the commit.

Two Opus lanes own disjoint files, as Nine did:

- the **look-dome lane** owns the kit models and hero pieces (`public/assets/open-plots/kit/`, the gate dressing);
- the **stand-dome lane** owns the systems (materials, paving, light bake, bloom and grade, near view, density placement in
  `kit.mjs` / `tiledPlot.mjs`).

The look-dome lane re-captures the stand dome each round to prove its work shows there.

## 3. Rows (build order)

| Row | What | Owner | Effort | Done when |
|---|---|---|---|---|
| RM0 | **Streaming acceptance** (built by tile-streaming T4.3 and G719, not here): walking in from the south road, the L0 tiles draw before the kerb; the far proxy never draws inside the entered cell | sp-x2 (tile-streaming) | — | A phone-tier walk road → plaza shows L0 within 3 s of entering, with no far stand-in at eye height; the Bag map shows every cell on first open |
| RM1 | **Dome targets (G726):** 8 `cameras.json` and floor plans, 8 codex 3×3 grids (2 candidates each), 72 upscales, labelled sheets | Codex (`image_gen`, not a lane) or plan agent | 4 h | `round-63-night-market-domes/` holds 8 labelled target sheets plus an overview |
| RM2 | **done — Baseline captures** of the 8 domes on HEAD after RM0, with triangles, draws and memory per dome | Codex | 2 h | All 72 views / eight inspected, labelled 3×3 sheets on `903baf53bc`, including the landed streaming fixes; per-dome numbers beside targets and in the commits. Whole-scene counts 122–193 draws / 287,121–361,596 tris; effective Night Market claims 36.9–117.1 MiB plus separate page CDP samples. No FPS/native-memory acceptance or new RM0/RM11 proof |
| RM3 | **done — Kit plumbing** (no look change): owned GLB placement, palette slots, explicit three-variant/LOD intake and ≤40-triangle far stand-ins. Production keeps today's one/two variants and low-poly levels; RM4 supplies new art. All 5,499 static lanterns feed the vertex bake, neutral until RM6 tunes light. Final tile report printed; eight inspected kit sheets on `a4b6d8b47f` preserve RM2's static look and all 72 per-view draw/triangle maxima. | Codex | 1 d | Selected product exits 0; original 72 camera poses / 8,640 drawn frames complete without errors; tile costs and outstanding RM8 debt recorded below |
| RM4 | **Kit remaster (models).** Real models, 3 variants each: stall (hero plus a striped-awning row stall), round paper lantern and ornate post, string-light cord with round bulbs, arched stone bridge with balustrade, house court (tiled hip roofs with upturned eaves, timber frame, lit windows), canal coping, planter, bench, goods and crates, banners, round-crown trees, static posed figures. Architecture is Blender scripts (`scripts/blender/build.sh`, GLB committed); organic pieces are TRELLIS.2 vs Hunyuan3D-2, better wins, through `mockup-to-model`. | Opus (look-dome lane) | 3 d | Each piece has a labelled 4-angle board beside its mockup crop; A2, D2 and E2 meet bars 5 and 2 |
| RM5 | **Materials and palette:** one trim-sheet texture per style (roof tile, timber, plaster, awning stripe, stone) in KTX2 with phone mips, shared by the kit. Paving as a ruled graph material (flagstone joints, kerb edges, wear; data, no texture). The palette locked to round 46 (G714: red-and-gold lantern dusk). | Opus (stand-dome lane) | 1 d | Bars 1 and 6 in A1, A2, D1, D2 and E2 |
| RM6 | **Light:** bloom on for open plots (grade data, ~0.5 / 0.9 like Nine and Pine); smooth round pools sized to their light (16-segment fan with a smoothstep profile, or a pool graph); RM3's vertex light bake tuned; the gate given lanterns, emissive gold trim and uplight; a warmer dusk fill (hemisphere ground colour). No new real lights, instancing only (E271). No Debug row (G669); the old look comes back only on Jake's word. | Opus (stand-dome lane) | 1.5 d | Bars 2 and 3 in every eye-height dome; the phone-tier frame floor holds (RM10) |
| RM7 | **Ground and canals:** kerbs and raised block edges, canal walls with stone coping, bridges with balustrades, water that doubles the lights (emissive streak cards like Nine's wet-stone streaks) | Opus (stand-dome lane) | 1 d | B1, B2, D1 and E1 canals read as the mockup's turquoise canals with lit reflections |
| RM8 | **Density and scale:** every tile re-packed to the mockup. Stalls on both sides of every lane at ~6 m pitch; the plaza quarters get lawns, canal stubs, bridges, planters and a lantern avenue (r7); taller house courts with court walls; budget ≤ 15k triangles and ≤ 0.3 MB compressed per L0 tile. If a tile goes over 0.3 MB, the plot moves from the merged `world` GLB to the props bake's instanced scatter (`src/sdk/bake/props.ts`, as pastel-plain and ink-cel-valley do), because `authoredWorld.ts:63` refuses `props`. | Opus (stand-dome lane), Codex for the layout data | 1.5 d | Bar 4 in every eye-height dome; ≥ 70 % of each tile covered in the C2 top-down; per-tile numbers in the commit |
| RM9 | **Gate landmark:** a new single-object reference from r7; Hunyuan3D 2.1 vs TRELLIS.2, better wins (G632); hanging kit lanterns, emissive gold trim, uplight; ≤ 30k triangles near across the 4 plaza tiles, ≤ 2.5k far | Opus (look-dome lane) | 1 d | D2's 9 views match their targets; a labelled 4-angle board |
| RM10 | **Life:** round paper sky lanterns (replacing the tetrahedra), food-stall steam, fireflies, banner sway (the existing glow graph), static posed figures at stalls and on bridges. An animated crowd only if an existing SDK crowd host takes it as data (HOST-BAR). | Opus | 0.5 d | Visible in a 5 s road-entry clip; frame floor unchanged |
| RM11 | **Near view and far proxy:** the near view's vertex colours take the trim-sheet colours; the light layer keeps lanterns and pools; far stand-ins re-authored from the new kit (roof silhouettes, canal quads, the lit gate) within the 8k far cap | Opus (stand-dome lane) | 0.5 d | A1, C1 and C2 read as the mockup at 260 m and 100 m up |
| RM12 | **Perf and memory per dome**, phone tier: Chromium 2× captures report triangles and draws per dome, then one Simulator reading at the milestone | Codex (captures) + Opus (fixes) | 0.5 d | Inside the plot ≤ 600k triangles and ≤ 120 draws per frame; ≥ 30 fps floor (Low Power Mode cap); memory ≤ +300 MB over today's 1.06 GB two-world reading and ≤ 1.2 GB per shard (G556); loading ≤ 1.8 GB |
| RM13 | **Board and play:** 5 cameras × MOCKUP · BEFORE (the 22:21 build) · NOW, labelled, iPhone portrait, plus a 30 s walk video from road to plaza; then Jake plays it (G684) | Opus | 0.5 h | Board and clip sent; Jake's word |
| RM14 | **Make it general for RP2:** the kit library is shared (`public/assets/open-plots/kit/`, retinted by palette slots); each idea is a style row, round 62's palette and grade, its own hero pieces and landmark, and the same 5-camera / 10-dome template | Opus + Codex | 0.5 d | A second idea's style row builds with no generator code change (one test); `remaster-open-plots-mini-plan.md` gets the how-to |

Order: RM0 (other plan) ∥ RM1 → RM2 → RM3, all Codex before Tue. Then RM4 ∥ RM5 ∥ RM6 (two Opus lanes from Tue 13:00) →
RM7 → RM8 → RM9 → RM10 → RM11, with look-loop rounds per dome throughout. Then RM12 → RM13 → Jake plays → RM14 → RP2.
About 10 Opus lane-days, roughly 5 calendar days on two lanes.

### RM1–RM3 slices (G711, ≤ 1 h each; sp-x6)

| Slice | Status | Deliverable |
|---|---|---|
| RM1.1 camera grounding | done | Eight exact plot-local camera manifests / 72 views and labelled floor plans in `art/grid/round-63-night-market-domes/`; actual 64-tile layout, z north, four G726 pairs only |
| RM1.2 road stand targets | done | A1: two imagegen candidates, chosen B, nine individually detailed targets and labelled sheet; rejected rear-gate and photographic-ground variants documented |
| RM1.3 road look targets | done | A2: two saved candidates, nine individual targets and labelled sheet; paired gate identity/scale corrected |
| RM1.4 40 m pair targets | in flight (2026-10-25, sp-x6) | B1 two candidates + 8/9 detailed targets; SW target 2 image-tool refusals twice, explicit sheet gap. B2 two candidates + 9/9 targets and labelled sheet; invented rear buildings removed |
| RM1.5 100 m pair targets | done | C1/C2 each have two imagegen candidates, nine detailed targets and a labelled sheet; outer empty directions, bounded market edge and distinct forward/down views retained |
| RM1.6 plaza pair targets | done | D1/D2 each have two candidates, nine detailed targets and a labelled sheet; eight-dome overview explicitly records 71/72 overall targets because B1.2 remains missing |
| RM2.1 road / plaza baseline | done | 36 exact views / four labelled sheets on `903baf53bc`; whole-scene maxima A1 139 draws / 307,798 tris, A2 148 / 339,674, D1 150 / 348,643, D2 156 / 361,596. Effective Night Market claims 65.1–114.8 MiB, separate page-wide CDP samples. Draw target still missed; no FPS/native-memory acceptance |
| RM2.2 aerial baseline | done | 36 exact views / four sheets, same `903baf53bc`: B1 127 draws / 296,187 tris, B2 170 / 331,062, C1 122 / 287,121, C2 193 / 330,691; claims 36.9–117.1 MiB. Actual outside/entered tiers retained; C2 detached far eye does not certify the far proxy. All owned browsers/preview closed |
| RM3.1 lantern extraction / placement | done | Four existing heights exported as owned GLBs and consumed by the plot generator. Full-layout colours, normals, UVs, moving-light order and raw collision exact; visual positions within two micrometres. Cold sealed producer: 42 outputs / 21.1 s. Whole RM3 capture milestone remains open |
| RM3.1b stall / house extraction | done | Both existing house variants and the stall row placed from owned GLBs (47,608 / 50,208 / 167,640 B). Original per-role triangle order, colours, UVs, moving-light phases, far and raw collision exact; visual position rounding <8 micrometres / normal components <0.0000002. Five related cases and cold sealed 42-output producer pass; camera milestone stays open |
| RM3.1c1 canal / forecourt extraction | done | Straight/bent canals and entry forecourts placed from 95,244 / 84,600 / 107,844 B GLBs; far proxies 4 / 6 / 22 triangles. Carry authored normal/UV channels through placement. Full layout colours, phase order, water/far positions and raw collision exact; visual Float32 position error ≤15.26 micrometres / normal error ≤0.00000006. Five cases / three related suites, shard/fixture types and typed lint pass |
| RM3.1c2 garden / plaza extraction | done | Both gardens and plaza placed from 75,376 / 75,384 / 42,032 B static GLBs; far proxies 22 / 22 / 2 triangles. Moving-light vertices, seed stream, Glow order and raw collision exact across consecutive builds and re-preparation; other visual rounding ≤15.26 micrometres. Five cases / three related suites, shard/fixture types and typed lint pass. Cold sealed producer: 42 outputs / 21.0 s; camera milestone remains open |
| RM3.2 variants / LOD intake | done | Explicit one-to-three variants per family, LOD0/LOD1 selection, ≤40-triangle far refusal and non-growing LOD1; levels preserve collision and moving-light sequence. Three distinct supplied fixture variants and smaller LODs exercised; admitted bytes/metadata cannot be mutated by callers. Six related cases / four suites, shard/fixture types and typed lint pass. Production retains today’s one/two variants and identical low-poly levels until RM4 supplies new art; no geometry reduction claimed |
| RM3.3a vertex-light plumbing | done | 5,484 static tile/string emitters plus 15 poster lamps collected from their defining recipes; owned GLB/LOD records preserve positions/colours. Vertex bake uses Nine’s compact falloff, clamped linear RGB and atomic finite-input refusals. Neutral gain 0 preserves current colour words; RM6 enables/tunes the visible light. Seven related cases / five suites, touched-layer/fixture types and scoped typed lint pass |
| RM3.3b tile budget report | done | `node scripts/night-market-kit-budget.mjs` prints all 64 L0 / 16 L1 rows from the current sealed product, verifies each dependency’s wire bytes and separately counts 82 unique files across both levels. L0 maxima: 5,164 tris / 9 draws / 2,491,498 B compressed; L1: 9,343 / 6 / 2,990,246 B. Eight L0 rows miss RM8’s 300,000 B target; existing cap debt remains visible, no waiver/cap change. Four related cases incl plain Node and corrupt-wire refusals, scoped types/lint pass. Actual selected product passes; neutral bake’s source world remains byte-exact (12,115,608 B, SHA256 57679eab…) |
| RM3.4 milestone | done | One `a4b6d8b47f` preview and 652 s capture: all 72 original eye/look/lens poses, 8,640 drawn frames, eight inspected phone sheets and no page errors/context loss. Static kit look and every per-view draw/triangle maximum match RM2; entered claims exact, outside A1/B1/C1 +88 B each. Whole-scene maxima remain 122–193 draws / 287,121–361,596 tris; no FPS/native-memory pass. Sheets and separate page-memory numbers linked in the art index; browser/preview closed |

### RM5–RM12 slices (G711, ≤ 1 h each; sp-o2, stand-dome lane: materials, light, life, near/far, perf)

| Slice | Status | Deliverable |
|---|---|---|
| RM5.1 ruled paving | done | Flagstones in a 3.2 × 2.4 m running bond, antialiased dark joints that fade under a pixel, a hashed shade per flag, over each region's vertex colour (no texture, no UV, no new draw or byte: the kit graph rules every up-facing kit face below 0.045 m; the ring floor's `paving.graph.json` adds wear); the 10 m checker and `pavingAlt` / `laneAlt` go |
| RM5.2 palette to round 46 | in flight (2026-10-26, sp-o2) | Ground regions warmed to the D1 targets' stone (cool blue-grey → warm grey-pink; the rest of the gap is lantern light, RM6.3); water #2a7fd0 → turquoise #3a9fc0 and lawn / hedge / foliage brightened toward the G726 targets (map repinned); roof, wall and stall after sp-o1's models; ΔE00 ≤ 8 per region at the end |
| RM5.3 ruled trim | done | The trims drawn in the kit's material instead of a KTX2 sheet (Nine's ruled-kit method: no texture memory, retinted by palette for RM14): `data/kit.graph.json` draws plain / roof tile / timber / plaster / awning stripe / stone by the face's band in TEXCOORD_0 (box-projected metres + 32 m × band, `data/trim.json`); band 0 keeps today's kit. Source: `scripts/open-plots/ruled-graphs.py` |
| RM5.4 kit models carry trim bands | waits-Opus (sp-o1 RM4) | sp-o1's models map each palette slot to a trim band (`data/trim.json`) in their UVs |
| RM6.1 bloom | done | Open plots' manifest grade: bloom 0.5 / threshold 0.9 (was 0 / 1), carried on the grid as each cell's chain knobs |
| RM6.2 round pools | done | Smoothstep falloff in the pool graph (no geometry or byte change: the tiles' debt rows allow none); sizes kept (they read right at D1) |
| RM6.3 light bake | done | RM3's lantern bake on at gain 0.8 (radius 1.5 m, reach 3 radii) into the kit's vertex colours (D1: stall roofs and posts warm near lanterns) |
| RM6.4 gate light | done (material) | The gate unlit in its own texture (`data/landmark.graph.json`): shaded by the fixed dusk sun and a warm fill, gold texels glowing ×1.6, its lowest 9 m uplit by its pools; D1 on `e565128c26` reads red pillars, lit gold brackets, navy roof. Its hanging lanterns are sp-o1's gate dressing (RM9) |
| RM6.5 dusk fill | done | The look key's ambient (what lights a plot on the grid and alone): ground [0.32, 0.34, 0.42] → warm lantern bounce [0.55, 0.36, 0.24], sky → lavender [0.66, 0.62, 0.86], 0.8 → 1; the manifest's hemisphere fill matches |
| RM10.1–10.4 life (10.5 figures: sp-o1, RM4.8) | waits-Opus (RM8 bytes, sp-o1) | Round paper sky lanterns, stall steam, fireflies, banner sway, static posed figures: each adds or marks geometry, and the plaza and stall tiles sit on exact debt rows (`lint/tile-bake-debt.json`, 77 Night Market rows: no growth); they land once RM8 frees bytes (the props bake's instancing) |
| RM11.1–11.2 near / far | waits-Opus (sp-o1 RM4) | The near view already takes the new palette and lantern bake (it is the coarse tiles' vertex colours); far stand-ins re-authored once sp-o1's kit models land |
| RM12.1–12.3 perf | waits-Opus (RM8, sp-o1) | Counts on `1d4a4f738f` (phone 2×): D1 ≤ 150 whole-scene draws / 342k tris, A2 ≤ 147 / 339k (target ≤ 120 / 600k). One-frame breakdown (D1 hero): 100 of 125 draws are the Night Market cell, 49 of them shadow-map depth draws (phone: 1 cascade, 80 m): ~4 casting primitives (kit, glow, water, poster or gate) per tile in the frustum. Fewer draws needs fewer primitives per tile, which needs a marker byte or RM8's instancing (the tiles' exact debt rows refuse any growth). Landed: additive tile meshes cast nothing (4c477f75aa; the pools were not casting, so 0 saved here). Then one Simulator reading |

### RM4, RM7–RM9, RM13 slices (G711, ≤ 1 h each; sp-o1, look-dome lane: kit models, ground geometry, gate, density, board)

Kit models are Blender scripts (`scripts/blender/open-plots/kit.py` + `kitlib.py`, target `open-plots/kit`), one GLB per
family of three variants in `public/assets/open-plots/kit/`: nodes `<variant>.<Role>.<slot>`, flat normals, Cycles AO in
`COLOR_0`, `data/trim.json`'s trim bands in `TEXCOORD_0`; `kitGlb.mjs` places them through the tile writer, coloured
palette[slot] × shade. RM3's tile-GLB roundtrip went in RM4.1: it cannot carry model-placed triangles.

**The kit is opt-in until the tiles can pay for it** (aba65405bb, wildshard-new: contain, no cap raise). Placed as merged
world geometry, the lanterns alone broke Night Market's pinned tile rows (`lint/tile-bake-debt.json`). Three limits bind, measured on
the contained product: tile blobs are raw and unwelded (~121 B a triangle, so a plain tile has ~550 triangles of room
under 0.3 MB); the central L1 tiles sit at 8.9k of their 10k triangles (the landmark); the plaza L0 tiles carry pinned
resident debt (0/3/3 10.1 MB: landmark and poster textures), so any geometry there needs a saving beside it. RM8.1–8.3 pay
for the kit before the families switch on; `tiledPlot.mjs` `KIT_FAMILIES` lists the families placed.

| Slice | Status | Deliverable |
|---|---|---|
| RM4.1 kit pipeline + lanterns | done (99959f0ced; opt-in since aba65405bb) | Blender target, model reader, lantern family (stone post, paper-lantern bracket, banner post) on every `lantern()` |
| RM4.2 stalls | done (opt-in) | Hero stall (striped awning, valance, goods), red-roof row stall, food cart; S tiles and forecourt kiosks |
| RM4.3 string lights | done (opt-in) | Round bulbs and red paper lanterns on sagging cords; banner posts at the lane crossings |
| RM4.4 houses | done (opt-in) | Three cottages (tiled hip roofs with upturned eaves, timber frame, plaster, lit windows) filling the H courts |
| RM4.5 bridges | done (opt-in) | Arched stone bridge halves with balustrades at the canal borders |
| RM4.6 street props | done (opt-in) | Planters with flowers, benches, crates and goods, banners |
| RM4.7 trees | done (opt-in; Hunyuan3D-2 over TRELLIS.2, `art/grid/round-67-night-market-trees/board.jpg`; the willow redone as a Blender-scripted weeping canopy, 816 tris, `willow-redo.jpg`) | Round-crown trees, TRELLIS.2 vs Hunyuan3D-2 (better wins), three variants |
| RM4.8 figures | done (opt-in; TRELLIS.2 over Hunyuan3D-2, `art/grid/round-70-night-market-figures/board.jpg`) | Static posed figures at stalls and on bridges (image-to-3D) |
| RM4.9 boards | done for 7 families (`art/grid/round-69-night-market-kit/`); trees and the in-game A2 / D2 captures follow RM8.1 | A labelled 4-angle board per family beside its mockup crop; A2 / D2 captures for bars 2 and 5 |
| RM7.1 canal coping | done (opt-in) | 2 m coping blocks with a lip over the water on every rim, a bollard every fifth, water steps every ninth |
| RM7.2 water light | done (opt-in, straight canals) | Each bank lantern doubled on the water, a soft additive streak from the wall |
| RM7.3 kerbs and block edges | done (opt-in) | A 0.15 m stone kerb round the H, G and S blocks, open at their paths; it collides, so the physics walk runs when the kit switches on |
| RM9.1 gate model | done | r7's three-bay gate, Hunyuan3D 2.1 over TRELLIS.2 at the shipped budget (`art/grid/round-68-night-market-gate/board.jpg`), 12k near / 2.5k far, 45 m tall |
| RM9.2 gate lanterns | done (opt-in with the strings family) | 14 paper lanterns (4.5x the kit's small one, ~2 m) under the bays' lintels: layouts/night-market.json landmark.lanterns |
| RM9.3 gate trim and uplight | sp-o2 (RM6.4, landed) | Gold trim glow and uplight are sp-o2's landmark graph | r7 reference, Hunyuan3D 2.1 vs TRELLIS.2, hanging kit lanterns and trim (light with sp-o2's RM6.4) |
| RM8.1 quantized tiles | sp-x2 (wildshard-new's routing, 2026-10-26) | Quantized tile geometry in the authored-world bake (KHR_mesh_quantization + meshopt, near-view and cost readers taught): ~10–15 B a triangle and about half the resident. Measured and dropped first: lossless meshopt alone (0.30–0.35 of the wire, but the near view's reader refuses EXT_meshopt and resident rises) and per-model instancing (fine wire, but 2 draws a model: tiles at 13–31 of 8 draws) |
| RM8.2 authored L1 | open | World-source prefixes: detail rows draw at L0 only, `coarse_` rows only in L1; each kit family carries a ≤ 12-triangle LOD1 (the lit head, the roof block) |
| RM8.3 plaza resident | open | Savings in the four plaza L0 tiles (landmark and poster textures, with RM9) so their kit fits the pinned resident rows; then `KIT_FAMILIES` switches on |
| RM8.4 plaza beds | done | r7's raised lawn beds flanking the lanes into the gate (8, two a plaza quarter); trees, planters and lanterns on them with the kit |
| RM8.5 kit within 15k | done | With every family on, every L0 tile ≤ 14,174 triangles (was 18,826): figures 450 triangles, a vendor behind every other hero stall, a shopper before every fourth stall, no cart vendors, round bulbs every 3 m, no bed planters |
| RM8.6 bytes and switch-on | waits on RM8.1 (sp-x2) | ≤ 0.3 MB per L0 tile once tiles are quantized, then the layout's kit list switches the families on (raw today: up to 3.5 MB a tile) |
| RM13.1–13.2 board and walk | open | 5 cameras × MOCKUP · BEFORE · NOW, a 30 s road-to-plaza walk |

## 4. Decisions for Jake

- **D1 Fidelity bar.** 1 Skip · **2 Match the mockup's look at eye height in all ten domes (rec):** stylised and
  low-poly like the mockup itself, but real models, lit and dense · 3 Keep the code-built kit and only fix light, ground and
  density (about half the effort, still "boxes") · 4 Go past the mockup toward photoreal.
- **D2 Asset pipeline.** 1 Skip · **2 Blender scripts for architecture (stalls, houses, bridges, lanterns, posts);
  TRELLIS.2 vs Hunyuan3D-2, better wins, for organic pieces (trees, goods, figures) and the gate (rec)** · 3 Everything
  image-to-3D · 4 Everything code-built (today's builders, upgraded).
- **D3 Perf budget inside the plot, phone tier.** 1 Skip · **2 30 fps floor (Low Power Mode cap), ≤ 600k triangles and
  ≤ 120 draws, ≤ +150 MB over today and ≤ 1.2 GB per shard (rec)** · 3 No growth over today's reading · 4 Anything up to
  1.2 GB per shard.
- **D4 Before Opus returns (Tue 13:00).** 1 Skip · **2 Codex starts now on RM1–RM3 (dome targets, baseline captures, the
  GLB-piece placement, vertex light bake and per-tile report, all with no look change); Opus builds the look from Tue (rec)** ·
  3 Wait for Opus Tue for everything.

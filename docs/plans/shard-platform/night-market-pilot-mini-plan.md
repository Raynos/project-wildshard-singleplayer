# Night Market open-plot pilot: mini plan (G616, G617, G621, G623, G626, G629)

> **Remaster (E503, draft for Jake):** [night-market-remaster](night-market-remaster-mini-plan.md): the Nine dome method (10 domes, rows RM0–RM14) after Jake's 10-24 "trash fire" playtest.

Jake, 2026-10-23: *"we need to make a mini plan of how to build it"*. Read at HEAD 3af2694878. Mockups:
`art/grid/round-45-night-market-billboards/` (m1 100 m over the neighbour, m2 road entry, m3 top-down 630 m, m4 plaza);
round 46 is coming and is the capture target. The plan adds one SDK flag and otherwise stays data plus generator, with no runtime code.


## Pilot brief for the overnight lane (2026-10-23, for Jake's review)

Everything below this brief is the detailed build reference; where they disagree, this brief wins.

- **Target look:** `art/grid/round-49-night-market-billboards-2x2/` (take B layout, G633) — match it from the four views
  (100 m above the neighbour, road entry, top-down, plaza).
- **Tiles (G641, supersedes "four types"):** an exact 8 × 8 grid of 62.5 m tiles; a **7-tile kit**, rotation only: H house court, G garden, S stall row, C canal straight, L canal corner, N entry forecourt, P plaza quarter (H and G with 2 seeded variants each); every tile edge is paved or canal, canal edges meet canal edges, each canal tile builds half an 8 m arched bridge where a lane crosses it. **Layout B, the moat ring** (H16 G8 S12 C12 L4 N8 P4), from `art/grid/round-50-night-market-tiles/05-mockup-b-grid.jpg` (layout map in `03-layouts-board.jpg`); the data file holds 8 strings of letter + rotation pairs. Code-built by small JS builders, ~2 draws each; ~7.25 h. Round 49 stays the style reference.
- **Landmark:** the Hunyuan3D 2.1 pagoda gate from the trial (`art/grid/round-48-landmark-trial/`; Jake: "doesn't look
  bad"), unless the TRELLIS.2 side-by-side comes out clearly better (G632) — scaled to ~45–60 m, 15k triangles near /
  2.5k far, opaque and painted; box colliders on pillars and bases.
- **Billboards (G633):** five real posters — the large one on the plaza, one at each of the four road entries — each with
  a hero picture of the finished Night Market, the name **NIGHT MARKET** and the invitation **BUILD THIS SHARD**, lit,
  readable from the road and from 100 m up (textured boards).
- **Removed:** the hologram, plinth, rim, sign, corner beacons and **beams** (G637: beams go on every plot).
- **Where Jake finds it:**
  1. **SHARD SELECT:** the pilot gets its own card ("NIGHT MARKET · OPEN PLOT PILOT", Developer) so he can enter it
     directly.
  2. **Infinite Wildshard:** it replaces the Night Market cell(s); following the road from Driftwood leads to it.
  3. **World map / minimap:** its top-down reads completely differently from every other open plot (tiles, canals, the
     plaza and gate in its own palette, painted into the map from the generator) — part of done.
- **Scope:** Night Market only; every other open plot keeps its hologram until Jake has checked the pilot (G633 D4).
- **Who and when:** one Opus lane, overnight, after the live P0s; rows NM0–NM6 below (NM0 SDK far option, NM1 tiles,
  NM2 landmark, NM3 billboards, NM4 wiring + SHARD SELECT card + map colours, NM5 near view, NM6 capture).
- **Done when:** deployed to live; a 9-angle in-game capture board (round 38 cameras) next to the round 49 mockup;
  frame floor and memory reading on the phone tier; physics walk 0 stuck; Jake checks it in SHARD SELECT, on the grid
  and on the map.

## 1. How it's built today

- `src/shards/open-plots/` is a data-only source shard. `outputs.json` has 14 idea rows, each emitting `open-plot-<idea>`, and 19 grid cells use them.
  Night Market fills two cells (`open-plot-nw` at -555/555, plus a repeat).
  `generators/product.ts` is build-time: it assembles each product with `world: { glb: assets/<idea>/world.glb,
  colliders: 'nodes:collide_', far: 'far_' }`.
- `generators/bake-plots.mjs` (286 lines, generation job `open-plots-world`) builds each idea's `world.glb` from a
  `Soup` triangle builder:
  - `ws_terrain_floor`: a 500 m floor of 25 m quads, three vertex-colour shades, accent-tinted (`plot.json floorTint`).
  - kerb boxes at 238–240 m with four 15 m entry gaps at the side midpoints.
  - a 10 m plinth drum with a cyan `Rim`.
  - a 24 × 13.5 m `Billboard` quad at z 26 (`billboard.webp`) and a 7.5 × 2.5 m `Sign` (`sign.webp`, 'OPEN PLOT · COMING SOON').
  - four striped corner beacons with crossed `Beam` quads (120 m and 90 m).
  - the `Hologram`: `hologram.glb`, Hunyuan3D-2, 8k triangles, scaled ×6 to 72 m (G615). It is edge-coded in vertex colours
    for `data/hologram.graph.json` (additive, fresnel, scanlines, turning). The beams use `data/beam.graph.json`.
  - `far_hologram` (meshopt-simplified to 500 triangles) and `far_beams` glow boxes, drawn by the far proxy only.
  - `collide_plot`: the floor, kerb, beacon posts, plinth, billboard and sign.
  - finally `paintDataMap`, which paints the map from the GLB colours that `look/map.json` matches.
- The SDK bake (`src/sdk/bake/authoredWorld.ts`):
  - It clips all static geometry into 8 × 8 L0 tiles of 62.5 m and 4 × 4 L1 tiles of 125 m. L1 is meshopt-simplified at 0.5 with
    0.25 m error.
  - Each tile merges into **one draw per material**. There is no GPU instancing in the authored-world path; the props
    bake has `EXT_mesh_gpu_instancing`, but it cannot be combined with `world`.
  - Far proxy: static, undrawn and `far_` nodes, minus the additive surfaces, simplified at 0.1 with 2 m error into one vertex-colour
    draw.
  - Caps (`src/format/contentBounds.ts`):
    - L0: 40k triangles, 8 draws (shadow draws count), 0.3 MB download.
    - L1: 10k triangles, 2 draws, 0.2 MB.
    - These tile caps are warnings only.
    - **Far: 8k triangles, 1 draw, 1 MB. This one refuses the build.**
- Near view: `fcc5bd1cb6` added `near: 'coarse'`, which bakes the near view from the L1 tiles plus the `far_` stand-ins in vertex colours.
  `c238c3eb1c` reverted it, because the opaque stand-in showed through the additive hologram and Starfall drew almost nothing.
  So today a non-entered plot, even seen from the road at its entry, draws its **far proxy** (the phone has 4 near cells,
  `nearPlaceholderPlan.ts`). Near bake budget: 42k content triangles, vertex colours only (`NEAR_BAKE`).
- Assets in `public/assets/open-plots/<idea>/`: `billboard.webp` (~110 KB), `sign.webp` (~24 KB), `hologram.glb` (~166 KB).
  Tools: `scripts/open-plots/` (`gen-refs.sh`, `batch-holograms.sh`, `holo_post.py`, `clay-review.mjs`, `make-art.sh`).
- **What gets deleted:**
  - In the pilot, for the Night Market row: the hologram, plinth, rim, beacons, beams, sign and old billboard.
  - At rollout, everywhere:
    - `data/hologram.graph.json`, `data/beam.graph.json`, and `plot.json`'s `hologramScale`, `beam` and `farHologramTriangles`.
    - `hologram()`, `orient()` and `farStandIns()` (the far silhouette).
    - all 14 `hologram.glb`, `billboard.webp` and `sign.webp`.
    - `batch-holograms.sh`, `holo_post.py`, `holo-subjects.tsv`, `clay.html`/`clay-review.mjs` (unless the landmark review reuses them),
      and the billboard/sign half of `make-art.sh` (the card thumbs stay).
    - the look's `hologram`, `beam`, `plinth`, `sign` and `billboard` materials.

## 2. The tile kit (recommend generator primitives, not Blender)

- **Layout.** An exact 8 × 8 grid of 62.5 m tiles, one per L0 streaming tile (G626): tile (i, j) covers
  `[-250 + 62.5i, -250 + 62.5(i+1)]`. The centre four (i, j ∈ {3, 4}) are the 125 m plaza; the other 60 are kit tiles.
  The layout is data: `data/layouts/night-market.json`, eight strings of `H` house block, `S` stall row, `C` canal,
  `G` garden, `P` plaza, plus a rotation digit. Copy m3's pattern; Jake can tweak a letter without any code.
- **Seams.** Every kit tile has the same 4 m paved border at y = 0 on all four sides, so any tile meets any tile at any 90°
  rotation and the lanes between tiles are 8 m (= `ENTRY_WIDTH`). Each entry lies on the x = 0 or z = 0 seam
  (between columns 3 and 4), so the lane is the avenue from the entry to the plaza; no special tiles are needed.
  Content stays ≥ 2 cm inside the tile square. Only the ground quad touches the edge, so the clipper never splits or doubles a wall.
  The kerb moves into the outer border (245–248 m, gaps at the entries), and the boundary strip stays at y = 0 so the
  edge samples and the `ENTRY_ASPHALT` zone are ground.
- **Authoring.** Each type is a JS builder in `generators/kit/` (house, stalls, canal, garden, plaza) that writes into the
  existing `Soup` (boxes, hip and gable roofs with eave overhang, octagonal posts, arch bridge, cone or icosphere trees).
  The builders take a **style row**: roof shape, tree shape, water kind (water, ice, lava, sand) and storey count.
  Every vertex carries a **palette slot** (wall, roof, trim, paving, water, foliage, accent, light), which the idea's
  palette row maps to colours at bake time. Retinting is free and nothing extra is committed per idea.
  Blender per tile would mean 4 to 76 committed GLBs plus the model lock, for filler that is boxes and roofs.
- **Materials.** Two in the whole plot:
  - `kit`: pbr, faceted, vertex colours.
  - `glow`: `emissive`, opaque, vertex colours, for lanterns, windows and the billboard faces and text.
  - L1 stays at ≤ 2 draws. L0 is 2 + 2 shadow draws, against a cap of 8.
- **Instancing.** Not needed. The bake merges each 62.5 m tile into one draw per material, so 60 tiles cost about 2 draws each
  in view. GPU instancing would only save download and memory (~2 MB a plot) and needs a new SDK path, so it is deferred.
- **Collision.** Each builder also emits `collide_` boxes:
  - one per building footprint, stall counter and tree trunk;
  - a 0.6 m stone rim around each canal, and the bridge as two ramps and a deck;
  - plus the one 500 m ground quad.
  The paved borders, lanes and plaza are open. Done = `node scripts/physics-baseline.mjs --no-build --mode=walk` reports 0 stuck.
- **Far stand-in.** Each builder emits `far_tile` geometry of ≤ 40 triangles in palette colours: roof blocks, a water quad and tree lumps.


> **Jake, 2026-10-23 (G633): target = art/grid/round-47-night-market-2x2/quad-b.jpg (all four views); D2 = bespoke tiles per idea (four tile types designed per idea, ~76 total; the code-built builder approach stays, one set per idea); D3 = real billboards: the idea's hero image, its name and an invitation to build it (textured board; supersedes geometry text); D4 = other plots keep holograms until Jake checks the pilot.**

> **Jake, 2026-10-23 (G632): the landmark is a model generated by Hunyuan3D 2.1 or TRELLIS.2 — whichever gives the better result (generate both, pick on the review board; the holograms used Hunyuan3D-2 full, G545) — made the same way as the holograms (G542/G545: a single-object reference per idea, Hunyuan3D, meshopt, reviewed), NOT a Blender script.** It is opaque and painted (its own texture, so a third material and its texture memory are accepted), with a decimated far version that fits the far-proxy budget. §3 and row NM2 below are superseded where they say Blender; D1 is decided.

## 3. The landmark (Hunyuan3D 2.1 or TRELLIS.2, the better one, G632; Blender text below superseded)

- `scripts/blender/open-plots/night_market_gate.py` gets a `targets.json` row (no Cycles, so no lock). Build steps: meshopt,
  then copy to `public/assets/open-plots/night-market/landmark.glb` (≤ 1 MB, expected ~150 KB).
- The shape is a ~60 m red-and-gold pagoda gate (m3 shows a paifang-style gate, m2 a tiered tower; round 46 settles it).
- Construction:
  - Octagonal pillars, three stacked roofs with upturned eaves, simplified bracket rows, gold trim, hanging lanterns and a finial.
  - Material slots are named by palette slot, so the generator recolours them into `kit` and `glow`.
  - It also emits a `far` node (≤ 2.5k triangles: roofs and pillars only) and `collide` boxes (base and pillars).
  - Flat-shaded, with a crisp silhouette (G617).
- Budget: ≤ 15k triangles at L0 with no texture. Centred at (0, 0), it is clipped into the four plaza tiles at ~4k each.
  L1 auto-simplifies it, the near view takes it from L1, and the far proxy uses its `far` node. It is opaque at every tier,
  so the round-38 "stand-in through the hologram" bug cannot recur.
- Why Blender rather than AI here: Hunyuan3D-2 shapes are lumpy, have no paint, and come with no slots. Paint means a UV texture,
  which adds a third material and a ~1–2.7 MB KTX2. TRELLIS.2 can't reach the budget (G545). A gate is ideal procedural
  geometry. AI stays the fallback for organic ideas such as coral, alien plain and frost (D1).
- Generator side: `generators/landmark.mjs` reads the GLB and returns soup parts, far geometry and colliders. Each idea's row
  names its landmark GLB.

## 4. Billboards (five, text as geometry)

- Placement rows go in `data/plot.json`:
  - **plaza**: 24 × 13.5 m at (0, −30), facing south, below the gate as in m3.
  - **four entries**: a gantry at each kerb gap, (0, ±246) and (±246, 0). The posts sit at ±5.5 m, outside the 8 m entry, the board is 12 × 6 m,
    and its bottom is at 4.5 m so riders pass under. Each board faces out to the road, with the same face on its back.
  - Collision covers the posts only.
- **The text is geometry, not a texture.** The words "OPEN PLOT / BUILD THIS SHARD" are triangulated from a committed
  Apache-2.0 or OFL font subset (A–Z, using three's `FontLoader` and `ShapeUtils`). They are drawn in `glow` on a navy `kit` board
  with a cyan glow rim.
  - The near view and the far proxy are vertex colours only, so a texture would show a blank board from the road (today's
    tiers). Geometry text reads in L0, L1, the near view and, for the plaza board, the far proxy.
  - Cost: ~1k triangles per face and no texture memory. `billboard.webp` and `sign.webp` go away.
  - The idea name is an extra line (D3).
- Readability: cap height ~1.6 m on entry boards and ~2.5 m on the plaza board. Readable from the road at 10–80 m and as
  a lit sign at 300 m.

## 5. Budgets (phone tier, per plot)

| | Target | Cap / limit |
|---|---|---|
| Kit tile (L0) | house ≤ 1.2k, stalls ≤ 1.5k, canal ≤ 0.8k, garden ≤ 1.2k triangles; 2 draws + 2 shadow | 40k, 8 draws (warn) |
| Plaza tile (L0) | paving 0.2k + landmark quarter ~4k + board ~2k | 40k |
| L1 (125 m) | ~3k after 0.5 simplify, 2 draws | 10k, 2 (warn) |
| Far proxy | 60 × 40 + 2.5k + boards ~0.3k ≈ 5.2k, 1 draw, ~0.15 MB | **8k, refuses** |
| Near view | from L1, ~15k | 42k |
| Download | ~64 × 20 KB + L1 + far + collision ≈ 1.8 MB (today ~0.5 MB) | 0.3 MB per L0 tile |
| Resident in the plot | ~29 L0 × 0.3 MB + L1 2.5 + coll 1 ≈ 13 MB | 1.2 GB per shard (G556) |
| Frame at the entry | ~55k L0 + 15k landmark + ~30k L1 + far ring ≤ 72k ≈ 170k triangles, ~75 draws | 30 fps LPM floor |

**The far proxy needs one SDK flag (NM0).** The far bake always feeds every static triangle in. 60 tiles of boxes (~80k
triangles) can't simplify to 8k within 2 m of error, so the build would refuse. Add `farMode: 'replace'` to `worldSource`: when it is
set, the far proxy is the `far_` nodes only, as `props.ts` already does with `source.far`. Open plots are the only `far` user,
so `'add'` is deleted at rollout.

## 6. Rows

| Row | What | Who | Size | Done when |
|---|---|---|---|---|
| NM0 — done `0814022f5d` | SDK: `worldSource.farMode: 'replace'` in `authoredWorld.ts` plus a `world-far-prefix` test case | Codex or Opus | 1 h | Test green; existing plots unchanged ('add') |
| NM1 — done `9754cbfb1d` | Tile kit: `generators/kit/*.mjs` (4 types + plaza, slots, colliders, far stand-ins); `data/layouts/night-market.json`; palette and style row in `outputs.json`; kerb in the border; the row's `layout: "tiles"` branch in `bake-plots.mjs` | Opus A | 3–4 h | `open-plot-night-market` builds with no tile warnings, far ≤ 8k, physics walk 0 stuck; 3 captures of the tiles alone |
| NM2 — done `9754cbfb1d` | Landmark (G632): Hunyuan3D 2.1 AND TRELLIS.2 from one single-object reference of the round 47 pagoda gate, the hologram recipe (gen-refs → both models → meshopt → side-by-side review board, keep the better) → `landmark.glb` with a decimated `far` node and box `collide` nodes; `generators/landmark.mjs` | Opus B | 3–5 h | opaque and painted; ≤ ~15k triangles near, far fits the 8k far budget with the tiles; a labelled 4-angle review board |
| NM3 — done `9754cbfb1d` | Billboards: `generators/billboard.mjs` (gantry + plaza, geometry text, font subset + licence note), placement rows | Opus A after NM1, or Opus C | 1–2 h | All five readable in the 9 shots; posts collide, boards don't block an entry |
| NM4 — done `cb670026cf` | Integrate: product materials `kit` and `glow` in `source.json`; landmark + board POIs in the manifest; `map.json` classes for the new palette; drop Night Market's hologram/sign/billboard inputs; **its own SHARD SELECT card, "NIGHT MARKET · OPEN PLOT PILOT", selectable and enterable directly (Jake, 2026-10-23: *"it needs to be a shard I can select in shard select"*)**, thumb from an in-game shot | Opus A | 1–2 h | Push gate green; both NM cells show the new plot; the card is in SHARD SELECT and enters the pilot |
| NM5 — done `1a5ffecb7c` | Near view back: re-land `fcc5bd1cb6`'s `near: 'coarse'` (safe now: nothing additive) so the road and neighbours see tiles, not the far proxy | Opus A | 1 h | Road-entry shot from outside the cell shows tiles, gate and text |
| NM6 — done `31f2eb568b` | Proof: the **9-angle capture** (iPhone 16 Pro portrait, phone tier, muted, `browser-lane.sh`), round-38 poses: road entry, road far side, 40 m over the road, 100 m over the neighbour, top-down 630 m, 300 m oblique, plaza, inside corner, entry billboard. Labelled board beside round 46; frame floor at the entry; memory strip reading | Opus A | 1 h | Board matches round 46 in layout, gate silhouette and five boards; ≥ 30 fps floor; recorded in the commit |
| NM7 — done `5e67548eaf` | **Wow pass: light** (Jake, 2026-10-23 11:05, on the NM6 board, 40 m over the road: *"Night market looks so flat and boring compared to the mockup, how do you make it pop and wow?"*). The mockup's pop is light, not geometry: every stall, lane and the gate glow warm red-gold against a deep blue-violet ground. Emissive lantern and awning materials (the `glow` product material) on every stall, house and lamp post; string lights strung over each lane (instanced quads, one draw); the gate uplit red with gold trim; bloom picks them up; cheap baked light pools (additive ground decals) under every lantern instead of real lights. Phone budget: no new real lights, instancing only (E271), draws reported in the commit | Opus | 3–4 h | the 9-angle capture beside round 46 reads "lit night market" at 40 m and 100 m |
| NM8 — done `a2e86c1204` | **Wow pass: ground and colour.** Dark paving (slate blue-grey with a tile pattern) replaces the bare tan ground; kerbs and raised block edges; the thin blue canal lines become wide canals with arched bridges, as in the mockup, darker and reflective (env or matcap) so the lights double; the palette locked to the mockup's navy / red / gold / leaf green; the plot's own grade nudged toward dusk (exposure, a cool ambient) without changing the shared sky | Opus | 2–3 h | no bare tan ground left in any of the 9 shots |
| NM9 — done `46ab6c1366` | **Wow pass: density.** Every block full, as in the mockup: 3–4× the stalls (rows of red-awning stalls lining both sides of each lane), blue-roof courtyard houses filling the corner blocks, round trees with lanterns, banners and flags for height; stalls and houses scaled up so the gate sits in a dense market instead of towering over tiny sparse stalls; nothing reads as empty floor from 40 m. Instanced kit pieces; kit additions are generated, not hand-placed | Opus (+ Codex for the layout data) | 3–4 h | each tile in the top-down shot is ≥ 70 % covered; draws and MB in the commit |
| NM10 — done `686d604bae` | **Wow pass: life.** Lantern flicker, a few floating sky lanterns, food-stall smoke and fireflies (one particle system each, phone-tier caps), banners swaying | Opus | 1–2 h | visible in a 5 s capture at the road entry; frame floor unchanged |
| NM11 — done `def60a9ec9` | **Board for Jake:** the same 4 cameras (road entry, 40 m over the road, 100 m over the neighbour, plaza) as MOCKUP round 46 · BEFORE (today) · AFTER, labelled, one board; the new look ships (G669: no Debug variant), the old one is reverted only on Jake's word | Opus | 0.5 h | board sent to wildshard-v |
| — | **Jake checks in-game** on the grid and in SHARD SELECT (Developer on) | Jake | — | His word |
| R1 | Five new ideas (G653, approved): Jungle Ziggurat, Patchwork Fairground, Saltwind Lighthouse, Mushroom Hollow, Fossil Badlands; outputs.json rows + grid cells replace the five repeats | builder | 0.5 h | All 19 cells unique |
| R2 | Rollout (mockups collected in [remaster-open-plots-mini-plan.md](remaster-open-plots-mini-plan.md), G660; only after Jake is happy with the pilot): per idea, a style and palette row, a layout, and a landmark (D1); 18 ideas over 2–3 Opus lanes (~2–3 h each) | Opus ×3 | ~2 days | All 19 cells unique; one hero + entry board per idea |
| R3 | Delete the hologram path (the list in §1) and SDK `farMode: 'add'` | Opus | 1 h | `net` lines negative; push gate green |

Order: NM0 ∥ NM1 ∥ NM2, then NM3 → NM4 → NM5 → NM6 → Jake → R1 → R2 → R3. The other ideas keep their holograms until Jake's
pilot word (D4).

## 7. Decisions for Jake

- **D1 Landmark source: DECIDED (G632) — Hunyuan3D 2.1 or TRELLIS.2, whichever looks better, like the holograms.** Original options: 1 Skip · **2 Blender script per landmark (rec):** crisp, exact budget, ~3–4 h each ·
  3 AI (Hunyuan3D-2 shape + paint baked to vertex colours): ~0.5 h each, lumpier ·
  4 Blender for buildings, AI for organic ideas.
- **D2 Tile kits.** 1 Skip · **2 One parametric kit with per-idea style + palette rows (rec):** roofs, trees and water kind change per idea ·
  3 One kit retinted only (cheapest; courtyard houses on Coral Drift) · 4 Four bespoke tile types per idea (~76 tiles).
- **D3 Billboard text.** 1 Skip · **2 'OPEN PLOT / BUILD THIS SHARD' on all five, plus the idea name on the plaza board (rec)** ·
  3 Exactly the mockup, with no names · 4 The idea name on all five.
- **D4 The other 18 cells during the pilot.** 1 Skip · **2 Keep their holograms until Jake's pilot word (rec, his
  sequence)** · 3 Switch them all now to the kit retinted, with their Hunyuan shapes as opaque stand-in landmarks.

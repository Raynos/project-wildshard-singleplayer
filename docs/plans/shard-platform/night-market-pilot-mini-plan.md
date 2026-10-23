# Night Market open-plot pilot: mini plan (G616, G617, G621, G623, G626, G629)

Jake, 2026-10-23: *"we need to make a mini plan of how to build it"*. Read at HEAD 3af2694878. Mockups:
`art/grid/round-45-night-market-billboards/` (m1 100 m over the neighbour, m2 road entry, m3 top-down 630 m, m4 plaza);
round 46 is coming and is the capture target. The plan adds one SDK flag and otherwise stays data plus generator, with no runtime code.

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

## 3. The landmark (recommend a Blender script for the pilot)

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
| NM0 | SDK: `worldSource.farMode: 'replace'` in `authoredWorld.ts` plus a `world-far-prefix` test case | Codex or Opus | 1 h | Test green; existing plots unchanged ('add') |
| NM1 | Tile kit: `generators/kit/*.mjs` (4 types + plaza, slots, colliders, far stand-ins); `data/layouts/night-market.json`; palette and style row in `outputs.json`; kerb in the border; the row's `layout: "tiles"` branch in `bake-plots.mjs` | Opus A | 3–4 h | `open-plot-night-market` builds with no tile warnings, far ≤ 8k, physics walk 0 stuck; 3 captures of the tiles alone |
| NM2 | Landmark: Blender script + `targets.json` row → `landmark.glb` with `far` and `collide` nodes; `generators/landmark.mjs` | Opus B | 3–5 h | `build.sh --check` IDENTICAL; ≤ 15k / ≤ 2.5k triangles; a labelled 4-angle clay and colour board |
| NM3 | Billboards: `generators/billboard.mjs` (gantry + plaza, geometry text, font subset + licence note), placement rows | Opus A after NM1, or Opus C | 1–2 h | All five readable in the 9 shots; posts collide, boards don't block an entry |
| NM4 | Integrate: product materials `kit` and `glow` in `source.json`; landmark + board POIs in the manifest; `map.json` classes for the new palette; drop Night Market's hologram/sign/billboard inputs; SHARD SELECT thumb from an in-game shot | Opus A | 1–2 h | Push gate green; both NM cells show the new plot |
| NM5 | Near view back: re-land `fcc5bd1cb6`'s `near: 'coarse'` (safe now: nothing additive) so the road and neighbours see tiles, not the far proxy | Opus A | 1 h | Road-entry shot from outside the cell shows tiles, gate and text |
| NM6 | Proof: the **9-angle capture** (iPhone 16 Pro portrait, phone tier, muted, `browser-lane.sh`), round-38 poses: road entry, road far side, 40 m over the road, 100 m over the neighbour, top-down 630 m, 300 m oblique, plaza, inside corner, entry billboard. Labelled board beside round 46; frame floor at the entry; memory strip reading | Opus A | 1 h | Board matches round 46 in layout, gate silhouette and five boards; ≥ 30 fps floor; recorded in the commit |
| — | **Jake checks in-game** on the grid and in SHARD SELECT (Developer on) | Jake | — | His word |
| R1 | Five new idea names + pitches (G629) for Jake's approval | builder | 0.5 h | Approved |
| R2 | Rollout: per idea, a style and palette row, a layout, and a landmark (D1); 18 ideas over 2–3 Opus lanes (~2–3 h each) | Opus ×3 | ~2 days | All 19 cells unique; one hero + entry board per idea |
| R3 | Delete the hologram path (the list in §1) and SDK `farMode: 'add'` | Opus | 1 h | `net` lines negative; push gate green |

Order: NM0 ∥ NM1 ∥ NM2, then NM3 → NM4 → NM5 → NM6 → Jake → R1 → R2 → R3. The other ideas keep their holograms until Jake's
pilot word (D4).

## 7. Decisions for Jake

- **D1 Landmark source.** 1 Skip · **2 Blender script per landmark (rec):** crisp, exact budget, ~3–4 h each ·
  3 AI (Hunyuan3D-2 shape + paint baked to vertex colours): ~0.5 h each, lumpier ·
  4 Blender for buildings, AI for organic ideas.
- **D2 Tile kits.** 1 Skip · **2 One parametric kit with per-idea style + palette rows (rec):** roofs, trees and water kind change per idea ·
  3 One kit retinted only (cheapest; courtyard houses on Coral Drift) · 4 Four bespoke tile types per idea (~76 tiles).
- **D3 Billboard text.** 1 Skip · **2 'OPEN PLOT / BUILD THIS SHARD' on all five, plus the idea name on the plaza board (rec)** ·
  3 Exactly the mockup, with no names · 4 The idea name on all five.
- **D4 The other 18 cells during the pilot.** 1 Skip · **2 Keep their holograms until Jake's pilot word (rec, his
  sequence)** · 3 Switch them all now to the kit retinted, with their Hunyuan shapes as opaque stand-in landmarks.

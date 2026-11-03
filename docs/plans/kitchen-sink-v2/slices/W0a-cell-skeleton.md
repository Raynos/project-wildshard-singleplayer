# W0a: the cell skeleton (terrain, seam wall, roads, entries, ground)

Slice rule and order: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **K1**
(skeleton part) and **ML2** (`layout.js` → shard rows). Layout: `art/showcase-template/round-4-blockout/` (west) inside
round 5's cell (`art/showcase-template/round-5-blockout/layout.js`, every number).

## 1. The showcase piece

A new product `src/shards/showcase-template/`, `status: "hidden"` (Developer only: `game/shard/registry.ts:14`
`playable()` hides it from the public picker), with:

| Row | What |
|---|---|
| terrain | the 500 × 500 m cell, flat yard ground at y 0 with the round-4 grades: the Rock pad, the oval's infield, the hover park bowl cut (−2.5 m), the squeeze-cave cut reserved (W9a fills it) |
| ground | finished ground materials, never dev grids (ruling 19ab): asphalt roads, packed-gravel yards, concrete pads, worn grass infield |
| roads | the west avenue, the ring road, the walled east road (an arrival from the east neighbour lands on a safe road), the four midpoint entries (`world/edge`, 8 m openings) |
| seam wall | the north–south seam wall between the halves; the East Gate is the only opening (W0b builds the gate) |
| spawn | the arrival point inside the West Gate plaza; the entry sockets |
| look | the toon look rows (`look/toon`, the family Driftwood and the template use) in the orange / grey / cyan palette |
| card | `ui/card`, `ui/level`, a labelled Opus thumb |

Everything is data or build-time generators (`generators/` never counts as custom, G467). No `runtime/` folder.

## 2. Engine / game / host work, just in time

None new. Research (11-03):

- **Start point.** `_template` builds its cell from TS generators over dev-map boxes (`src/shards/_template/generators/cell.ts`,
  `districts.ts`; README: "dev-map boxes on ground the terrain levels to y = 0"). `blender-template` lets one Blender
  script own the whole cell (`src/shards/blender-template/README.md`, SF55/E435) with the same SDK. The polished look
  (19ab) needs real modelled walls, kerbs and roads, which is what the Blender path is for (AGENTS.md: the script is the
  source, the GLB is committed). Recommended: **data rows copied from `_template`, world geometry from a Blender script
  as in `blender-template`** (Q1).
- **Bounds are already enforced** at bake time: `src/sdk/bake/terrain.ts:34`, `src/sdk/bake/props.ts:227`,
  `src/sdk/bake/world.ts:58` refuse anything outside x/z ±250 and y −250…+250 (`format/contentBounds.ts:19`). The
  interior/portal half of the cube rule is W0e.
- **The grid slot is not (0,2).** The grid catalogue (`src/game/grid/singleplayer.json`) already holds a hologram plot
  **`open-plot-showcase-template` at cell [−1,−1] (instance `open-plot-sw`)**; cell [0,2] is
  `open-plot-saltwind-lighthouse`, and instance `open-plot-0-2` is coral drift at [−2,0]. G972 says one catalogue fills
  every cell for every audience (`src/game/grid/catalogue.ts:33`), so there is no Developer-only cell swap (Q2).

Layer: shard data only. Guards: the layout check (`lint/shard-layout.json`), `wildshard/shard-sandbox`, the ratchet on
the new folder. Tests: copy `test/scripts/_template-boss.test.ts`'s product-scenario pattern only if a script lands
(none here); `node scripts/physics-baseline.mjs --no-build --mode=walk` on the served build must report 0 stuck.

## 3. Other shards in this slice

None touched. The template and blender-template are copied from, not changed.

## 4. Done when, hours, blockers

**Done when:** `wildshard build` + `wildshard validate out/showcase-template` pass; on a served build in Developer,
Select a shard → Showcase Template spawns you in the west plaza site; you can walk and hover every road, out of all four
entries, and the seam wall blocks the east except at the gate gap; walk baseline 0 stuck; one portrait capture per
quadrant reads polished (no grids, no size labels).

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 0 | 14 h (Opus: Blender cell, ground looks) | **14 h** |

**Blockers:** none. First slice.

## 5. Risks

- The polished look needs Jake's taste early: a first quadrant capture goes to him as an A/B board before W0b builds
  35 houses in the same style.
- Toon ground at 500 m on the phone: the cell's draw budget is unmeasured until W12.

## 6. Questions for Jake

1. **Where the world geometry comes from.** (a) `_template`'s TS generators and kit boxes; (b) one Blender script for the
   whole cell, like `blender-template`; (c) image-to-3D pieces. **Recommended (b):** polished modelled walls and roads
   from a script we can re-run; the data rows still copy `_template`. (a) reads as dev boxes, (c) is slow and uneven.
2. **Which grid cell, and when.** The hologram plot it replaces sits at [−1,−1], not (0,2), and G972 forbids a
   Developer-only cell. (a) keep the showcase out of the grid until W12 (Developer reaches it from Select a shard, the
   public grid keeps the hologram at [−1,−1]); (b) put it in [−1,−1] now for everyone. **Recommended (a):** the public
   build keeps the hologram (19l) and W12 swaps the cell after your phone pass.
3. **Look family.** (a) toon (Driftwood's); (b) PBR (Pine's); (c) painterly (Nalati's). **Recommended (a) toon:** it
   matches the remastered mockups' simple polished style and is the cheapest family on the phone.

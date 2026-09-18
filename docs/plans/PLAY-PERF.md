# Play performance — 60 FPS on the phone tier

Ruler: `game.lastFrame` (calls / triangles for the whole composer frame) read headless via agent-browser,
`?tier=phone&skipintro=1&nolock=1` at 390×844. Headless frame ms is vsync-pinned (16.7) so **counts are the
ruler**; the user's iPhone meter is the truth for ms. Poses: gate `x=0&z=-200&yaw=3.1416`, cabin
`x=-14&z=-62&yaw=3.1416`, pond `x=-56&z=95&yaw=3.1416`.

## §0 Measured decomposition — before (commit 58ccfe0, phone tier, 390×844)

iPhone in play: **19 fps · 53 / 76 ms · 471 calls · 16.8 M tris**. Headless phone: gate 451 / 17.2 M, cabin
425 / 17.5 M, pond 380 / 24.0 M. Desktop 1600×900: gate 836 / 22.3 M, cabin 903 / 22.8 M, pond 668 / 29.5 M.

Scene pass at the gate (calls / tris), with the 2 shadow cascades → without shadows:

| group | with shadows | no shadows | why |
|---|---|---|---|
| trees | 48 / 9.70 M | 16 / 3.23 M | all 1770 trees drawn every frame (no frustum cull); lo cards ≈ 1 300 tris/tree × 1 560 far trees = 2.0 M; hi 3–4 k tris × 210 |
| grass | 1 / 2.26 M | 1 / 2.26 M | 75 264 slots × 30 tris, every slot goes through the vertex shader (zero-scaled or not) |
| props | 24 / 2.75 M | 8 / 0.92 M | 380 boulders × 1.3 k + 70 stumps × 3.3 k + 55 logs × 3.6 k, chunk-wide, never culled |
| ferns | 3 / 1.30 M | 1 / 0.43 M | 6 000 × 72 tris chunk-wide, cast shadows |
| cabins | 142 / 0.73 M | 78 / 0.26 M | 3 cabins × ~26 meshes, all in both cascades |
| animals | 145 / 0.15 M | 58 / 0.06 M | 24 animals × ~2.4 meshes, all in both cascades |
| water (pond pose) | 75–124 / 7.1 M | same | planar reflection re-renders the WHOLE scene (grass, ferns, props, animals) at 1024×512 |
| terrain | 2 / 0.13 M | 2 / 0.13 M | fine |
| boundary 19 · crossbow 13 · horizon 4 · shrubs/litter/reeds 9 · particles 3 · sky 5 | | | small |
| post: god rays+bloom+grade pass 25 calls · SMAA 3 · volumetrics 1 | | | |

Shadow passes alone: 211 calls / 9.8 M tris (more than the visible scene).
Budget (phone): ≤ 150 calls, ≤ 2.0 M tris, iPhone ≥ 55 fps. Desktop: 60 fps at 1600×900, ≤ 300 calls.

## §1 Levers (whole-frame calls / tris, phone 390×844; gate · cabin · pond)

| # | lever (commit) | gate | cabin | pond |
|---|---|---|---|---|
| 0 | before (58ccfe0) | 451 / 17.2 M | 425 / 17.5 M | 380 / 24.0 M |
| 1 | shadows by tier (1 cascade to 80 m, 1024², PCF; undergrowth / lo trees / far animals cast none) + per-tree frustum culling + far-tree impostor beyond 130 m (f806c4b) | 236 / 5.6 M | | |
| 2 | grass 40 m ring · 72 slots · 3 quads; props per-instance culled; pond reflection skips carpet layers, 512×256; cabin detail LOD 70 m; 4 shared point lights (were 20 in every shader); god rays 24 @ 0.35, volumetrics 8 steps, SMAA low, bloom 5 levels (07f59f9) | 180 / 2.1 M | 210 / 2.4 M | 187 / 2.0 M |
| 3 | undergrowth cell-culled (ferns 0.43 M → 0.01 M), hi trees to 70 m (64b2d22 +) | **179 / 1.9 M** | **209 / 2.2 M** | **191 / 1.7 M** |

Per group at the gate now: trees 32 / 0.33 M · grass 1 / 0.52 M · cabins 52 / 0.46 M · terrain 2 / 0.13 M · props 16 /
0.13 M · post 23 · boundary 15 · crossbow 13 · animals 4 · undergrowth 6 / 0.02 M. Shadow pass 39 calls / 0.42 M.
Programs at play: phone 153 → 89, desktop 165 → 164.

Desktop 1600×900 (must look unchanged — verified at all three poses): gate 836 / 22.3 M → 612 / 11.1 M, cabin
903 / 22.8 M → 601 / 11.8 M, pond 668 / 29.5 M → 529 / 10.6 M. Desktop got the tree culling + impostor beyond
210 m, culled props / undergrowth, the leaner reflection and the cabin detail LOD at 160 m; everything else is
tier-gated in `src/core/tier.ts`.

What the phone tier trades away (visible if you look): mid trees are lo cards from 70 m (crowns a little
thinner), impostor cross-cards past 130 m, grass ring 40 m and ~25 % thinner, ferns fade at 60 m, one 1024²
shadow cascade to 80 m (softer, blockier near shadows; nothing shadows past 80 m), cabin hardware / lantern /
fire pit pop in at 70 m, only the nearest cabin's lights are lit, no beacon lights, no fur shells, animals vanish
past 150 m, god rays / volumetrics coarser.

## §2 Left

- The iPhone reading after this batch is the gate: calls are still ~180–210 (budget 150); if the meter says
  < 55 fps, in order: DPR 1.25 → 1.0 (`tier.ts dpr`), grassSlots 72 → 56, treeHiDist 70 → 55, cabin merged parts
  fewer per far cabin (log/roof/stone only past 150 m), trees via BatchedMesh (24 → 4 draws, needs
  WEBGL_multi_draw on iOS).
- Headless ms is vsync-pinned; fill-rate (needle-card overdraw, 4 point lights, volumetrics) is unmeasured here.
- Crossbow 13 calls and the HUD are outside this brief.

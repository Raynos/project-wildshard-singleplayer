# Pine Hollow: round 24, the Ridge's crags (E322 F-L2, and F-L1's rock)

**Board for Jake:** `board.jpg`: A today | B new crags, pause ▸ Settings ▸ Debug ▸ Look ▸ **Crags** (a reload; A is the
default until Jake picks). iPhone 16 Pro portrait captures (390×844 CSS px, phone tier, touch, clear weather, day) of one
working-tree build of this commit, `scripts/pine-hollow-crag-shots.mjs --settings=pineCrags=a|b`, at three spots:

1. **close up** (`pass-face`): the N road in the pass, looking E up at a buttress and the face skin.
2. **lookout** (`deck-hero`): the fire lookout's east catwalk, looking E along the crest at B's hero crag.
3. **from trail** (`trail-ridge`): the trail at (0, 170) below the Ridge, looking up the face at the crest.

## What B changes

- **The face skin's stretched ledges (the root cause, landed first as `d28b51ac`).** `skinTile` pushed each band by
  (0.5 − t)·H/tan, the wrong way: every band ran at half the slope and folded back under itself at the wrap (9.8 % of the
  skin's area faces back into the slope). The triplanar granite then took its projection from smoothed normals that
  averaged a riser with the tread above it, so the tread's texture ran down the face. B steps the band OUT as it climbs
  (risers ~80° standing on the slope, 40 %-of-a-band treads stepping back, 3.5 % folded), projects the skin by its facets
  (dFdx / dFdy of the world position) and lights it half faceted, half smooth.
- **Paler granite (F-L1: the Ridge's rock was ΔE00 8.8 off the look targets, darker and blotchier).** The albedo is lifted
  ×1.3, 30 % pulled toward a pale warm grey, and the rain streaks are 0.2 deep instead of 0.38. ΔE00 was not re-measured
  against the round-17 targets in this round.
- **The stacked-block read.** `scripts/blender/pine-hollow/crags/build_crags_b.py` (target `pine-hollow/crags-b`) rebuilds
  the cliff bands, the buttress and the slab from A's same blocks, warped, welded into one mass by a voxel remesh,
  fractured by 6–14 planes (flat faces that cross the old blocks) and weathered (Voronoi joint cracks, sheeting ledges).
  Same budgets as A (LOD0 ≤ 4000 tris, LOD1 ≤ a third). In the placement, B turns the modules further off the fall line
  (±0.55 rad against ±0.22), rolls them (±0.16), sinks them deeper, and sets a half-buried boulder in the joint between
  two neighbouring cliffs.
- **The hero crag.** A ~21 m granite tower (the same pipeline, 9000 / 2200 tris) on the crest 80 m E of the lookout,
  turned toward the tower. It is a variant of the `pine-hollow/crag-cliff` model (`hero`) and collides as its model's
  hull, through the registry like every module.

## Cost

- **Cold load:** A unchanged. B fetches `crags-b.glb` (462 772 bytes, the same file for both tiers) over A's kit; A never
  fetches it.
- **GPU ms/frame** (`scripts/pine-hollow-gpu.mjs --settings=pineCrags=a|b`, M5 Max, phone tier 804×1748). Two A/B pairs,
  on a busy machine, with the frames close to their CPU submit time:

  | pose | A (pair 1 / 2) | B (pair 1 / 2) |
  |---|---|---|
  | lookout (S catwalk) | 1.62 / 1.80 | 2.51 / 2.44 |
  | ridge (the face from its foot) | 1.72 / 1.80 | 2.56 / 3.55 |
  | lookout-e (E catwalk, the hero) | 1.36 / 1.84 | 1.91 / 3.13 |

  B costs +0.6 to +1.8 ms here; its CPU submit rose too (+38 batch instances: the joint boulders and the hero). Draw calls
  are unchanged (the crags stay one batch); triangles +0.04–0.10 M. No iPhone reading yet.
- **Physics:** `node scripts/physics-baseline.mjs --mode=walk` and `--trails` with `--settings=pineCrags=b`: 0 stuck.
  The navmesh is A's placement (the default); B's extra boulders and the hero are not in it.

## Files

- `board.jpg`: the board.

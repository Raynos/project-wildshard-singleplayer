# Lantern Bayou · round 1 · the landmark (OB2, 2026-11-02, sp-o2)

The pilot plot's signature landmark (project/archive/2026-11-03-open-plots-build-out.md §3, bar 1): a giant moss-draped bald
cypress, about 40 m, its lanterns each hung on a visible rope (G827). Look target: round 62's
`art/grid/round-62-open-plot-palettes/18-lantern-bayou.jpg`.

| File | What |
|---|---|
| `crop-r62-road.jpg` | The cypress cropped from round 62's road-entry view: the mockup |
| `ref-a-cypress.jpg` | Reference A (codex `image_gen` from the crop): one broad-crowned cypress, plain grey, no lanterns (the kit's hang there) |
| `ref-b-cypress.jpg` | Reference B: a taller, three-tiered crown |
| `board.jpg` | The pick: the mockup and reference A over three takes at the shipped budget, same light and two cameras each, plus the two theme families (stilts, marsh) and OP1's three hero lanterns |

## Detail list (each on a real part)

1. A buttressed, fluted trunk, flared at the foot: the trunk's 14-ridge rings.
2. Splayed roots running into the mud and a ring of cypress knees: nine root tubes, fourteen knee lathes.
3. Five great limbs from a fork at ~15 m, each forking twice: limb and fork tubes, bark swatches.
4. Clumped olive foliage pads at the limb ends and filling the crown: 2–3 lumpy flat domes a pad.
5. Long grey-green moss curtains from every pad's rim and along the limbs: hanging four-sided strands, 3–9 m.
6. Forty lantern ropes from the outer pads' undersides (1.2–3.4 m): dark rope prisms; their lower ends are the lantern
   hooks.
7. Matte bark in brown-greys with moss on the roots: four shades per slot, picked per face by its facing.

## Numbers

- 40 m tall, crown ~38 m across; pivot at the trunk's foot, front +Z; one copy, on the plaza.
- Near 15.2k triangles (bar 15–25k), far 2.4k (bar ≤ 2.5k); one 80 × 64 px swatch atlas, no normal map.
  0.30 MB near + 0.06 MB far after meshopt (bar ≤ 0.8 MB).
- Collides with the far model (the plot's `collide_plot`, as Night Market's gate). It does not move; the moss sway is
  the kit material's (life, bar 7), not geometry.
- `build/hooks.json` (from `bash scripts/blender/build.sh open-plots/cypress`): the 40 hook points in plot metres as
  `tiledPlot.mjs` stands the model, for the layout's `landmark.lanterns`.

## The pick (G872: decided on the recommendation, logged for Jake's review)

**C, the Blender script, ships** (`scripts/blender/open-plots/cypress.py`). It is the only take inside both budgets,
with clean faceted shading in the kit's own idiom (G978: blocky), and its lantern hooks come from its known pads.

- A, Hunyuan3D 2.1 (on a BiRefNet cutout; on an opaque reference it modelled the backdrop as a slab) has the densest
  crown, nearest the mockup, but black holes where the atlas re-bake left dark texels, and its far take stops at 4.6k
  triangles.
- B, TRELLIS.2, keeps the best trunk and limbs, but at the budget its foliage tears into fragments, the bark goes dark
  (as the Night Market gate's TRELLIS take did, round 68), and its far take sticks at 13.9k triangles.

Generations and posts are scratch in `~/ml/img2mesh/out/bayou-cypress-*`; nothing from A or B ships.

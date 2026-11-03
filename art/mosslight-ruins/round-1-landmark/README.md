# Mosslight Ruins · round 1 · the landmark (OB6, 2026-11-03, sp-o3)

The plot's signature landmark (docs/plans/open-plots/build-out-mini-plan.md, Mosslight Ruins): a ruined stone tower
about 35 m tall on a rock outcrop at the plaza, ivy-wrapped, its windows glowing emerald. Look target: round 62's
`art/grid/round-62-open-plot-palettes/19-mosslight-ruins.jpg`.

| File | What |
|---|---|
| `crop-r62-road.jpg` | The tower cropped from round 62's road-entry view: the mockup |
| `ref-a-tower.jpg` | Reference A (codex `image_gen` from the crop): a square ruined keep and a thinner spire on one craggy outcrop |
| `ref-b-tower.jpg` | Reference B: one round ruined tower (the plan text's "ruined round tower") |
| `board.jpg` | The pick: the mockup and reference A over four takes at the shipped budget (two cameras each, the same light), plus the two theme tiles (ruin court, emerald pool) and the shared ruin-stone kit |

## Takes (posted with `scripts/img2mesh/build_props.py`; generations and posts are scratch in `~/ml/img2mesh/out/mosslight-tower-*`)

- **A · Hunyuan3D 2.1 on reference A:** 20k near, 2.5k far, 0.77 MB. The keep, the spire, broken crenellations and dense
  ivy, closest to round 62. Its bake is a little soft and its windows a pale mint texel, which the shared landmark
  graph does not light (it lights warm texels only); the plot lights them instead (below).
- **B · Hunyuan3D 2.1 on reference B:** 20k / 2.5k, 0.76 MB. A clean round tower, but not round 62's keep, and its back
  wall is a smeared, unpainted slab.
- **T · TRELLIS.2 on reference A:** the chunkiest facets and the best green, but black bake holes between the leaves and
  a torn far take stuck at 4.1k triangles (over the 2.5k bar, 0.89 MB together).
- **C · Blender script** (`scripts/blender/open-plots/tower.py`): 3.4k near, 2.4k far. A faceted keep and turret on a
  mossy crag in the kit idiom, its 22 slits as emerald Glow panes from its own hooks; plain next to A.

## The pick (G872: decided on the recommendation, logged for Jake's review)

**A, Hunyuan3D 2.1, ships** (`public/assets/open-plots/mosslight-ruins/landmark.glb`, `landmark-far.glb`), height 35 m,
turn 0. Its 175 window triangles (the texels of its glowing panes, read off its texture) are the layout's
`landmark.glow`: the plot draws them a little proud of the wall in the palette's `windowGlow` emerald
(`src/shards/open-plots/generators/mosslight.mjs` `towerWindows`). C stays the fallback. Jake's pick steers it when
it arrives (option 1 of the question is Skip).

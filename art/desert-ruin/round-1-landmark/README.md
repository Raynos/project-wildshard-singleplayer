# Desert Ruin · round 1 · the temple gateway landmark (OP12, 2026-11-03, sp-o1)

The plot's signature landmark: a monumental ruined sandstone temple gateway over the plaza centre, which the player walks
through. Two fluted drum columns on stepped plinths carry a broken lintel of big ashlar blocks, with fallen blocks at
their feet, in weathered pale gold sandstone with sun-bleached tops. It is big (40 m tall, 44 m wide) because the
golden-view scores (`art/open-plots/golden-2026-11-03/README.md`) found every built landmark too small. Look target:
round 62's `art/grid/round-62-open-plot-palettes/14-desert-ruin.jpg` (harsh white-gold noon, bleached sand, deep blue
oasis).

| File | What |
|---|---|
| `crop-r62-road.jpg` | Round 62's road-entry panel: the mockup |
| `crop-r62-plaza.jpg` | Round 62's plaza panel, under the gateway |
| `ref-gateway.jpg` | The reference (codex `image_gen` from both crops): the whole gateway, three-quarter view, on a plain backdrop |
| `board.jpg` | The pick: the three takes (`scripts/img2mesh/ab_board.py`, same light and cameras), near models over far models |

## Takes

The generations and posts are scratch in `~/ml/img2mesh/out/gateway-*`. A and B were posted with
`scripts/img2mesh/build_props.py` to 40 m, near ~15k and far 2.5k, on a 512 atlas (256 far), smooth (hard past 40°).

- **A · Hunyuan3D 2.1** on a BiRefNet cutout of the reference (`--up x180`): 15.0k near (321 KB), 2.5k far (75 KB). It
  has the reference's likeness: round columns, a capital ring, a ragged lintel stepping up on the left. Its 512 texture
  is soft over 40 m, it has dark tears at the plinths, and it keeps the reference's thin stone footing frame, a lip
  across the walk.
- **B · TRELLIS.2** on the same cutout (`--metal-off`): 15.0k (396 KB). It is greyer and blotchier than A. Its far take
  tears into shards at 2.5k (104 KB).
- **C · the Blender script** (`scripts/blender/open-plots/gateway.py`, on `landmarklib.py`): 4.9k near (85 KB), 612 far
  (13 KB). It has two 16-flute columns of six drums, each drum a little off true, with chamfered joints. They stand on
  two-step plinths of chamfered blocks under a flared echinus and a square abacus. The lintel is three courses of
  chamfered ashlar, two rows deep with staggered joints: the lower course spans whole with a broken ledge on it, the
  middle misses a block, and the top course stands over the left column with a lower stack on the right. A few blocks
  are chipped, proud or sagging. Ten fallen blocks lie at the column feet, clear of the walk. Up-facing faces are
  bleached cream and the sides are gold, warm and ochre.

## The pick (G872: decided on the recommendation)

**C, the Blender script, ships** (`public/assets/open-plots/desert-ruin/landmark.glb`, `landmark-far.glb`; build:
`bash scripts/blender/build.sh open-plots/gateway`). It is the only take with crisp, chunky block edges in the close-up,
which is the blocky look the other plots share. Its far model is clean (the same masses as plain blocks and 12-sided
shafts), so the coarse stand-in and the collider stay clean. Nothing lies on the walk between the plinths. It costs
98 KB in all against the 0.8 MB bar, a quarter of A's 396 KB. A was second on likeness. B's far model is torn.

Model space (glTF, before the layout's `turn`): 40.1 m tall (the lowest point is the ground, so nothing sinks below
`stand()`'s y = 0), x −22.2…22.3, z −9.9…9.7 (the fallen blocks; the plinths are 12 m deep, z ±6, and the lintel is
10.8 m, z ±5.4). **The opening faces ±Z: the walk passes through along glTF z.** It is 20 m wide between the plinths
(x ±10), 22.4 m between the shafts and 20.4 m under the abacus. The lintel's underside is 28 m (27.9 m under a
sagging block). The middle course tops out at 35.6 m, and the top course reaches 40 m over the left column (−x).

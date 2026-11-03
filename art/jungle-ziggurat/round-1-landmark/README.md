# Jungle Ziggurat · round 1 · the temple pyramid landmark (OP13, 2026-11-03, sp-o1)

The plot's signature landmark (docs/plans/OPEN-PLOTS.md §4b, Jungle Ziggurat): a stepped pyramid on the central plaza,
cinnabar-red tiers with turquoise and saffron bands, a cream stair, and a flat-topped temple house with a roof comb on
top. It is freshly painted and intact (no moss, no ruin, no glow) and big: 55 m tall on a 70 m base, because the golden-view
scores (`art/open-plots/golden-2026-11-03/README.md`) found every built landmark too small. Look target: round 75's
`art/grid/round-75-new-plot-palettes/02-jungle-ziggurat.jpg`.

| File | What |
|---|---|
| `crop-r75-road.jpg` | Round 75's road-entry panel: the mockup |
| `crop-r75-plaza.jpg` | Round 75's plaza panel, the pyramid through the plaza gate |
| `ref-ziggurat.jpg` | The reference (codex `image_gen` from both crops): the whole pyramid, three-quarter view, on a plain backdrop |
| `board.jpg` | The pick: the three takes at the shipped budget (`scripts/img2mesh/ab_board.py`, with the same light and cameras), near models over far models |

## Takes

The generations and posts are scratch in `~/ml/img2mesh/out/ziggurat-*`. A and B were posted with
`scripts/img2mesh/build_props.py` to 55 m, near ~18k and far 2.5k, on a 512 atlas.

- **A · Hunyuan3D 2.1** on a BiRefNet cutout of the reference (`--up x180`): 18k near (249 KB), 2.5k far (69 KB).
  It is the closest to the reference: five tiers, a stair, the temple with its glyph panel, comb and feather fans. Its
  512 texture is soft over 55 m, so the frets blur in the close-up. The flat-shaded post (`--smooth-angle 0`) looks the
  same but costs 658 KB, so the smooth post (hard edges past 40°) is the one on the board.
- **B · TRELLIS.2** on the same cutout (`--metal-off`; without it the bake comes out black): 17.8k (500 KB). It is
  blotchy, with dark tears on the stair. Its far take does not reach 2.5k (6.5k plain, torn to shards when remeshed).
- **C · the Blender script** (`scripts/blender/open-plots/ziggurat.py`, on `landmarklib.py`): 9.0k near (140 KB), 2.4k
  far (42 KB). It has a cream base course, five cinnabar tiers with cream caps and alternating saffron/turquoise
  stepped-hill frets, a 70-step cream stair between balustrades, and a red temple with a dark door, turquoise square
  spirals, a carved panel, a fret cornice, a four-opening comb and two feather standards.

## The pick (G872: decided on the recommendation)

**C, the Blender script, ships** (`public/assets/open-plots/jungle-ziggurat/landmark.glb`, `landmark-far.glb`; build:
`bash scripts/blender/build.sh open-plots/ziggurat`). It is the only take with crisp painted tier edges and frets in
the close-up, the blocky look the other plots share. Its far model is the same masses with one block per fret and a
ramp for the stair, so the coarse stand-in (drawn in its texture's colours) and the collider stay clean. It costs
183 KB in all against the 0.8 MB bar, about half of A's 318 KB. A was a close second on likeness.

Model space (glTF, before the layout's `turn`): 55 m tall, x −35…35, z −35…40.2. The stair runs up **+Z**, and its
foot stands 5.2 m proud of the 70 m base course. The top platform is at **35 m**, 36 m square. The temple's door faces +Z,
and the two feather standards stand at x ±15.6, z +15.6. `stand()` centres the bounding box, so the pyramid's body sits
2.6 m behind the plot centre (away from the stair).

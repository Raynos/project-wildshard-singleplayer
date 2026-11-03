# Ember Forge · round 3 · the furnace landmark (OB4, 2026-11-03, sp-o3)

The plot's signature landmark (docs/plans/open-plots/build-out-mini-plan.md, Ember Forge): the forge furnace hall, about
35 m, with four glowing chimneys and a great lit door. Look target: round 62's
`art/grid/round-62-open-plot-palettes/17-ember-forge.jpg`.

| File | What |
|---|---|
| `crop-r62-road.jpg` | The furnace cropped from round 62's road-entry view: the mockup |
| `ref-furnace.jpg` | The reference (codex `image_gen` from the crop): the whole hall, three-quarter view, on a plain backdrop |
| `board.jpg` | The pick: three takes at the shipped budget (same light and cameras, `scripts/img2mesh/ab_board.py`), then in game, the shipped take C against A at the road entry, 100 m and the plaza |

## Takes

The generations and posts are scratch in `~/ml/img2mesh/out/ember-furnace-*`.

- **A · Hunyuan3D 2.1** on a BiRefNet cutout of the reference: 20k near, 2.5k far. It has the arched door, the steps,
  the stone trim, the lit stacks and the blue lamps: the closest to round 62.
- **B · TRELLIS.2** on the reference: 17.5k / 2.5k. It came out grey and blotchy, with no lit door.
- **C · the Blender script** (`furnace.py`, shipped from `50e156f0d8`, retired with this pick, in git history): 15k /
  2.4k. Clean, but a flat black box in game.

## The pick (G872: decided on the recommendation, approved by wildshard-new)

**A, Hunyuan3D 2.1, ships** (`public/assets/open-plots/ember-forge/landmark.glb`, `landmark-far.glb`), 35 m tall, turn
2: its door faces the south road. Its source record is `scripts/img2mesh/props/ember-furnace.json`. The atlas is 512 px:
1024 cost 1.28 MB of phone wire, and 512 costs 0.60 MB. The dusk landmark graph lights its door and stack mouths
through their warm texels. Credits: `public/assets/open-plots/CREDITS.md`.

## From the road (`board-road.jpg`)

Past 150 m the furnace drew as its coarse stand-in in the kit's standard material: a dark silhouette from the road entry,
at 200 m and from above the neighbour (bar 1). The row's `coarseLandmark: "lit"` (as the Night Market's) draws it in its
own dusk landmark graph with no texture, so its stone trim, stacks and lit door read from the road. The four plaza L1
tiles draw 3 instead of 2 (approved, wildshard-new); road entry 106 to 114 draws; phone wire 4,291,954 to 4,284,102 B.

## Life at the road entry (`board-life.jpg`, bar 7)

sp-x1's live check found no motion at the furnace from the road entry. The forge courts' smoke and sparks are 12-40 cm
and sit in tiles the road sees only as coarse stand-ins. The layout now marks the furnace's four stack mouths
(`landmark.stacks`, plot metres, read off the model), and the plot adds two things over each mouth:

- smoke, near only (the Pool draw);
- a 6 m column of 0.5 m embers in Glow, which the coarse tiles keep. They use the glow graph's steady sky-lantern mode:
  always lit warm orange and drifting, never blinking to black. The firefly mode turned half of them into soot specks.

`scripts/open-plots/life-capture.mjs` at the road entry: the stack embers change 190-210 px per 500 ms (0 before), the
furnace lamps 260-300 and the cranes 2-20. That gives two distinct visible sources, embers and lamp flicker.
Phone wire +5,564 B; three plaza tiles grow 1-2.5 KB (standing rule).

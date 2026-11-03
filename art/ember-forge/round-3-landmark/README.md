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

**Gap kept:** past 150 m it is the coarse stand-in, dark from the road entry. The Night Market fixed the same gap
with `coarseLandmark: "lit"`, at one more L1 draw in each of the four plaza tiles.

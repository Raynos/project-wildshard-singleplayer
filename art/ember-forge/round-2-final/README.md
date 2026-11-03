# Ember Forge · round 2 · the final board (OB4, G983, 2026-11-03, sp-o3)

`board.jpg` is OB2's bar-5 three-way board (`scripts/open-plots/ob2.mjs board`). It shows the four round-62 hero
cameras (above the neighbour, road entry, top-down, plaza) as MOCKUP · PLOT NOW · NIGHT MARKET NOW. Both NOW columns
are captured from one HEAD build, `837135050d`, on the phone tier at 2x as an iPhone 16 Pro, with matching cameras.
`board.jpg.json` holds the input hashes, crops, pins and cameras.

## Where it stands after the look loop (art/ember-forge/round-1-look-loop/)

- **Matches round 62:**
  - the deep-blue night;
  - the furnace hall in charcoal basalt under four stacks, its door lit;
  - the lava moat framing the plaza, bridged where the avenues cross;
  - forge courts and ore yards round it;
  - cold blue lamps along every path.
- **Remaining gaps:**
  - **Scale.** Round 62's furnace fills the road and plaza views. Ours (35 m, as the plan sets) stands small on a
    125 m plaza.
  - **Density.** The cell spreads its yards wide, and from afar their stand-ins read as dark boxes.
  - **The door's peach.** It is peach, not molten orange.
  - **The sky.** No stars, smoke trails or paving reflections.
  - **No image-to-3D takes yet.** The Hunyuan3D / TRELLIS furnace takes wait on the model lane (sp-ci-deploy's START).
    The furnace is sp-o2's script take until they land on a landmark board.
- **Numbers (Chromium, phone tier):**
  - Road entry: 106 draws, 207k triangles.
  - Plaza: 108 draws, 288k triangles.
  - Phone wire: 3.69 MB (its ceiling). No tile debt.

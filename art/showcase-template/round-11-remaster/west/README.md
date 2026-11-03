# Round 11 remaster, west + map shots (v2)

Kitchen Sink v2 (Showcase Template) mockups for the west half and the map: w01–w13, m01–m07, iPhone portrait, each
with its id, title and caption burned in on top (`finish.mjs`, ≤ 250 KB JPEG).

v2 (Jake, 2026-11-03): the v1 frames were "poisoned by the gray blockout" (size stencils like 1x1 / 4x8, dev grids,
placeholder boxes). Jake then judged most of v1 good and asked to "push it a bit harder", so v2 has three kinds of shot
(`mode` / `keep` in `shots.json`):

- **polish** (w01–w06, w09–w13, m05, m07): the v1 mockup edited with codex `image_gen`: composition, camera,
  characters and UI kept; every stencil, dev label and grid removed; materials and finish pushed per
  [../COMMON-v2.txt](../COMMON-v2.txt). Prompt = COMMON-v2 + `polishNote` + the shot's `screen`.
- **fresh** (w07, w08, m02, m03): made from the grey frame (`<id>-grey.jpg`) used only as the layout guide (camera,
  horizon, where each mass sits), the look per COMMON-v2. Prompt = COMMON-v2 + `screen`.
- **keep v1** (m01, m04, m06): the top-down map and BAG > MAP frames, kept as they were.

`<id>-grey.jpg` are the round-4 blockout frames (`grey.mjs`). Every v2 shot was a first take; none needed a re-roll.

**Round 5 redo (11-03):** m03 is redone fresh on `../../round-5-blockout/` (its `"blockout"` in `shots.json`; the
camera re-aimed a little south so the whole SE bottom shows): the three gauntlet courts and the small Titan gate with
its portal arch, no surface Titan amphitheatre. First take. `finish.mjs` now keeps a frame's own aspect (image_gen
returned a tall frame) and takes `OUT=<dir>`.

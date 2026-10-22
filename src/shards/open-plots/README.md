# Open plots

SF88g (G538, G539, G541, G542, G545): the grid's open plots as one source shard that emits one shardfile product per
idea. There is no runtime code: the shard is data rows and one build-time generator.

- `outputs.json`: one row per idea (product slug `open-plot-<idea>`, the idea's asset folder, display name, accent, and
  the overrides its manifest makes to `manifest.json`). The platform reads it through `scripts/shard-outputs.mjs`: discovery
  writes `discovery.<slug>.generated.ts`, `scripts/build-shardfiles.mjs` builds each output to `out/<slug>` with
  `wildshard build … --output=<slug>`, and `shard.config.ts` exports the declaration of every output (`outputs`).
- `generators/bake-plots.mjs` (generation job `open-plots-world`, cheap build-time outputs) writes each idea's
  `assets/<idea>/world.glb` (git-ignored): a 500 m plot floor with a kerb broken by four entries, a low round plinth
  (radius 10 m) with a cyan rim, the idea's hologram standing on it, the billboard behind it, the 'OPEN PLOT · COMING
  SOON' sign and a striped beacon in each corner with a cyan sky beam; then each output's data map. The world bake turns a plot into tiles, collision (only the `collide_` nodes,
  never the hologram), edges, a far proxy and the plot's own near view (`near: 'coarse'`).
- `data/plot.json` (G608): the hologram's scale (one value; Jake picks it on art/grid/round-37-open-plot-scale), the
  beams' heights and the floor's accent tint. The hologram and the beams are light (additive), so the generator also
  writes `far_` stand-ins (the hologram welded, a glowing box up each beam) that only the far proxy and the near
  view draw; the far bake simplifies them into the far budget.
- Each idea's inputs live in `public/assets/open-plots/<idea>/`: `billboard.webp` and `sign.webp` (with the card in
  `thumbs/<idea>.jpg`, `scripts/open-plots/make-art.sh`) and `hologram.glb` (Hunyuan3D-2 full, 8k triangles, 12 m,
  meshopt: `scripts/open-plots/gen-refs.sh`, `batch-holograms.sh`, reviewed with `clay-review.mjs`).
- `data/hologram.graph.json` is the ONE hologram shader (G545), a look row on the material graph host: unlit, additive,
  fresnel rim `pow(1 - |n·v|, 2.2)`, alpha `0.07 + rim × 0.7`, world-Y scanlines and a slow upward sweep, 28° feature edges
  at 0.55 and a 0.07 wireframe (both decoded from the generator's per-corner edge code in the vertex colours), colour
  `#46e6ff`, drawn at every distance (G607). Its vertex stage turns the hologram slowly about the plinth's axis.
- `data/beam.graph.json` draws the corner beams (G539): additive cyan, thinning with height to `data/plot.json`'s beam
  height (G608, its twin lower), drawn at every distance (G607): every plot's beams read across the 5 × 5.

On the 5 × 5 (G538, P7): every open cell of `src/game/grid/singleplayer.json` is an `open-plot-<idea>` output, entered
over the road like any shard cell, with its baked far proxy and impostor in the shared far tier; all 14 ideas stand on the
grid. In SHARD SELECT every output is behind Developer.

# Open plots

SF88g (G538, G539, G541, G545): the grid's open plots as one source shard. There is no runtime code: the shard is data
rows and one build-time generator.

- `data/ideas.json`: one row per idea (id, display name, accent). P1 emits the first row, Ember Forge; SF88g P2 emits
  one output (`open-plot-<idea>`) per row.
- `generators/bake-plots.mjs` (generation job `open-plots-world`, a cheap build-time output) writes `assets/world.glb`
  (git-ignored): a 500 m plot floor with a kerb broken by four entries, a low round plinth (radius 10 m) with a cyan rim,
  the idea's hologram standing on it, the billboard behind it and the 'OPEN PLOT · COMING SOON' sign. The world bake turns
  it into tiles, collision (only the `collide_` nodes, never the hologram), edges and a far proxy.
- The idea's inputs live in `public/assets/open-plots/<idea>/`: `billboard.webp` and `sign.webp`
  (`scripts/open-plots/make-art.sh`) and `hologram.glb` (Hunyuan3D-2 full, 8k triangles, 12 m, meshopt:
  `scripts/open-plots/gen-refs.sh` then `scripts/open-plots/batch-holograms.sh`).
- `data/hologram.graph.json` is the ONE hologram shader (G545), a look row on the material graph host: unlit, additive,
  fresnel rim `pow(1 - |n·v|, 2.2)`, alpha `0.07 + rim × 0.7`, world-Y scanlines and a slow upward sweep, 28° feature edges
  at 0.55 and a 0.07 wireframe (both decoded from the generator's per-corner edge code in the vertex colours), colour
  `#46e6ff`, fading out from 300 to 850 m. Its vertex stage turns the hologram slowly about the plinth's axis.

Behind Developer: SHARD SELECT (Developer on) and the 5 × 5 cell (+2, −1), in place of that plot's game-layer billboard.

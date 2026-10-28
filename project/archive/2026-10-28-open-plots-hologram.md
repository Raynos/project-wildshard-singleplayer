# Open plots and holograms: mini plan for the builder (G546)

Jake, 2026-10-20: *"Code generation, including open plot, should be given to the builder. You should not be generating …
ideas yourself in a sub agent. That should all be going to the builder. Hand over a mini plan to the builder for that."*
The plan agent's overnight hologram subagent was stopped before any model ran; everything below is the builder's.

Decisions: G538 (every 5 x 5 cell is a shardfile; one `open-plots` source shard), G539 (slug, far impostors, fading
beams), G541 (billboard + holo blockout), G542 (one hologram generator per idea, each output bakes only its own), G545
(the approved flow). Pilot: `art/grid/round-31-hologram-pilot/` (board, renders, `ember-forge.glb`, Hunyuan full 8k).

## What exists

- **Pilot tools** in `./tmp/holo-pilot/` (git-ignored; promote what you keep into the repo, e.g. `scripts/open-plots/`):
  `gen-refs.sh` + `holo-subjects.tsv` (single-object references via codex `image_gen`, the localai recipe plus "thin parts
  stand clear of the body"), `gen.sh`, `overnight.sh` (syntax-checked, never run), `holo_post.py` (hologram post: metres,
  +Y up, pivot at base centre, front +Z, small islands dropped, no material/UV), `index.html` + `capture.mjs` (three.js
  clay / hologram / road preview via `browser-lane.sh`), `make-jpgs.sh`.
- **References made (8 of 14)** in `art/grid/round-30-hologram-refs/`: ember-forge, showcase-template, thin-ice,
  frostline-peaks, lantern-bayou, sky-harbor, coral-drift, clockwork-canyon. **Missing (6):** starfall-observatory,
  mosslight-ruins, alien-plain, desert-ruin, night-market, sky-race (descriptions in `holo-subjects.tsv`).
- **Billboard art:** `art/grid/round-27-billboards/` (10 new) and `public/assets/grid/open-plot/` (alien-plain,
  desert-ruin, night-market, sky-race).

## Rows

| Row | What | Effort (est.) |
|---|---|---|
| **P1** | **Done** `0cb415a5f8` (fixes `3109920991`, `3d3321ea96`, `c2bfcffc33`, `be3564c365`; capture `art/grid/round-31-open-plots-shard/ember-forge-on-plot.jpg`). **Playable `open-plot-ember-forge` first**: `src/shards/open-plots/` from `_template`, a build-time generator emitting the output, walkable plot + 4 entries, billboard, plinth radius ~10 m, the pilot hologram turning with the G545 shader, the 'OPEN PLOT · COMING SOON / EMBER FORGE' sign; behind Developer; reachable from SHARD SELECT and its 5 x 5 plot; 0 custom TS; push and send the plan agent the SHA | 3–5 h |
| **P2** | **Done** `aaaef1c638` (batch check PASS incl. open-plot-ember-forge and open-plot-sky-harbor first frames; `outputs.json` + `scripts/shard-outputs.mjs`: one product per idea; ruler census `8e5bfc25ac`, product keys on the validator revision `9bed83c7b2`). The generator emits one shardfile per idea from a data table (14 G529 ideas + the inner open plot), each with its own billboard and hologram only | 0.5 day |
| **P3** | **Done** `f01a9d2c9a` (all six read: one object, plain background). References for the 6 missing ideas with `gen-refs.sh`; read every image; reject any with scenery, ground or several objects | 0.5 h |
| **P4** | **Done** `0592ff0be4` (13 GLBs, 8k tris, 12 m, ~165 KB; tools in `scripts/open-plots/`). Hunyuan3D-2 **full** shape (30 steps, octree 512, no paint) on the 13 remaining references via `overnight.sh`: cutout → batches of 7 under the model lock (~25 min holds) → `holo_post.py --tris 8000 --height 12 --yaw 0` → `gltf-transform optimize --compress meshopt`. Not TRELLIS.2 (its crust can't reach budget). ~3.5 min of model time per idea, ~50 min total | ~1.5 h with renders |
| **P5** | **Done** `0592ff0be4` (`scripts/open-plots/clay-review.mjs`; all 14 pass, none regenerated; `23656e4e73` fixes the meshes' mixed winding in the generator). Review each from a clay render at yaw 35: recognisable silhouette and key parts, one closed piece, no big holes or melted blobs; regenerate failures once (new seed or the turbo model) | 0.5 h |
| **P6** | **Done** `be813c67e0` (`art/grid/round-32-holograms/board.jpg`, path sent). A labelled board of all 14 holograms (`art/grid/round-32-holograms/board.jpg`) for Jake in the morning; send the plan agent the path. No approval needed before integrating (Jake, G545) | 0.5 h |
| **P7** | **Done** `8c66aabf27` (corner beacons + beams in their own `beam` graph: capped at 60 m, fading 300-850 m) + `8076aec207` (all 19 open cells of `singleplayer.json` are `open-plot-<idea>` cells, all 14 ideas in every mode; far proxy + impostor through the shared far tier). Batch check PASS on check2 (types, lint, 144 test files, ember-forge + sky-harbor first frames); 5 x 5 outer-road drive at `8c7861b926`: complete, 0 reloads, 0 stuck (frame floor fails on 11 long frames, max 317 ms: O11's); ruler exit 0 with `open-plots` one row. All 14 outputs on their 5 x 5 plots with far proxies and baked impostors (G539), beams height-capped and fading | 1 day |
| **P8** | **Done** `8b4ddf5a3b` (net -671 game lines: `plotCells.ts`, `plotCellLayout.ts`, the catalogue's plots, `GridPlot`, session / live-session plot paths, plot strings, the 14 runtime billboard webps; the four G529 originals moved to `art/grid/round-27-billboards/`). Delete the game-layer plot code (`game/grid/openPlot.ts`, `openPlotLayout.ts`, ~586 lines) once every plot is an `open-plots` output | 0.5 day |

GLBs go under `public/assets/open-plots/<idea>/` (≤ 1 MB each; the meshopt 8k is ~166 KB). Keep only one local model
running at a time machine-wide.

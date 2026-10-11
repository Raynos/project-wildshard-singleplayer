# Main-menu hero: eight real engine candidates

G334, 2026-10-11. [Candidate board](board.jpg). Recommended candidate:
**G, Driftwood's pier**. It shows a playable place clearly; the grid views
document the actual current boulevard and its distant proxies.

Captured from clean HEAD `27fc24fb5`, build `27fc24f-mv4glb7b`, as muted
iPhone 16 Pro portrait, Developer on, phone tier and 2× render scale.
All eight captures completed with no reported page errors. Every JPEG is
1179×2556, at most 500 KB, with burned-in title, candidate and pose labels.
The full-size images and board have all been visually inspected.

| Candidate | Full-size image | Visible pose |
| --- | --- | --- |
| A | [Grid road](A-grid.jpg) | Road spoke at the crossroads |
| B | [Second spoke](B-grid.jpg) | Crossroads facing a second spoke |
| C | [East boulevard](C-grid.jpg) | Crossroads facing east |
| D | [Raised corner](D-grid.jpg) | Island from the raised template corner |
| E | [Template block](E-grid.jpg) | Elevated view of the template block |
| F | [Junction island](F-grid.jpg) | Island above the junction |
| G | [Driftwood pier](G-driftwood-isle.jpg) | Standalone spawn on the pier |
| H | [Pine road](H-pine-hollow.jpg) | Standalone forest-road spawn |

Only the camera position and direction are held, using look28's entry and
pose API. The clock runs live. The renderer canvas is captured; DOM HUD is
hidden. Weapons remain in the actual scene. No scene object, light,
material, colour grade or quality setting was changed for a screenshot.
Existing painted textures and sky imagery remain where the game uses
them: these are engine screenshots, not a claim that every underlying
asset is free of image-model provenance.

The catalogue is spread across real grid cells, rather than a compact
3×3. D–F show distant proxies and existing edge artifacts faithfully;
they are not recomposited or retouched. H faces the forest road, not a
cabin. The scalar [capture summary](capture.json) keeps the requested
poses and actual player positions.

Reproduce from the repository root, outside another lane's quiet window:

```sh
node scripts/capture-main-menu-hero.mjs --out=/absolute/scratch/captures
uv run --with pillow python scripts/main-menu-hero-board.py \
  /absolute/scratch/captures art/main-menu-hero/round-1-in-engine
```

The command owns its clean `serve-build.sh --head` preview and a single
muted `browser-lane.sh` browser, then closes both. The capture window
released at 23:38:05 UTC. The shipped hero is unchanged; these candidates
await Jake's pick. No G333 Debug rows or other image replacements exist.

# op-sky43: the other shards' cells against SHARD SELECT (SHARD-PLATFORM G321 part 4, E435, 2026-10-10)

Captures: muted Metal iPhone 16 Pro portrait, phone tier, 2×, Developer on, Memory saver on, DEVSERVER builds
(`serve-build.sh --devserver`): **before** = HEAD `45e65b740`, **after** = candidate `a56fb51bd` (HEAD + this change).
`capture.mjs` is op-sky40's with a second shot 40 m above the pose (`HIGH=40`: the horizon past the shard's own ground),
the grass maps' checksums and ring instances, what stands outside the cell (`PROBE=far`) and the no-IBL probe
(`PROBE=env`). `sheet.py` makes the boards. 0 page errors and 0 console errors in every shot.

## What differed, and the fix

| shard | difference | cause | fix |
|---|---|---|---|
| Nalati, Nine Dragon | the road's void floor stayed on their horizon (readout before: `grid-void-floor` drawn, no region sky) | the frame counts a region's horizon only when it hangs a backdrop layer; both draw their own sky in their world | generic: `SkyDressing.ownSky` (engine `render/look.ts`): a level whose world draws its whole sky declares it; its cell hangs a weight-only sky on the frame (`regionalWorld.ts`), so its sky owns the horizon as a backdrop does. Nalati (`look/air.ts`) and Nine (`look/render.ts`) declare it. After: void floor not drawn inside either cell |
| Signal Dunes | the road deck and the neighbours' far shapes stood on its horizon | nothing outside the cell faded by the owner | generic `grid/horizonFade.ts`: what stands outside the owning cell (road deck, seams, curtain, boulevard, rail; neighbours' far proxies, haze bands, ring tiles) dithers out by the frame's sky share from 60 m to 140 m in front of the camera (one discard, the void floor's dither). A lit material tests the fragment's world position against the owning cell, so a ring tile's family material shared with a live cell never thins that cell. On the road (share 0) nothing changes |
| Nalati | a dark misplaced wedge of static shadow in the valley (`-high` before), no contact shade on its grass | its static bake (`look/bake.ts`) baked at the page origin, its grass read it in local coordinates | shard-local: the bake's cameras and contact map stand at its scene's world position; grass and terrain read both at world positions (`runtime/shaders/grassGlsl.ts`, `lookBakeGlsl.ts`). Standalone unchanged (origin 0). Nalati's physics bake regenerated (shader files are its inputs; colliders byte-identical) |

Boards (SHARD SELECT · grid before · grid after, same pose; second row 40 m up): `sunscar-dunes-board.jpg`,
`nalati-grasslands-board.jpg`, `nine-dragon-stack-board.jpg`, `others-board.jpg` (Driftwood, Pine re-check).

## Still different (measured, not fixed here)

- **Nalati's darker grass and ground: its image-based light.** Standalone it lights with its painted sky's PMREM
  environment at intensity 0.6; its grid cell has none (readout `envMap: null`; it has no backdrop, so nothing carries its
  default sky's environment). SHARD SELECT with the environment removed (`PROBE=env`) darkens the ground band from
  126 → 110 (grid: 113). The grass maps, ring instance counts and field are identical in both (checksums). Nine Dragon
  has the same gap (standalone env 0.5). Fix: carry a backdrop-less level's default-sky environment into its cell (swap at
  half weight, as a backdrop layer does), admitted on its sky claim; a memory change, so default-off behind a Debug row.
- **Signal Dunes' far ridge:** SHARD SELECT draws its own horizon rings (`ShardManifest.horizon`) behind the dunes; a grid
  cell builds none (G99: the horizon yields in the grid), so its painted dome's peaks show there instead.
- **Pine Hollow:** the cell's chain has no `GodRaysEffect` (SHARD SELECT 0.9) and its ground reads greyer and cooler.
- **Driftwood:** matches.

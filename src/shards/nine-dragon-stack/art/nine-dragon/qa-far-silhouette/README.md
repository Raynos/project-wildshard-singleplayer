# Nine Dragon Stack's far silhouette from Desert Ruin (sp-o1, 2026-11-03)

`desert-ruin-views.jpg`: Desert Ruin's golden views 1 (road entry), 2 (road, 40 m up) and 5 (plaza), each looking north
toward Nine Dragon Stack (cell 1,-1; Desert is cell 1,-2, instance `open-plot-3-0`). Build `9ca23a5de4-mw14j8qh`, a
working-tree preview on `9ca23a5de4` carrying Desert's activation as later landed (`cad1dbd0a2`). Captured through
`art/open-plots/golden-2026-11-03/capture.mjs` (iPhone 16 Pro 402 x 603, phone tier 2x, midday clear, seed 357, normal
grid route, plot-local golden camera onLate).

What you see: a grey mass of Nine's towers hangs in the sky behind the gateway, with no ground under it and a dark spire
down its middle. It stands above the horizon in every view looking north, at about 8–12° over the road's horizon.

Poses (world metres; from `art/open-plots/golden-2026-11-03/desert-ruin/cameras.json`, hfov 62°, world fov 84.06°):

| view | player feet (plot-local x, z) | eye | look |
|---|---|---|---|
| 1 road entry | (0, -238) | (562.5, 1.7, -1417) | (562.5, 10, -1125) |
| 2 road 40 m | (0, -238) | (527.5, 41.7, -1422) | (562.5, 0, -1215) |
| 5 plaza | (0, -60) | (562.5, 1.7, -1185) | (562.5, 16, -1125) |

Nine's instance is `nine-dragon-stack` at cell (1, -1), origin (562.5, -562.5). The preview is stopped and no
diagnostic state was kept. sp-x1's trace names the cause (Nine's near.glb carries the elevated +125 m fragment while
`near.owns` suppresses the grounded far.glb).

## Before / after (sp-o3's stack base, 2026-11-03)

`before-after.jpg`: Desert's views 1, 2 and 5 again. BEFORE is `09ee58a-mw15fhmi` (a `--rev` of `09ee58aa8c`, the floating
near.glb). AFTER is `300a65548b-mw15l2a1`, sp-o3's working-tree candidate on `300a65548b` whose near.glb carries the stack
base. Verdict: green. In AFTER the towers stand on a dark stack base that reaches the ground in all three views and no
longer float, and Desert's own plot is unchanged.

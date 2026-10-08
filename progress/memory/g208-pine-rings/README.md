# G208: Pine charged by streaming rings, the renderer half (E435)

Census: served HEAD `be4c27711` (build `be4c277-muytjp7n`), one muted headless Chromium on Metal, iPhone 16 Pro
portrait, phone tier, Developer ON, standalone Pine (memory trim at its default) 20 s after entry.
`src/game/grid/runtimeRenderPreflight.ts`, bundled as an IIFE, classified `game.scene` in the page
([standalone.mjs](standalone.mjs)). Labelled GL at the same moment: 232.4 MB textures, 43.1 MB buffers.

| Class (preflight, JS + GPU) | MB | What it is |
|---|---:|---|
| Cell-wide drawables + their resources (`always`) | 318.5 + 6.4 | the 500 m one-mesh terrain and its PBR arrays, the sky dome, the instanced forest, every batched / instanced prop set |
| Shared dependencies (33 chunk sets) | 199.6 | textures and geometry used by more than one L1 tile |
| L1 chunks (16 tiles) | 137.2 (69.1 GPU) | position-bound meshes and their single-tile resources |

Render targets (68.2 MB GL), PMREM, shadow maps, sim JS and WASM aren't in the scene, so they stay in the residual. The
JS side of the texture figures assumes that decoded sources are retained, which overstates them. That's safe for a floor
but isn't a census.

**What rings can charge less.** With L1 at 400 m (G120), the rings want all 16 Pine tiles anywhere inside Pine or on
its edge, so **0 MB is saved where Pine's gap is** (its border with Driftwood). On the road they save 49 MB at 50 m
outside the edge, 72 MB at 150 m and 121 MB at 250 m. The gap is ~650 MB against the shipped 805 MB images-first claim,
or ~300 MB against a G187-pin claim. G208's accounting fix can't close it. Per SF47, the next step is the board of the
remaining measured candidates (or a same-pin claim refresh plus releasing the home while Pine is entered: sp-x2's area).

[plan.json](plan.json) keeps the classified plan. `test/grid-runtime-render-preflight.test.ts` reconciles it through
`compileRuntimeRenderPlan` (sp-x2): the full inventory equals the measured whole, and the claim is refused against the
shipped measurement because the pins differ.

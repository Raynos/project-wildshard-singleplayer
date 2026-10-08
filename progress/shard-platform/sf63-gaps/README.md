# SF63 gaps: the five differences left after G232 (SHARD-PLATFORM, E435)

The boards show SHARD SELECT, the grid at G232 (`0225625c4`; its "after" column) and the grid with this change, at the same
shard-local poses. The grid captures are real drive-ins (`drive.mjs`), iPhone 16 Pro portrait, muted, Developer on, one
browser through `scripts/browser-lane.sh`. They ran on a build of this source over `65106ea87`.
`probe.mjs` reads the chain a boot runs (passes, effects, knobs).

| Gap | Finding | Fix | Result |
|---|---|---|---|
| 5. Nalati's grass density | Nalati's GPU grass placed its tiles around the **page** camera, but it draws inside a cell offset by (555, 0). So it sampled its field, mask and height maps 555 m off and fogged every blade as if it were 555 m away | `look/grass.ts`: the CPU tile placement puts the camera into the grass group's frame, and the frustum boxes go back into the page frame. The three vertex shaders read the camera through `modelMatrix` and write world positions through it. Standalone the offset is zero, so nothing changes there | Rings now draw 30.9k / 48k / 36.3k blades, plus 19k flowers and 400 cards. The grass is tall and green with flower drifts, as standalone (`nalati-inside-e.jpg`, `nalati-entry-road-e.jpg`). The player position is already region-local, so `Grass.update` stays as it is |
| 3. Bloom settings | Not carried | `chainKnobs` (`frame.ts`): inside the cell, bloom intensity and threshold come from the region level's grade, and its look layer's grade goes over that. They are lerped from the page's values by the owner weight. All of this is uniforms, and the page's values come back when the region leaves | Pine: bloom 0.4 / 1.0 becomes 0.55 / 0.85 (`frame.chain.post`) |
| 1. The post chain | The premise was wrong: the page shell is **clean** (`emptyLook`), not cinematic. The page and Driftwood run the same chain. Driftwood's knobs are identical (bloom 0.4 / 1.0 / 0.08, vignette 0.35, FXAA). Pine, on the other hand, runs cinematic | `ENGINE_CHAIN_TUNING` (`render/look.ts`) is the per-kind knob table that `Game.buildComposer` builds from. A look declares its chain with `ExtendLook.chain`: Driftwood, `dataLook` and `emptyLook` declare `'clean'`, and with no declaration it is cinematic. Game builds the declared kind first, so a compose that asks for the other kind throws. Inside the cell the carried chain sets bloom smoothing and vignette darkness | Pine: smoothing 0.08 becomes 0.3 and vignette 0.35 becomes 0.55. Driftwood: unchanged, because there was nothing to change |
| 2. Pine's clock (rays, volumetrics) | The clean page chain has **no volumetrics effect at all**, and on the phone no god rays either. So there is nothing for Pine's clock to drive | `FramePost.rays` hands the page's god rays to the region's clock where the page has them (desktop), and the clock's writes are kept. Volumetrics stay `NO_VOL` | **Open by design:** carrying Pine's volumetric shafts, chromatic fringe and grain means adding effects to the page's colour pass. That is a recompile, plus the volumetric march and its targets, scoped to Pine's residency. It is a cost and memory decision for the plan, not a uniform carry |
| 4. Driftwood's cumulus ring | Its layered dome stayed at the page origin. Nothing kept it on the camera the way the page keeps `sky.clouds` | `BackdropLayer.apply` keeps `backdrop.clouds` on the camera (`skyDome` 0 m). The domes stay owned by the resident scope (sp-x1's `c2623699a`) | **Still not visible** (`driftwood-entry-w.jpg`). The ring now follows the camera but is still hidden. The next suspect is depth or draw order against the grid's far geometry: in the layer the clouds are depth-tested at render order −9.5, where standalone draws them at −15 after a depth-less dome |

## The checks

| Check | Result |
|---|---|
| Shader errors | 0 in all three drives |
| Programs inside (G232 → now) | Pine 201 / 201 / 203 → 201 / 201 / 203. Driftwood 171 → 171. Nalati 216 → 216. No recompile at a crossing: the knobs are uniforms |
| GL MB (`__sc_gl`) | Road 127.0, as before. Inside: Pine 260.5–262.0 (was 263.5–264.0), Driftwood 216.7 (was 213.2–216.3), Nalati 308–310 (was 306.1). Run-to-run noise is about ±2 MB, and nothing new is allocated |
| Page read-back after leaving | `readBackExact: true` for Pine and Nalati, including `frame.chain.post`. Driftwood is not measured, because its drive back sticks (sp-x1 has that) |
| Unit | `test/grid-frame.test.ts`: the chain kind, the region's knobs, the lerp by weight, the rays the clock writes kept, and restore |
| Standalone | `Game.buildComposer` builds the same values from the table (bloom smoothing and vignette are set in the constructor instead of afterwards). The grass shaders add a zero offset standalone, but their source changed, so the five grass-v2 program keys change. `scripts/parity.mjs` was not run in this lane |

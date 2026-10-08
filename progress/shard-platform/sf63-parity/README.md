# SF63 parity: each shard inside its grid cell against the same shard from SHARD SELECT (SHARD-PLATFORM, E435)

Jake's G232 pick (B) says each shard keeps its own sky, light and grade inside its grid cell. This row measures how close
that is, at fixed poses on both tiers, and closes what it found generically (engine and game layers; the one shard file
touched is Nalati's own look, which now states what its chain amounts to).

**How the captures were made** (`capture.mjs`). iPhone 16 Pro portrait, muted, Developer on, one browser through
`scripts/browser-lane.sh`, `weather=clear`, and both clocks parked at **midday** (Settings ▸ Time of day). The two
sides otherwise read different hours, because the grid's clock had run for minutes longer. The grid side drives into the
cell with held input from a road pose, rides the board, and shoots at each stop with the HUD hidden. The SHARD SELECT side
then poses at the exact shard-local spots the drive stopped at, also on the board. Each pose gets an MAE (0–255, on
390-px copies) and both sides' mean colour, plus the post chain and shadow rig each side drew.

Boards: `board-<shard>-<tier>.jpg`. Each row is one pose: SHARD SELECT | grid at the parent (where that run exists) |
grid with this change. JSONs: `parity-<shard>-<tier>-<tag>.json` (tag `head` = the parent export, `cand2` / `cand3` =
this source).

## Per-pose diff (this change; MAE 0–255, and grid − SHARD SELECT mean colour R / G / B)

| Shard | Tier | Pose | MAE | Δ mean colour |
|---|---|---|---|---|
| Driftwood | phone | entry-w | 10.7 | −3.6 / −0.3 / 1.4 |
| Driftwood | phone | inside-w | 39.3 | −14.8 / −9.9 / −5.0 |
| Driftwood | phone | inside-n | 19.7 | −15.3 / −1.4 / 5.9 |
| Driftwood | desktop | entry-w | 11.6 | −0.6 / 2.7 / 4.4 |
| Driftwood | desktop | inside-w | 37.7 | −13.0 / −8.4 / −5.0 |
| Driftwood | desktop | inside-n | 21.2 | −12.1 / 2.3 / 9.5 |
| Pine | phone | entry-n | 11.8 | −1.4 / 1.3 / 3.6 |
| Pine | phone | forest-e | 10.2 | 2.4 / 2.6 / 4.4 |
| Pine | phone | forest-n | 8.3 | 3.3 / 3.0 / 4.5 |
| Pine | desktop | entry-n | 9.4 | −3.7 / −2.6 / −1.1 |
| Pine | desktop | forest-e | 6.4 | −1.0 / −1.5 / −0.3 |
| Pine | desktop | forest-n | 4.7 | −0.3 / −0.3 / −0.7 |
| Nalati | phone | entry-e | 12.8 (parent 21.9) | −3.9 / −3.4 / 1.1 (parent +16 / +18 / +20) |
| Nalati | phone | entry-n | 16.6 (parent 18.8) | −9.9 / −11.0 / −5.2 |
| Nalati | phone | inside-e | 14.2 (parent 24.5) | −0.2 / 1.2 / 7.6 (parent +16 / +19 / +28) |
| Nalati | phone | inside-w | 15.4 (parent 25.1) | −1.3 / 0.1 / 7.6 |
| Nalati | desktop | entry-e | 13.0 | −5.4 / −4.7 / 1.1 |
| Nalati | desktop | entry-n | 19.6 | −13.3 / −14.4 / −6.3 |
| Nalati | desktop | inside-e | 14.6 | −0.5 / 0.9 / 6.9 |
| Nalati | desktop | inside-w | 15.3 | 0.2 / 1.6 / 8.7 |

The Nalati "parent" figures are the same capture on the parent export (`parity-nalati-phone-head.json`). Two things set the floor of ≈ 5–12 MAE
even where the looks match: the moving water and cloud shadows (Nalati's cloud field drifts), and the HUD fps chip.
Pine is a match on both tiers (MAE 4.7–11.8).

## What changed (generic; no shard is named in the engine or game code)

| Gap | Cause | Fix |
|---|---|---|
| Nalati washed out in its cell (parent MAE 19–25 on the phone; every pose ≈ +11–28 brighter per channel) | Nalati's look is a `replace` chain: its own filmic grade (`GradeV2Effect`), with no AGX, vignette or AO. Its painted sky and fog are written through that grade's exact inverse. In the cell the page ran AGX, a 0.35 vignette and bloom over it, plus its level grade (saturation 0.1, contrast 0.15), which standalone never applies | `ReplaceLook.engineKnobs(tier)` (`render/look.ts`): a replace look states what its chain amounts to on an engine chain (bloom, vignette, rays, AO), and supplies `display`, its tone curve and grade as one NORMAL-blend effect. The frame (`grid/frame.ts`) places that effect right after the page's tone mapping while the region is resident: one recompile as it loads and one as it unloads, on the road. Crossing the edge moves only opacities: tone mapping 1 − w, its display w. The carried engine grade is neutral for a replace chain. Nalati's look declares it (`lookV2EngineKnobs`): desktop bloom 0.28 / 0.95 / 0.3, none on the phone, no vignette, rays or AO |
| AO and god rays carried regardless of tier knobs | `RegionPost` carried bloom, vignette and rays from the chain kind only | `regionChain` reads the level's `tiers[TIER]` (`ao`, `godRays`), as `Game.buildComposer` does. A region whose frame draws no AO fades the page's AO strength out by the weight, and at full weight the pass is skipped (`enabled = false`: no compile). God rays go to 0 where `godRays: false`. This matters for the template, Signal Dunes, Sky Reach and Nalati on desktop |
| Driftwood's ringed planet missing in its cell | The planet is a page sky piece built from the level's `sky.planet`, and the page shell has none | `SkyRig.layeredBackdrop` builds the level's gas giant for its layer (`layerPlanet`). Its sun direction, haze and crisp disc are the layer's targets, so Driftwood's clock lights it as standalone. `BackdropLayer.follow` keeps it on the camera, draws it after the layered dome and clouds with its own blending, fades its opacity by the weight, and frees it with the region. A look whose sky dressing paints its own (`SkyDressing.planet: false`) gets none |

## Remaining differences (explained, not closed here)

| Difference | Where | Why it is left |
|---|---|---|
| **Driftwood's shadows**: no wreck shadow on the shallows or post shadows on the pier inside the cell (the main part of inside-w / inside-n's MAE) | Driftwood, both tiers | The sun is now identical (midday parked: direction (0, 0.883, −0.469) both sides). Two causes were measured. First, the phone page draws one 1024² cascade over ±88 m, where Driftwood draws its `phoneSplits` rig (three 2048² cascades, 7 / 22 / 80 m). The cascade count is a shader define across the page, so it cannot change per region without a recompile; it is a page-shell decision (+≈ 20 MB GPU on the phone). Second, and larger: at the inside stop the region has 162 visible meshes, 76 of them casting, against SHARD SELECT's 484 and 360 (desktop, where both rigs are three 2048² cascades). The grid draws far fewer of Driftwood's casters. The suspect is the grid's ring / runtime render plan shadow policy (`rings.ts` `shadowRadius`, `runtimeRenderRings.ts`). That is a separate row |
| Content missing in the cell | Driftwood (the castaway NPC in the wreck, the gulls), Nalati (the lupin drifts by the road, the scattered stones on the north slope) | Not look: the regional runtime and the grid's dressing coverage place less than SHARD SELECT does at these spots |
| A deep-shadow desaturation in Nalati's cell | Nalati | The page's `GradeEffect` always takes up to 25 % of the colour out of the deepest shadows. Standalone Nalati never runs it. Its blend is SRC, so the frame's opacity fade cannot remove it. Small (Δ ≤ 8 on the blue channel) |
| Anti-aliasing | Nalati | Standalone runs MSAA ×2 / ×4 (its composer). The page runs FXAA. This is a page composer setting |

## Checks

| Check | Result |
|---|---|
| Shader errors / page errors | 0 / 0 in all 12 runs (6 grid, 6 SHARD SELECT) |
| Programs at a crossing (entry stop → inside stop) | Driftwood 185 → 185 (phone), 198 → 198 (desktop). Pine 205 → 206 and 219 → 221 (as at the parent). Nalati 218 → 218 and 241 → 241. Nalati's display joins the page pass as the region loads (+1 program at load: 217 → 218 on the phone, against the parent's 217). Driftwood's planet adds 4 programs, compiled with its layered sky when the region loads (181 → 185 on the phone) |
| SF59 (≤ 64 programs a region adds) | Driftwood's B row was +57 (sf63/README); the planet takes it to +61. Nalati is +1. Pine is unchanged |
| AO / rays carried (desktop) | Nalati inside: AO pass `enabled: false`, intensity 0. On the road: `enabled: true`, 2.5. Rays 0 and bloom 0.28 / 0.95 / 0.3, as its own chain. Driftwood and Pine keep the page AO (2.5), as their own boots draw it |
| Unit | `test/grid-frame.test.ts`: the tier knobs (`ao` / `godRays`), the AO fade and skip, and the replace chain: neutral grade, display placed after the tone mapping on load, 1 − w / w by weight, no recompile at a crossing, removed and restored. `test/grid-region-sky.test.ts`: `follow` keeps the planet on the camera after the dome, fades it by weight with its own blending, and frees it |
| `scripts/test-facade-instancing.mjs` (this source's build) | PASS desktop / phone tier / iPhone desktop quality: 0 batches, 16,389 / 24,710 / 24,710 instances |
| Frame floor | Not run in this lane: it needs the coordinator's slot (no Simulator booted, 1-min load < 12). The change on the frame is a skipped AO pass inside AO-less cells and one cheap effect in Nalati's cell |
| Full vitest (clean landing tree, `heavy-lane.py full-test`) | 928 files, 5348 tests passed |
| Guards | tsc (root, layers), oxlint, check-graph (no new or rising pair), shard coupling, ratchet: green. The post-commit ratchet's export shows +1 `shard-sandbox` on five manifests for the parent `64a1f0b4b` too: pre-existing, not this change |

## Files

- `capture.mjs`: the parity capture (grid drive plus SHARD SELECT at the same poses, the diffs, chain and shadow probes).
- `board.sh`: the boards.
- `parity-*.json`: one per shard, tier and build.

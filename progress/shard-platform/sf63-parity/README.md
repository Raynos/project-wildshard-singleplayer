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

## SF63 finish (d5ebca22d, c5b5bd8a7): region-frame culls landed, the rope bridge back, the rest measured

Re-captured with the same probe on a served build of HEAD + d5ebca22d (tag `finish`; boards above are now SHARD SELECT |
grid at the parent where that run exists | grid with SF63; JSONs `parity-<shard>-<tier>-finish.json`). Shader / page
errors 0 / 0 in all 8 runs; programs at the crossing unchanged (Driftwood 185 → 185 phone, 198 → 198 desktop; Nalati
218 → 218, 241 → 241).

| Shard | Tier | entry | inside-w / -e | inside-n / -w | entry-n |
|---|---|---|---|---|---|
| Driftwood | desktop | 10.8 | 38.3 | 21.7 | |
| Driftwood | phone | 11.6 | 39.4 | 20.6 | |
| Nalati | desktop | 13.0 (entry-e) | 14.8 (inside-e) | 15.6 (inside-w) | 20.0 |
| Nalati | phone | 12.4 | 14.2 | 15.5 | 17.0 |

What the per-mesh census and a scene dump (grid against SHARD SELECT, same poses) showed:

| Gap | Finding | State |
|---|---|---|
| Nalati's dressing counts | Grid and SHARD SELECT now match layer for layer (boulder / slab / stone, every pose, both tiers; ±2 at inside-e) | closed by d5ebca22d |
| Driftwood's "162 vs 484 meshes, 76 vs 360 casting" | Not missing casters. SHARD SELECT splits each island-wide caster into ≤ 64 shadow-only pieces (`shadowChunks.ts`, E153: ~300 of the 484); the grid region never runs `chunkShadowCasters`, so the same meshes cast whole (`pier`, `palm`, `shore-boulder` … cast 1 in the grid, 0 + pieces standalone). Same shadow texels, more shadow triangles per cascade in the cell | a perf row, not a parity one |
| Driftwood's ground cover (tuft 4059 vs 4469 desktop) | `GroundCover` refills its window by distance from where it last rebuilt (`REFILL_M`), so a drive and a teleport to the same pose differ by up to one refill. Driftwood's region root is at the page origin in this boot (root (0, 0, 0); feet = page position), so `FrameCamera` is the identity there | explained |
| The rope bridge (a declared mover) not drawn in the cell | The bridge's builder was cached by its span (the manifest's `BRIDGE`, which outlives every world). A grid region that leaves disposes its scene tree (sceneOwnership clears the group), and the next resident world was handed that empty group: 0 children in the cell. A builder whose group was emptied is now rebuilt | closed by c5b5bd8a7 (grid: posts + 50 planks + 124 ropes, as standalone) |
| The drowned sailor missing | He is spawned in both (`enemies` group, his cyan light at the hold). In the grid he stands 0.63 m lower (light y −0.73 against −0.10), under the hold's deck, so the hatch shows nothing. The player on the board stands 0.75 m lower at the same xz too (y −0.30 against 0.45): the region's ground / water-surface answer differs from standalone by the world's drop, not the frame | open: the grid's ground port under the hold (`regionalRuntime`'s `foundation.ground` vs the wreck's floor) |
| The wreck's shadow on the shallows | The sun, cascades and the wreck's caster flags match (`wreck-rocks` casts, the seabed and the sea receive, 3 × 2048² both sides). What differs is the shallows themselves: SHARD SELECT shows the sand through clear water, the cell an opaque turquoise sea. The sea is drawn under the neutral page shell, where Driftwood's toon lighting (`look/toon.ts`, a `lights_physical_pars_fragment` patch the page never installs) is absent; the shadow falls on a body the cell draws opaque. (Whether the sea itself also stands lower, as the player and the sailor do, was not measured) | open: a look question (the toon chunk on a grid page), maybe the same height offset as the sailor |
| Hands and held sword | Different arms (the page's skin against Driftwood's bare toon arms) | not this row |

`scripts/parity.mjs --url=<this build> --shards=driftwood-isle,nalati-grasslands --tiers=phone,desktop --jobs=1`: red against the
M5 baselines (cea89b855, recorded at bfb9dc325) on fields these two files cannot touch: Driftwood +1 mesh (the pier now
carries a `pier-shadow-pieces` group of 8), +1 geometry, +2 calls / +160 tris at the poses, texture bytes −8 MB phone /
−98 MB desktop and renderbuffers 10.9 → 5.6 MB on the phone; Nalati −1 mesh (`kurgan-dungeon/kurgan-interior` not built at
boot), program keys changed, textures −1 MB / −50 MB, poses.camp SSIM 0.989 (≥ 0.99). Candidates since the baseline:
d77c83b84 (compressed mips retired after first draw), c5ed249db (rooms load on open), b88dc9da6 / 285c2c332 (SF63 chain,
place frame). Standalone, `FrameCamera.of` returns the camera itself, so d5ebca22d is a no-op there.

`scripts/test-facade-instancing.mjs` (HEAD + c5b5bd8a7 build): PASS desktop / phone tier / iPhone desktop quality, 0
batches, 24,710 / 24,710 / 16,389 instances. Full vitest on a clean export of 8e5dc65d3 (`pnpm gen`, heavy lane): 933
files, 5,369 tests passed. SF59: no program added (Driftwood stays at +61 of 64).

## Files

- `capture.mjs`: the parity capture (grid drive plus SHARD SELECT at the same poses, the diffs, chain and shadow probes).
- `board.sh`: the boards.
- `parity-*.json`: one per shard, tier and build.

## G254 (dw-parity): Driftwood stands and swims in its cell as from SHARD SELECT

Re-captured with `capture.mjs` (tag `g254`, both tiers) on a served build of HEAD + this change; boards above are now
SHARD SELECT | grid with G254, with a new `driftwood-wreck-w` stop beside the wreck's open hold (x 160, where every
earlier grid drive stalled: the board rode the seabed, so the old "inside" shots were taken there, 0.75 m low).

| Tier | entry-w | wreck-w | inside-w | inside-n | parent (finish: entry / inside-w / inside-n) |
|---|---|---|---|---|---|
| desktop | 10.3 | 13.9 | 12.2 | 12.0 | 10.8 / 38.3 / 21.7 |
| phone | 10.2 | 14.7 | 12.6 | 10.9 | 11.6 / 39.4 / 20.6 |

| Gap | Cause (measured in the page) | Fix (generic) |
|---|---|---|
| Player 0.75 m low in the cell | Not a double world drop: at 20 points the cell's `heightAt` and its collider rays equal SHARD SELECT's to the mm. The cell had **no water bodies**: the regional foundation's `WaterBodies` started empty (nothing registered the level's `ground.water`, which `LevelLoader` registers at level.data standalone), so `waterSurfaceAt` answered null over Driftwood's sea, the board rode the seabed, swim / wade, `app.world.water.sea` (Boundary, AnimalManager, Explore) and Nalati's river / Pine's pond were missing too | `regionalWorld.ts`: without a `water` port the foundation registers the level's own `ground.water` on its resident scope; the frame binds them while entered. Grid feet now 2.168 vs 2.169 at (120, 0); sea 0 vs 0 |
| Drowned Sailor 0.63 m low (under the hold's deck) | Not height either: his brain set `mem.floor` 0.637 in both modes, but a restored region's creatures are rebuilt by `AnimalSim.restore`, which copies `mem` into a new object while the rig context kept the old one: `animateSailor` read the stale memory, so his deck offset was 0 (CDP heap read: `rigCtx.mem !== mem` in the grid only) | `Animal.restore` (`AnimalView.ts`) rebinds the rig context to the restored memory. He now shows in the hold on the wreck-w board |
| Shallows opaque turquoise | The toon patch is installed per region already (`|look:driftwood-isle` on the ocean and all 201 region materials, 0 plain). The opacity was the low camera: the water's Beer–Lambert path (depth / \|V.y\|) at a grazing view from the seabed | closed with the water fix |

Remaining: the wreck pose's hull reads ≈ 11 darker in red (lighting / shadow under the page's phone cascade, see above);
hands and held sword differ (page skin); ground cover rebuilds by distance (captured by driving, as both sides now
reach the same poses). `shadowChunks.ts` per region (item 4) not run here: a perf row.

Checks (HEAD 8664edaed + this change, `d50b6f276` candidate): shader / page errors 0 / 0 in all 4 runs; programs at the inside stop
185 (phone) / 198 (desktop), as the parent: SF59 unchanged (Driftwood +61 of 64). `test/shards/driftwood-isle/grid-heights.test.ts`
(20 points: grid height = standalone height, grid water = standalone water, collider rays agree within 0.2 m, the frame binds the
waterline and sea while entered and drops them on leave; red without the fix) and `test/engine/animal-restore-mem.test.ts` (red
without the fix). Full vitest on the clean export (`pnpm gen`, heavy lane, with tsc): 941 files, 5,401 tests passed. Boot smoke
(standalone Driftwood, Pine, grid Driftwood) PASS, faults 0. `test-facade-instancing.mjs` PASS, 0 batches. WebKit render smoke:
red on the Driftwood minimap share (27 % / 31 % against 42 %), identically on 5b86b0e without this change: pre-existing.

## finish2 (op-sf63, e3137df46): Nalati graded once; HEAD re-read on all three (2026-10-09)

The plan row's open list was stale: bloom (gap 3), the post chain (gap 1: Driftwood's is the page's clean chain), Pine's
shafts / fringe / grain (gap 2, `e7f5e8b2a`), the cumulus ring and Nalati's grass (gap 4, `139182ea5`, `53bf5acab`) and
the sailor / shallows (G254 `f92bc6a50`) had all landed. finish2 re-captured with `capture.mjs` (tag `finish2`; the
Driftwood inside stop now rounds the wreck's hull, where the board stalls at x 157 on today's HEAD).

| Gap | Cause | Fix |
|---|---|---|
| Nalati's cell darker, harder and bluer than standalone (entry-n Δ −10 / −11 / −5, inside-w +7 blue) | Nalati's sky rig (`look/skyRig.ts`) wrote the level's split tone, saturation 0.1, contrast 0.15 and the volumetric sun into `game.post` every frame. Standalone `game.post` is null (a `replace` chain), so that block never ran; in the cell `game.post` is the page shell's chain, which the frame carries neutral for a replace look, so the cell was graded twice | the block is gone (`e3137df46`; a standalone no-op). Carried saturation / contrast now read 0 / 0 in the cell |

Nalati A/B (phone, the same base `855f0db8e` with and without the fix, since HEAD refused Nalati's cell, below; JSONs
`parity-nalati-phone-finish2-parent.json` / `-finish2.json`, board `board-nalati-phone.jpg`):

| Pose | MAE before | MAE after | grid mean colour after (standalone) |
|---|---|---|---|
| entry-e | 15.5 | 12.8 | 130 / 121 / 117 (141 / 130 / 122) |
| entry-n | 21.7 | 20.3 | 108 / 107 / 92 (121 / 123 / 104) |
| inside-e | 15.7 | 13.8 | 146 / 132 / 114 (151 / 135 / 110) |
| inside-w | 17.5 | 15.2 | 137 / 131 / 125 (140 / 135 / 125) |

HEAD re-read (build `4196242` = `5a831a554` + the fix; boards `board-driftwood-*.jpg`, `board-pine-*.jpg`; 0 shader /
page errors in all 6 runs):

| Shard | Tier | MAE per pose | Programs (entry → inside) |
|---|---|---|---|
| Driftwood | phone | entry-w 18.5 · wreck-w 19.5 · inside-w 20.2 · inside-n 24.3 (G254: 10.2 / 14.7 / 12.6 / 10.9) | 218 → 221 |
| Driftwood | desktop | 20.9 · 21.1 · 28.1 · 25.7 (G254: 10.3 / 13.9 / 12.2 / 12.0) | 231 → 234 |
| Pine | phone | entry-n 28.9 · forest-e 49.7 · forest-n 25.3 (cand3: 11.8 / 10.2 / 8.3) | 239 → 252 |
| Pine | desktop | 30.7 · 54.2 · 28.3 (cand3: 9.4 / 6.4 / 4.7) | 244 → 257 |
| Nalati | both | not entered: the cell is refused on approach (below) | |

## Still open after finish2

| Gap | Where | Finding |
|---|---|---|
| **Nalati refused in the grid on HEAD** (P0, not SF63) | Nalati, both tiers | `grid.state().live.live.issues`: first `Unknown input context: stealth` (Sky Reach `far.fan`), fixed by sp-x5 `b6833c9c1`; then `Nalati dialogue left its cell` (`runtime/enteredAdventure.ts:30`: the dialogue getter read before the entered service runs; SF22's deferred entered services against SF28 `27fe1ea5b`). Reported to sp-x5 and the coordinator. Nalati's finish2 parity must be re-run on HEAD once it enters |
| **Pine's sky has no clouds in its cell, and a tree stands at the forest-e pose** (regressed since cand3) | Pine, both tiers | Grid sky plain blue at every pose; standalone shows its cirrus / cumulus. At (120, 0) the grid draws a conifer through the camera that SHARD SELECT does not. Programs inside rose 206 → 252 (phone). Carried chain is right (bloom 0.55 / 0.85 / 0.3, vignette 0.55, shafts / fringe / grain on, LUT on). Suspects: today's Pine sky / props work (op-pineperf, op-pinebake, G285 `8205f028b`) |
| **Driftwood's shadows** (the largest look gap left) | Driftwood, both tiers | The page shell draws one 1024² cascade over ±88 m on the phone; Driftwood's own `phoneSplits` rig is three 2048² cascades to 7 / 22 / 80 m with the tent filter and the fade ghosts. So the pier posts, palms and ferns cast nothing visible in the cell. The cascade count is a page-wide shader define (a recompile per crossing, or ≈ +40 MB for the shell adopting the rig everywhere): a page-shell memory decision for Jake, not a carry. A cheaper option (no recompile): a resident Driftwood cell tightens the one cascade (≈ 22 m) at 2048², ≈ +12 MB while resident, losing far shadows; that would ship default-off behind a Debug row |
| Driftwood's MAE rose since G254 (10–15 → 18–28) | Driftwood | Beyond the shadows, the gulls are missing, the ground cover differs, and the viewmodel arms differ (the page skin's gloved arms against Driftwood's bare toon arms) over a large part of each frame |
| Nalati's entry-n slope darker; a dark slab floats at the cell edge in the grid | Nalati | Remains after the fix (MAE 20.3); haze over the far valley at inside-w is lighter in the grid |

Programs: the finish2 counts are higher than finish's (Driftwood 185 → 221 phone, Pine 206 → 252) on today's HEAD, with or
without `e3137df46` (which compiles nothing: Nalati's A/B reads 197 / 197). SF59's per-region budget was not re-measured
in this lane; the rise comes from what landed since `a3442abae`, and is the coordinator's to attribute.

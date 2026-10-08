# G232 item 2: each cell carries its own colour grade (SHARD-PLATFORM SF63, E435)

Jake's G232 pick (B) said a shard's colour grade (LUT, curve, vibrance) comes with it into the grid, so it matches the
shard on its own. Before this, a cell got only an approximation: exposure, saturation, contrast and a tint, set through
the frame's uniform `regionGrade`. Now, on G226's neutral page shell (Developer grid), a live region's **whole grade
chain** is carried exactly the way a standalone boot of its level applies it. The code is generic and lives in the engine
and the game layers. No shard is named.

## How it works

| Part | Mechanism |
|---|---|
| Grade (saturation, brightness, contrast, split tone) | The shell's own engine grade effects (`HueSaturationEffect`, `BrightnessContrastEffect`, `GradeEffect`) used to fade to 0. Now they carry the owner region's grade, faded by its cell weight. When the region takes the frame, the frame holds the page's values and writes the level's resolved grade (`regionChain`: its grade with its look layer's grade over it). When the region leaves the frame, the page's values go back. The region's runtime and its sky clock then drive those effects as they do standalone: Nalati's sky rig writes `game.post` itself, and Pine's day clock now gets the page's `hueSat` through its layered backdrop's `attachPost`, so its saturation turns with the hour (0.228 → 0.191 across the drive) |
| Curve and vibrance | `GradeLookEffect` (`src/engine/core/Grade.ts`) is the `GradeEffect` look layer as an effect of its own, using the same GLSL. It sits right after the page's split tone, which is exactly where a `GradeEffect` built with a look runs them |
| Learned LUT | One `LUT3DEffect` is compiled at install with a neutral 33³ RGBA8 LUT (sRGB in, tetrahedral, like `Game.buildComposer`) and placed after the curve. A region's LUT goes in by a uniform swap, never a recompile, and only if it is the same kind of texture (`swappableLut`). Its opacity is the owner's weight. The LUT comes from the drawn backdrop (Pine and Driftwood load their own), or from `loadLUT(level.id)` for a level that has no backdrop |
| Uniform grade | The frame's uniform grade stays neutral for a region whose chain is carried. The road keeps its G75 grade |
| A page whose home is its own frame (Developer off) | Unchanged: the uniform approximation stays, because there the page's effects belong to the home shard |

## The checks (iPhone 16 Pro portrait, muted, one browser at a time through `scripts/browser-lane.sh`)

Builds: the candidate (`35af69cd0`, this source over `d739e3149`) and its parent `d739e3149`, both served by `serve-build.sh --rev`.

| Check | Result |
|---|---|
| Captures at the same poses | Boards: `pine-entry-n.jpg`, `pine-forest-120-e.jpg`, `driftwood-entry-w.jpg`, `driftwood-inside-w.jpg`, `nalati-inside-e.jpg` and `nalati-entry-road-e.jpg`. Each shows SHARD SELECT, grid before and grid after, at the same shard-local pose (`poses` in `drive-*-after.json`, fed to `../playtest-2-drivein/standalone.mjs`). **Pine**: its path and grass lose the cyan cast and take the standalone's warm palette (its LUT, curve 0.2 and vibrance 0.2). **Driftwood**: the wreck timber goes from red-brown to the standalone's warm brown, and the water picks up its LUT. **Nalati**: no LUT and no curve, so before and after look almost the same. Its grade is now its own exact grade rather than the approximation |
| Carried state (`frame.chain`) | Inside each cell: owner = the region, weight 1. LUT drawn for Pine and Driftwood, none for Nalati (it has no file). Values (saturation, brightness, contrast, curve, vibrance): Pine 0.19–0.23 / −0.015 / 0.2 / 0.2 / 0.2, Driftwood 0.3 / 0 / 0.2 / 0 / 0, Nalati 0.1 / 0 / 0.15 / 0 / 0 |
| Programs inside (before → after) | Pine 201 / 201 / 203 → same. Driftwood 171 → 171. Nalati 216 → 216. **No new programs**: the look and LUT effects join the shell's one colour pass, compiled once at install. The SF59 budget is kept |
| GL MB (`__sc_gl`) | Road before entry: 126.7 → 127.0 (+0.3: the neutral LUT and the pass). Inside: Pine 263.5 → 264.0, Driftwood 216.3 → 213.2, Nalati 304.7 → 306.1 (run-to-run noise is about ±2 MB) |
| Page read-back after leaving | `readBackExact: true` for Pine and Nalati. That covers the lights, fog, environment, 30 road-material look uniforms, and now the page grade values and chain state (owner null, weight 0, page values back). Driftwood: not measured, because the drive back sticks (see below) |
| Shader errors | 0 in all six grid drives and the three standalone runs |
| SHARD SELECT parity against the parent export (`scripts/parity.mjs`, phone, same lane; `parity-pair.mjs` → `scripts/parity/compare.mjs`) | Program keys identical and program counts equal (Driftwood 96, Pine 109, Nalati 98). Pose image MAE ≤ 0.22 / 255 (Driftwood pier and beach 0.22, the rest 0–0.03). Every parity field is green. The only red row is the meta `fields` row: each record's own verdict list against the committed baseline, which is red on both sides on the stale `boot.hud` |
| `scripts/test-facade-instancing.mjs` | PASS on desktop, phone tier and iPhone desktop quality: 0 batches, 24,710 instances |
| Unit tests | `test/grid-frame.test.ts`: the chain is carried inside the cell, half-weighted on the edge line, gone on the road with the page values back, and dropped at once on release. A LUT swap never recompiles. The neutral LUT has the same defines as a learned one |

## Still open (not this row)

- **Driftwood's drive back out sticks at the wreck.** The drive in stops at grid (159.6, 0.24, 0.0) heading west toward
  x = 120. The drive back east toward (230, 0) stops at **grid (177.40, −0.26, 0.0014)**, feet y −0.26, after 120 s of
  held input. Driftwood's cell origin is (0, 0), so these are also shard-local metres. Reported to the coordinator.
- **Post chain, not grade:**
  - Driftwood is built on the clean chain standalone (no grain, chroma or volumetrics, faint rays, a lighter vignette), but the shell's chain is cinematic.
  - Pine's clock also drives the volumetric strength and the ray opacity standalone. Those stay the page's.
  - The bloom intensity and threshold from `GradeSpec` are not carried.
- Driftwood's cumulus ring and Nalati's grass density still differ from standalone (visible in the boards).

## Files

- `drive.mjs`: sf63's drive plus the chain state and the shard-local poses.
- `drive-<shard>-<before|after>.json`.
- `parity-pair.mjs`.
- The six boards listed above.

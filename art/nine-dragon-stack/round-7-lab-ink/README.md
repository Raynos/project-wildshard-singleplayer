# Round 7 · lab P1 "ink": the 界画 surface look (E169, 2026-09-25)

The subset: make a 3D block read as a Song ruled-line painting on silk. Ruler-straight antialiased ink on every built
edge, a silhouette pass, flat pale washes with a silk weave, silk fog in horizontal bands that dissolves the lines
first and the washes second, and a heavier ground line on walkable edges.

- Page: `dev/nd-lab-ink.html`. Code: `src/dev/nd-lab/ink/` (imports `three` + `three/examples/jsm/lines` only). It is
  driven through `window.__ink`, with no URL switches:
  - `set({ lines, sil, wash, preset })`, `u(name, value)`, `cam(t, 'street' | 'drop' | 'stair')`;
  - `pixelRatio(r)`, `bench(n)`, `benchParts(n)`, `stats()`, `grab()`.
- Test scene: a street canyon of 10 tower blocks. They have storey lips, balconies, AC boxes, cages and pipes, and window
  grids with mullions. There is also a carved balustrade over a fogged drop, wet flagstones, a stair and a paifang. It
  is **one merged geometry, 23.6 k triangles and 3 draw calls** (sky, city, composite).
- Tools: `tools/capture.mjs` (Playwright, Metal, muted; run it under the lab browser lock), `tools/compare.py` (the
  boards, plus the edge-density ruler from TECHNIQUES §8) and `tools/motion.py` (the shimmer test).
  `tools/jobs-final.json` reproduces every number below.

## The files

| File | What |
|---|---|
| `loop-1.jpg` … `loop-7.jpg` | Each loop board shows six panels: capture, its codex edit, capture towers, round-4 A towers, capture balustrade, round-4 A balustrade |
| `final.jpg` | The three shots (street, drop, stair), each next to a codex `image_gen` edit of the same frame |
| `target-codex-{street,drop,stair}.jpg` | The look targets: codex edits of the lab's own frames (style paragraph = ART-STYLE-RESEARCH §6 A), so geometry and camera match exactly |
| `techniques.jpg` | The same crop rendered with techniques A, B, D, E and Z, each labelled with its shimmer score |
| `shimmer.jpg` | Shimmer maps: A box-filtered, A unfiltered, D fat lines, E post Sobel |
| `presets.jpg` | The two silks: raw silk (the default; what codex paints) and blue hour (the round-4/6 mockups, the clean room) |

## The loops

1. **First light.** The lines were almost invisible. Four things stacked up and faded them all together: ink went 焦墨
   → 淡墨 by 40 m, line opacity took `T^1.6` of the fog, lines faded out from 45 m, and the fog started at 0 m. The washes
   were pale CG blue.
2. **Ink reads.** Changes: ink mid-point 110 m, line fade 120–330 m, `T^0.7`, fog clear for the first 16 m. Still
   short: the shade band was too dark, so lines vanished into the shade side, and the palette read as CG.
3. **Warm-neutral washes.** The fractal silk weave went in, plus ruled facade clutter (cages, shutters, laundry, AC,
   boards, pipes, module seams).
4. **Depth of value.** Soffits were set to ×0.56 and the under-slab band to 45 %. The silk weave was normalised, since
   at first it was ±2 % and invisible.
5. **Carving and water.** Carved ruyi clouds in the balustrade panels, warm-black ink, blotchy wet ground.
6. **Silk preset.** Fog, bands, sky and a wash tint now match the codex edit, plus the screen-space silk on fog and
   sky only.
7. **Final.** A watercolour back-run on the wet ground, band billows that are world-anchored and painted, and
   silhouettes cut to 2.1 px.

**Where it stands (`final.jpg`).** The ink, the washes, the silk and the fog now match their codex edit.

- **Palette and edge density are on target.** Luma is 0.515 vs 0.510 on the street and 0.455 vs 0.464 on the stair.
  Edge density is 0.096 vs 0.110, 0.111 vs 0.108 and 0.092 vs 0.116.
- **Still short:**
  - The codex ground has darker, blotchier wet stains.
  - Its fog in the drop has stronger ink-wash cloud cores.
  - Its silk is a little coarser.
- **Against round-4 A the towers crop is not close.** Edge density is 0.08 vs 0.34. That gap is **clutter geometry
  and neon**: signs, trains, laundry lines, cables and people. It is not the surface. Other labs own it.

## Line techniques compared (same frame, same material otherwise)

The shimmer test is a sub-pixel walk: 0.1 m/s, 3 frames 1/30 s apart. It measures the residual
|f1 − (f0 + f2)/2| over the top 60 % of the frame. On a surface that moves smoothly f1 is the mean of its neighbours;
what pops does not. The table gives the share of pixels over 12/255, and p99.5.

| Technique | Shimmer | p99.5 | World pass (ms) | Verdict |
|---|---|---|---|---|
| **A: face-edge distance (`aFace`) + box-filtered coverage + gradient-length AA** | **0.04 %** | 3.5 | 1.12 | **Winner.** As stable as no lines at all. It picks which borders ink (edge bits), and the ground-line weight is per border |
| A with unfiltered `step()` lines (control) | 0.43 % | 11 | 1.12 | 10× the popping, which is what the box filter buys |
| B: barycentric (`aBary`, the quad diagonal masked) | 0.04 % | 4.0 | 1.12 | As stable as A. But it needs de-indexed geometry (1.5× verts), can't weight or skip single borders, and draws every triangle edge of non-quad meshes |
| D: `EdgesGeometry(20°)` → `LineSegments2` fat lines | 0.98 % | 18 | 0.96 + a 146 k-tri line draw | **Worst.** It z-fights with its own faces even with polygonOffset, draws no fog or 淡墨 fade (line soup at 100 m+), and the far tower turns into a black grid. Only for the Fei Zhua filament |
| E: post Sobel on depth + a normal hash in alpha, no material lines | 0.17 % | 5.0 | 1.10 (post 0.037) | 4× A's popping. It misses coplanar seams, mullions and slab rulings, so it can't be the primary line |
| Z: no lines (baseline) | 0.05 % | 4.5 | 1.11 | — |

**Silhouette pass.** The alpha variant reads **the MSAA-resolved inverse depth that the material writes into alpha**;
the depth-texture variant reads the single-sample depth texture.

- Shimmer is the same: 0.05 % for both.
- The alpha variant costs +0.02 ms (composite 0.048 vs 0.025 ms with no silhouette).
- It wins on correctness, because it doesn't read `tDepth` at all. That sidesteps the clean room's viewmodel depth bug
  (TECHNIQUES §0): the weapon's jiehua pixels write their own inverse depth into alpha, so world and weapon both keep
  their outlines with no depth slices.

## Cost

Measured on this Mac (M5 Max) in headless Chromium on Metal, GPU-synced with readPixels; `benchParts` repeats each
pass ×40.

| | ms |
|---|---|
| Whole frame, 1206×2622 (winner: A + alpha silhouette + painted wash) | **1.94** (runs: 1.88 / 1.94 / 2.24), **3 draws**, 23.6 k tris |
| World pass, MSAA ×4 half-float + resolve | 1.13 |
| The same with flat washes and no lines (the floor) | 0.99 |
| Painted wash (pooling, stains, mottle, fractal silk, granulation) | +0.12 |
| In-material ruled lines, all kinds | +0.01–0.02 (noise level) |
| Composite (silhouette, fogged by reconstruction, grade) | 0.048 (0.025 with no silhouette) |
| Whole frame at DPR 2 (804×1748) | 1.10 (world 0.52) |

- The phone is **not measured**. An A18 Pro has roughly a seventh to a tenth of this GPU's throughput, so the guess is
  ~8–11 ms at 3× and ~4–5 ms at DPR 2 for this scene.
- The look adds ~15 % over flat unlined washes. It is ALU-only: one 256² R8 texture and no extra targets.

## LEARNINGS

1. **Lines die by a thousand fades.** Line opacity took three distance fades that stacked: ink colour → 淡墨, the fog
   power, and the line fade. On top of that the shade band sat within 20 % of the ink. The result was invisible ink at
   20–60 m. Give each fade its own job, with these numbers:
   - 焦墨 until ~110 m;
   - fog at `T^0.7` (`uLineFog` 1.7);
   - clear air for the first 16 m (`uFogStart`);
   - lines gone by 120–330 m;
   - shade washes ≥ 55 % of lit (`uShade` `#adb2bf`).
2. **Every repeated ruling must fade to its AVERAGE coverage, not to nothing.** The helper is
   `ruled(d, w, spacing) = mix(w/spacing, cov, smoothstep(3, 6, spacing))`: slab lips, jambs, mullions, flagstones,
   tiles, bars. Grazing canyon walls are where spacing collapses, which is almost every wall in a street view. It is
   also what stops walls popping lighter with distance.
3. **Use the gradient length, not `fwidth`**, for metres-per-pixel: `length(vec2(dFdx, dFdy))`. `fwidth` thins 45°
   lines by √2, and this city is all perspective diagonals.
4. **Put the depth in alpha.** Alpha = near / viewZ in the RGBA16F MSAA target. The resolve averages it by coverage,
   the composite takes the Laplacian of inverse depth (flat faces give 0), and only folds toward the eye ink.
   - No MRT, no normal buffer, no second scene pass.
   - No viewmodel depth bug.
   - A mirror or reflection render that reads alpha as coverage must set `uDepthAlpha = 2` around itself.
5. **The silk has to be world-anchored and fractal.** Pick the weave's octave from the pixel footprint
   (`log2(footprint·1.9·256 / 0.35 m)`) and blend the two nearest octaves.
   - The weave then reads the same on a wall 80 m away as on the balustrade at 2 m, and it never swims.
   - Screen-space silk only on the fog and the sky (`silkPaper`).
   - Normalise the weave texture: the first one was ±2 % and invisible.
6. **Fog bands read as bands only when they are thin and dense with clearer air between** (w 3.5–5 m, d 0.11–0.13).
   Each band is a shade deeper down the scroll.
   - Billows scale the band's depth by noise at the ray's crossing of the band plane. That is world-anchored, and it
     calms past 50–160 m or the grazing crossings stripe.
   - The sky evaluates the bands (without the distance air), so the void below has clouds.
7. **The wash, not the line, decides "painting vs CAD".** What moved the frame toward the codex edit was, in order:
   - a warm-neutral wash tint;
   - soffits ×0.56 and a 45 % under-slab band;
   - silk visible on fog and sky;
   - grain on the wet ground and the watercolour back-run rim.

   Pooling (the edge darkening) mostly looks like AO at 6 %. Keep it low.
8. **Fat lines and post-only Sobel lose**, on stability and on look. They are 25× and 4× A's popping, and neither can
   draw mullions or dissolve by distance. Barycentric equals A on stability but can't choose which edges ink.
9. **Codex paints this frame in raw/aged silk (sepia), every time.** The round-4/6 mockups are blue-hour. Both are in
   as presets (`preset('silk' | 'blue')`: bands, fog, sky, `uWashTint`). The stratum colour script can drive these per
   stratum; which one is Jake's call.
10. **Tooling traps.**
    - `page.screenshot` hung after a GPU bench. Grab `canvas.toDataURL` instead (with `preserveDrawingBuffer`).
    - The shared :5173 dev server reloaded mid-run, so run your own port.
    - `renderer.info` resets per `render()`. Set `autoReset = false` to count a frame's draws.

## Integrating into the clean room (`src/dev/nine-dragon/`)

The vertex contract is identical: `aFace` (u, v, w, h in m), `aPat` (kind, row, col, seed), `aMisc` (emit, line
weight, wet, flags) and `aOff`. So this is a shader and uniform swap, not a rebuild.

1. **Material** (`style.ts`):
   - Replace `VS_JIEHUA` / `FS_JIEHUA` with `VS` / `FS` from `jiehua.ts`, and `NOISE_GLSL` / `FOG_GLSL` with this
     folder's plus `PAPER_GLSL`.
   - Order matters: NOISE, then FOG (the billows call `vnoise`), then PAPER.
   - Paste these clean-room branches into the new `FS` unchanged:
     - kinds 6 (net), 7 (leaf) and 8 (cloth), with their `ALPHA_CUT` paths;
     - kind 3's `if (uReflOn > 0.5) { … }` mirror block, which goes after the puddle lines. When the mirror is on, drop
       the fake `emit += … sheen` streak line.
   - Kind 9 (stone) is new.
   - Bump `BAND_COUNT` to the clean room's 9.
   - The clean room's `silkFog(wp, scale)` becomes `silkFog(wp)` and the `uFogScale` mix.
2. **Shared uniforms.** Add these to the clean room's `Shared.u`, with the values in `jiehua.ts`:
   - `uDpr`, `uNear`, `uFar`, `uLineMode` (0), `uGroundPx`, `uInkMid`, `uLineFog`;
   - `uWashMode`, `uPool`, `uStain`, `uMottle`, `uWeave`, `uSilkPaper`, `uWashTint`, `uWinDark`;
   - `uFogStart`, `uHardLines` (0), `uDepthAlpha` (1).

   Update the existing uniforms to this lab's values: `uLinePx` 2.4, `uLineFade` (120, 330), `uInk0` `#1c1a19`,
   `uInk1` `#5f5e5c`, `uShade` `#adb2bf`, `uFogBase` 0.005.

   Every frame, set `uNear` / `uFar` from the camera and `uDpr = pixelRatio / 3`.
3. **Ground lines** (`kit.ts`):
   - In `Kit.flags()`, add `+ (look.ground ?? groundDefault) * 256`.
   - Give `box()` a `walk` option: the top face gets `E.all` ground bits, and the side faces get `E.v1`.
   - Use it on curbs, stair treads, ledges, balustrade curbs and paifang plinths.
4. **Post** (`post.ts`, `FS_COMPOSITE`):
   - Replace `invD()` / `contour()` / the `edge` block with this `post.ts`'s `wAt()` (alpha / uNear), `fold()` and the
     edge block. The edge block is two radii ±0.5 px averaged, `uSilPx` (2.1, 1.2) at 3×, `uSilGain` 0.35, faded over
     60–170 m and fogged via the `uInvProj` / `uCamWorld` reconstruction.
   - Add `uInvProj`, `uCamWorld` and the fog uniforms to `uComp`.
   - Every program that draws into `rtScene` must write that alpha: the jiehua material does it; neon, sky and the
     viewmodel need it added. The neon and sign programs write `uNear / viewZ`, and the sky writes 0.
   - Around the wet-mirror render, set `shared.u.uDepthAlpha.value = 2` (its alpha is read as coverage), then set it
     back to 1.
   - The world → `clearDepth()` → viewmodel order can stay.
5. **Silk presets.** Copy `PRESETS` from `main.ts`, which holds bands, fog, sky and `uWashTint`. Lantern Square's stratum
   row decides silk or blue.
6. **Re-check** with this lab's motion test on the clean room's `window.__nd`: 3 frames on a 0.1 m/s walk,
   `motion.py`. Look for more than about 0.1 % of pixels over 12.

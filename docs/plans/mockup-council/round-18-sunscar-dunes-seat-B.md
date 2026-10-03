# Round 18, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (Jake's 7.0 and phase amendments), the brief, `scores.md` (including the lead's
  key-light ruling after round 17), and round 17's three Signal Dunes seat files.
- The "Signal Dunes, round 18" section of `art/mockup-council/round-18/README.md` (with the lead's first look) and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1028-52e843cd/` (`mock-*`, h1–h4, the aerials, `clip.mp4` at 1 fps,
  `meta.json`), compared with round 17's `20261003-0947-8c70feaf/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git diff 8c70feaf2 36ee1fb7b` for `look/render.ts`, `look/painted.ts`, `world/fireFx.ts`,
  `world/build.ts`, `world/places.ts`, `layout.ts`, and `plugin.ts` `duskOf`. I also sampled the committed sky strips
  `public/assets/sunscar-dunes/sky/dusk-{early,late}.webp` at 52e843cdb. The working tree's `dusk-early.webp` has been
  modified since the capture and was not used.

How I measured (round 17 seat B's tools; its r17 numbers reproduce exactly, e.g. A diagonal 47.6, dusk-fire saddle 79.2, B glow 76.0):
- **Brightness** is Rec. 709 luma.
- **Fine** is the mean |luma − luma blurred at σ 2|.
- **Sat** is the mean (max − min) / max.
- **C** is chroma, max − min of the median RGB.
- **h** is hue in degrees.
- **Grid r** is the Pearson r of a 10×7 grid of σ-12 luma. **Row-demeaned r** removes each row's mean first.
- **The clean patch** is x 10–160, y 1160–1400.
- **Regions** are frame fractions (x left → right, y top → bottom) on the 780-px frame.

## What changed (r17 → r18)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky, y < 0.33 | Land, y 0.33–0.60 | Viewmodel band, y 0.60–0.86 |
|---|---|---|---|---|---|
| dusk-fire | 22.6 | 35.3 % | **44.3** | 12.2 | 16.5 |
| A | 22.9 | 35.7 % | **46.1** | 11.7 | 16.0 |
| B | 26.5 | 41.8 % | **54.5** | 24.2 | 6.9 |
| C | 12.9 | 19.1 % | 15.0 | 18.3 | 11.1 |
| D | 8.2 | 13.1 % | 7.4 | 15.2 | 5.9 |

Most of what changed is the sky (row 2). The land and the viewmodel moved less. Row 2 is where this round is won or lost.

## Measurements (mockup / r17 / r18)

### Sky, by band (median of each box; boxes clear of the HUD, the tower and the ray)

| View, band | Mockup | r17 | r18 |
|---|---|---|---|
| A, y 0.08–0.12 (x 0.45–0.62) | Y 30, (27,28,56), h237 navy | 29, h249 | **98, (145,80,134), h310 magenta** |
| A, y 0.12–0.16 | 39, h244 | 39 | **104, h328** |
| A, y 0.22–0.26 (x 0.05–0.45) | 77, C 36 | 100, C 55 | **127, C 122** |
| A, y 0.26–0.30 | 99, C 86 | 101 | **137, C 137** |
| A, y 0.30–0.34, right of the tower | 154, h24 | 119 | 161, h26 (match) |
| A, whole box x 0.1–0.9, y 0.18–0.33 | 93.7 | 98.8 | **132.2** |
| dusk-fire, y 0.08–0.12 | 35, C 8 (dark grey) | 29 | **97, C 61, h303** |
| dusk-fire, y 0.22–0.26 right | 72, C 37 | 109 | **125, C 114** |
| dusk-fire, whole box x 0.1–0.9, y 0.18–0.33 | 78.4 | 104.8 | **132.3** |
| B, y 0.08–0.12 | 28, (20,27,65) navy | 26 | **83, (75,77,157)** |
| B, y 0.28–0.34 left | 55 | 54 | **107** |
| B, glow right, y 0.40–0.44 (x 0.75–0.95) | 146, (230,128,81), h18 orange | 89, h340 | 136, (201,115,151), **h334 magenta** |
| C, glow band right, y 0.44–0.47 | 95, h356 red | 96, h322 | 70, **h290 violet** |
| D, y 0.08–0.12 | 24, h232 | 37 | 29, h232 (match) |
| D, y 0.34–0.44 (mid sky) | 64–82, h260–311 | 67–89 | **81–104, h324–350 (pink cloud banks)** |
| D, ember line y 0.47–0.49 | 159, h22 | 171 | 141, h10 |

**Why A, dusk-fire and B are wrong.** The painted dome blends `smoothstep(0.50, 0.54, dusk)` from the early strip to the
late one. The spawn is at dusk 0. The staged `logbook` sets only Sefa's flag, so `duskOf` returns **0.50**: the 0.52
dusk applies only after the book is read. All three views therefore show **100 % of the early strip**.

I sampled both committed strips at each view's heading and elevation (pitch from `camAt`, vertical fov 72°). In A,
from the top of the frame down:

| A's row | Mockup | Late strip | Early strip |
|---|---|---|---|
| y 0.10 | 30 | 43 | 87 |
| y 0.14 | 39 | 49 | 94 |
| y 0.24 | 77 | 74 | 114 |
| y 0.28 | 99 | 85 | 120 |

For D, the late strip predicts the frame within about 3 luma (31.6 against 28.8).
- The commit's "the late painting fit every mockup's sky bands best" **is true**.
- But the three views it would fix are shown the early re-colour, which is about 2× brighter in the upper sky and magenta.
- The commit's "B (0.52) is mostly late" is **wrong on both counts**: B is at 0.50, which is 0 % late. Even at 0.52 the smoothstep gives exactly 50 %.

### The spawn pair: the dune band (light placement; not addressed this round, as the README says)

| Region / metric | Mockup | r17 | r18 |
|---|---|---|---|
| A lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 47.6 | **47.6** |
| A right under the crest, x 0.5–1, y 0.48–0.54 | 42.5 | 78.4 | 73.7 |
| A left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 56.1 | 57.6 |
| A far strip right, x 0.6–1, y 0.37–0.40 | 40.5 | 67.4 | 66.4 |
| dusk-fire saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 79.2 | 71.5 |
| dusk-fire lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 80.2 | 73.7 |
| dusk-fire far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 79.0 | 66.2 |
| dusk-fire lit left shoulder, x 0–0.2, y 0.40–0.50 | 70.6 | 55.2 | 56.5 |
| Share over 80, left / right half (y 0.36–0.56): A | 28.1 / 17.3 % | 8.4 / 36.2 % | 8.6 / 32.6 % |
| Share over 80, left / right half: dusk-fire | 24.9 / 0.9 % | 16.4 / 36.6 % | 16.5 / 30.0 % |
| Grid r / band r / row-demeaned r: A | | −0.05 / −0.12 / −0.36 | −0.11 / −0.12 / **−0.37** |
| Grid r / band r / row-demeaned r: dusk-fire | | +0.03 / −0.26 / −0.34 | −0.03 / −0.20 / **−0.34** |

The light is still mirrored. The darker sky fill took 5–8 off the wrongly lit right side, but nothing moved the light.

### The lit sand's colour (row 1)

Saturation by luma bin, y 0.38–0.62:

| Y bin | 20–40 | 40–60 | 60–80 | 80–100 | 100–120 |
|---|---|---|---|---|---|
| A mockup | 0.25 | 0.32 | 0.61 | 0.66 | 0.68 |
| A r17 → r18 | 0.37 → 0.37 | 0.48 → 0.47 | 0.51 → **0.60** | 0.45 → **0.55** | 0.37 → **0.48** |
| dusk-fire mockup | 0.21 | 0.45 | 0.67 | 0.68 | 0.65 |
| dusk-fire r17 → r18 | 0.37 → 0.36 | 0.43 → 0.41 | 0.48 → **0.57** | 0.44 → **0.55** | 0.37 → **0.47** |

| | Mockup | r17 | r18 |
|---|---|---|---|
| A, band's top 15 %: RGB, G/R, B/R | (177,100,59) 0.57 0.33 | (129,100,82) 0.77 0.64 | (136,99,73) **0.73 0.54** |
| A, shade (Y < 45): RGB, B/R | (44,34,43) **0.99** | (51,33,37) 0.72 | (48,30,33) **0.69** |
| dusk-fire, top 15 %: G/R, B/R | 0.58 0.33 | 0.79 0.66 | 0.75 0.56 |
| dusk-fire, shade B/R | 0.84 | 0.71 | 0.71 |
| A clean patch: mean, sat, RGB | 57.2, 0.59, (87,50,35) | 64.5, 0.65, (98,57,35) | 65.7, **0.74, (115,54,30)** |
| dusk-fire clean patch | 74.8, 0.67, (114,66,38) | 67.0, 0.63 | 68.4, 0.71, (115,57,34) |
| C clean patch | 33.0, (53,27,22) | 38.5 | **41.6**, (70,33,33) |

- **The warm half landed.** The 60–80 bin now matches (0.60 against 0.61), and the sand reads orange, not beige. This
  is a visible gain in A and dusk-fire.
- **But saturation still falls in the brightest bins** (0.47–0.48 against 0.65–0.68), and the lit mid-distance faces keep G/R 0.73–0.75.
- **The near floor overshoots:** A's patch is red-orange, sat 0.74 against 0.59, G/R 0.47 against 0.57. Its depth rows,
  y 0.58 → 0.84, run G/R 0.53 → 0.51 against 0.58–0.59.
- **The "violet-grey shade" does not measure.** The shade's B/R (0.69–0.71) and its 20–40 bin saturation (0.36–0.37)
  are unchanged from r17. The mockups' are 0.84–0.99 and 0.21–0.25.

### C: fire, smoke, horizon

| Region | Mockup | r17 | r18 |
|---|---|---|---|
| Flame box (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 22 237 / 2 366 / 130 | 10 295 / 2 248 / **121** |
| Saturated-orange pixels in that box | 8 557 | 11 782 | 5 493 |
| Smoke, y 0.03–0.15, luma by x (0.45 → 0.65) | 25–30 | 37–45 | **37, 62, 91, 97, 85** |
| Smoke at the mockup's plume, x 0–0.2, y 0.20–0.35 | 52.1 (grey plume) | 47.5 | 33.9 (bare sky) |
| Pool (150,1060)–(450,1150) | 40.4 (69,33,23) | 45.7 | 50.7 (88,41,34) |
| Glow band, x 0.6–1, y 0.44–0.47 | 72.5 | 100.4 | **71.9** |
| Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 49.1 | 37.8 |
| Right skyline, x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | 0.469 / 0.466 / 0.462 / 0.430 / 0.454 | 0.488 … 0.488 | 0.487 / 0.483 / 0.483 / 0.483 / 0.484 |
| Grid r / row-demeaned r | | +0.44 / +0.22 | +0.55 / +0.26 |

- **The flame is a real gain.** By eye it is a ragged, turbulent, saturated fire (the flipbook) at about the mockup's
  size, where r17 had tall cream graphic tongues.
- **The white-hot core is still absent:** 121 pixels against 2 722 over 245, and the logs barely read.
- **The smoke is a new wrong element.** It is a broad, pale column, 2–3× the sky's luminance, rising up and right past
  the HUD notices to the top edge. The mockup has a grey plume drifting left, and the game's sky there is bare.
- **The horizon:** the glow's luminance now matches (71.9 against 72.5), from the late painting, but its hue is violet
  (h290) where the mockup's is red (h356). The far land halved its gap.
- **Waymark 0's rise, 18 → 20 m,** is in the bake (h3's eye rose 2.00 m), but C's skyline moved at most 0.004.

### B, D and the hold

| Region | Mockup | r17 | r18 |
|---|---|---|---|
| B backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 46.7 | **53.1** |
| B land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 59.1 | **67.8** |
| B skyline x 0.75 / 0.82 / 0.88 / 0.94 / 0.98 | 0.437 / 0.438 / 0.439 / 0.431 / 0.419 | 0.440 / 0.448 / 0.456 / 0.454 / 0.456 | 0.440 / 0.448 / 0.453 / 0.454 / 0.456 |
| B near sand, x 0–0.3, y 0.69–0.83 | 39.9 | 34.8 | 36.0 |
| D land y 0.52–0.62, left / right | 16.0 / 16.0 | 36.4 / 30.4 | 36.1 / 29.5 |
| D lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 36.8 | 37.3 |
| Leather (D): Y, p95, fine | 30.4, 79, 8.2 | 37.6, 65, 4.7 | 39.7, **81**, 4.9 |
| Loop top, A / dusk-fire (first cord row) | about 0.60 / 0.60 (coils low) | 0.584 / 0.584 | **0.502 / 0.502** |

- **B's mound, 17 → 19 m, moved its skyline 0.003 at most.**
- **The new glove (glove-hd4) turns the back of the hand and the cuff toward the camera.** Crop D, x 0.55–1,
  y 0.62–0.85: the knuckle row reads and the cuff runs off toward the right edge. This is the pose round 17 asked for.
  - The leather is still smooth (fine 4.9 against 8.2), with no seams, and slightly pink (55,35,33 against 47,26,20).
- **The loop moved:** the teardrop now rises from the handle's tip to y ≈ 0.50, the crosshair's height.
  - In A, dusk-fire and B it fills the middle of the frame.
  - In **C it covers the plinth and the light pool**, the base of the mockup's subject (x 0.33–0.57, y 0.52–0.75).
  - The mockups' coils hang low, their tops at about y 0.60.

### Ledger-5 checks

- **The camera-distance rule: no breach.**
  - Row 1's term (`look/render.ts`) re-mixes `directDiffuse` and `indirectDiffuse` by their own luma: lighting only, no camera term.
  - The painted dome samples by direction.
  - The fire's `vFar` fades are pre-existing alpha fades on FX.
- **The late clip holds.** Ground y 0.55–0.90 at 1 fps is 32, 35, 35, 35, 35, 34, 32, 30, 26, 23 (r17 32 … 24), with no step.
- **Real geometry.** The painted sky is at infinity (`depthTest: false` dome), which is allowed. The flame is an FX
  billboard, the logs are real meshes, and the pool is a real `PointLight`.
  - Nit: there is one light, and it rides to the lit waymark *nearest the player*. So a farther lit waymark has no pool.
    That is player-position selection, not a camera-distance shader term, and it is fine for C.
- **Views and staging.** `cameras.json` is unchanged (a4219aa). h3's +2.00 m is the 20 m rise (disclosed). No stage handler changed.
- **No narrowing: one regression in a hero view.** h3 looks up about 9°, past the strip's top edge (45°). There the
  "top row carries on" fill meets the strip in a **ragged, hard-edged seam**: a saturated electric-blue cap, (7,46,146)
  at Y 45.5, over lavender, (71,85,183). r17 had navy (10,11,45). Any early-dusk look upward shows it.
- **Device and HUD.** 390×844 touch, baseline HUD, `pageErrors` empty. gpuMB 149.95 is within the 1.8 / 1.0 GB limits.
  Frame time was not measured.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.1** | 1. **The sky, y 0–0.36. Regression.** The mockup's restrained dark grey-amber sky (top 35, C 8; mid 72–89) is now a saturated magenta-to-coral gradient (top 97, C 61; mid 125–137). It shows the early painted stage, 2× the late one. 2. **The light is still mirrored in the band, x 0–1, y 0.38–0.58.** Row-demeaned r −0.34. The saddle is 71.5 against 54.6, the lower right 73.7 against 46.1, and the far strip 66 against 34.5. Gain: the sand is now orange (60–80 bin sat 0.57 against 0.67). 3. **The hold, x 0.3–1, y 0.50–0.86.** The back of the hand now reads (a gain). But the teardrop stands tall at the crosshair, top y 0.50, where the mockup has a low diagonal loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.2** | 1. **The upper sky, y 0.04–0.20. Regression.** It is magenta, Y 98–104 at h310–328, where the mockup has navy with stars (30–39, h237–244). The band y 0.22–0.30 is 127–137 against 77–99. The glow right of the tower now matches (161 against 154). 2. **The lit diagonal and mirrored light, x 0–1, y 0.38–0.58. Repeated.** The diagonal is 47.6 against 96.7, the left lee 58 against 40, and under the crest 74 against 42.5. Gain: the warm sand. Overshoot: the near patch is red-orange (sat 0.74 against 0.59). 3. **The hold, x 0.25–1, y 0.50–0.86.** The pose is closer (back of the hand and cuff), but one tall teardrop at the crosshair replaces the mockup's two broad low coils. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.3** | 1. **The sky, y 0–0.45, about half the frame. Regression.** The mockup has a navy starry sky (top 28) over a clean orange band (146, h18). The game has periwinkle-violet with pink cloud banks (top 83, mid 107) over a magenta band (136, h334). This is the early stage: B's dusk is 0.50, not 0.52. 2. **The backdrop, x 0–1, y 0.44–0.48.** It got lighter on both sides: right 53 against 21.5 (r17 47), left of the camp 68 against 39. The ridge is still 0.015–0.037 low. 3. **The wagon and the viewmodel.** The wagon is unchanged: smooth canvas and a thin smoke arc. The tall loop at the crosshair sits over the cargo's level. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.8** | 1. **The fire, x 0.25–0.5, y 0.25–0.5. Gain, still short.** A real turbulent orange flame at the mockup's size, but no white-hot core (121 against 2 722 over 245) and the logs barely read. 2. **The smoke and sky, x 0.4–0.7, y 0–0.3. New.** A pale column, 85–97 against a sky of 10–25, rises up and right to the top edge. The mockup's grey plume drifts left (52 at x 0–0.2, y 0.2–0.35; the game's sky there is 34). The horizon glow's value now matches (72 against 72.5), but it is violet (h290) against red (h356). 3. **The plinth and the hold, x 0.3–0.6, y 0.52–0.75. Regression.** The raised loop now rings the plinth and its pool. The pool is brighter and redder (50.7 against 40.4). The skyline is still 0.02–0.05 low. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.7** | 1. **The hand, x 0.55–1, y 0.6–0.86. Gain.** The back of the glove and the cuff now face the camera, and the leather's p95 matches (81 against 79). But it is smooth (fine 4.9 against 8.2), and one tall teardrop replaces the coils hanging beside the fist. 2. **The land, y 0.48–0.72. Repeated.** A flat field at 30–36 against dark bands at 13–16, with no lit near stripe (37 against 59). 3. **The sky, y 0.3–0.49. New.** Pink cloud banks (81–104, h324–350) cross a mid-sky the mockup keeps clear and starry (64–82, h260–311). The ember line is redder and dimmer (141, h10, against 159, h22). The top band matches (29 against 24). |

**Seat score, Signal Dunes: (6.1 + 6.2 + 6.3 + 6.8 + 6.7) / 5 = 6.42, so 6.4.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6.
- Down 0.2:
  - B lost 0.6: its well-matched night sky became a bright violet one.
  - dusk-fire lost 0.2 and A was flat: the warm sand and the glove gained, the magenta upper sky took it back.
  - C gained 0.1: the fire gained, the smoke and the loop over the plinth took some of it back.
  - D was flat.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Row 1: the lit sand's sat by luma bin, dusk-fire 0.59–0.61 and A 0.62–0.63 (mockups 0.57–0.69) | **Only in the 60–80 bin** | 0.57 / 0.60 there, but 0.55 at 80–100 and 0.47–0.48 at 100–120 (mockups 0.65–0.68). The bins are not named. |
| Row 1: a violet-grey shade | **Does not measure** | Shade B/R 0.69–0.71, unchanged from r17, against 0.84–0.99. The 20–40 bin's sat is 0.36–0.37 against 0.21–0.25. |
| Row 1: B, C and D within 0.02–0.1 of their mockups | **D yes; B and C no** | B's 20–60 bins run 0.09–0.14 over. C's run 0.11–0.17 under. |
| B's dune 19 m, waymark 0's rise 20 m | **In the bake; no visible effect** | h3's eye +2.00 m. The skylines moved ≤ 0.004: B 0.440–0.456 against 0.419–0.439, C 0.483–0.487 against 0.430–0.469. |
| Row 2: the late painting fits every mockup's sky bands best | **True** | The late strip at A's camera: 43 / 49 / 74 / 85 against the mockup's 30 / 39 / 77 / 99. |
| Row 2: early is a re-colour, no seams | **Re-colour yes, but it is the stage A, dusk-fire and B show, and it is 2× too bright and magenta. One seam.** | The early strip at A: 87 / 94 / 114 / 120. h3 shows a ragged edge at elevation 45°. |
| Row 2 (commit): "B (0.52) is mostly late" | **Wrong** | The staged `logbook` gives `duskOf` 0.50, so the blend is 0 % late. At 0.52 the smoothstep is 50 %. |
| Row 3: orange flipbook flame with a white core | **Orange flame: yes. White core: no** | 121 pixels over 245 against 2 722. |
| Row 3: crown logs glow once lit | **Barely readable** | Inside the flame the logs don't separate. |
| Row 3: a lit grey-brown smoke billow | **Lit, but pale and in the wrong place** | It is a column at 85–97 luma rising right to the top edge. The mockup's plume is grey and drifts left. |
| Row 3: a point light on the plinth and the sand | **True** | The pool is 50.7 (r17 45.7, mockup 40.4), redder. |
| Row 4: glove-hd4, back of the hand and cuff to the camera | **True** | The knuckle row and cuff read in D. p95 81 against 79. Fine 4.9 against 8.2. |
| Row 4: the loop a teardrop at the handle's top | **True, and that raised it** | The loop's top is at y 0.502 (r17 0.584, mockups about 0.60). It now covers C's plinth. |
| No camera re-aimed, no dusk change | **True** | `cameras.json` unchanged; `duskOf` and the curves unchanged. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R18B-1 | A, dusk-fire, B | should-fix | **new regression** (row 2) | y 0–0.36 (B y 0–0.45) | **The spawn and logbook views show the early painted stage, which matches no mockup.** The late strip already fits A within about 10 in its upper bands. Its upper sky is 43–49 at A's top against the early strip's 87–94. **Fix:** derive the early stage from the late strip with the re-colour confined to the glow band below about 10° elevation, and the upper sky kept at the late strip's navy. Or shift the blend so dusk 0–0.50 already takes the late strip above about 12°. Note that B is at 0.50. **Accept:** A's and dusk-fire's y 0.08–0.16 at Y ≤ 45 and hue 230–270 (dusk-fire chroma ≤ 20). A's y 0.22–0.30 at 75–100. B's top at ≤ 35 and its glow band hue 0–30. A's glow right of the tower kept at 150–165. |
| R18B-2 | A, dusk-fire (and B) | should-fix | **repeated** (rounds 9–17), now actionable under the lead's key ruling | x 0–1, y 0.38–0.58 | **The light is still on the mirrored faces.** Row-demeaned r −0.37 / −0.34. A's diagonal is 47.6 against 96.7; dusk-fire's saddle 71.5 against 54.6 and its lower right 73.7 against 46.1. **Fix:** under the ruling, choose one global key direction from behind-left that lights round 13's crest faces along A's diagonal and dusk-fire's left shoulder. Test it offline with N·L on the bake from the spawn eye before a capture. **Accept:** row-demeaned r ≥ +0.3 in both views; A's diagonal ≥ 75; dusk-fire's saddle ≤ 60; right-half share over 80 ≤ 10 % in dusk-fire. |
| R18B-3 | all five; C most | should-fix | **new regression** (row 4) | x 0.3–0.6, y 0.50–0.75 | **The new teardrop rose into the crosshair and over C's subject.** The loop's top is at y 0.50 (r17 0.58, mockups about 0.60), and in C it rings the plinth and the pool. **Fix:** keep glove-hd4's pose, but lower the loop so its top sits at y ≥ 0.58. Better, hang two looser turns beside the fist, as D's and A's mockups have. It must be the one idle hold, the same in every view. **Accept:** C's plinth (x 0.33–0.5, y 0.60–0.68) unoccluded; the loop's top ≥ 0.58 in A. |
| R18B-4 | C | should-fix | **new** (row 3's smoke lift) | x 0.4–0.7, y 0–0.3 | **The smoke is a pale column, 85–97 against a sky of 10–25.** It rises right to the frame's top, where the mockup's plume is grey (about 50) and drifts left. **Fix:** darken the billow's upper body toward the mockup's grey-brown at about 1.5–2× the sky's luminance, not 4–5×. Lit warm only near its foot, fading out within about 8–10 m above the bowl. Don't flip the wind for C alone (it is global). **Accept:** luma at y 0.03–0.15 above the fire ≤ 45; the plume still visible against the sky at its foot. |
| R18B-5 | all views (h3 first) | should-fix | **new** | above elevation 45°; h3 y 0–0.45 | **The painted strip's top edge is a ragged seam under a saturated electric-blue cap** ((7,46,146) over (71,85,183); r17 navy (10,11,45)). Every early-dusk look up shows it. **Fix:** fade the top rows into a zenith colour taken from the strip's row mean at 40–45° (blurred across the heading), not the clamped last texel row. Or paint the strip to 90°. **Accept:** no edge in h3, and its upper sky within the late strip's navy (Y ≤ 30). |
| R18B-6 | A, dusk-fire (C, D lit faces) | should-fix | **repeated** (R17B-2), half fixed | lit band y 0.38–0.58; near floor y 0.6–0.84 | **Move saturation from the near floor to the lit far faces, and cool the shade.** The 100–120 bin is 0.47–0.48 against 0.65–0.68, with lit-top G/R 0.73–0.75 against 0.57. A's near patch overshoots (sat 0.74, G/R 0.47 against 0.59 / 0.57). The shade B/R is unchanged at 0.69–0.71 against 0.84–0.99. **Fix:** the lit mid faces lose chroma with depth, so warm the fog's sun-side tint (fog colour, not a distance cut). Pull row 1's direct-light saturation from ×2.1 toward about ×1.7 on the floor. Shift the indirect fill further toward blue-violet (its 0.95 / 0.94 / 1.14 tint is not enough). **Accept:** the 100–120 bin ≥ 0.6; the 20–40 bin ≤ 0.3; shade B/R ≥ 0.8; A's patch sat 0.55–0.65. |
| R18B-7 | C | should-fix | **repeated** (rounds 9–17) | flame x 0.3–0.45, y 0.33–0.5 | **No white-hot core over visible logs:** 121 against 2 722 pixels over 245. **Fix:** lower the core boost's threshold (`smoothstep(0.8, 1.0, lum)`) so the flipbook's hottest third goes white low in the bowl. Raise the crown logs' ember emissive so they separate from the flame. |
| R18B-8 | D (and C's horizon) | should-fix | **new** (row 2) | D y 0.30–0.49; C y 0.40–0.47 | **The late strip at D's heading carries pink cloud banks** (81–104, h324–350) where the mockup's mid-sky is clear and starry (64–82, h260–311), and its ember line is red (h10) against amber (h22). C's glow is violet (h290) against red (h356). **Fix:** in the late strip, thin the clouds between headings of about 320–350° and warm its horizon band toward amber at the strip level, so all views share one sky. |
| R18B-9 | B, C | should-fix | **repeated** (R17B-4, R17B-5) | B x 0.75–1, y 0.41–0.46; C x 0.6–1, y 0.44–0.53 | **The +2 m on each mound moved no skyline** (≤ 0.004). B's ridge is 0.015–0.037 low and its backdrop 53 against 21.5. C's is 0.02–0.05 low, and the hump under the far brazier is missing. **Fix:** the earlier asks stand (B about 21–23 m, rising to the right edge; a local hump at C's far brazier). Check each against its skyline column before a capture, not in metres. |
| R18B-10 | D | should-fix | **repeated** | y 0.48–0.72 | **D's flat 30–36 field** against dark bands at 13–16 and a lit near stripe at 59. Plan row 9. |
| R18B-11 | all | nit | **repeated** | glove | The leather is smooth (fine 4.9 against 8.2) and slightly pink. Add crease and seam normals, and darken toward (47,26,20). |
| R18B-12 | process | nit | **new** | README / commit | Name the bins and ROI behind "0.59–0.63". Correct "B (0.52) is mostly late" (B is at 0.50, 0 % late). Check a skyline change in frame fractions, not metres. |

SCORE signal-dunes: 6.4

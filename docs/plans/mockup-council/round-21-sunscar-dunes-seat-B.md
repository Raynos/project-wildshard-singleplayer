# Round 21, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendment), the brief, and `scores.md` with the lead's
  rulings, the new fog ruling among them. Also the three round-20 Signal Dunes seat files.
- The "Signal Dunes, round 21" section of `art/mockup-council/round-21/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1206-21fe6dbf/` (`mock-*`, h1-h4, both aerials, `clip.mp4` at 1 fps,
  `meta.json`), each against round 20's `20261003-1134-e4d15d35/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: `git diff e4d15d354 21fe6dbf4 -- src/shards/sunscar-dunes` (`layout.ts`, `look/painted.ts`,
  `look/render.ts`, `weapons/whipModel.ts`, `world/build.ts`, `world/fireFx.ts`), the commit bodies of f4effe449 and
  234085dba, and the engine's fog chunk (`src/engine/world/Atmosphere.ts`).

How I measured (round 20 seat B's tools and regions; they reproduce its r20 numbers exactly: A's diagonal 48.7, the
row-demeaned r dusk-fire +0.45 / A +0.24, the flame box 147 over 245):
- **Brightness** is Rec. 709 luma. **Sat** is the mean (max - min) / max. **h** is the HLS hue of the region's mean RGB.
  **B/R** is mean blue over mean red.
- **Row-demeaned r** is the Pearson r of a 10x7 grid of sigma-12 luma over the dune band (x 0-1, y 0.38-0.58), each
  row's mean removed.
- **The edge trace** is, per 2 %-wide column, the strongest lit-above / shade-below step in sigma-4 luma (±6 px).
- **The clean patch** is x 10-160, y 1160-1400 px (clear of the coil and the HUD).
- Regions are frame fractions (x left to right, y top to bottom).

## What changed (r20 to r21)

| View | Mean \|RGB diff\| | Pixels with \|dY\| > 8 | Sky, y < 0.33 | Land, y 0.33-0.60 | Viewmodel band, y 0.60-0.86 |
|---|---|---|---|---|---|
| dusk-fire | 8.7 | 24.1 % | 2.3 | **19.3** | 9.8 |
| A | 8.1 | 21.7 % | 2.0 | **17.0** | 10.2 |
| B | 4.5 | 9.5 % | 0.7 | 8.5 | 7.2 |
| C | 9.3 | 30.9 % | **12.3** | 12.3 | 6.9 |
| D | 4.2 | 12.5 % | 0.4 | 8.4 | 6.5 |

The batch is about twice round 20's in size. Three things moved:
- **the land, in every view, through the fog's new colour;**
- **the hold**, in every view;
- **C's sky.** The skies of A, dusk-fire, B and D barely changed: D's sky band differs by 0.4.

## Measurements (mockup / r20 / r21)

### The fog: the far and mid land, against the horizon sky

`look/render.ts` at the capture changed the fog's base colour from `0x221d36` to **`0x5e5288`** (94,82,136), a light
lilac at luma ~88. The density is the same constant 0.0028. At C's and D's dusk the colour still lerps to `DUSK_FOG`,
which went from `0x0d0b1c` to `0x1a1733` (luma ~24). The far rings' haze is now full until dusk 0.55.

| View | Horizon sky (box) | Far land (box) | Land / sky luma: mockup / r20 / r21 | RGB distance land to sky: r20 / r21 |
|---|---|---|---|---|
| A | x 0.6-1, y 0.32-0.34 | x 0.6-1, y 0.37-0.40 | 0.26 / 0.40 / **0.53** | 145 / 127 |
| dusk-fire | x 0.6-1, y 0.32-0.345 | x 0.6-1, y 0.37-0.40 | 0.28 / 0.40 / **0.55** | 133 / 116 |
| B | x 0.6-1, y 0.40-0.43 | x 0.6-1, y 0.44-0.48 | 0.17 / 0.44 / **0.53** | 104 / 90 |
| C | x 0.6-0.9, y 0.40-0.45 | x 0.6-0.9, y 0.48-0.53 | 0.18 / 0.46 / **0.81** | 93 / 45 |
| D | x 0-0.5, y 0.44-0.47 | x 0-0.5, y 0.52-0.62 | 0.14 / 0.36 / **0.43** | 154 / 140 |

| Region | Mockup | r20 | r21 |
|---|---|---|---|
| A far strip right x 0.6-1, y 0.37-0.40 | 40.5, B/R 0.89 | 52.4, 0.58 | **70.8, 0.91** |
| A far strip left x 0-0.4, y 0.375-0.395 | 71.7, B/R 0.44 | 87.0 | **100.4, B/R 0.84** |
| A far ranges x 0.05-0.3, y 0.35-0.365 | 69.6 | 35.7 | 42.9 |
| A mid band x 0-1, y 0.38-0.50 | 55.5 (77,50,46), B/R 0.60, sat 0.37 | 52.5, 0.63, 0.39 | **61.6 (76,56,71), B/R 0.93, sat 0.30** |
| dusk-fire mid band x 0-1, y 0.38-0.50 | 54.9 (82,49,36), B/R 0.43, sat 0.52 | 44.7, 0.68, 0.38 | **58.6 (71,54,72), B/R 1.02, sat 0.33** |
| dusk-fire far strip right x 0.6-1, y 0.37-0.40 | 34.5, B/R 0.83 | 45.2, 0.59 | **64.8, 0.95** |
| B backdrop right x 0.6-1, y 0.44-0.48 | 21.5 | 37.0 | **47.1** |
| B land left x 0-0.2, y 0.455-0.475 | 39.4 | 54.3 | **61.8** |
| C far land x 0.6-0.9, y 0.48-0.53 | 16.1 (25,13,20) | 31.9 | **55.6 (68,50,77), B/R 1.13** |
| D land x 0-0.5, y 0.52-0.62 | 16.0 | 41.0 | **49.9, B/R 0.87** |
| D land right x 0.5-1, y 0.52-0.62 | 16.0 | 33.1 | **50.0, B/R 1.11** |
| aerial-overview, land y 0.40-0.60 | (none) | 34.8 (55,28,41) | **84.6 (94,77,123)** |
| clip.mp4 1 fps, ground y 0.55-0.90 | (none) | 29.0 ... 23.9 | **50.6 ... 50.0** |
| clip.mp4 1 fps, far band y 0.40-0.50 | (none) | 26.7-28.1 | **56.8-64.3** |

- **Under the lead's fog ruling this passes.** In all five views the far land moved toward the horizon sky, both
  lighter and nearer in colour (the RGB distance falls in each one). Nothing moves toward black, so it is no void.
- **On likeness it is the round's biggest regression.**
  - Every mockup keeps dark land under a bright horizon, at land/sky 0.14-0.28. The game is now at 0.43-0.81.
  - The fog is one violet, not the horizon sky at each heading. In A and dusk-fire it turns the whole mid band lilac
    (B/R 0.93-1.02 against the mockups' warm 0.43-0.60).
  - C's far dune is now nearly sky-valued (56 against a sky of 69). The mockup's is a dark silhouette (16 against 89).
- **The lead's "milky lilac" first look is confirmed by the numbers.** The aerial and the clip show the whole dune sea
  as one lavender sheet (the aerial's land went from 35 to 85).
- **Source note:** the scene fog's late destination is still a dark navy, `0x1a1733` (luma ~24), well under the late
  horizon (69-116). In C and D the pixels pass only because the brighter far-ring haze outweighs it. The README's
  "never toward black" is not true of the scene fog colour at late dusk.

### The spawn pair: the dune band

| Region / metric | Mockup | r20 | r21 |
|---|---|---|---|
| **Row-demeaned r, A** (y 0.38-0.58 / 0.36-0.56) | | +0.24 / +0.22 | **+0.61 / +0.58** |
| **Row-demeaned r, dusk-fire** (y 0.38-0.58 / 0.36-0.56) | | +0.45 / +0.38 | **+0.28 / +0.10** |
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.7** (154,84,50) h20, sat 0.65 | 48.7 h357 | **64.5 (80,59,76) h312, sat 0.31** |
| A above the line x 0.55-0.85, y 0.43-0.465 | 83.3 h18, sat 0.59 | 47.8 | **68.9 h344, sat 0.37** |
| A below the line x 0.55-0.85, y 0.49-0.53 | 36.2 h307 | 52.9 | **47.1 h267** |
| A tower mound x 0.45-0.75, y 0.38-0.42 | 73.1 h15 | 44.1 | 65.6 h285 |
| A left lee x 0-0.3, y 0.40-0.50 | 39.6 | 58.0 | 52.8 |
| A above the edge at left x 0.15-0.35, y 0.385-0.398 | 78.0 (120,68,48), B/R 0.40 | 88.4 | **99.3 (124,92,100), B/R 0.81** |
| A share over 80 in the band, left / right | 28.1 / 17.3 % | 33.6 / 1.7 % | 33.9 / **7.9 %** |
| A near floor x 0-0.3, y 0.58-0.70 / clean patch | 70.4 / 57.2, G/R 0.58 | 89.1 / 71.7, 0.52 | 90.3 / 72.6, 0.53 |
| dusk-fire lit shoulder x 0-0.35, y 0.50-0.70 | 82.9 h22, sat 0.70 | 77.7 | 79.6 h11, **sat 0.49** |
| dusk-fire saddle x 0.35-0.9, y 0.46-0.56 | 54.6 h16 | 46.3 | 56.7 **h314** |
| dusk-fire lower right x 0.6-0.97, y 0.48-0.56 | 46.1 | 48.6 | **55.6** |
| dusk-fire clean patch, G/R | 74.8, 0.58 | 68.9, 0.50 | 69.9, 0.51 |

**The edge trace for A** (y of the strongest lit-above / shade-below step, with the step in luma):

| x | 0.20 | 0.25 | 0.30 | 0.35 | 0.55 | 0.65 | 0.75 | 0.85 |
|---|---|---|---|---|---|---|---|---|
| Mockup | 0.387 (-30) | 0.394 (-41) | 0.402 (-51) | 0.411 (-50) | 0.445 (-54) | 0.460 (-44) | 0.475 (-50) | 0.489 (-31) |
| r21 | 0.397 (-38) | 0.396 (-33) | 0.402 (-25) | 0.409 (-19) | ~0.47 (-15)* | 0.480 (-12) | ~0.48 (-17)* | ~0.48 (-14)* |

\* From the column profiles. The step there is lit 62-74 over shade 45-49; the mockup's is lit 91-125 over shade 34-38.

**A's crest landed where the mockup's is.** The builder's +0.61 reproduces exactly, and the falling line now sits
within about 0.02 of the mockup's at x 0.25-0.85. This finding has been open since round 9, and this is the first round
that fixes its geometry.
- **The light does not match.** Above the line the game is a mauve-pink 69 (h344, sat 0.37), where the mockup's lit
  face is gold at 83-97 (h18-20, sat 0.59-0.65). The step is about a third of the mockup's.
- **At x 0.1-0.35 the edge is not a lit dune.** It is the bottom of the fogged far flat, lilac at 99 (B/R 0.81). The
  mockup has a gold dune face there (B/R 0.40).
- **Dusk-fire paid for it.** Its r fell from +0.45 to +0.28. The new crest lays a broad hump across the saddle, and its
  lower right is 55.6 against the mockup's 46.1.

### The hold

- `HD_GLOVE` is lower and pitched forward, and `LOOP.start` is now 1.3: one global hold. The handle is gone into the
  fist, and the loop hangs beside it on the left in all five views.
- The loop's top is at about y 0.66; round 20's was about 0.54, and the mockups' are about 0.58-0.61.
- Its width is about 0.25 of the frame. The coils in A, B and C are about 0.5 wide and have two turns.
- It is now closest to dusk-fire's single loose loop and to D's coil beside the fist.
- C's plinth is clear: the loop no longer crosses it.

### B

| Region | Mockup | r20 | r21 |
|---|---|---|---|
| Glow band left x 0-0.35, y 0.40-0.45 | 111.1 **h12** | 87.2 h339 | 89.5 **h359** |
| Glow right x 0.75-0.95, y 0.40-0.44 | 136.1 h18 | 86.9 h353 | 94.4 h5 |
| Lantern pool x 0.40-0.56, y 0.515-0.54 | 56.9 (88,50,38) **h14** | 55.3 h1 | 60.3 **(101,49,52) h356** |
| Wagon front x 0.48-0.62, y 0.47-0.52 | 45.7 h17, sat 0.71 | 42.5 h6, 0.81 | 51.0 **h357, sat 0.56** |
| Hood x 0.50-0.58, y 0.37-0.47 | 64.6 | 58.7 | 64.8 |
| Plume: its brightest column, y 0.15-0.35 / its rise over the sky | x 0.50 / +12 | x 0.74 / +9 | **x 0.70** / +8 |

- **The lantern's pool is still pink.** Blue is above green (101,49,52), so the amber light (`0xffb766`) did not reach
  the sand as amber.
- **The plume moved 0.04 left.** It now rises at the wagon's right end, where the mockup's rises from the hood.

### C

| Region | Mockup | r20 | r21 |
|---|---|---|---|
| Top x 0.45-0.62, y 0.03-0.08 | 22.4 (15,21,56) | 6.3 (1,2,61) | **14.3 (13,12,39)** |
| Upper left x 0.02-0.3, y 0.10-0.30 | 43.5, sat 0.38 | 22.9, sat 0.86 | **36.5, sat 0.52** |
| Flame box (150,350)-(450,900): over 150 / 230 / 245 | 13 729 / 5 554 / 2 720 | 10 593 / 3 550 / 147 | 11 147 / 3 769 / **1 927** |
| Saturated orange in that box | 29 951 | 21 131 | 22 526 |
| Smoke body x 0.27-0.38, y 0.18-0.25 | 48.7 h309 | 52.1 h296 | 54.7 h340 |
| Plume x 0.2-0.45, y 0.15-0.33 | 50.4 h320 | 39.9 h244 | **47.2 h271** |
| Ground right x 0.55-0.95, y 0.60-0.70 | 33.7 h11 | 56.2 h3 | 59.5 h0 |
| Pool ground (100,1000)-(190,1120) | 59.5 h16 | 73.9 h5 | 76.7 h4 |
| Plinth x 0.33-0.5, y 0.60-0.68 | 45.7 | 56.0 (under the loop) | 70.3 (clear, lit) |

- **C's sky is the round's best gain.** The clipped royal blue is gone, and the upper sky's saturation went from 0.86
  to 0.52 (the mockup's is 0.38).
- **The white core is back:** 1 927 pixels over 245 against the mockup's 2 720. The builder's ~1 700 is conservative.
- **The plume reads wider and closer in value,** but it is still a straight column to the frame's top, not a billow
  drifting up-left.

### D

- **The sky is unchanged** (sky band diff 0.4). The horizon peak is 129 at y 0.454, coral h5, where the mockup's is 166
  at y 0.497, peach h23. The pink streaks over the mid sky are unchanged (90.9 h340 against 72.1 h281).
  - So the low-sky ±2 deg hold did nothing measurable in D.
- **The land moved away from the mockup:**
  - land 49.9 against 16.0 (r20 41.0);
  - the lit near band 43.5 against 58.9.
  - The dark transverse bands are a milky blue-violet field.

## Ledger-5 checks

- **Views:** `meta.json` camAt is identical shot for shot to round 20's, and the cameras blob a4219aa is unchanged. No
  breach.
- **Staging:** the `staged` map is unchanged and `pageErrors` is empty. 234085dba touches a file with a stage handler,
  but its edits there are the lantern light's colour and the light share. Both are the same in play.
- **The fog (the new ruling): no void.**
  - The density is one constant (0.0028) at every dusk step.
  - The colour and the haze change only with the quest's dusk, which is global.
  - Measured on the far bands of all five views, the land moves toward the horizon sky's colour and value, never toward
    black (table above).
  - The scene fog's late colour, `0x1a1733`, is still a dark destination. It is outweighed in these frames, but it is a
    should-fix under the ruling's intent (finding R21B-1).
- **The camera-distance rule:** no new shard term reads camera distance. The `haze` multiplier is a function of `DUSK`
  only. The late clip has no step (ground 50-53 throughout).
- **The second crest is real terrain.**
  - The baked `terrain.bin` and the navmesh were re-baked.
  - The aerial-spawn shows it as one long ridge joined to the tower's mound, a dune of the field, not a card.
  - **Its walk test is not on disk.** The newest `progress/physics` file, `sd-r21-b-muslzi8h.json` (11:33), predates
    the crest's commit (12:05), so the commit's "walk 0 stuck" for this crest can't be verified (nit).
  - Its line was still tuned on A's frame (the comment quotes A's edge trace). That is round 13's should-fix pattern,
    not a breach.
- **The hold:** one constant pose (`HD_GLOVE`, `LOOP`), the same in every view and hero shot. It is not a per-view
  pose and not a frozen attack.
- **No narrowing:** h1, h2 and h4 took the same lilac shift as the scored views (land +6 to +9). h3's land is
  unchanged. No place was dropped or hidden.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup -> view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` -> `mock-dusk-fire` | **6.5** | 1. **The land went lilac, and its light pattern regressed (x 0-1, y 0.38-0.56). Regression.** The mid band is B/R 1.02, sat 0.33, against warm 0.43, 0.52. The row-demeaned r fell from +0.45 to +0.28. The new crest's hump lies across the saddle (h314 at 56.7; the lower right is 55.6 against 46.1). The shoulder holds its value (79.6 against 82.9) but lost saturation (0.49 against 0.70). 2. **The sky and the ray (y 0.05-0.37). Repeated.** A navy top (chroma 48 against 8) over a hot band (108.8, sat 0.67, against 83.9, 0.48). The mockup's large ray over the tower is absent. 3. **The far land (x 0-1, y 0.36-0.40). Regression.** It is pale lilac at 65 against the mockup's dark 35, at land/sky 0.55 against 0.28. **Gain:** the hold is now one loop beside the fist with the handle hidden, the closest of the five to its mockup. |
| `round-9-review/A-spawn-dusk-light` -> `mock-A-spawn` | **6.8** | 1. **The crest's light (x 0.25-0.9, y 0.39-0.53). Geometry fixed, light not.** The falling line now sits within ~0.02 of the mockup's (r +0.61). But its lit side is mauve at 69 (h344, sat 0.37), against gold at 83-97 (h18-20, sat 0.59-0.65); the step is a third of the mockup's. At x 0.1-0.35 the "edge" is the bottom of the fogged far flat (99, B/R 0.81), not a lit dune. 2. **The far land and the mid band (y 0.37-0.50). Regression.** Milky lilac: the far strip right is 71 against 41 (r20 52), the left 100 against 72, the mid band B/R 0.93 against 0.60. 3. **The hold and the sky (x 0.3-1, y 0.22-0.86). Partly repeated.** One small loop (top ~0.66, ~0.25 wide) where the mockup has two broad coils (top ~0.60, ~0.5 wide). The sky band runs hot (95-113 against 78-97). A small ray sits left of the tower where the mockup has none. |
| `round-9-review/B-quest-logbook` -> `mock-B-logbook` (staged `logbook`) | **6.8** | 1. **The horizon band (x 0-1, y 0.40-0.45). Repeated, slightly better.** h359 / h5 at 89 / 94, against h12 / h18 at 111 / 136 (r20 h339 / h353). 2. **The caravan's light and plume (x 0.4-0.75, y 0.15-0.54). Repeated.** The lantern pool is still pink (101,49,52), h356, against amber h14. The wagon front is h357, sat 0.56, against h17, 0.71. The plume rises at x 0.70 (r20 0.74), where the mockup's rises over the hood at x 0.50. 3. **The land and the hold (y 0.44-0.86).** The backdrop right is 47 against 21.5 and the land left 62 against 39, both further off than r20 under the lilac fog. The loop is small where the mockup has two broad coils; the handle is now hidden (a gain). |
| `round-9-review/C-waymark-fire` -> `mock-C-waymark` (staged `waymarks-lit`) | **7.3** | 1. **The far dune (x 0.3-1, y 0.47-0.55). Regression.** Pale lilac at 56 (B/R 1.13) against a dark 16, at land/sky 0.81 against 0.18. The waymark loses the dark backdrop that frames it in the mockup. 2. **The lit ground and the plinth (x 0.1-0.95, y 0.55-0.70). Repeated.** The pool is 77 h4 against 60 h16, the ground right 59 against 34, and the plinth 70 against 46: pink and over-bright. 3. **The smoke (x 0.2-0.45, y 0-0.33). Repeated, closer.** The plume region is 47 against 50 (r20 40), but it is a straight column to the top, not a billow drifting up-left. **Gains:** the sky is violet-navy (upper left sat 0.52 against 0.38; r20 0.86); the white core is back (1 927 against 2 720; r20 147); the plinth is clear of the loop. |
| `round-9-review/D-hands-whip` -> `mock-D-hands` (staged `waymarks-lit`) | **6.6** | 1. **The land (x 0-1, y 0.50-0.68). Repeated, and worse.** A milky blue-violet field at 50 against dark bands at 16 (r20 41); the lit near band is 43.5 against 58.9. 2. **The sky (y 0.08-0.50). Repeated, unchanged.** Pink streaks over a mid sky the mockup keeps clear (90.9 h340 against 72.1 h281). The horizon line is 129 coral at y 0.454, against 166 peach at y 0.497. 3. **The hand (x 0.55-1, y 0.55-0.86). Repeated, closer.** The loop now hangs beside the fist with the handle hidden, as in the mockup, but as one ring where the mockup hangs several coils. The glove is smoother than the mockup's creased leather. |

**Seat score, Signal Dunes: (6.5 + 6.8 + 6.8 + 7.3 + 6.6) / 5 = 6.80, so 6.8.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4, 6.7, 6.8.
- Flat against round 20.
  - C gained 0.2: the sky and the core.
  - A gained 0.1: the crest's geometry and the hold, less the lilac.
  - Dusk-fire lost 0.2: its r and its colour.
  - B and D are flat: the hold gained, and the fog took about as much away.
- The fog's lilac cost about as much as the crest, C's sky and the hold gained. Still under 7.0.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The coil hangs low in the lower right | **True, and it overshot low and small** | The handle is hidden and the loop sits beside the fist. Its top is at ~0.66 against the mockups' ~0.58-0.61, and it is ~0.25 wide against A/B/C's ~0.5. |
| C's upper sky violet-navy, (28,27,54) against (39,32,57) | **True in direction** | My top box is (13,12,39) at 14.3 against 22.4 (r20 6.3). Upper left 36.5, sat 0.52 against 43.5, 0.38. |
| The fog toward the horizon sky's lighter violet-blue, never toward black | **The pixels pass; the source half does** | The far land moves toward the sky in all five views. But the base fog is one lilac, not the horizon at each heading (A's horizon is orange, B/R 0.29). At late dusk the scene fog still goes to `0x1a1733`, luma ~24. |
| C's white core ~1 700 over 245 against ~2 600 | **True** | 1 927 against 2 720. Orange 22.5 k against 30 k. |
| A's crest: edge trace 0.41 0.40 0.40 0.42 0.42; r A +0.61, dusk-fire +0.31 | **A true; dusk-fire is +0.28, down from +0.45** | The edge at x 0.1-0.35 is the fogged far flat's lower boundary (lilac 99 above it), not a lit dune face. At x 0.55-0.85 the line is right, but at a third of the step. |
| Climb 39.1 deg, walk 0 stuck, navmesh re-baked | **The bake is true; the walk is unverified** | The navmesh and terrain changed in 234085dba. No walk-test file in `progress/physics` postdates the crest. |
| B's wisp over the wagon | **Partly** | The brightest column moved from x 0.74 to 0.70. That is the wagon's right end, against the mockup's x 0.50. |
| C's plume wider | **True** | The plume region is 47.2 against 50.4 (r20 39.9). It is still a straight column. |
| The lantern amber, not red | **False on the sand** | The pool is (101,49,52), h356; the mockup's is h14. The wagon front is h357. |
| The low sky ±2 deg, held at 0.8 deg | **No measurable effect in D** | D's sky band diff is 0.4, and its peak is 129 at y 0.454, as in r20. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R21B-1 | all five | should-fix | **new regression** (28a1cf5f1) | A and dusk-fire y 0.37-0.50; B y 0.44-0.48; C x 0.3-1, y 0.47-0.55; D y 0.50-0.68 | **The lilac fog washes out the mid and far land.** `FOG.color` went to `0x5e5288` (luma ~88) at the same 0.0028 density. The mid bands of A and dusk-fire went from warm to lilac (B/R 0.93-1.02 against 0.43-0.60), and far land / horizon sky rose to 0.43-0.81 against the mockups' 0.14-0.28. C's far dune is 56 against 16; D's land 50 against 16; the aerial's land 35 -> 85. **Fix, inside the ruling:** take the fog's colour from the painted horizon at each heading (the engine's `fogSunColor` mix toward the glow at a fuller share, not a cut to 35 %), so the spawn heading hazes warm. Lower the density until the 30-100 m band keeps its sand colour. Make the far land dark by facing and occlusion (slip faces turned from the glow), as the ruling requires, not by fog. Make the late `DUSK_FOG` the late horizon colour too, so no part of the fog heads toward black. **Accept:** the mid band x 0-1, y 0.38-0.50 at B/R ≤ 0.70 and sat ≥ 0.40 in A and dusk-fire; far land / horizon sky ≤ 0.35 in all five; C's far land ≤ 30; D's land ≤ 30. |
| R21B-2 | A | should-fix | **repeated** (rounds 9-20), half fixed | A x 0.25-0.9, y 0.39-0.53 | **A's crest is now in the right place but lit mauve, not gold.** Above the line it is 69 h344, sat 0.37, against 83-97 h18-20, sat 0.59-0.65. The step is a third of the mockup's (lit 62-74 over 45-49, against 91-125 over 34-38). **Fix:** most of the hue is the fog (R21B-1). Keep the crest's geometry, and let the key's warm colour reach its back at the spawn's dusk (the fog share off the 30-50 m crest, the sand's lit saturation on key-facing slopes). **Accept:** the box x 0.4-0.7, y 0.40-0.44 at ≥ 80, h 10-30, sat ≥ 0.50; the step at x 0.55-0.85 ≥ 30; r ≥ +0.55 held. |
| R21B-3 | dusk-fire | should-fix | **new regression** (234085dba) | dusk-fire x 0.35-1, y 0.40-0.56 | **The turned crest broke dusk-fire's light pattern.** r fell from +0.45 to +0.28 (+0.38 -> +0.10 on y 0.36-0.56). The hump crosses the saddle, and the lower right is 55.6 against 46.1. **Fix:** test every crest change against both spawn views under the shipped key, and accept only when both hold. Lower or shorten the crest's east end so that from dusk-fire's heading it sits below the saddle's shade line. Shape it as a dune of the field, not by A's frame (round 13's should-fix). **Accept:** dusk-fire r ≥ +0.40 with A ≥ +0.55; dusk-fire's lower right ≤ 50. |
| R21B-4 | A, B, C (dusk-fire, D) | should-fix | **repeated**, much improved | x 0.3-1, y 0.55-0.86 | **The hold is now right in kind but small and low.** The handle is hidden and the loop hangs beside the fist, which closes the "ring on a stick". But it is one turn, ~0.25 wide, its top at ~0.66. The coils in A, B and C have two turns, ~0.5 wide, tops at ~0.58-0.61. **Fix:** keep the pose; enlarge `LOOP` rx/ry so two turns show, and raise its top to about 0.60. It stays one idle hold. **Accept:** the loop's top at 0.58-0.62 in A; two turns visible; C's plinth (x 0.33-0.5, y 0.60-0.68) clear. |
| R21B-5 | B, C | should-fix | **repeated** (R20B-6) | B pool x 0.40-0.56, y 0.515-0.54; C pool (100,1000)-(190,1120) | **The point-light pools are pink.** B's pool is (101,49,52) h356 under an amber light (`0xffb766`), and C's is 77 h4 against 60 h16. The sand's lit-saturation boost turns any warm point light toward magenta. **Fix:** apply the sand's ×2.5 saturation to the key's diffuse share only, not to point lights (seat C's r20 diagnosis), and dim C's pool toward 60. Move B's cookfire behind the wagon's centre so its wisp rises over the hood. **Accept:** B's pool h 8-20; C's pool h 10-20 at 55-65; B's plume column at x 0.48-0.58. |
| R21B-6 | D, B, dusk-fire | should-fix | **repeated** (R20B-3, R20B-8) | D y 0.30-0.50; B y 0.40-0.45; dusk-fire y 0.05-0.30 | **The skies the round did not touch.** D's pink streaks (90.9 h340 against 72.1 h281) and its coral line (129 at y 0.454 against 166 peach at y 0.497). B's band h359 / h5 at 89 / 94 against h12 / h18 at 111 / 136. Dusk-fire's top chroma 48 against 8. **Fix:** as R20B-3 and R20B-8: in the late painting at D's heading, thin the clouds and lift the horizon rows toward (215,156,119); warm B's heading's band; desaturate dusk-fire's top. **Accept:** D's mid 65-80 at h 260-310 and its peak ≥ 145 at h 15-30; B's band h 5-25 at ≥ 105; dusk-fire's top chroma ≤ 25. |
| R21B-7 | C | nit | **repeated**, closer | C x 0.2-0.45, y 0-0.33 | The plume is a straight column to the top. The mockup's billows and drifts up-left with the sparks. Lean the big fire's smoke up-left and fade it by y 0.10. |
| R21B-8 | dusk-fire | should-fix | **repeated** (since round 1) | x 0.15-0.6, y 0.15-0.27 | **The ray.** It is still absent from dusk-fire and a speck in A. It needs a real behaviour that brings it near, captured in a real moment, or the lead names it a mockup conflict. |
| R21B-9 | process | nit | **new** | README, 234085dba, 28a1cf5f1 | Four claims don't hold on the seats' boxes. "The lantern amber" (the pool is h356). "Never toward black" (`DUSK_FOG` 0x1a1733 at late dusk). "Dusk-fire +0.31" (+0.28, down from +0.45). "The low sky for D's peak" (unchanged at 129). The crest's walk test isn't on disk: commit its `progress/physics` file with a leg over the crest. |

SCORE signal-dunes: 6.8

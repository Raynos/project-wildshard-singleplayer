# Round 14, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 amendment), the brief, `scores.md`, round 13's three Signal
  Dunes seat files, and `docs/plans/SIGNAL-DUNES-TOP10.md`.
- The "Signal Dunes, round 14" section of `art/mockup-council/round-14/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0730-69642e60/` (the `mock-*` views, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), and the round-13 capture `20261003-0648-50cd2d82/` for before and after.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r14.jpg` and `art/sunscar-dunes/round-23-glove/` (board, README).

Source checks (read-only `git show` / `git diff 50cd2d82 69642e60`):
- ea0b3939a: `look/render.ts` and `look/dusk.ts`.
- 5db840110: `layout.ts`, `world/dunes.ts`, `look/render.ts` and `look/sky.ts`.
- 042c219c9: `weapons/whipModel.ts`.
- The terrain bakes at r12 (c83fb063), r13 and r14, decoded as 256² float32 heights over 500 m, starting at byte 24.
  The eye heights in camAt are all 1.70 m over the decoded ground, so the decode is right.

How I measured. These are the same tools as round 13, so the numbers compare across rounds:
- **Brightness** is Rec. 709 luma.
- **Fine** is the mean of |luma − luma blurred at σ 2|.
- **Ripple energy** is the mean of |blur σ1 − blur σ5|, also given as a percentage of the region's mean luma.
- **Macro r** is the Pearson r of σ-12 luma.
- **Grid r** uses 0.1 × 0.02 cell means.
- **Crest edge** is, per column, the strongest dark-above → bright-below step.
- **Regions** are frame fractions (x left → right, y top → bottom) or pixel boxes on the 780-px frame.
- **The clean patch.** The new cord's fall now touches the bottom-right corner of round 13's box (x 10–190, y 1160–1420).
  I quote that box for continuity, and take the stats from **x 10–160, y 1160–1400**, which I checked is clear of the
  cord, Sefa and the HUD in all five views. The two agree within 1.4.

## What changed, and why: the key moved 78°

| View | Mean \|RGB diff\| r13 → r14 | Pixels changed by more than 20 | Sky above y 0.33 |
|---|---|---|---|
| dusk-fire | 12.6 | 23.5 % | 1.4 |
| A | 13.9 | 26.4 % | 1.3 |
| B | 5.6 | 7.1 % | 0.8 |
| C | 12.1 | 21.0 % | 2.3 |
| D | 4.1 | 4.7 % | 0.2 |

**5db840110 changed `KEY.dir` from (−0.45, 0.2, −0.87) to (0.75, 0.2, −0.62).** That moves the key's heading from −27°
to **+50°**. It is the one change that touches every view's light, and the README's list doesn't name it. Its effects:
- The visible afterglow (`SUN_GLOW`) is at +11.5°, so the key now comes from 39° right of where the sun set.
- **The new crest does not cross the key.** Its segments (70,−50)→(38,−8) and (38,−8)→(8,26) run **13° and 9°** from
  the key's heading, so the key runs along the crest, as it did in round 13.
- **Its high far end shades its own camera-facing face.** I ray-marched the r14 bake toward the key, as cast shadow:
  - with the r14 key: **52 %** of A's view at 25–110 m is in cast shade, and **88 %** of its right half;
  - r13 (old key, old bake): 20 % and 28 %;
  - the r14 bake with the old key: 4 % and 7 %.

  So the dark band is the key swing, not the new terrain.
- **At the spawn's near ground,** the Lambert term N·key falls from 0.37–0.39 to 0.30–0.31.

## Measurements (mockup / r13 / r14)

### Near sand, clean patch

| View | Mean | p5–p95 | Fine | Ripple % | RGB |
|---|---|---|---|---|---|
| dusk-fire | 74.8 / 75.8 / **45.0** | 46–113 / 53–92 / **10–77** | 9.5 / 5.1 / **10.2** | 10.4 / 4.8 / **18.5** | 114,67,38 / 107,69,48 / **77,38,21** |
| A spawn | 57.2 / 77.4 / **45.9** | 32–94 / 51–96 / **11–78** | 9.2 / 4.8 / **10.6** | 10.1 / 4.2 / **19.2** | 87,50,35 / 107,71,51 / **79,39,21** |
| B logbook | 39.8 / 25.5 / **29.2** | 31–49 / 13–37 / **15–42** | 2.0 / 2.4 / **2.8** | 4.1 / 8.3 / **8.8** | 63,34,27 / 45,21,18 / **51,24,20** |
| C waymark | 33.0 / 18.7 / **41.1** | 28–37 / 11–26 / **29–52** | 0.4 / 1.2 / **2.1** | 1.0 / 6.4 / **4.0** | 54,28,22 / 38,14,10 / **66,35,30** |
| D hands | 35.9 / 25.5 / **32.8** | 25–48 / 18–33 / **25–40** | 0.4 / 1.3 / **1.5** | 0.8 / 4.0 / **4.4** | 53,32,28 / 43,21,19 / **55,27,24** |

**The spawn pair** (dusk-fire and A):
- The grain energy is back, at fine 10.2–10.6 against 9.2–9.5.
- But both views fell **30 below dusk-fire's mockup and 11 below A's**.
- The ripple troughs are near black: p5 10–11 against 32–46.
- The ripple's relative contrast is **1.8–1.9× the mockups'**: 18.5–19.2 % against 10.1–10.4 %. That is the uniform
  corduroy the plan's row 2 set out to remove, now stronger near the camera.

**The late views:** round 13's flat-ground cut is fixed. C is 18.7 → 41.1, now 8 over its mockup; D is 25.5 → 32.8; B is
25.5 → 29.2.

### Whole frame (rows 120–1400): macro r and mean |diff|

| View | r13 | r14 |
|---|---|---|
| dusk-fire | +0.59 (17.5) | **+0.45 (23.5)** |
| A | +0.68 (16.8) | **+0.61 (19.8)** |
| B | +0.81 (9.4) | **+0.79 (9.0)** |
| C | +0.55 (16.0) | **+0.63 (14.0)** |
| D | +0.79 (10.9) | **+0.80 (11.0)** |

### The spawn pair: the dune band

**A, grid x 0.1–1, y 0.34–0.50.** The mockup's lit diagonal is the run of 82–107.

| y | Mockup | r13 | r14 |
|---|---|---|---|
| 0.38 | 47 83 101 92 60 41 40 37 34 | 69 83 79 47 35 35 34 34 41 | 54 53 33 30 30 31 33 32 30 |
| 0.40 | 41 40 84 105 104 90 53 35 33 | 38 50 65 66 52 34 33 32 30 | 63 42 29 29 29 28 29 30 30 |
| 0.42 | 41 38 40 82 107 92 85 56 52 | 37 38 48 47 53 52 40 30 28 | 62 60 49 37 29 28 28 29 29 |
| 0.44 | 40 38 36 40 77 107 73 45 39 | 35 36 43 40 51 51 48 39 28 | 54 52 44 32 28 27 27 27 28 |
| 0.46 | 41 40 37 35 39 68 96 56 36 | 35 43 61 58 59 56 54 53 45 | 55 53 55 37 31 28 26 27 27 |

- **Grid r is +0.49 → +0.01** (|diff| 16.9 → 26.2). Over x 0–1, y 0.34–0.58 it is +0.37 → **−0.08**.
- The middle (x 0.3–0.7, y 0.38–0.48) is **33.3** against 71.7 (r13 51.6): the lit diagonal is gone.
- The left (x 0–0.3, y 0.40–0.50), which round 13 got right (39.5 against 39.6), is lit again at 52.9.
- The shade → lit edge no longer follows the mockup's line. At x 0.45 / 0.55 / 0.65 the mockup is 0.384 / 0.395 / 0.405
  (step +40); r14 is 0.482 / 0.492 / 0.498 (step +16).
- Over x 0.3–1, y 0.40–0.58, p5/50/95 are 24/38/73 against 32/41/119. The top 15 % are 107,69,49 against 183,103,59.
- **The skyline at x 0.97 is 0.343 against 0.345.** But there the new crest's shoulder stands over the far range, where the
  mockup shows the range.

**dusk-fire, the same grid.**
- **Grid r is +0.41 → +0.03** (|diff| 15.1 → 23.9). The wide band is +0.39 → +0.07.
- **The mound's face toward the camera** (y 0.36–0.40) is 29–35, against the mockup's 27–42. It matches now.
- **The lit mid swell** (y 0.42–0.47) is **27–30 against 54–66** (r13 28–59).
- **The bright near-left face** (x 0–0.3, y 0.40–0.50) is 41.8 against 67.1 (r13 51.7).
- p5/50/95 are 24/34/82 against 33/55/84.

### B

| Region | Mockup | r13 | r14 |
|---|---|---|---|
| Camp band, x 0–1, y 0.40–0.60: macro r | | +0.78 | **+0.70** |
| Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 39.6 | **60.2** |
| Right backdrop, x 0.65–1, y 0.42–0.47 | 60.4 | 43.7 | **76.3** |
| Glow x 0.05–0.35: peak, rows over 100 | 129, 82 | 90, 0 | **105, 6** |
| Glow x 0.72–0.90: peak, rows over 100 | 163, 82 | 89, 0 | **108, 18** |
| Wagon (mockup x 0.42–0.66, game x 0.49–0.71; y 0.40–0.50): mean, fine | 53.1, 11.9 | 27.3, 5.3 | **43.0, 6.1** |
| Mid sand, x 0–0.4, y 0.52–0.60 | 40.6 | 33.8 | **39.3** |

- B's camera looks at heading −57°, so the new key (+50°) comes from 107° to its right, from behind.
- **The backdrop dune** now takes the key on the faces toward the camera, so it is lit where the mockup's is a dark
  silhouette under the glow.
- **The glow, the wagon and the mid sand** all moved toward the mockup. Part of that is keyAt d^0.7: the key is 38 % more
  at dusk 0.5.

### C

| Region | Mockup | r13 | r14 |
|---|---|---|---|
| Right skyline (land starts), at x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | 0.469 / 0.466 / 0.463 / 0.430 (the hump) / 0.455 | 0.486 / 0.485 / 0.484 / 0.482 / 0.486 | **0.447 / 0.436 / 0.433 / 0.433 / 0.433** |
| Right rows, x 0.6–1, y 0.44–0.47 | 93 78 46 | 90 96 115 | **36 32 32** |
| Right band, y 0.40–0.56: macro r, \|diff\| | | +0.42, 25.9 | **+0.71, 21.8** |
| Left band, y 0.40–0.56: macro r, \|diff\| | | +0.76, 16.7 | **+0.85, 15.1** |
| Near ground, y 0.56–0.70: macro r, mean | 48.8 | +0.65, 36.5 | **+0.50, 52.0** |
| Flame (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 20 463 / 3 060 / 469 | **19 020 / 2 676 / 392** |

- **The right side** is the authored crest's far end, 113 m out, carrying waymark 0. Its form now matches: the band r is
  +0.71, and a waymark stands on a rise.
- **It stands 0.02–0.035 of the frame too high,** and covers the mockup's glow band at y 0.44–0.47 (32 against 93 / 78).
- **The pool at the plinth** now reads as an orange floor.
- **The fire** is unchanged (row 6 is open).

### D

| Region | Mockup | r13 | r14 |
|---|---|---|---|
| Land y 0.52–0.62, left / right half | 16.0 / 16.0 | 33.5 / 24.8 | **36.7 / 26.5** |
| Land macro r, x 0–0.4 / x 0–1, y 0.50–0.66 | | −0.30 / +0.02 | **−0.49 / +0.06** |
| Afterglow, column x 300–500: peak at y, rows over 100 | 170 at 0.497, 121 | 175 at 0.482, 82 | **178 at 0.482, 85** |

The bands are not authored. The land rows from y 0.50 to 0.71 are a flat 34–38, where the mockup runs 87 18 16 … 13 32
64 63 56 52: dark bands with a lit stripe at y 0.64–0.66.

### The glove and the loop (row 4, every view)

| | Mockup D | r13 | r14 |
|---|---|---|---|
| Leather: D's back of glove (590,1130)–(740,1260) against the game's fist (520,1090)–(700,1300): Y mean, p95, fine | 30.4, 79, 8.2 | 31.2, 56, 4.1 (box 600–780 × 1130–1330) | **24.7, 51, 3.4** |
| Glove box (600,1130)–(780,1330), p95: D / A / dusk-fire | 71.6 / 97.3 / 89.9 | 55.5 / 79.4 / 79.7 | **45.9 / 72.7 / 74.9** |

**The fist's place on screen** (read on the sheets and the full-res frames):
- **The game.** The handle's top is at y ≈ 0.56, and the knuckles run y ≈ 0.61–0.80, x 0.58–0.95.
- **The mockups.** The top of D's fist is at y ≈ 0.65, with the cuff leaving the right edge. A's and dusk-fire's fists
  sit at y ≈ 0.71–0.73.
- **r13.** The glove's top was at about 0.68.

**How it reads:**
- **The hand.** It is turned palm-and-fingers to the camera: four stacked, rounded finger bands, a pale grey-brown tint
  (material colour 0.78, 0.72, 0.66), and the cord drawn over the fingers. Every mockup shows the back of the hand with
  creased, stitched dark leather.
- **The "one loose loop" never shows as a loop.** In all five views the cord rises from the handle to y ≈ 0.55, kinks,
  arcs left and leaves the frame at the bottom near x 0.2. `LOOP.c` (−1.05, −0.1) with ry 0.95 puts the loop's body under
  the HUD bar.
- **What the mockups show.** dusk-fire has one long closed loop at x 0.40–0.78, y 0.62–0.85. A, B and C have two broad
  coils. D has slim loops beside the fist.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.2** | 1. **The mid swell and the near-left face are in shade (x 0–1, y 0.40–0.50).** A regression. The lit swell is 27–30 against 54–66, and the near-left face 41.8 against 67.1. Grid r is +0.41 → +0.03, macro r +0.59 → +0.45. Only the mound's shaded face (y 0.36–0.40) matches. 2. **The near sand (y 0.56–0.86).** A regression. It is 45 against 75 (r13 matched it at 76), a dark red-brown corduroy (77,38,21 against 114,67,38; ripple 18.5 % against 10.4 %). 3. **The viewmodel and the sky.** A bulky front-on fist at x 0.58–0.95, from y 0.56, with an open cord arch. The mockup has one long closed loop and a dark glove low in the corner. Sefa is at the left edge (row 9 is not in this capture). The sky is unchanged: the orange-pink right bank, sky box 99.8 against 75.9. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.1** | 1. **The lit diagonal is gone (x 0.3–1, y 0.38–0.48).** A regression. The middle is 33.3 against 71.7 (r13 51.6), and grid r is +0.49 → +0.01. 88 % of the right half's ground at 25–110 m is in the crest's own cast shade, because the key runs 9–13° from the crest line. The left (x 0–0.3) is lit again: 52.9 against 39.6. 2. **The near sand (y 0.56–0.86).** It is 45.9 against 57.2. That is nearer in mean than r13's 77.4, but it is near-black corduroy, p5 11 against 32. 3. **The viewmodel and the composition.** The mitten fist and its cord arch fill x 0.2–0.95, y 0.55–0.86, where the mockup has two low coils and a half-hidden glove. Sefa and her label are at x 0.1–0.3. The crest's shoulder covers the far range at the right edge. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.1** | 1. **The backdrop is lit (x 0–0.2 and x 0.65–1, y 0.42–0.48).** 60.2 / 76.3 against 39.4 / 60.4: the new key lights it from behind the camera. Round 13 matched the left at 39.6. 2. **The glow (y 0.40–0.46).** Better: peaks 105 / 108 against 129 / 163 (r13 90 / 89), but 6–18 rows over 100 against 82. 3. **The values and the viewmodel.** Better: the wagon is 43.0 against 53.1 (r13 27.3), and the near sand 29.2 against 39.8. The fist and the cord arch fill the lower right, where the mockup has two broad coils. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.1** | 1. **The right horizon (x 0.6–1, y 0.43–0.47).** Its form is now right: the band r is +0.42 → +0.71, and a waymark stands on a rise. But the rise stands 0.02–0.035 too high (skyline 0.433–0.447 against 0.455–0.469) and covers the glow band (32 against 93 / 78). 2. **The fire (x 0.25–0.5, y 0.20–0.53).** Repeated. It is 1.4× the mockup's area, with its white core at 14 % (392 against 2 722 pixels over 245), and no logs. 3. **The ground and the viewmodel.** The ground is back from round 13's cut: the near ground is 52.0 against 48.8, the patch 41.1 against 33.0, with an orange pool at the plinth. The fist and the cord arch stand where the mockup has two broad low coils. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.8** | 1. **The hero hand (x 0.55–1, y 0.55–0.86).** Row 4's own reference view. A front-on pale mitten, its knuckles from y 0.61, with leather fine 3.4 against 8.2 and p95 51 against 79. The cord is drawn over the fingers, and its open arch runs to the bottom-left. The mockup has the back of a creased, stitched dark gauntlet from y 0.65, the cuff leaving right, and slim closed loops beside it. 2. **The land (y 0.50–0.70).** Repeated. No transverse bands: the left is 36.7 against 16.0, with macro r −0.49 at x 0–0.4. 3. **The near sand.** Better: 32.8 against 35.9 (r13 25.5). The afterglow is unchanged and close (peak 178 against 170, 0.015 high). |

**Seat score, Signal Dunes: (6.2 + 6.1 + 7.1 + 7.1 + 6.8) / 5 = 6.66 → 6.7.**
- This seat's earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9.
- The late views gained: C +0.2, D +0.1, B −0.2.
- The spawn pair, Jake's pick and the spawn view, lost what round 13 had gained (−0.8 and −0.6). The cause is the key's
  78° swing.

## The builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The crest runs from (70,−50) at 30 m down to (8,26) at 14 m. | **True in source; the bake peaks at 25.2 m** | `LANDFORMS.crests`. Along the line the bake reads 21.7 (70,−50), 25.2 (62,−40 to 54,−31), 22.7 (39,−12), 11.6 (8,26). The crest only pulls the field up by its profile, so 30 m is never reached. |
| The slip face is downwind (`leeSide 1`, 56 m); the windward face, 80 m, is toward the camera. | **True** | Cross-section at (54,−29): the spawn side rises 12.7 → 25.2 m over 60 m (≤ 21°); the far side falls to 15.2 m in 40 m, with a 28° step. |
| "The key crossing it" | **False** | The key's heading is +50°; the crest segments run 13° and 9° from it. The README doesn't list the `KEY.dir` change. Cast shade covers 88 % of A's right half (old key: 28 %). |
| The dune sea's relief is back. | **Mostly not** | Outside 100 m of the crest and 80 m of the mound, ground steeper than 15° is **14.8 %**: r13 13.7 %, r12 22.9 %. The max slope is 39.3°, none over 40°. |
| The heights are "all as round 12 except the tower". | **Partly** | Spawn 19.50, B 14.54 and D 25.90 agree. C is 15.32 against r12's 10.85 (it is round 13's). Waymark 0 is 25.21 against r12 9.21 and r13 0.13. |
| The late-dusk cut acts only where toGlow < −0.1 and the tilt is > ~12°. | **True; the fix holds** | `smoothstep(−0.3, −0.1, toGlow) × smoothstep(0.2, 0.35, \|n.xz\|)`. The near sand is C 18.7 → 41.1, D 25.5 → 32.8, B 25.5 → 29.2. The clip's ground is 25–33 and its far land 29–33 (r13 20–23), with pixels under 5 at 0.06–0.17 %. |
| The low-sky stripe is at 0.01 % in h4 and 0.04 % in h2. | **True in the sky band** | Over y 0.15–0.45, B < 30 & R > 100: h4 0.001 %, h2 0.010 %. Round 13 seat A's B < 10 & R > 60: h4 3.08 → 0.00 %, h2 1.07 → 0.74 %. |
| Row 2: ripples gone on slip faces and fading past 35–110 m; macro albedo; a sheen. | **True in source. On screen, the fade works far and the near ripple got stronger** | h4's absolute ripple energy fell 35–58 % (7.55 → 4.93, 9.78 → 4.11). The spawn pair's near patch is 18.5–19.2 % relative against the mockups' 10.1–10.4 % (r13 4.2–4.8 %). |
| Row 2's clean patch: dusk-fire 74.6, A 77.0, B 32.4, C 34.8, D 36.8 (in the plan's Status). | **Not this build** | Measured on the commit's own box, the capture reads **44.1 / 44.8 / 29.6 / 40.0 / 32.6**. The numbers predate 5db840110's key swing. |
| Row 4: glove-hd3, one loose loop, the hold 0.22 m lower in the lower right. | **Model and loop true; "lower" false** | `HD_GLOVE` goes from size 0.3 / pos y −0.245 to **size 0.22** / pos y **−0.20**: 0.045 higher. The "0.22" is the size. On screen the fist's top rose from about 0.68 to about 0.61. The loop is not visible as a loop in any frame. |
| No camera re-aimed. | **True** | `cameras` is identical, and every camAt `dir` and `fov` is identical. Only the eye heights moved, and all are 1.70 m over the r14 bake. |

**The lead's note on h3** (its real camera rose 25 m):
- Waymark 0 at (58,−34) now stands on the crest top at 25.21 m, on its flat pad (slopes 1–5° on an 8 m ring).
- It is reached on grades of at most 20.3° from the spawn → well trail at (44,40), and 25.1° from the well.
- h3 shows it over a low horizon. It is sensible, walkable terrain.

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R14B-1 | dusk-fire, A (and B's backdrop) | **must-fix** | **regression** (5db840110 `KEY.dir`) | A x 0.3–1, y 0.38–0.48; dusk-fire x 0–1, y 0.40–0.50; near patch | **The 78° key swing put both spawn views' dune band and near sand in shade.** Grid r is A +0.49 → +0.01 and dusk-fire +0.41 → +0.03. The near sand is 45 / 46 against 75 / 57. The key runs 9–13° from the crest line, so the crest's 25 m far end shades 88 % of A's right half. **Fix: choose the key and the crest together, by measurement, before the capture.** (1) Keep the key's heading within about 15° of the afterglow (+11.5°): today it is 39° off, and B is now lit from behind. (2) Swing the crest, not the key, so it crosses that heading at ≥ 45°, with its sunlit face visible from the spawn eye (21.2 m). (3) Ray-march the bake toward the key, as done here: A's 25–110 m view should be ≤ about 30 % in cast shade (r13 28 %). (4) Accept only when the A grid is ≥ +0.49, dusk-fire's ≥ +0.41 and the near patch is within 5 of 57 / 75. Name any `KEY` change in the README. |
| R14B-2 | all five, D first | should-fix | **new** (row 4) | x 0.2–1, y 0.55–0.86 | **The new viewmodel reads as a front-on mitten, and its loop is off screen.** Fist top about 0.61 against D 0.65, A and dusk-fire 0.71–0.73. Leather fine 3.4 against 8.2, p95 51 against 79. The cord is drawn over the fingers. Fix: (1) turn `HD_GLOVE.rot` so the back of the hand and the cuff face the camera, the cuff leaving the right edge, as in D; (2) lower `pos.y` so the fist's top sits near 0.70; (3) bring `LOOP.c` up and in, so one whole closed loop sits at x 0.40–0.78, y 0.62–0.84 beside the fist (dusk-fire and D), with the cord leaving behind the fingers; (4) drop the 0.78, 0.72, 0.66 grey tint toward D's leather (median 39,21,18) and keep the texture's creases. Judge on D's crop. |
| R14B-3 | dusk-fire, A | should-fix | **new** (row 2 near field) | patch x 10–160, y 1160–1400 | **The near ripple is now 1.8–1.9× the mockups' contrast** (18.5–19.2 % against 10.1–10.4 %; p5 10–11 against 32–46). Fix: halve `0.5 * sin(sandPhase) * sandRip1` in the near band (the fade-out with distance already works, h4 −35 to −58 %). Judge on this patch: relative ≈ 10 %, p5 ≥ 30, keeping fine ≈ 9.5. Re-measure after R14B-1, since the troughs deepen in grazing light. |
| R14B-4 | C | should-fix | **new** (overshoot of R13B-4) | x 0.6–1, y 0.43–0.47 | **C's right rise is too high.** Skyline 0.433–0.447 against 0.455–0.469, hiding the glow band (32 against 93 / 78). It is the crest's far end, 113 m away. Fix: lower the crest's peak at waymark 0 by about 3 m (0.025 of a 72° frame at 113 m ≈ 2.8 m), from 25.2 to about 22. That also shortens the cast shadow in R14B-1. Keep waymark 0's pad and the ≤ 25° approaches. |
| R14B-5 | B | should-fix | **regression** (key) | x 0–0.2 and x 0.65–1, y 0.42–0.48 | **B's backdrop is front-lit** (60 / 76 against 39 / 60): the key comes from behind the camera's right. It resolves with R14B-1's key near the glow. Keep d^0.7's gains (glow 105 / 108, wagon 43). |
| R14B-6 | D | should-fix | **repeated** (R13B-5) | x 0–1, y 0.50–0.70 | **D's transverse bands are still not authored** (left 36.7 against 16; macro r −0.49). Fix: LANDFORMS crests running across D's line of sight, their lee faces toward the camera, with lit rims at y 0.64–0.66. |
| R14B-7 | C | should-fix | **repeated** | x 0.25–0.5, y 0.20–0.53 | **The fire** is 1.4× the mockup's area, with its core at 14 %. Plan row 6. |
| R14B-8 | dusk-fire, A | should-fix | **repeated** (R13B-7) | sky y 0.12–0.36 | **The sky** is unchanged: sky box 99.8 against 75.9 in dusk-fire, with the orange-pink right bank. Plan row 5. |
| R14B-9 | process | nit | **new** | README, plan Status | (1) The README leaves out the `KEY.dir` change, which moved more pixels than anything else this round. (2) The plan's row-2 clean-patch numbers and "the key crossing it" don't hold for the captured build. (3) "The hold 0.22 m lower" is the glove's new size; the hold rose 0.045. Quote numbers measured on the capture's SHA. |

## Ledger 5 (no shortcuts)

- **Views:** no re-aim. `cameras` is identical, and every camAt `dir` and `fov` is unchanged. The eye heights moved with
  the ground, as the README lists: spawn +2.48, B and h2 +9.2, C −0.49, h3 +25.07.
- **No screenshot cheats:**
  - The crest is real, baked terrain. Max slope 39.3°, none over 40°, and the navmesh was re-baked with a 40° limit.
  - The key, the material and the viewmodel are global. The viewmodel is one hold, identical in all five views.
- **Staged state:** `staged` is unchanged (`logbook`, and `waymarks-lit` ×2). ea0b3939a touched `dusk.ts` (keyAt, global
  and monotonic, reached by play); no stage handler logic changed.
- **No narrowing:**
  - The late clip holds: ground 25–33, far land 29–33, pixels under 5 at 0.06–0.17 %.
  - h3's waymark is still reachable (above).
  - Outside the landforms the field is not flatter than round 13 (steeper than 15°: 13.7 → 14.8 %), but it is still flatter
    than round 12's 22.9 %.
- **Device and HUD:** 390×844 touch, stored 780 wide, with the baseline HUD in every frame. `pageErrors: []`; QA retakes
  none.
- **Budgets:** gpuMB was re-recorded at +5 KB for glove-hd3. Device memory and frame times are not on this surface:
  unverified, not breached.
- Sefa still stands 8 m ahead in A and dusk-fire. Row 9 (a1aa357f7) landed after this capture; it is not a breach.

No score is voided.

SCORE signal-dunes: 6.7

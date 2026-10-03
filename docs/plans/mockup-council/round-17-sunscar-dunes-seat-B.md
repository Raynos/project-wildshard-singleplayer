# Round 17, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 and phase amendments), the brief, `scores.md` (with the
  restated camera-distance rule), and round 16's three Signal Dunes seat files.
- The "Signal Dunes, round 17" section of `art/mockup-council/round-17/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0947-8c70feaf/` (`mock-*`, h1–h4, both aerials, `clip.mp4` at 1 fps,
  `meta.json`), against round 16's `20261003-0918-232dbb40/` and round 13's `20261003-0648-50cd2d82/`.
- The five ledger mockups, Lanczos-scaled to 780×1688. The builder's overlay `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r17.jpg`.

Source checks (read-only `git show`): 8c70feaf2 and 1e61d12f1 (`layout.ts`, `look/render.ts`, `weapons/whipModel.ts`,
`quest/scout.ts`), `look/render.ts` at 8c70feaf in full for the sand terms, and `world/dunes.ts` / `KEY` at 50cd2d82 and
8c70feaf. The terrain bakes at 50cd2d82, 232dbb40 and 8c70feaf, decoded as the first 256² float32 after the 24-byte
header, x and z over −250..250. Every scored and hero eye sits 1.69–1.71 m over the decoded r17 ground, so the decode is right.

How I measured. These are round 16 seat B's tools, and its r16 numbers reproduce within 0.2 (A diagonal 32.0, A band 36.3,
B glow 61.3, C glow 30.4, clean patches 64.6 / 62.3 / 31.7 / 36.8 / 32.1, glove 38.0 / 60 / 3.6):
- **Brightness** is Rec. 709 luma. **Fine** is the mean |luma − luma blurred at σ 2|. **Ripple %** is the mean
  |blur σ1 − blur σ5| as a percentage of the region's mean. **Sat** is the mean (max − min) / max.
- **Grid r** is the Pearson r of a 10 × 7 grid of σ-12 luma over x 0–1, y 0.36–0.58 (the builder's grid; it gives r16's
  +0.46 / +0.14 exactly). **Band r** is the same over y 0.36–0.50 only. **Row-demeaned r** removes each row's mean first,
  so it asks only "is the left/right light in the same place".
- **The clean patch** is x 10–160, y 1160–1400, clear of the coil, its fall, the fist and the HUD in all five views.
- **Regions** are frame fractions (x left → right, y top → bottom) or pixel boxes on the 780-px frame.

## What changed (r16 → r17)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky above y 0.33 |
|---|---|---|---|
| dusk-fire | 13.4 | 22.3 % | 9.1 |
| A | 12.4 | 21.6 % | 8.2 |
| B | 3.6 | 2.8 % | 1.4 |
| C | 8.2 | 8.6 % | 2.3 |
| D | 4.2 | 5.0 % | 1.2 |

The sky moved 8–9 in the spawn pair: that is the LUT coming out (`lut: null`), which the README lists.

## Measurements (mockup / r13 / r16 / r17)

### Near sand, clean patch

| View | Mean | p5–p95 | Fine | Ripple % | RGB / sat |
|---|---|---|---|---|---|
| dusk-fire | 74.8 / 75.8 / 64.6 / **67.0** | 46–113 / 53–92 / 35–85 / 37–88 | 9.7 / 5.2 / 7.7 / 8.1 | 10.7 / 4.9 / 8.6 / 8.8 | 114,67,38 0.67 / … / **100,60,38 0.63** |
| A spawn | 57.2 / 77.4 / 62.3 / **64.5** | 32–94 / … / 33–83 / 35–86 | 9.4 / 4.9 / 8.1 / 8.4 | 10.4 / 4.4 / 10.1 / 10.2 | 87,50,35 0.59 / … / 99,57,35 0.65 |
| B logbook | 39.8 / 25.5 / 31.7 / **33.8** | 31–49 / … / 20–43 / 22–45 | 2.0 / 2.4 / 2.9 / 2.9 | 4.7 / 9.1 / 9.5 / 8.9 | 63,34,27 / … / 58,28,22 |
| C waymark | 33.0 / 18.7 / 36.8 / **38.5** | 28–37 / … / 27–45 / 30–46 | 0.2 / 1.0 / 1.7 / 1.8 | 1.2 / 7.9 / 4.9 / 4.9 | 54,28,22 / … / 64,32,27 |
| D hands | 35.9 / 25.5 / 32.1 / **34.0** | 25–48 / … / 25–39 / 27–40 | 0.2 / 1.2 / 1.4 / 1.3 | 1.1 / 5.0 / 5.0 / 4.6 | 53,32,28 / … / 57,28,25 |

- The LUT's removal gave back about 2 luma on every patch. B is still 6 under (33.8 against 39.8) and dusk-fire 8 under;
  C moved 1.7 further over (38.5 against 33.0). Round 16's "the LUT dropped B ~7" does not reproduce: most of B's drop stays.
- Near grain and ripple hold (A 10.2 % against 10.4 %, fine 8.4 against 9.4).

### The spawn pair: the dune band

| Region / metric | Mockup | r13 | r16 | r17 |
|---|---|---|---|---|
| A lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 50.7 | 32.0 | **47.6** |
| A band, x 0–1, y 0.38–0.56: mean | 56.1 | 57.4 | 36.3 | **65.0** |
| A right under the crest, x 0.5–1, y 0.48–0.54 | 42.5 | 69.3 | 29.6 | **78.4** |
| A left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 39.5 | 35.4 | **56.1** |
| A tower's mound, x 0.35–0.65, y 0.36–0.40 | 57.3 | 45.1 | 35.9 | 47.4 |
| A far strip right, x 0.6–1, y 0.37–0.40: mean / ripple % | 40.5 / 5.3 | 37.3 / 5.1 | 35.2 / 0.9 | **67.4 / 11.0** |
| A share over 80 / over 65 (y 0.36–0.56) | 22.7 / 28.1 % | 15.8 / 38.0 % | 2.0 / 8.1 % | **22.3 / 44.9 %** |
| A shade share (Y < 45, y 0.38–0.58), left / right half | 51 / 61 % | 38 / 30 % | 68 / 90 % | **11 / 34 %** |
| A grid r / band r / row-demeaned r | | +0.34 / +0.38 / +0.44 | +0.46 / −0.00 / +0.34 | **−0.05 / −0.13 / −0.37** |
| dusk-fire lit left shoulder, x 0–0.2, y 0.40–0.50 | 70.6 | 49.9 | 29.8 | **55.2** |
| dusk-fire lit swell, x 0–1, y 0.42–0.47 | 60.3 | 41.0 | 31.5 | 49.7 |
| dusk-fire saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 65.8 | 33.1 | **79.2** |
| dusk-fire lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 66.2 | 34.2 | **80.2** |
| dusk-fire far strip right, x 0.6–1, y 0.37–0.40: mean / ripple % | 34.5 / 4.9 | 40.3 / 6.9 | 36.2 / 1.7 | **79.0 / 10.7** |
| dusk-fire share over 80 (y 0.36–0.56) | 12.9 % | 9.6 % | 2.0 % | **26.5 %** |
| dusk-fire shade share, left / right | 15 / 42 % | 25 / 43 % | 85 / 88 % | **24 / 49 %** |
| dusk-fire grid r / band r / row-demeaned r | | +0.44 / +0.26 / +0.32 | +0.14 / −0.49 / −0.17 | **+0.03 / −0.27 / −0.34** |

**A, the 10 × 7 grid (y 0.36 → 0.58):**

| row | mockup | r17 |
|---|---|---|
| 1 | 52 64 87 74 55 43 41 46 49 46 | 55 54 58 59 49 49 59 73 77 79 |
| 2 | 42 42 51 **83 102 95 76** 53 38 35 | 59 65 70 62 47 39 41 47 67 70 |
| 3 | 33 40 38 39 62 **96 98 79** 51 47 | 41 60 63 65 68 59 47 40 40 39 |
| 4 | 37 41 40 37 37 44 **72 83** 59 40 | 43 58 59 57 58 57 65 81 75 38 |
| 5 | 63 57 47 40 42 39 36 42 55 60 | 53 61 62 63 67 68 66 78 95 56 |
| 6 | 89 92 89 75 54 41 36 34 34 35 | 69 73 75 78 80 82 85 90 101 101 |
| 7 | 82 86 90 97 102 95 77 56 41 35 | 71 75 78 80 86 91 96 100 106 110 |

- **The form is much better than round 16's wall; the light is in the mirror-image places.** The tower stands on its
  mound again (line of sight: the highest terrain on the spawn → tower line is −1.48°, the tower's foot −1.99°, so only
  ~1.3 m of the foot is hidden; r16 hid ~3.8 m and the mound), and the band shows two or three receding dune rows. The lit
  share now matches A (22.3 % against 22.7 %).
- But the mockup's lit sand is the diagonal (rows 2–4, x 0.3–0.8) and the bottom-left floor (rows 6–7, x 0–0.5); its
  shade is left-middle and right-bottom. The game's lit sand is upper-left (rows 2–4, x 0.1–0.3: 58–70 against 33–42)
  and bottom-right (rows 5–7, x 0.7–1: 78–110 against 34–60). Row-demeaned r is **−0.37 (A) and −0.34 (dusk-fire)**.
- **Why:** the crest constants are round 13's exactly (pts, w 70, lee 30, leeSide −1), and so is the wind, but the key
  is not. Round 13's `KEY.dir` was (−0.45, 0.2, −0.87); since round 15 it is (+0.39, 0.2, −0.90), back inside the glow.
  Round 13's crest was lit from the left; under the current key its other faces take the light. So "round 13's crest
  back" brought round 13's shapes but not round 13's light (r13 row-demeaned r +0.44 / +0.32; r17 −0.37 / −0.34).

**Lit-sand colour (the lead's "greyer, more beige") measured: saturation by luminance bin, y 0.38–0.62:**

| Y bin | 20–40 | 40–60 | 60–80 | 80–100 | 100–120 |
|---|---|---|---|---|---|
| A mockup | 0.25 | 0.32 | 0.61 | 0.66 | 0.68 |
| A r17 | 0.37 | 0.48 | 0.51 | 0.45 | **0.37** |
| dusk-fire mockup | 0.21 | 0.45 | 0.67 | 0.68 | 0.65 |
| dusk-fire r17 | 0.37 | 0.43 | 0.48 | 0.44 | **0.37** |

- In both mockups saturation **rises** with brightness: violet-grey shade (0.21–0.25), saturated orange light (0.65–0.68).
  In the game it **falls**: the shade is too colourful and the light goes grey. The top 15 % of A's band is RGB
  130,100,83 (G/R 0.77) against 178,101,59 (G/R 0.57). It holds at every distance row (y 0.38 → 0.70: sat 0.36–0.49
  against 0.55–0.69), so it is not the 80 m fog. It was the same in r13 (no LUT) and partly offset by the LUT in r16
  (0.46–0.56 in the lit rows). The brightness of the lit sand is right (top-20 % luma 97–117 against 88–119); the hue is not.

### B

| Region | Mockup | r16 | r17 |
|---|---|---|---|
| Skyline right of the wagon, x 0.75 / 0.82 / 0.88 / 0.94 / 0.98 | 0.437 / 0.438 / 0.438 / 0.431 / 0.418 | 0.440 / 0.437 / 0.432 / 0.429 / 0.428 | **0.440 / 0.448 / 0.456 / 0.455 / 0.456** |
| Glow right, x 0.72–0.90, y 0.40–0.47 | 87.5 | 61.3 | **76.0** |
| Land just under its own skyline, x 0.72–0.95 | 28.5 | 37.4 | **28.3** |
| Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 54.9 | 59.1 |
| Grid r / band r | | +0.89 / +0.83 | +0.85 / +0.77 |

- The glow came up (76 against 87.5; r16 61), and the backdrop under the skyline is the mockup's value (28.3 against 28.5).
- **It came up by lowering the skyline**: the right-hand ridge is now 0.017–0.038 of the frame too low, where round 16
  matched within 0.01. The mockup's dark ridge rising at the right edge (0.418) is gone.

### C

| Region | Mockup | r16 | r17 |
|---|---|---|---|
| Right skyline, x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | 0.468 / 0.466 / 0.462 / 0.430 (hump) / 0.454 | 0.450 / 0.444 / 0.435 / 0.430 / 0.430 | **0.488 / 0.486 / 0.486 / 0.483 / 0.488** |
| Glow, 0.003–0.03 above its own skyline, x 0.6–1 | 83.9 | 72.2 | **128.5** |
| Far land, 0.01–0.05 under its own skyline, x 0.6–0.9 | 16.2 | 26.3 | **33.8** |
| Far waymark flame | ≈ 0.885, 0.465 | 0.829, 0.428 | **≈ 0.83, 0.48** |
| Pool, (150,1060)–(450,1150) | 40.4 | 48.5 | 45.7 |
| Flame (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 11 285 / 1 795 / 129 | **22 237 / 2 366 / 130** |
| Grid r / band r | | +0.72 / +0.61 | **+0.44 / +0.07** |

- The rise overshot the other way: the right skyline is now 0.02–0.03 **low** (r16: 0.015–0.03 high). The glow band is
  uncovered but 1.5× the mockup's (128.5 against 83.9), and the land under it is twice as bright (33.8 against 16.2).
  The mockup's small hump under the far brazier is gone, and the far fire sits 0.015 under its brazier's place.
- The near flame is 1.6× the mockup's area with 5 % of its white core (130 against 2 722 over 245). No fire code changed;
  this is the animation phase, so I treat the size as noise and the missing core as the finding.

### D

| Region | Mockup | r16 | r17 |
|---|---|---|---|
| Rows x 0–0.49, y 0.47 → 0.71 step 0.015 | 140 153 67 16 16 14 13 24 13 13 13 50 61 52 47 46 43 | 129 41 30 35 33 34 36 37 37 37 36 36 36 35 33 34 34 | 150 45 31 35 35 36 37 37 35 36 36 36 36 37 36 35 34 |
| Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 36.0 | 36.8 |
| Land y 0.52–0.62, left / right | 16.0 / 16.0 | 36.0 / 25.8 | 36.4 / 30.4 |

D's land is unchanged: a flat 35–37 field against the mockup's dark 13–16 bands and its lit stripe at 50–61.

### The glove and the loop (every view)

| | Mockup D | r16 | r17 |
|---|---|---|---|
| Leather (mockup (590,1130)–(740,1260); r16 (470,1160)–(600,1300); r17 (430,1250)–(520,1350)): Y mean, p95, fine | 30.4, 79, 8.3 | 38.0, 60, 3.6 | **37.6, 65, 4.6** |
| Cord | leaves the fist into the loops | cut ≈ 0.06 short of the handle | **leaves the handle's top in all five views** |
| Pose | back of the hand and knuckles, stitched cuff, the coil hanging from the fist | thumb-up stub beside a ring | fist rolled, the handle leaning up-left, a teardrop loop rising from its tip; the finger rolls still face the camera |

- Round 16's cut cord is fixed. The leaning fist with a teardrop loop now reads much like dusk-fire's mockup (one
  teardrop loop rising from a low glove), and closer to D's.
- The back of the hand still does not face the camera (the builder's handoff says the model's pose is the limit). The
  leather is flatter than the mockup's (fine 4.6 against 8.3, p95 65 against 79), with no stitching.

### Sky

| Region | Mockup | r16 (LUT) | r17 (no LUT) |
|---|---|---|---|
| A sky, x 0.1–0.9, y 0.18–0.33: Y, chroma, red-orange share | 93.7, 80, 59.3 % | 86.0, 65, 58.7 % | 98.8, 67, 51.7 % |
| dusk-fire sky, same box: Y, chroma | 78.4, 50 | 90.1, 70 | **104.8, 73** |
| dusk-fire frame p99, rows 120–1400 | 141.5 | 131.5 | 150.6 |

With the LUT out, dusk-fire's sky is 26 too bright and more saturated than the mockup's amber-grey (r16 12 over).

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.3** | 1. **The light is mirrored in the dune band (x 0–1, y 0.38–0.58).** The forms are back (tower on its dark mound, receding rows, a lit left shoulder 55 against 71; shade share 24 / 49 % against 15 / 42 %), but the saddle (79 against 55) and lower right (80 against 46) are lit where the mockup is in shade; row-demeaned r −0.34. 2. **The colour (whole band).** The lit sand is grey-beige (top-bin sat 0.37 against 0.65; G/R 0.79 against 0.58), and the pale rippled far sheet right of the tower is back (79 against 34.5, ripple 10.7 % against 4.9 %). 3. **The sky (x 0–1, y 0.15–0.36).** 105 against 78 with the LUT out, purple-to-peach puffs against amber-grey filaments; no ray over the tower. Gains: no wall, the loop is one teardrop from a low glove as in the mockup. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.2** | 1. **The lit diagonal is still missing and the light is mirrored (x 0–1, y 0.38–0.58).** Diagonal 48 against 97 (r16 32); left lee 56 against 40, right under the crest 78 against 42.5; row-demeaned r −0.37. Gains: the tower's mound and the receding rows show, and the lit share matches (22.3 against 22.7 %). 2. **The colour and the far strip (x 0.6–1, y 0.37–0.46).** Lit sand grey-beige (130,100,83 against 178,101,59); the pale rippled far sheet is back (67 against 40, ripple 11 % against 5 %). 3. **The viewmodel (x 0.3–0.9, y 0.6–0.86).** One upright teardrop loop and a leaning fist with the fingers to the camera, where the mockup has two broad coils from the bottom edge over a half-hidden hand. The sky is close (99 against 94). |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The right skyline and glow (x 0.72–1, y 0.40–0.47).** The glow is up (76 against 87.5; r16 61), but only because the ridge is now 0.017–0.038 too low (r16 matched); the dark ridge rising at the right edge is gone. 2. **The near sand (y 0.69–0.83).** 33.8 against 39.8; the land left of the camp is still lit (59 against 39). 3. **The wagon and the viewmodel.** The wagon is unchanged (half the mockup's surface detail, a thin smoke arc); one teardrop loop where the mockup has two broad coils. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.7** | 1. **The right horizon (x 0.6–1, y 0.44–0.53). The rise overshot the other way.** The skyline is 0.02–0.03 low, the glow over it 128.5 against 84, the land under it 34 against 16, and the mockup's hump under the far brazier is gone. Grid r +0.44 (r16 +0.72). 2. **The fire (x 0.25–0.5, y 0.20–0.53). Repeated.** Tall cream tongues with 130 against 2 722 white-hot pixels, no logs, no billowing smoke. 3. **The ground and the viewmodel.** The near sand is 5 over (38.5 against 33.0); the pool is broad and pale (45.7 against 40.4). The cord is attached again. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.7** | 1. **The hero hand (x 0.55–1, y 0.6–0.86).** The cord now leaves the handle and the loop rises from the fist as in the mockup, but the finger rolls face the camera instead of the stitched back of the hand and cuff; leather fine 4.6 against 8.3. 2. **The land under the horizon (y 0.48–0.72). Repeated.** A flat 35–37 against dark 13–16 bands and a lit stripe at 50–61. 3. **The horizon.** The tower at the mockup's size under the HUD's "SIGNAL TOWER 200" label; a flyer crosses the left and the near waymark burns with a plume where the mockup has a tiny distant fire. |

**Seat score, Signal Dunes: (6.3 + 6.2 + 6.9 + 6.7 + 6.7) / 5 = 6.56 → 6.6.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4.
- Up 0.2. The spawn pair gained 0.4 and 0.3: the wall is gone, the mound and rows read, and the cord is fixed. They don't
  go further because the light falls in mirror-image places and the lit sand is grey. C lost 0.2 (the rise overshot the
  other way); D gained 0.1 (the cord and the loop).

## The builder's claims checked against the pixels and the source

| Claim (README / 8c70feaf2 / 1e61d12f1) | Verdict | Evidence |
|---|---|---|
| Round 13's low crest is back, mostly under the field; receding rows and the tower's mound show. | **True for the crest and the mound; not round 13's light** | `crests` is byte-for-byte round 13's. Line of sight: −1.48° ridge against the tower's foot at −1.99°. But `KEY.dir.x` is +0.39 (r13 −0.45), so the faces that were lit in r13 are now shaded: row-demeaned r A −0.37, dusk-fire −0.34 (r13 +0.44 / +0.32). |
| In-band r A +0.23, dusk-fire +0.30 (y 0.36–0.58). | **Does not reproduce** | On the 10 × 7 grid that gives r16's +0.46 / +0.14 exactly: **−0.05 / +0.03**. On nine other grids (5 × 4 to 20 × 11, σ 0–12, y 0.36–0.58 / 0.38–0.56 / 0.40–0.58): −0.14 to +0.05. Over y 0.36–0.50: −0.13 / −0.27. Pixel-level at σ 4–16: −0.03 to +0.03. No script or ROI is named. |
| A's lit box 52 (r16 32; mockup 77 on the builder's box). | **Roughly** (box not named) | The seats' diagonal box: 47.6 (r16 32.0, mockup 96.7). |
| Lit share 19–22 % (mockups 15–25 %). | **True for A, high for dusk-fire** | Over 80, y 0.36–0.56: A 22.3 % against 22.7 %; dusk-fire 26.5 % against 12.9 %. |
| Band spread 66–76 (mockups 64–83). | **True** | p5–p95, y 0.38–0.58: A 36–106 (70) against 32–116 (84); dusk-fire 35–115 (80) against 30–94 (64). |
| B's dune 150 m out along its view, 17 m, under the glow. | **True; it now sits too low** | The bake reads 17.0 m at (−165, −64), 150 m from B's eye. Skyline 0.440–0.456 against 0.418–0.438 (r16 0.428–0.440). Glow 76 against 87.5. |
| Waymark 0's rise 18 m, r 46, so C's skyline uncovers the glow. | **True; overshot the other way** | Skyline 0.483–0.488 against 0.454–0.468; glow 128.5 against 83.9; far land 33.8 against 16.2. h3's eye fell 6.00 m with it (disclosed). |
| The LUT is out of the grade. | **True** | `lut: null`; the sky moved 8–9 luma in the spawn pair; near patches +2. dusk-fire's sky 105 against 78 (r16 90). |
| The grain and glint fades subtract the tile's own means; the procedural glint is zero-mean. | **True by construction** | `meanR` and `meanGlint` are summed from the tile's own bytes with the shader's smoothstep pair; the `DataTexture` has no colour space, so the shader samples those same values. The procedural glint subtracts 0.015 from `step(0.985, hash)`. The `max(0.2, …)` clamp can't trigger (the grains reach at most ±0.73). Residuals: the glint pair on mip-filtered texels and the faded bump / relief normals are not mean-exact, both well under 1 luma. |
| The late facing windows are back near round 14's. | **True; the clip reads** | Late clip ground (y 0.55–0.90, 1 fps): 31.9, 34.8, 34.5, 34.3, 34.4, 33.9, 32.5, 30.0, 26.7, 24.1 (r16 30.0 → 25.3); 0–1 % of the mid band under luma 8. |
| The sheen lights only faces with the sun behind or beside the viewer. | **True; angle only** | `sheenSide` uses the direction to the camera, not its length. |
| Sefa at 8 m, right and behind; the tracker reads "SEFA 8 M". | **True** | `SCOUT_AT` (+7, +4). She is out of both spawn frames; the tracker reads "SEFA 8 M". |
| The cord's start scaled with the glove's 0.82 width, so it meets the handle's top. | **True** | `LOOP.from` (−0.53, 0.95, 0.19) → (−0.435, 0.95, 0.156); attached in all five views. |
| The fist rolled 0.5, back of the hand to the camera, a teardrop loop rising from it. | **The roll and the loop: true. The back of the hand: no** | The finger rolls still face the camera (D crop x 0.55–0.75, y 0.68–0.80). The handoff concedes it needs a re-posed model. |
| No camera moved; no dusk, stage or curve change. | **True** | `cameras.json` unchanged. Eyes 1.69–1.71 m over the r17 bake; C's +1.95 m and h3's −6.00 m are the ground moving. No stage handler or `dusk.ts` edit. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R17B-1 | A, dusk-fire (h1, first-frame) | should-fix | **new** (the cause); the missing lit diagonal is **repeated** (rounds 9–16) | A x 0–1, y 0.38–0.58; dusk-fire x 0–1, y 0.38–0.58 | **Round 13's crest is lit by round 15's key, so the light is mirrored.** The forms are right, but the lit and shaded faces are swapped: A's left lee 56 against 40, right under the crest 78 against 42.5, the diagonal 48 against 97; dusk-fire's saddle 79 against 55, lower right 80 against 46. Row-demeaned r −0.37 / −0.34 (r13, same crest under the old key, +0.44 / +0.32). **Fix:** keep the key in the glow and re-author the crest for it. The face along the mockup's diagonal must face the key, and the faces at A's left-middle and lower right must face away. Test offline by rendering the spawn eye under the current key, before the capture. **Accept:** A's diagonal box ≥ 75, left lee ≤ 45, right under the crest ≤ 50; dusk-fire's saddle ≤ 60, lower right ≤ 55; **row-demeaned r ≥ +0.3** in both. Keep the tower's mound in view (ridge angle under the foot's −1.99°). Use row-demeaned r as the acceptance test, because the whole-frame grid rewarded a dark band over a bright floor in r16 and misses mirroring now. |
| R17B-2 | A, dusk-fire (B, C lit faces) | should-fix | **repeated** (seat C r3, R16B lit-band sat), **exposed again** by the LUT coming out | the lit sand, y 0.38–0.70 | **The lit sand's saturation falls with brightness where the mockups' rises.** By luma bin 20–40 / 60–80 / 100–120: mockups 0.21–0.25 / 0.61–0.67 / 0.65–0.68; game 0.37 / 0.48–0.51 / 0.37. The top 15 % of A's band is 130,100,83 against 178,101,59. It holds at every distance row, so it is not the 80 m fog. **Fix:** put chroma into the light and take it out of the shade. Saturate the key's colour toward the mockups' lit RGB (G/R ≈ 0.57, B/R ≈ 0.33), keeping its luminance so the lit luma (97–117, right now) holds. Pull the shade fill toward a cooler, greyer violet (shade sat ≈ 0.25). If AgX is greying the highlights, re-fit the LUT on this round's frames with a saturation-by-luminance target, not a mean shift. **Accept:** the 100–120 bin's sat ≥ 0.6 and the 20–40 bin's ≤ 0.3 in both spawn views, with the near patches within ±3 of now. |
| R17B-3 | A, dusk-fire | should-fix | **regression** (round 15's pale sheet, hidden by r16's wall, exposed by the lower crest) | x 0.6–1, y 0.37–0.46 | **The pale rippled far sheet right of the tower is back.** A 67 against 40.5 (ripple 11 % against 5.3 %); dusk-fire 79 against 34.5 (10.7 % against 4.9 %). In the mockups these are dark receding slip faces. **Fix:** the far rows' faces there turn to the key. Darken them by facing (the late `away` window, or the sheen's new side gate reaching them) or by lower far-row relief so their slip faces dominate. Never by distance. **Accept:** both strips ≤ 45 with ripple ≤ 6 %. |
| R17B-4 | C | should-fix | **regression** (overshoot the other way) | x 0.6–1, y 0.44–0.53 | **Waymark 0's rise is now too low.** The skyline is 0.483–0.488 against 0.454–0.468 (r16 0.430–0.450, too high), the glow over it 128.5 against 84, the land under it 34 against 16, and the hump under the far brazier is gone. **Fix:** about halfway between r16's 24 m / r 66 and r17's 18 m / r 46: about 21 m at r ≈ 40, so the hump is local. Darken the far land under the glow by facing. **Accept:** skyline 0.455–0.469 at x 0.6–0.8; glow above it 75–95; far land ≤ 22; far fire ≈ (0.885, 0.465); slopes ≤ 25°. |
| R17B-5 | B | should-fix | **new** (regression of r16's match) | x 0.75–1, y 0.41–0.46 | **B's ridge is now 0.017–0.038 too low.** Round 16 matched within 0.01. The glow gain (76) came from uncovering more sky, not from a brighter glow. **Fix:** at 150 m, 0.02–0.03 of the 72° frame is ≈ 4–5 m: raise the (−165, −64) mound from 17 to about 21 m, rising toward the right edge as the mockup's ridge does. Brighten the glow in the dome at B's azimuth (row 5's parked painted sky) instead. **Accept:** skyline 0.418–0.440 at x 0.75–0.98, glow ≥ 80, land under it 25–32. |
| R17B-6 | all five, D first | should-fix | **repeated** (R16B-5, R15B-7) | x 0.55–1, y 0.6–0.86 | **The grip.** The cord is fixed and the loop rises from the fist, but the finger rolls face the camera; the mockup shows the stitched back of the hand and cuff. Leather fine 4.6 against 8.3, p95 65 against 79. **Fix:** the re-posed glove model the handoff names (knuckles and back of the hand to the camera, cuff leaving the right edge), with crease and stitch normal detail. Keep the r17 handle top as the cord's anchor and add a 1 cm check on it. |
| R17B-7 | A, B (the near sand), C | should-fix | **repeated** (R16B-7) | clean patch x 10–160, y 1160–1400 | **B's near sand stays 6 under and C's 5 over, LUT out.** B 33.8 against 39.8; C 38.5 against 33.0; A 64.5 against 57.2. Removing the LUT only returned 2, so round 16's ~7 drop was not mostly the LUT. **Fix:** check the key's N·L and `away` on B's floor (the flipped wind changed its facing); bring B to ~39 without lifting C. |
| R17B-8 | C, dusk-fire | should-fix | **repeated** (row 6) | flame x 0.25–0.5, y 0.20–0.53 | The white core is 130 against 2 722 pixels over 245, with no logs or billowing smoke. Row 6 (parked). |
| R17B-9 | dusk-fire (A) | should-fix | **regression** (the LUT out) | y 0.15–0.36 | **dusk-fire's sky is 26 too bright** (105 against 78; r16 90), chroma 73 against 50. **Fix:** close it in the dome, not the grade (row 5's painted skies): darker, greyer amber banks and fine filaments at dusk-fire's heading. A's sky is close (99 against 94); keep it. |
| R17B-10 | D | should-fix | **repeated** (R16B-9) | y 0.48–0.72 | **Flat 35–37 land against dark 13–16 bands and a lit stripe at 50–61.** **Fix:** transverse crests seen from (38, 122), slip faces toward the camera, a lit windward rim before them. Height and facing only. |
| R17B-11 | process | nit | **new** | the builder's numbers | The "in-band r +0.23 / +0.30" reproduces on no grid I tried (−0.14 to +0.05). Quote the script and the ROI with each number (as measure.py does for the near patch), and add row-demeaned r to the overlay's acceptance. |

## Ledger 5 (no shortcuts)

- **The camera-distance rule (restated in round 16): no breach.** No term changes brightness by camera distance:
  - The grain octaves and the glint pair subtract the tile's own measured means.
  - The procedural glint is zero-mean on a uniform hash.
  - The ripple term was already exactly zero-mean.
  - The residuals (mip-filtered glint pair, faded bump / relief normals) are detail fades, well under 1 luma.
  - `sheenSide` and `away` depend on angle and facing.
  - The late clip's ground holds at 24–35 with nothing near-black.
  - The engine fog's late lerp is outside the rule.
- **Views:** no `cameras.json` change. Every eye is 1.69–1.71 m over the decoded r17 ground; C's +1.95 m and h3's
  −6.00 m are the bake moving under fixed x/z, and both are disclosed. No breach.
- **No screenshot cheats:** the crest, the B mound and the waymark-0 rise are baked terrain, re-baked with the navmesh.
  The grade (now none), the sand shader and the viewmodel are global; the viewmodel is one hold in every view. The B mound
  and the waymark rise are still placed for a frame (repeated should-fix, rounds 13–16). They are walkable: inner max slope
  39.2°, none over 40°.
- **No narrowing:** the aerials show one dune sea, and relief is unchanged (faces over 15°: 24.6 %, r16 24.2 %, r13
  20.0 %). h1–h4 hold, and the late clip reads. The aerial-overview's dark crater ovals round the mounds remain.
- **Staged state:** unchanged (`logbook`, `waymarks-lit` ×2). 8c70feaf2 edits no stage handler; Sefa's 2–3 m move is
  play state from the first frame.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD and the 30 fps chip, `pageErrors` empty, no
  QA retakes. Memory and frame times are not on this surface: unverified, not breached.

No score is voided.

SCORE signal-dunes: 6.6

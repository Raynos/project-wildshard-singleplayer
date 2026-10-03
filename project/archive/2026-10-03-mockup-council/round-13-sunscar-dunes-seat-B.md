# Round 13, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 amendment), the brief, `scores.md`, round 12's three Signal
  Dunes seat files, and `docs/plans/SIGNAL-DUNES-TOP10.md`.
- The "Signal Dunes, round 13" section of `art/mockup-council/round-13/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0648-50cd2d82/`: every `mock-*`, h1–h4, both aerials,
  `clip.mp4` (1 fps, 10 frames) and `meta.json`.
- Round 12's capture, `20261003-0611-c83fb063/`, for before and after, frame by frame.
- The five ledger mockups, Lanczos-scaled to 780×1688.

Source checks (read-only `git show`):
- 5ba40cc0b and e790c0407: `layout.ts` (LANDFORMS), `world/dunes.ts` (`landforms()`), `look/render.ts` (bakeDuneShadow,
  the `away` term, the sand albedo).
- Both captures' `terrain.bin` bakes, decoded (256², 500 m, float32 heights at byte 24) and diffed.
- The camAt and `cameras` blocks of both `meta.json` files.

How I measured:
- **Brightness** is Rec. 709 luma (0.2126 R + 0.7152 G + 0.0722 B) on the decoded JPEGs.
- **Fine detail** is the mean of |luma − luma blurred at σ 2 px|.
- **Macro r** is the Pearson r of σ-12 luma, mockup against game, over a named band.
- **Grid r** is the Pearson r of 0.1 × 0.02 cell means over a named band.
- **Crest lines:** per column (12 px wide, σ-4 luma), the row of the strongest dark-above → bright-below step (a
  slip-face shade meeting a lit face). The tower's extent was read on 3× zooms with a 0.005 grid.
- **Regions** are fractions of the frame (x left → right, y top → bottom), or pixel boxes on the 780-px frame.
- **The clean patch** is x 10–190, y 1160–1420. I checked it in all 15 frames: it is clear of the coil, Sefa and the HUD
  in this capture too. My round-12 numbers reproduce exactly (65.8 / 69.8 / 35.9 / 35.2 / 33.2).

## Measurements (mockup / r12 / r13)

### What changed between the captures

| View | Mean \|RGB diff\| r12 → r13 | Pixels changed by more than 20 | Real camera move (camAt) |
|---|---|---|---|
| dusk-fire | 7.0 | 10.6 % | −2.58 m (y) |
| A | 7.6 | 11.6 % | −2.58 m |
| B | 4.5 | 2.7 % | −9.39 m |
| C | 10.8 | 16.2 % | +4.96 m |
| D | 3.4 | 3.1 % | +0.32 m |

- The sky above y 0.33 changed by 0.2–0.7 luma in every view except C (2.6). Rows 1 and 3 did not touch the sky.
- Every camAt `dir` and `fov` is identical, and `cameras` is identical. Only the eye heights moved, with the ground.

### Near sand (clean patch)

| View | Mean | p5–p95 | Fine | RGB |
|---|---|---|---|---|
| dusk-fire | 73.8 / 65.8 / **73.5** | 45–111 / 33–90 / **46–92** | 9.3 / 9.0 / **5.4** | 112,65,38 / 95,59,40 / **104,67,46** |
| A spawn | 57.4 / 69.8 / **76.0** | 33–94 / 35–94 / **48–96** | 9.3 / 9.9 / **5.1** | 87,50,35 / 99,63,43 / **105,69,49** |
| B logbook | 39.7 / 35.9 / **26.3** | 31–50 / 19–50 / **13–38** | 2.0 / 3.1 / **2.4** | 62,34,27 / 60,29,23 / **45,21,18** |
| C waymark | 32.6 / 35.2 / **18.1** | 26–37 / 24–45 / **10–26** | 0.4 / 1.3 / **1.2** | 52,27,22 / 59,28,24 / **36,13,9** |
| D hands | 34.9 / 33.2 / **26.0** | 23–48 / 25–42 / **18–35** | 0.4 / 1.5 / **1.3** | 51,30,27 / 53,28,25 / **43,21,19** |

- dusk-fire's mean is matched again.
- A moved further from its mockup.
- B, C and D all darkened by 7–17. C is now 55 % of its mockup, at a near-black red (36,13,9).
- The grain in both spawn views halved: fine 5.1–5.4 against 9.3.

### Whole frame, rows 120–1400: macro r (mean |diff|)

| View | r12 | r13 |
|---|---|---|
| dusk-fire | +0.56 (17.7) | **+0.59 (17.5)** |
| A | +0.64 (17.8) | **+0.68 (16.9)** |
| B | +0.73 (9.7) | **+0.81 (9.4)** |
| C | +0.62 (14.4) | **+0.55 (16.0)** |
| D | +0.79 (10.8) | **+0.79 (10.9)** |

### The spawn pair: landforms and crest lines (the round's subject)

**A: the dune band, grid x 0.1–1, y 0.34–0.50** (cell means; the mockup's lit diagonal is the run of 82–107):

| y | Mockup | r12 | r13 |
|---|---|---|---|
| 0.38 | 46 83 100 91 59 40 39 36 33 | 92 85 80 59 35 34 33 40 48 | 68 82 78 47 35 35 34 34 40 |
| 0.40 | 41 40 83 104 103 89 52 35 33 | 96 87 73 66 49 32 31 31 29 | 38 49 64 66 51 33 32 31 29 |
| 0.42 | 40 37 39 82 107 92 85 55 52 | 91 79 70 62 64 56 36 30 33 | 36 37 48 46 53 52 39 30 28 |
| 0.44 | 39 38 36 39 77 106 73 45 39 | 83 69 62 54 57 59 58 52 47 | 35 36 42 39 51 50 47 38 27 |
| 0.46 | 40 39 37 35 39 68 95 55 36 | 67 57 61 53 55 55 53 51 48 | 35 43 60 57 59 55 54 53 45 |

- Grid r is **+0.23 → +0.49**, with mean |diff| 22.4 → 16.8.
- Over the wider band (x 0–1, y 0.34–0.58) it is +0.21 → +0.37.
- **The mirrored light is fixed.** The left at y 0.40–0.46 is now in shade, 35–49 against the mockup's 37–41 (r12
  83–96).
- **The crest line now runs at the mockup's slope, about 0.01–0.015 low.** The shade → lit edge at x 0.45 / 0.55 / 0.65 /
  0.75:
  - mockup 0.384 / 0.395 / 0.405 / 0.416;
  - r13 **0.394 / 0.410 / 0.421 / 0.431**;
  - r12 0.362 / 0.411 / 0.425 / 0.369, which was no line at all.
- **The lit face under the crest is not lit.** The mockup's diagonal is 83–107; the game's is 46–66. The brightest 15 % of
  x 0.3–1, y 0.40–0.58 is 112,78,60 against 182,102,58, with p5/50/95 29/64/83 against 32/41/119. The shade's B/R is
  0.64 (r12 0.56) against 1.04.
- **The tower:**
  - Its foot sits where the mockup's does: y 0.345 against 0.342 (r12 about 0.36).
  - It is the mockup's width, x 0.564–0.610 against 0.550–0.597.
  - It is 1.6× as tall: the cage runs from 0.276 to 0.345 (0.069 of the frame), where the mockup's squat platform runs
    from 0.300 to 0.342 (0.042).

**dusk-fire: the dune band, grid x 0.1–1, y 0.34–0.50:** grid r **+0.38 → +0.41**; wider band +0.37 → +0.39.
- **The tower:** its foot is at 0.342 against 0.333, its centre x 0.367 against 0.362, and its height 0.067 against 0.056.
  It matches.
- **The composition still differs.**
  - The mockup's tower mound turns a shaded face to the camera across x 0.2–0.9, y 0.35–0.41 (27–42). Below it comes a lit
    mid swell (y 0.41–0.47: 53–65), then a bright near-left face (x 0–0.3, y 0.44–0.50: 72–81) and a shaded hollow on the
    right.
  - In the game the mound's left face is lit and its right slip face is shaded down to y 0.47. At x 0.8–1, y 0.40–0.46 it
    reads 27–32 against 43–58.
  - The shade → lit edge at x 0.55 / 0.65 is 0.431 / 0.449, against the mockup's flat 0.415 / 0.417. Past x 0.75 the game
    has no edge.
- **Tone:** the band's spread is now right (p5–p95 49 against 51; r12 68). The shade's B/R is 0.77 against 0.85 (r12
  0.55). The top 15 % are 111,72,52 against 127,73,43.

**The skyline** (the first sky → land step under y 0.33, by column) matches within 0.01 in both views, at 0.33–0.355.
The far range is unchanged.

**The skies** (unchanged): the sky box (40,300)–(540,600) reads dusk-fire 98.3 against 75.9 and A 91.8 against 88.3.
Round 12's R12B-3 (dusk-fire's orange-pink right bank, A's pink banks) still stands as measured then.

### B

| Region | Mockup | r12 | r13 |
|---|---|---|---|
| Camp band, x 0–1, y 0.40–0.60: macro r | | +0.60 | **+0.78** |
| Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 58.5 | **39.6** |
| Right, x 0.65–1, y 0.42–0.47 (glow plus backdrop) | 60.4 | 68.6 | **43.7** |
| Horizon glow, x 0.05–0.35: peak at y, rows over 100 | 129 at 0.423, 82 | 101 at 0.454, 2 | **90 at 0.449, 0** |
| Horizon glow, x 0.72–0.90: peak | 163 | 105 | **89** (a dune hides it now) |
| Wagon box (mockup x 0.42–0.66, game x 0.49–0.71; y 0.40–0.50): mean, fine | 53.1, 12.0 | 28.1, 5.6 | **27.3, 5.4** |

- The camera sits 9.4 m lower, so a dune now rises behind the camp on the right, where the mockup has a dark dune and
  the tent. That composition is closer.
- The game's dune there is rippled, warm and lit, where the mockup's is a dark silhouette. The glow and the wagon both
  went down.

### C

| Region | Mockup | r12 | r13 |
|---|---|---|---|
| Left backdrop, x 0–0.2, rows y 0.44–0.52 | 78 94 81 38 16 32 27 23 | 14 28 8 23 9 12 9 11 | **68 88 86 95 28 20 16 16** |
| Left band, x 0–0.25, y 0.40–0.56: macro r, \|diff\| | | +0.63, 24.7 | **+0.76, 13.5** |
| Right band, x 0.6–1, y 0.40–0.56: macro r, \|diff\| | | +0.70, 17.8 | **+0.42, 24.8** |
| Right rows, x 0.6–1, y 0.44–0.52 | 93 78 46 17 16 16 15 15 16 | 88 94 113 98 10 6 7 8 11 | **90 96 115 137 90 32 19 18 19** |
| Near ground, y 0.56–0.70: macro r, mean | 48.4 | +0.20, 51.5 | **+0.65, 36.3** |
| Flame, x 150–450, y 350–900: pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 14 847 / 3 548 / 446 | **20 463 / 3 060 / 469** |
| Light pool at the plinth's foot (0.36 wide × 0.04): mean, p95, RGB | 70.5, 144, 127,58,25 | | **53.6, 85, 89,45,26** |

- **Left:** the horizon is where the mockup's is (land from y 0.475), and the r12 dune wall is gone.
- **Right:** the horizon is now 0.02–0.025 too low. The glow runs to y 0.48 (137 at y 0.47), where the mockup's land
  starts at y 0.465 with a low hump carrying the second waymark. The game's second waymark is a plume on the plain at about
  y 0.55.
- **The flame** is 1.49× the mockup's area, and its near-white core is 17 % of the mockup's.
- **The plinth** is now in full view, with stone courses.

### D

| Region | Mockup | r12 | r13 |
|---|---|---|---|
| Land y 0.52–0.62, left half / right half | 16.0 / 16.0 | 34.2 / 10.9 | **33.5 / 24.8** |
| Land rows, x 0–0.4, y 0.50–0.71 | 87 18 16 15 19 13 13 28 17 14 13 14 11 32 **64 63 56** 52 49 48 46 44 | 18 29 18 18 33 38 43 42 42 40 … 35 | **23 42 37 25 28 34 39 37 36 35 … 28** |
| Land macro r, x 0–0.4 / x 0–1, y 0.50–0.66 | | −0.20 / +0.11 | **−0.24 / −0.01** |
| Afterglow, column x 300–500: peak at y, rows over 100 | 170 at 0.497, 121 | 175 at 0.476, 81 | **175 at 0.482, 82** |
| Glove box (600,1130)–(780,1330): p95, fine | 71.6, 7.6 | 55.5, 4.1 | **55.5, 4.1** |

- The tower (x 0.83, y 0.44–0.50) and the horizon (about 0.48) are unchanged and close.
- The land still has none of the mockup's flat transverse bands, and its right half lost r12's dark match.

### Hero views, aerials and the late clip

| | r12 | r13 |
|---|---|---|
| clip.mp4, 10 frames: ground, y 0.55–0.90 | 7–24 | **26–33** |
| clip.mp4: far land, y 0.30–0.55 | 6–9 | **20–23** |
| clip.mp4: pixels under 5, y 0.30–0.90 | 31–71 % | **0.2–0.5 %** |
| h4 low sky (170,575)–(220,599): blue ≤ 1 | 89.6 % | **90.4 %** |
| h2 / h4, y 0.15–0.45: blue < 30 and red > 110 | 0.01 / 0.32 % | **0.01 / 0.40 %** |

- **The late clip is repaired.** The dunes read as rounded forms, with no black blots.
- **aerial-spawn** shows a real crest running from the spawn side to the tower, with a slip face behind it, and the
  tower's mound.
- **aerial-overview** shows the authored forms as broad soft swells with round shadow pools, not sharp crests.
- **h4** (the tower deck) looks over a field that reads nearly flat.
- **The bake:**
  - It changed by more than 2 m over 53.5 % of the 500 m ground, mostly e790c0407's wave retune.
  - Max slope 37.6° → **39.2°** (cells over 35°: 0.02 → 0.54 %; none over 40°).
  - Heights: spawn 19.67 → 17.05, tower 15.89 → 18.38, B 14.74 → 5.36, C 10.86 → 15.77, D 25.64 → 26.02. These agree
    with the commit.
- **The crest is a step, not a knife-edge.** A cross-section through the crest's midpoint (2, −15) rises 0.6 → 10.8 m
  over 40 m on the spawn side, then stays at 10.7–12.3 m for 50 m on the far side.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.0** | 1. **The landform (x 0–1, y 0.35–0.56).** Repeated. The mockup's tower mound turns a shaded face to the camera (x 0.2–0.9, y 0.35–0.41), over a lit mid swell, with a bright near-left face and a shaded hollow on the right. The game's mound is lit on the left, and its slip face is shaded down to y 0.47 on the right (27–32 against 43–58). Grid r +0.41 (r12 +0.38). The tower matches (foot 0.342 against 0.333). 2. **The sky (y 0.12–0.36).** Unchanged from r12. A saturated orange-pink bank sits on the right, where the mockup has a grey-brown one. The sky box is 98 against 76, and the keeper's flame is a pin. 3. **The near field (y 0.56–0.86).** The mean is back (73.5 against 73.8), but the grain halved (fine 5.4 against 9.3). The double upright coil and Sefa stand at the left edge, where the mockup has one low loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.7** | 1. **The landform (x 0.1–1, y 0.34–0.50).** Better: grid r +0.23 → +0.49. The left is in shade as in the mockup, and the slip-face diagonal runs at the mockup's slope, 0.01–0.015 low. Its lit face is 46–66 where the mockup's is 83–107. The top 15 % are 112,78,60 against 182,102,58, and the shade is brown (B/R 0.64) against violet (1.04). 2. **The near sand (y 0.56–0.86).** Worse: 76.0 against 57.4 (r12 69.8), with the grain halved (fine 5.1 against 9.3). Sefa and her label fill x 0.1–0.3, y 0.50–0.68. 3. **The tower and the sky.** The tower stands where the mockup's does, but it is a tall cage 1.6× the mockup's squat platform (0.069 of the frame against 0.042). The cloud banks are pink (round 12's R12B-3), and the glow under them is dim. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.3** | 1. **The backdrop (x 0.55–1, y 0.40–0.48).** Closer in form: with the eye 9.4 m lower, a dune rises behind the camp, as the mockup's does, and the camp band's macro r is +0.60 → +0.78. But it is a rippled, lit warm dune where the mockup's is a dark silhouette, and it hides the right half of the glow. 2. **The horizon glow (x 0.05–0.35, y 0.40–0.46).** Peak 90 against 129, with 0 rows over 100 against 82 (r12 101, 2 rows). Still a thin stripe, now dimmer. 3. **The values.** The near sand is 26.3 against 39.7 (r12 35.9). The wagon box is 27 against 53, with fine detail 5.4 against 12.0. The upright coil fills the lower centre. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.9** | 1. **The backdrop (y 0.44–0.53).** Left fixed: the horizon is at the mockup's y 0.475 (band r +0.76, \|diff\| 13.5; r12 +0.63, 24.7). Right worse: the glow runs to y 0.48 (137 at y 0.47) where the mockup's land starts at 0.465 with a low hump and the second waymark on it (band r +0.70 → +0.42). 2. **The near ground and the pool (y 0.55–0.70).** The near sand is 18.1 against 32.6 (r12 35.2), a near-black red (36,13,9). The pool at the plinth is 53.6 (p95 85) against 70.5 (p95 144), orange 127,58,25 in the mockup. 3. **The fire (x 0.25–0.5, y 0.30–0.45).** Now 1.49× the mockup's area (20 463 pixels over 150 against 13 733), with the white core at 17 % (469 over 245 against 2 722). Pale cream sheets, no logs. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.7** | 1. **The land (x 0–1, y 0.50–0.70).** No transverse bands: the left half is 33.5 against 16.0, the right half 24.8 against 16.0 (r12 10.9), and land macro r is −0.01 (r12 +0.11). There is no lit band at y 0.64–0.67 (≈ 63 against 33). 2. **The hero hand (x 0.55–1, y 0.62–0.86).** Unchanged (row 4 not in): p95 55.5 against 71.6, fine 4.1 against 7.6, and two big upright loops where the mockup has slim loops by a raised fist. 3. **The near sand and the afterglow.** The sand is 26.0 against 34.9 (r12 33.2). The afterglow peaks right (175 against 170), but 0.015 high and narrower (82 rows over 100 against 121). |

**Seat score, Signal Dunes: (7.0 + 6.7 + 7.3 + 6.9 + 6.7) / 5 = 6.92 → 6.9.**
- This seat's earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9.
- Row 1 moved A's land toward its mockup (its biggest landform gain in 13 rounds) and gave B a closer backdrop.
- The same batch took the light off the near ground in B, C and D, and halved the spawn pair's grain.
- dusk-fire's landform barely moved, and D's not at all.

## The builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| A crest spline (−42,−82) → (−14,−50) → (18,20), 7 / 13.5 / 12 m, 30 m slip face, 70 m windward; the mound 21.5 m over 62 m | **True in source and bake** | `layout.ts` LANDFORMS, `dunes.ts` `landforms()`. Bake heights agree; max slope 39.2°. The crest is a step: it stays 10.7–12.3 m for 50 m past its line, with no far-side fall. |
| "Dune-band grid correlation A 0.00 → +0.37, dusk-fire +0.21 → +0.37" | **After: reproduced. Before: not the round-12 capture** | My 0.1 × 0.02 grid over x 0–1, y 0.34–0.58 gives A **+0.21 → +0.37** and dusk-fire **+0.37 → +0.39** against round 12. dusk-fire's gain since the last scored round is +0.02, not +0.16. |
| The crest lies from frame x 0.3, y 0.40 to the right edge at y 0.47, "from the spawn eye (21.1 m)" | **Partly** | The shade → lit edge runs 0.394 (x 0.45) → 0.449 (x 0.85). But the real eye is 18.72 m (camAt): the landform lowered the spawn ground 2.6 m, so it was judged from an eye that no longer exists. The lit face under it reads 46–66, where the comment promises "mockup A's lit diagonal" (83–107). |
| No camera re-aimed | **True** | `cameras` identical; every camAt `dir` and `fov` identical; only the eye heights moved. |
| Row 3: the shadow 896 texels over ±520 m, a sharper penumbra, cast shade 0.28 | **True in source** | `SHADOW_TEX = 896, SHADOW_HALF = 520`; the denominator 0.3 + 0.025d → 0.25 + 0.012d; `mix(0.28, 1.0, sandVis)`. On screen: the round shadow pools in aerial-overview. |
| The late darkening has no distance gate | **True; the clip is fixed. But the term now darkens the near ground (R13B-1)** | `sil` removed. `away = smoothstep(0.3,0.85,uDusk) * (1 − smoothstep(−0.05,0.2,toGlow))`, strength 0.45. The clip's ground is 26–33 (r12 7–24). |
| The B sand bell removed | **True** | `render.ts`: the `exp(−((uDusk−0.5)/0.1)²)` factor is gone. |
| The low-sky red in h2 at 0.02 % | **True as defined (0.01 %); h4 still clamps** | h4's horizon rectangle (170,575)–(220,599) is 90.4 % blue ≤ 1 (r12 89.6 %), and h4 is 0.40 % by the README's own test. |
| The near ridge is gone | **True** | `CREST_LINES` empty; `CRESTS` empty. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R13B-1 | C, D, B (and every late-dusk place) | **must-fix** | **regression** (5ba40cc0b), the other half of R12B-1 | near ground y 0.56–0.86 | **The `away` term lost its distance gate but still darkens flat ground, so now it darkens the ground at your feet.** With `1 − smoothstep(−0.05, 0.2, toGlow)`, flat ground (toGlow ≈ 0) is 0.90 "away". At C's and D's dusk (≥ 0.8) it keeps about 60 % of its light, on top of the deeper 0.28 cast shade. The near sand fell to C **18.1** against 32.6 (r12 35.2; RGB 36,13,9), D **26.0** against 34.9 (r12 33.2) and B **26.3** against 39.7 (r12 35.9). D barely moved camera (0.32 m), so its 7-luma drop is the shading. Fix: move the window below zero, so only faces clearly turned from the glow darken (round 12's R12B-1 fix, e.g. `1 − smoothstep(−0.35, −0.05, toGlow)`). Keep the clip's 26–33. Check C's patch near 32, D's near 35, and B's near 40. |
| R13B-2 | dusk-fire | must-fix | **repeated** (R12B-2, R11B-2) | x 0–1, y 0.35–0.56 | **dusk-fire's landform didn't follow A's.** Grid r is +0.41 (r12 +0.38). The mockup reads, top to bottom: the mound's face toward the camera in shade (x 0.2–0.9, y 0.35–0.41: 27–42), a lit swell (y 0.41–0.47: 53–65), then a bright near-left face (x 0–0.3, y 0.44–0.50: 72–81) with a shaded hollow on the right. The game shows the mound side-lit, its right slip face shaded down to y 0.47 (27–32 against 43–58), and a uniform foreground. Fix, within the one world (dusk-fire looks left of A from the same eye): extend LANDFORMS' near crest west across dusk-fire's lower frame, so its windward face gives the bright near-left face and its lee the hollow on the right. Turn the mound's shaded side toward the spawn, so its near face is the one in shade and the shade ends near y 0.415. Re-judge both from the real eye, 18.72 m. |
| R13B-3 | A, dusk-fire | should-fix | **repeated** (lit faces: R12B-2), the grain **new / regression** | A x 0.3–0.9, y 0.38–0.48; patch x 10–190, y 1160–1420 | **The crest is in place; light it, and get the grain back.** A's lit face under the diagonal is 46–66 against 83–107, and its top 15 % are 112,78,60 against 182,102,58. The near sand is 76.0 against 57.4. The fine grain halved in both spawn views (5.1 / 5.4 against 9.3; r12 9.9 / 9.0). Fix: aim the key so the crest's windward face toward the camera takes it at a grazing angle (it is a form now, so the light can land on it). Bring the near sand down by form and shade, not albedo. Restore the grain's amplitude with row 2's material, judged on this patch. Make the crest's far side fall (it stays at 10.7–12.3 m for 50 m), so the shade beyond reads as a slip face. |
| R13B-4 | C | should-fix | **regression** (the right horizon), **repeated** (fire, pool) | x 0.6–1, y 0.44–0.53; x 0.25–0.5, y 0.30–0.60 | **C's right horizon dropped with the 5 m rise.** The glow runs to y 0.48 where the mockup's land starts at 0.465, under a low hump carrying the second waymark (band r +0.70 → +0.42). Fix: a low dune swell (a LANDFORMS mound, real terrain) under the second waymark's line of sight, so it stands on a hump at the horizon as in the mockup. Do not re-aim. **The fire** is now 1.49× the mockup's area, with its core at 17 %. Shrink the tongues back and concentrate a white-yellow core over visible logs (row 6). **The pool** is 53.6 against 70.5 (p95 85 against 144): a brighter, smaller orange pool at the plinth. |
| R13B-5 | D | should-fix | **repeated** (R12B-7, R11B) | x 0–1, y 0.50–0.70 | **D's bands were not authored.** Plan row 1 lists "long transverse bands toward D's overlook", but this batch built only the crest and the mound. Land macro r is −0.01; the halves are 33.5 / 24.8 against 16 / 16; there is no lit stripe at y 0.64–0.67. Fix: author D's view as LANDFORMS crests running across its line of sight (transverse, their lee faces toward the camera), so the bands are dark faces with lit rims. Then score it with R13B-1 fixed, not before. |
| R13B-6 | B | should-fix | **repeated** (R12B-5), new for the backdrop | x 0.05–0.35, y 0.40–0.46; x 0.6–1, y 0.42–0.48 | The new backdrop dune is the right form, but it is lit and rippled where the mockup's is a dark silhouette, and it covers the right half of the glow. The glow fell to a 90 peak with 0 rows over 100 (mockup 129, 82 rows). Fix: the glow band per R12B-5 (a broader, brighter band at dusk 0.5), and the backdrop dune's camera-facing side in lee shade (it faces away from the glow). The wagon is 27 against 53. |
| R13B-7 | dusk-fire, A | should-fix | **repeated** (R12B-3) | sky y 0.12–0.36 | Untouched this round (the sky changed by 0.7 luma or less). It is still the biggest single difference in dusk-fire: an orange-pink right bank where the mockup's is grey-brown, and a sky box of 98 against 76. Plan row 5 (the painted sky) owns it. |
| R13B-8 | A, dusk-fire | nit | **repeated** | A x 0.56–0.61, y 0.27–0.35 | The tower is 1.6× the mockup's on-screen height, at the same width: a tall cage where the mockup has a squat platform. Shorten the tower model's lower cage, or give it the mockup's wider deck, if the quest geometry allows. |
| R13B-9 | process | nit | new | README | The commit's "before" correlations (A 0.00, dusk-fire +0.21) are not from the round-12 capture; against it the numbers are +0.21 and +0.37. Quote round-to-round numbers against the last scored capture. h4's low-sky clamp (90.4 % blue ≤ 1 at the horizon) is still there; the README tests only h2. |

## Ledger 5 (no shortcuts)

- **Views:**
  - No re-aim: `cameras` is identical, and every camAt `dir` and `fov` is unchanged.
  - The eye heights moved with the new ground: B and h2 −9.4 m, C +5.0 m, the spawn −2.6 m. The README lists them.
  - The landforms are where these moves come from. They are real terrain: the bake changed, the max slope is 39.2°
    (none over 40°), and the navmesh was re-baked.
  - B's drop comes from the crest's windward footprint, which blends out to twice its 70 m width. It is a consequence of
    the world change, not an aim. It moved B toward its mockup.
- **Authored from the spawn frame:**
  - The layout comment says the crest was placed by mockup A's frame.
  - Plan row 1 orders exactly that: the mockups' composition, built once in one world. It is real, walkable terrain that
    shows as a crest from aerial-spawn too.
  - It is not a breach. It does narrow the world's dunes in one sense: aerial-overview reads as soft swells and round
    shadow pools, and h4 looks over a nearly flat field. Hold the rest of the field to the same crest standard, as the
    plan's "real dunes everywhere" asks.
- **Staged state:** unchanged; `staged` lists the same three entries, and no commit touched a stage handler.
- **No screenshot cheats:** none. The terrain, shadow map and materials are global.
- **No narrowing:**
  - The late clip is repaired: its ground is 26–33 and its pixels under 5 are 0.2–0.5 % (r12 7–24 and 31–71 %).
  - The near-ground darkening in R13B-1 is global and reached by play at every late-dusk spot. It is a must-fix for the
    look, not a breach.
- **Device and HUD:** 390×844 touch, stored 780 wide, with the baseline HUD in every frame. The 30 fps chip shows;
  `pageErrors: []`; 59 programs; `active: []`; QA retakes none.
- **Budgets:** gpuMB 108.99 → 109.74 was re-recorded for the bigger shadow map. The memory limits and frame times are not
  on this surface, so they are unverified, not breached.

No score is voided.

SCORE signal-dunes: 6.9

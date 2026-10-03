# Round 16, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 and phase amendments), the brief, `scores.md` (with the round-15
  hard rule), and round 15's three Signal Dunes seat files.
- The "Signal Dunes, round 16" section of `art/mockup-council/round-16/README.md`, including the lead's first look, and
  its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0918-232dbb40/` (`mock-*`, h1–h4, both aerials, `clip.mp4` at 1 fps,
  `meta.json`), against round 15's `20261003-0835-c1b820c3/` and round 13's `20261003-0648-50cd2d82/`.
- The five ledger mockups, Lanczos-scaled to 780×1688. The builder's overlay `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire-r16.jpg`.

Source checks (read-only `git show`): 232dbb408 (`layout.ts`, `look/render.ts`, `world/dunes.ts`, `weapons/whipModel.ts`,
`world/meshes.ts`, `cameras.json`, the bake), 04f5b02d7 (the LUT) and 46ca3c7f1 (budget numbers only). The terrain bakes at
50cd2d82, c1b820c3 and 232dbb40, decoded as the first 256² float32 after the 24-byte header, x and z over −250..250. All
five scored and h3 camAt eyes sit at 1.70 m over the decoded r16 ground (residuals 0.00–0.01), so the decode is right.

How I measured. These are the same tools as rounds 13–15, and my round-15 numbers reproduce within 0.3:
- **Brightness** is Rec. 709 luma. **Fine** is the mean |luma − luma blurred at σ 2|. **Ripple %** is the mean
  |blur σ1 − blur σ5| as a percentage of the region's mean. **Sat** is the mean (max − min) / max.
- **Grid r** is the Pearson r of 0.1 × 0.02 cell means (σ2 luma). I also ran the builder's 10 × 7 grid over y 0.36–0.58.
- **The clean patch** is x 10–160, y 1160–1400, clear of the ring, its fall, the fist and the HUD in all five views.
- **Regions** are frame fractions (x left → right, y top → bottom) or pixel boxes on the 780-px frame.

## What changed (r15 → r16)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky above y 0.33 |
|---|---|---|---|
| dusk-fire | 17.5 | 28.2 % | 8.4 |
| A | 15.8 | 26.2 % | 7.5 |
| B | 5.9 | 5.6 % | 1.7 |
| C | 10.6 | 12.8 % | 5.3 |
| D | 7.8 | 12.9 % | 2.5 |

The sky moved this round (5–8 in the spawn pair). That is the LUT (04f5b02d7), which is new in this capture: round 15's
capture had none (seat A r15 checked it), and the README lists it only as "stays as shipped".

## Measurements (mockup / r13 / r15 / r16)

### Near sand, clean patch

| View | Mean | p5–p95 | Fine | Ripple % | RGB / sat |
|---|---|---|---|---|---|
| dusk-fire | 74.8 / 75.8 / 71.4 / **64.6** | 46–113 / … / 38–93 / **35–85** | 9.6 / 5.1 / 7.1 / 7.5 | 10.5 / 4.8 / 8.1 / 8.5 | 114,67,38 0.67 / … / **99,57,34 0.66** |
| A spawn | 57.2 / 77.4 / 64.3 / **62.3** | 32–94 / … / 28–89 / 33–83 | 9.3 / 4.8 / 8.4 / 7.9 | 10.1 / 4.2 / 11.1 / 9.9 | 87,50,35 0.59 / … / 98,55,32 0.69 |
| B logbook | 39.8 / 25.5 / 39.1 / **31.7** | 31–49 / … / 28–50 / **20–43** | 2.0 / 2.4 / 3.0 / 2.9 | 4.1 / 8.3 / 7.7 / 8.8 | 63,34,27 / … / 54,26,22 |
| C waymark | 33.0 / 18.7 / 41.1 / **36.8** | 28–37 / … / 32–50 / 27–45 | 0.4 / 1.2 / 1.7 / 1.8 | 1.1 / 6.4 / 3.8 / 4.3 | 54,28,22 / … / 61,31,27 |
| D hands | 35.9 / 25.5 / 32.5 / 32.1 | 25–48 / … / 26–40 / 25–39 | 0.4 / 1.3 / 1.8 / 1.4 | 0.8 / 4.0 / 5.3 / 4.2 | 53,32,28 / … / 52,27,25 |

- **B and dusk-fire's near sand dropped 7.4 and 6.8** between captures with no change to the near shader's mean (the
  ripple term is now zero-mean, which brightens a little). B went from matching (39.1) to 8 under; dusk-fire from 3 under
  to 10 under. The LUT's README predicts near patches moving 1.5–3.5. C moved toward its mockup (41.1 → 36.8 against 33).
- The near grain and ripple hold (A 9.9 % against 10.1 %).

### The spawn pair: the dune band

| Region / metric | Mockup | r13 | r15 | r16 |
|---|---|---|---|---|
| A lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 50.7 | 48.4 | **32.0** |
| A band, x 0–1, y 0.38–0.56: mean / p5–p95 | 56.1 / 31–113 | 57.4 | 58.8 / 25–104 | **36.3 / 26–74** |
| A right under the crest, x 0.5–1, y 0.48–0.54 | 42.5 | 69.3 | 75.0 | **29.6** |
| A left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 39.5 | 49.3 | 35.4 |
| A tower's mound, x 0.35–0.65, y 0.36–0.40 | 57.3 | 45.1 | 42.6 | **35.9** |
| A far strip right, x 0.6–1, y 0.37–0.40 | 40.5 | 37.3 | 77.6 | **35.2** |
| A shade share (Y < 45, y 0.36–0.58), left / right | 50 / 61 % | | 30 / 37 % | **66 / 91 %** |
| A grid r x 0.1–1, y 0.34–0.50 / wide x 0–1, y 0.34–0.58 / builder's 10 × 7 | | +0.49 / +0.38 / +0.33 | +0.12 / −0.00 / −0.16 | **+0.23 / +0.44 / +0.46** |
| dusk-fire lit left shoulder, x 0–0.2, y 0.40–0.50 | **70.6** | 49.9 | 49.5 | **29.8** |
| dusk-fire lit swell, x 0–1, y 0.42–0.47 | 60.3 | 41.0 | 49.2 | **31.5** |
| dusk-fire saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 65.8 | 74.2 | **33.1** |
| dusk-fire band mean / p5–p95 | 57.7 / 30–92 | 55.3 | 63.9 / 27–117 | **33.4 / 26–39** |
| dusk-fire far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 40.3 | 111.9 | **36.2** |
| dusk-fire shade share, left / right | 19 / 46 % | | 37 / 35 % | **83 / 89 %** |
| dusk-fire grid r / wide / 10 × 7 | | +0.41 / +0.39 / +0.44 | −0.02 / −0.18 / −0.33 | **+0.28 / +0.21 / +0.15** |
| Top 15 % of the band (y 0.38–0.58): RGB, sat, G/R — A | 178,101,59, 0.67, 0.57 | | 124,93,75, 0.41, 0.75 | **118,79,56, 0.54, 0.67** |
| — dusk-fire | 143,83,47, 0.67, 0.58 | | 137,108,91, 0.34, 0.79 | **112,79,61, 0.47, 0.71** |

**A, grid x 0–1 by 0.1, rows y 0.36 → 0.56 (mockup's lit diagonal = the run of 82–107):**

| y | Mockup | r16 |
|---|---|---|
| 0.38 | 44 47 83 101 92 60 41 40 37 34 | 61 61 51 34 34 34 34 35 35 35 |
| 0.40 | 42 41 41 84 105 104 90 53 35 33 | 60 57 32 31 32 33 33 33 34 33 |
| 0.42 | 28 41 38 40 82 107 93 85 56 52 | 37 36 30 30 31 31 32 33 33 32 |
| 0.44 | 42 40 38 36 40 77 107 74 45 39 | 44 30 29 29 30 30 31 32 32 32 |
| 0.46 | 35 41 40 37 35 39 69 95 56 36 | 34 30 28 28 29 30 30 31 31 31 |

- **The correlation went up because the dark is in the middle and the lit sand is at the bottom, as in the mockup. The
  form did not come with it.** Every cell of the band from x 0.2 rightward is 28–36: one uniform slip face. The mockup's
  defining stripe (82–107, descending left to right) is not there at all: 32 against 96.7, the lowest of any round I
  have measured (r13 50.7, r15 48.4).
- **dusk-fire is worse:** the band's spread is **13 luma (26–39) against 62 (30–92)**. The mockup's lit near-left
  shoulder (70.6) is 29.8, and 83 / 89 % of the band is under 45 where the mockup's left half is 19 %.
- **Why, from the bake:** the authored crest is 20 m (far left) → 23.5 m → 27 m (near right), and A's eye is 23.05 m.
  From the spawn the camera stands below the crest's near half, so it sees only the 30 m slip face turned toward it, and
  the crest hides the tower's mound (35.9 against 57.3). The lead's first look ("one large, uniformly dark dune face")
  measures exactly.
- **Gains in this band:** the pale far sheet is gone (A 77.6 → 35.2 against 40.5; dusk-fire 111.9 → 36.2 against 34.5),
  and the lit sand's colour came back part of the way (sat 0.47–0.54 against 0.67; r15 0.34–0.41).

### Middle-distance ripples

| Region: ripple % / fine | Mockup | r15 | r16 |
|---|---|---|---|
| A, x 0.1–0.5, y 0.37–0.45 | 5.0 / 3.1 | 11.7 / 4.4 | **4.5 / 1.2** |
| A, x 0.1–0.6, y 0.48–0.56 | 5.5 / 3.8 | 17.3 / 5.6 | **6.0 / 1.6** |
| dusk-fire, x 0.15–0.6, y 0.42–0.50 | 5.5 / 3.7 | 14.3 / 5.7 | **3.7 / 0.9** |
| A lit near band, x 0–0.6, y 0.56–0.62 | 8.4 / 8.1 | 7.2 / 2.6 | **2.5 / 1.4** |
| dusk-fire lit near band, x 0.1–0.6, y 0.55–0.62 | 6.9 / 7.1 | 7.9 / 3.0 | **2.3 / 1.2** |

The 0.7 → 0.26 cut landed where it was asked: the middle band's ripple contrast now matches (4–6 %). But the ramp
(`smoothstep(4, 26, sandFar)`) also flattened the lit sand just beyond the near patch, which the mockups keep rippled:
2.3–2.5 % against 6.9–8.4 %. In the sheets the lit strip under the dark face reads as smooth plaster.

### B

| Region | Mockup | r15 | r16 |
|---|---|---|---|
| Skyline right of the wagon, x 0.75 / 0.82 / 0.88 / 0.94 / 0.98 | 0.437 / 0.438 / 0.439 / 0.431 / 0.418 | 0.406 / 0.395 / 0.387 / 0.384 / 0.383 | **0.440 / 0.437 / 0.432 / 0.429 / 0.429** |
| Glow right, x 0.72–0.90, y 0.40–0.47 | 87.5 | 35.6 | **61.3** |
| Glow column x 0.72–0.95: peak at y, rows over 80 | 156 at 0.429, 114 | 82 at 0.383, 11 | **80 at 0.429, 5** |
| Glow left, x 0–0.2, y 0.40–0.45 | 98.5 | 77.7 | 69.7 |
| Under the backdrop, x 0.72–0.95, y 0.44–0.49 | 24.0 | 29.2 | 33.4 |
| Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 56.2 | 54.9 |

- **The dune is right now:** at 21 m its skyline matches the mockup's within 0.01, and the glow is uncovered.
- **The glow itself is thin:** the right column peaks at 80 against 156, with 5 rows over 80 against 114. The skyline
  is no longer the cause; the afterglow band in the sky dome is.
- The camp's left backdrop is still lit (55 against 39), and the near sand regressed (31.7 against 39.8, r15 39.1).

### C

| Region | Mockup | r15 | r16 |
|---|---|---|---|
| Right skyline, x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | 0.469 / 0.466 / 0.463 / 0.430 (the waymark's hump) / 0.455 | 0.486 / 0.485 / 0.481 / 0.468 / 0.469 | **0.450 / 0.444 / 0.435 / 0.430 / 0.430** |
| Glow band, x 0.6–1, y 0.44–0.47 | 72.5 | 98.7 | **30.4** |
| Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 24.3 | 26.7 |
| Far waymark flame: x, y | brazier ≈ 0.885, top ≈ 0.465 | 0.828, 0.502 | **0.829, 0.428** |
| Pool, (150,1060)–(450,1150) | 40.5 | 52.4 | 48.5 |
| Flame (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 21 389 / 3 831 / 316 | 11 285 / 1 795 / **129** |

- **Waymark 0 is on a rise again** (bake ground 24.0 m; r15 12.5), so the far fire is on the skyline. **It overshot:** the
  whole right skyline is 0.015–0.03 high and the hump is broad, so it covers the glow band (30 against 72.5; r15 98.7),
  and the flame sits 0.04 above and 0.06 left of the mockup's brazier.
- The flame's area is now near the mockup's (11.3k against 13.7k over 150), but its white core is 5 % of the mockup's.

### D

| Region | Mockup | r15 | r16 |
|---|---|---|---|
| Land y 0.52–0.62, left / right half | 16.0 / 16.0 | 14.6 / 11.2 (the distance fade) | **36.0 / 25.8** |
| Rows x 0–0.49, y 0.47 → 0.71 step 0.015 | 140 154 68 17 16 15 13 25 13 13 14 50 61 52 48 46 43 | 146 31 16 11 7 7 7 8 25 36 35 35 35 36 34 33 33 | 130 41 30 35 34 34 37 38 37 37 37 37 36 36 33 34 34 |
| Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 35.4 | 36.0 |
| Tower body height in frame | ≈ 0.041 | ≈ 0.057 | **≈ 0.041** |

- With the fade gone, D's land is the honest field again: a flat 34–38 from the horizon down, against the mockup's dark
  13–17 band and its lit stripe at 50–61 (y 0.64–0.67). This is round 14's state; I gave round 15 no credit for the fade.
- **The tower is back at the mockup's size and x** (≈ 0.845 against 0.85), with the HUD's "SIGNAL TOWER 200" label across it.
- A small flyer crosses at x ≈ 0.12, y ≈ 0.45; D's mockup has none.

### The glove and the loop (every view; full-res crops)

| | Mockup D | r15 | r16 |
|---|---|---|---|
| Leather (mockup (590,1130)–(740,1260); r15 (500,1030)–(630,1240); r16 (470,1160)–(600,1300)): Y mean, p95, fine | 30.4, 79, 8.2 | 26.5, 49, 2.8 | **38.0, 60, 3.6** |
| Fist on screen | back of the hand, top ≈ 0.65, x 0.73–1.0, cuff out of the right edge | finger bands to the camera, top ≈ 0.60 | **thumb side up, the handle a stub above the thumb to ≈ 0.648, fist ≈ 0.68–0.79, x 0.59–0.79** |
| Loop | slim loops hanging from the fist | a closed ring left of the fist, the cord from the handle's top | **a ring left of the fist; the cord ends in an open cut ≈ 0.06 of the frame short of the handle** |

- **The fist came down** (top ≈ 0.68 against 0.65) and is lighter. It is not the mockup's back of the hand: it shows the
  thumb wrapped over an upright handle stub, a "thumbs-up" grip beside the coil, which is what the lead's first look
  asked us to judge. The coil is not in the hand.
- **New defect: the whip is no longer attached to its handle.** In all five views the plaited cord's upper end stops in
  mid-air as an open tube, about 47 px (0.06 of the width) left of the handle's top (A crop x 0.38–0.68, y 0.62–0.74).
  232dbb408 turned `HD_GLOVE.rot` y from +0.85 to −0.4 but left `LOOP.from` at the old handle top (−0.53, 0.95, 0.19).
- The leather is flatter than the mockup's (fine 3.6 against 8.2), with no stitching.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **5.9** | 1. **The middle is one dark wall (x 0–1, y 0.37–0.56). Regression.** The band is 33 with a 13-luma spread against 58 and 62. The mockup's lit near-left shoulder (70.6) is 29.8, its lit swell 31.5 against 60.3, and the tower's mound is hidden behind the slip face. 83 / 89 % of the band is in shade against 19 / 46 %. 2. **The viewmodel (x 0.3–1, y 0.6–0.86).** The cord ends short of the handle in an open cut (new). A thumb-up fist on a handle stub beside a ring, where the mockup's teardrop loop runs from a low glove in the corner. 3. **The near sand and the sky.** Near sand 64.6 against 74.8 (r15 71.4, regression); the lit strip beyond it is smooth (2.3 % against 6.9 %). Gains: the sky box is 86 against 76 (r15 101), and the pale sheet is gone (36 against 35). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.9** | 1. **The lit diagonal is gone (x 0.2–1, y 0.38–0.52). Regression.** One uniform slip face at 28–36 fills the band; the diagonal is 32 against 96.7 (r15 48, r13 51). The tower's mound is hidden (35.9 against 57.3), and the tower stands just over the dark face. The 10 × 7 grid r is +0.46, but the mockup's stripe-over-shade structure is absent. 2. **The viewmodel (x 0.27–0.9, y 0.6–0.86).** The cut cord, the thumb-up stub grip and a ring, where the mockup has two broad low coils rising from the bottom edge. 3. **The lit sand under the face (x 0–1, y 0.56–0.62)** is smooth (ripple 2.5 % against 8.4 %). Gains: the far strip 35 against 40 (r15 78), the sky 83 against 88, the colour (sat 0.54 against 0.67), and near sand 62.3 against 57.2. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The right glow is thin (x 0.72–1, y 0.38–0.47).** The skyline now matches (0.429–0.440 against 0.418–0.439) and the glow is uncovered (61 against 87.5; r15 36), but its peak is 80 against 156. 2. **The near sand regressed** (31.7 against 39.8; r15 39.1) and the left backdrop is still lit (55 against 39). 3. **The wagon and the viewmodel.** The wagon has half the mockup's surface detail. The cut cord and the stub grip, where the mockup has two broad coils over a hand. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.9** | 1. **The waymark rise overshot (x 0.6–1, y 0.42–0.53).** The far fire is on a skyline hump again (fixing round 15's loss), but the right skyline is 0.430–0.450 against 0.455–0.469 and covers the glow band (30 against 72.5; r15 99). The flame is at 0.829, 0.428 against the brazier's ≈ 0.885, 0.465. 2. **The fire (x 0.25–0.5, y 0.20–0.53). Repeated.** It is now about the right area, but its white core is 129 against 2 722 pixels over 245, with no readable logs. 3. **The ground and the viewmodel.** The near sand closed in (36.8 against 33.0) and the pool too (48.5 against 40.5). The cut cord and the stub grip are new. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`, back at round 14's stand) | **6.6** | 1. **The hero hand (x 0.55–1, y 0.6–0.86).** It is lighter and lower, but it shows the thumb side, with the handle a stub above it, and not the mockup's stitched back of the hand with the coil hanging from it. The cord is cut short of the handle (new). Leather fine 3.6 against 8.2, p95 60 against 79. 2. **The land under the horizon (y 0.48–0.72).** It is the honest field again, flat 34–38 against the mockup's dark 13–17 band and its lit stripe (36 against 59). 3. **The horizon.** The tower is now at the mockup's size and x (a gain), under the HUD's world label. A small flyer crosses the left, where D has none. |

**Seat score, Signal Dunes: (5.9 + 5.9 + 6.9 + 6.9 + 6.6) / 5 = 6.44 → 6.4.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7.
- Down 0.3. The spawn pair fell 0.5 and 0.4: the pale sheet and the busy middle ripples are fixed, but the band is now
  one dark wall with none of the mockups' lit crest. That costs more than the two fixes gave.
- B gained 0.1 (the skyline). C lost 0.1 (the rise overshot onto the glow). D lost 0.3: I had credited its land partly
  in round 15, and the honest field is round 14's. The hand's cut cord costs a little in every view.

## The builder's claims checked against the pixels and the source

| Claim (README / 232dbb408) | Verdict | Evidence |
|---|---|---|
| The late far-land term is removed; the late clip should show it. | **True** | `farLate` is gone from render.ts. The late clip's ground (y 400–1000 of 1168) is **27.2–30.2**, with 0.0–0.2 % under Y 5 (r15 4.5–6.7, 39–78 %; r13 24.4–28.4). The forms read again (the clip at 1 fps). |
| Every remaining distance-faded term is zero-mean; no distance fade changes brightness. | **The ripples, yes. The grain terms, no (small)** | The ripple term's mean is −0.7/π = −0.2228, and +0.2228 cancels it (residual −1.5e-5). But the grain tile's R mean is **0.4909**, not 0.5: the three `(r − 0.5)` octaves faded by `sandFar` (weights 1.8 + 1.3 + 1.6) sum to **−4.3 % albedo at the camera**, zero by 22–40 m. The new glint pair is asymmetric (0.14 % of texels over 0.82, 0.98 % under 0.18): mean **−0.46 %**, where the old glint was +0.03 %. Net about −3.4 to −4.8 % at the camera, under 2 luma on the near patch. See R16B-6. |
| Shade position: 10 × 7 grid r with A +0.50, dusk-fire +0.25. | **Reproduces roughly; not the form** | Mine is +0.46 / +0.15 on that grid (+0.23 / +0.28 on mine). The lit diagonal is 32 against 96.7, dusk-fire's lit shoulder 29.8 against 70.6, the band's spread 13 against 62. |
| The pale sheet came from the flipped wind; dusk-fire 74 → 35 (mockup 46), A 56 → 34 (mockup 60). | **True** (regions not named) | The far strip right of the tower: dusk-fire 111.9 → 36.2 against 34.5; A 77.6 → 35.2 against 40.5. |
| Lit-sand saturation 0.64–0.66 (mockups 0.59–0.66). | **True on the near patch; not on the lit band** | Near patch 0.66 / 0.69 against 0.67 / 0.59. The band's lit top 15 % is 0.47–0.54 against 0.67 (r15 0.34–0.41). |
| Mid-distance ripples 0.7 → 0.26, near unchanged. | **True; it also flattened the lit strip at 5–20 m** | The middle boxes are 3.7–6.0 % against 5.0–5.5 % (r15 11.7–17.3). The near patch holds (9.9 % against 10.1 %). The lit strip y 0.55–0.62 is 2.3–2.5 % against 6.9–8.4 %. |
| B's dune 26 → 21 m. | **True, and right** | The skyline is 0.429–0.440 against 0.418–0.439. The glow is 61 against 87.5 (r15 36). |
| Waymark 0 on a 24 m rise for C's far brazier. | **True; it overshot** | Bake ground 24.0 m (ring 6–20 m: 20.8–24.0; max slope within 16 m 24.5°). C's right skyline is 0.015–0.03 high, and the glow band is 30 against 72.5. |
| Waymark 1's 10 m lift is back; check its slopes. | **True, and walkable** | wm1 ground 15.8 m, ring 13.0–15.8, max slope within 16 m 21.4°. Inner ±200 m max 39.1°, none over 40° (271 cells over 35°; r13 352). |
| The fist turned so the back of the hand and the cuff face the camera, the fingers round the handle; lighter, glossier leather. | **Lighter: true. The pose: no** | `rot` y 0.85 → −0.4, `pos` y −0.13 → −0.19. On screen the thumb side faces the camera with the handle a stub above it. Leather mean 38 against 30.4, p95 60 against 79. |
| The loop's plane faces the camera; the fall is routed behind the hand. | **The plane: true. The cord: now detached** | `LOOP.face` 0.6 → −0.35: a round ring. The fall runs down to the right under the HUD buttons. The cord's upper end is a cut tube 0.06 of the frame short of the handle (R16B-2). |
| mock-D back at (38, 122), yaw 21.7, the tower at the mockup's size. | **True** | camAt (37.99, 27.59, 121.99), eye 1.70 over the bake. The tower body is ≈ 0.041 against ≈ 0.042. |
| Max climb 39.1°. | **True** | As above. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R16B-1 | A, dusk-fire (h1, first-frame) | should-fix | **regression** (232dbb408's crest) | A x 0.2–1, y 0.37–0.56; dusk-fire x 0–1, y 0.37–0.56 | **The authored crest's slip face fills both spawn views as one dark wall.** The band is 33–36 with a 13–48-luma spread against 56–58 and 62–82. The lit diagonal is 32 against 96.7, dusk-fire's lit shoulder 30 against 71, and the tower's mound is hidden. **Cause (bake):** the crest is 20 → 23.5 → 27 m against A's 23.05 m eye, so from the spawn the camera stands below the crest's near half and sees only its 30 m lee. **Fix:** keep the wind, but drop the crest under the eye: the middle point (14.4, −9.3) from 23.5 to about 17 m and the near-right end (75.7, 42.1) from 27 to about 19 m. Narrow `lee` from 30 to about 15 m, so the shaded face is a band (the mockup's y 0.42–0.52) under a visible lit rim, with the tower's mound showing above it. **Accept** offline, before the capture: A's diagonal box ≥ 75, the band's p95 ≥ 95, dusk-fire's left shoulder ≥ 60, the spawn pair's shade share within 15 points of 50 / 61 % and 19 / 46 %, and the 10 × 7 r kept ≥ +0.4. **Process:** a grid r alone passed a frame with no lit crest; add the diagonal box and the band's spread to the overlay's acceptance. The crest is still placed by A's frame (repeated should-fix, rounds 13–15). |
| R16B-2 | all five | should-fix | **new** (232dbb408 `HD_GLOVE.rot`) | A x 0.47–0.62, y 0.64–0.70 (the same joint in every view) | **The whip's cord is cut off short of its handle:** an open tube end in mid-air, ≈ 0.06 of the frame left of the handle's top, in all five scored views. **Fix:** recompute `LOOP.from` from the turned handle's top (or parent the cord's start to the handle's top node), and add a check that the cord's first point is within 1 cm of the handle top in the viewmodel's space. |
| R16B-3 | C (B, D at the edges) | should-fix | **new** (the wm0 mound) | x 0.6–1, y 0.42–0.53 | **Waymark 0's rise overshot onto the glow.** The right skyline is 0.430–0.450 against 0.455–0.469, the glow band 30 against 72.5, and the flame 0.04 high and 0.06 left of the mockup's brazier. At 113 m, 0.035 of the frame is ≈ 6 m. **Fix:** the wm0 mound 24 → about 18 m, and `r` 66 → about 40 m, so the hump is local (the mockup's hump is ≈ 0.08 of the width). **Check:** skyline 0.455–0.469 at x 0.6–0.8, the glow ≥ 65, the flame's top ≈ 0.465. Keep its slopes ≤ 25°. |
| R16B-4 | A, dusk-fire | should-fix | **regression** (the 0.26 ramp) | A x 0–0.6, y 0.56–0.62; dusk-fire x 0.1–0.6, y 0.55–0.62 | **The mid-ripple cut also flattened the lit sand at about 5–20 m:** 2.3–2.5 % against 6.9–8.4 %, fine 1.2–1.4 against 7.1–8.1. **Fix:** start the ramp later, `mix(0.52, 0.26, smoothstep(14, 40, sandFar))`, and re-measure both boxes. Accept at ≥ 6 % in the lit strip, with the middle boxes kept at 4–6 %. |
| R16B-5 | all five, D first | should-fix | **repeated** (R15B-7, R14B-2) | x 0.55–1, y 0.6–0.86 | **The grip.** It is lighter and lower, but it is the thumb side over an upright handle stub, with the coil free beside it. Mockup D shows the stitched back of the hand with the loops hanging from the fist, and A, B and C show broad coils rising from the bottom edge. **Fix:** turn the hand until the knuckles and the back of the hand face the camera (the cuff leaving the right edge), and sink the handle into the fist so no stub shows above it. Hang the coil's top from the fist (`LOOP.c` toward the hand) rather than beside it. Restore crease and stitch contrast (fine 3.6 against 8.2, p95 60 against 79). |
| R16B-6 | all (near sand) | should-fix (the lead to rule; not a void in my reading) | **new** (the glint pair) / old (the grain octaves) | the near 0–40 m of every view | **Two distance-faded terms are not zero-mean, against the hard rule's test.** The grain tile's mean is 0.4909, so the three `(texture.r − 0.5) · fade(sandFar)` octaves add −4.3 % albedo at the camera. The new glint/speck pair has mean −0.46 % (0.98 % of texels under 0.18, 0.14 % over 0.82), and the fwidth-faded `glint` block is +1.35 %. Net about −3.4 % at the camera, fading to 0 by 22–40 m: under 2 luma, and a darkening toward the camera rather than away from it. **Fix:** centre the octaves on the tile's measured mean (0.4909) and make the speck pair symmetric (pick the threshold pair from the tile's histogram, or drop the dark half). Then the builder's "no distance fade changes brightness" holds exactly. **Why not a void:** the far land is not darkened; the clip measures normal; the octaves predate the rule. |
| R16B-7 | B (dusk-fire, A) | should-fix | **new / process** | B near patch; LUT | **The LUT is stale, and it was the round's unlisted change.** It was fitted on round 15's wind-away frames, and its own README says to re-fit when the wind changes; the wind flipped back in this round. Between the captures, B's near sand dropped 39.1 → 31.7 (mockup 39.8) and dusk-fire's 71.4 → 64.6 (74.8), against the README's predicted 1.5–3.5. **Fix:** re-fit on round 16's no-LUT `mock-*` frames, then re-measure the near patches. List the LUT as a change in the round's README (it is new in this capture). |
| R16B-8 | B | should-fix | **repeated** (row 5) | x 0.72–1, y 0.38–0.47; x 0–0.2, y 0.455–0.475 | **With the skyline right, B's glow is still thin:** its peak is 80 against 156, with 5 rows over 80 against 114. The left backdrop is lit at 55 against 39. **Fix:** a wider, brighter afterglow band in the dome at B's azimuth (row 5's parked painted sky), and a darker west backdrop (its facing under the late fill). |
| R16B-9 | D | should-fix | **repeated** (R15B-1's real fix) | y 0.48–0.72 | **D's land is the flat honest field (34–38) again.** The mockup has a dark 13–17 band under the horizon and a lit stripe at 50–61 (y 0.64–0.67). **Fix:** build it from landforms seen from (38, 122): one transverse crest ≈ 40–60 m out with its slip face toward the camera (the dark band), and a lit windward rim before it (the stripe). No shader term by distance. |
| R16B-10 | C, dusk-fire | should-fix | **repeated** (row 6) | flame x 0.25–0.5, y 0.20–0.53 | The flame's area now matches (11.3k against 13.7k over 150), but the white core is 129 against 2 722 pixels over 245, with no logs. Row 6, which is parked. |

## Ledger 5 (no shortcuts)

- **The hard rule (no camera-distance darkening): the round-15 breach is fixed.** `farLate` is deleted, and the late clip's
  ground is back at 27–30 with no near-black (r15 4.5–6.7). Shader terms faded by `sandFar` remain, all LOD fades of
  detail. The ripples are exactly zero-mean. The grain octaves and the new glint pair carry about −3.4 % at the camera
  (R16B-6). That is a residual against the builder's own test, not the far-land darkening the rule was written for, so I
  do not void the round. I flag it for the lead's ruling. `sheenV` uses the view angle, not the distance.
- **Views:** only mock-D changed in cameras.json, back to round 14's (38, 122) stand. That is the fixed point seat A asked
  to restore in round 15, and it puts the tower at the mockup's size. The other real-camera moves are vertical and equal
  the bake's ground change (A, dusk-fire and h1 +1.81, B and h2 +1.10, C −0.08, h3 +11.53 on waymark 0's new rise, h4
  −0.07). Every eye is 1.70 m over the decoded r16 ground. No breach.
- **No screenshot cheats:** the crest, the B dune and the wm0 rise are baked terrain with a re-baked navmesh. WIND, the
  sand shader, the LUT and the viewmodel are global, and the viewmodel is one hold in every view. The LUT is fitted on the
  scored mockups, but it is a shipped, global grade, and it is applied in h1–h4 and the clip too (the Sky Reach precedent).
- **No narrowing:** the aerials show one dune sea with consistent slip faces. Relief over 15° is 25.5 % (r15 26.5 %, r13
  21.1 %), the max slope 39.1°, waymark 1's ring ≤ 21.4°. The late clip reads.
- **Staged state:** unchanged (`logbook`, `waymarks-lit` ×2). 232dbb408 touches no stage handler and no dusk curve.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD and the 30 fps chip in every frame. `pageErrors` is
  empty, `active` is empty, and there are no QA retakes. Device memory and frame times are not on this surface:
  unverified, not breached.

No score is voided.

SCORE signal-dunes: 6.4

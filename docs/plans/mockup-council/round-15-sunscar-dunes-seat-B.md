# Round 15, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 amendment), the brief, `scores.md`, and round 14's three Signal
  Dunes seat files.
- The "Signal Dunes, round 15" section of `art/mockup-council/round-15/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0835-c1b820c3/` (the `mock-*` views, h1–h4, both aerials, `clip.mp4`
  at 1 fps, `meta.json`), against round 14's `20261003-0730-69642e60/` for before and after.
- The five ledger mockups, Lanczos-scaled to 780×1688.

Source checks (read-only `git show`): 662e6e99b (`layout.ts`, `look/render.ts`, `world/dunes.ts`, `weapons/whipModel.ts`,
`cameras.json`, the bake), 9d610a30d and a1aa357f7. The terrain bakes at 69642e60 and c1b820c3, decoded as 256² float32
heights over 500 m from byte 24. Every non-aerial camAt eye is 1.70 m over the decoded ground (h4 stands on the deck), so
the decode is right.

How I measured. These are the same tools as rounds 13 and 14, so the numbers compare across rounds:
- **Brightness** is Rec. 709 luma.
- **Fine** is the mean of |luma − luma blurred at σ 2|.
- **Ripple %** is the mean of |blur σ1 − blur σ5| as a percentage of the region's mean luma.
- **Macro r** is the Pearson r of σ-12 luma over rows 120–1400.
- **Grid r** uses 0.1 × 0.02 cell means.
- **Crest edge** is, per column, the strongest dark-above → lit-below step (σ3 luma, 4-px step).
- **Sat** is the mean of (max − min) / max over RGB.
- **The clean patch** is x 10–160, y 1160–1400. I checked it is clear of the new loop, its fall, Sefa and the HUD in all
  five views. Round 13's box (x 10–190, y 1160–1420) agrees within 1.0, and the builder's patch numbers match it.
- **Regions** are frame fractions (x left → right, y top → bottom) or pixel boxes on the 780-px frame.

## What changed (r14 → r15)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky above y 0.33 |
|---|---|---|---|
| dusk-fire | 15.4 | 25.6 % | 1.8 |
| A | 14.3 | 23.9 % | 1.7 |
| B | 5.8 | 6.7 % | 0.6 |
| C | 9.3 | 12.2 % | 4.9 |
| D | 6.6 | 12.3 % | 1.5 |

The sky is untouched. Everything that moved is the land, its light, and the viewmodel.

## Measurements (mockup / r14 / r15)

### Near sand, clean patch

| View | Mean | p5–p95 | Fine | Ripple % | RGB |
|---|---|---|---|---|---|
| dusk-fire | 74.8 / 45.0 / **71.4** | 46–113 / 10–77 / **38–93** | 9.7 / 10.4 / **7.2** | 10.7 / 18.9 / **8.3** | 114,66,38 / 76,37,21 / **105,64,40** |
| A spawn | 57.2 / 45.9 / **64.3** | 32–94 / 11–78 / **28–89** | 9.4 / 10.8 / **8.5** | 10.4 / 19.6 / **11.3** | 87,50,35 / 78,38,20 / **98,57,34** |
| B logbook | 39.8 / 29.2 / **39.1** | 31–49 / 15–42 / **28–50** | 2.0 / 2.8 / 3.1 | 4.7 / 9.5 / 8.2 | 62,34,27 / 50,23,19 / **66,32,25** |
| C waymark | 33.0 / 41.1 / 41.1 | 28–37 / 29–52 / 32–50 | 0.2 / 2.1 / 1.7 | 1.2 / 4.4 / 4.3 | 53,27,22 / 66,34,30 / 68,34,28 |
| D hands | 35.9 / 32.8 / 32.5 | 25–48 / 25–40 / 26–40 | 0.2 / 1.4 / 1.8 | 1.1 / 5.2 / 6.1 | 52,31,27 / 54,27,24 / 53,26,25 |

- **The near sand is back, and the ripple halving landed.** The spawn pair's mean is within 3.4 (dusk-fire) and 7.1 (A) of
  the mockups. The near ripple is 8.3–11.3 % against 10.4–10.7 %, with no near-black troughs: p5 is 28–38 against 32–46.
- **dusk-fire's grain is now under its mockup:** fine 7.2 against 9.7. A's is closer, at 8.5 against 9.4.

### The middle distance: the ripples moved out, not down

| Region | Mockup | r14 | r15 |
|---|---|---|---|
| A, x 0.1–0.5, y 0.37–0.45: ripple % / fine | 5.3 / 3.1 | 5.6 / 1.6 | **12.1 / 4.4** |
| A, x 0.1–0.6, y 0.48–0.56: ripple % / fine | 5.8 / 3.8 | 10.2 / 4.3 | **18.1 / 5.8** |
| dusk-fire, x 0.15–0.6, y 0.42–0.50: ripple % / fine | 5.9 / 3.7 | 6.5 / 1.5 | **14.8 / 5.8** |

The near amplitude was halved (`sandNear` 1.05 → 0.52), but the middle value (0.7 past 26 m) was kept. The middle band
now faces the camera under a raking key, so its ripples read at **2.3–3.1× the mockups' contrast**: the dark worm lines
across the crest face in both spawn views. The lead's first look named it, and it measures.

### The spawn pair: the dune band

**A, grid x 0.1–1** (the mockup's lit diagonal is the run of 81–108):

| y | Mockup | r15 |
|---|---|---|
| 0.38 | 47 83 101 92 60 41 40 37 34 | 65 66 41 39 40 42 53 100 112 |
| 0.40 | 41 40 83 105 104 90 54 35 34 | 52 56 62 48 39 40 41 68 97 |
| 0.42 | 41 38 39 81 108 92 85 56 53 | 51 55 59 65 61 39 39 48 54 |
| 0.44 | 40 38 36 39 76 107 73 45 39 | 54 52 53 54 62 67 38 39 39 |
| 0.46 | 41 40 37 35 39 68 96 56 36 | 54 53 50 53 60 67 77 38 36 |

| Region / metric | Mockup | r13 | r14 | r15 |
|---|---|---|---|---|
| A grid r, x 0.1–1, y 0.34–0.50 | | +0.49 | −0.02 | **+0.10** |
| A crest edge at x 0.25 / 0.55 / 0.65 / 0.75 / 0.85 / 0.95 | 0.364 / 0.395 / 0.405 / 0.416 / 0.481 / 0.491 | | 0.416 / 0.492 / 0.498 / 0.368 / 0.502 / 0.505 | **0.371 / 0.428 / 0.448 / 0.467 / 0.486 / 0.494** |
| A lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.5 | 50.6 | 30.0 | **48.5** |
| A left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 39.5 | 52.9 | **49.3** |
| A right under the crest, x 0.5–1, y 0.48–0.54 | 42.5 | 69.3 | 57.5 | **75.0** |
| A far strip, x 0.6–1, y 0.37–0.40 | 40.4 | | 35.9 | **77.9** |
| A shade share, Y < 45 over y 0.36–0.58, left / right half | 50 / 61 % | | 40 / 62 % | **30 / 37 %** |
| A whole-frame macro r | | +0.68 | +0.62 | +0.60 |

- **The crest now crosses the frame where the mockup's does.** Its edge starts at 0.371 against 0.364 at x 0.25 and ends
  at 0.494 against 0.491 at x 0.95. In between it sags **0.03–0.05 low** (x 0.55–0.75), a convex bow where the mockup's
  line is straight.
- **Under the line, the light is the mockup's in reverse.** The mockup has a narrow bright stripe (96–108) over shade
  (35–41). r15 has a broad, moderate, rippled face (50–67) with no shade under it, and the right half under the crest is
  lit at 75 against 42.5.
- So **the band's correlation barely moved: +0.10**, against round 13's +0.49. Measured by one fixed threshold, the view
  is now *less* shaded than the mockup in both halves (30 / 37 % against 50 / 61 %).

**dusk-fire, the same grid.**

| Region / metric | Mockup | r14 | r15 |
|---|---|---|---|
| Grid r, x 0.1–1, y 0.34–0.50 / wide x 0–1, y 0.34–0.58 | | +0.02 / +0.07 | **−0.03 / −0.18** |
| Whole-frame macro r | | +0.45 | **+0.40** |
| Lit near-left face, x 0–0.35, y 0.50–0.70 | 82.9 | 55.4 | **69.6** |
| Lit swell, x 0–1, y 0.42–0.47 | 60.3 | 31.8 | **49.1** |
| Saddle shade, x 0.35–0.9, y 0.46–0.56 | 54.6 | 54.0 | **74.2** |
| Right lee, x 0.5–1, y 0.48–0.54 | 47.7 | 59.8 | **82.5** |
| Far strip right of the mound, x 0.6–1, y 0.37–0.40 | 34.4 | 36.4 | **113.0** |
| Shade share (Y < 45), left / right | 19 / 46 % | 54 / 62 % | **37 / 35 %** |
| Sky box (40,300)–(540,600) | 75.9 | 99.8 | 100.6 |

The left face came back toward its mockup. But the right half, which the mockup keeps in shade (the saddle, then the dark
far dunes behind the mound), is now **the brightest land in the frame**.

### A new pale far field, and desaturated lit sand (both spawn views)

| Region | Mockup Y / sat / RGB | r14 | r15 |
|---|---|---|---|
| dusk-fire far strip, x 0.6–1, y 0.37–0.40 | 34 / 0.24 / 42,32,35 | 36 / 0.41 | **113 / 0.33 / 137,107,92** |
| dusk-fire right middle, x 0.7–1, y 0.40–0.47 | 54 / 0.55 / 83,47,34 | 30 / 0.40 | **64 / 0.36 / 82,59,55** |
| A far strip, x 0.6–1, y 0.37–0.40 | 40 / 0.27 | 36 / 0.40 | **78 / 0.36 / 99,72,65** |
| Top 15 % of the dune band (y 0.38–0.58), A | 177,100,59, sat 0.67 | 109,72,54, 0.51 | **124,92,74, 0.40** |
| Top 15 % of the dune band, dusk-fire | 143,82,47, sat 0.67 | 110,73,54, 0.50 | **136,107,90, 0.34** |

- **What it looks like.** In the full-res crops, the land 150–250 m out, beyond and right of the tower's mound, is a pale
  beige-grey sheet, like fog or a cloud sea. In the mockups that land is dark violet rows.
- **The lit sand has lost its colour.** The lit faces carry G/R 0.74–0.79, where the mockups' are 0.56–0.57: pale and
  pinkish where the mockups' are saturated copper.
- **The cause, probably.** This is new with 662e6e99b's two global changes:
  - the key now sits in front of the camera, at 23.5°;
  - the WIND flip turned every slip face toward that key.

  So the far rows show their key-lit slip faces at a grazing angle, where the row-2 sheen (`1 + 0.35 · (1 − N·V)^4`) is
  at its strongest. I did not isolate the cause, but the region and the timing point to it.

### B

| Region | Mockup | r14 | r15 |
|---|---|---|---|
| Skyline right of the wagon, at x 0.75 / 0.82 / 0.88 / 0.94 / 0.98 | 0.437 / 0.438 / 0.439 / 0.431 / 0.418 | 0.456 / 0.454 / 0.458 / 0.456 / 0.456 | **0.406 / 0.395 / 0.387 / 0.384 / 0.383** |
| Horizon glow, x 0.72–0.90, y 0.40–0.47 | 87.5 | 84.0 | **35.5** |
| Glow on the right: peak, rows over 100 | 159, 83 | 107, 18 | **83, 0** |
| Under the backdrop, x 0.72–0.95, y 0.44–0.49 | 24.0 | 57.0 | **28.9** |
| Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.9 | 60.2 | 56.2 |
| Wagon (mockup x 0.42–0.66, game x 0.49–0.71; y 0.40–0.50): mean, fine | 53.2, 12.2 | 42.9, 6.3 | 40.1, 6.3 |
| Camp band macro r, y 0.40–0.60 / whole frame | | +0.71 / +0.79 | **+0.57 / +0.70** |

- **The new dune behind the caravan** (LANDFORMS mound (−118, −30), 26 m, r 60; 93 m from B's camera) rises
  **0.03–0.05 of the frame over the mockup's low ridge**. It is lit and rippled, where the mockup's is a dark silhouette.
  It hides the orange glow band on the right: 35.5 against 87.5, after round 14's 84.
- **The land below it got darker,** as the builder says: 28.9 against 24.0. But that came with the glow's loss.
- **The near sand is now right:** 39.1 against 39.8.

### C

| Region | Mockup | r14 | r15 |
|---|---|---|---|
| Right skyline, at x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | 0.469 / 0.466 / 0.463 / 0.430 (the waymark's hump) / 0.455 | 0.447 / 0.436 / 0.432 / 0.432 / 0.433 | **0.486 / 0.485 / 0.481 / 0.468 / 0.470** |
| Glow band, x 0.6–1, y 0.44–0.47 | 72.1 | 32.9 | **98.9** |
| Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 30.7 | **24.1** |
| Pool, (150,1060)–(450,1150) | 40.4 | 52.9 | 52.4 |
| Flame, (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 19 020 / 2 676 / 392 | **21 389 / 3 831 / 316** |

- **The far waymark has no rise any more.** It is waymark 0, at (58, −34), 113 m out, and it projects to x 0.829. Its
  ground went from 25.2 m to **12.5 m** (the crest moved away), so it burns as a low fire with a smoke trail just under
  the skyline (x ≈ 0.82, y ≈ 0.50). The mockup shows a brazier silhouetted on a rise against the glow (x 0.885, top
  y ≈ 0.465).
- **The skyline overshot downward.** It is now 0.015 low, where round 14 was 0.02–0.035 high.
- **The glow band is open again,** at 98.9 against 72.1.
- **The fire is unchanged (row 6):** 1.6× the mockup's area over 150, and its white core is 12 % of the mockup's.

### D

| Region | Mockup | r14 | r15 |
|---|---|---|---|
| Land y 0.52–0.62, left / right half | 16.0 / 16.0 | 36.7 / 26.6 | **14.7 / 11.3** |
| Rows x 0–0.4 at y 0.48, 0.50 … 0.70 | 149 51 15 16 20 15 13 22 64 54 48 45 | 68 34 36 37 38 38 37 36 36 35 34 34 | **52 14 9 6 6 15 36 35 35 36 33 32** |
| Lit near band, x 0–0.4, y 0.64–0.68 | 58.7 | 35.5 | 35.4 |
| Land grid r, x 0–0.4, y 0.50–0.66 | | −0.26 | **+0.27** |
| Afterglow, column x 300–500: peak at y, rows over 100 | 163 at 0.496, 121 | 177 at 0.477, 85 | 177 at 0.479, 81 |
| Tower height in frame, body (antenna) | 0.042 (0.052) | (0.064) | **0.057 (0.079)** |

- **The land under the horizon is now dark,** as the mockup's is. Its mean matches. But the band just under the horizon
  overshoots, at **6–9 against 15–20**.
- **The bands are still not authored.** The mockup's lit stripe at y 0.64–0.66 is missing (35 against 64), and so is
  its layered rhythm.
- **The tower is 1.35–1.5× the mockup's height,** because the camera moved 30 m toward it (ledger 5, below). The
  baseline HUD's "SIGNAL TOWER 170" world label crosses it.

### The glove and the loop (every view; full-res crops)

| | Mockup D | r14 | r15 |
|---|---|---|---|
| Leather, D's back of glove (590,1130)–(740,1260) against the game's fist ((520,1090)–(700,1300) in r14; (500,1030)–(630,1240) in r15): Y mean, p95, fine | 30.4, 79, 8.3 | 24.7, 51, 3.4 | **26.5, 49, 2.8** |
| Fist on screen | top ≈ 0.65, x 0.73–1.0, cuff out of the right edge | top ≈ 0.61, x 0.58–0.95 | **top ≈ 0.60, x 0.63–0.81, handle to 0.567** |
| Loop on screen | slim loops beside the fist, x 0.57–0.82, y 0.60–0.76 (dusk-fire: one teardrop from the hand up-left, x 0.37–0.71, y 0.60–0.78) | open arch, off-screen loop | **a round closed ring left of the fist, x 0.27–0.63, y 0.59–0.78** |

- **What landed.** The glove is 0.7 the size (0.22 → 0.155) and the loop is a closed ellipse, as claimed. The loop sits
  over DODGE / JUMP, so the viewmodel no longer fills the lower right.
- **What didn't.** The rot y +0.5 rad still shows the camera four stacked finger bands with the handle upright above
  them. `pos.y` went from −0.20 to −0.13, so the fist didn't come down.
- **The ring hangs free.** It sits 0.1 left of dusk-fire's loop and doesn't touch the hand: the cord crosses from the
  handle's top.
- **The fall doesn't drop behind the hand.** It drops from the ring's foot at x 0.40–0.47 to the HUD bar, in front of
  open sand, 0.2 of the frame left of the hand.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.4** | 1. **The right half is lit and pale where the mockup is in shade (x 0.35–1, y 0.37–0.56).** New. Saddle 74 against 55, right lee 83 against 48, and the far strip right of the mound 113 against 34, a beige-grey sheet. Wide grid r is −0.18 (r14 +0.07). 2. **The colour and texture of the lit sand (y 0.40–0.70).** The top 15 % is 136,107,90 (sat 0.34) against 143,82,47 (0.67). The middle ripples read at 14.8 % against 5.9 %. The near patch is the gain: 71.4 against 74.8 (r14 45). 3. **The sky and the viewmodel.** The sky is unchanged at 100.6 against 75.9 (row 5). The closed ring is now the mockup's idea (one loop), but it hangs left of an upright fist (top 0.60) where the mockup's teardrop runs from a low glove in the corner (0.70). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **The lit diagonal is a broad, moderate face, not a bright stripe over shade (x 0.3–1, y 0.38–0.54).** The diagonal is 48.5 against 96.5 (r14 30). The right half under it is 75 against 42.5, and the line sags 0.03–0.05 at x 0.55–0.75. Grid r +0.10. The crest's ends now sit at the mockup's (0.371 / 0.494 against 0.364 / 0.491). 2. **The far field and the colour (x 0.6–1, y 0.37–0.47).** The pale far strip is 78 against 40, and the lit sand's sat 0.40 against 0.67. 3. **The middle ripples and the viewmodel.** The ripples are 12–18 % against 5–6 %. The near patch is now 7 over (64.3 against 57.2), with the grain right. The ring and upright fist stand where the mockup has two broad low coils. Sefa is out of the frame (row 9, a gain). |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.8** | 1. **The new backdrop dune hides the right glow (x 0.72–1, y 0.38–0.47).** Regression. The skyline is 0.383–0.406 against 0.418–0.439, and the glow 35.5 against 87.5 (r14 84). The dune is lit and rippled where the mockup's is a dark silhouette. Camp band macro r +0.71 → +0.57. 2. **The left backdrop is still lit** (x 0–0.2, y 0.455–0.475): 56 against 40. 3. **The wagon and the viewmodel.** The wagon is 40.1 against 53.2 with half the mockup's surface detail (fine 6.3 against 12.2). The ring and fist stand where the mockup has two broad coils. Gain: the near sand at 39.1 against 39.8. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.0** | 1. **The far waymark (wm0, x ≈ 0.82) lost its rise (x 0.75–1, y 0.43–0.53).** It is a low ground fire under the skyline, not a brazier silhouetted on a hump at y 0.43. The skyline is 0.468–0.486 against 0.430–0.469. 2. **The fire (x 0.25–0.5, y 0.20–0.53).** Repeated: 1.6× the area, the white core 12 %, no readable logs. 3. **The ground and the viewmodel.** The pool is still a broad orange floor (52.4 against 40.4) and the near patch is 41.1 against 33.0. The ring stands where the mockup has two low coils. The far land improved (24.1 against 16.1; r14 30.7). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`, re-aimed) | **6.9** | 1. **The hero hand (x 0.55–1, y 0.55–0.86).** Smaller and with a closed loop, but still the finger side to the camera, top 0.60 against 0.65, leather fine 2.8 against 8.3. A round ring hangs left where the mockup has slim loops hanging from the fist. 2. **The land under the horizon (y 0.48–0.70).** Its mean now matches (14.7 / 11.3 against 16 / 16; grid r +0.27), but the band just under the horizon is 6–9 against 15–20 and the lit stripe at y 0.64–0.66 is missing (35 against 64). This rides on a camera-distance gate (R15B-1). 3. **The tower is 1.35–1.5× the mockup's size** (the 30 m move toward it), with the HUD world label across it. The afterglow is close: 177 at 0.479 against 163 at 0.496. |

**Seat score, Signal Dunes: (6.4 + 6.3 + 6.8 + 7.0 + 6.9) / 5 = 6.68 → 6.7.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7.
- The spawn pair recovered part of round 14's loss (+0.2 each), mainly through the near sand. The crest's new line is
  right at its ends, but the band's light is not yet the mockup's.
- B lost its glow to the new dune (−0.3), and C its waymark rise (−0.1). D gained in the land (+0.1).
- The mean is flat.

## The builder's claims checked against the pixels and the source

| Claim (README / 662e6e99b) | Verdict | Evidence |
|---|---|---|
| The key at 23.5°, the glow +12°. | **True** | `KEY.dir` (0.39, 0.2, −0.9): heading +23.4°, SUN_GLOW +11.5°. B's backdrop is no longer lit from behind (under it, 28.9 against 24). |
| The WIND is flipped; the crest runs across it. | **True** | WIND (0.643, −0.766). The crest's direction (0.766, 0.643) is exactly perpendicular to it (dot 0.000), and it crosses the key at 73° (round 14: 9–13°). leeSide −1 puts the slip face away from the camera. |
| The crest runs from ~0.37 at the left edge to ~0.48 at the right. | **True at the ends; it sags in the middle** | The crest edge is 0.371 at x 0.25 and 0.486–0.494 at x 0.85–0.95. At x 0.55–0.75 it is 0.03–0.05 below the mockup's straight line. |
| "Its windward faces lit toward the camera; its slip faces shaded beyond." | **Lit: true. The result: not the mockup's** | The windward face is lit at 50–67 with strong ripples, but the mockup's stripe is 96–108 over shade. A's grid r is +0.10 (r13 +0.49). |
| Shade share left / right: A 34 / 38 % (mockup 23 / 40), dusk-fire 39 / 36 % (mockup 19 / 45). | **Not reproducible as stated** | No band or threshold is given. With a fixed Y < 45 over y 0.36–0.58, the mockups are A 50 / 61 % and dusk-fire 19 / 46 %, and r15 is **30 / 37 %** and **37 / 35 %**: A is now less shaded than its mockup on both sides, and dusk-fire's right half too. |
| Peak 25 m, for C's skyline. | **True; it overshot** | The bake's heightRange is now 25.7. C's skyline is 0.468–0.486 against 0.455–0.469 (0.015 low), and waymark 0 fell from 25.2 to 12.5 m, so its rise is gone. |
| Near ripples halved. | **True near; the middle kept its contrast** | `sandNear` 1.05 → 0.52 near, 0.7 kept past 26 m. The near patch is at 8.3–11.3 % against 10.4–10.7 % (r14 18.9–19.6). The middle bands are at 12.1–18.1 % against 5.3–5.9 %. |
| The late facing-darkening windows widened. | **True; now near-global** | `smoothstep(−0.65, 0.15, toGlow)` and tilt `smoothstep(0.06, 0.5)`: every face not turned clearly to the glow, from about 3.4° of tilt, is cut up to 45 %. |
| The land under the dusk horizon: B right of the wagon 36–45 (mockup 17–25); D under the horizon 10 (mockup 17). | **Roughly true. D's comes from a camera-distance gate** | My boxes: B 28.9 against 24.0, D rows y 0.50–0.58 at 6–15 against 15–20. `farLate = smoothstep(0.55, 0.85, uDusk) · smoothstep(15, 70, sandFar)`, and `sandFar = length(vSandPos − cameraPosition)`. See R15B-1. |
| B's skyline: a dune behind the caravan, the pad's ease 55 m. | **True; too tall** | The mound (−118, −30, 26 m) raises B's skyline to 0.383–0.406 against 0.418–0.439, and the right glow goes from 84 to 35.5 against 87.5. |
| Waymark 1's 10 m lift removed. | **True in source** | `lift: 0` for every brazier. wm1's ground is 15.7 (r14 15.4), with a ≤ 2° ring. |
| The glove: 0.7 size, turned toward three-quarter; the loop a closed ellipse beside the fist, above DODGE / JUMP; the fall behind the hand. | **Size, ellipse, place: true. Three-quarter: partly. "Fall behind the hand": false** | Size 0.155/0.22 = 0.70; rot y 0.35 → 0.85. On screen the finger bands still face the camera. The fall drops from the ring's foot at x 0.40–0.47, 0.2 of the frame left of the hand. |
| The builder's near patches: dusk-fire 70.5 / 73.8, A 64 / 57, B 38 / 40, C 40 / 33, D 32 / 35. | **True** | On round 13's box: 70.5 / 73.8, 64.1 / 57.4, 38.3 / 39.7, 40.1 / 32.6, 32.3 / 34.9. |
| Max climb green (34.3°). | **True** | Over ±196 m at 4 m, the max slope is 34.2° and no cell is over 40°. Ground steeper than 15° is 20.6 % → 26.0 %, so the field's relief rose. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R15B-1 | D, C, and every late-dusk view | **must-fix** (ledger 5 "no narrowing"; should-fix by the round-10 and round-12 precedent, so no void) | **regression** (the third time; R10, R12) | late clip, whole frame; D y 0.48–0.60 | **The late land's darkening is camera-distance gated again.** `farLate` cuts diffuse light 70 % from 15 to 70 m around the camera, from dusk 0.55. The late clip's land is **4–6 against round 14's 29–30**, and **58–89 % of its land pixels are under Y 5**: the orbit is a black sheet with lit pads. D's band under the horizon overshoots (6–9 against 15–20). render.ts's own comment says "no distance gate: the lead after round 12". **Fix:** delete the `smoothstep(15, 70, sandFar)` term. Get D's dark under-horizon land from world-space terms: the late key's fall (`keyAt`), the facing cut, and the late fog and haze toward `DUSK_FOG`, which already darken with dusk (render.ts 165–184). **Accept** when the late clip's land is ≥ 20 with < 1 % under 5, and D's rows at y 0.50–0.58 are 13–20. Also re-check the widened `away` window in the clip: from 3.4° of tilt it is nearly global. |
| R15B-2 | dusk-fire, A | **should-fix** | **new** (662e6e99b: the key in front, the WIND flipped) | x 0.35–1, y 0.37–0.56 | **The far field beyond the mound reads as a pale beige-grey sheet, and the lit sand has lost its colour.** The far strip is 113 / 78 against 34 / 40. The right middle has sat 0.36 against 0.55, and the lit top 15 % is sat 0.34–0.40 against 0.67 (G/R 0.74–0.79 against 0.56). **Fix, in order, measuring the far strip after each:** (1) multiply the row-2 sheen by the key's facing toward the camera, so it lights only faces whose sun is behind or beside the viewer, not slip faces seen at grazing toward the key; (2) if the strip stays over 50, take the far rows' key-facing slip faces into the late haze (`uHazeCol` / FOG 0x40304a) as the mockups' dark violet rows. Then warm the key colour (1, 0.74, 0.52) toward the mockups' lit sand (177,100,59 in A) until the lit top 15 % is at sat ≥ 0.55. |
| R15B-3 | dusk-fire, A (D, C at the edges) | should-fix | **new** (the far half of R14B-3) | A x 0.1–0.6, y 0.37–0.56; dusk-fire x 0.15–0.6, y 0.42–0.50 | **The middle ripples are 2.3–3.1× the mockups' contrast** (12.1–18.1 % against 5.3–5.9 %; fine 4.4–5.8 against 3.1–3.8). Under a raking key, the windward faces turned to the camera carry them as dark worm lines. **Fix:** lower `sandNear`'s far value (0.7 past 26 m) toward 0.3, and keep the near 0.52 that now matches. Judge on these boxes: ripple ≈ 6 %, with the near patch's 8–11 % kept. |
| R15B-4 | A, dusk-fire | should-fix | **repeated** (R14B-1, half closed) | A x 0.3–1, y 0.38–0.54; dusk-fire x 0.35–1, y 0.46–0.56 | **The crest's line is right at its ends, but its light is not the mockup's.** The mockup has a narrow bright stripe (96–108) with shade under it (35–42), and the right under the crest in shade. The game has a broad lit face at 50–67 and the right lit at 75–83. **Fix:** (1) straighten the line: raise the crest's middle point (−17.1, 5.6, 18.5) by ~3 m, or ease the near-right end down less, so the edge at x 0.55–0.75 reads 0.395–0.416; (2) give the windward face a sharper upper third (a narrower `w`) so the lit band is ~0.04 of the frame tall; (3) add a shaded trough in front of it (the crest's `trough`, or a lower parallel swell) so x 0.1–0.4, y 0.40–0.48 reads ~40. **Accept** at A grid r ≥ +0.45 and the diagonal box ≥ 80, measured before the capture as round 15's overlay was. |
| R15B-5 | B | should-fix | **regression** (the new mound) | x 0.72–1, y 0.38–0.47 | **The dune behind the caravan is ~5 m too tall and lit.** The skyline is 0.383–0.406 against 0.418–0.439, and the glow 35.5 against 87.5. At 93 m, 0.04 of the frame is ~5.4 m. **Fix:** lower the mound (−118, −30) from 26 to about 20 m, or move it ~30 m farther back, until the right glow is ≥ 80 and the skyline is 0.42–0.44. Keep the land under it at 20–30. |
| R15B-6 | C | should-fix | **regression** (the crest moved off waymark 0) | x 0.75–1, y 0.43–0.53 | **The far waymark (wm0, 113 m) lost its rise:** a ground fire under the skyline, where the mockup has a brazier on a hump (0.430). wm0's ground is 25.2 → 12.5 m. **Fix:** give wm0 a local rise of ~4–6 m (0.03–0.04 of the frame at 113 m), with the flat pad and ≤ 25° approaches kept (the 41–44° face that dropped the old lift is the thing to avoid), so its brazier stands against the glow at y ≈ 0.465. That also lifts C's skyline 0.01–0.015 at the right, toward 0.455–0.469. |
| R15B-7 | all five, D first | should-fix | **repeated** (R14B-2, half closed) | x 0.25–1, y 0.55–0.86 | **The viewmodel: smaller and a closed loop, but still a finger-side upright fist with a free-hanging ring.** **Fix:** (1) turn `HD_GLOVE.rot` further, until the back of the hand and the thumb face the camera with the cuff leaving the right edge; (2) lower `pos.y` (now −0.13) so the fist's top is ≈ 0.68; (3) move `LOOP.c` from x −1.4 toward the fist and make the ring a teardrop (ry > rx, tilted) whose lower right enters the fist, at x 0.37–0.71, y 0.60–0.78 for dusk-fire, with D's slim pair beside it; (4) route the `tail` behind the glove, as claimed. The leather's fine is 2.8 against 8.3: keep the texture's creases and the stitching visible under `viewerLit`. |
| R15B-8 | dusk-fire, C | should-fix | **repeated** (rows 5, 6) | sky y 0.12–0.36; flame x 0.25–0.5, y 0.20–0.53 | The dusk-fire sky box is 100.6 against 75.9. C's fire has 316 against 2 722 pixels over 245, at 1.6× the area. Plan rows 5 and 6, unchanged this round. |
| R15B-9 | D | nit | **new** (the re-aim) | x 0.80–0.92, y 0.42–0.51 | The 30 m move made the tower 1.35–1.5× the mockup's height. Once R15B-1 and R15B-4 land, try a stand farther back on the same bearing (−22.5°) at ~25 m elevation, so the tower reads at ~0.042 of the frame. Not a breach (below). |
| R15B-10 | process | nit | **new** | README, 662e6e99b | (1) Give the shade-share's band and threshold so the seats can reproduce it; on a fixed threshold the mockup numbers don't come out. (2) The "late land past 15 m" line should have said it is distance from the camera: that was a closed should-fix twice. (3) "The fall behind the hand" doesn't hold on screen. |

## Ledger 5 (no shortcuts)

**Views: mock-D's 30 m move is real, reachable, and not chosen to hide anything.**
- I checked the r15 bake.
- **The old stand (38, 122):**
  - Its ground fell from 25.9 to 18.2 m.
  - The land ahead on the view's bearing rises to 23.1 m at 40 m, +4.9° over the eye. With pitch −2°, that face covers
    the lower frame up to about the horizon, which confirms the builder's reason.
- **The new stand (36, 92):**
  - Its ground is 24.27 m, a shoulder (15 m around it: 20.1–25.4 m), with slopes ≤ 26.3° within 8 m.
  - Straight walks to it from the spawn, the caravan and the old stand peak at 14.4°, 14.2° and 13.8°.
  - Its view ahead is clear, down to −6.2°.
- **The move:** it runs along the view direction (heading −22.5°). It keeps the tower at the mockup's x, and the
  under-horizon land it shows is the same field.
- **Its one cost** is the tower's scale (R15B-9). That is a likeness difference, not a dodge.
- **The other moves:** no other camera changed in cameras.json. The other real-camera moves are all vertical and equal
  the bake's ground change (B and h2 −1.11, C +0.41, h3 −12.74, h4 +0.07).

**h3:** waymark 0 now stands on 12.5 m ground with a 0.5° ring. Its approaches are 27.4° from the spawn and 12.7° from
wm2. The hero view is sensible.

**No screenshot cheats:**
- The crest and the B mound are baked terrain. The navmesh was re-baked.
- KEY, WIND, the sand shader and the viewmodel are global, and the viewmodel is one hold in all five views.

**Staged state:**
- `staged` is unchanged: `logbook`, and `waymarks-lit` ×2.
- a1aa357f7 (scout.ts) only moves Sefa's stand: she is now 5 m right and a little behind the spawn. Her quest pin and
  wave are unchanged, so she is reached as before. h3 and h4 point the quest at "SEFA 124 M" and "SEFA 145 M".
- 662e6e99b touches no stage handler. Its `farLate` acts by dusk, the same in play and in the stage.

**No narrowing: R15B-1.**
- The late clip's land went from 29–30 to 4–6, with 58–89 % of it near-black. The same change brings D's under-horizon
  land to its mockup's mean.
- The round-10 and round-12 precedent treats this as a should-fix, not a void, so I score D as captured and flag it at
  must-fix. Read strictly, ledger 5's "no narrowing" would void D's gain.

**Device and HUD:**
- 390×844 touch, stored 780 wide, with the baseline HUD in every frame. `pageErrors` is empty and `active` is empty.
- Device memory and frame times are not on this surface: unverified, not breached.

No score is voided.

SCORE signal-dunes: 6.7

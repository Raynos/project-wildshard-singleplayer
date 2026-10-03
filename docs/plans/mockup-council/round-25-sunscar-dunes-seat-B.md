# Round 25, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the E409 phases), the brief, `scores.md` with every lead ruling
  (the revised round-24 D ruling included), and the three round-24 Signal Dunes seat files.
- The "Signal Dunes, round 25" section of `art/mockup-council/round-25/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1458-a37cbc42/` (`mock-*`, h1-h4, first-frame, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), against round 23's `20261003-1325-8f296fb4/` (the same D stand) and round 24's
  `20261003-1406-7db2a5a2/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: the diffs of 302c174b7 and 92d11777d (`dusk.ts`, `render.ts`, `layout.ts`, `whipModel.ts`,
  `build.ts`, the sky `prep.py`), `dunes.ts`'s `WIND`, the early sky webp before and after, and
  `progress/physics/sd-r25-b-mussawzm.json`.

How I measured (round 24 seat B's tools and boxes; its r24 numbers reproduce to 0.2):
- **Brightness** is Rec. 709 luma. **s** is the mean (max - min) / max; **h** the HLS hue of the region's mean RGB.
- **Row-demeaned r:** Pearson r of a 10x7 grid of sigma-12 luma, each row's mean removed.
- **Grid dE:** mean CIELAB distance of 12x12 cell means over x 0.1-1 (the HOVER chip left out), mockup against game.
- **Quartiles:** the land band x 0.1-1, y 0.38-0.62, split by luma quartile (Q1 shade ... Q4 lit).
- **Edge trace:** per 0.1-wide column of y 0.38-0.60, the y of the strongest lit-above / shade-below step (sigma-4 luma).
- **The coil moved again.** Its dark mask in B (the cleanest backdrop) spans **x 0.340-0.779, top 0.638** (r24
  0.451-0.881, top 0.643). Near-ground boxes are now x ≤ 0.32; the left-side boxes are coil-free in every view.

## What changed

| View | r24 → r25 mean \|dY\| | > 8 | Land y 0.33-0.55 | Low y 0.55-0.86 | Land-band dE r23 / r24 / r25 |
|---|---|---|---|---|---|
| A | 7.0 | 28.5 % | 9.4 | 14.1 | 20.5 / 22.6 / **18.9** |
| dusk-fire | 6.6 | 27.8 % | 7.9 | 13.8 | 15.9 / 15.5 / 15.6 |
| B | 2.9 | 5.8 % | 2.5 | 6.2 | 13.4 / 13.5 / 13.6 |
| C | 3.4 | 8.5 % | 2.1 | 7.4 | 22.3 / 22.3 / 22.5 |
| D (against r23, the same stand) | 4.2 | 12.3 % | 6.2 | 7.9 | **16.4** / (moved) / 16.9 |

Skies: no view's sky moved by more than 1.3 (sky dE A 14.8, dusk-fire 26.5, B 11.5, C 11.0, D 10.1, all as round 24).

## Measurements (mockup / r23 / r24 / r25)

### The spawn pair

| Region | Mockup | r23 | r24 | r25 |
|---|---|---|---|---|
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.5** h20 s0.65 | 86.9 h24 s0.47 | 78.9 h18 s0.54 | **82.8 h24 s0.47** |
| **A trough x 0.2-0.6, y 0.47-0.53** | **42.9** h319 s0.26 | 95.2 | 92.4 h21 s0.52 | **71.4 h22 s0.45** |
| A below the line x 0.55-0.85, y 0.49-0.53 | 36.2 h306 s0.25 | 50.7 | 63.5 h13 s0.65 | 60.4 h20 s0.56 |
| A right slope x 0.78-1, y 0.44-0.54 | 48.4 h0 | 36.4 | 54.1 h9 s0.65 | 43.3 h14 s0.52 |
| A far strip x 0-0.4, y 0.375-0.40 | 70.0 | 90.0 | 89.8 | 92.1 |
| **A near sand x 0-0.32, y 0.62-0.70** | **67.9** | | 86.1 | **97.0** |
| A near sand x 0.013-0.40, y 0.60-0.64 | 73.5 | 74.1 | 89.6 | **100.5** |
| A near sand x 0.10-0.32, y 0.65-0.80 | 63.5 | 55.7 | 76.3 | **87.0** |
| A lit / shade share (Y > 80 / < 45) | 31 % / 49 % | 36 / 27 % | 36 / 16 % | 34 / 26 % |
| A row-demeaned r (0.38-0.58 / 0.36-0.56) | | +0.46 / +0.47 | +0.52 / +0.50 | +0.50 / +0.48 |
| A edge trace x 0.3 / 0.4 / 0.5 (step) | 0.413 / 0.432 / 0.447 (-19..-23) | | 0.395 / 0.502 / 0.502 | **0.470 / 0.460 / 0.445** (-24 / -18 / -11) |
| A edge step x 0.6-0.9 | -36 / -23 / -18 / -21 | | -4 / -5 / -5 / -7 | -5 / -6 / -6 / -6 |
| **dusk-fire near x 0-0.32, y 0.62-0.70** | **80.8** | | **80.8** | **91.5** |
| dusk-fire near x 0-0.32, y 0.60-0.80 | 76.4 h22 | 62.0 | 75.8 h16 | 86.5 h17 |
| **dusk-fire lit shoulder x 0-0.3, y 0.45-0.55** | **81.5** h22 s0.69 | | 86.7 h21 s0.47 | **72.1 h22 s0.42** |
| dusk-fire shoulder top x 0-0.35, y 0.50-0.555 | 85.4 h22 s0.71 | 87.8 | 88.3 | 82.4 h24 s0.49 |
| dusk-fire mid left x 0-0.45, y 0.40-0.50 | 62.5 | 82.9 | 77.4 | 70.9 |
| dusk-fire right x 0.6-1, y 0.40-0.50 | 55.0 h17 | 38.5 | 43.9 h0 | **37.9 h355** |
| dusk-fire lower right x 0.6-0.97, y 0.48-0.56 | 46.1 h10 s0.33 | 27.9 h300 | 41.0 h3 s0.57 | **27.8 h349 s0.43** |
| dusk-fire near right x 0.6-0.97, y 0.555-0.62 | 55.8 h15 s0.40 | 47.9 | 53.8 s0.74 | 56.8 h14 s0.65 |
| dusk-fire lit / shade share | 16 % / 27 % | 22 / 40 % | 21 / 25 % | 22 / 36 % |
| dusk-fire row-demeaned r | | +0.60 / +0.58 | +0.60 / +0.54 | +0.57 / +0.49 |
| dusk-fire edge trace x 0.1 / 0.2 (step) | 0.477 (-9) / 0.547 (-12) | | 0.396 / 0.382 | **0.472 (-23) / 0.460 (-17)** |

**Saturation by luma quartile** (land band):

| | Q1 (shade) | Q2 | Q3 | Q4 (lit) |
|---|---|---|---|---|
| A mockup | Y33 s0.27 h305 | Y40 s0.25 h315 | Y67 s0.53 h15 | Y108 s0.67 h21 |
| A r24 | Y42 s0.52 h3 | Y63 s0.63 h13 | Y79 s0.57 h17 | Y97 s0.50 h22 |
| A r25 | Y33 **s0.39 h350** | Y57 s0.52 h19 | Y78 s0.54 h20 | Y100 **s0.51** h23 |
| dusk-fire mockup | Y36 s0.24 h343 | Y51 s0.47 h14 | Y64 s0.64 h19 | Y86 s0.67 h22 |
| dusk-fire r24 | Y34 s0.45 h349 | Y55 s0.66 h10 | Y69 s0.62 h14 | Y87 s0.54 h20 |
| dusk-fire r25 | Y27 s0.39 h324 | Y47 s0.50 h14 | Y69 s0.56 h19 | Y91 **s0.54** h22 |

- **The inversion and the clipping are fixed.** Saturation now rises with light, and blue is no longer driven to zero.
  Share of y 0.36-0.86 with blue < 12 and red > 70, r24 → r25: A 2.26 → 0.45 %, dusk-fire 4.50 → 0.72 %, h2 12.45 →
  0.26 %, h3 15.82 → 4.97 % (r23 6.09; the fire), aerial-spawn 2.52 → 0.00 % (its vivid patch is gone).
- **The lit faces did not gain.** The rise is 0.12-0.15 (Q1 → Q4) against the mockups' 0.40-0.43. The lit quarter is
  s 0.51-0.54, the same as r23 (0.45-0.48) and r24 (0.50-0.54); y 0.36-0.56's lit quarter is s 0.47 / 0.49 against
  0.66 / 0.67. The 2.2 factor on faces turned to the key does not reach the frame.
- A's shade is still red-violet (Q1 h350 s0.39) where the mockup's is a grey violet (h305 s0.27).

### B, C, D

| Region | Mockup | r23 | r24 | r25 |
|---|---|---|---|---|
| B glow band left / right x 0-0.3 / 0.7-1, y 0.40-0.45 | 107.4 h11 / 102.3 h17 | 87.9 / 79.4 | 88.4 / 80.1 | 88.4 h358 / 79.3 h7 (unchanged) |
| B backdrop right x 0.7-1, y 0.44-0.48 | 17.2 | 37.3 | 36.3 | 33.3 |
| B near left x 0-0.32, y 0.60-0.80 / near right x 0.8-1, y 0.56-0.63 | 41.4 / 40.8 | 33.9 / 48.1 | 37.1 / 48.0 | 33.1 / 44.0 |
| B wagon-front pool (mock x 0.40-0.62, game x 0.55-0.75; y 0.495-0.515) | 60.3 h19 | 50.0 h12 | 49.2 h12 | **47.0 h14** |
| B plume peak x, y 0.20-0.28 / 0.28-0.36 | 0.513 / 0.529 | 0.713 / 0.742 | 0.522 / 0.554 | 0.518 / 0.501 |
| C pool x 0.15-0.60, y 0.585-0.62 | 71.5 h18 s0.76 | 60.8 | 83.5 h9 | **79.9 h12** |
| C ground right x 0.65-0.97, y 0.58-0.64 | 35.3 h12 | 62.8 | 62.3 h5 | **56.1 h7** |
| C ground left x 0-0.32, y 0.62-0.80 | 39.2 h13 | 39.5 | 43.4 | **36.6 h357** |
| C far land x 0.6-0.9, y 0.48-0.53 / horizon sky right x 0.75-1, y 0.42-0.46 | 16.1 / 81.9 h344 | 31.7 / 63.0 h310 | 32.6 / 63.2 | 29.8 / 61.6 h307 |
| C pixels over 230 / 245, y 0.25-0.55 | 5542 / 2713 | 4630 / 2372 | 4726 / 2300 | 4613 / 2094 |
| D land rows y 0.48-0.70, x 0.1-0.6, per 2 % | 162 66 15 17 18 17 13 15 54 52 46 (sd 41.9) | 57 32 36 29 36 38 40 40 39 39 40 (sd 6.7) | (moved) | 64 30 32 36 42 43 42 41 37 36 35 (sd 8.6) |
| D land y 0.50-0.64: p5 / p50 / below Y 8 / s | 9.8 / 12.8 / 1.2 % / 0.53 | 4.8 / 43.0 / 14.1 % / 0.46 | (moved) | 10.7 / **41.3** / 4.7 % / **0.35** |
| D glow peak (row mean x 0.1-0.6) | **168 at y 0.496** (215,159,121) | 134 at 0.466 (194,120,91) | (moved) | **156 at 0.466 (210,145,107)** |
| D skyline (first row under half the peak); rows y 0.47-0.51 per 1 % | 0.508; 154 160 163 113 21 | 0.488; 134 97 17 18 45 | (moved) | **0.488; 156 112 15 17 42** |

- **B:** the sky and band are untouched; the coil is the main change. The 5 cd lantern did not brighten the pool in the
  frame (49.2 → 47.0; its hue moved h12 → h14 toward h19).
- **C:** every ground patch moved toward the mockup (right 62.3 → 56.1, the pool 83.5 → 79.9 and h9 → h12); the coil
  stays clear of the plinth (the coil's top over x 0.34-0.45 is y 0.67-0.73, under the plinth's foot at 0.62).
- **D (the restored stand):** the glow line gained (134 → 156 against 168, its colour close), and the big left lasso is
  gone. The land is r23's rolling mounds, now greyer (s 0.46 → 0.35 against 0.53) with no bands (sd 8.6 against 41.9).
  The far ranges still stand into the glow: rows y 0.49-0.50 are 15-17 where the mockup's are 160-163.

### The hold (92d11777d `LOOP` step [-0.35, 0.2, 0.06], start 1.8)

| | Mockups | r24 | r25 |
|---|---|---|---|
| A / B / C | two loops apart, x 0.32-0.85, top 0.59-0.60 | one hoop with a doubled rim, x 0.45-0.88, top 0.643 | **two rings, visibly apart, x 0.34-0.78, top 0.638** |
| D / dusk-fire | one narrow coil x 0.57-0.81, top 0.62 / one slack loop x 0.38-0.75 | the same hoop | the same two rings |

A real gain for A, B and C: two separate rings in the right place on the left. It is still ~0.04 low and ~0.07 short on
the right. D's and dusk-fire's mockups hang one loop: a mockup conflict one hold can't meet, so I don't score it as a gap.

### The late clip (1 fps; ground y 0.55-0.90: p5 / median / below Y 8; far band y 0.40-0.50)

r24: 12-29 / 22-34 / 0-0.3 %, far 28-33. r25: 10-25 / 18-30 / 0-0.7 %, far 23-28. About 4 darker throughout (the late
fill a third lower), near and far alike. No black blots, and no fall by distance.

## Ledger-5 checks

- **Views:** `camAt` is identical to round 24 for every shot but mock-D, and mock-D is identical to round 23's
  ((37.99, 27.59, 121.99), dir (-0.37, -0.035, -0.929)). The revised D ruling is met. No breach.
- **Staging:** `staged` is unchanged in all three captures, `pageErrors` is empty, and no stage handler changed.
- **Camera distance:** none of the diffs adds a camera or distance term. The fire falloff (302c174b7) is distance from
  the fire. The late clip's ground and far band darken together.
- **The new crest** `[[-20, 39, 16.2], [-6, 34, 16.3], [8, 29, 19.7]]`, `leeSide: 1`: a 2.5 m crest 31-41 m ahead
  of the spawn, its slip face south toward the spawn. `WIND` is (-0.643, 0.766), blowing toward +z, so a south-facing
  slip face is the field's own direction. It is authored for A's frame, as E407 row 1's landforms are, and it is real
  terrain. Walk file: 7 legs, `stuck: []` on each, 0 air/slide/swim frames, `walkErrors: []`, dated 19:28Z, before the
  19:41Z commit. No breach.
- **The sky edit:** the early webp's change against the pre-round-24 sky has no plateau. It falls over about 240-360°
  and peaks at 2.4 levels mean, and its largest adjacent-column step is 1.37 (round 24's 1.76). Dusk-fire's upper sky
  is unchanged (45.3 → 45.2). R24B-7 is closed.
- **The dusk terms** (the README asks): `sunset(d)` eases out by dusk 0.4. It touches only the spawn's dusk, which every
  player starts at, not B's 0.50 (B's fill is 1.025 before and after). `lateFill` starts at 0.6. Neither is fitted to a
  staged dusk. But the fill is **no longer monotonic** (R25B-7).

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.0** | 1. **The sky (x 0-1, y 0.05-0.36). Repeated, untouched.** dE 26.5, the view's largest: band 96.6 h6 s0.61 against 76.1 h15 s0.41, upper 45.2 h261 s0.50 against 52.0 h234 s0.23 (navy over hot red, where the mockup is a dusty grey dusk). 2. **The land (x 0-1, y 0.40-0.56). Regression.** The new crest's slip face crosses the lit shoulder: x 0-0.3, y 0.45-0.55 is 72.1 against 81.5 (r24 86.7), with a strong new edge at y 0.46-0.47 where the mockup's shoulder runs lit to y 0.55. The right half fell back to r23: 37.9 against 55.0, lower right 27.8 h349 against 46.1 h10. The red is gone, but the land reads grey-lilac, lit s 0.54 against 0.67. r +0.54 → +0.49. 3. **The near sand and the hold (x 0-1, y 0.56-0.86). Regression.** The near ground matched in r24 (80.8 / 80.8) and is now 91.5. Two rings where the mockup hangs one slack loop in a dark leather glove. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **7.0** | 1. **The trough and the diagonal (x 0.1-0.9, y 0.40-0.53). Partly fixed.** A violet slip-face band now lies under the lit crest at x 0.1-0.5: the trough 92.4 → 71.4 against 42.9, the land dE 22.6 → 18.9 (the best yet). But its edge rises to the right (0.470 → 0.445 over x 0.3-0.5) where the mockup's falls (0.413 → 0.447). Right of x 0.6 there is no lit/shade line (steps -5 to -6 against -18 to -36). The diagonal is 82.8 h24 s0.47 against 96.5 h20 s0.65. 2. **The near sand (x 0-0.32, y 0.60-0.80). Regression.** 97.0 against 67.9 (r24 86.1); 87.0 against 63.5 lower down. The frame's brightest land is now the floor at the player's feet. 3. **The colour (the whole band).** No more red or clipped blue (gain). Lit s 0.51 against 0.67, shade h350 s0.39 against h305 s0.27: beige and red-violet where the mockup is amber and grey-violet. The far strip is 92.1 against 70.0. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.3** | 1. **The low glow band (x 0-1, y 0.39-0.45). Repeated, unchanged.** 88.4 h358 / 79.3 h7 against 107.4 h11 / 102.3 h17, with the pink streaks above (y 0.33-0.39 h343 against h302). 2. **The wagon and its light (x 0.3-1, y 0.44-0.56). Repeated.** The pool is 47.0 h14 against 60.3 h19 (r24 49.2: the 5 cd lantern didn't show), the backdrop right 33.3 against 17.2, and the canvas and cargo are blockier. 3. **The hold (x 0.34-0.78, y 0.638-0.86). Improved.** Now two separate rings, as the mockup draws them, but ~0.04 low and ~0.07 short on the right (the mockup's 0.32-0.85, top 0.59). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.5** | 1. **The firelit ground (x 0-1, y 0.58-0.80). Repeated, closer.** The pool is 79.9 h12 against 71.5 h18 (r24 83.5 h9); the ground right 56.1 against 35.3 (62.3); the ground left 36.6 h357 against 39.2 h13 (red-mauve where the mockup's is orange-brown). 2. **The far land and the low sky (x 0.55-1, y 0.40-0.55). Repeated.** The far land is 29.8 against 16.1; the low sky right of the dune is magenta-violet h307 at 61.6 against a pink h344 at 81.9. 3. **The fire and the hold (x 0.3-0.9, y 0.25-0.86).** The core holds (4613 pixels over 230 against 5542). The smoke is an upright column where the mockup's billows up-left. The coil is two rings clear of the plinth, as the mockup hangs them. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.9** | 1. **The land (x 0-1, y 0.48-0.70). Repeated (R24B-1 / R23B-4), unchanged.** Rolling grey-mauve mounds: p50 41.3 against 12.8, row sd 8.6 against 41.9, s 0.35 against 0.53. The mockup has long dark troughs (13-18) between lit rims (46-54). 2. **The skyline and the glow (x 0-1, y 0.46-0.51). Improved.** The glow is 156 (210,145,107) against 168 (215,159,121); r23's was 134. But the far ranges rise to y 0.488 against the mockup's 0.508, so rows 0.49-0.50 are 15-17 where the mockup's are 160-163. 3. **The hold and the fire (x 0.3-0.8, y 0.50-0.86).** The left lasso is gone, but two big rings stand where the mockup hangs one narrow coil at x 0.57-0.81. The lit waymark is at x 0.28 with a tall smoke column, where the mockup's is a small fire at x 0.06 on a near band. |

**Seat score, Signal Dunes: 7.1** ((7.0 + 7.0 + 7.3 + 7.5 + 6.9) / 5 = **7.14**).
- My earlier scores: ... 7.0, 7.0 (r23 6.96), 7.1 (r24 7.08 with D carried from r23).
- Gains: A's trough has a shade band at last, the clipping and the inversion are gone, the coil is two rings, C's ground
  is closer, and D's glow line is brighter.
- Costs: the near sand in both spawn views (+11), and dusk-fire's lit shoulder and right half.
- Unchanged: every sky, D's land, and the lit saturation.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| A's trough 92.4 → 71.1 (42.7); diagonal 82.8 (96.7) | **True** | 71.4 and 82.8 on the same boxes. |
| Dusk-fire's left 72.5 (71.5), r +0.49 | **r true, the box unnamed** | r +0.49 on y 0.36-0.56 (+0.57 on 0.38-0.58). On the lit shoulder (x 0-0.3, y 0.45-0.55) it is 72.1 against **81.5**, down from 86.7: the crest shaded it. |
| Red pixels A 0.9 %, dusk-fire 1.4 %; blue < 6 0 % | **True in direction** | Mine (h < 8 or > 345, s > 0.55): A 5.7 → 0.5 %, dusk-fire 7.3 → 0.6 %; blue < 6 in the band 0.00 % in both. |
| Shade hue A h342 / dusk-fire h326, shade s 0.34 | **Hue about right, s understated** | Q1: A h350 s0.39 (mockup h305 s0.27), dusk-fire h324 s0.39 (h343 s0.24). |
| "Saturation on the lit term only"; lit s 0.47 (0.67) | **The 0.47 is true; the lit term didn't gain** | The lit quarter is s 0.47-0.54, as r23 and r24. The fix removed the inversion; it didn't saturate the lit faces. |
| The lantern 3 → 5 cd: pool h11 55.6 (65.9) | **Not reproduced** | On round 24's wagon-front box, 49.2 → 47.0 (h12 → h14; mockup 60.3 h19). The steeper facing term ate the extra light. |
| C's ground right 44.1 (33.8), left 50.1 (50.2) | **True** | x 0.6-0.95, y 0.60-0.70: 43.2 / 33.4; x 0.05-0.35, y 0.60-0.70: 49.8 / 50.3. |
| The coil: two separate rings across x ~0.33-0.80 | **True** | 0.340-0.779, top 0.638; the two rings visibly apart. |
| B's sky weight smooth, half at ±30° | **True** | The webp diff has no plateau; the largest column step is 1.37. |
| Terrain: a 2.5 m crest; walk 0 stuck | **True** | `layout.ts` as stated; the walk file as above. |
| "A's near sand 99 (68)" (open) | **True** | 97.0 against 67.9 (x 0-0.32, y 0.62-0.70). |
| "Dusk-fire's same ground matches its mockup (82 / 80)" | **False in the capture** | The same box is 80.8 against 80.8 in r24 and **91.5** in r25. This batch broke it. |
| 302c174b7: D's land median 33.6 → 30.6, under Y 8 3.1 % | **Not at the scored stand** | That was measured at round 24's voided stand. At (38, 122): p50 41.3 (r23 43.0), under Y 8 4.7 % (r23 14.1 %). |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R25B-1 | D | should-fix | **repeated** (R24B-1, R23B-4), untouched | D x 0-1, y 0.46-0.70 | **D's land has no bands, and the far ranges cut the glow.** p50 41.3 against 12.8, row sd 8.6 against 41.9, s 0.35 against 0.53. Rows y 0.49-0.50 are 15-17 against 160-163 (skyline 0.488 against 0.508). **Fix:** build the bands in the terrain from the restored stand. The mockup shows ~4 transverse troughs, so use 3-4 low transverse crests 60-250 m out along D's view, inside the field's own wind: `WIND` already puts slip faces toward this camera. Make each lee wide enough to stay under the walk cap, which avoids the builder's 41-54° faces. Darken the troughs by facing (the late lee term), never by distance. Where the ranges rise into the glow, lower their silhouette, eased over ≥ ±60° of heading, and check that A's and dusk-fire's tower-foot ranges hold. **Accept:** land p50 ≤ 25 with row sd ≥ 15; rows y 0.49-0.50 ≥ 100; below Y 8 ≤ 3 %. |
| R25B-2 | A, dusk-fire (h1, first-frame) | should-fix | **regression** (92d11777d) | x 0-0.32, y 0.60-0.80 | **The near sand rose 11 in both spawn views.** A is 97.0 against 67.9 (r24 86.1). Dusk-fire is 91.5 against 80.8, where r24 matched exactly. The new direct term `0.27 * pow(tN / 0.35, 1.6) / tN` is ~40 % lower on flat sand but *higher* on faces past tN 0.35, and the sunset key adds 35 % on top. The spawn's near slope falls away north, toward the key, so it took the boost meant for the crest faces. **Fix:** measure tN on the near slope and on A's diagonal flank from the heightfield, and put the term's knee between them, so the gain rises only on faces turned harder than the near slope. Re-fit the 0.27 so the diagonal still gains. **Accept:** A near ≤ 78 and dusk-fire near 76-86 on this box, with A's diagonal ≥ 85. |
| R25B-3 | dusk-fire | should-fix | **regression** (92d11777d) | x 0-0.3, y 0.45-0.56; x 0.6-1, y 0.40-0.56 | **The new crest shades dusk-fire's lit shoulder, and the right half fell back.** The shoulder is 72.1 against 81.5 (r24 86.7), with a strong edge at y 0.46-0.47 (steps -23 / -17) where the mockup's shoulder runs lit to y 0.55. The right half is 37.9 against 55.0 and the lower right 27.8 h349 against 46.1 h10; r24 had 43.9 / 41.0. **Fix:** shorten or lower the crest's west end until it leaves dusk-fire's frame left of x 0.3 (its yaw -8 sees the west end; A's trough needs x 0.2-0.6 of A's frame). Bring the right half's shade back up as a warm grey-brown through the shade fill's hue (see R25B-5), not red. **Accept:** the shoulder ≥ 78; the lower right ≥ 40 at h 5-15, s ≤ 0.45; r ≥ +0.55. |
| R25B-4 | A | should-fix | **changed** (R24B-3, partly fixed) | A x 0.1-0.9, y 0.40-0.53 | **A's shade band is in, but it tilts the wrong way and stops at mid-frame.** The trough is 71.4 against 42.9, and the shade share 26 % against 49 %. The edge rises left to right (0.470 / 0.460 / 0.445 at x 0.3 / 0.4 / 0.5); the mockup's falls (0.413 / 0.432 / 0.447). That is the crest's east end (8, 29, 19.7) standing 3.4 m over its west end and farther out. Right of x 0.6 there is no lit/shade line (steps -5 to -6 against -18 to -36). **Fix:** drop the east end and bring it nearer, so the crest falls to the right under the diagonal and carries its slip-face shade under x 0.6-0.9, y 0.48-0.52. Keep its west end off dusk-fire (R25B-3). **Accept:** the trough ≤ 55; the edge trace falling over x 0.3-0.9; the shade share ≥ 40 %; dusk-fire's r held. |
| R25B-5 | A, dusk-fire | should-fix | **changed** (R24B-2: the clipping and inversion fixed) | the land band, y 0.38-0.62 | **The lit faces are still beige, and A's shade red-violet.** The lit quarter is s 0.51-0.54 against 0.67, unchanged over three rounds. Shade Q1 is A h350 s0.39 against h305 s0.27. The 2.2 mix on faces turned to the key is lost in the grey fill and the tone mapper. **Fix:** saturate the key's own colour (now (1, 0.68, 0.34)) instead of extrapolating about the luma, or lift chroma for sand hues h15-25 in the LUT's highlight range. Turn the shade fill (0.9, 0.9, 1.28) further toward the mockup's grey violet, lower in chroma. **Accept:** Q4 s ≥ 0.60 at h18-24; Q1 s ≤ 0.32 at h290-330; blue < 12 under 0.5 % in every view and hero. |
| R25B-6 | dusk-fire | should-fix | **repeated**, untouched since round 19 | y 0.05-0.36 | **Dusk-fire's sky** is the view's largest gap (dE 26.5): the band is 96.6 h6 s0.61 against 76.1 h15 s0.41, and the upper sky s 0.50 against 0.23. **Fix:** in the early painting, desaturate the upper sky toward grey-violet and cool and dim the red band, eased over ≥ ±60° of heading, as round 25's B edit is. |
| R25B-7 | all (dusk) | should-fix | **new** (92d11777d) | `dusk.ts` `fillAt` | **The fill runs backwards through the sunset.** `fillAt` is 0.70 at dusk 0, 0.86 at 0.2, 1.02 at 0.4, 1.03 at 0.6 and 0.68 at 0.9. The shade brightens ~47 % while the sun sets, with the peak spanning B's 0.50. It isn't fitted to B (B's value is unchanged), so it is no breach, but it breaks round 11's rule that the fill be monotonic and declared. **Fix:** give the sunset contrast to the key alone, or hold the fill at its sunset value until it falls. **Accept:** `fillAt` non-increasing on [0, 1]. |
| R25B-8 | C, B | should-fix | **repeated** (R24B-5), closer | C y 0.58-0.80; B y 0.39-0.56 | **C's open ground and B's band and pool.** C: ground right 56.1 against 35.3, the pool 79.9 h12 against 71.5 h18, the low sky right h307 against h344. B: the band 88.4 / 79.3 against 107.4 / 102.3, the pool 47.0 h14 against 60.3 h19. **Fix:** C as R24B-5 (the waymark light amber h15-20; the open ground on the late fill alone). For B's pool, raise the lantern's own gain past the facing term (it reaches flat sand at ×0.55), not the key. **Accept:** C's ground right ≤ 45; B's pool ≥ 55 at h15-20. |
| R25B-9 | process | should-fix | **repeated** (R24B-8) | README, 92d11777d, 302c174b7 | **Claims not re-measured on the capture.** Dusk-fire's near ground "matches (82 / 80)" is 91.5 / 80.8 in the capture. D's "median 30.6, under Y 8 3.1 %" was measured at the voided stand (at the scored stand: 41.3, 4.7 %). B's pool "55.6" doesn't reproduce on round 24's box (47.0). The README also names no metric the batch moved away (both near sands, dusk-fire's shoulder and right half). **Fix:** quote every number from the captured frame, on a named box, and list every regression. |

SCORE signal-dunes: 7.1

# Round 11, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- The "Signal Dunes, round 11" section of `art/mockup-council/round-11/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0511-ea6ccc86/`: every `mock-*`, h1–h4, both aerials, `clip.mp4`
  (1 fps) and `meta.json`.
- Round 10's capture, `20261003-0432-0ae71b2a/`, for before and after.
- The five ledger mockups, Lanczos-scaled to 780×1688.

Source checks (read-only `git show` / `git grep` at ea6ccc86):
- `look/render.ts`, `look/dusk.ts`, `world/fireFx.ts`, `world/places.ts` and `manifest.ts`.
- The camAt diff between the two `meta.json` files.

How I measured:
- **Brightness** is Rec. 709 luma on the decoded JPEGs.
- **Fine detail** is the mean of |luma − luma blurred at σ 2 px|.
- **Macro structure** compares luma blurred at σ 12 px, mockup against game, over a named band: the Pearson r, plus the
  mean |diff|.
- **Regions** are fractions of the frame (x left → right, y top → bottom), or pixel boxes on the 780-px frame.

## Is measure.py's patch still clean?

**Yes.**
- **The coil:** on scanlines y 1100–1420, the coil's first dark run starts at x 209–242 in all five r11 views. Shallow
  ripple troughs are the only dark runs left of that.
- **The HUD:** its bar line is at y ≈ 1425–1435, under the patch.
- **Sefa:** her feet end at y ≈ 1100 in dusk-fire and ≈ 1090 in A, above the patch.

So the patch, x 10–190 and y 1160–1420, takes in only sand in all 15 frames (mockup, r10, r11). measure.py reproduces
the README's numbers to 0.1: 74.6 / 78.1 / 35.2 / 34.0 / 33.6. I used the same patch.

## Measurements (mockup / r10 / r11)

**Near sand** (clean patch):

| View | Mean | p5–p95 | Fine | RGB (r11) |
|---|---|---|---|---|
| dusk-fire | 73.8 / 82.5 / **74.6** | 45–111 / 45–111 / **39–101** | 9.5 / 10.3 / **9.7** | 113,66,38 → **109,68,43** |
| A spawn | 57.4 / 86.1 / **78.1** | 33–94 / 47–115 / **41–105** | 9.4 / 11.3 / **10.7** | 88,51,36 → **112,71,47** |
| B logbook | 39.7 / 31.8 / **35.2** | 31–50 / 16–46 / **19–49** | 2.0 / 3.2 / **2.7** | 62,34,27 → **60,29,24** |
| C waymark | 32.6 / 36.9 / **34.0** | 26–37 / 24–48 / **24–43** | 0.1 / 1.4 / **1.3** | 53,28,22 → **58,28,24** |
| D hands | 34.9 / 34.3 / **33.6** | 23–48 / 25–44 / **26–42** | 0.2 / 1.6 / **1.4** | 52,31,27 → **54,28,26** |

**Whole frame**, rows 120–1400, blurred at σ 12 (r and mean |ΔL|, r10 → r11):

| View | r10 | r11 |
|---|---|---|
| dusk-fire | +0.64 / 19.7 | **+0.62 / 15.1** |
| A | +0.64 / 21.8 | **+0.63 / 17.9** |
| B | +0.73 / 9.7 | **+0.74 / 9.6** |
| C | +0.61 / 14.3 | **+0.62 / 13.4** |
| D | +0.84 / 9.9 | **+0.78 / 11.1** |

**The spawn skies**:

| Measure | dusk-fire: mock / r10 / r11 | A: mock / r10 / r11 |
|---|---|---|
| Sky box (40,300)–(540,600) | 75.9 / 112.8 / **93.4** | 88.3 / 107.7 / **87.5** |
| Pixels over 140, y 0.12–0.34 | 3.2 k / 42.4 k / **2.0 k** | 19.3 k / 33.5 k / **1.8 k** |
| The glow by fifths, y 0.31–0.34 | 130 87 99 115 122 / 133 144 157 157 145 / **104 117 131 131 120** | 103 118 114 148 162 / 118 132 144 155 157 / **85 103 118 129 131** |
| Brightest row mean, y 0.28–0.40 | 124 @0.331 / 174 @0.344 / **124 @0.339** | 137 @0.329 / 168 @0.344 / **116 @0.338** |
| Clouds, left half: cover / colour | 5.5 % / 16.5 % / **4.9 %** | 1.1 % / 19.6 % / **6.4 % at (104,72,80)** |
| Clouds, right half: cover / colour | 7.6 % (131,113,102) / 6.1 % / **7.0 % (133,101,96)** | 23.6 % at (214,117,64) / 9.2 % / **8.6 % at (161,112,90)** |
| Land under the horizon | y 0.365–0.39: 35–40 / 60–67 / **47–62** | far ranges, y 0.345–0.375, by fifths: 69 66 39 59 64 / 99 93 92 116 131 / **67 67 71 86 95** |

The cloud cover is the residual over the row median, more than 12, in y 0.13–0.33.

**The low-sky colour, y 0.30–0.335:**
- Saturation runs 0.69–0.78 in r11, against the mockups' 0.58–0.76. A's mockup rises from a rose 0.58 at the left to
  0.76 at the right. The game is about 0.75 everywhere, so its left is rust where the mockup's is rose.
- **New: a gamut-clipped red band.** In y 0.15–0.45, pixels with blue under 10:

  | View | r10 | r11, at mean (120,33,1) | Where |
  |---|---|---|---|
  | h4 | 0.01 % | **4.0 %** | x 0–0.55 |
  | h2 | 1.4 % | **5.7 %** | |
  | mock-A | 0.07 % | **0.24 %** | x 0–0.15 |

  In h4 it reads as a hard dark-red stripe with a dithered top edge over the ranges. Neither mockup has one.

**The landform**, a grid of cells 0.1 wide and 0.02 tall; macro over the band:
- **A**, band x 0–1, y 0.34–0.58: r +0.20 → **+0.25**, |diff| 33.7 → **25.5**.
  - The mockup's lit diagonal runs from x 0.2–0.3 at y 0.38 down to x 0.8–0.9 at y 0.48 (83–107). Shade sits left of it
    (28–47) and above the near crest at x 0.5–1, y 0.48–0.54 (33–40).
  - r11, left, x 0–0.4 at y 0.38–0.42: still lit, **80–109**.
  - r11, under the mockup's diagonal, x 0.5–0.8 at y 0.38–0.42: **33–74**, shade to mid-tone.
  - r11, x 0.5–1 at y 0.48–0.54: **49–79**, where the mockup has its shade band.
  - The new crest makes a uniform mid-tone shelf at y 0.44–0.48 (60–68).
- **dusk-fire**, band x 0–1, y 0.36–0.58: r +0.36 → **+0.41**, |diff| 18.2 → **13.2**.
  - The lit left shoulder holds (52–88 against 50–92).
  - The lower right, x 0.5–1 at y 0.50–0.58: **45–76** against 41–48. It is in shade at y 0.50–0.52 but lit below that.

**B**:
- **The lantern** (the brightest pixel, with the HUD labels excluded):

  | | Position | Max | Pixels over 200 within 60 px | Ring 6–20 px | Ring 20–45 px |
  |---|---|---|---|---|---|
  | Mockup | x 0.522, y 0.417 | 252 | 201 | 56 | 52 |
  | r10 | | | 120 | 127 | 103 |
  | r11 | **x 0.555, y 0.448** | **229** | **73** | **67** | **30** |

- **The wagon box:**

  | | Box | Luma | Fine | RGB |
  |---|---|---|---|---|
  | Mockup | x 0.43–0.67, y 0.40–0.50 | 54 | 12.0 | 85,47,33 |
  | r11 | x 0.48–0.73, y 0.43–0.53 | **38** | **5.2** | **65,32,23** |

- **The cargo:** 45 against 44, fine detail 1.3 against 3.5.
- **The horizon glow** at x 0.72–0.9:

  | | Peak | At y | Rows over 100 |
  |---|---|---|---|
  | Mockup | 163 | 0.436 | 64 |
  | r10 | 110 | | 9 |
  | r11 | **101** | 0.453 | **4** |

  At x 0.75–0.95 the mockup's land starts at y 0.44, the game's at 0.46.
- **The camp band**, x 0–1, y 0.40–0.60: macro r +0.58 → **+0.63**.
- **The smoke plume** (a per-row peak over the row median, y 0.20–0.40):
  - The mockup's is +13 to +22, centred at x 0.51–0.53 over the wagon.
  - r11's is **+5 to +10, at x 0.65–0.74**, rising from behind the wagon's right side. r10's was +17 to +28.

**C**:
- **The flame**, box x 150–450, y 520–900:

  | | Pixels over 150 | Their mean | Over 230 | Over 245 | Widest row | Height (rows) | Edge |
  |---|---|---|---|---|---|---|---|
  | Mockup | 12 909 | 213 | 5 212 | 2 483 | 121 | 188 | 14.0 |
  | r10 | 15 630 | 188 | 1 689 | 0 | 133 | 198 | 5.1 |
  | r11 | **10 646** | **201** | **3 006** | **539** | **91** | **175** | **9.9** |

- **The pool** (x 150–450, y 1060–1150): 40 / 51 / **48**.
- **The embers**, warm specks left / right of x 300: 618 / 512 / 282 / 617 / **277 / 881**.
- **The far land**, x 0.60–0.90, y 0.48–0.53: 16–17 / 6–23 / **32–34**.
- **The horizon line** at y 0.47: **118**. The mockup's sky is 87–95 there.
- **The backdrop**, macro r:
  - left, x 0–0.25, y 0.30–0.50: 0.40 → **0.60**;
  - right, x 0.5–1, y 0.44–0.60: 0.58 → **0.45**.
- **The plinth** is unchanged from r10: a pale brick block. HEAD's 615ae4664 rebuilt it after this capture, so it is not
  scored.

**D**:
- **The afterglow**, column x 300–500:

  | | Peak | At y | Rows over 100 | Rows over 140 | Hue |
  |---|---|---|---|---|---|
  | Mockup | 170 | 0.497 | 121 | 58 | 214,161,129 |
  | r10 | 195 | | 79 | 33 | |
  | r11 | **173** | 0.482 | **76** | **50** | **239,159,111** |

- **The land**, y 0.52–0.62, mockup / r10 / r11:
  - right half: 13–22 / 11–17 / **23–33**;
  - left half: 16–19 / 37–42 / **35–42**.
- **The mockup's lit near band** at y 0.64–0.68 (54–60) is absent: the game is flat at 39–40.
- **The land's macro r**, x 0–0.4, y 0.50–0.66: −0.13 → **−0.52**.
- **The glove**, back of the hand:

  | | Box | Mean | p95 | p99 | Fine | RGB | Saturation |
  |---|---|---|---|---|---|---|---|
  | Mockup | (600,1100)–(720,1200) | 34 | 85 | 117 | 9.1 | 51,30,25 | 0.51 |
  | r10 | (540,1190)–(700,1280) | 29 | 51 | 70 | 3.7 | | 0.64 |
  | r11 | (540,1140)–(700,1230) | **24** | **42** | **59** | **3.0** | **41,19,15** | **0.63** |

- **The fist** rose about 45 px (its top from y ≈ 1170 to ≈ 1125). Its fingers still run about 30 px under DODGE, where
  the mockup's fist ends about 30 px above the buttons.

**The late clip** (luma of the ground, y 0.55–0.90, per second): r10 4–6; **r11 25–29**. The dunes read again.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.4** | 1. **The sky (x 0–1, y 0.10–0.36).** Mostly fixed. The hot line is gone (the brightest row is 124 at y 0.339, against 124 at 0.331), and so are the over-140 pixels (2.0 k against 3.2 k; r10 42.4 k). The left half's cloud cover is 4.9 % against 5.5 %, and the right bank is grey-brown (133,101,96 against 131,113,102). It is still 17 over in the box (93 against 76). The low band is a uniform 104–131 where the mockup dips to 87 at x 0.2–0.4, and it is more saturated (0.70–0.78 against 0.61). 2. **The landform (y 0.36–0.58).** The best yet: r +0.41, \|diff\| 13.2. The shoulder is lit; the lower right is still lit below y 0.52 (52–76 against 41–48). The land under the horizon is 47–62 against 35–40. 3. **The figures and the hand.** No Roc over the tower, which the mockup frames. Sefa stands at the left edge. The coil is two upright rings where the mockup has one loose loop. The near sand matches (74.6 against 73.8, fine 9.7 against 9.5). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **The landform (x 0–1, y 0.36–0.58).** Repeated since round 1. The left is lit (80–109) where the mockup is in lee shade (28–47). The mockup's lit diagonal (x 0.3–0.9, falling from y 0.38 to 0.48) is shade or mid-tone in the game. The new crest gives a flat 60–68 shelf, and its slip face sits at the right. Macro r is only +0.25. 2. **The near field (y 0.56–0.86).** It is still 21 over: 78.1 against 57.4 (r10 86.1), RGB 112,71,47 against 88,51,36. 3. **The sky (y 0.10–0.35).** It swung under. The mockup's bright red-orange banks fill 23.6 % of the right half at (214,117,64); the game's fill 8.6 % at a dull (161,112,90). Pixels over 140: 1.8 k against 19.3 k. The right fifth of the glow is 131 against 162. There is a mauve bank at the left (6.4 % against 1.1 %), a rust patch on the left horizon, and the far ranges at the right are 86–95 against 59–64. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.4** | 1. **The caravan (x 0.40–0.75, y 0.38–0.55).** A real gain. The wagon now shows its open arch with the lantern hanging inside, as in the mockup. The halo is in check (rings 67 / 30 against 56 / 52), and camp-band r is +0.63. But the wagon is dark and plain (38 against 54, fine 5.2 against 12.0), its lower body red (65,32,23) where the mockup's is weathered brown. It sits right of and below the mockup's (lantern 0.555, 0.448 against 0.522, 0.417). The cargo has no planks (fine 1.3 against 3.5). 2. **The horizon glow (y 0.40–0.47).** Still the largest light gap: peak 101 against 163, with 4 rows over 100 against 64. The mockup's broad orange band is a thin line here, and the ranges sit 0.02 lower. 3. **The smoke and the sand.** The plume is faint (+5 to +10 against +13 to +22) and rises at x 0.65–0.74, beside the wagon rather than over it. The sand is closer (35.2 against 39.7) but still bands (spread 30 against 19). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.1** | 1. **The fire (x 0.22–0.55, y 0.30–0.52).** It gained. Pixels over 230 are 3 006 against 5 212 (r10 1 689), there is a first true white (539 over 245 against 2 483; r10 0), and the bright mean is 201 against 213. But it is now narrower than the bowl (91 against 121), still smooth translucent licks (edge 9.9 against 14.0), and no logs show. 2. **The smoke and embers (x 0–0.5, y 0.05–0.45).** The mockup's grey-brown billow up-left is still missing. The embers drift right (277 / 881 against 618 / 512). 3. **The far land and horizon (x 0.55–1, y 0.44–0.60).** A regression from the far-land change: the land is 32–34 against 16–17 (r10 6–23), and a 118 line sits on the horizon against the mockup's 87–95 sky. The right backdrop's r fell from 0.58 to 0.45. The left backdrop improved (0.40 → 0.60), and the sand is closer (34.0 against 32.6). The plinth is still a pale brick block (HEAD changed it after the capture). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.5** | 1. **The land (y 0.50–0.70).** A regression. The far-land change lifted the right half from a matched 11–17 to 23–33 (mockup 13–22). The left stays 35–42 against 16–19. The mockup's flat near-black bands and its lit near band at y 0.64–0.68 (54–60) read as one flat mid-brown slope. Land macro r is −0.52 (r10 −0.13), and whole-frame r fell from 0.84 to 0.78. 2. **The afterglow (y 0.44–0.50).** The peak is fixed (173 against 170; r10 195), but it is still a band half the mockup's depth (76 rows over 100 against 121), a saturated orange (239,159,111 against a peach 214,161,129), and starts 0.015 high. 3. **The hero hand (x 0.55–1, y 0.62–0.86).** The darker gauntlet moved away from the mockup: p95 42 against 85 (r10 51), fine 3.0 against 9.1, and still as saturated (0.63 against 0.51). The fist is 45 px higher, but its fingers still run under DODGE. |

**Seat score, Signal Dunes: (7.4 + 6.3 + 7.4 + 7.1 + 6.5) / 5 = 6.9.**
- This seat's earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8.
- The spawn pair and B gained. The late far-land change cost C and D what round 10 had won.

## The builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Near sand: dusk-fire 74.6 / 73.8, A 78.2 / 57.4, B 35.2 / 39.7, C 34.0 / 32.3, D 33.6 / 34.5 | **True** (clean patch, reproduced) | 74.6 / 78.1 / 35.2 / 34.0 / 33.6. The patch is clear of the coil (x ≥ 209), Sefa and the HUD. A is still +20.7 over. |
| The glow line only late in the dusk | **True early; overshoots late in C** | A and dusk-fire have no line (row peak 116 / 124). D's peak is 173 against 170. C has a 118 line at y 0.47 against the mockup's 87–95. |
| The far-land fill only from 30 m (`smoothstep(30, 200, sandFar) × … × 0.6`, sky fill only) | **True; it fixes the clip and costs C and D** | Source at ea6ccc86 `render.ts:337`. The late clip's ground goes from 4–6 to 25–29. C's far land is 32–34 against 16–17 (r10 6–23), and D's right half 23–33 against 13–22 (r10 11–17). |
| The lantern halo depth-tested, 0.5 m | **True** | `glowMaterial` sets no `depthTest: false`, so its clone tests depth. `places.ts:140` calls `addLampGlow(lamp, 0.5, …)`. Rings 67 / 30 against r10's 127 / 103. (The keeper lamp's halo is still 2.6 m, now depth-tested.) |
| The clouds as filaments; the ranges darker | **Form true; A's colour and cover wrong** | dusk-fire's left cover is 4.9 % against 5.5 %. A's right is 8.6 % at (161,112,90) against 23.6 % at (214,117,64): the lit edges are not "a more saturated red-orange" in A. A's far ranges are 67–95 against 99–131 in r10 (darker; the mockup's are 39–69). |
| The fire's side tongues, over 230: 828 → 2 403 (mockup 5 495) | **Direction true; the numbers are from another box or SHA** | My box (x 150–450, y 520–900) gives 1 689 → 3 006 against 5 212, so 58 % of the mockup by my count. The widest row narrowed, 133 → 91 against 121. |
| The cookfire's wisp curls | **True, but faint and off-centre** | A curl is visible. Its peak is +5 to +10 over the sky (r10 +17 to +28, mockup +13 to +22), at x 0.65–0.74 against the mockup's 0.51–0.53. |
| The plait's sheen; the gauntlet darker and less saturated | **Darker: true. Less saturated: no** | The glove's p95 is 51 → 42 against 85, and its saturation 0.64 → 0.63 against 0.51. The arc's p99 is 64 → 67. |
| The hold at y −0.245 | **True** | The fist is about 45 px higher. Its fingers still run under DODGE. |
| B's sand at dusk 0.5 (31.8 → 35.2) | **Number true; the method is a bump at B's own dusk value** | `dusk.ts`: `fillAt = 1 + 0.05d + 0.7·exp(−((d − 0.5)/0.12)²)`. The fill goes 1.06 → 1.73 → 1.05 from dusk 0.3 to 0.5 to 0.74, while the key falls 0.45 → 0.31 → 0.17. See finding R11B-5. |
| The crest line: a long diagonal | **True in the terrain; it doesn't give A's light** | The aerial-spawn pit is gone (the slip face is now one long diagonal). But A's left is still lit, and A's band r is only +0.25. |
| The caravan turned 180°, its open back to the approach | **True** | B and h2 show the arch, the lantern inside and the tailboard. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R11B-1 | D, C (and B) | must-fix | **regression** (52142e83c, the far-land fill) | D y 0.50–0.70; C x 0.55–1, y 0.48–0.53 | **The late far land: make it dark by form, not by a constant cut.** The 30 m change brought the clip's ground back (5 → 27), but it lifted C's far land to 32–34 (mockup 16–17) and D's right half to 23–33 (13–22). D's left stays 35–42 (16–19), and D's land r fell to −0.52. Use seat C's round-10 form term: with `uDusk`, darken faces turned away from the glow (normal · the glow direction), keep the crest rims lit, and add the lit near band. Targets: D's y 0.52–0.62 at 13–22 on both halves, a band at y 0.64–0.68 near 55, and C's x 0.6–0.9, y 0.48–0.53 near 17. Keep the clip's near dunes readable. |
| R11B-2 | A (dusk-fire shares the ground) | must-fix | **repeated** (R9B-1, R10B-3) | x 0–0.9, y 0.36–0.58 | **A's light on the landform is still mirrored.** The left third is lit (80–109) where the mockup is shaded (28–47). The mockup's lit diagonal (x 0.3–0.9, y 0.38 → 0.48) is shade or mid-tone (33–74), and the shade band above the near crest (x 0.5–1, y 0.48–0.54: 33–40) reads 49–79. The crest's slip face is on the right of the frame. In the mockup, the camera-facing slope on the left is the lee. Turn the crest line (layout `CREST_LINES`) so its lee faces the spawn on the left and its lit windward face falls on x 0.3–0.9. Check A's band r ≥ 0.5, and that dusk-fire's lit shoulder (x 0–0.3, y 0.42–0.56) stays lit. |
| R11B-3 | A | should-fix | **repeated** (R10B-2, part-fixed) | x 0–1, y 0.56–0.86 | **A's near sand is still 21 over** (78.1 against 57.4). dusk-fire sits on the same ground, and it now matches (74.6 against 73.8), so light alone can't close A's gap. Fix it through R11B-2: put A's near ground in the crest's lee. Don't dim the key again; that would break dusk-fire. |
| R11B-4 | A | should-fix | **new** (an overcorrection of R10B-1) | sky x 0.5–1, y 0.13–0.33 | **A's clouds lost their fire.** Cover is 8.6 % against 23.6 %, and the colour (161,112,90) against (214,117,64). Pixels over 140: 1.8 k against 19.3 k. The right fifth of the glow is 131 against 162. Keep dusk-fire's sky (it now matches its mockup's left half), and lift only the lit edges of the banks on the glow side. Saturation should rise toward the right (0.58 at the left to 0.76 at the right in the mockup). Thin the mauve left-hand bank (6.4 % against 1.1 %). |
| R11B-5 | B (the dusk as a whole) | should-fix (ledger 5, "no narrowing") | **new** | the fill curve, `look/dusk.ts` | **The fill bump is centred on B's staged dusk.** `fillAt` adds `0.7·exp(−((d − 0.5)/0.12)²)`: the ambient rises 63 % between dusk 0.3 and 0.5, then falls back by 0.74, while the sun keeps setting. It is global and reached by play, so it is not a void. But it is a curve fitted to one capture's dusk value, and it can make the dusk brighten on the way to the logbook. Round 9 fixed a dusk that ran backwards. Make `fillAt` monotonic in d, and get B's last 4.5 luma from the sand's own dusk colour or albedo. Check with a time series of h2 at dusk 0.3 / 0.4 / 0.5 / 0.6. |
| R11B-6 | B | should-fix | **repeated** (R10B-6c) | x 0.70–0.95, y 0.40–0.47 | **B's horizon glow:** peak 101 against 163, 4 rows over 100 against 64; it has not moved in three rounds. The mockup's broad orange band sits behind the camp. The late glow line now exists, so give it B's dusk-0.5 width (~3–4° tall) and peak (≈ 160), so it is no longer a thin stripe. Also: (a) the wagon body is 38 against 54, with fine detail 5.2 against 12.0. Light the inside of the arch and the tailboard from the lantern; the halo is now right. (b) Centre the plume over the wagon (x ≈ 0.52) and raise its contrast to +13 to +20. |
| R11B-7 | D (all the hands) | should-fix | **regression** (17d14b684) and **repeated** | glove x 0.55–0.95, y 0.66–0.80 | **The darker gauntlet moved away from D.** p95 is 42 against 85 (r10 51), and fine detail 3.0 against 9.1. Its saturation did not fall (0.63 against 0.51), so it reads as a darker red, not a dark brown. Take the albedo toward (51,30,25) with lower chroma. Put the brightness into broad worn highlights on the knuckles and the cuff, so p95 reaches ≈ 80. Raise the hold a further ~30 px so the fingers clear DODGE, as in the mockup. |
| R11B-8 | C | should-fix | **repeated** (R10B-5; the core is now 58 %) | x 0.22–0.55, y 0.30–0.52 | **The fire:** keep the new white core (539 over 245; r10 0). Widen the body back to the bowl's width (91 → ≈ 120), and let the charred logs show at its base. Turn the embers up-left (277 / 881 against 618 / 512) and add the grey-brown billow up-left. The pool: 48 → 40. |
| R11B-9 | h4, h2, A (and every early view) | should-fix (ledger 5, "no narrowing") | **new** (the r11 sky change) | low sky, h4 x 0–0.55, y 0.30–0.36; A x 0–0.15, y 0.28–0.34 | **A gamut-clipped red band in the low sky.** Blue clips to 0 at a mean of (120,33,1): 4.0 % of h4's upper band (r10 0.01 %), 5.7 % of h2's (r10 1.4 %), 0.24 % of A's. In h4 it is a hard dark-red stripe with a dithered top edge. No mockup has it. Clamp the new red-orange cloud and band term before tone mapping, so blue stays above ~20, and blend the band's top edge. |
| R11B-10 | dusk-fire | nit | **repeated** | x 0.15–0.6, y 0.13–0.20 | The mockup frames a Roc over the tower. It is a real creature of the shard, so if one can fly there at the spawn's dusk, the capture could show it. Never stage a pose for it (ledger 5). |

## No-shortcut check (ledger 5)

- **Views:** no mock camera changed: camAt is identical for all five `mock-*` views. h3 moved 0.28 m and h4 0.16 m in
  y, with the terrain (the README names both; the builder's commit named only h4). `cameras.json` is the same blob,
  a4219aa3.
- **Terrain:** the crest line is real, re-baked terrain with the navmesh. The README reports walk 0 stuck, and the
  commit reports max climb green. It shows in both aerials, and the aerial-spawn pit is gone.
- **Staged state:** `meta.json`'s staged list is unchanged, and no staging code changed. The `plugin.ts` diff is a type
  declaration only (E405). The fill bump (R11B-5) lights the staged B dusk, but it is a global function of real quest
  state. Should-fix, not a void.
- **No screenshot cheats:** the lantern halo is depth-tested again and 0.5 m (round 10's ledger note, resolved). The
  far-land fade to black from 8 m is gone (resolved). Its replacement is global, but it costs C and D (R11B-1).
- **No narrowing:** the hero views fell 4–8 luma with the key cut (h1 67.9 → 60.8; h2 57.1 → 48.9). The late clip's
  ground is readable again. New: the clipped red band in h4 and h2 (R11B-9).
- **Device and HUD:** 390×844 touch, stored 780 wide; the baseline HUD in every frame; the 30 fps chip; `active: []`;
  `pageErrors: []`; 59 programs. This surface has no frame-time or memory trace, so those budgets are unverified, not
  breached.

No breach this round.

SCORE signal-dunes: 6.9

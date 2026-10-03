# Round 12, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 amendment), the brief, `scores.md`, and round 11's three Signal
  Dunes seat files.
- The "Signal Dunes, round 12" section of `art/mockup-council/round-12/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0611-c83fb063/`: every `mock-*`, h1–h4, both aerials,
  `clip.mp4` (1 fps) and `meta.json`.
- Round 11's capture, `20261003-0511-ea6ccc86/`, for before and after.
- The five ledger mockups, Lanczos-scaled to 780×1688.

Source checks (read-only `git show` / `git diff ea6ccc86 c83fb063`):
- `look/render.ts`, `look/dusk.ts`, `look/sky.ts`, `world/meshes.ts`, `world/fireFx.ts`, `world/tower.ts`, `layout.ts`
  and `plugin.ts` (`duskOf`).
- Both captures' `terrain.bin` bakes, decoded and diffed.
- The camAt blocks of both `meta.json` files.

How I measured:
- **Brightness** is Rec. 709 luma (0.2126 R + 0.7152 G + 0.0722 B) on the decoded JPEGs.
- **Fine detail** is the mean of |luma − luma blurred at σ 2 px|.
- **Macro r** is the Pearson r of σ-12 luma, mockup against game, over a named band, with the mean |diff|.
- **Regions** are fractions of the frame (x left → right, y top → bottom), or pixel boxes on the 780-px frame.
- **The clean patch** is measure.py's x 10–190, y 1160–1420. It is still clean in all 15 frames: the coil, Sefa and
  the HUD bar are where round 11 found them, and no mock camera moved.

## Measurements (mockup / r11 / r12)

**Near sand** (clean patch). `measure.py` on the capture gives the commit's numbers: 65.8 / 69.8 / 35.9 / 35.2 / 33.2.

| View | Mean | p5–p95 | Fine | RGB (r12) |
|---|---|---|---|---|
| dusk-fire | 73.8 / 74.6 / **65.8** | 45–111 / 39–101 / **33–90** | 9.4 / 9.8 / **9.2** | 113,66,38 → **96,59,40** |
| A spawn | 57.4 / 78.1 / **69.8** | 33–94 / 41–105 / **35–94** | 9.3 / 10.7 / **10.2** | 88,51,36 → **99,64,44** |
| B logbook | 39.7 / 35.2 / **35.9** | 31–50 / 19–49 / **19–50** | 2.0 / 2.7 / **3.1** | 62,34,27 → **61,30,24** |
| C waymark | 32.6 / 34.0 / **35.2** | 26–37 / 24–43 / **24–45** | 0.7 / 1.4 / **1.3** | 53,28,22 → **60,29,25** |
| D hands | 34.9 / 33.6 / **33.2** | 23–48 / 26–42 / **25–42** | 0.6 / 1.5 / **1.5** | 52,31,27 → **53,28,26** |

**Whole frame**, rows 120–1400, σ-12 macro r / mean |diff|, r11 → r12:

| View | r11 | r12 |
|---|---|---|
| dusk-fire | +0.62 / 15.1 | **+0.56 / 17.6** |
| A | +0.63 / 17.9 | **+0.65 / 17.7** |
| B | +0.74 / 9.6 | **+0.73 / 9.6** |
| C | +0.62 / 13.4 | **+0.62 / 14.3** |
| D | +0.78 / 11.1 | **+0.79 / 10.8** |

B is nearly the same frame as round 11: the mean |RGB diff| between the two captures is 1.3, and 0.1 % of its pixels
differ by more than 20.

### The spawn pair (A and dusk-fire)

**Light and contrast on the landform**, band x 0.3–1, y 0.40–0.58:

| View | Darkest 30 %: RGB, B/R | Brightest 15 %: RGB | p5 / p50 / p95 (spread) | Band macro r, \|diff\| |
|---|---|---|---|---|
| A mockup | 40,32,41, **1.04** | 183,103,59 | 32 / 41 / 119 (**87**) | |
| A r11 | 61,36,33, 0.54 | 118,80,59 | 32 / 67 / 84 (52) | +0.25, 25.5 |
| A r12 | **55,32,31, 0.56** | **106,74,57** | 30 / 60 / 77 (**47**) | **+0.22, 23.5** |
| dusk-fire mockup | 46,37,39, **0.85** | 127,74,44 | 33 / 55 / 84 (**51**) | |
| dusk-fire r11 | 59,33,31, 0.53 | 115,73,51 | 32 / 61 / 80 (48) | +0.42, 13.2 |
| dusk-fire r12 | **53,30,29, 0.55** | **102,66,48** | 30 / 54 / 72 (**41**) | **+0.39, 13.9** |

So the split's darker sand cut the lit faces, not the shade. Both views are flatter than round 11. The mockups' lee is
violet (B/R 0.85–1.04); the game's is warm brown (0.55).

**A's grid** (cells 0.1 wide, 0.02 tall), r12 against the mockup:
- At y 0.38–0.42 the left third is still lit, **102–107 / 92–96**, where the mockup is in lee shade (28–47). The light
  is still mirrored.
- Over the mockup's shade band above the near crest (x 0.5–1, y 0.48–0.54: 33–40), the game reads **40–70**.

**The new near ridge** ((8, 42) to (40, 30), 4 m):
- In the bake it is real terrain. Heights changed only in x 7–30, z 28–50, by up to **3.37 m**, with a steepest cell of
  **28.7°** (none over 35°).
- From A's camera it barely registers. The r12/r11 luma ratio is 0.87–0.92 across the band, which is the global darkening.
  The ridge's cells (x 0.8–1, y 0.48–0.50) reach only **0.79–0.84**, with a faint crest at x 0.9, y 0.52 (1.11).

**The skies:**

| Measure | dusk-fire: mock / r11 / r12 | A: mock / r11 / r12 |
|---|---|---|
| Sky box (40,300)–(540,600) | 75.9 / 93.4 / **100.0** | 88.3 / 87.5 / **93.5** |
| Band y 0.24–0.30 / y 0.30–0.36 | 85 / 97 → 99 / 114 → **117 / 102** | 103 / 110 → 96 / 108 → **111 / 96** |
| Pixels over 140, y 0.12–0.34 | 3.2 k / 2.0 k / **10.0 k** | 19.3 k / 1.8 k / **2.3 k** |
| The glow by fifths, y 0.31–0.34 | 130 87 99 115 122 / 104 117 131 131 120 / **92 103 116 116 104** | 103 118 114 148 162 / 85 103 118 129 131 / **75 91 103 114 115** |
| Lit orange cloud, right half, y 0.12–0.26: cover, RGB | 0.0 % / 0.2 % / **13.8 % at (191,117,92)** | 3.3 % at (207,103,64) / 0.0 % / **6.8 % at (167,105,96)** |

Lit orange cloud means luma over 110 with R over 1.6 B.
- Both mockups are brighter at y 0.30–0.36 than at y 0.24–0.30. Both game skies are now the other way round: the new
  banks brighten the upper band, and the lowered hot spot dims the glow.
- dusk-fire's right is now a saturated orange-pink bank. The mockup has a grey-brown bank there.
- A's banks are pink (blue 96), not the mockup's red-orange (blue 64).

**The keeper's flame** (window x 0.25–0.6, y 0.18–0.30, pixels over 150): dusk-fire 179 / 47 / **61**. Still a pin
light.

### B

| Region | Mockup | r11 | r12 |
|---|---|---|---|
| Wagon box, x 0.48–0.73, y 0.43–0.53 (the mockup's own box: 54.3) | 47.6 | 38.1 | **35.7** |
| Same box: fine detail | 9.4 | 5.2 | **5.1** |
| Tailboard, the brighter half (game x 0.49–0.61, y 0.455–0.48; mockup x 0.42–0.60, y 0.445–0.475): RGB | 101,68,52 | 91,33,10 | **77,29,9** |
| Tailboard: saturation / luma | 0.48 / 49.4 | 0.89 / 31.0 | **0.89 / 25.2** |
| Horizon glow, x 0.72–0.90: peak at y, rows over 100 | 163 at 0.436, 82 | 101 at 0.453, 4 | **105 at 0.453, 12** |
| Plume, peak over the row median, at x | +12..+24 at 0.50–0.54 | +6..+21 at 0.47–0.73 | **+8..+20 at 0.47–0.73** |
| Smoke column, x 0.45–0.60, y 0.15–0.35 | 52.1 | 45.9 | **46.2** |
| Land left of the camp, x 0–160 px, y 0.455–0.475 | 39.4 | 57.3 | **59.0** |
| Camp band, x 0–1, y 0.40–0.60: macro r | | +0.63 | **+0.60** |

The lantern is unchanged (x 0.555, y 0.447; max 229).

### C

| Region | Mockup | r11 | r12 |
|---|---|---|---|
| Flame, x 150–450, y 350–900: pixels over 150 | 13 733 | 12 131 | **14 847** |
| Same box: over 230 / 235 / 245 | 5 557 / 4 649 / 2 722 | 3 387 / 2 738 / 677 | **3 548 / 2 114 / 446** |
| Flame, y 520–900: widest row (px) | 121 | 91 | **104** |
| Same box: edge energy on pixels over 150 | 13.5 | 10.5 | **8.8** |
| Pool, x 150–450, y 1060–1150 | 40.4 | 47.9 | **50.7** |
| Smoke region (40,170)–(200,260): RGB | 44,32,47 | 28,31,76 | **28,31,76** (bare sky) |
| Left backdrop, x 0–0.2, rows y 0.44–0.52 | 24–26 (sky above it 76–86) | 29–33 | **10–16** |
| Right far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 33.9 | **9.3** |
| Backdrop macro r: left / right | | +0.60 / +0.45 | **+0.48 / +0.57** |
| Plinth face, (242–282, 958–998): luma, fine (mockup's own face 34.0, 10.0) | | 36.7, 5.3 | **33.6, 6.7** |

### D

| Region | Mockup | r11 | r12 |
|---|---|---|---|
| Afterglow (column x 300–500): peak at y, rows over 100 / 140 | 170 at 0.497, 121 / 58 | 173 at 0.482, 76 / 50 | **175 at 0.476, 81 / 52** |
| Afterglow: RGB | 214,161,129 | 239,159,111 | **238,162,120** |
| Land y 0.52–0.62: left / right half | 16.0 / 16.0 | 39.9 / 28.0 | **34.2 / 10.9** |
| Land rows y 0.51–0.69, x 0–0.4 | 18 16 15 19 13 13 28 17 14 13 14 11 32 **64 63 56** 52 49 48 | 42 35 34 … 38 37 | **29 18 18 33 38 43 42 42 40 39 39 39 39 38 38 38 37 37 36** |
| Land macro r: x 0–0.4 / x 0–1, y 0.50–0.66 | | −0.52 / −0.07 | **−0.20 / +0.11** |
| Glove (seat C's box (600,1130)–(780,1330)): p95, fine | 71.6, 7.67 | 42.7, 3.44 | **55.5, 4.15** |
| Glove back of the hand (mockup (600,1100)–(720,1200); game (540,1140)–(700,1230)): p95, RGB, saturation | 85, 51,30,25, 0.54 | 42, 41,19,15, 0.69 | **56, 51,26,21, 0.64** |

### Hero views and the late clip

| | r11 | r12 |
|---|---|---|
| h1 / h2 / h3 / h4, ground y 0.55–0.85 | 61.2 / 46.3 / 44.5 / 59.5 | 57.1 / 42.7 / 39.6 / 52.3 |
| h2 / h4: pixels with blue < 8 and red > 120, y 0.15–0.45 | 1.6 % / 1.9 % | **0.00 % / 0.00 %** |
| **clip.mp4 (the late-dusk orbit), 10 frames: ground y 0.55–0.90** | 27–31 | **7–24** |
| **clip.mp4: the far land, y 0.30–0.55** | 20–25 | **6–9** |

In the r12 clip the far land is near-black, with hard-edged black blots. Only slopes turned toward the glow stay lit, as
pale islands (see R12B-1).

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.9** | 1. **The sky (x 0–1, y 0.12–0.36).** A regression. The A-bank change put a saturated orange-pink bank on the right: 13.8 % lit orange against the mockup's 0 %, and 10.0 k pixels over 140 against 3.2 k (r11 2.0 k). The mockup's right bank is grey-brown. The band at y 0.24–0.30 is 117 against 85, and the glow at y 0.30–0.36 is 102 against 97: the gradient is inverted. No Roc over the tower, and the keeper's flame is still a pin. 2. **The near field (y 0.56–0.86).** A regression from the spawn split: it was matched (74.6 against 73.8) and is now 65.8, RGB 96,59,40 against 113,66,38. 3. **The landform (y 0.36–0.58).** Flatter: band macro r +0.42 → +0.39, spread 41 against 51, lit faces 102 against 127, lee warm brown (B/R 0.55) against violet-grey (0.85). The two upright braided rings still fill the low centre, where the mockup has one low loop. Sefa stands at the left edge. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.4** | 1. **The landform light (x 0–1, y 0.36–0.58).** Repeated since round 1. The left third is lit at y 0.38–0.42 (102–107) where the mockup is in lee shade (28–47). The mockup's shade band (x 0.5–1, y 0.48–0.54: 33–40) reads 40–70. The new 3.4 m near ridge darkens its cells only 5–8 % past the global cut, and band macro r is +0.22. 2. **Contrast and colour.** The near sand gained (78.1 → 69.8 against 57.4), but by dimming the lit faces: the brightest 15 % are 106,74,57 against 183,103,59, the spread is 47 against 87, and the lee is brown (B/R 0.56) against violet (1.04). 3. **The sky (y 0.12–0.36).** The banks now have cover (6.8 % lit against 3.3 %), but they are pink (167,105,96 against 207,103,64). The glow at y 0.31–0.34 fell further: 75–115 against 103–162 (r11 85–131). Pixels over 140 are 2.3 k against 19.3 k. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.3** | 1. **The caravan (x 0.40–0.75, y 0.38–0.55).** The open arch and lantern still read. The wagon is darker than in round 11, away from the mockup: 35.7 against 47.6 in the same box (r11 38.1), fine 5.1 against 9.4. The tailboard went darker without going less red: saturation 0.89 against 0.48, luma 25 against 49. 2. **The horizon glow (x 0.72–0.90, y 0.40–0.47).** Peak 105 against 163, 12 rows over 100 against 82. The mockup's broad orange band is still a thin stripe. 3. **The plume and the sand.** The wisp is unchanged (+8..+20 at x 0.47–0.73, against +12..+24 over the wagon at x 0.50–0.54); the alpha change does not measure. The sand is 35.9 against 39.7, with a spread of 31 against 19 (it bands). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.1** | 1. **The fire (x 0.2–0.55, y 0.2–0.52).** The size now matches: 14 847 pixels over 150 against 13 733, and the widest row is 104 against 121 (r11 91). But the white-hot core shrank (446 over 245 against 2 722; r11 677). The torn edges lowered the edge energy (8.8 against 13.5; r11 10.5), so the flame reads as pale cream translucent sheets, not dense turbulent fire. No logs show. 2. **The backdrop (x 0–1, y 0.40–0.56).** The right far land is closer (9.3 against 16.1; r11 33.9). The left dune shoulder went near-black (10–16 against the mockup's 24–26; r11 29–33), and left macro r fell from +0.60 to +0.48. 3. **Smoke, pool and plinth.** The up-left billow is still bare sky (28,31,76 against 44,32,47). The pool is 50.7 against 40.4. The plinth now shows dark fieldstone courses (fine 6.7 against 10.0; r11 5.3), but it is still a square block where the mockup has a round drum, and the coil covers most of it. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.8** | 1. **The land (x 0–1, y 0.50–0.70).** Better on the right: 10.9 against 16.0 (r11 28.0). Land macro r is −0.20 (r11 −0.52). The left half is still a lit rising slope, 34 against 16, with none of the mockup's flat dark bands, nor its lit band at y 0.64–0.67 (63–64 against the game's 38). Part of the right half's match comes from the camera-distance term in R12B-1. 2. **The hero hand (x 0.55–1, y 0.62–0.86).** It gained: p95 55.5 against 71.6 (r11 42.7), RGB 51,26,21 against 51,30,25. Fine detail is still under half (4.2 against 9.0), the saturation is 0.64 against 0.54, and the loops are two big upright ovals across the centre, where the mockup has slim loops beside a raised fist. 3. **The afterglow (y 0.44–0.50).** Unchanged: the peak matches (175 against 170), but the band has 81 rows over 100 against 121, is more saturated (238,162,120 against 214,161,129) and sits 0.02 high. A flyer crosses at x 0.12, y 0.47, where the mockup's sky is empty (a live creature, not a breach). |

**Seat score, Signal Dunes: (6.9 + 6.4 + 7.3 + 7.1 + 6.8) / 5 = 6.9.**
- This seat's earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9.
- D and A's sand gained. dusk-fire paid for both of A's changes: the sand split and the banks. B is the same frame,
  slightly darker. C traded white core for size.

## The builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Near sand, mockup / now: dusk-fire 73.8 / 65.8, A 57.4 / 69.8, B 39.7 / 35.9, C 32.3 / 35.0, D 34.5 / 33.2 | **True** (reproduced) | 65.8 / 69.8 / 35.9 / 35.2 / 33.2. "Both within ~10" is true, but dusk-fire went from +0.8 to −8.0. |
| fillAt monotonic; B's step lifted in the sand material | **Monotonic: true. The material lift: a bell at B's dusk** | `fillAt = 1 + 0.05d`. The sand term: `* mix(0.8, 1, smoothstep(0, 0.3, d)) * (1 + 0.5·exp(−((d − 0.5)/0.1)²))`. B's sand moved 35.2 → 35.9, so the bell replaced the bump one for one. See ledger 5. |
| The late land darkened by its facing, **replacing** the constant far-fill cut | **False as worded** | `render.ts:339–340` still applies `sil` (−60 % indirect from 30 m). The new `away` term at :345–346 is added on top. It is keyed on camera distance too (`smoothstep(12, 50, sandFar)`, `sandFar = length(vSandPos − cameraPosition)`, :229). It takes 70 % off direct and indirect light, and it hits **flat** ground as well, because `toGlow ≈ 0` there gives `away = 1`. The late clip's far land is 6–9 (r11 20–25). |
| Thinner late fog | **True** | `fogDist × (1 − 0.8·late)`. |
| A low near ridge in A's frame; navmesh re-baked; the main crest line not moved | **True** | The bake changed only in x 7–30, z 28–50, by up to 3.37 m, with a max slope of 28.7°. It barely shows in A (see above). |
| The low sky unclipped | **True** | h2 / h4 pixels with blue < 8 and red > 120: 1.6 / 1.9 % → 0.00 / 0.00 %. |
| A's right-hand banks wider and denser, a saturated orange | **Cover true; colour no; it spills into dusk-fire** | A's lit cover is 0 → 6.8 % (mockup 3.3 %), but at (167,105,96) against (207,103,64). dusk-fire's right is 13.8 % lit orange against the mockup's 0 %. |
| The sunset band and hot spot lower | **True, and it overshoots** | A's glow at y 0.31–0.34 fell to 75–115 (mockup 103–162). In both views the sky at y 0.24–0.30 is now brighter than at y 0.30–0.36, the opposite of both mockups. |
| The gauntlet lighter (albedo ×1.55, roughness 0.34) | **True, half way** | p95 42.7 → 55.5 against 71.6; RGB 51,26,21 against 51,30,25. |
| The keeper's flame 2.6 m, 1.1 m halo | **True in source; barely visible** | Pixels over 150 in the tower-top window: 47 → 61 against 179. |
| The waymark flame 3.4, its edge torn twice over | **Taller: true. Torn: no measurable gain** | Pixels over 150: 12 131 → 14 847 (mockup 13 733). Edge energy on the flame: 10.5 → 8.8 against 13.5. Over 245: 677 → 446 against 2 722. The commit's "over 230 2 507 / 5 495" is from 4a9d91687 (before the edge change); at c83fb063 I measure 3 548 against 5 557. |
| The wisp more opaque | **No measurable change** | The plume is +6..+21 → +8..+20 against +12..+24; the column is 45.9 → 46.2 against 52.1. |
| The tailboard and wheels dark weathered wood | **Darker: true. Weathered (less saturated): no** | The tailboard's saturation is 0.89 → 0.89 against 0.48, and its luma 31 → 25 against 49. |
| The plinth a drum of dark fieldstones | **Stones: true. Drum: no** | Fieldstone courses and mortar show (fine 5.3 → 6.7 against 10.0), clearest in h3. It is still a square block. |
| No camera changed | **True** | camAt is identical for all 12 shots; the cameras blob is still a4219aa3. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R12B-1 | the late world (clip), D, C | **must-fix**; ledger-5 should-fix ("no narrowing"; the same shape as round 10's fade) | **regression** (4a9d91687) | clip y 0.30–0.90; C x 0–0.2, y 0.44–0.52 | **The late `away` term darkens by camera distance, and it darkens flat ground.** Beyond 12–50 m from the camera, any face not tilted ≥ ~13° toward the glow (flat ground included) loses 70 % of its light, on top of `sil`. The late clip's far land is 6–9 (r11 20–25), with hard-edged black blots and pale islands where the slopes face the glow. C's left shoulder dropped to 10–16 against 24–26. Fix: remove `smoothstep(12, 50, sandFar)` from `away`. Widen its facing window so flat ground keeps its fill and only faces turned clearly away darken (centre it below zero, e.g. `1 − smoothstep(−0.25, 0.1, toGlow)`, softly). Drop `sil` if `away` replaces it, as the README says. Get D's dark bands from transverse ridges in the terrain, not from shading by distance. Check: the clip's far land ≥ ~18 with forms reading, D's right half near 16, and C's left shoulder near 25. |
| R12B-2 | A, dusk-fire | must-fix | **repeated** (R11B-2/3), with a **regression** in dusk-fire (ba3ebda26) | x 0–1, y 0.36–0.86 | **The split dimmed the lit faces; it didn't move the shade.** dusk-fire's sand went from matched (74.6) to 65.8, and A's gap halved (78.1 → 69.8 against 57.4). Both views are flatter: A's spread is 47 against 87, its lit faces 106 against 183, and its lee brown (B/R 0.56) where the mockup's is violet (1.04). A's left is still lit (102–107 against 28–47). The 3.4 m near ridge darkens its cells only 5–8 % past the global cut. Fix: revert the key 0.63 → 0.72 and the ×0.8 dusk-0 albedo, so dusk-fire's sand is back at ~74. Give the shade at dusk 0 a cool violet sky fill (B/R ≈ 0.9–1.0) and the lit crests a brighter, more saturated key (target A's top 15 % ≈ 180,100,60). Close A's 12-luma gap by form: the ground in A's lower right (x 0.5–1, y 0.48–0.56) has to be in the shadow of a crest between it and the key. A 3.4 m bump 28–40 m out does not cast that shadow. |
| R12B-3 | dusk-fire, A | should-fix | **new** (5fded12c5) | sky x 0–1, y 0.12–0.36 | **The skies: A's banks spilled into dusk-fire, and the glow went under.** dusk-fire's right half is 13.8 % lit orange-pink against 0 % (pixels over 140: 10.0 k against 3.2 k), where its mockup has a grey-brown bank. A's banks are pink (167,105,96) where they should be red-orange (207,103,64). Both views are now brighter at y 0.24–0.30 than at y 0.30–0.36, the reverse of both mockups. Fix: keep the cLit gain only in A's own sector (`rel` ≈ 0.05–0.45), and fade the gain out before dusk-fire's right edge (about 8° further on), back to round 11's grey-brown there. Cut the bellies' blue (target B/R ≈ 0.3). Raise the hot spot's height cut back, so A's glow at y 0.31–0.34 reaches ≈ 145–160 on the right. |
| R12B-4 | B (the dusk as a whole) | should-fix (ledger 5, "no narrowing") | **repeated** (R11B-5, moved from the fill to the albedo) | `look/render.ts:280` | **The sand-albedo bell is tuned to B's shot.** It is global and reached by play, so it is not void. But it is the round-11 bump in a new place (details under Ledger 5), and it lifts the sand only, so B's subject went darker (wagon 38.1 → 35.7; tailboard 31.0 → 25.2). Fix: remove the bell. Light B's sand from the thing that lights it in the mockup, a broad afterglow (R12B-5): drive the sky fill from the low band's own brightness at the current dusk, which falls monotonically. Or leave B's sand 4 under; that costs less than a time-varying albedo. |
| R12B-5 | B | should-fix | **repeated** (R10B-6c, R11B-6) | x 0.70–0.95, y 0.40–0.47; wagon x 0.45–0.70, y 0.40–0.53 | **B's horizon glow and wagon.** The glow peaks at 105 against 163, with 12 rows over 100 against 82, after four rounds. Give the dusk-0.5 band ~3–4° of height at a peak near 160. The wagon: take the tailboard's saturation from 0.89 toward 0.5 at luma near 50. If `warmByFire` re-saturates it, desaturate after that patch. Let the lantern light the inside of the arch, so the wagon box reaches ~48. Centre the wisp over the wagon (x ≈ 0.52); its alpha change does not show. |
| R12B-6 | C | should-fix | **repeated** (R11B-8), core **regressed** | x 0.2–0.55, y 0.2–0.52; x 0–0.35, y 0.1–0.4 | **The fire's size now matches, but its heat and texture moved away.** Pixels over 245 are 446 against 2 722 (r11 677), and edge energy 8.8 against 13.5 (r11 10.5): pale translucent sheets. Concentrate a dense white-yellow core low over the logs, make the licks opaque orange with dark gaps between them, and let the charred logs show. The billow up-left is still bare sky (28,31,76 against 44,32,47). The pool is 50.7 against 40.4. Round the plinth into a drum. |
| R12B-7 | D (all the hands) | should-fix | **repeated** (R11B-7), improving | glove x 0.55–0.95, y 0.66–0.80; land x 0–0.5, y 0.52–0.70 | **The glove** is half way: p95 55.5 against 71.6 and fine 4.2 against 9.0. Put the remaining value into broad worn highlights on the knuckles and cuff, and the detail into fold-scale normals; take the saturation from 0.64 to ~0.54. **D's left land** is 34 against 16. It needs the mockup's flat dark bands and its lit band at y 0.64–0.67 (≈ 63), so it needs form (transverse ridges), not distance shading (R12B-1). |
| R12B-8 | dusk-fire | nit | **repeated** (R11B-10) | x 0.15–0.6, y 0.13–0.30 | The keeper's flame is still a pin light (61 pixels over 150 against 179). The mockup also frames a Roc over the tower. Only a real flight may show one; never a staged pose. |

## Ledger 5 (no shortcuts)

**Is the sand-albedo bell at dusk 0.5 a world change, or tuned to B's shot?** Both: it is a real global change, tuned
to B's shot. Should-fix, not void (R12B-4).
- **A world change:**
  - It is in the shared sand shader and keyed to `uDusk`.
  - Every player meets it. Dusk sits at 0.50–0.62 from meeting Sefa to the first lit brazier (`duskOf`: 0.5, 0.52,
    0.56, 0.62), so it is real, held quest state.
- **Tuned to B's shot:**
  - It is centred exactly on 0.50, the value `stage('logbook')` snaps to.
  - Its width (0.1) is narrower than the round-11 fill bump (0.12).
  - It replaced that bump one for one on B's measured patch (35.2 → 35.9).
  - It is not monotonic. The sand's albedo goes ×1.0 at dusk 0.3, ×1.5 at 0.5, ×1.35 at 0.56, ×1.12 at 0.62 and ×1.0 at
    0.74. As the sun sets, the shaded sand gets about 50 % brighter, then dims again. That is R11B-5's objection,
    moved from the fill into the material.
  - Albedo is a property of the sand, so making it vary with time of day is exposure under another name.
  - It lights the sand and nothing else, which is why B's wagon went darker.

**The other checks:**
- **Views:** no camera changed. camAt is identical for all 12 shots, and `cameras.json` is still blob a4219aa3.
- **Staged state:** `staged` lists the same three entries. 4a9d91687 touches `dusk.ts` (a stage-handler file) only to
  change `fillAt`, and `duskOf` is unchanged, so the round-11 reachability analysis holds.
- **No screenshot cheats:** the new ridge is baked terrain (max 28.7°, navmesh re-baked). The plinth and the flames are
  materials and effects on real meshes. The keeper halo shrank (2.6 → 1.1 m) and is depth-tested.
- **No narrowing:** a regression. The late clip's far land went from 20–25 to 6–9, with hard black blots, because of a
  term keyed on camera distance (R12B-1). It is the same shape as round 10's fade, which was ruled a should-fix. The
  hero views fell 3–7 luma with the split (h4 59.5 → 52.3). The clipped red band is fixed.
- **Device and HUD:** 390×844 touch, stored 780 wide, with the baseline HUD in every frame. The 30 fps chip shows;
  `pageErrors: []`; 59 programs; `active: []`. The README reports parity green (walk 0 stuck, gpuMB within 108.99).
  This surface has no frame-time or total-memory trace, so those limits are unverified, not breached.

No score is voided. Two ledger-5 should-fixes: R12B-1 and R12B-4.

SCORE signal-dunes: 6.9

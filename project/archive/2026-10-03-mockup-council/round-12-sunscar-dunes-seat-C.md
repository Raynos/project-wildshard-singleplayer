# Round 12, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- The "Signal Dunes, round 12" section of `art/mockup-council/round-12/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0611-c83fb063/`: every `mock-*`, h1–h4, both aerials,
  `first-frame`, `clip.mp4` at 1 fps and `meta.json`.
- Round 11's capture `20261003-0511-ea6ccc86/`, for before and after: a per-pixel luma diff of every shot.
- The five ledger mockups, Lanczos-scaled to 780×1688.

**Source checks (read-only):**
- `git show` of all five shard commits between the captures: 615ae4664, ba3ebda26, 4a9d91687, 5fded12c5, c83fb0632.
- `look/dusk.ts`, `look/render.ts` and `plugin.ts` (`duskOf`, `stage`) at the captured SHA.
- The terrain bake before 4a9d91687 and at c83fb063, decoded (256², 500 m).
- The camAt of every shot in both `meta.json` files.

**How I measured:**
- All brightness is Rec. 709 luma on the decoded JPEGs.
- Clean sand is the seats' patch, **x 10–190, y 1160–1420**. Fine detail is mean |luma − luma blurred at σ 2 px|.
- Macro r is the Pearson r of σ-12 luma, mockup against game, over a named band. Region error is mean |mockup − game| at
  σ 4.
- Regions are fractions of the portrait frame (x left → right, y top → bottom).

**The short version.** This round trades, it does not climb.
- **Gains:**
  - D's late land on the right is now dark bands with lit crest edges.
  - C's far land is no longer lit (33.9 → 9.3, mockup 16.1), and the flame is back to the mockup's size.
  - The glove is lighter.
  - The fill bump is gone from `fillAt`.
- **Losses, mostly in Jake's pick and in the spawn view:**
  - dusk-fire's sky gained bright cream-orange banks on the right, where its mockup has a dark grey streak.
  - Its near sand was cut from a match (74.6) to 65.8, on purpose, to split the gap with A.
  - The new near ridge puts a lit hump in its mockup's shaded hollow.
  - A's horizon glow dimmed while its upper sky brightened, so its gradient now runs the wrong way.
  - The late-dusk clip went back toward black: the ground is 7–24, against round 11's 27–31, with hard-edged blotches.
- **The B shortcut moved rather than went away.** The 1.7× fill bump at B's dusk 0.5 is now a 1.5× sand-albedo bell at
  dusk 0.5. It is narrower, and B's sand moved 0.7 luma.

No breach voids a score. Three items are should-fixes under ledger 5: the albedo bell, the camera-distance "away" term
and the near ridge's placement. One claim is false by threshold: "the low sky unclipped".

## Measurements (mockup / r11 / r12)

| View | Clean sand | Fine | Sky box (40,300)–(540,600) | Macro r, y 0.36–0.58 (mean diff) | Whole r, rows 120–1400 (mean diff) |
|---|---|---|---|---|---|
| dusk-fire | 73.8 / 74.6 / **65.8** | 9.3 / 9.6 / **9.0** | 75.9 / 93.4 / **100.0** | +0.41 → **+0.39** (13.2 → **13.9**) | +0.61 → **+0.56** (15.1 → **17.6**) |
| A spawn | 57.4 / 78.1 / **69.8** | 9.3 / 10.5 / **9.9** | 88.3 / 87.5 / **93.5** | +0.12 → **+0.12** (25.8 → **24.1**) | +0.63 → **+0.65** (17.9 → **17.7**) |
| B logbook | 39.7 / 35.2 / **35.9** | 2.0 / 2.6 / **3.1** | 50.1 / 46.5 / **46.7** | +0.66 → **+0.64** | +0.73 → **+0.73** |
| C waymark | 32.6 / 34.0 / **35.2** | 0.4 / 1.4 / **1.3** | 52.5 / 50.3 / **51.6** | +0.56 → **+0.62** | +0.62 → **+0.62** |
| D hands | 34.9 / 33.6 / **33.2** | 0.4 / 1.5 / **1.5** | 50.0 / 49.9 / **49.9** | +0.73 → **+0.76** | +0.78 → **+0.79** |

The builder's clean-patch numbers reproduce exactly (65.8, 69.8, 35.9, 35.2, 33.2).

### The spawn pair: what changed (r12 − r11, mean luma per 0.05 band of the frame)

| Shot | y 0.20–0.25 | y 0.25–0.30 | y 0.30–0.35 | Ground, y 0.35–0.85 |
|---|---|---|---|---|
| dusk-fire | +23 | +17 | −13 | −3 to −8 |
| A | +18 | +13 | −12 | −2 to −7 |
| h1 / first-frame | +7 / +6 | +20 | −12 | −1 to −6 |

- Aerial-spawn and aerial-overview are **8–11 darker everywhere**. That is ba3ebda26's sand albedo ×0.8 at dusk 0 and its
  key cut (0.72 → 0.63).
- **The sky rows, right half (x 0.5–0.95), mockup / r11 / r12:**
  - **A:**
    - y 0.25: 100 / 92 / **116**;
    - y 0.31: 137 / 125 / **114**;
    - y 0.33: 145 / 131 / **110**.
  - The mockup brightens toward the horizon. r12 peaks at y 0.25–0.28 and darkens toward the horizon.
  - **dusk-fire:**
    - y 0.25: 77 / 92 / **124**;
    - y 0.32: 118 / 129 / **113**.
- **Cloud cover** (residual over the row median > 12, y 0.13–0.33), mockup / r11 / r12:
  - **A, right half:** 23.6 % (213,116,64) / 8.0 % / **8.8 % (159,108,92)**. The "A's right-hand banks" change barely
    reached A.
  - **dusk-fire, right half:** 6.8 % (137,111,97) / 6.0 % / **17.5 % (183,117,92)**. It landed here instead: pixels over
    140 in y 0.12–0.34 went 3 183 / 1 964 / **10 029**.
- **Region error, sky y 0.10–0.36:** A 11.2 → **14.4**; dusk-fire 16.3 → **23.7**.
- **The builder's band claim** ("A's sky at 24–30 / 30–36 % of the frame 104 / 87, mockup 96 / 97") does not reproduce.
  Full-width rows give:

  | Frame | 24–30 % | 30–36 % |
  |---|---|---|
  | Mockup A | 102.6 | 110.3 |
  | r12 A | 111.2 | 96.3 |
  | Mockup dusk-fire | 85.0 | 96.8 |
  | r12 dusk-fire | 116.7 | 102.1 |

### The near ridge, (8, 42) → (40, 30), 4 m

- **The bake:** 117 cells changed, x 6.9..30.4 and z 28.4..50.0. The most raised is 3.37 m, and the steepest changed cell
  is 28.7°. Nothing else in the height field moved.
- **Where it shows:** seen from the spawn camera (0, 21.3, 70), it spans bearings 16°–45° to the right.
  - A (half-FOV 18.6°) sees only its left end, at the right edge.
  - dusk-fire (yawed 8° right) sees 16°–26.6°.
  - Both aerials show it, as a new hard-edged dark lobe. In aerial-overview it joins the old dark oval as a peanut.
- **What it does in the frames.** Its camera-facing side is **lit**:

| Region | Mockup | r11 | r12 | Region error r11 → r12 |
|---|---|---|---|---|
| A, x 0.9–1, y 0.53 (two 0.05 cells) | 32, 33 | 50, 47 | **65, 68** | |
| A, x 0.7–1, y 0.525–0.56 | 34.1 | 67.2 | 62.7 (the global dim) | 33.0 → 28.6 |
| dusk-fire, x 0.7–0.97, y 0.50–0.535 | 44.2 | 49.2 | **53.8** | **4.9 → 14.3** |

- In dusk-fire the ridge draws a lit diagonal hump across the mockup's broad shaded hollow, right of the crosshair.
- In A it adds a lit face under a 0.02-tall dark line, where the mockup's lee is uniformly 33–35.
- The commit's own aim was "A's near slope there lit where the mockup's is shaded". The ridge made it more lit.

### B

| Region | Mockup | r11 | r12 |
|---|---|---|---|
| Wagon front, x 0.45–0.60, y 0.41–0.47 | 58.3 | 48.7 | **46.0** |
| Wagon box fine, x 0.40–0.70, y 0.38–0.52 | 9.30 | 6.45 | **6.39** |
| Land left of camp, x 0–160 px, y 0.455–0.475 | 39.4 | 57.3 | **59.0** |
| Tailboard RGB, x 0.50–0.62, y 0.455–0.48 | 67,37,27 | 73,22,6 | **60,18,5** |
| Plume: peak column / mean residual | x 0.53 / 13.2 | x 0.73 / 4.1 | **x 0.72 / 5.0** |
| Horizon glow, x 0.72–0.9: peak / rows over 100 | 163 / 82 | 101 / 4 | **105 / 12** |

### C (flame box x 150–450, y 350–900)

| | Mockup | r11 | r12 |
|---|---|---|---|
| Pixels over 150 | 13 733 | 12 131 | **14 847** |
| Their mean | 213 | 201 | **200** |
| Over 235 | 4 649 | 2 738 | **2 114** (45 %) |
| Over 245 | 2 722 | 677 | **446** |
| Widest row | 121 | 91 | **104** |
| Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 33.9 | **9.3** |
| Pool, x 150–450, y 1060–1150 | 40.4 | 47.9 | **50.7** |
| Embers, left / right of x 300 | 2 187 / 2 359 | 584 / 5 633 | **595 / 5 575** |
| Smoke region (40,170)–(200,260), RGB | 43,32,47 | 27,30,76 | **28,30,75** |

### D

| | Mockup | r11 | r12 |
|---|---|---|---|
| Rows y 0.51–0.58 (0.01 steps) | 19 15 13 20 13 12 19 23 | 35 29 28 32 33 34 35 37 | **19 12 12 18 20 24 26 28** |
| Land, left half, y 0.52–0.62 | 16.0 | 39.9 | **34.2** |
| Land, right half, y 0.52–0.62 | 16.0 | 28.0 | **10.9** |
| Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 38.0 | **37.6** |
| Afterglow: peak / rows over 100 | 170 / 121 | 173 / 76 | **175 / 81** |
| Glove (600,1130)–(780,1330): p95 / fine | 71.6 / 7.62 | 42.7 / 3.36 | **55.5 / 4.05** |
| Glove saturation | 0.57 | 0.65 | **0.61** |

### clip.mp4 (the late-dusk orbit, frames 1–10 at 1 fps)

| | Ground, y 0.55–0.90 | Glow band, y 0.10–0.20 |
|---|---|---|
| r10 | 5.5–9.0 | |
| r11 | 26.6–30.8 | 180 → 114 |
| r12 | **15.1, 21.9, 23.7, 20.6, 16.3, 12.1, 8.8, 7.2, 8.1, 10.4** | 179 → 127 |

- Frames 6–10 are back at round 10's level.
- The ground reads as black stains with sharp-edged lit ovals inside them. The `away` term's
  `smoothstep(0.02, 0.22, toGlow)` is a hard threshold on gently undulating normals.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.3** | 1. **Sky (x 0.5–1, y 0.10–0.36). A regression.** Bright cream-orange cloud banks fill the right half (17.5 % against the mockup's 6.8 %; pixels over 140 10 029 against 3 183). The mockup has one dark grey-brown streaked bank there. The upper sky is now 24–32 over (y 0.24–0.30: 116.7 against 85.0), the box is 100 against 76, and the sky region error rose 16.3 → 23.7. There is still no ray over the tower. The keeper flame is a slightly larger pin-point on a pale-lit lattice; the mockup's tower is a dark silhouette. 2. **The landform's lower right (x 0.6–1, y 0.48–0.56). A regression.** The new near ridge lays a lit diagonal hump across the mockup's broad shaded hollow (region error 4.9 → 14.3). Whole-frame r fell 0.61 → 0.56. The tower dune's face is still lit, where the mockup's dome is a dark silhouette over a lit near slope. 3. **The near field (y 0.56–0.86). A deliberate regression.** It was a match (74.6 against 73.8) and is now 65.8, cut 8 to split the gap with A (ba3ebda26). The upright braided rings and Sefa still fill the mockup's open foreground with its single low loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **The landform's light (x 0–1, y 0.36–0.58). Repeated since round 1.** It is still mirrored: the left is lit at 79–94 where the mockup's lee is 35–60, and the mockup's lit diagonal at x 0.4–0.7, y 0.40–0.44 (93–106) is 45–65 here. The near ridge adds a lit face at the right edge (x 0.9–1, y 0.53: 65 and 68, against 32 and 33; r11 50 and 47). The band r is unchanged at +0.12. 2. **The sky (y 0.18–0.36). A regression in its shape.** The mockup's glow brightens down to the horizon (right half 137–146 at y 0.31–0.33). r12 peaks at y 0.25–0.28 and dims toward the horizon (110–114 at y 0.31–0.33; r11 125–131). The red-orange right-hand banks the builder aimed at A barely changed (8.8 % against 23.6 %, a dull 159,108,92 against 213,116,64). 3. **The near sand (y 0.56–0.86).** Closer, by a global albedo and key cut, not by form: 69.8 against 57.4 (r11 78.1). Sefa and the big upright rings fill the mockup's empty foreground. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.0** | 1. **The caravan (x 0.40–0.70, y 0.38–0.52).** Nearly unchanged: the front is 46.0 against 58.3, and the inside of the arch is flat (fine 6.4 against 9.3). The tailboard is darker but just as saturated (60,18,5 against 67,37,27), so it still reads as red-orange paint, not weathered wood. The wagon sits right of the crosshair, where the mockup centres it. 2. **Smoke and the low sky (x 0.45–0.95, y 0.15–0.48).** The wisp is still a faint arc rising at x 0.72 (residual 5.0 against 13.2 at x 0.53), not the mockup's clear column straight over the wagon. The horizon glow behind the camp is a thin line (rows over 100: 12 against 82). The land left of the camp got lighter (59.0 against 39.4), from the new sand bell. 3. **Sand and coil (y 0.55–0.86).** The sand is 35.9 against 39.7, with diagonal ripple bands where the mockup's is smooth. The upright braided ovals sit where the mockup has a broad low coil. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.0** | 1. **The fire (x 0.2–0.55, y 0.15–0.47).** Mixed. Its size is back (14 847 pixels over 150 against 13 733; widest row 104 against 121), but the white-hot core shrank (2 114 over 235 against 4 649; r11 2 738). The "torn edges" are see-through holes punched in the licks, so they read more like cut paper, not less. The crossed logs still don't show. 2. **Smoke and embers (x 0–0.55, y 0–0.35). Repeated.** The mockup's grey-brown billow up-left is still bare sky (28,30,75 against 43,32,47). The embers still fly right (595 / 5 575 against 2 187 / 2 359). 3. **Backdrop and ground (x 0.5–1, y 0.44–0.66).** The far land is now dark (9.3 against 16.1; r11 33.9). That is the round's best fix here, if a little too dark, and the band r rose 0.56 → 0.62. The pool is still too bright and broad (50.7 against 40.4), and the coil covers the plinth. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.7** | 1. **The land (x 0–1, y 0.50–0.68). A real gain on the right, and its method is a should-fix.** The rows now run 19 12 12 18 20 24 26 28 against the mockup's 19 15 13 20 13 12 19 23, and the right half reads as dark bands with lit crest edges. But the left half's rising slope is still 34.2 against 16.0, and the mockup's lit near band at y 0.64–0.68 (58.9) is a flat 37.6. 2. **The hero hand (x 0.55–1, y 0.55–0.86).** Lighter (p95 55.5 against 71.6; r11 42.7), but it is still the same lumpy crusted mitt with white flecks. No fingers, folds or seams read (fine 4.05 against 7.62), and the fingers still run under DODGE. The big ovals cross the centre, where the mockup's slim loops hang beside a raised fist. 3. **The afterglow and the tower (y 0.44–0.52).** Still a band about two-thirds of the mockup's depth (81 rows over 100 against 121), and more saturated. The tower sits at x ≈ 0.93 under the SIGNAL TOWER 200 chip; the mockup's stands clear at x ≈ 0.84. |

**Seat score, Signal Dunes: (6.3 + 6.3 + 7.0 + 7.0 + 6.7) / 5 = 6.66, so 6.7.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7.
- The mean holds at 6.7. D and C gained what the spawn pair (dusk-fire −0.4, A −0.1) gave back.

## Builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Clean-patch near sand: dusk-fire 65.8, A 69.8, B 35.9, C 35.0, D 33.2 | **True** | 65.8 / 69.8 / 35.9 / 35.2 / 33.2. dusk-fire was a match at 74.6 and is now 8 under, on purpose (ba3ebda26). |
| "fillAt is now monotonic … B's step lifted in the sand material: a bell ×1.5 at dusk 0.5" | **True as code; the bump moved, it did not go** | `diffuseColor *= … * (1.0 + 0.5 * exp(-pow((uDusk - 0.5) / 0.1, 2.0)))`. The bell is narrower than the old one (σ 0.1 against 0.12). B's sand is 35.2 → 35.9 (the commit's "32.2 → 35.9" starts from a number that isn't the r11 capture's). The land left of the camp rose 57.3 → 59.0, away from 39.4. |
| The near ridge: 4 m, navmesh re-baked, the main crest line not moved | **True** | 117 changed cells at x 7–30, z 28–50, max 3.37 m, steepest 28.7°. The main crest's cells are unchanged. |
| … aimed at "A's near slope there lit where the mockup's is shaded" | **False in effect** | Its camera-facing side is lit: A at x 0.9–1, y 0.53 went from 50 and 47 to 65 and 68 (mockup 32 and 33). dusk-fire's lower right region error went 4.9 → 14.3. |
| The late land darkened by its facing | **True, and it is camera-distance gated** | `away = smoothstep(0.3, 0.85, uDusk) * (1 − smoothstep(0.02, 0.22, toGlow)) * smoothstep(12, 50, sandFar)`. It cuts direct and indirect light by 70 % on flat ground and on faces turned from the glow, from 12 m around the camera (`sandFar = length(vSandPos − cameraPosition)`). It gives D's right half (10.9 against 16.0). The clip's ground falls to 7–12, with black blotches. |
| "The low sky unclipped" (h2 / h4 pixels with blue < 8 and red > 120: 0.00 %) | **False below the builder's threshold** | The band was dimmed under red 120, not unclipped. Pixels with blue < 10 and red > 60 in y 0.15–0.45: h2 5.2 % → **3.6 % at (78,17,1)**; h4 4.0 % → **2.7 % at (96,23,1)**. h2's row y 0.414 has 535 of 780 pixels clipped: the hard deep-red stripe behind the wagon is still there. |
| A's right-hand banks wider and denser, lit bellies a saturated orange | **Not in A; in dusk-fire instead** | A's right half 8.0 → 8.8 % (mockup 23.6 %), colour 159,108,92 against 213,116,64. dusk-fire's right half 6.0 → 17.5 % against 6.8 %. |
| The sunset band and hot spot lower (A 104 / 87, mockup 96 / 97) | **Mockup numbers don't reproduce; the band is inverted** | Full-width rows 24–30 / 30–36 %: mockup A 102.6 / 110.3, r12 111.2 / 96.3. The game's hot band now sits above the mockup's. |
| The gauntlet lighter, with glancing highlights | **True** | p95 42.7 → 55.5 (mockup 71.6). Fine 3.4 → 4.1 (7.6). The form is unchanged. |
| The waymark flame 3.4, torn edges | **Size true; the core shrank** | Over 150: 12 131 → 14 847 (13 733). Over 235: 2 738 → 2 114 (4 649). The tears are holes through the licks. |
| The wisp more opaque | **True, barely visible** | Residual 4.1 → 5.0 (mockup 13.2), still at x 0.72, not over the wagon. |
| Tailboard and wheels dark weathered wood | **Darker; still saturated** | 73,22,6 → 60,18,5 against 67,37,27. Blue still at 5. |
| Waymark plinth "a drum of dark fieldstones" (615ae4664) | **Not supported** | h3 shows the same square block (luma 46.6 → 46.9), with irregular stone outlines painted in the shader. It is not a drum and not darker. The coil hides it in C. |
| Keeper's flame 2.6 m, 1.1 m halo | **True, small effect** | A brighter pin-point at 145 m. Not the mockup's readable flame. |
| (not in the README's builder notes) ba3ebda26: the sand albedo ×0.8 at dusk 0 easing to 1 by 0.3, and the key's lit side 0.72 → 0.63 | **Undeclared in the notes** | It is listed in the commit list only. It explains the −8 to −11 across both aerials and the −2 to −8 on every dusk-0 ground (h1, h2, h4, first-frame). |

## Findings, ranked by score gained

1. **Put dusk-fire's sky back (dusk-fire; x 0.5–1, y 0.10–0.36).** *Regression.*
   - The banks added for A's right half landed in Jake's pick (17.5 % cover against 6.8 %; over-140 pixels 10 029
     against 3 183). They barely reached A (8.8 % against 23.6 %).
   - The two views share the camera, 8° apart. A sees bearings −18.6° to +18.6° and dusk-fire −10.6° to +26.6°.
   - dusk-fire's new bright banks sit at its x 0.75–1, which is bearing ≈ 17°–27°: almost entirely outside A's frame.
     The change was aimed at A but built where only Jake's pick sees it.
   - Fix: take the banks out of bearings 18°–27°, so dusk-fire's right is again one dark grey-brown streak.
   - Inside 0°–18.6°, both mockups see the same sky: A wants dense red banks, dusk-fire a plain amber sky. That is a
     mockup conflict for the lead to rule (like Sky Reach's round-8 cluster ruling), not one to settle by trial.
   - Restore the horizon gradient: its peak at the horizon (A's right half y 0.31–0.33 ≈ 140), and the upper band back
     down (A y 0.24–0.30 ≈ 103, dusk-fire ≈ 85).
   - Measure both views together every time.
2. **Remove or rebuild the near ridge (A and dusk-fire; x 0.6–1, y 0.46–0.56; both aerials).** *Regression, should-fix.*
   - It puts a lit face where both spawn mockups have their lee: dusk-fire's region error tripled (4.9 → 14.3), and A's
     right edge (x 0.9–1, y 0.53) rose from 50 and 47 to 65 and 68, against 32 and 33.
   - From above it is one more hard-edged dark blob (aerial-overview: a peanut joined to the old oval).
   - Fix: revert it. If a ridge stays, its spawn-facing side must be the one turned from the key, with the steep lee
     toward the camera. Check it from A, dusk-fire, h1 and both aerials before committing.
   - Don't place terrain by a frame's edge. The round-8 Sky Reach ruling already says so.
3. **Take the camera distance out of the `away` term (D, C, the whole late world; clip.mp4).** *Regression, should-fix
   (ledger 5, no narrowing).*
   - D's right half improved, but the late orbit fell from 27–31 to 7–24, with black stains and sharp-edged lit ovals.
   - The cause: a 70 % cut on direct light, from 12 m to 50 m around the camera, on flat ground and on any face with
     toGlow < 0.22. A face brightens as the player walks up to it. That is round 10's fade, back in a new form.
   - Fix: key the darkening on the facing alone, with a wide soft ramp (for example `smoothstep(-0.25, 0.35, toGlow)`),
     and a floor that keeps the clip's ground at or above its round-11 25.
   - Get D's left half (34 against 16) from form: a band of lee faces there, not from distance.
4. **Every dusk-keyed term monotonic (B, and every view between dusk 0 and 0.74).** *Repeated (R11 finding 5, moved).*
   - The sand's albedo now runs 0.8 at dusk 0, 1.0 at 0.3, **1.5 at 0.5** (B's staged value), 1.35 at 0.56, 1.12 at 0.62
     and 1.0 at 0.74.
   - Real sand doesn't brighten 50 % for the Sefa-to-logbook window and then darken back.
   - It bought B 0.7 luma and lifted B's far land away from the mockup.
   - Seat C's own round-11 fix line ("or reach B's sand through the near-sand material at that dusk") invited this.
     That wording was wrong.
   - Fix: the sand albedo constant over dusk. Any per-dusk change goes in a curve that only goes one way.
   - Get B's last 4 luma from its near ground's form, or accept the gap.
5. **Close A's gap by form, not by grade (A; x 0–1, y 0.36–0.86).** *Repeated since round 1.*
   - The ×0.8 dusk-0 albedo and the key cut moved A 78 → 70 by dimming everything. That cost dusk-fire 8 on a matched
     patch and darkened both aerials 8–11.
   - A's real gap is its light: the left lit (79–94 against 35–60), and the mockup's diagonal x 0.4–0.7, y 0.40–0.44
     (93–106) at 45–65.
   - Fix: revert ba3ebda26's ×0.8 (keep dusk-fire at its match). Address A's light where the mockups agree: the shade
     on the spawn's left slope at y 0.36–0.44.
6. **C: keep the size, put the core back (C; x 0.2–0.55, y 0.15–0.62).** *Repeated.*
   - The core is 45 % of the mockup's over 235 (r11 59 %). Fill the punched holes with a hot core rather than sky, and
     let charred logs show at the base.
   - Add the grey-brown billow up-left, and send the embers left (595 / 5 575 against 2 187 / 2 359).
   - The plinth needs real drum geometry, not a stone pattern on the cube.
   - The pool: 50.7 → about 40.
7. **The clipped low-sky band (h2 y ≈ 0.41, h4 y ≈ 0.35).** *Repeated; the fix claim is false.*
   - The stripe is dimmed under the test's red > 120 cut, at (78,17,1) and (96,23,1).
   - Fix: keep blue ≥ ~20 in the band term before tone mapping. Test with blue < 10 at any red.
8. **D's hand (D, every view; x 0.55–1, y 0.55–0.86).** *Repeated.*
   - The value moved the right way. The form is the gap: no fingers, seams or folds (fine 4.1 against 7.6).
   - Fix: normal-mapped knuckle folds and a seam, not crinkle and flecks. Raise the hold ~30 px so the fingers clear
     DODGE.
9. **B's smoke and tailboard (B; x 0.45–0.65, y 0.15–0.50).** *Repeated.*
   - Fix: a straight pale column rising from behind the wagon at x ≈ 0.53, with residual ≈ +13.
   - The tailboard desaturated toward 67,37,27 (blue up), not just darker.

## Ledger-5 audit

- **Views: no breach.**
  - The cameras blob is the same (a4219aa3), and camAt is identical for all 12 shots between r11 and r12.
  - The ridge's changed cells (x 7–30, z 28–50) hold no camera.
  - The README's "no camera changed" is correct.
- **The near ridge: real terrain, so no breach. Its placement is a should-fix (finding 2).**
  - Is it terrain added only inside one mock camera's frame? No.
    - It spans bearings 16°–45° from the spawn. A sees only its left end and dusk-fire sees more.
    - Both aerials show it, and it is walkable (steepest 28.7°) with the navmesh re-baked.
  - It is not a card, a decal or a cheat.
  - But its commit places it "in A's frame right of centre", which is placement by a frame. It did not achieve its aim,
    and it regressed Jake's pick.
- **The sand-albedo bell at dusk 0.5: should-fix, not void (finding 4).** The README asks seats to check it.
  - It is global, and keyed to quest state a player holds for minutes. Dusk eases at 0.02 per second, sits at 0.50 from
    Sefa's talk through the walk to the caravan, then reaches 0.52 (logbook) and 0.56 (oil). So B's frame is reachable,
    and the sand a player sees there is the sand in the shot.
  - But it is a material tuned to B's staged dusk value: a Gaussian centred exactly on what `stage('logbook')` snaps to,
    and narrower than the fill bump it replaced.
  - It makes the sand's reflectance non-monotonic over the evening.
  - It is the same shortcut shape the round-11 seats flagged, moved one term down.
  - I don't void it: it is real play state and changed B's measurement by only 0.7. But I recommend the lead rule that no
    look term may peak at a staged dusk value.
- **The `away` term: should-fix, borderline narrowing (finding 3).**
  - D's late land improved, and the same term regressed the late world elsewhere: the clip's ground went 27–31 → 7–24,
    with hard-edged black blotches.
  - It is camera-distance gated (12–50 m), which round 10's seats ruled a should-fix in its earlier form, and the
    precedent holds. So I don't void D.
  - But D's 6.7 counts only the gain on the right, where the mockup's dark bands now read.
- **The spawn grade (ba3ebda26): no breach; a disclosure gap.**
  - Global and monotonic: the sand albedo ×0.8 at dusk 0 easing to 1 by 0.3, and the key ×0.63.
  - It is not in the README's builder notes, though it is in the commit list.
  - It is a global grade that trades one mockup against the other rather than fixing A's form (finding 5).
- **Staged state: unchanged and reachable.**
  - `stage()` and `duskOf` are unchanged at c83fb063. `meta.staged` holds the same three entries.
  - The round 9–11 reachability analysis holds: logbook at 0.50; waymarks-lit settling from 0.74.
  - Only the look at those values changed (the bell).
- **Global look: no per-view switches.** Sky, banks, sand, ridge, fire, glove, tailboard and plinth are all shard-wide.
  No debug-only state shows in any frame.
- **No narrowing:**
  - The clip regressed (above).
  - Both aerials are 8–11 darker, and the ridge adds a dark blob there.
  - h2 keeps its clipped red stripe.
  - h3's plinth carries the new pattern, with no form change.
  - h1 and first-frame carry the inverted sky gradient.
  - h4 is darker on the ground (−4 to −10) and keeps a 2.7 % clipped band.
- **Device and HUD: no breach.**
  - 390×844 touch, stored 780 wide, with the baseline HUD in every scored frame.
  - The 30 fps chip shows; `pageErrors: []`; `active: []`; 59 programs, unchanged.
  - c83fb0632 trimmed embers to stay under the gpuMB ceiling.
  - Frame time and total memory are not on this surface: unverified, not breached.

SCORE signal-dunes: 6.7

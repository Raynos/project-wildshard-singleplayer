# Round 9, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

Surface: the "Signal Dunes, round 9" section of `art/mockup-council/round-9/README.md` and its five `sunscar-dunes-*.jpg`
sheets; the full-res frames in `progress/sunscar-dunes/20261003-0356-544f6b56/` (every `mock-*`, h1–h4, both aerials,
`clip.mp4` at 0.5 fps, `meta.json`); round 8's `20261003-0322-0cd1ecbb/` for before/after; the five ledger mockups,
Lanczos-scaled to 780×1688. Source checks: `git diff 0cd1ecbb 544f6b56 -- src/shards/sunscar-dunes/
art/sunscar-dunes/progress/cameras.json`, and both captured terrain bakes (`git show <sha>:public/assets/baked/sunscar-dunes/terrain.bin`,
256², 500 m), sampled with the engine's bilinear `heightAt`. All brightness is Rec. 709 luma (0.2126 R + 0.7152 G +
0.0722 B) on decoded JPEGs. Fine detail is mean |luma − luma blurred at σ 2 px|. Macro structure is the Pearson r of
luma blurred at σ 12 px, mockup against game, over a named band. Regions are fractions of the frame (x left → right,
y top → bottom) or 780-px pixel boxes.

## Is measure.py fair this round?

**Still no.** Its ROI is rows 60–86 %, x 0–40 % (x 0–312 at 780 px). The r9 coil's left arc runs at x ≈ 200–215 from
y ≈ 1000 to 1250 in every view, and Sefa's legs in A reach y ≈ 1080, so both are inside it. The tool is unchanged since
551e484de (R8B-11 is open). On this capture it puts A at 64.9 against 58.3, a gap of 6.6. On the coil-free patch the gap
is 13.0 (68.6 against 55.6). Every verdict below uses the seats' **clean patch x 10–180, y 1150–1450**. I drew it on all
15 frames, and it is clear of the coil, Sefa and the HUD in each one.

## Measurements (mockup / r8 / r9)

| View | Clean sand mean (p50) | p5–p95 (spread) | p99 | Fine | RGB |
|---|---|---|---|---|---|
| dusk-fire | 73.4 (71) / 71.7 (77) / **64.9 (67)** | 42–112 (70) / 26–100 (74) / **24–98 (74)** | 130 / 109 / **109** | 9.4 / 9.1 / **10.9** | 110,66,40 / 107,64,40 / **100,58,33** |
| A spawn | 55.6 (53) / 73.3 (77) / **68.6 (71)** | 18–95 (77) / 25–107 (82) / **25–103 (79)** | 117 / 117 / **114** | 9.3 / 12.7 / **11.9** | 83,49,36 / 108,66,42 / **104,61,36** |
| B logbook | 38.9 / 40.1 / **40.2** | 27–50 (23) / 25–53 (28) / **22–56 (35)** | 55 / 59 / **62** | 2.3 / 3.3 / **3.7** | 60,34,28 / 63,34,29 / **60,35,31** |
| C waymark | 32.2 / 41.4 / **41.9** | 23–39 (16) / 27–58 (31) / **24–55 (32)** | 47 / 63 / **61** | 0.7 / 1.6 / **1.6** | 51,27,23 / 66,35,30 / **66,36,30** |
| D hands | 34.6 / 38.3 / **38.2** | 17–49 (32) / 23–50 (26) / **26–50 (24)** | 56 / 54 / **53** | 0.9 / 1.7 / **1.6** | 50,31,28 / 57,33,31 / **57,33,30** |

**Macro structure** (r, and mean |difference| of σ-12 luma), r8 → r9:

| View | Band | r8 | r9 |
|---|---|---|---|
| dusk-fire | 0–1 × 0.36–0.58 | −0.29 / 31.0 | **+0.08 / 18.9** |
| A | 0–1 × 0.34–0.58 | +0.30 / 27.9 | **+0.18 / 25.3** |
| C (backdrop) | 0–0.25 × 0.30–0.50 | +0.32 / 31.2 | **+0.60 / 13.4** |
| D (land) | 0–0.3 × 0.50–0.66 | +0.16 / 46.5 | **+0.33 / 31.1** |
| B (sky) | 0–1 × 0.10–0.40 | +0.92 / 4.6 | +0.92 / 5.1 |

**Dune band, 10-column grid** (each cell 0.1 wide, 0.02 tall; luma):
- **A, mockup:** the diagonal lit crests read 83–107 at x 0.3–0.7, y 0.38–0.46, beside shade at 28–47. The left
  (x 0–0.3) is shade at y 0.38–0.48 and lit only on the near crest at y 0.50–0.56 (81–106).
- **A, r9:** at x 0.4–0.8, y 0.38–0.46 it reads **29–35**, still all shade. The lit cells moved to the **left**: 57–74 at
  x 0–0.3, y 0.38–0.48, exactly where the mockup is in shade. That is why r drops from 0.30 to 0.18.
- **dusk-fire, mockup:** the lit left shoulder is 71–92 at x 0–0.3, y 0.42–0.56, and the lower right is in shade at 41–48
  (x 0.5–1, y 0.50–0.56).
- **dusk-fire, r9:** the left shoulder is 35–70 (lit only from y 0.50), and the lower right is **44–70, lit**. The dome's
  centre is in shade at 29–33, like the mockup's 28–30. The mound's breadth is now right.
- **Aerial-spawn, r9:** the tower dune's shade is a soft-edged dark tongue with a blurred border that follows no crest. A
  separate dark blob floats on lit sand at x 0.37–0.47, y 0.20–0.23. The shade is still a blurred cast-shadow shape,
  where the mockups have knife-edge crest lines.

**Horizon and sky:**
- **Horizon** (row-profile drop):

  | View | Mockup | r8 | r9 |
  |---|---|---|---|
  | dusk-fire | ≈ 0.335 | ≈ 0.375 | **≈ 0.35** |
  | A | 0.34 | | ≈ 0.355 |
  | C | 0.46 | dune face at 0.43 | **0.47** |
  | D | 0.505 | | **≈ 0.50** |

- **A's band** at y 0.28–0.34 (x 0.03–0.38): mockup 106 at (172,91,66); r8 164 at (229,151,96); **r9 111 at
  (183,95,54)**. The pixels over Y 140 in y 0.12–0.40 are 21.6 k / 71.5 k / **1.7 k**: the r8 overshoot is gone, and
  now it undershoots.
- **A's glow by fifths** (y 0.31–0.34): the mockup rises to the right, 103 / 118 / 114 / 148 / 162. **r9 is flat:
  114 / 122 / 120 / 123 / 123.** The claimed "afterglow right of the tower" does not show as a peak.
- **The upper sky at y 0.10** (x 20–300): A's mockup reads 28 at (24,27,54), and **r9 30 at (33,27,56)**. Matched (r8:
  46).
- **C and D, the y 0.10 row:**

  | View | Mockup | r8 | r9 |
  |---|---|---|---|
  | C | 33 at (37,30,51) | 23 at (4,22,90) | **36 at (31,34,76)** |
  | D | 24 at (18,22,58) | 22 at (1,21,93) | **35 at (28,32,79)** |

  The red channel is back: D's zenith-box R minimum is 0 → 27. D's sky box (40,300)–(540,600) is 49.9 against 50.0.
- **Cloud contrast** (residual sd after removing each row's mean, σ 1.5, y 0.22–0.33):

  | Region | Mockup | r9 |
  |---|---|---|
  | A, right half | 17.2 (12.2 % of pixels > +15) | **5.7 (0.4 %)** |
  | dusk-fire, right half | 8.2 | **8.4** (matched) |

- **Land under the horizon** (luma, mockup / r9):
  - B, x 0–160, y 0.455–0.475: 33–67 / **67–99**. The afterglow peak (x 560–700) is 157 / **100**, flat.
  - C, y 0.47–0.52: 15 / **38–54**.
  - D, y 0.51–0.55: 13–19 / **47–74**. The afterglow peak is 161 / **112**.
  - A and dusk-fire ranges, y 0.35–0.36: 65 and 45 / **100 and 98**.

**Subjects:**
- **C flame**, box x 150–450, y 350–900:

  | | Mockup | r8 | r9 |
  |---|---|---|---|
  | Pixels over Y 150 | 13 733 | 7 662 | **15 884** |
  | Their mean | 213 | 181 | **180** |
  | Saturated orange | 8 441 | 7 202 | **12 786** |
  | White-hot (Y > 230) | 5 557 | 556 | **730** |

  The flame is about **1.5× the bowl's width** (225 px against a 150 px bowl); the mockup's is about 1.0× (135 against
  140). At 1:1 it is a smooth, soft-edged peach mass with no visible logs.
- **C embers:** warm specks in x 0–330, y 150–560 (up-left): mockup 3 294 at (154,85,62), r8 131, **r9 868 at
  (174,109,58)**. Up-right (x 330–780): 1 416 / 1 939 / **2 271**.
- **C plume** (the near fire's column, x 340–420, y 60–230): **(61,58,83), 18 over the sky beside it**. The mockup's
  smoke is (60,41,55), 7 over its sky: warm brown, where ours is pale blue-grey.
- **C pool** (x 150–450, y 1060–1150): 40 at (69,34,23) / 64 / **59 at (95,51,35)**.
- **C post** (the shaft under the bowl): mockup (57,25,17), R/G 2.3; **r9 (40,5,1), R/G 8.4**, darker but a saturated
  red-copper, not soot.
- **B lantern:**

  | | Position | Max | Pixels > 150 | Pixels > 200 |
  |---|---|---|---|---|
  | Mockup | x 0.522 | 252 | 395 | 199 |
  | r9 | **x 0.513** | 183 | 105 | 0 |

  The wagon spans x 0.44–0.69 against the mockup's 0.42–0.68. The wagon front (x 0.45–0.60, y 0.41–0.47) is 69 against
  58, and the cargo (x 0.12–0.30, y 0.49–0.53) 57 against 44.
- **The coil, D's left arc** (mockup box (440,1050)–(520,1300); r9 (200,1000)–(290,1250)): p50 32 / **38**, sd 20.4 /
  **15.8**, p99 103 / **51**.
  - On scanlines the r9 cord is ≈ 12–16 px wide (r8 24–28).
  - The cord's darkest values are 1–9, with no crown highlight above 51.
  - The loops span **x 0.27–0.65**, against the mockup's 0.57–0.81.
- **D glove back** (mockup (590,1090)–(700,1190); game (500,1110)–(640,1200)): p95 92 / 46 / **44**, p99 124 / 55 /
  **55**, fine 9.7 / 2.8 / **2.4** (mockup / r8 / r9).
- **The keeper's lamp** (dusk-fire): the mockup has an open orange flame (max 253, 64 px > 150). **r9 has a pale lantern
  box (232, 40 px)** and no flame.
- **dusk-fire's tower** stands at **x 0.31** against the mockup's **0.38**. A's tower is at 0.58 against 0.57.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.0** | 1. **The light on the land (x 0–1, y 0.40–0.58).** The broad low mound and its shaded centre now match (macro r −0.29 → +0.08, mean diff 31 → 19). The mockup's lit left shoulder is still missing (x 0–0.3 at 35–70 against 71–92). Where the mockup's shade sweeps to the lower right (41–48), the game is lit (44–70). The shade's edge is a soft blob, not a line. 2. **Sky and subjects (y 0.10–0.36).** The horizon is at 0.35 against 0.335, the hot band is gone (2.8 k pixels over Y 140 against 7.1 k; r8 66 k), and the right-hand bank's contrast matches (8.4 against 8.2). Still different: the clouds are smooth soft lozenges, not textured grey-brown banks. There is no ray in flight. The keeper's lamp is a pale box, not a flame. The tower sits 0.07 left of the mockup's. 3. **Foreground (y 0.55–0.86).** The near sand moved away: 64.9 against 73.4 (r8 71.7), and its fine detail now overshoots (10.9 against 9.4; r8 matched at 9.1). The coil is two tall upright loops, where the mockup has one slim diagonal loop held low. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.0** | 1. **The landform (x 0–1, y 0.36–0.50).** It is still one mound and no receding knife-edge crests. The WNW key now lights the mound's **left** half (57–74) where the mockup is in shade (28–47), and leaves the mockup's lit diagonals (x 0.3–0.7, 83–107) in shade (29–35). Macro r fell from 0.30 to 0.18. 2. **Sky (y 0.10–0.34).** A real gain: the band is 111 at (183,95,54) against 106 at (172,91,66), and the upper sky is 30 against 28. But the glow is flat across the width (114–123) where the mockup's rises to 162 right of the tower. The banks are sparse soft puffs: the right half's cloud contrast is 5.7 against 17.2. The pale ranges are 100 against 65. 3. **Near sand and coil (y 0.60–0.86).** The sand is closer (68.6 against 55.6; r8 73.3), but the grain still overshoots (fine 11.9 against 9.3). The coil is two tall upright loops at x 0.27–0.65, where the mockup has two big rings rising from the bottom edge. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.0** | 1. **The camp's light (x 0.12–0.70, y 0.40–0.55).** The framing now matches (lantern at x 0.513 against 0.522, wagon at 0.44–0.69 against 0.42–0.68). But the lantern is a dim pale box (max 183, 105 px over 150, no halo) where the mockup's blazes (252, 395 px). The hood's front glows evenly (69 against 58), and the cargo is lighter slabs with no planks or sacks (57 against 44). 2. **The horizon (y 0.42–0.48).** Pale lavender ranges and haze sit where the mockup has near-black dune silhouettes: 67–99 against 33–67 at the left. The afterglow line is flat and dim (100 against a 157 peak). The smoke is a thin straight pale column, not the mockup's widening plume. 3. **Sand and coil.** The sky (47 against 50; zenith (22,25,66) against (22,28,67)) and the sand mean (40.2 against 38.9) match. The sand's spread grew (35 against 23; r8 28). The coil is two tall loops at the left, where the mockup's two big rings enter from the bottom right. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.5** | 1. **The fire (x 0.22–0.52, y 0.28–0.50).** It is now bigger than the mockup's (15.9 k pixels over Y 150 against 13.7 k) and more saturated (12.8 k against 8.4 k). But it is a smooth soft peach mass 1.5× the bowl's width, with no visible logs and 13 % of the white-hot core (730 against 5 557). Its bright pixels' mean is 180 against 213. The mockup's flame is crisp tongues, as wide as the bowl. 2. **The backdrop: fixed (x 0–0.45, y 0.30–0.50).** The rise opens the sky behind the bowl: the horizon is at 0.47 against 0.46, the backdrop 64.5 against 73.6 (r8 38), and macro r went from 0.32 to 0.60. Left: the land under the horizon is 38–54 against 15, and a dune shoulder still rises at the left edge. 3. **Smoke, embers, brazier and sand.** The plume is pale blue-grey (61,58,83) where the mockup's is warm brown (60,41,55). The embers are now orange (174,109,58), but most drift right (2 271 against 868 up-left; mockup 1 416 / 3 294). The post is saturated red-copper (R/G 8.4 against 2.3). The near sand is unchanged at 41.9 against 32.2, and the pool is 59 against 40. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.5** | 1. **The land (x 0–1, y 0.50–0.86).** The haze band fell (r8 131 → now 74 at y 0.51), and macro r rose from 0.16 to 0.33. But the land is still 2.5–4× the mockup's value (47–74 against 13–19 under the horizon), with no long dark bands and no bright stripes (the mockup has 28 / 31 / 65 at y 0.57 / 0.63 / 0.64). The afterglow peak is 112 against 161. 2. **The hero hand (x 0.25–1, y 0.55–0.86).** The cord is now slim (≈ 12–16 px). But it is near-black with no crown sheen (arc p99 51 against 103), in two upright ellipses at x 0.27–0.65 where the mockup's slim loops hang beside the fist at 0.57–0.81. The glove did not change: fine 2.4 against 9.7, p99 55 against 124. 3. **The sky: fixed.** The zenith has its red back (R 27–30, sky box 49.9 against 50.0), and the horizon is at 0.50 against 0.505 with the tower at x 0.84. A little bright at y 0.10 (35 against 24). The far waymark's fire now shows mid-left, where the mockup has a small fire at the far left. |

**Seat score, Signal Dunes: (7.0 + 6.0 + 7.0 + 6.5 + 6.5) / 5 = 6.6.** Earlier rounds from this seat: 4.8, 5.3, 5.3,
5.4, 5.7, 5.5, 5.7, 6.1.

This round clears most of round 8's regressions:
- **Fixed:** the hot yellow band (A, dusk-fire), the R = 0 zenith (C, D), B's wrong-way yaw and the dusk running
  backwards.
- **Real gains:** C's open backdrop and dusk-fire's broad mound.
- **Still open:** the forms of A and dusk-fire's light (the knife-edge crests), the far land's value under every dusk
  horizon, the fire's finish, the coil's and the glove's finish.

## The builder's claims checked against the pixels and the code

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| B yaw 48.3 → 56.7 puts the lantern at ≈ 0.5 (mockup 0.52) | **True** | Lantern x 0.513, wagon 0.44–0.69 against 0.42–0.68. camAt dir (−0.746, −0.664) → (−0.835, −0.548). |
| dusk-fire pitch −10 → −12.5: the horizon 0.39 → ≈ 0.35 (mockup 0.345) | **True** | Row-profile drop at 0.35 (r8 0.375); the mockup's at 0.335–0.34. The yaw is unchanged, and the tower stays 0.07 left of the mockup's (finding 8). |
| D pitch 0 → −2: the horizon ≈ 0.51 | **True** | ≈ 0.50 against 0.505. |
| C's camera rose 9.67 m with the waymark's rise; the backdrop dunes now 0–1° over the eye (were 9–13°) | **Mostly true** | Captured bake: ground under the camera 1.18 → 10.85 m (eye 12.55, matches camAt), the brazier's ground 0.79 → 10.79. Line of sight from the eye: +1.3° on the axis and +1.0° at 15° to one side, but **+4.5° at 15° to the other**, the dune shoulder at the frame's left edge. r8 was 8.6–14.5°. |
| Tower dune: lift 13 over 58 m → 9 over 75 m | **True** | The tower's ground is 18.61 → 15.70 m. The play square's steepest cell is 33.0° (r8 37.9°), and none is over 40°. The waymark rise's steepest within 50 m is 21.7°. I can't verify walk "0 stuck" from this surface. |
| The dusk is monotonic: Sefa 0.50, logbook 0.52, oil 0.56, waymarks 0.62 / 0.74 / 0.86 | **True** | `duskOf` at 544f6b56. R8B-9 is fixed. |
| Key from the WNW at 2.3: "A 58 / mockup 56, dusk-fire 54 / mockup 72 at 2.0, so 2.3 splits" | **The split holds; the pre-numbers are not on this surface** | At 2.3 on the clean patch: A 68.6 against 55.6 (+13.0), dusk-fire 64.9 against 73.4 (−8.5). It is roughly a split. The 2.0 numbers came from a build that was not captured. The light's *direction* is the bigger miss: it lights A's left, which the mockup has in shade (grid above). |
| Grain a quarter less ("fine 12.6 against the mockups' 9") | **Partly** | A 12.7 → 11.9 (target 9.3). dusk-fire **rose**, 9.1 → 10.9 (target 9.4): the WNW key grazes its ripples harder. |
| Clouds as low horizontal banks, the right one heavier | **Form: true. Coverage: short for A** | Horizontal, and dusk-fire's right bank matches (8.4 against 8.2). A's right is 5.7 against 17.2: the mockup's banks run 5–17° up, and the new cap (h < 0.13–0.2) cuts them. |
| The afterglow right of the tower (SUN_GLOW x −0.3 → +0.12) | **Not visible** | A's fifths are flat (114–123); the mockup rises 103 → 162. r8 peaked left (169). It is now level, not right. |
| The sky measured band by band | **True** | A's band 111 against 106, upper sky 30 against 28. C and D's zenith red is restored. B's sky is held (47 against 50). |
| The flame premultiplied, taller (3.6 m), a larger core | **Size and saturation: true. Core and finish: no** | Bright area 116 % and saturated orange 151 % of the mockup's; white-hot 13 %, bright mean 180 against 213, 1.5× the bowl's width, soft-edged. |
| Embers along their own motion; orange | **True** | Orange (174,109,58) against (154,85,62), r8 (215,165,68). Their drift still follows the world wind, to the right (seat C r8: leave the wind). |
| A dark plume | **No** | The near fire's column is (61,58,83), 18 over the sky. The mockup's is warm brown, 7 over. |
| Soot on the braziers (`brazier-hd` greyed) | **No** | The post is (40,5,1), R/G 8.4 against the mockup's 2.3: darker, but more saturated red. |
| The fire's sand light 0.3 → 0.18 | **Small** | The pool fell 64 → 59 (target 40). The clean patch is unchanged (41.4 → 41.9 against 32.2), so its excess is not the fire light. |
| Coil: cord 0.048 → 0.03, taller loops, a sheen on each crown | **Cord and loops: true. Sheen: no** | The cord is ≈ 12–16 px (r8 24–28). Arc p99 51 (r8 56) against 103. |
| Glove creases (a ~3 cm octave, bump 0.0035 → 0.0055) | **No measurable change** | Fine 2.8 → 2.4, p99 55 → 55, against 9.7 / 124. |
| Crisp stars; a halo on the lamp | **Stars: yes, visibly larger and brighter in B, C, D. Lamp halo: no** | B's lantern is max 183 with no pixel over 200 and no halo ring. The tower lamp is a pale box (max 232). |
| "Commits touching staging code: none" | **True, and disclosed** | `stage()` is unchanged. The README names the `duskOf` table change and the dusk each stage reaches. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R9B-1 | A, dusk-fire | must-fix | **repeated** (R8B-1; the direction change moved A's lit cells to the wrong side) | A x 0–1, y 0.36–0.50; dusk-fire x 0–0.4, y 0.40–0.56 and x 0.5–1, y 0.50–0.56 | **Make the light/shade line a crest line.** Both mockups' forms are sharp-crested dunes whose terminator is the crest itself: A's diagonal lit faces at x 0.3–0.7 (83–107) beside shade at 28–47; dusk-fire's lit left shoulder (71–92) and its shade sweeping to the lower right (41–48). The game's shade is a soft-edged cast-shadow blob (aerial-spawn: the tongue on the tower dune and a dark patch floating on lit sand at x 0.37–0.47, y 0.20–0.23). Fix: (a) give the dunes between the spawn and the tower an asymmetric profile with a sharp crest (the dune phase in `dunes.ts`, globally; re-bake, walk 0 stuck), so N·L switches at the crest; (b) let N·L, not the blurred shadow map, carry the dune terminator, so the shade edges are lines. Then turn the key until A's x 0.3–0.7, y 0.38–0.46 cells read ≥ 85 and its x 0–0.3, y 0.38–0.48 cells ≤ 50, while dusk-fire's x 0–0.3, y 0.42–0.56 reads ≥ 70. Check macro r ≥ 0.5 on both bands. |
| R9B-2 | B, C, D (also A, dusk-fire ranges) | should-fix | **new** as a cross-view finding (D's part repeats R8B-6) | B x 0–0.2, y 0.455–0.475; C y 0.47–0.52; D y 0.51–0.55; A and dusk-fire y 0.35–0.36 | **The far land under every dusk horizon is too bright, and the glow line above it too dim.** Mockup / r9: B 33–67 / 67–99; C 15 / 38–54; D 13–19 / 47–74; the A and dusk-fire ranges 65 and 45 / 100 and 98. The afterglow peak is B 157 / 100 and D 161 / 112. All five mockups put a near-black land silhouette under a bright thin glow line. Fix: scale the far dunes' and the ranges' aerial-perspective lift down with `uDusk` (toward none at ≥ 0.5), darken the range rings' colour at dusk 0, and add a narrow bright term in the last ~1° of the band over the horizon. Check D y 0.51–0.55 ≤ 25 and its peak ≥ 145. |
| R9B-3 | C | should-fix | **repeated** (R8B-7; size fixed, finish not) | x 0.22–0.52, y 0.28–0.50 | **The fire's finish, not its size.** It is big enough (15.9 k over Y 150 against 13.7 k), but it is 1.5× the bowl's width and soft. Take the flame quad's width back (`size.flame * 0.78` → ≈ 0.6) and keep the height. Tighten the body edge (`smoothstep(0.82, 0.98, …)`) and let noise tear it into separate tongues. Push the core to near-white over visible log ends. Check: pixels over Y 230 from 730 toward 5 000, and bright-pixel mean from 180 toward 210. |
| R9B-4 | D (hero), all views | should-fix | **repeated** (R8B-5; the cord fixed, sheen and glove not) | the coil x 0.25–0.65, y 0.55–0.86; the glove x 0.6–0.8, y 0.64–0.72 | The roughness change made no highlight (arc p99 51 against 103), and the crease octave did not register (glove fine 2.4 against 9.7, p99 55 against 124). Both need light or albedo, not micro-normals: (a) lift the plait's crown albedo toward the mockup's copper-brown (crown luma 90–130), so the viewer light has something to catch; (b) give the glove worn lighter panel edges, seams and knuckle folds in the albedo and normal at hand scale (p95 toward 90). Move the coil toward the fist (mockup D: loops at x 0.57–0.81) within the one common hold. |
| R9B-5 | A (dusk-fire shares the sky) | should-fix | **new** (the r8 fix overshot to flat) | A y 0.12–0.34, x 0.55–1 | **The glow and the banks for A.** The glow is flat by fifths (114–123) where the mockup's rises to 148–162 right of the tower. Pixels over Y 140 are 1.7 k against 21.6 k. Sharpen `pow(toward, …)` and move `SUN_GLOW` further right so the hot spot sits at x ≈ 0.8 in A. The right-hand banks need to reach ~15° up (the cover cap `1 - smoothstep(0.13, 0.2, h)` cuts them at ~8–11°), denser: right-half cloud contrast 5.7 → toward 17. Keep dusk-fire's left clear; both mockups have the right-hand bank, so this does not cost dusk-fire. |
| R9B-6 | A, dusk-fire | should-fix (the mean is partly settled by the mockups' conflict) | **repeated** (R8B-8; dusk-fire moved away) | x 0–0.25, y 0.68–0.86 | **Near sand.** A is 68.6 against 55.6 and dusk-fire 64.9 against 73.4: the 17-point conflict between the mockups stands (settled). The fine detail is not settled: it overshoots in both now (11.9 and 10.9 against 9.3 and 9.4), and dusk-fire's rose under the WNW key. Cut the ripple-normal amplitude near the camera (the `sandW` / `rippleTilt` term), not the grain again, until both read ≈ 9.5. Restore the bright pinpoint glints (p99 109 against 130). |
| R9B-7 | C | should-fix | **repeated** (R8B-10, R8 seat C 4) | plume x 0.43–0.55, y 0–0.15; embers x 0–0.45, y 0.1–0.35; post x 0.36–0.39, y 0.49–0.55; sand x 0–0.25, y 0.68–0.86 | (a) The near plume is pale blue-grey (61,58,83), 18 over the sky. Make it the mockup's warm brown (60,41,55), only ~7 over the sky. The current dark `smokeMaterial` colour is not what reaches the frame, so check the blend. (b) The post is red-copper (R/G 8.4 against 2.3): desaturate it toward grey-brown iron, not just darker. (c) The near sand is 41.9 against 32.2, and the fire-light cut did not move it. Its excess is the late-dusk sky light (D 38 against 35, B 40 against 39). Lower the sand's ambient at dusk ≥ 0.75, and take the pool from 59 to ~40. |
| R9B-8 | dusk-fire | should-fix (a re-aim toward the mockup) | **new** | the tower x 0.25–0.40, y 0.26–0.36 | **Yaw.** The tower is at x 0.31 against the mockup's 0.38, with A's at 0.58 against 0.57. With a 37° horizontal field, a yaw of about −8 (from −10) puts it at 0.38. Name it in the capture notes. The keeper's lamp is a pale box (max 232, 40 px) where the mockup has an open orange flame (253, 64 px): show the flame (`KEEPER_LAMP`) above the box. |
| R9B-9 | B | should-fix | **repeated** (R8 seats A 5 and C 2) | x 0.45–0.60, y 0.40–0.53 | **The lantern and the camp.** The lantern peaks at 183 with no pixel over 200 and no halo; the mockup's peaks at 252, with 199 px over 200 and a glow on the tailboard. The new `lampGlowMaterial` does not show at this lantern. The hood's front is lit evenly at 69 against 58, and the cargo is 57 against 44 with no planks or sacks. Put the lantern's gain into a halo and a falloff on the tailboard and the crates, and take the hood's even front glow down. |
| R9B-10 | process | should-fix | **repeated** (R8B-11) and **new** | measure.py; the README | (a) measure.py's ROI still holds the coil and Sefa: A's gap reads 6.6 against 13.0 on the clean patch. Limit it to x 0–23 %, y 68–86 %. (b) The README's real-camera list covers only `mock-*`. `h4-tower-deck`'s real camera dropped 2.91 m (27.35 → 24.44) with the lower tower dune, and the list doesn't say so. It is a hero view, so this is not a ledger breach, but h1–h4 are the no-narrowing check. List every shot's camAt move. |

## No-shortcut check (ledger 5)

- **Views:**
  - B's re-aim now matches better (lantern 0.29 → 0.513 against 0.522). The r8 breach is fixed.
  - dusk-fire's pitch (horizon 0.375 → 0.35 against 0.335) and D's pitch (0.50 against 0.505) both move toward their
    mockups.
  - camAt confirms that only B, dusk-fire and D were re-aimed, and that only C's position moved (+9.67 m with the
    ground). h4 also dropped 2.91 m through the terrain change; it is not a mockup view (R9B-10).
- **C's rise is real, walkable terrain, not a camera dodge.**
  - The west waymark's pad is lifted 10 m in `PADS`, globally, so the brazier and its quest spot moved up with it.
  - In the captured bake, the steepest cell within 50 m is 21.7° and the play square's is 33.0°, against the 40°
    climb.
  - The camera stands on the eased rise, 11 m from the brazier, at the ground +1.7 m.
  - It changes how the place looks for every player (the README notes the re-bake and the climb test). It hides nothing
    worse: the backdrop it opens is the mockup's.
- **Staged state** (stage code unchanged; dusk table changed and disclosed):
  - B, `logbook`: Sefa's flag only, the dusk snapped to 0.50. A player who meets Sefa and waits at the caravan reaches
    it, and reading the logbook now goes to 0.52, never back.
  - C, `waymarks-lit`: two braziers lit, then 0.74, then the last one through its handlers. The shot is taken 3 s later
    at ≈ 0.80, with fresh toasts. Since the quest takes the braziers in any order, a player who lights the near one last
    sees this.
  - D: 11 s, settled at 0.86, no toasts. Reachable.
  - `meta.json.staged` lists all three.
- **Frozen poses and effects:** there are none. The hand is in one idle hold, and C keeps its flame, embers, plume and
  pool.
- **Global look:** the key, sky, clouds, grain, fire, coil, glove and lamps are in shared shaders and builders. h1–h4,
  both aerials and the clip carry them; the clip's late-dusk orbit shows all three waymarks lit. Nothing is per-view.
- **Painted stand-ins:** none in the playable area. The lamp halo is a glow quad on a real lamp mesh, and the ranges and
  clouds are at infinity.
- **Device and HUD:** 390×844 phone and touch, stored 780 wide; the baseline HUD in every view; a 30 fps chip; `active:
  []`; `pageErrors: []`. This surface has no frame-time or total-memory trace, so those budgets are unverified here, not
  breached.

No breach this round.

SCORE signal-dunes: 6.6

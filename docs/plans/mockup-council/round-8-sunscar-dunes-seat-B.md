# Round 8, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

Surface: `art/mockup-council/round-8/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0322-0cd1ecbb/` (780×1688: every `mock-*`, h1–h4, both aerials,
`clip.mp4` sampled at 0.5 fps, `meta.json`); round 7's `20261003-0156-eeee0e02/` for before/after; the five ledger mockups
at full resolution, Lanczos-scaled to 780×1688. Source checks: `git diff eeee0e02 0cd1ecbb -- src/shards/sunscar-dunes/
art/sunscar-dunes/progress/cameras.json` (commits 551e484de, 4c79afef0, fd2ad32c0, c36bd9425, 96c73ea36) and the captured
terrain bake (`git show 0cd1ecbb:public/assets/baked/sunscar-dunes/terrain.bin`, 256², 500 m). All brightness is Rec. 709
luma (0.2126 R + 0.7152 G + 0.0722 B) on decoded JPEGs; fine detail = mean |luma − luma blurred at σ 2 px|. Regions are
fractions of the frame (x left → right, y top → bottom) or 780-px pixel boxes. Per-dimension marks: composition (Comp),
forms (Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands / weapon / HUD (Hands).

## Is the builder's tool fair? (`art/sunscar-dunes/round-21-council-tools/measure.py`)

**No, not in round 8.** Its near-sand ROI is rows 60–86 %, columns 0–40 % (x 0–312 at 780 px). Round 8's coil is larger
and sits further left. Its left arc reaches x ≈ 200 in every view, so the ROI holds the coil's arc in all five game
frames, and Sefa's legs in A (x 102–210, down to y ≈ 1092). It also holds part of the mockup coils in dusk-fire, A and C.
I checked this by drawing the ROI on all 15 frames. The coil drags the means down and adds braid edges to "fine":

| View | measure.py ROI, r8: mean / p5–p95 / fine | same rows, x 0–180 (coil-free), r8 | mockup, x 0–180 |
|---|---|---|---|
| dusk-fire | 64.9 / 4–97 / 7.4 | **74.4** / 29–98 / 7.2 | 76.1 / 44–111 / 9.1 |
| A spawn | 67.2 / 4–104 / 9.6 | **77.2** / 26–106 / 9.7 | 59.4 / 24–96 / 8.7 |

So the tool's "A sand mean 67.3 vs mockup 58.3" makes A's gap half of what it is: coil-free, it is 77 vs 59. Below,
every verdict uses the **clean patch x 10–180, y 1150–1450**. That is the rounds 5–7 patch (x 10–240), narrowed because
the r8 coil now reaches x 200–240 in it. The 10–240 numbers are in my scratch output too, and they differ by ≤ 3.

## Measurements (mockup / r7 / r8)

| View | Clean sand luma (p50) | p5–p95 (spread) | p99 | Fine detail | Clean sand RGB |
|---|---|---|---|---|---|
| dusk-fire | 73.4 (71) / 75.0 (78) / **71.7 (77)** | 42–112 (70) / 45–95 (49) / **26–100 (74)** | 130 / 100 / **109** | 9.5 / 4.1 / **9.2** | 110,66,40 / 116,66,37 / 107,64,40 |
| A spawn | 55.6 (53) / 76.5 (78) / **73.3 (77)** | 18–95 (77) / 51–97 (46) / **25–107 (82)** | 117 / 102 / **117** | 9.3 / 3.9 / **12.9** | 83,49,36 / 117,68,39 / 108,66,42 |
| B logbook | 38.9 / 46.2 / **40.1** | 27–50 (23) / 22–65 (43) / **25–53 (28)** | 55 / 72 / **59** | 2.3 / 4.7 / **3.3** | 60,34,28 / 71,40,33 / 63,34,29 |
| C waymark | 32.2 / 17.8 / **41.4** | 23–39 (16) / 7–33 (26) / **27–58 (31)** | 47 / 37 / **63** | 0.6 / 1.4 / **1.6** | 51,27,23 / 34,13,17 / 66,35,30 |
| D hands | 34.6 / 30.9 / **38.3** | 17–49 (32) / 16–41 (25) / **23–50 (26)** | 56 / 44 / **54** | 0.8 / 1.1 / **1.7** | 50,31,28 / 50,26,27 / 57,33,31 |

Named regions:
- **Dune band, 10-column grid** (each cell is 0.1 of the width; values are luma):
  - dusk-fire r8 at y 0.40–0.52 runs 32–56 across the whole width. The vertical smear is gone: r7 stepped 64 → 25 at
    x 0.2–0.3.
  - But the mockup's near-left shoulder (x 0–0.3, y 0.44–0.56) is lit at 75–88. In r8 the same area is dome shade (35–47)
    down to y 0.52, and lit only below that (73–80).
  - A mockup: the diagonal lit crests read 92–100 at x 0.3–0.7, y 0.38–0.46, with shade at 33–45 beside them.
  - A r8: y 0.38–0.46 is **32–46 across x 0.2–1**, one dark dome. Its macro spread (σ 12) is 31–109 against the mockup's
    33–102, so the range is right but the lit cells are in the wrong place: only the near sand is lit.
- **Horizon** (row profiles):
  - A: r8 ≈ 0.35 against the mockup's 0.344 (r7 ≈ 0.40). The re-aim did what it claimed.
  - dusk-fire (not re-aimed, pitch −10): r8 ≈ 0.39 against the mockup's ≈ 0.345.
  - D: r8 ≈ 0.50–0.52 against the mockup's 0.505.
- **Sky** (x 20–300 unless named):
  - **A**, hot-band rows y 0.28–0.34: mockup 102–111 at (183,93,64); **r8 143–185 at (249,172,111)**, hotter and yellower
    (r7 87–166).
  - **A**, upper sky at y 0.10: mockup 30 (27,28,56); **r8 49 (56,44,71)**; r7 33.
  - **A**, warm-glow pixels (Y > 140) in the sky band y 0.12–0.40: mockup 21.6 k, r8 71.5 k, r7 71.7 k.
  - **dusk-fire**, same count: mockup 7.1 k, r8 66.0 k.
  - **B** box x 20–190, y 340–640: 52.4, hue 259° against the mockup's 52.1 at 251° (r7 49.0 at 279°). Matched.
  - **C** box: 39.6 against 55.5.
  - **D** box: 42.7 against 53.2.
  - **C and D zenith** (y 0.10): r8 **(2,20,88) and (0,21,93)**, an electric blue with the red channel at zero. The
    mockups are (38,29,47) and (19,23,60); r7 was (25,28,71) and (26,29,73).
- **C flame**, box x 150–450, y 350–900, mockup / r7 / r8:
  - saturated orange pixels: 13 468 / 2 679 / **7 616**;
  - white-hot pixels (Y > 230): 5 557 / 370 / **556**;
  - pixels over Y 150: 13 733 (mean 213) / 15 006 (200) / **7 662 (181)**;
  - warm ember pixels in x 0–330, y 150–560: 1 520 at (177,103,70) / 121 / **167 at (215,173,91)**, pale yellow, not orange.
- **C backdrop** (x 20–200, y 0.31–0.45): mockup is open sky at 60–90, rising toward the horizon. r8 is a flat dune
  face at **39** (r7 22–29).
- **D mid-ground**, row profile at y 0.52–0.66, x 20–500:
  - mockup: 12–20, cut by two thin bright bands (31, then 29–61 at the foot);
  - **r8: one smooth gradient from 131 to 41**, haze over rolling mounds with no bands.
- **The coil**, a strip on its left arc:
  - D: mockup p50 31, sd 18.5, fine 4.5, p99 97. **r8: p50 22, sd 17.9, fine 5.3, p99 56.** r7: sd 5.4, fine 0.5, p99 47.
  - Cord width on scanlines: r8 24–28 px, against 10–15 px for mockup D's cord.
- **Glove** (back of the hand in D): mockup fine 8.5, p99 110. **r8 fine 2.5, p99 62.** r7 2.0 / 57.
- **B camp** (canvas and wagon, x 230–560, y 700–900): mockup 58 (sd 45), r7 85, **r8 63 (sd 45)**. The even self-lit
  glow is gone.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.5** | 6 / 6 / 7 / 6 / 7 / 6 | 1. **The lit left shoulder is missing (x 0–0.4, y 0.40–0.56).** The smear is gone, and the tower dome now has the mockup's shaded camera face (33–56). But the mockup's big lit shoulder, which sweeps from the foreground up to the horizon at the left edge (75–88), is dome shade in the game (35–47). The game's lit sand starts at y 0.52. 2. **Sky and horizon (y 0.10–0.40).** The horizon sits at ≈ 0.39 against 0.345, so the dome, tower and range all sit 0.045 low. Dark-bodied streak clouds with red-orange edges are now spread over the whole sky; the mockup's few grey-brown banks are at the right only. The band near the horizon is far brighter: 66 k pixels over Y 140 against 7.1 k. No ray in flight. The keeper's lamp burns, a small dot against the mockup's bright beacon. 3. **Coil and sand (x 0.25–0.7, y 0.55–0.85).** The near grain now matches in fine detail (9.2 vs 9.5) and spread (74 vs 70), but it reads as dark crescent scales, without the mockup's bright glints (p99 109 vs 130). The coil is one fat plaited ring, where the mockup has a single slim loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 6 / 4 / 6 / 5 / 5 / 6 | 1. **One dark dome, no lit diagonals (x 0–1, y 0.36–0.50).** The key now comes from behind the tower, so every face turned to the camera is shade: 32–46 across x 0.2–1. The mockup's defining forms are three or four receding knife-edge crests lit at 92–100 beside shade at 33–45. Round 7 at least had a lit left flank (≤ 89); r8 lost it. The horizon (0.35) and the tower's size now match. 2. **Near sand too bright (x 0–0.25, y 0.68–0.86).** Mean 73 against 56, p50 77 against 53, open since round 5. Spread (82 vs 77) and p99 (117 vs 117) now match, and the fine detail overshoots (12.9 vs 9.3, crescent scales). 3. **Sky (y 0.10–0.35).** The band is hot and yellow: 143–185 at (249,172,111) against 102–111 at (183,93,64). The upper sky is mauve and brighter (49 vs 30 at y 0.10), which is further from the mockup than r7 (33). The clouds are now thin dark streaks with red edges, the right family, but sparse and high where the mockup has broad banks low over the band. The coil is one fat ring against two big rings rising from the bottom edge. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.5** | 6 / 7 / 6 / 7 / 6 / 6 | 1. **The re-aim moved the wagon off the crosshair (x 0.2–0.5, y 0.40–0.55).** The caravan's centre was on the view axis in r7 (0.09°, wagon centre at x 0.48). Yaw 53.8 → 48.3 puts it 5.4° off: the wagon spans x 0.22–0.47 and the crosshair sits on bare sand. The mockup frames the wagon at x 0.42–0.66 with the crosshair on its tailboard and logbook. 2. **The camp is much closer.** The canvas is shaded, not one even glow (63, sd 45 against the mockup's 58, sd 45), the lantern lights it, the horse is side-on and the tent is a small dark triangle. Still different: the cargo at left reads as dark slabs with no sacks or planks, and the smoke is a thin straight column where the mockup's widens. 3. **Sky, sand and coil.** The sky now matches (52.4 vs 52.1, hue 259° vs 251°), and so does the sand (40 vs 39, spread 28 vs 23). The coil is the fat ring against the mockup's two rings at right. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.0** | 5 / 6 / 6 / 6 / 6 / 6 | 1. **The fire (x 0.28–0.47, y 0.30–0.50).** Ragged tongues, and 7 616 saturated-orange pixels against 13 468 (r7 2 679): a real gain. But the white-hot core is 556 against 5 557, the four new crossing logs don't read (one dark lump), and the embers are 167 pale-yellow pixels against 1 520 orange streaks. 2. **The backdrop (x 0–0.45, y 0.31–0.45).** A flat dune face (39) still fills the upper left behind the bowl, where the mockup has the bowl against open violet sky (60–90) over a low horizon at y ≈ 0.48. The next waymark's plume stays on the right. The zenith is an electric blue (2,20,88) against (38,29,47). 3. **Sand, brazier and hand.** The fire now lights the near sand, but too much: 41 against 32, at (66,35,30) against (51,27,23), and with ripple bands (sd 10 vs 7) where the mockup is smooth. The brazier is still copper on brick, not soot iron on fieldstone. The coil is the fat ring. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.0** | 7 / 5 / 6 / 6 / 5 / 6 | 1. **The landform (x 0–1, y 0.50–0.70).** The overlook gives the mockup's flat horizon (0.50 vs 0.505) and the tower on it at x 0.84 (mockup 0.85). But under it is a smooth hazy gradient (131 → 41) over rolling mounds, with a dune hump in front of the tower. The mockup has a dark mid-ground (12–20) cut by long parallel bright bands. The tower's lowest ≈ 2.6 m sits behind the tower dune's skirt (on the line of sight, the skirt is at −1.74°; the tower's base is at −2.49°). 2. **The hero hand (x 0.25–1, y 0.55–0.86).** The coil is now a true plait: a herringbone with strand relief matching the mockup (sd 17.9 vs 18.5, fine 5.3 vs 4.5). It has no sheen on the strand crowns (p99 56 vs 97), and the cord is about twice as thick (24–28 px vs 10–15). It is one big ring at x 0.26–0.67, where the mockup has slim loops beside the fist at x 0.57–0.82. The zipper stitch line is gone. The glove is still plain (fine 2.5 vs 8.5, p99 62 vs 110): no crackle, creases or highlights. 3. **The sky (y 0.10–0.45).** The zenith is electric blue (0,21,93) against muted navy (19,23,60). The mid sky is darker (38–47 vs 41–60). The afterglow is a narrow hot stripe at y 0.49 where the mockup's peach-pink band is broader. |

**Seat score, Signal Dunes: (6.5 + 5.5 + 6.5 + 6.0 + 6.0) / 5 = 6.1.** Earlier rounds from this seat: 4.8, 5.3, 5.3, 5.4,
5.7, 5.5, 5.7.

Round 8 is a real step, not a revert:
- **Gains:** the smear is gone, the near grain is at the mockups' fine detail, the plait is a plait, the camp is lit like a
  lantern camp, and B's sky and sand are matched. A's horizon and D's overlook framing now match too.
- **Costs:** the backlit key took away every lit diagonal in A and dusk-fire's left shoulder. The sky went hotter in A and
  electric blue in C and D. B's re-aim moved the wagon away from its mockup framing.

## Builder's claims checked against the pixels and the code

| Claim (round-8 README / commits) | Verdict | Evidence |
|---|---|---|
| A: pitch −9 → −12.5 puts the horizon at the mockup's 0.345 (was 0.40) | **True** | Row profile: r8 horizon ≈ 0.35, r7 ≈ 0.40, mockup 0.344. The tower's height in frame is now 0.062 against 0.053. |
| B: yaw 53.8 → 48.3 centres the wagon on the crosshair as the mockup frames it | **False: it moved away** | camAt dir (−0.806, −0.59) → (−0.746, −0.664). The caravan (−78, 28) was 0.09° off the view axis in r7 and is 5.4° off in r8. The wagon's centre moved from x 0.48 to 0.35; the mockup's is at 0.545. Breaks ledger 5's "only to match its mockup's camera better" (finding R8B-2). |
| D moved 88 m to (38, 122), a real walkable crest with ground at 25.7 m | **True, and compliant** | Captured terrain bake: ground 25.57 m, the highest point of the whole field (max 25.92, 100th percentile), local slope 6.7°. Inside PLAY_HALF 200. No cell in the play square is over the 40° climb, so a flood fill from the spawn reaches it. The horizon (0.50) and the tower (x 0.84) match the mockup. The view hides no worse area than the old one did, which also showed whorled ripples. Note that the flat horizon comes from standing at the map's peak; the mockup's long dark bands are still absent. |
| 'waymarks-lit' settles at the two-lit dusk, then lights the last waymark through its handlers | **True; reachable** | `plugin.ts` stage(): the other braziers are lit, the dusk snaps to `duskOf` (0.74), then the last brazier's `spot.onInteract()` and `light()` run, so its toasts are fresh and the dusk eases toward 0.86 at 0.02/s. The staged "last" brazier is `BRAZIERS[2]` at (34, −102), 120 m from C's camera. The frame equals a player who lit [0], then [2], then the near [1] last, 11 m away: the quest allows any order, `light()` has no ignite ramp, and the toasts are the same text whatever the order. D's settle of 11 s gives the settled 0.86 with the toasts gone, as a player who walked to the crest later sees it. |
| Terrain unchanged (hash d5c0efe9) | **True** | `terrain.json` is identical between the captures. The navmesh moved by one poly (prop colliders). fd2ad32c0's "D's flats" were added and then removed in c36bd9425. |
| The key from behind the tower | **Landed; mixed result** | `KEY.dir` (−0.85, 0.2, −0.5) → (−0.45, 0.2, −0.87), intensity 3.0 → 2.0. The baked shadow floor went 0.08 → 0.45 and the fill 0.8 → 1.05 at dusk 0. The smear is gone (grid rows smooth). A's lit diagonals and dusk-fire's lit left shoulder are gone with it (see the grid). |
| Crisper near grain | **True for the numbers; the character differs** | Clean-patch fine detail: dusk-fire 9.2 vs 9.5 (r7 4.1), A 12.9 vs 9.3. At 2× the r8 grain is dark crescent scales. The mockups' grain is bright pinpoint glints on dark troughs: dusk-fire p99 109 against 130. |
| A code-built coil with a real plait and UVs | **True** | At 3× it is a herringbone that follows the cord. Strand sd and fine match the mockup (17.9 / 5.3 vs 18.5 / 4.5). Not addressed: sheen (p99 56 vs 97) and the coil's size and cord width (24–28 px vs 10–15). |
| Fire, camp, sky, keeper's lamp, gauntlet grain | **Fire and camp: true. Sky: partly a regression. Glove: small** | Fire: saturated orange ×2.8, but the core and embers barely moved. Camp: the canvas is 63 against 58 (r7 85), the horse yaw is now 0.39 (side-on), the tent is smaller, the crates are `warmByFire`. Sky: B matched; A's band and upper sky moved away; C and D's zenith lost its red channel. Lamp: a real lantern on the tower, always burning (world content). Glove fine 2.0 → 2.5 against 8.5. |
| Commits touching staging code: only 96c73ea36 | **Incomplete** | 551e484de changed `duskOf` in `plugin.ts`: Sefa met 0.38 → 0.5. That is the staged dusk of B's 'logbook' view, and the change is real play state. It also makes the dusk run backwards 0.5 → 0.32 when the logbook is read (R8B-9). The same kind of omission round 5 had. |
| measure.py's near sand is "clear of the viewmodel" | **False in round 8** | See the first section: the coil sits in the ROI in every game frame, and Sefa in A. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R8B-1 | A, dusk-fire | must-fix | **regression** (of R7B-1's lit half) | A x 0.2–1, y 0.36–0.50; dusk-fire x 0–0.4, y 0.40–0.56 | **Give the lit faces back without the smear.** Straight behind the tower, the key leaves every camera-facing slope in shade. In mockup A the afterglow is brightest to the right of the tower. Measured on the band at y 0.29–0.335, in fifths of the
width, the mockup reads 100 / 113 / 115 / 140 / 152; r8 reads 169 / 168 / 156 / 156 / 152, so the game's glow peaks on
the left. Move the glow and the key's azimuth from straight behind the tower toward the mockup's right-side glow, so slopes facing right-back light at grazing angles and the camera faces of the tower dome stay shade. Keep the N·L terminator and the 0.45 shadow floor that removed the smear. Check it on the 10-column grid: A's cells at x 0.3–0.7, y 0.38–0.46 should read ≥ 90 beside shade ≤ 45; dusk-fire's x 0–0.4, y 0.40–0.52 ≥ 75 while the dome's face stays ≤ 50. |
| R8B-2 | B | must-fix (ledger 5: a re-aim must match better) | **new** | x 0.2–0.66, y 0.40–0.55 | **Undo the B yaw and turn the other way.** The caravan was centred at yaw 53.8 (0.09° off axis); the mockup frames the wagon's centre at x 0.545, a little right of the crosshair. Set yaw a degree or two above 53.8 so the crosshair falls on the tailboard and logbook, and check the wagon's span against x 0.42–0.66. |
| R8B-3 | A, dusk-fire (sky); C, D (zenith) | must-fix | **regression** | A y 0.10–0.35; dusk-fire y 0.12–0.40; C and D y 0.05–0.25 | **The sky moved away from three mockups.** (a) A's band: bring y 0.28–0.34 down from 143–185 toward 102–111, and its colour from (249,172,111) toward (183,93,64), redder and less yellow. The pixels over Y 140 in the sky band are 71 k against 21.6 k. (b) A's upper sky: back toward navy (27,28,56) at y 0.10; it is now (56,44,71), from `sky.ts`'s new rose/dusk/indigo at dusk 0. (c) The late indigo `(0.13, 0.15, 0.33)` renders with R = 0 in C and D. Mix some red back in, toward the mockups' (38,29,47) in C and (19,23,60) in D. (d) dusk-fire's clouds belong at the right only: weight `cside` harder, or drop cover on the left half. |
| R8B-4 | dusk-fire | should-fix | **new** | whole frame, y 0.25–0.45 | **Re-aim dusk-fire's pitch the way A's was.** It shares A's camera and is still at pitch −10, with its horizon at ≈ 0.39 against the mockup's 0.345. A pitch near A's −12.5 lifts the dome, tower and range by ≈ 0.045. That is a re-aim toward the mockup, so name it in the capture notes. |
| R8B-5 | all five (D the hero) | should-fix | **repeated** (R7B-3, pattern fixed) | the coil x 0.25–0.7, y 0.55–0.86; the glove x 0.6–1, y 0.6–0.85 | **The plait is right; now its size and sheen.** The cord is 24–28 px against D's 10–15 px, and the coil is one near-circular ring that now enters every view's near sand from x 0.26. The mockups show slimmer cord in loops that are less round. Halve the cord radius, keep the herringbone, and give the strand crowns a narrow lit rim (strip p99 56 → toward 97). The glove's back of hand needs creases, crackle and small highlights: fine 2.5 → toward 8.5, p99 62 → toward 110. |
| R8B-6 | D, C | should-fix | **repeated** (R7B-4) | D x 0–1, y 0.50–0.66; C x 0–0.45, y 0.31–0.45 | **Landform.** D: the band under the horizon is a bright haze (131 at y 0.52) where the mockup is dark (12–20) with long thin bright bands. Dim the far-plain haze at the late dusk, and give the region D overlooks long low transverse bands (a regional ease like `PADS`/`CRESTS`, not a global wave change). C: the dune face behind the bowl still blocks the sky (39 against 60–90). The same regional lowering west of the waymark line would put the bowl against sky. Re-bake, walk 0 stuck, and show the aerials. |
| R8B-7 | C | should-fix | **repeated** (R7B-5, half fixed) | x 0.28–0.47, y 0.30–0.50 | **Fire.** Saturated orange is 57 % of the mockup's; the white-hot core is 10 % (556 vs 5 557); the embers are 11 % and pale yellow (215,173,91) where the mockup's are orange (177,103,70). Add a small hot core low in the flame. Raise the four new crossing logs until their glowing ends show inside the flame (today they read as one dark lump). Turn the ember colour to orange and multiply their count. |
| R8B-8 | A | should-fix (partly settled by the mockups' conflict) | **repeated** (R7B-2) | x 0–0.25, y 0.68–0.86 | **A's near sand.** It is 73 against 56, while dusk-fire from the same camera and dusk is 72 against 73. The two mockups disagree by 17 on near-identical ground, so one state cannot match both (the builder said so, rightly). The best available is to split the difference: aim both at ≈ 64 by deepening the ripple troughs' lee shade (A's mockup p5 18), not by cutting the key. Swap the crescent scales for the bright pinpoint glints both mockups show (dusk-fire p99 109 → toward 130). |
| R8B-9 | B (and the quest's play) | should-fix (ledger 5, no narrowing) | **new** | whole frame, all views after the logbook | **Keep the dusk monotonic.** 551e484de set the dusk at Sefa met to 0.5, which re-lit B's staged view. Reading the logbook then sets the target back to 0.32, so in real play the sky brightens again for ~9 s (0.18 at 0.02/s). Make the logbook step at least the Sefa step (or keep Sefa at or below 0.32 and get B's dusk elsewhere), and list `duskOf` changes under "commits touching staging code". |
| R8B-10 | C | nit | **new** (overshoot) | x 0–0.25, y 0.68–0.86 | The fire light on the sand overshoots: 41 against 32, redder (66,35,30 vs 51,27,23), with ripple banding (sd 10 vs 7). Shorten the falloff (11 m) or cut its gain, and let the late-dusk ripple fade reach this sand. |
| R8B-11 | process | should-fix | **new** | measure.py | Limit its ROI to coil-free columns (x 0–23 %: 0–180 px at 780) or mask the viewmodel and Sefa. Quote the clean-patch numbers: its round-8 "A 67.3 vs 58.3" is 77 vs 59 coil-free. |

## No-shortcut check (ledger 5)

- **Views:**
  - A's re-aim matches better (horizon 0.35 vs 0.344).
  - **B's re-aim matches worse** (R8B-2). That is not a dodge: the camp is all still in frame. It is a breach of
    "re-aimed only to match better", so it is to be reverted, not voided.
  - D's 88 m move is to the field's highest point (25.57 m, slope 6.7°, reachable with no slope over 40°, inside the play
    square). It frames the mockup's flat horizon and the tower at x 0.84, and hides nothing worse than the old spot did.
    Compliant.
  - camAt confirms that only A, B and D moved, and the README names all three.
- **Staged state:**
  - B's 'logbook' (Sefa met, dusk 0.5) is reachable, but see R8B-9.
  - C's 'waymarks-lit' frame (fresh toasts, dusk ≈ 0.74 + 3 s of easing) is reachable by lighting the near brazier last.
    The stage lights the far one last, but nothing in the frame depends on which brazier was last.
  - D's frame, 11 s on at the settled 0.86 with no toasts, is reachable.
  - `meta.json.staged` lists B, C and D. No frozen pose: one `HD_GLOVE` hold, and C has its flame, embers, plume and pool.
- **Look global:** the key, grain, plait, fire, camp, sky and lamp are in shared shaders and world builders. h1–h4, both
  aerials and the clip carry them (the late-dusk orbit shows all three waymarks lit).
- **World edits for B** (the horse yawed side-on, the tent moved and shrunk, the cargo `warmByFire`): real world content,
  seen in h2 too. Not a breach.
- **Painted stand-ins:** none in the playable area. The keeper's lamp is a lantern mesh with a flame on the tower. The
  ranges and clouds are at infinity.
- **Device and HUD:** 390×844 phone with touch, stored 780 wide, the baseline HUD (in D, B and A its waypoint chips cover
  part of the tower or wagon, unchanged), a 30 fps chip, 0 page errors. The GPU ceiling re-recorded at 108.99 MB was
  lead-approved (54ab03e91, parity green at c36bd9425). No frame-time or total-memory trace is on this surface, so those
  budgets are unverified here, not breached.

SCORE signal-dunes: 6.1

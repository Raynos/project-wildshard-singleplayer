# Round 10, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

Surface: the "Signal Dunes, round 10" section of `art/mockup-council/round-10/README.md` and its five sheets; the full-res
frames in `progress/sunscar-dunes/20261003-0432-0ae71b2a/` (every `mock-*`, h1–h4, both aerials, `clip.mp4` at 0.5 fps,
`meta.json`); round 9's `20261003-0356-544f6b56/` for before/after; the five ledger mockups, Lanczos-scaled to 780×1688.
Source checks: `git show` of 3b2f5f0e2, ed3c17393 and 26f691035; the camAt diff of the two `meta.json`; both captured
terrain bakes (`terrain.bin`, 256², 500 m), compared cell by cell. All brightness is Rec. 709 luma on decoded JPEGs. Fine
detail is mean |luma − luma blurred at σ 2 px|. Macro structure is the Pearson r (and mean |diff|) of luma blurred at
σ 12 px, mockup against game, over a named band. Regions are fractions of the frame (x left → right, y top → bottom) or
780-px pixel boxes.

## Is measure.py's crop fair this round?

**Not quite. The coil moved into it.** The tool's patch is x 10–240, y 1150–1450. Two problems:
- **The coil is inside it in every r10 view.** Commit 0dac86de9 lowered the hold and made the loops bigger. The cord's left
  arc now runs at x ≈ 207–240 from y ≈ 1060 to 1400 (scanlines in A, B, C, D: dark runs start at x 211–215). That puts
  dark cord pixels in about 13 % of the patch's width.
- **The bottom rows are HUD.** The bar's cyan line is at y 1435 in the game and y 1425–1428 in mockups A and D, so the
  bottom 15–25 rows are dark glass, and the mockup gets more of them than the game does.

Sefa is outside the patch in every view. The regions are the same pixel boxes in the mockup and the game.

The effect: the cord pulls the game's mean down, and that hides about 6–7 luma of overshoot in exactly the two views
where it matters. On my **clean patch, x 10–190 and y 1160–1420** (clear of the r9 and r10 coils, Sefa and the bar in
all 15 frames):

| View | measure.py (game) | Clean patch (game) | Mockup (clean) |
|---|---|---|---|
| dusk-fire | 76.3 | **82.5** | 73.8 |
| A | 79.4 | **86.1** | 57.4 |

Every verdict below uses the clean patch.

## Measurements (mockup / r9 / r10)

**Near sand, clean patch x 10–190, y 1160–1420:**

| View | Mean | p5–p95 (spread) | Fine | RGB |
|---|---|---|---|---|
| dusk-fire | 73.8 / 66.0 / **82.5** | 45–111 (66) / 25–99 (74) / **45–111 (66)** | 9.5 / 11.3 / **10.3** | 113,66,38 / 103,58,33 / **119,75,47** |
| A spawn | 57.4 / 71.3 / **86.1** | 33–94 (62) / 29–104 (75) / **47–115 (68)** | 9.4 / 12.3 / **11.3** | 88,51,36 / 109,64,37 / **122,79,51** |
| B logbook | 39.7 / 41.3 / **31.8** | 31–50 (19) / 25–57 (31) / **16–46 (30)** | 2.0 / 3.5 / **3.2** | 62,34,27 / 62,36,31 / **53,26,22** |
| C waymark | 32.6 / 43.0 / **36.9** | 26–37 (11) / 29–55 (26) / **24–48 (23)** | 0.1 / 1.2 / **1.4** | 53,28,22 / 69,37,30 / **63,30,26** |
| D hands | 34.9 / 38.9 / **34.3** | 23–48 (25) / 29–49 (21) / **25–44 (18)** | 0.2 / 1.3 / **1.6** | 52,31,27 / 59,34,30 / **55,29,27** |

**Macro structure** (r and mean |diff|, r9 → r10):

| View | Band | r9 | r10 |
|---|---|---|---|
| dusk-fire | 0–1 × 0.36–0.58 | +0.08 / 18.9 | **+0.36 / 18.2** |
| A | 0–1 × 0.34–0.58 | +0.18 / 25.3 | **+0.20 / 33.7** |
| B (camp band) | 0–1 × 0.40–0.60 | +0.41 / 25.8 | **+0.58 / 18.0** |
| C (backdrop) | 0–0.25 × 0.30–0.50 | +0.60 / 13.4 | **+0.40 / 19.8** |
| D (land) | 0–1 × 0.50–0.66 | +0.59 / 24.9 | **+0.30 / 16.8** |

**The dune band, a 10-column grid** (cells 0.1 wide and 0.02 tall; luma):
- **A, mockup:**
  - The lit diagonal runs from x 0.25–0.45 at y 0.38 down to x 0.65–0.85 at y 0.46 (83–107).
  - The left, x 0–0.3 at y 0.38–0.48, is in shade (28–47).
  - The near crest is lit at y 0.50–0.58 and climbs to the right. Above it, x 0.5–1 at y 0.48–0.54, is shade (33–40).
- **A, r10:** the new crest line made a lit diagonal at x 0.15–0.55, y 0.42–0.48 (76–107), a gain. But it is about
  0.2 left of the mockup's. x 0.55–0.75 at y 0.38–0.46 is still shade (32–43). The left is now brighter still: x 0–0.3
  at y 0.38–0.48 reads 59–114 against 28–47. The near slope is lit right across (77–93), with no shade band.
- **dusk-fire, mockup:** the lit left shoulder at x 0–0.3, y 0.42–0.56 (50–92), and the lower right in shade, x 0.5–1 at
  y 0.50–0.58 (41–48).
- **dusk-fire, r10:** the shoulder is lit now, at 78–93 for x 0.1–0.4, y 0.42–0.52 (r9 35–70): **fixed**. The lower right
  is still lit (51–85). The edge of the shade is crisp. In `aerial-spawn` it is a hard diagonal, but a separate oval shade
  floats on lit sand at x 0.57–0.72, y 0.38–0.43.

**The sky in A and dusk-fire:**
- **The sky box** (40,300)–(540,600):
  - A: 88.3 / 92.9 / **107.7**.
  - dusk-fire: 75.9 / 94.2 / **112.8**.
- **Pixels over luma 140** in y 0.12–0.34:
  - A: 19.3 k / 1.7 k / **33.5 k**.
  - dusk-fire: 3.2 k / 2.8 k / **42.4 k**.
- **The glow by fifths** (y 0.31–0.34):
  - A, mockup: 103 / 118 / 114 / 148 / 162.
  - A, r10: **118 / 132 / 144 / 155 / 157**. It now rises to the right like the mockup.
  - dusk-fire, mockup: 130 / 87 / 99 / 115 / 122.
  - dusk-fire, r10: **133 / 144 / 157 / 157 / 145**, 35–60 over the mockup.
- **The new horizon line, peak:**
  - A: 189 at (255,177,122), y 0.345–0.35. The mockup has 167 at y 0.33, and its land starts at 0.345.
  - dusk-fire: 187 at y 0.345, against 123.
- **The land under the horizon:**
  - dusk-fire, y 0.365–0.39: 56–64 / mockup 32–36 (r9 51–70).
  - A ranges, x 0.05–0.3: 88–92 / 69–79 (r9 100).
- **Bright cloud cover** (residual over the row mean > 12, y 0.13–0.33):

  | | Mockup | r9 | r10 |
  |---|---|---|---|
  | A, right half | 26.3 % at (213,116,63) | 2.8 % | **17.3 % at (198,127,90)** |
  | dusk-fire, left half | 8.0 % | 4.7 % | **15.8 % at (167,101,80)** |
  | dusk-fire, right half | 8.7 % at (124,105,94), grey-brown | | **7.8 % at (170,118,94), orange** |

**The dusk horizons in B, C and D** (column means, luma):
- **B:**
  - The land under the horizon, x 0–0.2, y 0.465–0.49: 29–43 / 49–99 / **30–63**.
  - The glow line at x 0.72–0.9: peak 157 / 101 / **101**. The B sky above y 0.45 is identical to r9's, value for value.
- **C:**
  - The land, x 0.55–0.9, y 0.485–0.53: 16–17 / 38–58 / **6–24: fixed**.
  - The glow: 96 at (149,81,87) / 97 at (169,80,53). Matched.
- **D:**
  - The land, y 0.52–0.62: the right half is 6–30 against 11–29 (matched). The left half is 28–48 against 13–22.
  - The mockup's lit near band at y 0.64 (54–67) is absent (38–43).
- **D's afterglow** (column x 300–500):

  | | Peak | At y | Rows over 100 | Rows over 140 |
  |---|---|---|---|---|
  | Mockup | 170 | 0.497 | 121 | 58 |
  | r9 | 130 | | 99 | 0 |
  | r10 | **195** | **0.478** | **79** | **33** |

  It is now a thin over-bright stripe. The far ranges read as land from y 0.485, against the mockup's 0.505.

**Subjects:**
- **C's flame,** box x 150–450, y 520–900 (under the HUD panels, whose text the old y 350 box counted):

  | | Mockup | r9 | r10 |
  |---|---|---|---|
  | Pixels over 150 | 12 909 | 14 394 | **15 630** |
  | Their mean | 213 | 178 | **188** |
  | Over 230 | 5 212 | 357 | **1 689** |
  | Over 245 | 2 483 | 0 | **0** |
  | Widest row | 121 px | 154 | **133** |
  | Edge gradient | 10.8 | 4.7 | **8.1** |

  - The pool: 40 / 59 / **51**.
  - The flame is now crisp licks about the bowl's width, but it is a translucent sheet roughly twice the bowl's width in
    height, and the logs under it are dark.
- **C's plume and embers:**
  - The plume is now (44,37,65), 3.2 over the sky (r9 (63,59,83), +18.7; the mockup's (58,41,57), +8.7). The pale column
    is fixed, but it is a straight thin column up-right, where the mockup billows up-left.
  - Warm ember specks, left / right: mockup 2 531 / 1 322; r10 1 177 / 3 963.
- **C's post:** R/G 2.51 against 2.35 (r9 2.81). Greyed. The plinth is now a pale beige brick block, where the mockup has
  a dark fieldstone drum.
- **B's lantern:**

  | | Position | Max | Pixels over 200 | Ring 6–20 px | Ring 20–45 px |
  |---|---|---|---|---|---|
  | Mockup | x 0.522, y 0.417 | 252 | 115 | 56 | 52 |
  | r9 | | 183 | 0 | 111 | 79 |
  | r10 | **x 0.508, y 0.447** | **230** | **116** | **127** | **103** |

  - The hot centre matches.
  - The halo is about 2× the mockup's surround and floods the hood: the wagon body (x 0.45–0.62, y 0.41–0.50) is 74
    against 50.
  - The cargo (x 0.12–0.30, y 0.49–0.53) is 41 against 44 (r9 57), but its fine detail is 1.3 against 3.5: no planks.
- **The coil:**
  - Cord width on scanlines y 1050–1250: r10 13–23 px (r9 12–15). The mockups: A and B about 35–45 px, D 6–13 px.
  - D's left arc, p99: 103 / 51 / **67**.
  - A's rings now rise from the bottom edge (x ≈ 0.27–0.75, against the mockup's 0.33–0.86).
- **D's glove** (mockup (600,1100)–(720,1200); r10 (520,1190)–(680,1280)):

  | | Mockup | r9 | r10 |
  |---|---|---|---|
  | p95 | 85 | 47 | **51** |
  | p99 | 117 | 56 | **69** |
  | Fine | 9.1 | 2.2 | **3.6** |
  | Pixels over 90 | 3.9 % | 0.0 % | **0.3 %** |

  The new light ridges show as scattered white specks (frost or salt) rather than creases and worn seams.
- **The dusk-fire tower** is at x ≈ 0.365 against the mockup's 0.375 (r9 ≈ 0.32). The keeper's lamp now has a flame (max
  231; r9 148; mockup 253).

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.0** | 1. **The sky blazes (x 0–1, y 0.10–0.36).** The sky box is 113 against 76 (r9 94), with 42 k pixels over 140 against 3.2 k. The horizon line peaks at 187 against 123. There are big orange cumulus masses in the upper left (15.8 % cover) where the mockup has clear dusk sky and the ray, and the right-hand bank is orange where the mockup's is grey-brown. 2. **The landform (x 0–1, y 0.36–0.58): the best it has been.** The lit left shoulder is in (78–93 against 50–92) and the shade edge is crisp. Macro r rose from +0.08 to +0.36. The lower right is still lit (51–85 against 41–48), and the shade's lee is a curvy lobe, not the mockup's smooth saddle. 3. **Near sand and figures (y 0.55–0.86).** The sand now overshoots: 82.5 against 73.8 (r9 66.0). Mid-field ripples band in strong stripes. Sefa stands at the left edge, and the tower sits behind the dune rather than on its crest. The tower's x is fixed (0.365 against 0.375). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.0** | 1. **Too bright below the horizon (x 0–1, y 0.36–0.86).** The clean sand is 86.1 against 57.4 (r9 71.3): the gap doubled. The left of the dune band is 59–114 where the mockup is in shade at 28–47. Macro diff rose from 25.3 to 33.7. 2. **The landform (y 0.38–0.58).** The new crest line gives a lit diagonal (76–107), a gain, but about 0.2 left of the mockup's, and the left of it is lit, not lee shade. The near slope is lit all the way across, with no shade band above the near crest. The aerial shows an isolated oval shade on lit sand. 3. **The sky (y 0.10–0.35).** Mixed. The glow now rises to the right (118 → 157 against 103 → 162), and the right half's bright clouds are 17.3 % against 26.3 % (r9 2.8 %): gains. But the clouds are soft puffs, not streaky red banks. The sky box is 108 against 88, and the horizon line is a hot 189 stripe at y 0.345. Sefa waves mid-left, where the mockup has no figure. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.1** | 1. **The lantern and the camp (x 0.12–0.70, y 0.40–0.55).** The lantern's hot centre now matches (116 pixels over 200 against 115), and the crates stand stacked as in the mockup (41 against 44). Camp-band macro r went from 0.41 to 0.58. But the halo floods the whole hood opening (rings 127 / 103 against 56 / 52; the body 74 against 50), and the cargo has no planks (fine 1.3 against 3.5). 2. **The horizon (y 0.40–0.48).** The land under it is darker (30–63 against 29–43; r9 49–99), and the ranges are still pale lavender. The glow line is unchanged at 101 against 157: the sky is pixel-identical to r9's. The smoke is a thin straight pale column. 3. **Sand and coil (y 0.55–0.86).** The sand overshot downward: 31.8 against 39.7 (r9 41.3), with a spread of 30 against 19. Diagonal ripple bands cross the near ground, where the mockup's is smooth. The coil is lower but thin (≈ 15–20 px against ≈ 35 px rings). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.0** | 1. **The fire (x 0.22–0.55, y 0.30–0.52).** Crisper and bowl-wide (widest row 133 against 121, edge gradient 8.1 against 10.8; r9 154 / 4.7), and the core is up (1 689 pixels over 230 against 5 212; r9 357). Still a translucent licked sheet about twice the bowl's height: nothing over 245 (mockup 2 483), the bright mean 188 against 213, dark logs. The embers stream right (3 963 against 1 322), where the mockup's go left. 2. **The backdrop and the far land.** The land under the horizon is now near-black (6–24 against 16–17; r9 38–58), a clear gain. The plume is no longer a pale column (+3 against +9 over the sky). The dune shoulder at the left edge is now a high dark silhouette, so the backdrop's r fell from 0.60 to 0.40. 3. **The brazier and the sand.** The plinth is a pale brick block, not a dark fieldstone drum, and the post is still a twisted shaft (greyed: R/G 2.5 against 2.35). The sand is closer (36.9 against 32.6; r9 43.0), and the pool is 51 against 40. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.7** | 1. **The afterglow (y 0.44–0.50).** It went from too dim to a thin over-bright stripe: peak 195 against 170, 79 rows over 100 against 121 (r9 99). The mockup's is a broad peach gradient. The ranges now read as land from y 0.485, against the mockup's 0.505. 2. **The land (y 0.50–0.70).** The right half matches (6–30 against 11–29; r9 39–66). The left is a rising lit slope at 28–48, where the mockup has long flat near-black bands (13–22). The mockup's bright near band at y 0.64 (54–67) is absent. 3. **The hero hand (x 0.4–1, y 0.55–0.86).** The glove gained a little (p99 69 against 117, fine 3.6 against 9.1; r9 56 / 2.2), but reads crusty with white specks, with no finger forms. The cord is about 1.5× the mockup's (13–20 px against 6–13), and the arc's crown is 67 against 103 (r9 51). |

**Seat score, Signal Dunes: (7.0 + 6.0 + 7.1 + 7.0 + 6.7) / 5 = 6.8.** This seat's earlier scores: 4.8, 5.3, 5.3, 5.4,
5.7, 5.5, 5.7, 6.1, 6.6.

## The builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Clean-patch late sand B / C / D 36.6 / 37.5 / 33.4 | **C and D roughly; B no** | With measure.py on this capture: 32.3 / 35.7 / 34.0. On the clean patch: 31.8 / 36.9 / 34.3. B was claimed before later commits and is now 8 under the mockup (39.7). |
| measure.py "now uses the clean patch" | **No longer clean** | The r10 coil is at x 207–240 inside it, and the HUD bar is in its bottom rows. It understates the overshoot by 6.2 (dusk-fire) and 6.7 (A). |
| The key NNW by a sweep; "dusk-fire 75.7 / 72, A 78.8 / 56.2" | **Reproduces on measure.py; overstated on the clean patch** | Clean: 82.5 / 73.8 and 86.1 / 57.4. dusk-fire's grid gained (r +0.36, matching the commit's +0.39). A's did not (+0.20). |
| A crisp terminator | **True** | The aerial-spawn shade edge is hard. dusk-fire's lobe edge is crisp. |
| The dusk horizon's glow line over darker land | **Land: true in C and D's right half, partly in B. Line: overshoots** | C's land 6–24 against 16–17. D's peak is 195 against 170, but narrower (79 rows over 100 against 121). In A and dusk-fire a hot 187–189 line now sits on the horizon. Their mockups have none there. |
| The far land darkened at dusk (ed3c17393) | **True; the method is global** | `sil = smoothstep(8, 60, sandFar) * smoothstep(0.3, 0.75, uDusk) * 0.75` darkens the sand's light with camera distance. It holds in every late view and the clip, and the late aerial clip now shows near-black land. |
| The fire: a hot core, the bowl's width | **Width true; the core 32 %** | 1 689 pixels over 230 against 5 212, none over 245. The widest row is 133 against 121. |
| The plume warm brown-grey; the post greyed | **True** | The plume is +3 over the sky (r9 +19). The post's R/G is 2.5 (r9 2.8, mockup 2.35). |
| The lantern's hot centre and halo | **The centre is true; the halo overshoots** | 116 pixels over 200 against 115. The rings are 2× the mockup's, and the hood is 74 against 50. |
| The crates standing on the sand | **True** | Two stacked crates; the cargo is 41 against 44. Still no plank detail. |
| The idle hold lower, loops bigger, cord 0.04 | **True** | A's rings rise from the bottom edge. The cord is 13–23 px: between D's 6–13 and A/B's ~35–45. |
| The glove's creases in the albedo | **Small** | p95 47 → 51, p99 56 → 69, fine 2.2 → 3.6 against 85 / 117 / 9.1. They read as specks. |
| The clouds broken into masses | **Form true; the cover is wrong in dusk-fire** | A's right-half cover is 17.3 % against 26.3 % (r9 2.8 %). dusk-fire's left is 15.8 % against 8 %, orange where the mockup's bank is grey-brown. |
| dusk-fire yaw −10 → −8 | **True, toward the mockup** | camAt dir x 0.17 → 0.136. The tower is at 0.32 → 0.365 against 0.375. |
| The crest line (26f691035), max climb green | **True in the bake** | 577 cells changed, in world x −28..26 and z −44..21, by up to +5.64 m. The steepest cell in the central 300 m is 35.2° (r9 33.0°); none is over 40°. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R10B-1 | dusk-fire, A | must-fix | **regression** (3b2f5f0e2) | sky y 0.10–0.36; horizon y 0.33–0.36 | **Take the early dusk's sky back down.** The sky box is 113 / 108 against 76 / 88 (r9 94 / 93), and pixels over 140 are 42 k / 33 k against 3 k / 19 k. The "thin bright line in the band's last ~1°" peaks at 187–189 on the horizon. Neither mockup has a line there: A's glow peaks at 167 at y 0.33, and dusk-fire's is 123. Gate the line to the late dusk only (zero at dusk 0, where A and dusk-fire are captured). Lower the band's gain until dusk-fire's x 0.45–0.95, y 0.30–0.35 reads ≤ 125 and A's right fifth ≈ 160, and keep A's rightward rise (it now matches). Thin the cloud masses in the left half (dusk-fire 15.8 % against 8 %; A's left 0.7 % in its mockup). Keep the right-hand banks. |
| R10B-2 | dusk-fire, A | must-fix | **regression** (the NNW key at 2.3) | near sand x 0–0.25, y 0.68–0.84; dune band x 0–0.3, y 0.38–0.58 | **The near field overshoots in both views.** On the clean patch: dusk-fire 82.5 against 73.8, A 86.1 against 57.4. In round 9 they split the mockups' conflict (−7.8 / +13.9). Now both are over. The A/dusk-fire tone conflict is settled, but overshooting both is not a split. Lower the key (or its lit-side gain from the new terminator ramp) until dusk-fire's coil-free patch reads ≈ 74, and quote the clean patch, not measure.py's. Check that A's dune-band left (x 0–0.3, y 0.38–0.48) falls from 59–114 toward ≤ 60. |
| R10B-3 | A (and the aerials) | should-fix | **repeated** (R9B-1; partly fixed) | x 0–0.8, y 0.38–0.58 | **Move the crest's lit diagonal right and put the ground left of it in lee shade.** The new crest line makes a lit diagonal at x 0.15–0.55, y 0.42–0.48. The mockup's runs from x 0.25–0.45 at y 0.38 down to x 0.65–0.85 at y 0.46, with shade (28–47) on its left and a shade band (33–40) above the near crest at x 0.5–1, y 0.48–0.54. Rotate or shift the crest line (layout `CREST_LINES`) so its lit face falls on A's x 0.3–0.75 and its lee faces the camera on the left. Also remove the isolated oval shade on lit sand in `aerial-spawn` (x 0.57–0.72, y 0.38–0.43). Re-bake and run the climb test. Check A's band macro r ≥ 0.5, and that dusk-fire's shoulder stays lit (it shares the ground 8° to the right). |
| R10B-4 | D (and every late view) | should-fix | **new** (the r10 glow line overshot) | y 0.44–0.50 | **Widen the afterglow; don't brighten it.** It peaks at 195 against 170, but only 79 rows are over 100 against 121 (r9 99). The mockup's is a broad peach gradient. Spread the line over ~3°, cap its peak near 170, and keep the hue toward (214,155,113). D's left land is still 28–48 against 13–22, and the mockup's lit near band at y 0.64 (54–67) is absent. |
| R10B-5 | C | should-fix | **repeated** (R9B-3; core 7 % → 32 %) | x 0.22–0.55, y 0.30–0.52 | **The fire: dense, not a tall sheet.** Pixels over 230 are 1 689 against 5 212, none over 245 (mockup 2 483), and the bright mean is 188 against 213. Make the flame shorter (about 1.5× the bowl's width in height, not ~2×) and more opaque. Put the white-yellow core low over the logs, and make the log ends glow. Turn the ember drift up-left as the mockup has it (1 177 left / 3 963 right against 2 531 / 1 322). The plinth: a dark fieldstone drum, not a pale brick block. The pool: 51 → 40. |
| R10B-6 | B | should-fix | **new** (the halo overshot) and **regression** (sand) | lantern x 0.45–0.62, y 0.40–0.50; sand y 0.68–0.84; horizon x 0.72–0.9, y 0.40–0.45 | (a) **Shrink the lantern halo:** keep the hot centre (it matches), and cut the 6–45 px rings from 127 / 103 to ≈ 55, so the hood's body falls from 74 to ≈ 50. (b) **The sand:** it is now 31.8 against 39.7 (r9 41.3). e2dec8b5e plus the key change overcorrected; lift the fill at dusk 0.5 by ≈ 8. (c) **The glow line at dusk 0.5** is unchanged at 101 against 157, which is where a line belongs (the mockup's horizon band). (d) The cargo needs plank detail (fine 1.3 against 3.5). |
| R10B-7 | all hands (D the hero) | should-fix | **repeated** (R9B-4) | the glove x 0.6–0.9, y 0.65–0.78; the coil | The glove's new light ridges read as white specks: p95 51 against 85, fine 3.6 against 9.1. Make the highlights broad glancing ridges along the knuckles and the cuff (narrow bands near luma 80–120), not points. Add finger forms (the fingers wrap the handle in the mockup). The cord at 0.04 is a fair compromise; the arc's crown is 67 against 103, so the crown sheen needs ≈ +35. |
| R10B-8 | process | should-fix | **new** | measure.py | **The patch now holds the coil.** The r10 hold puts the cord at x 207–240 inside measure.py's x 10–240, and the HUD bar fills its bottom rows (y 1425/1435–1450). It understates A's and dusk-fire's overshoot by 6–7 luma. Use x 10–190, y 1160–1420, and re-check the patch whenever the hold changes. |
| R10B-9 | A, dusk-fire | nit | **new** | x 0–0.30, y 0.52–0.70 | Sefa stands 8 m in front of the spawn camera (A: mid-left, waving; dusk-fire: the left edge). Neither mockup has a figure there. Leave her: she is real quest state. A seat should not count her against the score beyond a nit. |

## No-shortcut check (ledger 5)

- **Views:** one re-aim, dusk-fire yaw −10 → −8 (camAt dir x 0.17 → 0.136). It moves the tower toward the mockup (0.32 →
  0.365 against 0.375) and is named in the README. No other shot's camAt changed, hero views included.
- **Terrain:** the crest line is real baked terrain and global. It changed 577 cells (up to +5.64 m) in the field between
  the spawn and the tower, and every slope is under 40° (max 35.2°). It shows in h1, h4 and both aerials.
- **Staged state:** `stage()` is unchanged, and so is the staged list in meta.json (B `logbook`, C and D `waymarks-lit`).
  The dusk values match round 9's, which I verified as reachable.
- **Global look, no view-only switches:**
  - The key, the terminator, the glow line, the silhouette darkening (by camera distance, in the sand shader, for every
    late view) and the clouds are all shard-wide.
  - The hold is one idle pose. The lantern halo is an effect on a real lamp mesh.
- **No narrowing:** h1, h4 and aerial-spawn are 7.7–9.6 luma brighter than in r9 (the same key change, finding R10B-2).
  h2 and h3 are about unchanged. The late clip keeps its fires, but the land under it is now near-black. That is
  consistent with mockups B, C and D, and not a breach.
- **Device and HUD:** 390×844 touch, stored 780 wide; the baseline HUD in every frame; a 30 fps chip; `active: []`;
  `pageErrors: []`. This surface has no frame-time or memory trace, so those budgets are unverified, not breached.

No breach this round.

SCORE signal-dunes: 6.8

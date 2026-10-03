# Round 25, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` (the camera-distance
  rule, the key ruling, the fog ruling, the round-22 rulings, the revised round-24 D ruling), and round 24's seat A, B
  and C files.
- The "Signal Dunes, round 25" section of `art/mockup-council/round-25/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1458-a37cbc42/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 23's `20261003-1325-8f296fb4/` (the last valid stand) and
  round 24's `20261003-1406-7db2a5a2/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 302c174b7 and 92d11777d, `git diff 8f296fb4b a37cbc421 -- src/`; `dusk.ts`,
  `render.ts`, `layout.ts`, `world/dunes.ts`, `plugin.ts` (`duskOf`, `stage`) at a37cbc421; `cameras.json`; the baked
  `terrain.bin` at 8f296fb4b, 7db2a5a26 and 92d11777d; the early sky panorama at the same three; and
  `progress/physics/sd-r25-b-mussawzm.json`.

**How I measured:** the same tools and regions as my round-24 file, whose r24 numbers reproduce exactly (A's diagonal
78.9, trough 92.4, dusk-fire's saddle 47.4).
- Rec. 709 luma on the decoded JPEGs; **s** = mean (max − min) / max; **h** = hue of the region's mean colour.
- **Row-demeaned r:** Pearson r of a 10×7 grid of σ-12 luma over y 0.36–0.56, each row's mean removed.
- **Shares** (y 0.36–0.62): warm = hue 0–50° with s > 0.15; lilac = hue 240–330°; red = hue < 12° or > 350° with
  s > 0.5.
- Regions are frame fractions (x left → right, y top → bottom). The coil now spans x ~0.33–0.80, so every near-sand box
  is left of x 0.30.

## The short version

- **No ledger-5 breach.**
  - All twelve camAt entries are identical to round 23's, including mock-D at (37.99, 27.59, 121.99), yaw 21.7.
  - The new terms are global, with no camera input.
  - The new crest is real terrain at ≤ 27.5°.
  - Staging is unchanged.
- **The new dusk terms are not fitted to B's 0.50. They are fitted around it.** Both ramps were placed so that B keeps
  round 23's balance (the code comments say so). The result is a fill that rises 46 % from the sunset to a plateau over
  B, then falls 32 % to the waymarks. That is round 11's R11-5 shape again: a should-fix, not a void.
- **Real gains since round 23:**
  - A's trough is shaded (95 → 71; mockup 43), and its diagonal holds (82.8).
  - Round 24's red cast is gone (red share A 17.6 → 2.4 %, dusk-fire 24.2 → 3.4 %).
  - Dusk-fire's shoulder and near sand match.
  - The hold is two rings on the right in every view (the mockups' A, B and C composition).
  - D's glow line is brighter (122 → 140; mockup 161).
- **Regressions the README does not name:**
  - Dusk-fire's saddle fell back from 47.4 to 34.7 (mockup 49.5), undoing round 24's best gain.
  - A's near sand is 97 against round 23's 70 (mockup 68).
  - The new crest cuts a dark notch into dusk-fire's lit left slope.
- **Seat score 7.0.**

## Measurements (mockup / r23 / r24 / r25)

| View | Region | Mockup | r23 | r24 | r25 |
|---|---|---|---|---|---|
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.7 h19 s0.65 | 86.8 h23 s0.47 | 78.9 h17 s0.54 | **82.8 h24 s0.47** |
| A | Trough, x 0.2–0.6, y 0.47–0.53 | 42.7 h318 | 95.3 h25 | 92.4 h21 | **71.1 h21** |
| A | Left lee, x 0–0.3, y 0.40–0.50 | 39.6 h308 | 54.7 h7 | 52.0 h3 | 44.3 h346 |
| A | Right shade band, x 0.55–1, y 0.47–0.55 | 44.1 h348 s0.31 | 44.8 h6 s0.42 | 58.5 h10 s0.65 | 50.4 h16 s0.53 |
| A | Right stripe, x 0.8–1, y 0.50–0.56 | 37.4 h325 | 27.7 h303 | 46.4 h7 s0.69 | 28.5 h3 s0.50 |
| A | Lit quarter of y 0.36–0.56 | 158,88,54 h19 s0.66 | h27 s0.43 | h23 s0.47 | 128,94,69 h24 **s0.46** |
| A | s by luma quartile, y 0.38–0.62 | 0.28 0.26 0.55 0.67 | 0.38 0.56 0.51 0.44 | 0.48 0.63 0.56 0.49 | 0.37 0.51 0.54 0.50 |
| A | Near sand, x 0–0.3, y 0.62–0.70 | 67.8 h17 | 69.8 h21 | 86.4 h18 | **97.3 h19** |
| A | Left column rows y 0.40 … 0.58 (x 0–0.4) | 52 37 39 38 42 60 86 96 86 80 | 52 53 63 70 89 106 103 92 73 70 | | 51 51 61 61 45 49 92 103 96 102 |
| A | Warm / lilac / red share | 46 / 42 / 1.5 % | 74 / 18 / 5.3 % | 82 / 10 / 17.6 % | 77 / 15 / 2.4 % |
| A | Row-demeaned r | | +0.47 | +0.50 | +0.47 |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 h13 s0.39 | 30.9 h326 | 47.4 h6 s0.63 | **34.7 h6 s0.49** |
| dusk-fire | Right low band, x 0.55–1, y 0.50–0.58 | 45.7 h6 | 31.1 | 41.7 | **30.7** |
| dusk-fire | Shoulder, x 0–0.35, y 0.50–0.70 | 82.9 h22 | 72.0 | 82.2 | 87.4 h19 |
| dusk-fire | Near left, x 0–0.35, y 0.70–0.85 | 72.2 h22 | 56.0 | 63.7 | **73.5 h15** |
| dusk-fire | Left column rows y 0.40 … 0.58 (x 0–0.4) | 55 58 62 68 77 85 85 82 85 84 | 77 81 86 86 86 93 84 74 61 60 | 71 75 80 81 82 91 86 78 73 78 | 73 81 83 **65 53** 71 88 83 77 86 |
| dusk-fire | Lit quarter | 130,73,41 h21 s0.68 | h25 s0.46 | h20 s0.51 | 120,86,63 h24 s0.48 |
| dusk-fire | Warm / lilac / red share | 78 / 16 / 1.1 % | 65 / 28 / 5.7 % | 76 / 16 / 24.2 % | 72 / 21 / 3.4 % |
| dusk-fire | Row-demeaned r | | +0.57 | +0.54 | +0.49 |
| dusk-fire | Sky, y 0.05–0.36 | 66.5 h13 s0.36 | 74.8 h356 s0.58 | same | 74.5 h356 s0.58 |
| B | Glow band left / right, y 0.40–0.45 | 106 / 95 | 91 / 68 | 92 / 68 | 92 / 69 |
| B | Mid sky, y 0.30–0.38 | 65.7 h270 | 64.0 h319 | 64.1 h321 | 64.1 h321 |
| B | Backdrop right, x 0.65–1, y 0.44–0.50 | 29.4 | 36.2 | 35.5 | 33.0 |
| B | Wagon and lantern, x 0.45–0.65, y 0.40–0.50 | 52.3 h16 | 52.2 | 51.9 | **58.4** |
| B | Near left, x 0–0.35, y 0.60–0.80 | 40.9 h11 s0.55 | 34.3 h3 | 37.4 h1 | 33.3 h356 s0.43 |
| C | Plinth, x 0.40–0.52, y 0.565–0.60 | 70.2 h18 | 51.0 (coil) | 90.0 | 87.8 h16 |
| C | Ground right, x 0.6–0.95, y 0.58–0.70 | 33.9 h11 | 55.1 | 52.8 | **47.3** |
| C | Ground left, x 0–0.3, y 0.60–0.75 | 44.2 h13 | 43.9 | 49.9 | 43.5 |
| C | Far land, x 0.55–0.95, y 0.48–0.55 | 20.2 h342 | 32.2 | 33.0 | 29.8 |
| C | Low sky right, x 0.6–1, y 0.40–0.47 | 80.8 h341 | 58.6 h304 | 58.8 | 57.3 h302 |
| D | Land y 0.50–0.70: median; share < 8 | 13.7; 1.9 % | 40.2; 12.1 % | (moved) | **36.6; 4.4 %** |
| D | Full-width rows y 0.53 … 0.61 | 16 12 21 14 15 | 28 27 28 36 40 | (moved) | 29 33 36 38 38 |
| D | Far right, x 0.5–1, y 0.50–0.58 | 23.0 | 21.5 | (moved) | 27.0 |
| D | Lit stripe, x 0–0.4, y 0.63–0.67 | 54.0 | 39.2 | (moved) | 36.8 |
| D | Glow peak (row mean, x 0–0.7) | 161 at y 0.495 | 122 at 0.470 | (moved) | **140 at 0.470** |
| h1 | Near ground, x 0–0.25, y 0.62–0.80 | | 69.4 | 89.2 | **99.6** |
| h3 | Near ground, x 0–0.12, y 0.66–0.80: blue < 6 | | 46 % | 68 % | **61 %** (s 0.83) |
| h2 | Near ground, x 0–0.3, y 0.62–0.80: blue < 6 | | 33 % | 56 % | 29 % |
| Late clip | Ground y 0.55–0.90, s 1 … 10: mean; p5 | | 26.7 … 19.2; 6.3 … 3.3 | | 25.1 … 19.2; 11.7 … 9.8 |
| Late clip | Far band y 0.22–0.30 | | 27.9 … 31.9 | | 25.7 … 29.4 |

**Pixels changed r23 → r25** (|ΔY| > 8):
- **Scored views:** A 30.2 %, dusk-fire 29.5 %, B 8.0 %, C 10.7 %, D 12.3 %.
- **Hero views and aerials:** first-frame and h1 24 %, h2 10.6 %, h3 9.5 %, h4 12.3 %, aerial-spawn 42.0 %,
  aerial-overview 14.5 %.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.7** | 1. **The sky (y 0.05–0.36). Repeated, untouched.** Navy at s 0.58 against a dusty grey dusk at s 0.36, and no ray over the tower. 2. **The right half is dark again, and the lit slopes are beige (x 0–1, y 0.40–0.62). Regression from round 24.** The saddle fell from 47.4 to 34.7 and the right band from 41.7 to 30.7 (mockup 49.5 / 45.7), with no red cast now. The new crest cuts a dark notch across the lit left slope (column rows 65 and 53 at y 0.46–0.50, mockup 68 and 77). The lit quarter is s 0.48 against 0.68. The shoulder (87 vs 83) and the near sand (73.5 vs 72.2) match. 3. **The hold (x 0.33–0.85, y 0.60–0.85). Placed better, but a different shape.** Two stacked rings and a mottled gauntlet, where the mockup has one slack loop and a smooth glove. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.9** | 1. **The near sand is a bright red-orange floor (x 0–0.3, y 0.62–0.80). Regression since round 23.** 97.3 against 67.8 (round 23 69.8); it is the bottom quarter of the frame. 2. **The ridge's light (x 0–1, y 0.40–0.55). Better, still pale.** The trough is half-shaded (71 vs 43; round 24 92), but its dark lands 0.04 low (the left column is dark at y 0.48–0.50, where the mockup's dark is y 0.42–0.48). The diagonal is 82.8 vs 96.7, at s 0.47 vs 0.65, so the lit faces read grey-tan where the mockup's are orange. The right side is shade again (stripe 28.5 vs 37.4) but warm (h16), not violet. 3. **The hold (x 0.33–0.80, y 0.60–0.85). Much closer.** Two rings where the mockup's two loops hang. The gauntlet is busier than the mockup's plain hand. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.1** | 1. **The low glow band (x 0–1, y 0.40–0.45). Repeated, unchanged.** 92 / 69 against 106 / 95. 2. **The sky (y 0.10–0.38). Repeated.** The mid sky is magenta (h321) against violet-blue (h270). 3. **The camp and the near sand (x 0–1, y 0.40–0.80). Mixed.** The backdrop right is 33 vs 29 (better). The wagon is lit hotter by the 5 cd lantern (58.4 vs 52.3). The near left went darker and pinker (33.3 h356 vs 40.9 h11). The two rings match the mockup's two loops on the right. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.5** | 1. **The open ground and far land (x 0.55–0.95, y 0.48–0.70). Repeated, closer.** The ground is 47.3 vs 33.9 (round 24 52.8) and the far land 29.8 vs 20.2. 2. **The fire and smoke (x 0.2–0.6, y 0.08–0.50). Repeated.** Upright tongues and a column, where the mockup has an up-left billow. 3. **The low sky right (x 0.6–1, y 0.40–0.47). Repeated.** 57 h302 vs 81 h341. Nit: a pale gold strip skirts the plinth's foot (x 0.42–0.55, y ~0.59), and it reads as a pad edge, not sand. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`, round 23's stand) | **6.9** | 1. **The land is soft rolling mounds, not long dark bands (x 0–1, y 0.50–0.70). Repeated.** The median is 36.6 vs 13.7 (round 23 40.2), the rows 29–38 vs 12–21, and the lit stripe 36.8 vs 54. 2. **The horizon (y 0.44–0.52). Better than round 23.** The glow line is 140 vs 161 (round 23 122), still 0.025 high. The waymark fire shows at x ~0.2 with its smoke, against the mockup's small fire at x 0.06. 3. **The hold (x 0.33–0.80, y 0.60–0.85). Better placed than round 23's lasso on the left.** But it is two broad rings, where the mockup hangs 2–3 slim vertical loops at x 0.57–0.80. |

**Seat score, Signal Dunes: (6.7 + 6.9 + 7.1 + 7.5 + 6.9) / 5 = 7.02, so 7.0.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3,
  6.6, 6.7, 6.6, 6.8, 6.9, 7.0 (round 24, D scored at the moved stand).
- **Against round 23 (6.9, the same stands):**
  - A is up 0.2: the trough, the red gone, and the hold.
  - D is up 0.1: the glow line and the hold's side.
  - C and B are up 0.1: the ground and the rings.
  - Dusk-fire is up 0.1: the shoulder and near sand match, but the saddle is back near round 23's value.
- **Held back by:**
  - A's bright near floor;
  - the beige lit faces (s 0.46–0.48 against 0.66–0.68, unchanged in three rounds);
  - D's land;
  - three skies untouched for many rounds.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| A's trough 92.4 → 71.1; diagonal 82.8 | **True** | 71.1 and 82.8 on my boxes. |
| Dusk-fire's left 72.5 (71.5), r +0.49 | **r true (+0.49); the box hides a notch and the saddle's fall** | The left column has a dark notch at y 0.46–0.50 (65 / 53 vs 68 / 77). The saddle fell from 47.4 to 34.7 and the right band from 41.7 to 30.7. Neither is in the README. |
| Red pixels A 0.9 %, dusk-fire 1.4 %; blue < 6 0 % | **True in direction, for the spawn pair's band** | My red share is 2.4 / 3.4 % (round 24 17.6 / 24.2 %), and blue < 6 is 0.0 % in both bands. But in h3's coil-free near ground 61 % of pixels still have blue < 6 (round 23 46 %). |
| Lit saturation still short, 0.47 vs 0.67 | **True** | 0.46 / 0.48 against 0.66 / 0.68. The quartile profile is still flat (0.37 0.51 0.54 0.50; mockup 0.28 0.26 0.55 0.67). |
| The dusk terms are "not fitted to B" | **Literally true, but they are built around B** | See the audit. Both ramps stop short of B's 0.50 so that B keeps the old balance, and the fill is non-monotonic as a result. |
| The saturation is "by facing, never by dusk" | **True** | `1.2 + 1.0 × smoothstep(0.2, 0.45, sandKeyN)`, with sandKeyN = terrain normal · KEY.dir: no dusk, no camera, no position. |
| B's sky weight falls continuously, half at ±30° | **True; round 24's should-fix closed** | `ease((60 − dh) / 60)`: 1 at B's heading, 0.5 at ±30°, 0.09 at 352°, 0 by 3°. The panorama's largest adjacent-column jump is 2.20 (round 23 2.22). Its change is ≤ 0.5 luma in every 15° bin, so there is no seam. |
| The lantern 3 → 5 cd | **True; it costs the wagon** | The sand pool is about level (53.2 vs 51.7), but the canvas has no sand term, so it is lit 1.67× (58.4 vs 52.3). |
| C's open ground right 44.1, left 50.1 | **True in direction** | My boxes: 47.3 (r24 52.8; mockup 33.9) and 43.5 (44.2). |
| 302c174b7: D's median 33.6 → 30.6, under luma 8 3.1 % | **Measured at the voided stand** | At the restored stand the capture shows 36.6 and 4.4 %. The README correctly lists D's bands as open. |
| The coil: two rings across x 0.33–0.80 | **True** | Every view. |
| Walk test 7 legs, 0 stuck | **True, but it does not test the new crest** | See the audit. |

## Findings, ranked by score gained

1. **Dusk-fire's saddle and right band went dark again (dusk-fire x 0.55–1, y 0.46–0.58).** *Regression from round 24.*
   - **The numbers:** 47.4 → 34.7 and 41.7 → 30.7 (mockup 49.5 / 45.7).
   - **The cause:** these faces take little key, so they live on the fill, and at dusk 0 the fill was cut 30 %
     (`fillAt × (1 − 0.3 × sunset)`). The removed warm fill on lit faces did the rest.
   - **Fix:** take the sunset's contrast from the key alone (+35 %) and drop the fill cut. That also fixes finding 4.
     Keep the shade fill's new blue (0.9, 0.9, 1.28).
   - **Accept:** saddle ≥ 44 at s ≤ 0.45, right band ≥ 40, and A's trough still ≤ 75.
2. **A's near sand is a bright floor (A x 0–0.3, y 0.62–0.80; also h1 and first-frame).** *Regression since round 23.*
   - **The numbers:** 69.8 → 97.3 (mockup 67.8); h1 69.4 → 99.6.
   - **The cause:** this ground slopes toward the key, so the steeper facing term `(tN / 0.35)^1.6` (2.1× at tN 0.9) and
     the sunset's +35 % both land on it, while the crests the mockup lights get less.
   - **Fix:** cap the facing response above tN ≈ 0.5 (e.g. `pow(min(tN, 0.5) / 0.35, 1.6)`) so that key-facing near
     ground stops gaining, and keep the gain on the 0.3–0.5 faces of the diagonal.
   - **Accept:** A's near sand ≤ 75, the diagonal ≥ 82, and dusk-fire's near left within ±6 of 72.
3. **The lit faces are beige, not orange (A and dusk-fire y 0.36–0.56).** *Repeated, three rounds.*
   - **The numbers:** lit quarter s 0.46 / 0.48 against 0.66 / 0.68. The saturation-by-quartile profile is flat where
     the mockups rise steeply from shade to light.
   - **The cause:** the new 2.2 boost follows the normal, so it saturates the key-facing near floor (s 0.62–0.65), not
     the far crests' lit flanks.
   - **Fix:** drive the boost by the share of direct light in the final colour (direct / (direct + indirect)), so any
     face the key actually lights gets it, whatever its normal. Keep the max-channel floor so that blue never clips
     (the min / max ≥ 1/3 limit from round 24's seat B).
   - **Accept:** lit quarter s ≥ 0.55 at h 18–24; red share ≤ 5 %; h3's near ground blue < 6 under 20 %.
4. **The fill is non-monotonic around B's dusk (`dusk.ts fillAt`).** *Should-fix, the R11-5 pattern again.*
   - **The curve:** 0.70 at the sunset, 1.02–1.03 over dusk 0.4–0.6 (B at 0.50), 0.87 at 0.74, and 0.70 at the
     waymarks' 0.86.
   - **Why it is fitted around B:** both ramps were anchored so that B's 0.50 keeps the old value. The comments say
     "easing to the old balance by the logbook's dusk" and "after the logbook's step".
   - **Fix:** a non-increasing fill (finding 1's fix gives one).
5. **A's trough shade lands low, and the new crest marks dusk-fire (A and dusk-fire x 0–0.4, y 0.42–0.50).** *New.*
   - In A, the band y 0.42–0.46 is still lit (61 vs 38–39), while the dark sits at y 0.48–0.50.
   - In dusk-fire, the crest's west end (x −20 m) shades the lit slope the mockup keeps rising.
   - **Fix:** set the 2.5 m crest a few metres farther north, so that its shadow rises in A's frame, and taper its
     west end. This is terrain, not a camera, and it moves both views toward their mockups.
   - **Accept:** A's left column ≤ 50 over y 0.42–0.48, and dusk-fire's ≥ 65 at y 0.46–0.50.
6. **D's land (D x 0–1, y 0.50–0.70).** *Repeated.*
   - **The numbers:** median 36.6 vs 13.7; rows 29–38 vs 12–21.
   - Under the lead's ruling this is a terrain job at this stand: two or three transverse lees with lit rims.
   - **Accept:** full-width rows ≤ 25 with sd ≥ 6; the clip's late p5 ≥ 9 (now 9.8).
7. **The untouched skies.** *Repeated.*
   - dusk-fire: s 0.58 vs 0.36;
   - B's glow: 92 / 69 vs 106 / 95;
   - C's low sky right: 57 h302 vs 81 h341.
   - **Fix:** panorama edits that are smooth across headings (round-22 ruling).
8. **Process.**
   - **The walk test** misses the new terrain (see the audit). Add a leg across (−20…8, 29…39).
   - **The README** omits the dusk-fire saddle and A near-sand regressions. Name every metric the batch moved away.
   - **The perf pill** is red ("bad": p50 > 33.4 ms or over the draw budget) in mock-D, as it was once in round 20 and
     in aerial-spawn every round. Confirm the draw budget isn't over at D's stand.
   - **The QA screen check** was skipped (the model lock); I checked every frame by eye, and all are world frames.

## Ledger-5 audit

- **Cameras: unchanged, mock-D restored.**
  - All twelve `camAt` entries (pos, dir and fov) are identical to round 23's.
  - mock-D is at (37.99, 27.59, 121.99), yaw 21.7, pitch −2.0; the ground there is 25.90 m in all three bakes.
  - `cameras.json` at a37cbc421 lists D at (38, 122) yaw 21.7, and the README's "no camera changed" is right.
- **The dusk terms: global and reached by play, not fitted to a staged value. Should-fix (finding 4), not a void.**
  - **The real dusks:** 0 before Sefa (A, dusk-fire, h1–h4, the aerials); 0.50 for B; 0.74 → 0.86 for C and D.
  - **The sunset term** (`d / 0.4`) acts only below 0.4. That is the whole pre-quest world, which a player can roam at
    will, plus the ~20 s ease to 0.5, so it is real state and not a per-view grade.
  - **The late fill** (0.6 → 0.9) has neither end on a staged value; C and D sit inside its ramp.
  - **Not fitted to B:** neither ramp ends at B's 0.50 (B gets 0 of each), so the builder's claim holds literally.
  - **What is wrong:** the two ramps bracket B to keep B unchanged, and that makes the fill non-monotonic.
    `keyAt` stays monotonic.
- **The facing-driven saturation is one global term.**
  - It takes `sandKeyN`, the terrain normal against the constant KEY.dir, with no camera, position or dusk input.
  - KEY.color (1, 0.68, 0.34) and the steeper direct term are constants too.
  - It does not hide a material gap: the lit faces are still s 0.46–0.48, and I scored them as they are.
- **Camera distance: none.**
  - The diff since 8f296fb4b adds no `cameraPosition`, view-distance or fog term.
  - The new fire falloff is distance to the fire light.
  - The existing zero-mean fades (`sandFar`, the sheen view terms) are untouched.
- **Fog: unchanged.** The clip's far band climbs 25.7 → 29.4 through the late dusk, toward the sky. The late ground's p5
  is 9.8–11.7 (round 23 3.0–3.3): no black blots.
- **The sky edit: smooth across headings (round-22 ruling met).** It is a 120°-wide ease with no flat top, at
  infinity, and has no seam.
- **The new crest (layout.ts, third `crests` entry): real terrain, legitimate.**
  - **The shape:** 143 cells changed (x −23…7, z 19…42), with a lift of up to 2.1 m.
  - **The slopes:** max 27.5°, p95 23.4°, under the 40° climb.
  - **The placement:** it is aimed by the spawn's view and the key (its line is within 1° of perpendicular to the
    key's azimuth). The lead's E407 brief allows that ("author the composition the mockups show as explicit landforms,
    judged from the spawn").
  - **What it costs:** dusk-fire (finding 5), and a second dark lens in aerial-spawn. That is a look cost, not
    narrowing.
- **The walk-test file `progress/physics/sd-r25-b-mussawzm.json`: genuine, but it does not cover the change.**
  - **The result:** 7 legs, all `stuck: []`, with 0 air, slide and swim frames, and `walkErrors: []`.
  - **When it ran:** 19:28:07 UTC, before the 19:41 UTC commit.
  - **What it misses:** none of its 7 legs touches the 143 changed cells, so it cannot show that the crest walks. The
    slope check above is the evidence that it does.
- **Staging: unchanged.**
  - `plugin.ts` was untouched since round 23, and the `staged` map is the same.
  - `pageErrors: []`; 59 programs.
- **Still props and frozen poses:** none new. The hold is one idle pose (`LOOP`) in every shot.
- **No narrowing.**
  - The heroes moved with the global light: h1 and first-frame near ground brighter (finding 2), h2's clipping down
    (33 → 29 %), and h3's up from round 23 (46 → 61 %).
  - Aerial-overview reads as more sculpted dunes, and the clip holds.
  - A look cost, nothing removed.

No score is voided.

SCORE signal-dunes: 7.0

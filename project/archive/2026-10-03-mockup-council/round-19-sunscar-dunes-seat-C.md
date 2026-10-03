# Round 19, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (Jake's 7.0 bar and phase amendments), the brief, `scores.md` (the restated
  camera-distance rule and the lead's key-light ruling), and round 18's seat B and C files.
- The "Signal Dunes, round 19" section of `art/mockup-council/round-19/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1047-671128ac/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), against round 18's `20261003-1028-52e843cd/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 5e8904aa9, b85f9f84f, 5baedc054 and 671128acd; `plugin.ts` (`duskOf`, `stage`),
  `look/painted.ts`, `look/render.ts`, `species/duneRay.ts`, `combat/creatures.ts`, `layout.ts`, `world/fireFx.ts`,
  `world/meshes.ts`, and `scripts/shard-progress.mjs`.

**How I measured:** the same tools and regions as my round-18 file. Its r18 numbers reproduce exactly (for example,
A's upper sky 100.0, dusk-fire's saddle 73.9, the flame's 121 pixels over 245).
- Rec. 709 luma on the decoded JPEGs; **sat** = mean (max − min) / max.
- **Clean sand:** x 10–150, y 1180–1400.
- **Regions:** frame fractions (x left → right, y top → bottom).
- **Row-demeaned r:** the Pearson r of a 10×7 grid of σ-12 luma, with each row's mean removed.

**The short version:**
- **Two real gains.**
  - **The spawn pair's upper sky is fixed.** A's is 37.5 against the mockup's 36.3 (r18 100), and dusk-fire's is 38
    against 45 (r18 101). Both are navy with stars over an orange band.
  - **The light is no longer mirrored.** Row-demeaned r: dusk-fire +0.42 (r18 −0.24), A +0.14 (r18 −0.29). Dusk-fire's
    saddle is 48.2 against 49.5 (r18 73.9), and its lit shoulder 85 against 83.
  - The builder's correlations reproduce to 0.01.
- **But the "one horizon" fix painted vertical streaks** into the low sky in every view that looks at the glow (A,
  dusk-fire, h1, the first frame, the aerials, the clip). `max(elev, 2.5)` smears the strip's 2.5° row straight down
  to the horizon, and it took the hot horizon line with it (D's peak 125 against 166).
- **Smaller changes:**
  - **The smoke went invisible.** C's plume and B's caravan wisp are now dark on a dark sky; both mockups show a lit
    grey plume.
  - **The lit sand went beige again,** losing round 18's gain.
  - **A's lit diagonal, the mockup's central feature,** is still 46 against 97, the same as in r17 and r18.
- **Ledger 5: no breach.**
  - The key is one compile-time direction.
  - The ray's patrol is ordinary brain code that no capture code touches. It shows up in A, which has no ray, and is
    missing from dusk-fire, which does.
  - The blend window is global and monotonic, but its two ends sit on the staged dusks, so no scored view ever shows a
    blend.
  - Three should-fixes are below.

## Measurements (mockup / r18 / r19)

| View | Region | Mockup | r18 | r19 |
|---|---|---|---|---|
| A | Upper sky, x 0.05–0.55, y 0.11–0.16 | 36.3 (34,34,62) | 100.0 | **37.5** (43,32,78) |
| A | Sky, y 0.17–0.22 / 0.22–0.26 / 0.26–0.30 (x 0.05–0.55) | 58.0 / 77.5 / 97.0 | 113 / 126 / 136 | 59.5 / 90.4 / 110.5 |
| A | Horizon peak (row mean, x 0.62–1) | 162 | 183 | **132** |
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 47.6 | **46.4** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 73.7 | 51.0 |
| A | Far strip right, x 0.6–1, y 0.385–0.405 | 38.2 | 59.5 | 55.0 |
| A | Clean sand | 56.7, sat 0.59 | 64.6 | **76.3**, sat 0.63 |
| A | Over 80 in the band (y 0.36–0.56), left / right half | 28 / 17 % | 9 / 33 % | 42 / 9 % |
| dusk-fire | Upper sky, x 0.05–0.55, y 0.11–0.16 | 45.1 (46,42,48) | 101.3 | **38.0** (42,32,79) |
| dusk-fire | Sky, y 0.24–0.30 | 83.9 | 135.4 | 107.9 |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 74.4 | **85.4** |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 | 73.9 | **48.2** |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 66.2 | 49.7 |
| dusk-fire | Over 80 in the band, left / right half | 25 / 1 % | 17 / 30 % | 25 / 4 % |
| B | Upper sky, x 0.05–0.6, y 0.12–0.20 | 34.4 (27,31,73) | 84.2 | **19.9** (13,14,70) |
| B | Mid sky, x 0.05–0.4, y 0.25–0.38 | 57.4 | 106.5 | 54.3 |
| B | Glow band left of the wagon, x 0–0.35, y 0.40–0.45 | 111.1 (199,102,78) | 116.9 (183,107,154) | 95.0 (158,83,131) |
| B | Backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 53.1 | 35.6 |
| B | Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 67.8 | 60.1 |
| C | Upper-left sky, x 0.02–0.3, y 0.10–0.30 | 43.5, sat 0.38 | 26.3, sat 0.80 | 20.3, **sat 0.92** (1,13,82) |
| C | Plume, x 0–0.2, y 0.20–0.35 / column above the fire, x 0.35–0.6, y 0.02–0.12 | 52.1 / 24.1 | 33.9 / 55.4 | 33.1 / **7.9** |
| C | Flame box: pixels over 150 / 230 / 245 | 13 729 / 5 554 / 2 720 | 10 267 / 2 246 / 120 | 10 768 / **4 223 / 833** |
| C | Skyline at x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | .469 .466 .463 .430 .455 | .488 .485 .483 .483 .485 | **.455 .451 .450 .450 .451** |
| C | Far land, x 0.6–0.9, y 0.48–0.53 / ground right, x 0.55–0.95, y 0.60–0.70 | 16.1 / 33.7 | 37.8 / 55.6 | 34.4 / 56.2 |
| D | Horizon peak (row mean, x 0–0.7) | **166** at y 0.497 | 130 | **125** |
| D | Land, x 0–0.5, y 0.52–0.62 / lit near band, x 0–0.4, y 0.64–0.68 | 16.0 / 58.9 | 36.1 / 37.3 | **43.1** / 42.6 |
| D | Upper / mid sky (x 0.05–0.7, y 0.08–0.30 / 0.30–0.40) | 38.9 / 61.8 | 44.1 / 75.5 | 44.1 / 75.5 (unchanged) |
| D | Glove back: Y, p95, fine (mockup x 570–720, y 1110–1260; game x 460–610, y 1120–1270) | 33.7, 83, **8.1** | 34.3, 59, 2.4 | 35.3, 57, **3.1** |
| A, dusk-fire | Loop top (first dark cord row, x 0.38–0.62) | about 0.60 | 0.502 | 0.534 |

**Sand saturation by luma bin** (y 0.38–0.50 full width, plus x 0–0.22, y 0.50–0.70). The bins are 20–40, 40–60,
60–80, 80–100 and 100–120:

| View | Mockup | r18 | r19 | Shade (Y < 45) B/R, mockup / r18 / r19 | Lit (Y > 65) G/R, mockup / r18 / r19 |
|---|---|---|---|---|---|
| A | 0.25 / 0.35 / 0.59 / 0.65 / 0.67 | 0.34 / 0.48 / 0.62 / 0.56 / 0.42 | 0.29 / 0.45 / **0.51 / 0.51 / 0.46** | 0.96 / 0.76 / **0.86** | 0.55 / 0.56 / **0.69** |
| dusk-fire | 0.20 / 0.56 / 0.68 / 0.69 / 0.65 | 0.34 / 0.41 / 0.59 / 0.59 / 0.42 | 0.29 / 0.48 / **0.54 / 0.53 / 0.46** | 1.00 / 0.76 / **0.90** | 0.55 / 0.58 / **0.65** |

- The shade is cooler and greyer: a gain toward the mockups.
- The lit sand lost round 18's orange. G/R rose from 0.56–0.58 to 0.65–0.69, so it reads beige, as in r17.

**The low-sky streaks.** Under 2.5° the dome repeats the strip's 2.5° texel row straight down (painted.ts
`max(elev, 2.5)`). Every column bit at that row (a cloud edge, a range top, a star-removal speck) becomes a vertical
stripe down to the 3D ranges.
- Contrast-stretched, they are obvious in A and dusk-fire (y 0.30–0.36 either side of the tower), h1, the first frame
  and aerial-spawn (y 0.03–0.13).
- They are plainest in the clip: an aurora-like curtain over the whole horizon in all ten frames.
- Round 18 had none.
- The clamp also flattened the hot line just above the horizon. Horizon peaks: A 132 against 162 (r18 183,
  overshooting), dusk-fire 121 against 131, D 125 against 166, B 114 against 128.

**The late clip (1 fps):**
- The ground (y 0.55–0.90) is 31.1, 33.4, 33.1, 32.5, 31.4, 29.8, 28.1, 26.5, 25.2, 24.4 (r18 30.5 … 22.2), with no
  step.
- The double violet horizon is gone; the streaks replace it.
- The waymark wisps that r18 showed are gone.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.6** | 1. **The forms (x 0–1, y 0.40–0.85). Repeated.** The mockup's near-left is one big lit slope with a crisp diagonal crest falling to a blue-violet saddle. The game has a flat lit floor (y 0.52 down), a soft-edged shade band and a lumpy right dune. The light now sits on the right sides (saddle 48 against 49.5, shoulder 85 against 83, r +0.42), a real gain, but the far strip is still pale (50 against 34.5) and the lit sand beige (G/R 0.65 against 0.55). 2. **The sky (y 0.05–0.36). Mostly fixed, with a new artifact.** Navy over an orange band, as in the mockup. Still more saturated and hotter in the band (108 against 84), and vertical streaks hang right of the tower down to the ranges (x 0.6–1, y 0.30–0.36). The mockup's big dark ray (x 0.2–0.6, y 0.2–0.27) is absent. 3. **The hold (x 0.3–1, y 0.53–0.86). Repeated.** A small upright ring on the handle (top 0.534) and a straight cord to the HUD, against the mockup's one low loose loop (top about 0.60). The glove's back reads. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.4** | 1. **No lit crest diagonal (x 0.3–0.8, y 0.38–0.56). Repeated since round 9.** 46.4 against 96.7, unchanged for three rounds. The light is now on the left (42 % over 80 against 28 %) and off the right (9 % against 17 %), so r is +0.14. But the mockup's defining sweep of lit, crisp crest is a soft, blurred shadow band here. The near floor is too bright (76 against 57). 2. **The sky (y 0.05–0.37). A big gain with a new artifact.** The upper sky matches (37.5 against 36.3, stars). The band runs hot (110 against 97). The mockup's red-orange cloud banks are dark violet streaks. Vertical streaks hang either side of the tower. A pale ray, which the mockup doesn't have, glides at x 0.27, y 0.28. 3. **The hold (x 0.25–1, y 0.53–0.88). Repeated.** One upright ring on a stick with a straight cord, where the mockup has two broad coils at the bottom edge. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.5** | 1. **The sky (y 0.05–0.45). Better, but now too dark and missing its band.** The lilac is gone (mid 54 against 57). The top is too dark and saturated (19.9, (13,14,70), against 34.4): the early stage's ×0.64 applies at B's dusk 0.50 (4 % late). The mockup's clean orange band (111, (199,102,78)) is a dim magenta (95, (158,83,131)), with pink cloud streaks across a sky the mockup keeps clear and starry. 2. **The caravan's plume (x 0.45–0.55, y 0.15–0.45). New.** The mockup's pale lit plume over the wagon is gone. r18's dark wisp is now invisible on the darker sky. 3. **The horizon and land (y 0.40–0.50).** The backdrop is closer (35.6 against 21.5; r18 53), but the land left of the camp is 60 against 39. The wagon is unchanged (smooth canvas). The smaller ring still stands over the cargo's line. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.2** | 1. **The fire and sparks (x 0.25–0.55, y 0.05–0.46). Gain.** The white-hot core is real now: 833 pixels over 245 (r18 120; 31 % of the mockup's 2 720) and 4 223 over 230 (76 %). The sparks now stream up-left as in the mockup. The logs still barely read. 2. **The smoke and upper sky (x 0–0.6, y 0–0.35). New and repeated.** No plume at all: the mockup's grey-brown billow up-left (52) is bare sky (33), and the column is dark navy (7.9). The upper sky is still a saturated royal blue (sat 0.92, (1,13,82)) against violet-grey (sat 0.38). 3. **The ground, skyline and hold (y 0.44–0.75).** The skyline now sits at the mockup's height (0.450–0.455 against 0.43–0.47), but as a smooth hump of lit land (34 against 16). The open ground is still too lit (56 against 34). The smaller ring still cuts the plinth's lower left. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.3** | 1. **The horizon and sky (y 0.05–0.50). Repeated, horizon worse.** The sky is unchanged: pink cloud streaks across a mid sky the mockup keeps clean and starry (75 against 62). The peach horizon line, the mockup's brightest feature, peaks at 125 against 166 (r18 130), since the 2.5° clamp removed the strip's hottest rows. 2. **The land (y 0.50–0.72). Repeated, slightly worse.** A flat field at 43 (r18 36) against dark bands at 16, with the lit near band 43 against 59. The "SIGNAL TOWER 200" label still sits over the tower. 3. **The hand (x 0.55–1, y 0.6–0.86).** The leather gained a little (fine 3.1, r18 2.4, against 8.1; p95 57 against 83). One upright ring on a stick replaces the mockup's coils hanging beside the fist. The waymark's wisp is gone (a small gain; the mockup has none). |

**Seat score, Signal Dunes: (6.6 + 6.4 + 6.5 + 7.2 + 6.3) / 5 = 6.60, so 6.6.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3.
- Up 0.3 from r18:
  - dusk-fire +0.6, B +0.2 and A +0.4, from the sky and the un-mirrored light, less the streaks and the beige sand;
  - C +0.2, from the core and the sparks, less the missing plume;
  - D −0.1, from the horizon line and the brighter land.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The key: dusk-fire +0.42, A +0.13 | **True** | My grid gives +0.42 and +0.14. |
| "By eye: the near-left slopes lit, the near-right in shade, as in dusk-fire" | **True for the light, not for the forms** | The saddle and shoulder match in value. The lit diagonal slope itself doesn't exist. |
| Sky: A's top 40 / 41, D 31–116 / 40–115 | **True** | A's is 37.5 against 36.3; D's is unchanged from r18. |
| Sky: "B within a few points" | **False** | B's top is 19.9 against 34.4, and its band is magenta 95 against orange 111. |
| "One horizon": the painted ranges no longer float as a second horizon | **True, but it made a new artifact** | The double horizon is gone. In its place are vertical streaks under 2.5° (A, dusk-fire, h1, the first frame, aerial-spawn, the clip), and lower horizon peaks (D 125 against 166). |
| No seam at 45° | **True** | h3's sky is a clean navy with stars (r18: an electric-blue cap with a ragged edge). |
| A lit smoke, warm at its foot | **Not visible** | C's plume region is 33 (bare sky; mockup 52), and the column 7.9. There is no warm foot in the frame. |
| A larger white-hot core | **True (partly)** | 833 over 245 against 2 720 (r18 120). |
| Procedural leather | **True, small** | Fine 3.1 against 8.1 (r18 2.4). |
| The loop's top below the crosshair, clearing C's plinth | **Half true** | The top is 0.534 (r18 0.502; mockups about 0.60). In C the ring still cuts the plinth's lower left. |
| A violet shade | **True** | Shade B/R 0.86–0.90 (r18 0.76; mockups 0.96–1.0); sat in the 20–40 bin 0.29 (mockups 0.20–0.25). |
| Lit sand 0.50–0.58 under the new key | **True, and a regression** | 0.46–0.54 in the upper bins against 0.59–0.69. r18 had 0.59–0.62 in the 60–80 bin. |
| Skylines: B's dune 24 m, waymark 0's rise 25 m | **C yes, B partly** | C's skyline is 0.450 against 0.43–0.47 (r18 0.485). B's right edge is mixed, 0.428–0.458 against 0.418–0.440. |
| Row 5: the ray over the tower "as mockup dusk-fire shows" | **Not in the frame** | dusk-fire has no ray. A, which has no ray in its mockup, shows a small pale one. From the spawn, the patrol's nearest point is about 111 m (145 − 34), so it can never reach the mockup's near, frame-filling ray. |

## Findings, ranked by score gained

1. **Remove the low-sky streaks and restore the horizon line (A, dusk-fire, D, B; y 0.30–0.36, D y 0.45–0.50; h1,
   aerials, clip).** *Regression (new this round).*
   - **Cause:** `max(elev, 2.5)` in `look/painted.ts` stretches one texel row downward.
   - **Fix:**
     - Below 2.5°, don't clamp to a row. Repaint (inpaint) the strip's 0–2.5° rows without the ranges, keeping their
       glow, so the hot line survives under the 3D ranges.
     - Or, at minimum, take the 2.5° row averaged over ±2–3° of heading (as the top's 8-tap average does) and add a
       short vertical gradient toward the band's peak.
   - **Accept:**
     - No column structure in the clip or the aerials by eye.
     - Horizon peaks: D ≥ 145 (mockup 166), A 150–165, dusk-fire 125–135.
2. **A's lit diagonal (A x 0.3–0.8, y 0.38–0.56).** *Repeated since round 9; the light is now right, the form is not.*
   - The key is settled (one global NNW key). What's missing is a face that key lights *and* that the spawn eye
     sees: a long windward slope rising away from the camera across the middle of A, below the 23 m eye.
   - **Fix:** shape round 13's crest so a broad north-west-facing windward slope sits under the eye at x 0.4–0.7.
     Test it offline with N·L on the bake from the spawn eye, as the key was tested. One world: check it in h1 and the
     aerial-spawn too.
   - **Accept:** A's diagonal ≥ 75; the shade under it ≤ 50; dusk-fire's r stays ≥ +0.35.
3. **The lit sand back to orange, the near floor down (A, dusk-fire; band y 0.38–0.56, clean patch).** *Regression of
   round 18's gain.*
   - Under the new key, lit G/R is 0.65–0.69 against 0.55, and the upper bins' sat 0.46–0.54 against 0.59–0.69.
   - A's clean sand is 76 against 57.
   - **Fix:** re-tune the direct light's saturation and the key colour for the new direction. The ×2.1 and the
     (1, 0.8, 0.44) were set under the old key. Push the key colour toward amber for the lit faces only, and lower the
     flat-floor response (the 0.12 + 0.88 N·L ramp lifts flat ground under a key only 11.5° up).
   - **Accept:** the 60–120 bins ≥ 0.6; lit G/R ≤ 0.6; A's clean sand 55–65 with dusk-fire's at 70–76.
4. **The smoke is invisible (C x 0–0.6, y 0–0.35; B x 0.45–0.55, y 0.15–0.45).** *New.*
   - The plume's upper colour (0.024, 0.02, 0.022) linear is darker than the late sky, so the mockups' grey plumes
     (C 52, a lit billow drifting up-left; B a pale column over the wagon) are gone.
   - **Fix:** give the plume a grey-brown body about 1.5–2× the sky beside it, lit warm by the fire over its lower
     third, broken into puffs. Keep the global breeze (it now drifts left with the sparks, as in C). Give the caravan's
     wisp the same treatment.
   - **Accept:** C's plume region 40–55 against the sky's 20–33; B's plume visible above the wagon at about 1.5× the
     sky.
5. **B's sky: too dark at the top, no orange band (B y 0.05–0.45).** *New (half fixed).*
   - The early stage's ×0.64 (fitted at A) leaves B's top at 19.9 against 34.4. B's band is magenta (h about 320)
     against orange (h about 18).
   - **Fix:** do it in the painting by heading, which is world-space and global. At B's heading (about 303°), lift the
     strip's top rows and warm its low band to orange, and thin the pink cloud streaks there. Don't move the dusk window
     to give B the late strip.
   - **Accept:** B's top 30–40; band left of the wagon ≥ 100 at hue 10–30; A's top still ≤ 45.
6. **C's royal-blue zenith and D's pink cloud streaks (C x 0.02–0.3, y 0.10–0.30; D y 0.30–0.49).** *Repeated.*
   - **Fix:** in the late strip, desaturate the zenith toward violet-grey at C's heading and clear the clouds at D's
     heading (about 338°).
   - **Accept:** C's upper-left sat ≤ 0.5; D's mid sky 60–70 with no streaks.
7. **D's land and C's far land (D y 0.50–0.72; C x 0.6–0.9, y 0.48–0.53).** *Repeated; D worse.*
   - D is 43 against 16 (r18 36), and C 34 against 16. The cooler, flatter fill lifted the late land.
   - **Fix:** under the late dusk, let the away-from-glow faces fall further. That is the existing `away` term, by
     facing, never by distance. Keep D's one lit near band.
8. **The hold (all five).** *Repeated.*
   - The ring's top is 0.534 against about 0.60, and it is one upright ring where the mockups have one or two low,
     loose coils.
   - It still cuts C's plinth.
   - **Fix:** hang the coil from the fist, below and beside it, as in A's and D's mockups. It stays the one idle hold.
9. **The fire's logs and the glove's leather (C x 0.3–0.45, y 0.33–0.5; D x 0.55–1, y 0.6–0.86).** *Repeated, both
   gaining.*
   - The logs don't separate inside the flame.
   - The leather's fine detail is 3.1 against 8.1. Raise the crease and grain amplitude about 2×, and add a knuckle
     highlight.
10. **Nits:**
    - The ray in A reads pale, like a glider. The mockups' ray is a dark silhouette.
    - "SIGNAL TOWER 200" still sits over D's tower.
    - The cast-shadow edges from the low NNW key are soft blobs, visible in the aerial-overview and A's middle band;
      the mockups' terminators are crisp.

## Ledger-5 audit

- **The decoupled key: one global direction. No breach.**
  - `KEY.dir` (−0.34, 0.2, −0.92), 20.3° left of north and 11.5° up, is a module constant.
  - It is baked into the dune shadow (`bakeDuneShadow`), inlined into every sand-shader term, and passed to
    `sky.setKeyLight`. Only its colour and intensity follow the dusk.
  - There is no per-view, per-camera or per-stage input. The aerials and h4 show one consistent world: shadows fall
    south everywhere.
  - **Red-team note:** it was picked as the best of seven candidates on the two scored spawn views' correlation. The
    ruling allows exactly that, but it is a front-left key, not the "behind-left" the ruling describes (behind-left
    scored −0.18 to +0.09).
  - It also lights h4's far land, front-lit from the deck, to 81 (r18 46). That is a consequence of the world, not a
    trick.
- **The ray's patrol: ordinary behaviour, not a stage. No breach.**
  - `DuneRayBrain.glide` circles `RAY_HOME` (now the tower) at 34 m and 22 m up whenever no player is within 55 m.
  - The capture's calm (`active: []`) takes the same branch a far player does.
  - `scripts/shard-progress.mjs` and the stage handlers don't touch the ray, and its position in a frame is whatever the
    clock gives: it is in A (not in A's mockup) and absent from dusk-fire (the mockup it was built for).
  - **Pacing, for the lead:**
    - The ray's home moved from 44 m off the spawn, inside its notice range (first contact at the start), to the tower.
    - Braziers sit 37, 65 and 74 m from the tower, so it still fights at the waymarks. The skitterer packs keep the
      early combat.
    - Not a narrowing, but the first-contact moment moved.
  - The parity `ray` dev pose (yaw −60 / pitch 18 → −3 / 9) has no mockup and is not a mock camera. It now nearly
    duplicates the `spawn` pose (nit).
- **The sky's blend window, dusk 0.45–0.86: global and play-reached, but its ends sit on the staged values.
  Should-fix, not a breach.**
  - The quest's dusks are 0 (spawn), 0.50 (Sefa), 0.52, 0.56, 0.62, 0.74, 0.86 (third waymark) and 1.
  - Smoothstep over [0.45, 0.86] gives A and dusk-fire 0 % late, B **4 %**, and C and D **100 %**. That is exactly
    round 18's split.
  - So the window answers seat C's "2 s swap" for play: the painting now moves at every quest step. But it keeps every
    scored view on one end. The blends a player sees from the logbook to the second waymark (9–79 % late) are never
    scored; only the clip shows them, streaks included.
  - The early stage's ×0.64 is one global factor, fitted to A's top at dusk 0. It is what makes B's top 20 against 34
    (finding 5).
  - **Fix:**
    - State the window as a design choice (it starts at Sefa and ends at the last waymark).
    - Add one unscored check shot at the oil dusk (0.56) to every round's capture, so a mid-blend sky is on the
      surface.
    - Fix B in the painting, not the window.
- **The camera-distance rule: no breach.**
  - The new shader code reads only light, the sky direction or the smoke's height (`y`).
  - The glove's bump is in view space by derivatives, a surface normal, not distance.
  - The FX's `vFar` fades are the pre-existing watch item from round 18, unchanged.
  - The late clip's ground holds at 24–33 with no step.
- **No screenshot cheats.**
  - The sky is a camera-centred dome at infinity sampled by direction; the 2.5° clamp is ugly but stays at infinity.
  - The landforms are baked terrain, and the fire's light is a real `PointLight`.
- **Global grade: none.** `lut: null`. The shade's cooling is in the fill light, global. The ×0.64 is the sky
  painting's own brightness.
- **The views:** `cameras.json` is unchanged (a4219aa).
  - The only real-eye move is h3's +5.01 m with waymark 0's rise (20 → 25 m), as listed.
- **Staged state: unchanged handlers.** B is at dusk 0.50, and C and D at 0.86. D's sky is identical to r18's, so the
  capture waited for the eased dusk.
  - **Should-fix (repeated):** waymark 0 now crowns a 25 m, r 80 rise. The bake's max slope is 39.1° against the 40°
    climb limit, and the navmesh lost 48 of 772 polys.
  - The `waymarks-lit` stage lights it through `onInteract` without a walk.
  - Run `physics-baseline.mjs --mode=walk` (and `--trails`) to waymark 0 and quote 0 stuck.
  - The mounds raised "for skylines" (B's dune, waymark 0's rise) are still landforms placed by frames (round 13's
    should-fix). They are real, walkable terrain, so this is no breach.
- **Still props and frozen poses:** the flame animates, the hold is the one idle pose, and the ray is in free flight.
- **No narrowing:**
  - The hero views hold or gain: h3's seam is gone, and h1's and the first frame's skies are navy.
  - Two losses outside the scored five:
    - the streaks in h1, the first frame, the aerials and the clip;
    - the waymark and caravan smoke gone everywhere.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD, the 30 fps / 33 ms chip, `pageErrors: []`, no QA
  retakes, and 57 programs.

No score is voided.

SCORE signal-dunes: 6.6

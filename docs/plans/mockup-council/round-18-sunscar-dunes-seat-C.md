# Round 18, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 bar and phase amendments), the brief, `scores.md` (with the
  restated camera-distance rule and the lead's key-light ruling), and round 17's three Signal Dunes seat files.
- The "Signal Dunes, round 18" section of `art/mockup-council/round-18/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1028-52e843cd/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), against round 17's `20261003-0947-8c70feaf/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.

**Source checks (read-only):**
- `git show` of dc811cc20 (the painted sky), 653a4296f (the fire), 011e46d7b (the light), af0d299b4 (the glove) and
  the shard diff 8c70feaf2..52e843cdb (10 files).
- `look/painted.ts`, `look/dusk.ts`, `plugin.ts` (`duskOf`, `stage`) and `world/fireFx.ts` at 52e843cdb.
- The shipped strips `public/assets/sunscar-dunes/sky/dusk-{early,late}.webp` (4096×603), decoded and sampled at
  each view's heading and elevation; `art/sunscar-dunes/round-25-sky/{pano,prep,edit_stage,early_fix}.py`.

**How I measured:** the same tools and regions as my round 17 file; my r17 numbers reproduce to 0.1.
- Rec. 709 luma on the decoded JPEGs; **sat** = mean (max − min) / max.
- **Clean sand:** x 10–150, y 1180–1400.
- **Regions:** frame fractions (x left → right, y top → bottom).

**The short version:**
- **Two real gains: the fire and the glove's pose.** The flame is now orange tongues on the bowl, and a real point
  light pools on the plinth and the sand. The glove shows the back of the hand and the cuff, as D and dusk-fire do.
- **The lit sand is warmer.** In the 60–80 luma bin it now matches (A 0.62 against 0.59, dusk-fire 0.59 against
  0.68). The top bins still go grey (0.42 against 0.65–0.67).
- **The painted sky is a regression in four of the five views.**
  - A's upper sky is 100 against 36 (r17 38). It is magenta, where the mockup's is a navy night with stars.
  - Dusk-fire's is 101 against 45. B's upper sky is 84 against 34 (r17 32: it matched).
  - D's horizon band is 83 against 148 (r17 97), and it has pink cloud streaks where the mockup's sky is clean.
- **The builder's main sky claim is false for B.** The commit says B sits at dusk 0.52 and so gets the late painting.
  B's stage (Sefa met, book unread) is `duskOf` = **0.50**, and the blend `smoothstep(0.50, 0.54, dusk)` is **0** there.
  So B shows the early painting.
  - The late strip at B's heading is 36 luma (43, 29, 80), the mockup's value (34).
  - The early strip there is 77 (93, 66, 139). That is what B shows.
- **The light placement is unchanged.** As the README says, the key ruling came after the capture. A's diagonal is
  47.6, identical to r17's.
- **Ledger 5: no breach** (audit below). The painted sky is a world-space, seamless panorama, and the fire's light is
  real. Two should-fixes:
  - the sky's stage blend was fitted to the staged dusk values, and it swaps the whole sky in about 2 s of play;
  - the strip's painted ranges float above the real 3D ranges as a second, violet horizon from altitude (the aerials
    and the clip).

## Measurements (mockup / r17 / r18)

| View | Region | Mockup | r17 | r18 |
|---|---|---|---|---|
| A | Upper sky, x 0.05–0.55, y 0.11–0.16 | **36.3** (35,34,62) | 38.3 | **100.0** (163,79,119) |
| A | Sky, x 0.1–0.9, y 0.18–0.33 | 93.7 | 98.8 | **132.2** |
| A | Horizon glow, x 0.6–1, y 0.33–0.36 | 114.8 | 112.6 | **172.5** |
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 47.6 | **47.6** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 78.4 | 73.7 |
| A | Far strip right, x 0.6–1, y 0.385–0.405 | 38.2 | 64.6 | 59.5 |
| dusk-fire | Upper sky, x 0.05–0.55, y 0.11–0.16 | **45.1** (48,44,50) | 38.2 | **101.3** (161,81,124) |
| dusk-fire | Sky, y 0.24–0.30 | 85.0 | 117.1 | **134.0** |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 (130,73,40) | 74.1 (104,68,49) | 74.4 (116,65,43) |
| dusk-fire | Saddle (loop-free), x 0.55–0.9, y 0.46–0.56 | 49.5 | 79.9 | 73.9 |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 79.0 | 66.2 |
| B | Upper sky, x 0.05–0.6, y 0.12–0.20 | **34.4** (28,32,74) | 32.3 | **84.2** (80,79,153) |
| B | Mid sky, x 0.05–0.4, y 0.25–0.38 | 57.4 | 57.2 | **106.5** |
| B | Glow right of the wagon, x 0.72–0.9, y 0.40–0.47 | 87.5 (137,76,54) | 76.0 | 104.6 (157,88,111) |
| B | Backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 46.7 | 53.1 |
| C | Upper-left sky, x 0.02–0.3, y 0.10–0.30 | 43.5, sat 0.38 | 39.9, sat 0.58 | 26.3, **sat 0.80** (17,23,82) |
| C | The smoke column, x 0.35–0.6, y 0.02–0.12 / the sky beside it | 24.1 / 33.4 | 39.3 / 35.0 | **55.4 / 15.8** |
| C | Glow band right, x 0.6–1, y 0.44–0.47 | 72.5 (117,60,63) | 100.4 | **71.9** (107,57,114) |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 49.1 | 37.8 |
| C | Pool left of the plinth, x 0.12–0.27, y 0.58–0.64 | 73.5 | 65.0 | 88.2 |
| C | Ground right, x 0.55–0.95, y 0.60–0.70 | 33.7 | 48.9 | 55.6 |
| C | Flame box (150..450, 350..900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 22 237 / 2 366 / 130 | 10 295 / 2 248 / **121** |
| D | Low sky, x 0–0.7, y 0.40–0.46 | 92.5 | 95.9 | 106.7 |
| D | Horizon band, x 0–0.7, y 0.47–0.50 | **148.2** | 97.1 | **82.6** |
| D | Land, x 0–0.5, y 0.52–0.62 / lit near band, x 0–0.4, y 0.64–0.68 | 16.0 / 58.9 | 36.4 / 36.8 | 36.1 / 37.3 |
| D | Glove's back, Y / p95 / fine (mockup (590,1130)–(740,1260)) | 30.4 / 79 / **8.3** | 37.6 / 65 / 4.6 | 35.7 / 55 / **2.1** |

**Clean sand:** A 56.7 / 63.5 / 64.6, dusk-fire 74.1 / 66.2 / 67.6, B 39.5 / 33.2 / 34.2, C 32.4 / 38.2 / **41.1**,
D 34.7 / 33.8 / 34.0.

**Sand saturation by luma bin** (y 0.38–0.50 full width, plus x 0–0.22, y 0.50–0.70; bins 20–40 / 40–60 / 60–80 /
80–100 / 100–120):

| View | Mockup | r17 | r18 | Lit > 65: G/R, B/R (mockup / r18) |
|---|---|---|---|---|
| A | 0.25 / 0.35 / 0.59 / 0.65 / 0.67 | 0.36 / 0.49 / 0.54 / 0.45 / 0.33 | 0.34 / 0.48 / **0.62 / 0.56 / 0.42** | 0.56, 0.36 / 0.58, 0.40 |
| dusk-fire | 0.20 / 0.56 / 0.68 / 0.69 / 0.65 | 0.36 / 0.43 / 0.51 / 0.48 / 0.33 | 0.34 / 0.41 / **0.59 / 0.59 / 0.42** | 0.56, 0.32 / 0.60, 0.42 |

- The row-1 light is a real gain in the middle bins. The hue of the lit sand is close now (G/R 0.58–0.60 against 0.56).
- The shade is still too saturated (0.34 against 0.20–0.25).
- The brightest sand still greys out (0.42 against 0.65–0.67), so "rises with its light" is half true.

**The sky strips, sampled at each view's heading and the elevation of its upper sky (early / late):**

| View (heading) | Early strip | Late strip | What the view shows | Mockup |
|---|---|---|---|---|
| A (0°), elevation 13–17° | 92 (163,70,106) | 48 (64,39,90) | early: 100 | 36 |
| B (303°), elevation 15–25° | 77 (93,66,139) | 36 (43,29,80) | early: 84 | 34 |
| D (338°) | 82 | 42 | late: 45 | 39 |
| h3 (168°) | 60 (49,54,158) | 16 | early: electric blue | — |

- The frames reproduce the strip values, so the colour is in the painting, not in a grade.
- The late painting is close to A's and B's mockups at their headings. The re-colour (`early_fix.py`: late × blurred
  ratio of early2 / late) is what turned A's upper sky magenta.

**The late clip (1 fps):** the ground (y 0.55–0.90) is 22.2–33.2 (r17 22.9–33.1), and 0.2–0.55 % is under luma 8.
There is no step and no ring.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.0** | 1. **The sky (x 0–1, y 0.05–0.36). Regression.** The mockup has a restrained amber-grey dusk with dark cloud and a dark upper sky (45). The game has a hot pink-to-magenta sky: upper 101, band 134 against 85, sat 0.58–0.60 against 0.42–0.47. No ray over the tower. 2. **The light placement (x 0–1, y 0.40–0.60). Repeated.** The lit shoulder is warmer and closer in hue (116,65,43 against 130,73,40). But the saddle and lower right are lit (74 against 46–50), where the mockup is in blue shade, and the far strip right of the tower is pale (66 against 34.5). 3. **The hold (x 0.3–1, y 0.55–0.86). Mixed.** The glove now shows its back and cuff, as the mockup does (a gain). The loop is still a teardrop on a stick with a cord dangling to the bottom edge, where the mockup has one low loose loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.0** | 1. **The sky (x 0–1, y 0.05–0.37). Regression, the largest area change.** The mockup has a dark navy upper sky with stars over an orange band with red-orange cloud banks. The game's upper sky is magenta (100 against 36), its clouds pink-violet streaks, and its horizon glow a yellow-white 172 against 115. There are no stars: the early stage removes them, and the shader's stars start at dusk 0.45. 2. **No lit crest diagonal (x 0.3–0.8, y 0.38–0.56). Repeated, unchanged.** 47.6 against 96.7; the shade under it 74 against 42.5; the far strip 60 against 38. The sand is warmer (a gain), but it is warm in the wrong places. 3. **The hold (x 0.25–1, y 0.50–0.88).** The back of the hand reads (a gain). It holds an upright ring on a long stick with a straight cord falling to the HUD, where the mockup has two broad coils at the bottom edge. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.3** | 1. **The sky (x 0–1, y 0.08–0.42). Regression, from a staging-value error.** It is lilac-violet (upper 84, mid 107) with pink cloud streaks. The mockup's is a navy night with stars (34 / 57) and a thin pale plume. Round 17 matched (32 / 57). B sits at dusk 0.50, so it shows the early strip; the late strip at B's heading would match (36). 2. **The horizon (x 0–1, y 0.40–0.48).** The glow is pink (157,88,111), where the mockup's is orange (137,76,54). The land right of the wagon is 53 against 21.5 (r17 47). The skyline is still 0.015–0.037 low; the 17 → 19 m raise moved it by about 0.002. 3. **The near sand and the hold.** The sand is 34 against 39.5. The loop is one ring on a stick where the mockup has two coils. The caravan is unchanged. The glove's back reads (a gain). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.0** | 1. **The fire (x 0.25–0.5, y 0.20–0.46). Gain, still short.** Saturated orange flipbook tongues, the crown's logs glowing, and a real warm pool on the plinth and the sand left of it (88 against 73.5). The flame's area is now near the mockup's (10.3 k pixels over 150 against 13.7 k; r17 22 k). But the white-hot core is 121 pixels over 245 against 2 722 (4 %; r17 130), so the "white core" in the commit does not measure. The logs are hardly visible inside it. The plinth's foot carries a bright cream rim. 2. **The smoke and the sky above (x 0.3–0.7, y 0–0.2). New.** A broad, pale, straight column rises to the top-right (55 against the 16 sky beside it). It reads as a searchlight beam. The mockup has a dark brown billow with sparks drifting up-left. The upper sky is a saturated royal blue (sat 0.80, 17,23,82), where the mockup's is violet-grey (53,39,58). 3. **The ground and horizon (y 0.44–0.75). Mixed.** The glow band now has the mockup's value (72 against 72.5; r17 100), but it is magenta (B 114 against 63). The far land is down to 38 (16; r17 49). The open ground away from the fire is too lit (56 against 34; the clean patch 41 against 32). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.4** | 1. **The hand (x 0.55–1, y 0.6–0.86). Gain in pose, loss in surface.** The back of the hand and the cuff now face the camera, the mockup's pose. But the leather is soft and smeared (fine 2.1 against 8.3; r17 4.6; p95 55 against 79), with no creases or stitching. The loop still rises as one ring on a stick, where the mockup's coils hang from the fist. 2. **The sky (y 0.05–0.50). Regression.** Pink-lit cloud streaks cross the mid and low sky, where the mockup is a clean starry navy. The bright peach horizon band is 83 against 148 (r17 97). 3. **The land (y 0.50–0.70). Repeated.** Flat 36 against dark 16 bands and a lit stripe at 59. The near waymark's pale smoke plume and the "SIGNAL TOWER 200" label sit on the horizon. |

**Seat score, Signal Dunes: (6.0 + 6.0 + 6.3 + 7.0 + 6.4) / 5 = 6.34, so 6.3.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5.
- Down 0.2 from r17:
  - C +0.2, from the fire and its light;
  - D −0.1, the glove's pose against the sky and the soft leather;
  - A −0.3, B −0.4 and dusk-fire −0.1, from the sky.
- The sky row was meant to be the second-biggest gain. At the five scored views it made A's, dusk-fire's and B's
  skies further from their mockups, by 50–65 luma in the upper sky.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Row 2: the late painting fit every mockup's sky bands best, so the early stage is its re-colour | **The fit is plausible; the re-colour throws it away** | At A's heading the late strip is 48 against the mockup's 36. The early re-colour is 92 (magenta) and ships to A and dusk-fire. |
| Row 2: the blend runs early → late from dusk 0.50 to 0.54, "so B (0.52) is mostly late" | **False** | B's stage sets only Sefa's flag: `duskOf` = 0.50, and `smoothstep(0.50, 0.54, 0.50)` = 0. B shows the early strip (84 against the late strip's 36 and the mockup's 34). 0.52 is the logbook-*read* dusk. |
| Row 2: no seams; stars and the Milky Way taken out of the early sky | **Seams: true. Stars: mostly** | The wrap step is 1.4 luma, and the worst column step is 0.7 (early) / 1.3 (late). A soft Milky Way band still shows in the early strip at headings about 140–210°. In h3 (heading 168°) the star removal and the 14–24° blend leave a speckled, hard-edged band across an electric-blue sky (x 0–0.5, y 0.30–0.36). |
| Row 2: "dusk-fire's and A's skies are warm afterglow with cloud banks; B is blue above its orange band" | **A/dusk-fire: warm, but magenta and 2–3× too bright up high. B: no** | B's band is pink (157,88,111), and its upper sky is lilac at 84. |
| Row 1: lit-sand saturation 0.59–0.63 (mockups 0.57–0.69) | **True for the 60–80 bin; the top bins still grey** | A 0.62 / 0.56 / 0.42 against 0.59 / 0.65 / 0.67; dusk-fire 0.59 / 0.59 / 0.42 against 0.68 / 0.69 / 0.65. |
| Row 1: B's dune 19 m and waymark 0's rise 20 m bring the skylines up | **Not visibly** | B's skyline is 0.440–0.456 (r17 0.440–0.456; mockup 0.419–0.440). C's is 0.483–0.488 (r17 0.485–0.489; mockup 0.431–0.470). |
| Row 3: orange flame with a white core, glowing logs, a lit smoke billow, a real point light | **Flame, light, embers: true. White core: no. "Lit" smoke: no** | Over 245: 121 against 2 722. The smoke is a constant colour, (0.42, 0.2, 0.08) to (0.13, 0.1, 0.1) linear, unshaded by the dusk or any light. It glows pale against the late sky (55 against 16). The point light is a real `PointLight` (10 m, decay 2) at the nearest lit waymark. |
| Row 4: glove-hd4, the back of the hand and the cuff toward the camera; the loop a teardrop at the handle's top | **True; the surface is softer than before** | Leather fine 2.1 (r17 4.6, mockup 8.3). |
| No camera re-aimed | **True** | cameras.json is unchanged (a4219aa). h3's eye rose 2.00 m with the 18 → 20 m rise (disclosed). |

## Findings, ranked by score gained

1. **Ship the sky by its painting, not its re-colour (A, dusk-fire, B, D; y 0.05–0.45).** *Regression (new this
   round).*
   - **The facts:**
     - The late painting already sits near A's (48 against 36) and B's (36 against 34) upper sky.
     - The early re-colour lifts it 2× and turns it magenta.
     - B is at 0.50, not the 0.52 the commit assumed.
   - **Fix:**
     - Re-make the early stage so that only the band under about 12° warms (an orange afterglow under navy, stars
       kept). That is mockup A's own sky, which has stars at sunset. Drop the whole-strip ratio re-colour.
     - Or use the late strip from dusk 0 with a warmer low band.
     - Spread the early → late blend over the real dusk range (0 → 0.5), not a 0.04 window placed around one staged
       value.
     - Check it at all 12 shots and the clip, not at the five.
   - **Accept:** A's upper sky 30–50, dusk-fire's 40–55, B's 30–45, D's horizon band at least 120 with no pink cloud
     streaks.
2. **The light placement on the spawn pair (A, dusk-fire, x 0–1, y 0.38–0.60).** *Repeated (since round 9).*
   - Unchanged by design this round. The lead's ruling now allows an art-directed global key.
   - **Fix:** pick one key that lights A's diagonal and dusk-fire's left shoulder and shades the saddle. Test it
     offline on the bake.
   - **Accept:** A's diagonal ≥ 75 and shade ≤ 50; dusk-fire's saddle ≤ 55; the far strips ≤ 45, by facing.
   - Then judge it in h1, the aerial-spawn and the clip, never per view.
3. **C's smoke and sparks (x 0.3–0.7, y 0–0.25).** *New.*
   - **Fix:**
     - Shade the plume with the dusk's key and fill (dark against a late sky), plus the fire's glow at its foot only.
     - Narrow and break it into puffs.
     - The drift follows the world wind (right in C's view). Keep the wind, and don't flip it for C.
   - **Accept:** the column is darker than or near the sky beside it (≤ 1.3×; now 3.5×).
4. **The fire's white core and logs (C x 0.27–0.47, y 0.25–0.42).** *Repeated.*
   - Over 245 is 121 against 2 722.
   - **Fix:** a hot core low over the logs (the flipbook's brightest cells pushed past white, under AgX), and logs
     visible through the tongues' base.
   - Drop the cream rim at the plinth's foot.
5. **The glove's surface (every view; D x 0.55–1, y 0.6–0.86).** *New (a regression in detail, against a gain in
   pose).*
   - **Fix:** re-texture glove-hd4 at 2048, or add a crease, stitch and wear detail map. Bake a normal map from the
     reference.
   - **Accept:** leather fine ≥ 5, p95 ≥ 70.
   - Then the coil: hang the loops from the fist rather than a ring on a stick.
6. **The double horizon from altitude (the aerials, the clip; y about 0.4–0.45 of the clip).** *New.*
   - The strip paints violet ranges from 0 to −8°, at infinity. From 58 m they stand above the real 3D ranges as a
     second, saturated violet ridge. At ground and tower-deck eyes (h1–h4) the real ranges cover them.
   - **Fix:** end the painting at the horizon (sky colour below 0°, or the fog's colour), and let the 3D ranges own
     the land.
7. **C's sky and the late horizon's hue (C, D).** *New.*
   - The upper sky is a saturated royal blue (sat 0.80 against 0.38), and the horizon band is magenta where the mockups
     have orange-salmon.
   - **Fix:** desaturate the late strip's zenith toward violet-grey and warm its horizon band toward (117, 60, 63) at
     C's heading.
8. **Landforms placed by frames.** *Repeated should-fix.* B's dune and waymark 0's rise were raised by 2 m each "for
   seat B's overshoots" and moved their skylines by about 0.002. Retire them into the dune sea rather than tuning them.
9. **Nits:**
   - The early strip keeps a soft Milky Way and a speckled star-removal edge (h3).
   - "SIGNAL TOWER 200" still sits over D's tower.

## Ledger-5 audit

- **The painted sky: allowed, no breach.**
  - It is one 360° panorama per stage, sampled by world direction (heading and elevation of `vDir`) on a camera-centred
    dome. No camera position and no per-view term.
  - It is seamless: the wrap step is 1.4 luma, and the worst column step is ≤ 1.3.
  - Its composition is laid out by heading from the afterglow (`GLOW` 11.5°), not by the mock cameras.
  - **What was tuned at the five cameras:** the choice of stage, and the blend window [0.50, 0.54], placed around the
    staged dusk values. That is global and play-reachable, so it is not a breach.
  - **But it is a should-fix:**
    - in play the whole sky swaps palette in about 2 s (RATE 0.02 / s) at the logbook;
    - the sky no longer deepens from the spawn to Sefa (0 → 0.50, one painting);
    - it doesn't deepen from the first waymark to the signal fire either (0.62 → 1, one painting; only the stars fade
      in);
    - it missed B anyway.
  - **Does it hold up away from the mock cameras?**
    - h1, h2 and h4 read as one sky.
    - h3 shows the early strip's electric blue (49, 54, 158) with a speckled edge.
    - The aerials and the clip show the painted ranges as a second horizon (finding 6).
    - None of this is a stand-in for walkable geometry.
- **The fire: real, and the same at every waymark.**
  - Every brazier gets the same `addFire(WAYMARK_FIRE)`, the flipbook with a per-billboard phase and the ember glow on
    lighting.
  - The point light is a real `PointLight` in the scene from the start. A system moves it to the lit waymark nearest
    the player, so the far waymarks have only the older shader pool. That is one rule everywhere, not staged for C.
  - The smoke is the same everywhere. It is unlit (finding 3), which is a likeness problem, not a breach.
- **The camera-distance rule: no breach.**
  - The row-1 light terms (the key's direct light saturated ×2.1 about its luma, the fill desaturated and cooled) read
    only the light, not distance.
  - The late clip's ground is 22–33, as in r17.
  - **Watch item for the lead to rule on:** the smoke's alpha fades out over 260–420 m by camera distance
    (`1 − smoothstep(260, 420, vFar)`, fireFx.ts, since d7cf518d1, before the council). It is an effect LOD on far
    plumes, not a ground or light term. I don't count it as the fourth term, but by the letter of the restated rule it
    changes brightness by distance.
- **Global grade: none.** `lut: null` still.
  - The sky colours come from the painting itself: the frames reproduce the strip samples.
  - The sand's saturation is in the sand's lighting, global, on the dusk curve.
- **The views: no breach.** cameras.json is unchanged, and the only real-eye move is h3's +2.00 m with its rise
  (disclosed).
- **Staged state: unchanged and reachable.**
  - The stage handlers are untouched: `logbook`, plus `waymarks-lit` ×2.
  - B's stage is a real resting state at dusk 0.50. The error is the builder's belief that it is 0.52, not the stage.
- **Still props and frozen poses:** the flame animates by its own phase, and the hold is the one idle pose. The flyer
  at D's left is the calmed recorder's (`active: []`), as in earlier rounds.
- **No narrowing:**
  - The clip's ground and the hero views hold.
  - h3's sky is worse (finding 1), and the sky's dusk progression is now two-state (above). That is a should-fix for
    play, not a narrowing made to win the scored views: it made three of them worse.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD and the 30 fps / 33 ms chip, `pageErrors: []`,
  no QA retakes. gpuMB is re-recorded at 149.95, far under the 1.8 GB / 1.0 GB limits. Sustained frame time is not on
  this surface: unverified, not breached.

SCORE signal-dunes: 6.3

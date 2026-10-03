# Round 17, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (with Jake's 7.0 bar and phase amendments), the brief, `scores.md` (with the
  restated camera-distance rule), and round 16's three Signal Dunes seat files.
- The "Signal Dunes, round 17" section of `art/mockup-council/round-17/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-0947-8c70feaf/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), against round 16's `20261003-0918-232dbb40/`, plus round 15's and round 13's
  spawn pair (round 13 had the same crest).
- The five ledger mockups, Lanczos-scaled to 780×1688.

**Source checks (read-only):**
- `git show` of 8c70feaf2 (`layout.ts`, `look/render.ts`, `quest/scout.ts`, `weapons/whipModel.ts`) and 1e61d12f1
  (the sheen gate and the new hold). `look/render.ts` at 8c70feaf2 read in full for every term that reads `sandFar`,
  `cameraPosition` or a view direction.
- The engine diff between the captures: 43 files, none in the look path (`viewmodelTextures.ts` is a rename only).
- `sandGrainTexture()` ported to numpy, with its box mips, to test the new "zero-mean" subtraction at every mip level.
- The terrain bakes at 232dbb408 and 8c70feaf2, decoded as 256² float32 from byte 24. Every non-aerial camAt eye comes
  out 1.69–1.71 m over the decoded ground, so the decode is right.
- `LANDFORMS.crests` at 50cd2d82 (round 13), to check "round 13's crest is back".

**How I measured:** these are the same tools and regions as my round 16 file. My r16 numbers reproduce to 0.1.
- Rec. 709 luma on the decoded JPEGs.
- **Clean sand:** x 10–150, y 1180–1400.
- **Fine:** the mean of |luma − luma blurred at σ 2|.
- **Grid r:** the Pearson r of a 10×7 grid of σ-12 luma, mockup against game.
- **Regions:** frame fractions (x left → right, y top → bottom).

**The short version:**
- **The spawn pair is the best it has been in form.** The wall is gone. The tower stands on its mound again, and
  rows of dunes recede behind the near field.
- **But the light is in other places, and its colour is wrong.**
  - Dusk-fire's lit sand is on the wrong side. The mockup has 24.9 % of the left half of the band over luma 80 and
    0.9 % of the right half. The game has 16.4 % on the left and 36.6 % on the right.
  - A's lit crest diagonal is 47.6 against 96.7.
  - The lit sand is beige, not orange. In the band's pixels over luma 65, G/R is 0.71–0.73 against 0.56, and B/R is
    0.57–0.60 against 0.32–0.35.
- **The builder's headline numbers do not reproduce.** I tried 45 plausible grid variants for the "in-band r A +0.23,
  dusk-fire +0.30". The best I get is +0.16 and +0.14; the medians are −0.08 and +0.01.
  - The lit share (22 % against 23 %) and the spread do reproduce. They are histogram matches; the correlation says
    the light sits elsewhere.
- **The pale far strips are back.**
  - A's far strip right of the tower measures 64.6 against 38.2, and dusk-fire's 79.0 against 34.5.
  - Round 16's "the pale sheet is gone" was true only because the 22 m wall hid it.
- **Removing the LUT was honest, but it took back the sky gain.** Dusk-fire's sky is 117 against 85; round 16 had 99.
- **The hard rule holds.** The grain octaves are exactly zero-mean at every mip. The late clip's ground is 24–35 with
  no step. There is no breach (audit below).

## Measurements (mockup / r16 / r17)

| View | Clean sand | Fine | Grid r, y 0.36–0.50 band (r16 / r17) | Grid r, y 0.36–0.58 (r16 / r17) |
|---|---|---|---|---|
| dusk-fire | 74.1 / 63.8 / **66.2** | 9.7 / 8.0 / 8.4 | −0.49 / **−0.27** | +0.14 / **+0.03** |
| A spawn | 56.7 / 61.3 / 63.5 | 9.3 / 8.3 / 8.6 | 0.00 / **−0.13** | +0.46 / **−0.05** |
| B logbook | 39.5 / 31.1 / 33.2 | 2.0 / 2.9 / 2.9 | | |
| C waymark | 32.4 / 36.4 / 38.2 | 0.4 / 1.8 / 1.9 | | |
| D hands | 34.7 / 31.9 / 33.8 | 0.4 / 1.5 / 1.4 | | |

| View | Region | Mockup | r15 | r16 | r17 |
|---|---|---|---|---|---|
| A | The lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 48.4 | 32.0 | **47.6** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 75.0 | 29.6 | **78.4** |
| A | Far strip right, x 0.6–1, y 0.385–0.405 | 38.2 | 73.3 | 34.4 | **64.6** |
| A | Far strip left, x 0–0.3, y 0.40–0.42 | 41.3 | 53.3 | 49.3 | **64.8** |
| A | Tower mound, x 0.35–0.65, y 0.36–0.40 | 57.3 | 42.6 | 35.9 | 47.4 |
| A | Band, x 0–1, y 0.36–0.56 | 55.9 | 58.7 | 36.8 | 64.6 |
| A | Sky, x 0.1–0.9, y 0.18–0.33 | 93.7 | 98.7 | 86.0 | 98.8 |
| dusk-fire | Lit left shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 69.5 | 66.5 | 74.1 |
| dusk-fire | Lit left, x 0–0.2, y 0.40–0.50 | 70.6 | 49.5 | 29.8 | 55.2 |
| dusk-fire | Saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 74.2 | 33.1 | **79.2** |
| dusk-fire | Lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 86.3 | 34.2 | **80.2** |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 111.9 | 36.2 | **79.0** |
| dusk-fire | Sky, y 0.24–0.30 | 85.0 | 116.9 | 99.2 | **117.1** |
| B | Glow right of the wagon, x 0.72–0.9, y 0.40–0.47 | 87.5 | 35.6 | 61.3 | **76.0** |
| B | Backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 30.2 | 31.6 | **46.7** |
| B | Land left of the camp, x 0–0.2, y 0.455–0.475 | 39.4 | 56.2 | 54.9 | 59.1 |
| C | Glow band right, x 0.6–1, y 0.44–0.47 | 72.5 | 98.7 | 30.4 | **100.4** |
| C | Land under the skyline, x 0.6–0.9, y 0.47–0.53 (profile) | 16–18 | | 25–27 | **31–36** |
| C | Fire-pool ground, x 0.2–0.6, y 0.60–0.68 | 45.7 | | 54.6 | 49.5 |
| C | Flame pixels over 230, x 0.19–0.58, y 0.30–0.54 | 5212 | | 1420 | 1993 |
| D | Lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 35.4 | 36.0 | 36.8 |
| D | Land under the skyline, x 0.6–0.9, y 0.51–0.57 (profile) | 12–19 | | 17–19 | 21–28 |

**Where the band's light sits (y 0.36–0.56, share of pixels over luma 80):**

| | Upper half / lower half | Left half / right half | Lit > 65: RGB, G/R, B/R | Shade < 45: B/R |
|---|---|---|---|---|
| A mockup | 25.4 / 20.0 % | 28.1 / 17.3 % | (152, 85, 53), 0.56, 0.35 | 0.98 |
| A r17 | 10.0 / 34.5 % | 8.4 / 36.2 % | (110, 78, 62), 0.71, 0.57 | 0.71 |
| dusk-fire mockup | 2.2 / 23.6 % | **24.9 / 0.9 %** | (128, 71, 41), 0.56, 0.32 | 0.84 |
| dusk-fire r17 | 13.3 / 39.7 % | **16.4 / 36.6 %** | (115, 84, 69), 0.73, 0.60 | 0.70 |

- Both spawn views now have the right amount of light: over 80, A 22.3 % against 22.7 %, dusk-fire 26.5 % against
  12.9 %.
- It is in the wrong places. A's light is low and right, where the mockup's runs along the upper diagonal. Dusk-fire's
  is mirrored.
- The lit sand is pale beige-pink. The mockups' is saturated orange.
- The shade is warmer than the mockups' blue-violet.

**The late clip (1 fps, 540×1168):** the ground (y 0.55–0.90) is 24.1–34.8 (r16 25.3–32.3). The mid-band median is
33–34 (r16 29–31), and 0.2–0.5 % is under luma 8. There is no lit disc and no step at any range. The pale horizon strips
show all through it, as in r16.

**The bake:**
- Max slope is 39.4° (r16 39.0°). Within the inner ±150 m, 33.7 % of faces are over 15° (r16 35.0 %) and 10.4 % over
  25° (r16 11.7 %).
- B's new mound reaches 17.0 m, max 33.5°. Waymark 0's rise reaches 18.0 m, max 37.2°. The crest reaches 13.9 m, max
  37.2°.
- From the spawn eye, nothing between the eye and the tower rises above −1.48°, at 138 m on the tower mound's own
  shoulder (r16: −0.47° at 87 m, the wall). So the mound and the whole tower show.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.1** | 1. **The light is mirrored (x 0–1, y 0.40–0.56). New, from the lower crest.** The forms finally read: the tower is on its dark mound, a dune lies before it, and the field recedes. But the mockup's bright left shoulder over a shaded blue saddle becomes a lit pale sweep to the *right* of the crosshair (saddle 79 against 55; lower right 80 against 46). The left is only half lit (55 against 71). Lit share over 80, left / right: 16 / 37 % against 25 / 1 %. 2. **The colour (whole band) and the sky (y 0.15–0.36).** The lit sand is beige-pink (G/R 0.73 against 0.56), not burnt orange. With the LUT out, the sky is 117 against 85: a flat lilac-to-peach gradient with peach puffs, where the mockup has dark amber with fine filaments. 3. **The pale far strips (x 0–1, y 0.37–0.43). Regression, re-exposed.** Bright lavender-white flats lie under the mountains (79 against 34.5), where the mockup has dark receding dune rows. The viewmodel is one tall thin ring, where the mockup has a low loose loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.3** | 1. **No lit crest diagonal (x 0.3–0.8, y 0.38–0.48). Repeated, better.** It reads now as dune rows receding to the tower on its mound, the mockup's structure. But the bright diagonal is 48 against 97: the light lies on the near floor and a right flank (36 % of the right half over 80, against 17 %), while the upper band is lit 10 % against 25 %. 2. **The colour and the far strips (y 0.37–0.44).** The lit sand is beige (G/R 0.71 against 0.56), and the shade is brown-violet rather than blue-violet. The pale flats show on both sides of the tower (64.6 / 64.8 against 38 / 41), where the mockup's far rows are blue-grey. 3. **The viewmodel (x 0.15–1, y 0.58–0.86). Mixed.** The cord now leaves the handle's top, and the teardrop reads as one object, a real gain. But it is one thin, regular, rope-like ring from a low side-on fist, where the mockup has two broad, heavy plaited coils from the bottom edge over a half-hidden hand. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.7** | 1. **The backdrop (x 0.6–1, y 0.40–0.49). Mixed.** The glow is closer (76 against 87.5; r16 61). But the land right of the wagon got paler (47 against 21.5; r16 32): the moved mound (21 m at 65 m → 17 m at 150 m) lets the pale far flats show behind the horses. 2. **The near sand (y 0.70–0.83). Repeated.** 33 against 39.5 (r16 31). 3. **The caravan and smoke (x 0.45–0.75, y 0.20–0.52). Repeated.** The cloth is a pale cream with dark blotches, where the mockup has a weathered tan canvas. The plume is a thin arc bending right, not a column over the wagon. The marker hovers above the wagon, not on it. The loop now reads as one piece. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.8** | 1. **The right horizon (x 0.6–1, y 0.42–0.53). Gain.** The glow band runs unbroken (100 against 72.5; r16 30), and the far brazier burns on a small rise at the skyline, as in the mockup. But the skyline sits about 0.025 of the frame lower than the mockup's, and the land under it is about twice its luminance (31–36 against 16–18). The glow's peak is hotter and pinker (142 against about 94). 2. **The fire (x 0.25–0.5, y 0.20–0.53). Repeated.** The flame is tall, pale and graphic, with no logs and no billowing smoke. It has 1993 pixels over 230 against 5212. 3. **The brazier and the hold.** The post is ornate and twisted and the plinth is a tapered block, where the mockup has a rough straight post on a stone drum. The loop is one ring, not the mockup's coils. The near ground is close (38 against 32). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.5** | 1. **The glove and the coil (x 0.55–0.95, y 0.62–0.86). Mixed.** The cord meets the handle again (a gain), and the handle leans. But the finger rolls still face the camera with the thumb on top (the builder says so too), and the leather is smooth with no creases or stitching. The loop is one ring; the mockup's coils hang in several turns from the gripped fist. 2. **The land under the horizon (y 0.50–0.70). Repeated.** It rolls in dunes with a big dune on the right, at 21–28. The mockup has flat dark horizontal bands at 12–19 with one lit stripe (59 against 37). A pale strip lies along the far flats at y about 0.49. 3. **The horizon objects.** The tower is at the mockup's size and place. It still carries a "SIGNAL TOWER 200" world label, and a lit waymark with smoke sits mid-left where the mockup has a small ember. |

**Seat score, Signal Dunes: (6.1 + 6.3 + 6.7 + 6.8 + 6.5) / 5 = 6.48, so 6.5.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3.
- Up 0.2:
  - dusk-fire +0.4 and A +0.4, from the forms (the wall gone, the tower on its mound, the rows receding);
  - C +0.2, from the glow band and the far brazier on its skyline;
  - D +0.1, from the joined cord;
  - B 0.
- What holds the spawn pair at about 6 is the light: it sits in the wrong places and is the wrong colour, the far
  strips are pale, and the sky has gone back.

## Builder claims checked against the pixels

| Claim (README / 8c70feaf2 / 1e61d12f1) | Verdict | Evidence |
|---|---|---|
| Round 13's low crest is back | **True** | `crests` at 8c70feaf2 is byte-identical to 50cd2d82's. The wind is the same as round 13's; the key is mirrored in x since round 13 (−0.45 → +0.39). |
| In-band r: A +0.23, dusk-fire +0.30 | **Does not reproduce** | My 10×7 σ12 grid gives A −0.13 / −0.05 and dusk-fire −0.27 / +0.03 (y 0.36–0.50 / 0.36–0.58). Across 45 grid variants (σ 0/6/12; 10×7, 20×11, 8×5; five band boxes) the maximum is +0.16 / +0.14. Neither the committed `measure.py` nor the overlay defines the metric. |
| A's lit box 52 (r16 32) | **Roughly true on my box** | 47.6 on x 0.4–0.7, y 0.40–0.44 (r16 32.0). The mockup is 96.7 there. |
| Lit share 19–22 % (mockups 15–25 %), spread 66–76 | **True, and misleading** | Over 80: A 22.3 %, dusk-fire 26.5 %; p5–p95 spread 68 / 78. These are histogram matches. The left / right split shows dusk-fire's light mirrored. |
| C's rise 18 m on a narrower base, under the glow | **True** | The bake reads 18.0 m and max 37.2°. The glow band is back at 100. |
| B's dune 150 m out along B's view, 17 m | **True; it costs B's backdrop** | 17.0 m, 33.5°. The land right of the wagon is 47 (r16 32, mockup 21.5). |
| The LUT is out | **True** | `lut: null`, with no `loadLUT` import. A's sky 86 → 99 and dusk-fire's 99 → 117, back to r15's values. |
| The grain and glint fades subtract the tile's means; the procedural glint is zero-mean | **True to within 0.5 %** | Ported tile: meanR 0.49087 and meanGlint −0.00510, as the shader now subtracts. The three grain octaves are zero-mean at every mip level. The procedural glint is zero-mean (`step(0.985, hash)` − 0.015). The paired texture glint is zero at mip 0 only: once the mips blur the tile, both smoothsteps fall to 0 and the term leaves +0.46 % (×0.9 applied), within 3–18 m. That is about 0.3 luma: a nit. |
| The late facing windows are back near round 14's | **True** | `away` uses toGlow −0.45..−0.05 and tilt 0.12..0.4: facing only, no distance. The clip holds. |
| The sheen only where the sun is behind or beside the viewer | **True** | KEY.dir points toward the sun (it is the N·L vector). `sheenSide` is 0 for every scored view: dot ≈ −0.7 in A, dusk-fire, C and D, and −0.17 in B, which gives a factor of about 0.007. |
| The cord's start meets the handle's top | **True** | No gap in any view; the cord now leaves the handle's tip. |
| The fist rolled 0.5, the back of the hand to the camera | **Half** | The handle leans up and left. The finger rolls and thumb still face the camera; the builder defers the back of the hand to a re-posed model. |
| Sefa at 8 m, right and behind, so the tracker reads "SEFA 8 M" | **True** | `SCOUT_AT` moved from (+5, +2) to (+7, +4). She is out of both spawn frames, and the first frame and h1 read "SEFA 8 M ▲". |
| No camera moved | **True for cameras.json** | The blob a4219aa is unchanged. Real eyes: C +1.95 m (the crest's flank is now under its stand) and h3 −6.0 m (the lower rise). Both come from terrain, both are disclosed, and the eyes are 1.70 m over the bake. |

## Findings, ranked by score gained

1. **The spawn pair's light sits in the wrong places, and in dusk-fire it is mirrored (A and dusk-fire, x 0–1,
   y 0.38–0.56).** *Repeated (A's crest, since round 9). New for dusk-fire, from the crest swap. The metric was gamed
   without the likeness.*
   - **The cause:** round 13's crest was chosen for round 13's key (x −0.45). The key has since moved to x +0.39. So the
     lower crest's lit flanks now face right, where dusk-fire's mockup has its shaded saddle.
   - **Fix:**
     - Keep the crest heights (they finally give the receding view), but reshape its flanks. On the left of both spawn
       views, the face in view must turn toward the key (normal toward +x, −z). That is dusk-fire's lit left shoulder
       and A's lit diagonal running down to the right. The ground right of the crosshair must turn away from it: the
       blue saddle.
     - Test offline on the bake with N·L before a capture.
     - Judge it by what the eye sees: the lit share over 80 in left and right halves (dusk-fire target 20–30 % left,
       under 5 % right), and A's upper-band lit share (target ≥ 20 %, now 10 %). Neither of these can be matched by
       the near floor alone. Do not judge it by a correlation that the next seat can't rerun.
     - Publish the script that produced "+0.23 / +0.30" with the capture.
2. **The lit sand is beige, not orange (every view's dune band; A and dusk-fire most).** *Repeated (round 15 noted the
   desaturation), and now unmasked by the LUT's removal.*
   - **Measured:** G/R is 0.71–0.73 against 0.56, and B/R 0.57–0.60 against 0.32–0.35, in lit band pixels. The near
     floor holds its saturation (0.63–0.66). So the colour is lost with depth: the mid-distance lit faces wash toward
     the fog and haze colour.
   - **Fix:**
     - Measure the lit sand's chroma on matching lit faces at about 15, 50 and 120 m in h1 or the aerial-spawn.
     - If the loss is the engine fog's colour, warm the fog's sun-side tint toward the lit sand's own hue at the
       spawn's dusk (the fog may darken; its colour shouldn't bleach orange to pink-grey).
     - If it is the material, raise the albedo's saturation where the key lands (`KEY.color` and the crest/hollow vertex
       colours).
     - Not a global grade.
3. **The pale far strips are back (A, dusk-fire, B, D, h4, the clip; y just under the mountain silhouettes).**
   *Regression, re-exposed. Round 16's fix was occlusion.*
   - **Measured:** A 64.6 / 64.8 against 38 / 41; dusk-fire 79.0 against 34.5; B's backdrop 46.7 against 21.5; D's land
     21–28 against 12–19; C's land under the skyline 31–36 against 16–18.
   - **Fix:** find the flats that render pale. Candidates: the skirt's gentle swells and the interdune pans, lit flat at
     grazing past the shadow map's edge (`sandVis` is forced to 1 past `SHADOW_HALF − 8`), and the far rings' haze.
     Give them the key's real occlusion (extend the baked shadow or derive it from the skirt's heights) and a darker
     haze tint. Use height, facing and occlusion only, never distance.
4. **Dusk-fire's sky went back with the LUT (y 0.15–0.36): 117 against 85.** *Regression (an honest one).*
   - **Fix:** close the gap in the dome itself at the spawn's dusk value: a darker amber upper band, and fine warm
     filaments in place of peach puffs (row 5's painted skies, if they ship). A's sky is already fine (99 against 94),
     so the dusk-fire / A split is the dome's gradient below y 0.30, not its overall value.
5. **The hold (every view; x 0.15–1, y 0.58–0.86).** *Repeated; the cord gap is fixed.*
   - **Fix:**
     - Make the loop two broad, heavy plaited turns (thicker cord, about 1.5–2× the current gauge, the turns offset)
       rather than one thin regular ring.
     - Turn the hand so its back and cuff face the camera (the re-posed model already in progress).
     - Add creases and seams to the leather.
6. **C's skyline (x 0.6–1, y 0.44–0.53).** *Partly repeated.*
   - **What is left:** the glow is now continuous, but the skyline is about 0.025 low, and the land under it is 2× the
     mockup's.
   - **Fix:** a slightly higher, darker far rim past the rise (dark, by facing away from the glow). Check: land under
     the skyline ≤ 22, glow 70–90.
7. **Landforms placed by frames.** *Repeated should-fix; B's mound is a new instance.*
   - **The instances:** the crest is A's, waymark 0's rise is C's skyline, and B's mound is "150 m out along B's view".
     All three are real, walkable terrain, so this is no void.
   - **What it costs:** B's move cost its backdrop. From above, the field still reads as three dark crater-like ovals
     round the tower (aerial-overview).
   - **Fix:** make them part of a continuous dune sea (crest lines across the wind) rather than single bodies placed in
     a view.
8. **Nits:**
   - The paired texture glint leaves +0.46 % once the mips blur it. Subtract the blurred mean too, or drop the dark leg.
   - "SIGNAL TOWER 200" still sits over D's tower.
   - A "…5 M" world label is cut off at C's left edge (x 0, y 0.43).

## Ledger-5 audit

- **The hard rule (no shard shader term may change brightness by distance from the camera; mean-preserving detail
  fades are allowed): no breach.**
  - The three grain octaves subtract the tile's measured mean (0.49087). I ported the tile: they are exactly zero-mean
    at mip 0 and at every box mip, so a fade can't shift brightness.
  - The procedural glint is zero-mean, and the ripple term is zero-mean (0.7/π added back).
  - One residual: the paired texture glint is zero-mean only on the unfiltered tile. Mip-blurred, it leaves +0.46 % ×
    0.9 within 3–18 m. It brightens, by about 0.3 luma: a nit, not a breach.
  - The other `sandFar` readers (`sandPatch`, `sandFade`, `sandNear`, the ripple bump `s1`, `sandBump`) scale only
    zero-mean detail or tilt normals.
  - The sheen is view-angle, now gated to sun-behind-viewer faces. It is off in all five scored views (computed above),
    so it can't be a screenshot term. On flat lit ground seen with the sun behind, it brightens with distance (+2 % at
    3 m, about +25 % at 20 m). That is the physical opposition surge, not a distance fade: a watch item.
  - **The late clip:** the ground is 24–35, the mid band 33–34, and 0.2–0.5 % is under luma 8, with no ring or step. It
    is honest.
  - The engine fog thins late (`fogDist × (1 − 0.8·late)`), as before: an engine term.
- **Global grade: no breach, and none left.** The LUT is removed (`lut: null`), so no grade hides a material gap. The
  colour gap (finding 2) is now in plain view, which is the right state for a re-fit to start from.
- **The views: no breach.**
  - cameras.json is unchanged (a4219aa).
  - C's real eye rose 1.95 m and h3's fell 6.0 m, from disclosed terrain edits. The eyes are 1.69–1.71 m over the bake.
  - C's rise doesn't help its frame in a way the mockup lacks: the bowl sits at the same frame height as in r16.
- **Landforms placed for frames: should-fix, repeated (finding 7).**
  - Real, walkable geometry, with max slopes 39.4° on the field, 33.5° on B's mound and 37.2° on the rise. Not cards.
  - Round 13's crest is now scored with a key it wasn't shaped for. That cost the dusk-fire likeness, so it is not a
    trick.
- **Staged state: unchanged and reachable.** `logbook` and `waymarks-lit` ×2, the same handlers.
  - The only change in a stage file is `SCOUT_AT` (Sefa 2.8 m further out). It is the spawn's real state: she is out of
    both spawn frames and her wave range is unchanged.
- **Still props or frozen poses:** the hold is the one idle pose, unchanged in kind.
  - D's flying shape at upper left sits in the same spot in r16 and r17. The recorder calms creatures (`active: []`):
    disclosed, as in earlier rounds, and not a mockup-specific pose.
- **No narrowing: no breach.**
  - h2 is unchanged. h3 follows its real lower rise.
  - h1 and the first frame gain the same receding view as A.
  - The aerials read as more varied dunes, with the craters still there.
  - h4's far flats are paler (finding 3), as they were in r15.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD and the 30 fps / 33 ms chip, `pageErrors: []`,
  no QA retakes. Memory and sustained frame time are not on this surface: unverified, not breached.

SCORE signal-dunes: 6.5

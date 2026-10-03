# Round 24, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` with every lead
  ruling, and the three round-23 Signal Dunes seat files.
- The "Signal Dunes, round 24" section of `art/mockup-council/round-24/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1406-7db2a5a2/` (`mock-*`, h1-h4, first-frame, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 23's `20261003-1325-8f296fb4/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: the diffs of 5d0be40ff, a5dc51367, 8382bdad6, 81c1f8034, 38496b429 and 7db2a5a26; the baked
  `terrain.bin` (sampled with `BakedTerrain.ts`'s bilinear rule); `progress/physics/sd-r24-b-musrfqm6.json`.

How I measured (round 23 seat B's tools and boxes; its r23 numbers reproduce to 0.1):
- **Brightness** is Rec. 709 luma. **s** is the mean (max - min) / max; **h** the HLS hue of the region's mean RGB;
  **B/R** the mean-channel ratio.
- **Row-demeaned r:** Pearson r of a 10x7 grid of sigma-12 luma, each row's mean removed.
- **Grid dE:** mean CIELAB distance of 12x12 cell means, mockup against game.
- **Lit / shade share:** band pixels (y 0.38-0.555) above Y 80 / below Y 45.
- **The coil moved, so the clean patches changed again.** It now spans x 0.45-0.88, top y 0.645, in every view (read
  off gridded crops of B, C, D and dusk-fire). Boxes at x < 0.42 below y 0.60 are now coil-free; round 23's left-side
  boxes that held the coil are re-measured clean below.

## What changed (r23 to r24)

| View | Mean \|dY\| | Pixels \|dY\| > 8 | Sky y < 0.33 | Land y 0.33-0.55 | Low y 0.55-0.86 |
|---|---|---|---|---|---|
| A | 5.0 | 12.2 % | 0.4 | 5.7 | 11.2 (coil, sand colour) |
| dusk-fire | 5.0 | 13.3 % | 0.3 | 6.4 | 10.7 |
| B | 2.4 | 6.8 % | 2.2 | 1.1 | 4.5 (coil) |
| C | 2.5 | 6.9 % | 1.0 | 1.9 | 5.7 (coil) |
| D | 7.2 | 22.4 % | 2.4 | **15.5 (moved camera)** | 9.1 |
| h2 / h3 / h4 | 3.7 / 2.3 / 3.4 | | 2.9 / 0.1 / 1.1 | 1.1 / 0.5 / 0.5 | sand colour, coil |

**Grid dE to the mockup, r23 → r24** (land band y 0.38-0.555):

| View | Sky band | Land band |
|---|---|---|
| A | 15.9 → 15.9 | **19.5 → 21.4** (dAB 15.1 → 17.3), further |
| dusk-fire | 25.7 → 25.7 | 16.8 → 16.3 |
| B | 9.9 → 9.8 | 12.8 → 12.9 |
| C | 12.4 → 12.5 | 21.6 → 21.5 |
| D | 6.9 → 6.9 | 16.0 → 17.4 (another stand) |

## Measurements (mockup / r23 / r24)

### The spawn pair

| Region / metric | Mockup | r23 | r24 |
|---|---|---|---|
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.7** (154,84,50) h20 s0.65 | 86.8 h24 s0.47 | **78.9 (115,71,52) h18 s0.54** |
| A crest top x 0.3-0.5, y 0.40-0.43 | 86.7 h19 s0.58 | 92.1 h25 s0.42 | 85.3 h20 s0.49 |
| **A shade trough x 0.2-0.6, y 0.47-0.53** | **42.7 h318 s0.26** | 95.3 h26 | **92.4 h21 s0.52** |
| A below the line x 0.55-0.85, y 0.49-0.53 | 36.2 h307 s0.25 | 50.9 h11 | **63.6 h13 s0.65** |
| A right slope x 0.78-1, y 0.44-0.54 | 48.5 h0 s0.35 | 36.6 h352 | 54.1 h9 s0.65 |
| A far strip x 0-0.4, y 0.375-0.40 | 70.0 | 90.0 | 89.8 |
| A lit / shade share | 23 % / 60 % | 43 % / 30 % | **39 % / 22 %** |
| A row-demeaned r (0.38-0.58 / 0.36-0.56) | | +0.46 / +0.47 | **+0.52 / +0.50** |
| A near sand x 0.013-0.40, y 0.60-0.64 (now clean) | 73.6 h18 | (coil) | **89.6 h19** |
| A near sand x 0.10-0.42, y 0.65-0.80 (now clean) | 55.8 h17 | (coil) | **75.2 h16 s0.68** |
| dusk-fire shoulder top x 0-0.35, y 0.50-0.555 | 85.4 h22 s0.71 | 87.9 h25 s0.49 | 88.4 h21 s0.54 |
| dusk-fire mid dunes left x 0-0.45, y 0.40-0.50 | 62.5 h18 | 82.9 h24 | 77.4 h19 |
| dusk-fire right x 0.6-1, y 0.40-0.50 | 55.0 h17 | 38.5 h352 | **43.9 h0 s0.49** |
| dusk-fire saddle (seat A's px window) | 49.5 h13 **s0.39** | 30.9 h326 | **47.4 h7 s0.63** |
| dusk-fire lower right x 0.6-0.97, y 0.48-0.56 | 46.1 h10 s0.33 | 27.9 h300 | 41.1 h3 s0.57 |
| dusk-fire near left x 0-0.40, y 0.60-0.80 (now clean) | 75.0 h22 s0.67 | (coil) | **74.8 h16 s0.68** |
| dusk-fire near right x 0.60-0.97, y 0.555-0.62 | 55.7 h15 s0.39 | 47.6 h13 s0.57 | 53.6 h12 **s0.74** |
| dusk-fire lit / shade share | 14 % / 29 % | 31 % / 43 % | 27 % / 32 % |
| dusk-fire row-demeaned r | | +0.60 / +0.57 | +0.60 / +0.54 |
| Lit quarter, y 0.36-0.56: A · dusk-fire | h20 s0.66 · h21 s0.68 | h28 s0.43 · h26 s0.46 | **h23 s0.47 · h21 s0.51** |

**Saturation by luma quartile, land band y 0.38-0.62** (the new finding):

| | Q1 (shade) | Q2 | Q3 | Q4 (lit) |
|---|---|---|---|---|
| A mockup | Y 32 s0.28 | Y 41 s0.26 | Y 68 s0.55 | Y 107 s0.67 |
| A r24 | Y 39 s0.48 | Y 63 **s0.63** | Y 81 s0.56 | Y 100 **s0.49** |
| dusk-fire mockup | Y 37 s0.25 | Y 52 s0.51 | Y 66 s0.66 | Y 89 s0.67 |
| dusk-fire r24 | Y 33 s0.42 | Y 55 **s0.65** | Y 71 s0.61 | Y 91 **s0.53** |

- In the mockups saturation **rises with light**: grey-violet shade at s 0.25-0.28, amber lit faces at s 0.67. In the
  game it is **inverted**: it peaks in the mid-tones (s 0.63-0.65), and the lit quarter is the *least* saturated of the
  sand above the shade. 5d0be40ff's 2.5 boost landed on the mid-tones and shadows, not on the lit faces.
- The boost also **clips blue to zero.** `mix(vec3(dL), direct, 2.5)` extrapolates past the luma, and `max(…, 0)`
  clamps the blue. Share of y 0.36-0.86 with blue < 12 and red > 70, r23 → r24:
  - A 0.06 → 2.3 %; dusk-fire 0.09 → 4.5 %; the mockups 0.03-0.04 %.
  - h2 0.35 → 12.5 %; h3 6.1 → 15.8 %. Both heroes' near sand turned vivid red-orange.
  - aerial-spawn's hard-edged patch is (110,28,6) at s 0.94, against (99,37,29) beside it.
- So dusk-fire's saddle reached the mockup's value (47.4 against 49.5), but as saturated red (s 0.63) where the mockup is
  a muted rose-brown (s 0.39).
- **A's light is unchanged in shape.** Its grid still lights the mockup's lee: rows 3-6, cols 0-4 are 75-108 where the
  mockup's are 36-46. The shade share fell further, 30 → 22 % (mockup 60 %). The pattern r rose a little (+0.46 → +0.52),
  but the land dE rose too (19.5 → 21.4, all of it colour). The diagonal lost value (86.8 → 78.9) while it gained hue.

### B

| Region | Mockup | r23 | r24 |
|---|---|---|---|
| Plume peak x, y 0.20-0.28 / 0.28-0.36 | 0.512 / 0.531 | 0.713 / 0.742 | **0.522 / 0.556** |
| Sky row sd y 0.21 / 0.24 / 0.27 (streak contrast) | 4.5 / 5.3 / 4.6 | 3.7 / 6.1 / 5.7 | **2.5 / 3.8 / 4.1** |
| Sky rows y 0.33-0.39 hue | h271-327 | h326-352 | h328-353 (unchanged, sd 21) |
| Glow band left / right | 111.1 h12 / 136.1 h18 | 89.1 / 87.3 | 89.6 / 88.6 (unchanged) |
| Backdrop right x 0.7-1, y 0.44-0.48 | 17.2 | 37.5 | 36.5 |
| Near left x 0-0.40, y 0.60-0.80 (now clean) | 39.2 h11 | (coil) | **37.6 h2** |
| Lantern pool / wagon front | 56.9 h14 / 45.7 h17 | 58.6 h11 / 48.2 h16 | 57.7 h10 / 47.6 h15 |

The plume rises over the wagon now, and the upper cloud streaks lost a third of their contrast. The low pink streaks
and the dim band are unchanged.

### C

| Region | Mockup | r23 | r24 |
|---|---|---|---|
| The plinth | fully visible | the coil's arc across it | **clear** |
| Pool round the plinth x 0.15-0.60, y 0.585-0.62 | 71.9 (132,58,28) h18 s0.76 | 60.9 (coil) | **83.8 (150,67,52) h9 s0.65** |
| Land y 0.47-0.55: p10 / share below Y 8 | 13.8 / 0.3 % | 4.7 / 17.6 % | **12.7 / 2.1 %** |
| Far land x 0.6-0.9, y 0.48-0.53 | 16.1 | 31.7 | 32.6 |
| Ground right x 0.65-0.97, y 0.58-0.64 | 35.3 h12 | 62.9 h5 | 62.3 h5 |
| Ground left x 0-0.40, y 0.62-0.80 (now clean) | 38.8 h13 s0.64 | (coil) | 43.8 h359 s0.47 |
| Horizon sky x 0.6-0.9, y 0.40-0.45 | 89.1 h335 | 68.3 h299 | 68.4 h299 |
| Pixels over Y 230 / 245, y 0.25-0.55 | 5542 / 2713 | 4630 / 2372 | 4726 / 2300 |

The plinth is back and the black pockets are gone. With the coil off it, the pool shows: brighter than the mockup's and
red (h9 against h18), and the open ground round it is still twice the mockup's value.

### D (another stand; the composition evidence is under Ledger 5)

| Region | Mockup | r23 (38, 122) | r24 (25, 75) |
|---|---|---|---|
| Land rows y 0.48-0.70, x 0.1-0.6, per 2 % | 162 66 15 17 18 17 13 15 54 52 46 44 (sd 40.1) | 57 32 36 29 36 38 40 40 39 39 40 39 (sd 6.4) | 17 39 35 36 30 30 32 38 43 42 40 39 (sd 7.0) |
| The commit's rows y 0.53-0.63, full width | 16 12 21 14 15 | 28 27 29 37 40 | **35 34 32 32 33** (the commit: "11, 4, 11, 17, 23") |
| Land y 0.50-0.64: p5 / p50 / share below Y 8 | 9.7 / 12.8 / 1.5 % | 4.3 / 38.9 / 16.2 % | 14.7 / 32.5 / **0.0 %** |
| Land saturation y 0.50-0.60 | s0.53 | s0.48 | **s0.35** (grey mauve) |
| Glow peak (row mean x 0.1-0.6) | **169 at y 0.497** (216,159,123) | 134 at 0.467 (194,120,91) | **158 at 0.469 (211,147,107)** |
| Skyline (first row under half the peak) | y 0.507 | 0.487 | **0.479** |
| Rows y 0.48 / 0.49 / 0.50 | 160 / 163 / 113 | 97 / 17 / 18 | **18 / 15 / 44** |
| Sky rows 30-36 % / 36-42 % | 58.0 / 70.9 | 55.7 / 74.9 | 55.6 / 75.7 |

- **The glow line's colour is fixed** (81c1f8034): 211,147,107 against 216,159,123, value 158 against 169. But the new
  stand's far ranges stand up into it: the dark skyline is at y 0.479. Rows 0.48-0.49 are 15-18, exactly where the
  mockup's glow is brightest (160-163).
- **The land is no darker than at the old stand.** The median is 32.5 against 12.8 and the band's sd 7.0 against 40.1.
  The commit's "11, 4, 11, 17, 23" was measured before 7db2a5a26's ×0.45 floor. In the captured frame the same rows are
  32-35. Below Y 8 is now 0 % (round 23: 16-21 %), so the floor did its job.

### The hold (7db2a5a26 `LOOP`)

| | Mockups | r23 | r24 |
|---|---|---|---|
| A / B / C | two separated coils, x 0.32-0.85, top 0.59-0.60, centre ~0.58 | x 0.11-0.60, top 0.565, centre ~0.36 | **x 0.45-0.88, top 0.645, centre ~0.665** |
| D | one narrow coil, x 0.57-0.81, top 0.62 | the same big pair | the same pair (0.43 wide against 0.24) |
| dusk-fire | one slack loop, x 0.38-0.75, top 0.62 | the same big pair | the same pair |

- **Better in every view.** The coil now hangs right of centre behind the fist, as all five mockups draw it. C's plinth
  is clear, and the big left-side lasso is gone from D and dusk-fire.
- **It overshot right (~0.08) and sits low (~0.05).** The builder's "top about 0.6" measures 0.645.
- **The two turns now nearly coincide.** `step` went 0.3 → 0.18, so A/B/C's pair reads as one hoop with a doubled rim.
  The mockups' coils are two loops, clearly apart at the top.

### The late clip (1 fps)

| | r23 | r24 |
|---|---|---|
| Ground y 0.55-0.90: p5 at s 6 / 8 / 10 | 3.4 / 3.4 / 4.3 | **12.4 / 12.4 / 13.4** |
| Ground share below Y 8, s 6-10 | 8.4-16.7 % | **0-0.3 %** |
| Far band y 0.40-0.50 | 25-33 | 28-33 |
| Glow row: largest red step across 1/24 columns | 6.9-57.1 | 7.0-58.6 (the same; no new seam) |

The black blots are gone (seat C's accept, p5 ≥ 10 at s 6-10, is met).

## Ledger-5 checks

### mock-D-hands: the 49 m move is a breach. D is void.

The README asks three questions.

1. **Does the new stand reproduce mockup D's composition? No, and on the tower it's further away than round 23.**
   - **Tower x:** the mockup's tower is at 0.81-0.845; r23 0.83-0.86; r24 0.82-0.87. That matches both times.
   - **Tower size (mast tip to foot):** the mockup's is **0.048** of the frame height (y 0.454-0.502). r23's was 0.067
     (1.4x) at 200 m. **r24's is 0.090 (1.9x) at 151 m.** At the game's FOV, the mockup's tower size puts the stand
     about **280 m** away (151 × 0.090 / 0.048). The move went 49 m the wrong way.
   - **The tower's footing:** in the mockup the foot stands on the far skyline (y 0.50) over pale distant ranges. In r24
     it stands on a mid-ground mound (foot y 0.495), in front of dark ranges that rise to y 0.475.
   - **The overlook:**
     - The mockup looks down across long dark bands, from a stand above them.
     - The new stand is 6 m lower (eye 21.7 against 27.6; ground 20.0, sampled from the baked heightfield). Its land
       60-120 m out sits only 2.4-3.7° below the eye (r23's 5.3-8.0°). The mid-ground dunes therefore hide the field,
       and the far ranges rise into the glow (the rows above).
     - The land is rolling mounds with the same 7.0 row sd as r23's (mockup 40.1), not bands.
   - **The lit waymark "at the left"** stands behind the HOVER chip (x 0.0-0.1, y 0.43-0.48): only its smoke and a
     glint at the chip's lower edge show. The mockup's fire is in the open on a near band (x 0.06, y 0.525). r23 showed
     its waymark fire at x 0.29.
2. **Is it a place a player reaches and stands? It is reachable, but not one a player stands in at this stage.**
   - Reachable: a 14.6° slope (max 14.9° within 5 m), 25 m east of the spawn on the spawn ridge's north end.
   - But `waymarks-lit` is the moment after the third waymark, and the walk test's own route goes waymark-west → tower.
     All three waymarks and the tower are north of z = -17. This stand is 90+ m back south, behind the player's own
     spawn, facing the tower from the far side of the ridge.
3. **Was it chosen to escape a land problem? Yes, by the builder's own words.**
   - 38496b429: "D stood on the waymark rise: its land rows (y 0.53-0.63) were the rise's own glow-facing downslope … lit
     flat at 29-40 … A late-light predictor … scored candidate spots aiming the tower at the mockup's frame x 0.85".
   - The spots were scored on land brightness, with only the tower's x held. Its size, the skyline and the elevation
     weren't scored.
   - Round 23's finding (R23B-4) and the builder's own round-23 note said D's troughs and rims were a landform job. This
     moves the camera off that job instead.
   - The gain it was chosen for didn't even reach the capture: rows 0.53-0.63 are 32-35, not "11, 4, 11, 17, 23".

So the move fails the ledger's condition: "re-aimed only to match its mockup's camera better, never to dodge a weak
area". **D's score is void.** For the lead's diagnosis only, I would give this frame **6.9**:
- the glow colour, the clean coil side and the lifted floor are real gains;
- against them, the tower is twice the mockup's size, the skyline's ranges cut the glow, and the land is still unbanded.

**The fix:** restore D to (38, 122) yaw 21.7 (the stand two seats walked in round 8). The mockup's tower size would
rather argue for one farther out, about 280 m from the tower, still on the north field and still elevated. Then fix the
bands in that view's terrain and light.

### The rest

- **Views:** apart from mock-D-hands, `camAt` is identical shot for shot to round 23's. The cameras diff (a4219aa →
  47959d6) is that one entry. No other breach.
- **Staging:** the `staged` map is unchanged, `pageErrors` is empty, and no stage handler changed. a5dc51367 moves the
  cookfire 5 m within the caravan frame. It is a world prop, the same in every view, so no breach.
- **Camera distance:** none of the six diffs adds a camera or distance term.
  - 5d0be40ff's boost reads `uDusk` (a time-of-day term, global), and its warm fill reads `sandShade` (facing).
  - 7db2a5a26 only re-weights the facing `away` term (0.75 → 0.55).
  - The late clip's ground holds 23-34 with no fall by distance.
- **Sky edits:**
  - 81c1f8034 sits inside row 4's ±70° ease, and the clip's glow row has no new step.
  - **8382bdad6 is a window centred on B's heading** (full within ±15°, easing out by ±45°). The portrait frame spans
    about ±18.6°, so the full window is about B's frame and the ramp is half row 4's.
  - That is the shape of round 22's ruling ("never as a window cut to a camera's frame"). The capture has no
    early-dusk orbit to show it seamless. Should-fix (R24B-7), not a void: B's frame itself changed only 0.3-1.6.
- **Terrain:** 7db2a5a26 adds a vertex (9, 44, 18.5) and ends the ridge at (14, 62, 14), and the terrain and navmesh are
  re-baked. In the aerials the black lens is smaller in both shots.
  - The walk file `sd-r24-b-musrfqm6.json` decodes to 19:03:37 UTC, three minutes before the 19:06:52 commit.
  - It has 7 legs, `stuck: []` on every leg, 0 air, slide and swim frames, and `walkErrors: []`.
  - No breach.
- **No narrowing:** the sunset saturation is global and reached by play, so it is not a breach. But it cost the hero
  views: h2's and h3's near sand went vivid red with clipped blue (12.5 % and 15.8 % of y 0.36-0.86), and
  aerial-spawn's patch. A should-fix under R24B-2.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **7.1** | 1. **The sky (x 0-1, y 0.05-0.36). Repeated, untouched.** Sky dE 25.7, the view's largest: navy at s 0.59 over a hot band (y 0.30-0.36: 113 against 97), where the mockup is a dusty grey dusk at s 0.36. No ray over the tower. 2. **The colour of the land (x 0-1, y 0.40-0.62). Changed.** The saddle reached the mockup's value (47.4 against 49.5; r23 30.9) and the right half rose (43.9 against 55.0; r23 38.5). But the shade is saturated red (saddle h7 s0.63 against h13 s0.39; near right s0.74 against 0.39), while the lit shoulder stays pale (s0.54 against 0.71). Saturation runs backwards across the tones (table above). The pattern holds at r +0.60. 3. **The hold (x 0.45-0.88, y 0.645-0.86). Improved.** It is off the lit shoulder (the near left now 74.8 against 75.0), but it's a two-turn hoop where the mockup hangs one slack diagonal loop at x 0.38-0.75. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.9** | 1. **The lit trough (x 0.2-0.6, y 0.47-0.53). Repeated (R23B-1), unchanged.** 92.4 h21 against 42.7 h318. The shade share fell further (22 % against 60 %; r23 30 %), and the land dE rose 19.5 → 21.4. The frame is still a pale lit dome over the mockup's violet lee. 2. **The sand's colour and the near floor (x 0-1, y 0.40-0.80). Mixed.** The diagonal's hue is right (h18 s0.54; r23 h24 s0.47) but its value fell (78.9 against 96.7; r23 86.8). The shade beside it is now red (below the line 63.6 h13 s0.65 against 36.2 h307 s0.25). The near sand the coil used to hide is too bright: 89.6 against 73.6 at y 0.60-0.64, 75.2 against 55.8 at y 0.65-0.80. 3. **The hold (x 0.45-0.88, y 0.645-0.86). Improved.** On the right side now, but about 0.08 right and 0.05 low of the mockup's pair (x 0.33-0.82, top 0.595), and its two turns coincide where the mockup's are two loops apart. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.2** | 1. **The low glow band (x 0-1, y 0.39-0.45). Repeated, unchanged.** 89.6 / 88.6 against 111.1 / 136.1, rosy (h359 / h7) where the mockup's is orange (h12 / h18); the pink streaks at y 0.33-0.39 remain (h328-353). **Gain:** the upper sky's streak contrast fell by a third (sd 6.1 → 3.8 at y 0.24). 2. **The land and the backdrop (x 0.65-1, y 0.44-0.62). Repeated.** The backdrop right is 36.5 against 17.2 and the near right 46.4 against 37.6. The canvas and cargo are blockier than the mockup's. **Gain:** the plume now rises over the hood (0.52-0.56 against 0.51-0.53; r23 0.71-0.74). 3. **The hold (x 0.45-0.88, y 0.645-0.86). Improved.** On the right, where the mockup's pair hangs (0.32-0.85), but one hoop, smaller and 0.05 low. The near left is clean and matches (37.6 against 39.2). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.4** | 1. **The firelit ground (x 0-1, y 0.58-0.80). Repeated, now visible.** The pool round the plinth is 83.8 h9 against 71.9 h18 (red and bright). The ground right is 62.3 h5 against 35.3 h12, the ground left 43.8 h359 against 38.8 h13. 2. **The far land and the low sky (x 0.55-1, y 0.40-0.55). Repeated.** The far land is 32.6 against 16.1, and the horizon sky 68.4 h299 against 89.1 h335. **Gain:** the black pockets are gone (below Y 8 2.1 % against round 23's 17.6 %). 3. **The fire and the hold (x 0.3-0.9, y 0.25-0.86).** The smoke is a column where the mockup's billows up-left (the hot core holds: 4726 pixels over 230 against 5542). The coil is now clear of the plinth (round 23's regression is fixed), but it's one hoop at x 0.45-0.88 where the mockup's two loops hang lower right of the brazier. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **void** (diagnostic 6.9) | The camera was moved to dodge the land (Ledger 5 above). For diagnosis only: 1. **The tower (x 0.82-0.87, y 0.405-0.495)** is 1.9x the mockup's and stands on a mid-ground mound, not on the skyline. 2. **The land (x 0-1, y 0.48-0.70)** is rolling grey-mauve mounds: median 32.5 against 12.8, row sd 7.0 against 40.1, s 0.35 against 0.53. The dark far ranges sit in the glow's brightest rows (y 0.48-0.49: 15-18 against 160-163). 3. **The hold** is twice the mockup's coil, now on the right side where it hangs. **Gain:** the glow colour (211,147,107 against 216,159,123; r23 194,120,91). |

**Seat score, Signal Dunes: 7.1.**
- D is void, so the seat score can't be a plain five-view mean.
  - The four valid views: (7.1 + 6.9 + 7.2 + 7.4) / 4 = **7.15**. Dropping D, the weakest view, would reward the breach.
  - So for the five-view mean I carry D at its last valid score, round 23's 6.8: (7.1 + 6.9 + 7.2 + 7.4 + 6.8) / 5 = **7.08**.
  - With D's diagnostic 6.9 in its place: 7.10.
- All three round to 7.1. The lead's three-seat mean should use 7.08. Under ledger 5, a voided view means the round is
  re-run before a pass counts.
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4, 6.7, 6.8,
  6.8, 7.0, 7.0 (6.96).
- Up about 0.1 on round 23 (6.96 → 7.08):
  - **Gains:** C's plinth clear, the plume over the wagon, the coil off the lit sand in dusk-fire and B, and the late
    floor.
  - **Unchanged:** A's lit trough and every sky but B's upper streaks.
  - **Cost:** the saturation boost made the shade red and left the lit faces pale.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| A's diagonal 78.9 h18, r +0.52 | **True** | 78.9 h18 s0.54; +0.52 / +0.50. It is *down* from 86.8 in value, which the README states. |
| A's lit quarter (130,90,66) h22 s0.49 | **True (my box: 132,94,70 h23 s0.47)** | The hue holds. The saturation is short *because the boost went to the mid-tones* (Q2 s0.63, Q4 s0.49). |
| Dusk-fire's saddle 31.4 → 47.4 (49.5), r +0.59 | **Value true; the colour unreported** | 30.9 → 47.4, r +0.60. But h7 s0.63 against h13 s0.39: it reached value as saturated red. |
| The late term ×0.45; D's band below Y 8 2.6 %, C's 2.1 %; D's median 33.6 not met | **True** | Source as stated. D 0.0 % (my box), C 2.1 %, D p50 32.5. Clip p5 12-13 at s 6-10. |
| The coil x ~0.45-0.85, top ~0.6; C's plinth clear | **x and the plinth true; the top not** | x 0.45-0.88; top **0.645**; the plinth is clear. The turns now overlap (`step` 0.3 → 0.18). |
| The ridge's south end tapered; the aerial lens shrunk | **True** | The `layout.ts` vertex (14, 62, 14); the lens is smaller in both aerials. Walk file verified. |
| B's plume at x 0.565 (mockup 0.527) | **True** | Peak 0.522 / 0.556 in two bands against 0.512 / 0.531. |
| B's night sky "clean" (8382bdad6) | **Partly** | The upper streaks' contrast is down a third. The low pink streaks (y 0.33-0.39, sd 21) and the mean rows are unchanged. The edit is a heading window (R24B-7). |
| D's glow line 200,140,105 (mockup 198,140,105) | **The colour true; the peak not** | 211,147,107 at y 0.469 against 216,159,123 at y 0.497. Value 158 against 169. The skyline cuts it at 0.479. |
| 38496b429: D's rows 0.53-0.63 "11, 4, 11, 17, 23" | **False in the capture** | 35, 34, 32, 32, 33 (full width); 30-38 in x 0.1-0.6. That was measured before the ×0.45 floor; the README repeats the move's reason without re-measuring it. |
| "Aerial-spawn shows a vivid orange key-lit patch" (known open) | **True, and it's out of gamut** | (110,28,6), s 0.94, blue clipped. The same clipping is in A (2.3 %), dusk-fire (4.5 %), h2 (12.5 %) and h3 (15.8 %). |
| "A's near sand is 88 against 68" (known open) | **True** | 89.6 against 73.6 (y 0.60-0.64); 75.2 against 55.8 (y 0.65-0.80). |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R24B-1 | D | **must-fix (ledger 5, void)** | **new** (38496b429) | the whole view | **D was moved to dodge its land.** The spots were scored by a land-brightness predictor (the builder's words), and the tower's size went 1.4x → 1.9x the mockup's (0.090 against 0.048). The stand is 6 m lower, and the far ranges rise into the glow (y 0.48-0.49: 15-18 against 160-163). The darker rows it was chosen for are 32-35 in the capture. **Fix:** restore (38, 122) yaw 21.7, or move farther out (the mockup's tower size implies about 280 m, elevated, on the north field) if the lead rules that a better camera match. Build the bands in that view's terrain: one or two transverse lee troughs and lit rims, of the field's own family, with a facing term that floors at the mockup's 11-15. **Accept:** the tower 0.045-0.055 tall; land p50 ≤ 25 with row sd ≥ 15; below Y 8 ≤ 3 %. |
| R24B-2 | A, dusk-fire (h2, h3, aerials) | should-fix | **regression** (5d0be40ff), on repeated R23B-2 | A and dusk-fire y 0.40-0.84; h2 and h3 near sand | **The saturation runs backwards, and it clips.** The mockups go s 0.25-0.28 in shade to 0.67 in the lit quarter. The game peaks at s 0.63-0.65 in Q2 and falls to 0.49-0.53 in the lit quarter, with Q1 at 0.42-0.48. The extrapolated `mix(dL, direct, 2.5)` + `max(0)` drives blue to 0 (A 2.3 %, dusk-fire 4.5 %, h2 12.5 %, h3 15.8 % of the band; aerial-spawn's patch (110,28,6)). **Fix:** saturate the key light's own colour by N·L (lit faces only), never by extrapolating about the luma. Limit it so no channel falls below about a third of the max. Put the highlight saturation the tone mapper loses back in the LUT re-fit (the builder's row 10). Pull the shade fill back toward grey-violet (the mockups' s 0.26). **Accept:** the lit quarter s ≥ 0.60 at h18-24; the shade quartile s ≤ 0.35; the saddle s ≤ 0.45 at value ≥ 44; blue < 12 under 0.5 % in every view, heroes included. |
| R24B-3 | A | should-fix | **repeated** (R23B-1), untouched | A x 0.2-0.6, y 0.47-0.53; x 0-0.42, y 0.60-0.80 | **A's lee is lit, and the uncovered near sand is too bright.** The trough is 92.4 against 42.7; lit 39 % against 23 %, shade 22 % against 60 % (worse than r23's 30 %). The grid's lit cells widen down to the *left* (rows 3-6, cols 0-4: 75-108 against 36-46). The near sand the coil used to hide is 89.6 against 73.6 and 75.2 against 55.8. **Fix:** as R23B-1. The ridge's west flank must turn away under the crest, with a lee trough between the crest and the near slope. Fit it on the row-demeaned grid, shade cells weighted like lit ones, and keep the walk at 0 stuck. Bring the near floor down by its facing to the key, not by distance. **Accept:** the trough ≤ 55 with the diagonal ≥ 80; the shade share ≥ 45 %; r ≥ +0.55; the near sand at y 0.65-0.80 ≤ 62. |
| R24B-4 | A, B, C (dusk-fire, D) | should-fix | **changed** (improved; R23B-3 partly fixed) | x 0.45-0.88, y 0.645-0.86 | **The coil is now on the right side, but it's one hoop, a little far right and low.** It spans x 0.45-0.88 with its top at 0.645 and centre ~0.665. The mockups' A/B/C pair spans 0.32-0.85, top 0.59-0.60, centre ~0.58, as two loops clearly apart. `step` 0.18 lets the turns coincide. **Fix:** move `LOOP` about 0.07 left and 0.05 up, and restore the turns' separation (`step` ≥ 0.3, or a different radius per turn) so two rims read at the top. **Accept:** in B, the centre at x 0.55-0.62, the top 0.58-0.61, two top rims ≥ 0.02 apart; C's plinth still clear. |
| R24B-5 | C, B | should-fix | **repeated** (R22B, R23B) | C y 0.58-0.80; B y 0.39-0.62 | **C's firelit ground and B's band.** C's pool is 83.8 h9 against 71.9 h18; its open ground right 62.3 against 35.3; the far land 32.6 against 16.1. B's glow band is 89.6 / 88.6 against 111 / 136, rosy (h359 / h7) where the mockup's is orange (h12 / h18); its backdrop right 36.5 against 17.2. **Fix:** a tighter, amber waymark light (h15-20) falling off within the pool, with the open ground on the late fill alone. In the painting B's dusk shows, warm and lift the 0-3° band toward (214,119,77). **Accept:** C's ground right ≤ 45; the pool at h14-20; B's band right ≥ 115. |
| R24B-6 | dusk-fire | should-fix | **repeated**, untouched since round 19 | y 0.05-0.36 | **Dusk-fire's sky**, the view's largest gap (dE 25.7): navy at s 0.59 over a hot band (113 against 97), where the mockup is a dusty grey dusk at s 0.36. **Fix:** in the early painting, desaturate the upper sky toward grey-violet and cool the band by about 15, eased over ≥ ±60° of heading (as row 4), never as a window. |
| R24B-7 | B | should-fix | **new** (8382bdad6) | the early painting, B's heading ±45° | **B's sky edit is a window cut near B's frame** (full within ±15°, easing out by ±45°). The frame spans about ±18.6°. That is round 22's ruled-out shape, and the capture has no early-dusk orbit to show it seamless. **Fix:** widen the ease to ≥ ±60° like row 4, and add an early-dusk orbit to the capture so the seats can check for a seam. |
| R24B-8 | process | should-fix | **new** | the README, 38496b429 | **A claim the batch's own later commit invalidated was carried into the README.** D's "11, 4, 11, 17, 23" was measured before the ×0.45 floor; the capture shows 32-35. The coil's "top about 0.6" is 0.645. **Fix:** re-measure every claim on the captured frame before the README quotes it. Name any metric the batch moved away (A's diagonal 86.8 → 78.9; A's shade share 30 → 22 %; the saddle's saturation). |

SCORE signal-dunes: 7.1

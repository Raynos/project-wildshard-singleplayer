# Round 23, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` with the lead's
  rulings (the camera-distance rule, the key ruling, the fog ruling, the round-22 rulings), and the three round-22 Signal
  Dunes seat files.
- The "Signal Dunes, round 23" section of `art/mockup-council/round-23/README.md` (its window table included) and the
  five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1325-8f296fb4/` (`mock-*`, h1-h4, first-frame, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 22's `20261003-1239-c43b91ce/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: the diffs of aab0d0a2f (hold, saturation, lantern), 0add5da36 (`layout.ts` ridge), a1563f4a9
  (`prep.py`) and 8f296fb4b (`render.ts` late facing term); `progress/physics/sd-r23-b-muspl0kj.json`.

How I measured (round 22 seat B's tools and boxes; they reproduce the README's window table to 0.1 and my r22 numbers):
- **Brightness** is Rec. 709 luma. **Sat** is the mean (max - min) / max; **h** the HLS hue of the region's mean RGB;
  **B/R**, **G/R** the mean-channel ratios.
- **Row-demeaned r:** Pearson r of a 10x7 grid of sigma-12 luma over y 0.38-0.58, each row's mean removed.
- **Grid dE:** mean CIELAB distance between 12x12 cell means of mockup and game over a band (dL lightness, dAB colour).
- **Lit / shade share:** the share of band pixels (y 0.38-0.555) above Y 80 / below Y 45.
- **The new coil changes which patches are clean.** It now spans x 0.113-0.628 with its top at y 0.565 (found as the
  r22 → r23 difference common to the static B, C and D views). Every box below y 0.555 is coil-free; under it I use only
  x < 0.10 or x > 0.65.

## What changed (r22 to r23)

| View | Mean \|dY\| | Pixels \|dY\| > 8 | Sky y < 0.33 | Land y 0.33-0.55 | Low y 0.55-0.86 |
|---|---|---|---|---|---|
| A | 8.1 | 19.0 % | 0.1 | **19.3** | 12.0 |
| dusk-fire | 7.7 | 18.7 % | 0.1 | **17.4** | 11.9 |
| B | 1.8 | 4.1 % | 0.4 | 1.1 | 4.2 (coil) |
| C | 2.8 | 6.7 % | 1.0 | 2.5 | 5.8 (coil) |
| D | 2.1 | 7.1 % | 0.1 | 1.8 | 4.9 (coil) |
| h1 / first-frame / h2 / h3 / h4 | 7.4 / 7.3 / 2.2 / 1.7 / 2.5 | | 0.0-0.1 | 8.8 / 8.4 / 1.2 / 0.0 / 0.4 | coil |

Three things moved: the spawn pair's land (the new ridge), the hold in every view, and a small late-land darkening. No
sky changed in any scored view.

**Grid dE to the mockup, r22 → r23** (lower is closer; land bands stop at y 0.555, above the coil):

| View | Sky band | Land band |
|---|---|---|
| A | 15.2 → 15.2 | **14.2 → 19.5** (dL 7.7 → 11.2, dAB 11.4 → 15.1), *further* |
| dusk-fire | 25.2 → 25.2 | **21.8 → 16.8** (dL 10.7 → 9.2, dAB 18.7 → 13.1) |
| B | 10.6 → 10.2 | 11.7 → 9.7 |
| C | 12.9 → 12.9 | 16.9 → 16.5 |
| D | 7.5 → 7.4 | 23.0 → 22.7 |

## Measurements (mockup / r22 / r23)

### The spawn pair (row 1's ridge, row 5's saturation)

| Region / metric | Mockup | r22 | r23 |
|---|---|---|---|
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.7** (154,84,50) h20 s0.65 B/R 0.32 | 46.2 h351 | **86.8 (114,81,60) h24 s0.47 B/R 0.53** |
| A crest top x 0.3-0.5, y 0.40-0.43 | 86.7 h19 s0.58 | 50.9 | 92.1 h25 s0.42 |
| A tower mound x 0.45-0.75, y 0.38-0.42 | 73.1 h15 | 42.6 | 60.8 h11 |
| **A shade trough x 0.2-0.6, y 0.47-0.53** | **42.7 h318** | 38.5 | **95.3 h26** |
| A below the line x 0.55-0.85, y 0.49-0.53 | 36.2 h307 | 31.1 | 50.9 h11 |
| A left lee x 0-0.3, y 0.40-0.50 | 39.6 | 40.3 | 54.7 |
| A right slope x 0.78-1, y 0.44-0.54 | 48.5 | 33.5 | 36.6 |
| A band p10 / p50 / p90 | 33.6 / 42.3 / 105.6 | 30.4 / 41.0 / 95.3 | 29.6 / **70.6** / 103.9 |
| A lit / shade share | 23 % / 60 % | 16 % / 61 % | **43 % / 30 %** |
| A row-demeaned r (0.38-0.58 / 0.36-0.56) | | +0.54 / +0.53 | **+0.46 / +0.47** |
| A near sand, coil-free x 0.013-0.10, y 0.60-0.85 | 59.5 h17 | 76.5 h17 | 75.9 h22 |
| dusk-fire shoulder top x 0-0.35, y 0.50-0.555 | 85.4 h22 s0.71 B/R 0.29 | 55.1 h6 | **87.9 h25 s0.49 B/R 0.51** |
| dusk-fire shoulder strip x 0-0.10, y 0.50-0.70 | 85.4 | 80.7 | 87.4 |
| dusk-fire mid dunes left x 0-0.45, y 0.40-0.50 | 62.5 h18 | 40.8 | 82.9 h24 |
| dusk-fire trough x 0.2-0.6, y 0.47-0.53 | 63.4 h19 | 35.6 | 72.0 h20 |
| dusk-fire right x 0.6-1, y 0.40-0.50 | 55.0 h17 | 34.1 | **38.5 h352** |
| dusk-fire saddle (seat A's px window) | 49.5 h13 | 39.8 | **30.9 h326** |
| dusk-fire lower right x 0.6-0.97, y 0.48-0.56 | 46.1 h10 | 40.7 | **27.9 h300** |
| dusk-fire lit / shade share | 14 % / 29 % | 6 % / 68 % | 31 % / 43 % |
| dusk-fire row-demeaned r | | +0.39 / +0.25 | **+0.60 / +0.57** |
| Lit quarter of y 0.36-0.56, A · dusk-fire | h20 s0.66 · h21 s0.68 | h18 s0.48 · h13 s0.52 | **h28 s0.43 · h26 s0.46** |

- **A's diagonal is finally lit to value** (86.8 against 96.7; open since round 9). **But the ridge's whole west flank is
  lit with it.** The mockup keeps a violet shade trough between the crest and the lit near slope (42.7 at h318); the
  game lights it at 95.3. Twice the mockup's share of the band is lit (43 % against 23 %) and half its shade is left
  (30 % against 60 %). So A's band median jumped to 70.6 against 42.3, its pattern r fell to +0.46, and its land dE grew
  14.2 → 19.5. The frame now reads as one big pale lit dome with a black slip face on the right, not a gold crest over a
  shadowed valley.
- **Dusk-fire's light is the best yet** (r +0.60; land dE 21.8 → 16.8). The left shoulder reaches the mockup's value
  (87.9 against 85.4) and the colour is warm everywhere. Its contrast is harsher than the mockup's, though: the right
  half sits in a deep slip-face shadow (38.5 against 55.0; the lower right 27.9 h300 against 46.1 h10), where the
  mockup's saddle is a soft mid-tone.
- **The lit sand is now pale beige, not amber.** The value matches; the colour does not. A's diagonal is
  (114,81,60) h24 sat 0.47 against (154,84,50) h20 sat 0.65, with blue at B/R 0.53 against 0.32. The lit quarters
  overshot the hue to the yellow side (h26-28 against 20-21; round 22 was h13-18 on the red side) and lost more
  saturation (0.43-0.46 against 0.66-0.68). The near sand is fine in colour (A's strip h22 s0.59 against h17 s0.58), but
  still 16 too bright (75.9 against 59.5, unchanged).

### B

| Region | Mockup | r22 | r23 |
|---|---|---|---|
| Lantern pool x 0.40-0.56, y 0.515-0.54 | 56.9 h14 | 56.9 h2 | **58.6 (90,51,43) h11** |
| Wagon front x 0.48-0.62, y 0.47-0.52 | 45.7 h17 s0.71 | 44.8 h8 | **48.2 h16 s0.75** |
| Glow band left / right | 111.1 h12 / 136.1 h18 | 89.5 / 88.9 | 89.1 / 87.3 (unchanged) |
| Mid sky x 0-1, y 0.25-0.38 | 59.6 h258 | 55.9 h297 | 55.1 h293 (unchanged) |
| Backdrop right / land left | 21.5 / 39.4 | 36.6 / 57.2 | 36.6 / 57.1 (unchanged) |
| Near right x 0.65-0.97, y 0.56-0.70 | 35.6 | 45.0 | 44.4 |

The pool and the wagon's lamp light are amber at last, and smaller (the red patch under the crosshair is gone). The rest
of B is unchanged.

### C

| Region | Mockup | r22 | r23 |
|---|---|---|---|
| Far land x 0.6-0.9, y 0.48-0.53 | 16.1 h325 | 33.7 | 31.7 h351 |
| Dune behind the brazier x 0.55-1, y 0.45-0.49 | 41.0 h358 | 37.4 | 35.6 |
| Land y 0.47-0.55: p5 / p50 / share below Y 8 | 12.8 / 22.1 / 0.3 % | 15.7 / 33.6 / 2.1 % | **3.7 / 32.9 / 17.6 %** |
| Ground right x 0.65-0.97, y 0.60-0.70 | 32.8 h11 | 52.4 h0 | 51.0 h2 |
| Near-left strip x 0.013-0.10, y 0.58-0.66 | 56.5 h15 | 66.9 h5 | 64.6 h6 |
| Horizon sky x 0.6-0.9, y 0.40-0.45 | 89.1 h335 | 68.3 h298 | 68.3 (unchanged) |
| The plinth (x 0.31-0.44, y 0.55-0.585) | fully visible, pool round its base | visible | **the coil's top arc (y 0.565) crosses it** |

The new coil's top arc runs right under the brazier, hiding the lower plinth and most of the fire pool, so the brazier
stands in the loop like a noose. In the mockup the coil hangs lower right and the plinth and the amber pool are clear.
The firelit ground is still red (h0-6 against h11-15). The pool can no longer be measured clean: my round-22 pool boxes
now take in the coil.

### D

| Region | Mockup | r22 | r23 |
|---|---|---|---|
| Land y 0.52-0.56, full width | 15.2 | 33.0 | 28.8 |
| Land rows y 0.48-0.70, x 0.64-0.98 | 134 40 12 16 11 24 18 16 26 44 31 | 28 26 23 27 27 27 40 41 41 41 41 | 28 23 18 25 **14** 23 39 41 41 41 41 |
| Land rows y 0.48-0.70, x 0-0.08 | 98 32 20 12 22 14 13 37 65 54 49 | 26 26 39 38 39 39 38 39 37 38 36 | 26 26 39 36 39 39 38 38 37 38 36 |
| Land y 0.50-0.60: p5 / p50 / share below Y 8 | 10.5 / 12.8 / 0.9 % | 11.3 / 37.8 / 3.6 % | **4.1 / 34.8 / 21.4 %** |
| Near right x 0.65-0.97, y 0.60-0.70 | 27.3 | 40.8 | 40.5 |
| Horizon glow peak (row mean, x 0-0.6) | **168.8 at y 0.497** (217,159,122) | 128.8 at y 0.472 | 128.6 at y 0.472 |
| Left edge sky x 0-0.05, y 0.30-0.45 | 60.3 h269 | 65.5 h298 | **62.1 h279** |
| Rows 30-36 % / 36-42 % | 57.9 / 70.9 | 55.7 / 75.2 | 55.6 / 74.9 |

- **The mid dunes' lees now fall dark** (right side at y 0.56: 14 against the mockup's 11). That is the first step toward
  D's troughs.
- **But they fall to black, and the rest doesn't move.** 21 % of the band is below Y 8 against the mockup's 0.9 %, while
  the median stays 34.8 against 12.8. The near slope (y 0.60-0.70) is a flat 36-41 where the mockup has a trough at 13
  and a rim at 65.
- **The pink left edge is gone** (h279 against h269; r22 h298). The glow line is unchanged: 129 at y 0.472 against 169
  at y 0.497.

### The hold (aab0d0a2f)

| | Mockups | r22 | r23 |
|---|---|---|---|
| A / B / C | two coils, x 0.33-0.86, top 0.57-0.60, centre ~0.59 | one ring ~0.25 wide, top ~0.66 | **two coils, x 0.11-0.60 (+ handle to 0.63), top 0.565, centre ~0.36** |
| D | one narrow coil 0.23 wide, x 0.57-0.80, top ~0.61, from the gauntlet | one ring | the same 0.5-wide pair |
| dusk-fire | one slack diagonal loop, x 0.37-0.76, top 0.58 | one ring | the same 0.5-wide pair |

The count and the width are now right for A, B and C. The coil hangs **~0.22 of the frame too far left** and ~0.02-0.03
too high, though, so it covers the centre-left of the frame where the mockups have open sand. In D and dusk-fire it is
twice their mockups' coils. It is one global `LOOP` constant, the same in all twelve shots.

### The late clip (row 2, row 4)

| clip.mp4, 1 fps | r22 | r23 |
|---|---|---|
| Top sky row: largest red step across 1/12-wide columns, s 1 / s 4-6 / s 7-10 | 22.0 / 15.1-24.6 / 6.6-10.2 | **14.5 / 7.9-9.3 / 5.9-9.8** |
| Ground y 0.55-0.90: p10 at s 6 / 8 / 10 | 23.4 / 17.4 / 18.4 | **12.6 / 4.4 / 6.3** |
| Ground share below Y 8 at s 6 / 8 / 10 | 0 / 0 / 0.3 % | **8.4 / 16.7 / 13.3 %** |
| Far band y 0.40-0.50 | 28-33 | 25-33 |

The seam is gone. The late lee faces now go black in real play, as large near-black wedges on the near dunes.

## Ledger-5 checks

- **Views:** `meta.json` camAt is identical shot for shot to round 22's; the cameras blob a4219aa is unchanged. No
  breach.
- **Staging:** the `staged` map is unchanged; `pageErrors` is empty; no commit touched a stage handler. No breach.
- **The hold** is one global `LOOP` constant (`whipModel.ts`), the same in every shot, an idle pose a player holds. No
  breach.
- **Row 1's ridge** (`layout.ts`, crest 2 now (-34.3,-11.8) → (11.6,54.4), w 22, lee 40 west) is real, baked terrain
  with a re-baked navmesh. The walk file `sd-r23-b-muspl0kj.json` (18:11 UTC, before the 18:15 commit; terrain
  unchanged since) has 7 legs, 0 stuck, and 0 air, slide or swim frames, with `walkErrors: []`. **No breach.** It was
  fitted by a predictor that correlates against the A and dusk-fire frames, the same pattern as round 12's "ridge placed
  by A's frame" and round 13's should-fix. On the aerials it reads as one more rounded mound with an oval shadow
  pocket, the same kind as the spawn cluster's others; the field beyond is still a gently rippled sheet. One world, but
  the relief is still concentrated in the spawn's frustum (should-fix, repeated; R23B-7).
- **Row 2's term** reads `uDusk`, the world normal's tilt and its facing to the glow (`toGlow = dot(n.xz, glowXZ)`). It
  has no camera position or distance. The camera-distance rule holds; the black is from facing, which the rule allows
  (but see R23B-4 on likeness).
- **Row 4's sky** is still a world-space panorama edit (`prep.py`, `wh = ease((70 - dh) / 60)`), now smooth. The
  round-22 seam ruling is closed on the pixels (above).
- **No narrowing:** h1 and first-frame took the spawn pair's land change; h2, h3 and h4 changed only by the coil. Nothing
  was hidden or dropped.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.9** | 1. **The sky (x 0-1, y 0.05-0.36). Repeated, untouched.** Sky dE 25.2, the view's largest: a saturated navy top over a hot red band (sky band 74.8 sat 0.58 h356 against 66.5 sat 0.36 h14); the big ray over the tower is absent. 2. **The light falls right, the colour is pale (x 0-1, y 0.40-0.56). Gain in pattern, new in colour.** r +0.39 → +0.60, the shoulder 87.9 against 85.4. But the lit faces are beige (h25 sat 0.49 B/R 0.51 against h22 0.71 0.29), and the right half is a deep slip-face shadow (38.5 against 55.0; the lower right 27.9 h300 against 46.1 h10) where the mockup's saddle is mid-tone. 3. **The hold (x 0.1-0.65, y 0.56-0.86). Regression in size.** A 0.5-wide double coil at the centre-left, where the mockup hangs one slack diagonal loop at x 0.37-0.76. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.9** | 1. **The ridge's flank is lit where the mockup is in shade (x 0.2-0.6, y 0.47-0.53). New.** 95.3 h26 against 42.7 h318. Lit share 43 % against 23 %, shade 30 % against 60 %; r +0.54 → +0.46; land dE 14.2 → 19.5. **Gain:** the diagonal itself is lit, 86.8 against 96.7 (r22 46.2). 2. **The lit sand is pale beige (x 0.3-0.75, y 0.40-0.55). Repeated, moved from red to beige.** (114,81,60) h24 sat 0.47 against (154,84,50) h20 sat 0.65; the near sand is still 76 against 60. 3. **The hold (x 0.11-0.63, y 0.565-0.86). Changed.** Two coils of the right width, but 0.22 too far left (centre ~0.36 against ~0.59), top 0.565 against 0.595. The pale far strip (x 0-0.4, y 0.375-0.40, 90 against 72) is unchanged. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.0** | 1. **The sky and its band (x 0-1, y 0.15-0.45). Repeated, untouched.** Streaky pink-violet clouds (mid sky h293 against h258); the glow band 89 / 87 against 111 / 136. 2. **The land and the plume (x 0.4-1, y 0.15-0.60). Repeated.** The backdrop right is 36.6 against 21.5, the land left 57 against 39, the near right 44 against 36. The wisp rises right of the hood. **Gain:** the lantern pool is amber (h11 against h14, r22 h2) and the wagon front h16 against h17; land dE 11.7 → 9.7. 3. **The hold (x 0.11-0.63, y 0.565-0.86).** Two coils at the centre-left where the mockup's hang at x 0.33-0.80; better than round 22's single ring. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.2** | 1. **The coil frames the brazier (x 0.11-0.63, y 0.565-0.86). Regression.** Its top arc crosses the plinth (x 0.31-0.44, y 0.55-0.585) and covers most of the fire pool; the mockup's coil hangs lower right with the plinth and the pool clear. 2. **The firelit ground is red and bright (x 0.05-0.97, y 0.58-0.70). Repeated.** The ground right is 51.0 h2 against 32.8 h11; the near-left 64.6 h6 against 56.5 h15. 3. **The far land and the fire (x 0-1, y 0-0.55). Repeated.** The far land is 31.7 against 16.1, with new black pockets (17.6 % below Y 8 against 0.3 %); the plume is a straight column where the mockup's billows up-left; the low sky right 68 h298 against 89 h335. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.8** | 1. **The land (x 0-1, y 0.48-0.70). Repeated; the mid lees are a partial gain, the black is new.** The mid dunes' lees now fall dark (14 against 11 at the right), but to black: 21 % of the band below Y 8 against 0.9 %, while the median stays 34.8 against 12.8. The near slope is a flat 36-41 with no trough or rim (the mockup: 13 then 65). 2. **The hold (x 0.11-0.63, y 0.565-0.86). Regression for D.** A 0.5-wide double coil at the centre-left, where D's mockup hangs one narrow coil (0.23 wide, x 0.57-0.80) from the gauntlet. 3. **The horizon glow (x 0-0.6, y 0.45-0.50). Repeated.** 129 at y 0.472 against 169 at y 0.497. **Gain:** the pink left edge is gone (h279 against h269; r22 h298). |

**Seat score, Signal Dunes: (6.9 + 6.9 + 7.0 + 7.2 + 6.8) / 5 = 6.96, so 7.0.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4, 6.7, 6.8,
  6.8, 7.0 (6.98).
- Flat against round 22 (6.98 → 6.96). Dusk-fire's light and B's lantern are real gains. The hold gained in A and B, but
  lost in C (the plinth), D and dusk-fire (twice their coils). A's diagonal is lit at last, but its trough is lit with
  it, so A nets out level.
- The unrounded 6.96 is for the lead's three-seat mean.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The window table, "Now" column: A diagonal 86.9 h24, lee 47.5, dusk-fire shoulder 74.2, saddle 30.9 | **True on those windows** | 86.8 h24, 47.5, 74.2, 30.9. |
| "A's near ground 71.6 → 60.5 (mockup 57.1)" | **False: the coil, not the sand** | Seat A's window (10,1160)-(150,1400) now has the coil across x 80-150 (column means 42-55 against 70 on bare sand). Columns x 10-80: 70.6 → 70.1. A coil-free strip: 76.5 → 75.9 (mockup 59.5). |
| "Dusk-fire's shoulder 77.9 → 74.2 (mockup 83.7); row 3: shoulder 74 against 84" | **Understated: the coil again** | Seat A's shoulder window runs to y 0.70, through the coil. Coil-free: shoulder top 55.1 → **87.9** (mockup 85.4); the left strip 80.7 → 87.4 (85.4). |
| 0add5da36's round-22 column (near sand 60.7, shoulder 68.0) | **Wrong** | The round-22 pixels are 71.9 and 78.1; the README's 71.6 / 77.9 are right. |
| Row-mean-removed r: dusk-fire +0.56, A +0.47 | **True** | +0.60 / +0.57 and +0.46 / +0.47. A's is *down* from round 22's +0.54; the README doesn't say so. |
| "A is the closest frame yet" (the lead) | **Not on the numbers** | A's land dE rose 14.2 → 19.5, its r fell, and its shade trough is lit (95 against 43). Its diagonal value is the closest yet. |
| Row 2: D's land 37 → 35 (mockup 17), C's far band 35 → 31 | **True in direction** | D y 0.52-0.56: 33.0 → 28.8; C 33.7 → 31.7. Unreported: the share of D's band below Y 8 went 3.6 → 21.4 % and the clip's ground to 8-17 % (mockup 0.9 %). |
| Row 4: the strip's red step 21.2 → 3.7; no window edge | **True** | The clip's largest column step is 5.9-9.8 at s 2-10 (r22 15.1-24.6 at s 4-6). D's left edge h298 → h279. |
| Hold: two coils ~0.5 wide, tops at y 0.57-0.60 in A, B and C, the fist on the right | **Width true; top and place not** | x 0.11-0.60 (+ handle), top 0.565; the mockups' coils span x 0.33-0.86 (centre ~0.59). |
| B's lantern pool h3 → h11 (mockup h15) | **True** | h2 → h11 (mockup h14 on my box); the wagon front h8 → h16 (h17). |
| Lit quarter: A h27 s0.44, dusk-fire h25 s0.46 (mockup h21 s0.67 / h22 s0.68); "the hue is close" | **Numbers true; the hue overshot** | h28 s0.43 / h26 s0.46. Round 22 was h18 / h13: the hue moved past the mockup, to the yellow side, and saturation fell further. |
| Walk test 7 legs, 0 stuck; climb 39.1° | **Walk true** | The file as stated; I did not re-measure the climb. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R23B-1 | A (dusk-fire) | should-fix | **new** (row 1) | A x 0.2-0.6, y 0.47-0.53; dusk-fire x 0.6-1, y 0.40-0.56 | **The ridge lights the mockup's shade.** A's trough is 95.3 against 42.7. The band is 43 % lit against 23 %, 30 % shade against 60 %; r +0.46, land dE 19.5 (r22 14.2). Dusk-fire has the opposite error on its right half (38.5 against 55.0). **Fix:** keep the crest line, but give the predictor's objective the shade cells as much weight as the lit ones (fit the row-demeaned grid, not the lit windows). In practice the lit flank must turn away below the crest: a trough or a lee between the crest and A's near slope, and a softer slip face on dusk-fire's right. Re-walk and check the aerials. **Accept:** A's trough ≤ 55 with the diagonal ≥ 80; A's lit share ≤ 30 %; A's r ≥ +0.55; dusk-fire's right ≥ 48 with its r ≥ +0.50. |
| R23B-2 | A, dusk-fire (B, C) | should-fix | **repeated** (R22B-2; moved from red to beige) | the lit quarters; A x 0.4-0.7, y 0.40-0.44; dusk-fire x 0-0.35, y 0.50-0.555 | **The lit sand is pale beige, not amber.** The value now matches; the colour doesn't. A's diagonal is h24 sat 0.47 B/R 0.53 against h20 0.65 0.32; dusk-fire's shoulder h25 0.49 0.51 against h22 0.71 0.29. The lit quarters are h26-28 against 20-21. The 2.5 → 1.6 cut took saturation along with the red cast, and the violet fill's blue shows on the key-lit faces. **Fix:** saturate the key light's own colour (less blue and some less green in it), instead of a saturation multiplier about the luma. On faces where the direct term dominates, mix less of the cooled fill. **Accept:** the lit quarters at h18-24 with sat ≥ 0.58; A's diagonal B/R ≤ 0.42; the near sand's hue still h15-22. |
| R23B-3 | C, D, dusk-fire (A, B) | should-fix | **regression** (aab0d0a2f) | x 0.11-0.63, y 0.565-0.86 | **The coil hangs ~0.22 too far left.** It spans x 0.11-0.60, centre ~0.36, top 0.565, where A's, B's and C's coils span x 0.33-0.86, centre ~0.59, top 0.57-0.60. In C its arc crosses the plinth and covers the fire pool. In D and dusk-fire it is twice the mockups' coils. **Fix:** shift `LOOP` so the coils hang across and left of the fist (centre x ~0.58), top ~0.59. Keep the width, perhaps 10-15 % smaller as a compromise toward D and dusk-fire. **Accept:** the coil's centre at x 0.55-0.62 and top 0.58-0.61 in B; C's plinth fully visible above the coil. |
| R23B-4 | D, C | should-fix | **new** (row 2) | D x 0-1, y 0.48-0.70; C x 0-1, y 0.47-0.55; the clip | **The late lee faces go black, and the rest stays bright.** Below Y 8: D 21.4 % against 0.9 %; C 17.6 % against 0.3 %; the clip's ground 8-17 % (r22 0-0.3 %). D's median is still 34.8 against 12.8, and its near slope a flat 36-41. **Fix:** floor the away term so lee faces settle at the mockup's trough value (~11-15), not near 0. Bring the median down with the late hemi fill on all sand, as a global dusk term (never by distance). D's near rims and troughs stay a landform job (the builder's own conclusion). **Accept:** D's band below Y 8 ≤ 3 % and p50 ≤ 25; the clip's ground below Y 8 ≤ 2 %. |
| R23B-5 | process | should-fix | **new** | the README's windows | **Two of the README's numbers measure the coil.** A's "near ground 71.6 → 60.5" is the coil entering seat A's window; the sand is unchanged (70.6 → 70.1 on x 10-80). Dusk-fire's shoulder, which is really at the mockup (87.9 against 85.4), is understated as 74.2. 0add5da36's round-22 column has two wrong values (60.7, 68.0). **Fix:** move every window off the coil (y < 0.555, or x < 0.10 / > 0.65) and re-baseline round 22 on the new windows. Report each metric that moved away (A's r fell 0.54 → 0.46). |
| R23B-6 | dusk-fire, B, D | should-fix | **repeated** (R22B-4, R22B-7), untouched | dusk-fire y 0.05-0.36; B y 0.15-0.45; D x 0-0.6, y 0.45-0.50 | **The skies.** Dusk-fire's sky is the biggest gap in its view (dE 25.2: navy and saturated, band 74.8 sat 0.58 against 66.5 sat 0.36). B's streaks and its dim band (89 / 87 against 111 / 136) remain. D's glow line is 129 at y 0.472 against 169 at y 0.497. Fixes as R22B-4 and R22B-7: desaturate the early painting's upper sky toward a grey dusk; warm and lift B's band in the painting B's dusk shows; lift D's 0-2° rows at its heading toward (217,159,122). |
| R23B-7 | A, dusk-fire | nit | **repeated** (rounds 12-13) | `layout.ts` crest 2; the aerials | **Row 1's ridge was fitted to two frames.** It is real, walkable and of a kind with the spawn cluster's other mounds, so it's no breach. But the relief stays concentrated in the spawn's frustum, while the field beyond is a gently rippled sheet. When R23B-1 reshapes it, fit it by the grid and give the field around it ridges of the same family, so h1, h4 and the aerials read as one dune sea. |

SCORE signal-dunes: 7.0

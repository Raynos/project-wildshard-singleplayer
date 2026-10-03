# Round 20, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendment), the brief, `scores.md` with the lead's
  rulings (the key decoupled from the glow; no camera-distance brightness term; the engine fog allowed), and the three
  round-19 Signal Dunes seat files.
- The "Signal Dunes, round 20" section of `art/mockup-council/round-20/README.md`, its five sheets, and every frame in
  `progress/sunscar-dunes/20261003-1134-e4d15d35/` (`mock-*`, h1-h4, both aerials, `first-frame`, `clip.mp4` at 1 fps,
  `meta.json`), against round 19's `20261003-1047-671128ac/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: `git diff 671128acd e4d15d354 -- src/shards/sunscar-dunes` (`layout.ts`, `look/painted.ts`,
  `look/render.ts`, `world/build.ts`, `world/fireFx.ts`, `world/tower.ts`), the commit bodies of c1e7577c2 and e4d15d354,
  and the walk-test outputs `progress/physics/sd-r20-b-muslf5ap.json` and `sd-r21-b-muslzi8h.json`.

How I measured (round 19 seat B's tools and regions; they reproduce its r19 numbers exactly: A's diagonal 46.4, mound
39.3, near floor 96.5, row-demeaned r dusk-fire +0.43 / A +0.15):
- **Brightness** is Rec. 709 luma. **Sat** is the mean (max - min) / max. **h** is the hue of the median RGB, **C** its chroma.
- **Row-demeaned r** is the Pearson r of a 10x7 grid of sigma-12 luma over the dune band x 0-1, y 0.38-0.58, each row's
  mean removed. **The clean patch** is x 10-160, y 1160-1400 px (clear of the coil and HUD).
- **Streaks:** the column high-pass (41 px) max and the top/bottom coherence in the low-sky box.
- Regions are frame fractions (x left to right, y top to bottom).

## What changed (r19 to r20)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky, y < 0.33 | Land, y 0.33-0.60 | Viewmodel band, y 0.60-0.86 |
|---|---|---|---|---|---|
| dusk-fire | 4.1 | 2.2 % | 3.6 | 7.2 | 3.0 |
| A | 4.3 | 2.5 % | 3.7 | 7.7 | 3.2 |
| B | 5.1 | 1.3 % | 7.3 | 8.1 | 1.4 |
| C | 2.9 | 2.9 % | 4.3 | 4.4 | 0.9 |
| D | **1.5** | 0.2 % | 0.6 | 3.4 | 1.1 |

A small round: about a tenth of round 19's change in each view. The viewmodel is unchanged (glove back in D: 34.7, p95 59,
fine 3.8 against r19's 34.8 / 59 / 3.9; the mockup's 30.4 / 79 / 8.2).

## Measurements (mockup / r19 / r20)

### Sky

| View, region | Mockup | r19 | r20 |
|---|---|---|---|
| A low-sky streak box x 0.30-0.53, y 0.31-0.345: col HP max / coherence | 3.0 / +0.28 | 5.5 / +0.93 | **0.6 / +0.39** |
| dusk-fire streak box x 0.4-0.75, y 0.30-0.36 | 21.0 / +0.13 (clouds) | 1.8 / +0.71 | 1.6 / +0.41 |
| A top x 0.45-0.62, y 0.08-0.12 | 30.0 (27,28,56) | 34.4 | 39.5 (39,35,87), C 52 |
| A band x 0.05-0.45, y 0.22-0.26 / 0.26-0.30 | 77.5 / 97.0 | 90.4 / 110.5 | 93.3 / 110.9, sat 0.59-0.68 against 0.36-0.55 |
| A glow right of the tower x 0.65-0.95, y 0.30-0.34 | 153.1 | 132.8 | 129.6 |
| dusk-fire top x 0.45-0.62, y 0.08-0.12 | 35.5 (37,34,42), **C 8** | 33.8, C 49 | 38.8 (37,34,87), **C 53** |
| dusk-fire band x 0.1-0.9, y 0.24-0.30 | 83.9, sat 0.48 | 107.9, sat 0.66 | 108.6, sat 0.66 |
| B top x 0.05-0.6, y 0.08-0.12 | 31.6 (20,26,63) | 12.9 (1,3,66) | **22.1 (1,12,86)** |
| B upper x 0.05-0.6, y 0.12-0.20 | 34.4 | 19.9 | **31.0** |
| B mid x 0.05-0.4, y 0.25-0.38 (sd) | 57.4 (9.9) | 54.3 (20.2) | 52.7 (15.1) |
| B glow right x 0.75-0.95, y 0.40-0.44 | 136.1 **h19** | 94.5 h333 | **86.9 h353** |
| C top x 0.45-0.62, y 0.03-0.08 | 22.4 (15,21,55) | 6.3 (0,1,60) | **6.3 (0,1,61), unchanged** |
| C upper left x 0.02-0.3, y 0.10-0.30 | 43.5, sat 0.38 | 20.3, sat 0.92 | 22.9, sat 0.86 |
| D mid x 0.05-0.95, y 0.34-0.44 | 72.1 h277 | 90.3 h337 | 90.7 h339 |
| D horizon line, x 0.05-0.7: peak row / its colour | **159 at y 0.49**, (209,146,108) h23 | 119 at y 0.45 | **123 at y 0.45**, (217,108,95) h6 |

- **The streaks are gone** (A 5.5 -> 0.6). Builder claim true; h1 and `first-frame` are clean too.
- **B's top and upper sky moved toward the mockup** (upper 31 against 34; r19 20), but R is still clipped at 1 in the top.
- **B's band is not orange.** It moved from magenta (h333) to red-pink (h353), and dimmed to 87 against 136.
- **C's top is untouched:** the early-gain fix acts only on the early strip, and C's staged dusk shows the late one.
- **D's horizon line** gained 4 luma. It is still a coral line (h6) 77 % of the mockup's peach peak (h23).

### The spawn pair: the dune band

| Region / metric | Mockup | r19 | r20 |
|---|---|---|---|
| **Row-demeaned r: dusk-fire / A** | | +0.43 / +0.15 | **+0.45 / +0.24** |
| Share over 80, left / right half (y 0.36-0.56): dusk-fire | 24.9 / 0.9 % | 25.1 / 3.9 % | **15.9** / 0.7 % |
| Share over 80, left / right: A | 28.1 / 17.3 % | 42.2 / 8.7 % | 33.6 / **1.7** % |
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.7** h20 | 46.4 | **48.7** h340 |
| A tower mound x 0.45-0.75, y 0.38-0.42 | 73.1 | 39.3 | 44.1 |
| A left lee x 0-0.3, y 0.40-0.50 | 39.6 | 60.1 | 58.0 |
| A under the new crest x 0.55-1, y 0.52-0.58 | 45.8 | 73.5 | **60.4** |
| A near floor x 0-0.3, y 0.58-0.70 / clean patch | 70.4 / 57.2 | 96.5 / 77.5 | **89.1 / 71.7** |
| dusk-fire lit shoulder x 0-0.35, y 0.50-0.70 | 82.9 | 85.4 | 77.7 |
| dusk-fire saddle x 0.35-0.9, y 0.46-0.56 | 54.6 | 48.7 | 46.3 |
| dusk-fire clean patch, RGB, G/R | 74.8 (114,66,38) 0.58 | 74.5 (116,65,42) 0.56 | 68.9 **(115,58,40) 0.50** |
| A clean patch, G/R | 0.58 | 0.58 | **0.52** |
| A far ranges x 0.05-0.3, y 0.35-0.365 | 69.6 | 64.6 | **35.7** |
| A far strip left x 0-0.4, y 0.375-0.395 | 71.7 | 104.0 | 87.0 |
| A far strip right x 0.6-1, y 0.37-0.40, B/R | 40.5, 0.88 | 57.7, 0.46 | 52.4, **0.58** |
| dusk-fire far ranges left x 0-0.3, y 0.36-0.38 | 47.0 | 67.8 | **44.7** |
| dusk-fire far strip right x 0.6-1, y 0.37-0.40, B/R | 34.5, 0.83 | 49.7, 0.47 | 45.2, 0.59 |
| Sat by luma bin 20-40 ... 100-120, A | .25 .30 .59 .66 .68 | .30 .50 .54 .51 .44 | .32 .48 .53 .47 .46 |

**Where the new crest landed (r20 minus r19 luma, 10 % x 2 % cells).**
- A: +10..+17 only at x 0.8-1, y 0.50 (a lit rim), and -14..-23 at x 0.5-1, y 0.54-0.56 (its slip face).
- dusk-fire: +13..+25 at x 0.7-1, y 0.48-0.50.
- Everywhere else: -5..-10, the key's 2.05 -> 1.85.
- The mockup's diagonal box (x 0.4-0.7, y 0.40-0.44) moved +2.

**The edge trace (the strongest lit-above / shade-below edge per column, sigma 4).**
- The mockup's A has one falling diagonal: y 0.394 at x 0.25, 0.430 at 0.45, 0.446 at 0.55, 0.475 at 0.75, 0.498 at 0.95.
- The game has no edge there: dy is -10 to -12 at x 0.15-0.55, against the mockup's -30 to -40.
- The new rim rises the other way, from the crosshair at about y 0.53 to the right edge at about y 0.48, and sits 0.05-0.10 lower.

So the crest helps the shade *under* A's crest (60 against 46; r19 74) and the grid r (+0.24, the builder's +0.23
reproduces). The signature lit diagonal is still not in the frame, and the crest's lit rim lands on dusk-fire's shaded lower
right (mockup 46).

### C: fire and smoke

| Region | Mockup | r19 | r20 |
|---|---|---|---|
| Flame box (150,350)-(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 10 796 / 4 225 / 834 | 10 621 / 3 552 / **148** |
| Saturated orange (sat > 0.5, Y > 80) in that box | 30 018 | 13 839 | **21 132** |
| Smoke body x 0.27-0.38, y 0.18-0.25 | 48.7 (64,43,55) h326 | 25.9 (bare navy) | **52.1 (53,40,50) h314** |
| The mockup's plume x 0.2-0.35, y 0.15-0.30 | 46.4 | 23.2 | 35.8 |
| Above the smoke, y 0.06, x 0.20-0.35 | +5..+8 over the sky | none | +15..+20 over the sky |
| Far land x 0.6-0.9, y 0.48-0.53 | 16.1 | 34.4 | 31.9 |
| Ground right x 0.55-0.95, y 0.60-0.70 | 33.7 h10 | 56.2 | 56.2 h0 |

- **The smoke is back, in the mockup's colour, rising up-left from the fire.** The bug fix is verified in source
  (`fireFx.ts:266`, own line) and in the pixels: the column is +20..+30 over the sky at y 0.22-0.26, x 0.25-0.40.
- It stays narrow and rises to the frame's top, where the mockup's billow spreads wide (x 0.15-0.40) and fades by y 0.10.
- **The white core regressed.** It has 148 pixels over 245 (r19 834, mockup 2 722): the boost's threshold moved to lum 0.86,
  which the flame barely reaches. The orange tongues recovered to 21.1 k (mockup 30 k). Round 19's trade swung back.

### B and D

| Region | Mockup | r19 | r20 |
|---|---|---|---|
| B's plume: where / its rise over the sky at y 0.26 | x 0.50-0.54, from the hood, straight up / +9..+14 | none | **x 0.70-0.78**, from the cookfire right of the wagon, curving / +10..+14 |
| B lantern pool x 0.40-0.56, y 0.515-0.54 | 56.9 (84,47,37) **h13** | 47.4 | **55.3** (96,42,43) **h359** |
| B hood interior x 0.50-0.58, y 0.37-0.47 | 64.6 | 51.6 | 58.7 |
| B sand by the wagon x 0.2-0.75, y 0.50-0.53 | 56.2 | 46.2 | **55.7** |
| B backdrop right x 0.6-1, y 0.44-0.48 | 21.5 | 35.6 | 37.0 |
| D land left / right, y 0.52-0.62 | 16.0 / 16.2 | 42.6 / 29.6 | 40.5 / 32.0 |
| D lit near band x 0-0.4, y 0.64-0.68 | 58.9 | 42.6 | 41.2 |

Row 8's lantern light lands: the sand by the wagon and the pool now match in value. But the pool is red (h359), where the
mockup's is amber (h13).

### Ledger-5 checks

- **Views:** `meta.json` camAt is identical, shot for shot, to round 19's. No `cameras.json` change. No breach.
- **Staging:** the `staged` map and its three stages are unchanged, and `pageErrors` is empty.
  - c1e7577c2 widens the sky's blend window (0.35-0.95). That is one global function of the dusk the quest reaches by play,
    not a per-view input.
- **The camera-distance rule: no breach.**
  - The aerial perspective is the engine's exponential fog: `fogDistDensity` at a constant 0.0028, its colour lerped by the
    dusk only. That is the darkening source the lead's restated rule allows.
  - The late clip's ground (y 0.55-0.90, 1 fps) runs 30, 32, 32, 31, 31, 29, 28, 27, 25, 25 (r19 33 ... 25). No step.
- **The second crest is real terrain** in the baked heightfield (terrain.bin re-baked). It has no camera input, and its
  climb is 39.1 deg, under the 40 deg limit.
  - Walk test `sd-r21-b-muslzi8h.json`: 7 legs, 0 stuck each, `walkErrors` empty. I verified this.
  - No leg climbs the new crest's face (see the nit below).
- **Its placement is by A's frame.** The comment reads "on A's diagonal, 30-50 m out and under the eye". That is round 13's
  should-fix pattern (landforms placed by a mockup's view), not a breach: the aerial shows it as one more dune in the field.
- **The tower's stair, 22 -> 30 treads,** fixes a 0.42 m rise over the 0.35 m step. It is a real fix, outside the views.
- **No narrowing:** every fire's smoke is back (h2's wisp column 49.7, C's plume, the far waymark's wisp in C and D). No
  view or hero shot regressed in its land beyond the global key dimming.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup -> view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` -> `mock-dusk-fire` | **6.7** | 1. **The ray is missing (x 0.15-0.6, y 0.15-0.27). Repeated.** The mockup's large ray over the tower is a main subject; the game has open sky there. 2. **The sky (y 0.05-0.37).** A saturated navy top (C 53 against 8) over a red-orange band (108.6, sat 0.66, against 83.9, sat 0.48), where the mockup is a muted charcoal-amber. **Gain:** the streaks are gone. 3. **The land and the hold (x 0-1, y 0.36-0.86).** The left shoulder dimmed (77.7 against 82.9; lit share 15.9 % against 24.9 %), the new crest puts a lit rim on the mockup's shaded lower right (x 0.7-1, y 0.48-0.50, +13..+25), and the clean patch is redder (G/R 0.50 against 0.58). The loop is a hoop on a stick at the crosshair. **Held:** r +0.45, and the far ranges now match (44.7 against 47.0). |
| `round-9-review/A-spawn-dusk-light` -> `mock-A-spawn` | **6.7** | 1. **No lit diagonal (x 0.25-0.95, y 0.39-0.50). Repeated, 4 rounds.** 48.7 against 96.7 in the box. The edge trace finds no falling diagonal; the new crest's rim rises the other way, lower (x 0.5-1, y 0.53 -> 0.48). Lit share right is 1.7 % against 17.3 %, the left lee is lit (58 against 40). **Gains:** the shade under the crest (60 against 46; r19 74), the near floor (89 against 70; r19 97), r +0.24. 2. **The far ranges and sky (y 0.22-0.395).** The ranges went dark (35.7 against 69.6; r19 64.6) under a pale strip (87 against 72); the clouds are thin violet streaks where the mockup has broad red-orange banks; the band runs hot (93-111 against 78-97). **Gain:** no streaks. 3. **The hold (x 0.25-1, y 0.50-0.86).** One ring at the crosshair, where the mockup has two coils low in the frame. A small ray sits left of the tower, where the mockup has none. |
| `round-9-review/B-quest-logbook` -> `mock-B-logbook` (staged `logbook`) | **6.8** | 1. **The horizon band (x 0-1, y 0.38-0.46).** Red-pink (h353) at 86.9, where the mockup's is orange (h19) at 136. 2. **The plume and the upper sky (x 0.45-0.8, y 0.05-0.45).** The smoke is back at the mockup's strength (+10..+14), but it rises from the cookfire right of the wagon (x 0.70-0.78) and curves, where the mockup's rises from the hood, straight up (x 0.52). Dark cloud streaks cross the middle (sd 15.1 against 9.9). **Gain:** the top and upper sky are closer (31 against 34; r19 20). 3. **The caravan and the hold (x 0.2-0.75, y 0.37-0.86).** The lantern light lands (sand 55.7 against 56.2, hood 58.7 against 64.6), but its pool is red (h359 against h13). The loop on a stick covers the foreground where the mockup has loose coils. |
| `round-9-review/C-waymark-fire` -> `mock-C-waymark` (staged `waymarks-lit`) | **7.1** | 1. **The fire (x 0.25-0.5, y 0.25-0.5). Mixed.** **Gain:** the smoke is back in the mockup's colour (52.1 h314 against 48.7 h326), drifting up-left with the sparks. **Regression:** the white core fell to 148 pixels over 245 (r19 834, mockup 2 722); the tongues recovered (orange 21.1 k against 30 k). The smoke is a narrow column to the frame's top, not a spreading billow. 2. **The sky (x 0-1, y 0-0.30). Repeated, untouched.** A clipped pure blue, (0,1,61) at 6 against (15,21,55) at 22; sat 0.86 upper left against 0.38. 3. **The ground (x 0.55-0.95, y 0.48-0.70). Repeated.** A flat pink-red at 56 against 34; the far land 32 against 16. The loop still rings the plinth. |
| `round-9-review/D-hands-whip` -> `mock-D-hands` (staged `waymarks-lit`) | **6.6** | 1. **The sky (y 0.30-0.50). Repeated.** Pink cloud streaks (90.7, h339) cross a mid sky the mockup keeps clear (72.1, h277). The horizon line peaks at 123 (h6, coral) against the mockup's 159 (h23, peach). 2. **The land (y 0.52-0.68). Repeated.** Left 40.5 against 16, and the lit near band 41 against 59: no dark transverse strips with lit rims. 3. **The hold (x 0.55-1, y 0.55-0.86). Repeated.** One ring on a stick, where the mockup's coils hang beside the fist. The glove is smooth (fine 3.8 against 8.2, p95 59 against 79). |

**Seat score, Signal Dunes: (6.7 + 6.7 + 6.8 + 7.1 + 6.6) / 5 = 6.78, so 6.8.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4, 6.7.
- Up 0.1 from round 19:
  - C gained 0.2: the smoke is back in the right colour, at the cost of the core.
  - B gained 0.2: the plume, the upper sky and the lantern light.
  - A gained 0.1: no streaks, the shade under the crest, the near floor; still no diagonal, and the ranges went dark.
  - Dusk-fire is flat: no streaks, but the shoulder dimmed and a lit rim lands on its shade.
  - D is flat: it barely changed (mean diff 1.5).
- Still under 7.0.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The smoke draws again | **True** | `fireFx.ts:266` on its own line. C's smoke body 52.1 h314 (mockup 48.7 h326). B's and h2's wisps and the far waymarks' smoke are back. |
| No streaks | **True** | A col HP 5.5 -> 0.6. Dusk-fire, h1 and `first-frame` are clean. |
| The horizon line back, "D's band 118 against 116" | **Partly** | D's peak is 123 (r19 119) against the mockup's 159, at y 0.45 against 0.49, coral h6 against peach h23. On y 0.445-0.48 I get 121 against 132. |
| A's diagonal: r +0.23 | **The r is true; the diagonal is not there** | r +0.24. The box is 48.7 against 96.7 (+2). The new rim rises to the right at y 0.48-0.53, where the mockup's edge falls from y 0.39 to 0.50. |
| Lit sand: dusk-fire's near patch (113,57,39) against (113,66,38) | **True, but redder than round 19** | Clean patch (115,58,40) against (114,66,38). R19's (116,65,42) was closer in G. G/R is 0.50 against 0.58; dusk-fire's lit share left fell 25.1 -> 15.9 %. |
| B's band orange, not magenta | **Not orange** | h333 -> h353 (red-pink), against h19. It dimmed, 94.5 -> 86.9, against 136. |
| A's top 43 against 40.5; B's 29 against 33 | **Different boxes** | Mine: A 39.5 against 30.0; B's upper 31.0 against 34.4. C's top is unchanged at 6.3 (late strip). |
| The flame's white core only in the brightest | **True, overshot** | 148 pixels over 245 (r19 834, mockup 2 722). Orange 21.1 k (r19 13.8 k, mockup 30 k). |
| Aerial perspective: violet-blue, about 35 % at 150 m | **Denser, but not violet-blue** | Far strip B/R 0.58-0.59 (r19 0.46-0.47) against the mockups' 0.83-0.88. A's far ranges fell to 35.7 against 69.6. Dusk-fire's ranges now match (44.7 against 47.0). |
| Walk test 7 legs, 0 stuck | **True** | `sd-r21-b-muslzi8h.json`, every leg `stuck: []`. |
| No camera moved | **True** | camAt identical. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R20B-1 | A (dusk-fire) | should-fix | **repeated** (rounds 9-19; R19B-3) | A x 0.25-0.95, y 0.39-0.50; dusk-fire x 0.7-1, y 0.48-0.50 | **The lit diagonal is still not in A's frame. The new crest's rim slopes the wrong way and sits low.** The mockup's edge falls left to right: y 0.394 at x 0.25, 0.446 at 0.55, 0.498 at 0.95, lit above (97) and shade below (42-46). The game's new rim rises from y 0.53 at the crosshair to 0.48 at the right edge, and also lands on dusk-fire's shaded lower right. **Fix:** re-orient the second crest so that, from the spawn, its far end projects high on the left near the tower's mound and its near end low on the right, with the key-lit back above the line and the slip face below. Then pull its near end out of dusk-fire's lower right. Test offline with this edge trace as well as the grid r, under the shipped key. Place it as a dune of the field, not "on A's diagonal" (round 13's should-fix). **Accept:** A's box x 0.4-0.7, y 0.40-0.44 at 75 or more, the edge trace with dy at -25 or below at x 0.25-0.75 within ±0.02 of the mockup's y, A's r +0.3 or more, dusk-fire's r +0.40 or more, and dusk-fire's x 0.6-0.97, y 0.48-0.56 at 50 or less. |
| R20B-2 | C | should-fix | **regression** (c1e7577c2) | C x 0.25-0.5, y 0.25-0.5 | **The white core fell 834 -> 148 pixels over 245** (mockup 2 722) when the boost moved to `smoothstep(0.86, 1, lum)`. The orange recovered (21.1 k against 30 k), so a luminance gate alone can't hold both. **Fix (as R19B-6):** gate the boost by the height in the flipbook cell, so the lower third over the logs goes white at full strength and the upper tongues keep the orange pow curve with no boost. **Accept:** 1 500 or more over 245 and 22 k or more saturated orange in the box. |
| R20B-3 | C, dusk-fire, B, A | should-fix | **repeated** | C y 0-0.30; dusk-fire y 0.05-0.30; B y 0.38-0.46 | **The sky's saturation.** C's top is a clipped (0,1,61) at 6 against (15,21,55) at 22: the round-19 fix touched only the early strip's gain, and C's staged dusk shows the late strip. Dusk-fire's top is C 53 against 8. B's band is h353 at 87 against h19 at 136. **Fix:** floor the late strip's dark rows at about the mockup's R and G (15-20, 20-26), so no channel clips. Pull dusk-fire's heading toward a muted grey-amber (chroma ≤ 20 at the top). Warm and lift B's heading's band to h 10-25. **Accept:** C's top 15-30 with R ≥ 10; dusk-fire's top chroma ≤ 25; B's band h 0-30, luma ≥ 115. |
| R20B-4 | A (B, dusk-fire) | should-fix | **new regression** (c1e7577c2, row 10) | A x 0.05-0.3, y 0.35-0.40; far strips x 0.6-1, y 0.37-0.40 | **The aerial perspective darkens the far ranges instead of hazing them.** The fog colour is near-black navy (0x221d36, lerped to 0x0d0b1c late), with its sun-side tint cut to a third. A's ranges fell to 35.7 against 69.6 (r19 64.6), and the far strips stay warm (B/R 0.58 against 0.83-0.88). **Fix:** within the engine fog (no shard distance term), lift the fog colour toward the sky's horizon colour per heading. Restore more of the sun-side tint toward the glow, and let the violet-blue come from the fog colour's hue, not its darkness. **Accept:** A's ranges 55-75 with dusk-fire's at 40-55; far-strip B/R 0.70 or more in A and dusk-fire; A's far strip left 60-80. |
| R20B-5 | all five | should-fix | **repeated** (R18B-3, R19B-7; the lead's first look) | x 0.3-1, y 0.50-0.86 | **The hold.** One ring on a stick with its top at about 0.53; in C it rings the plinth. The mockups hang two coils beside or below the fist, tops at about 0.60. The glove is smooth (fine 3.8 against 8.2). **Fix:** keep glove-hd4 and hang `LOOP.turns` 2 down beside the fist as in D's mockup; it stays the one idle hold. **Accept:** the loop's top at 0.58 or lower in A; C's plinth (x 0.33-0.5, y 0.60-0.68) clear; D's glove fine 6 or more. |
| R20B-6 | B | should-fix | **new** | B x 0.45-0.8, y 0.05-0.45; pool x 0.40-0.56, y 0.515-0.54 | **B's smoke rises from the wrong place, and the lantern pool is red.** The mockup's plume rises straight up from behind the hood (x 0.52). The game's comes from the cookfire right of the wagon (x 0.70-0.78) and curves. The pool is h359 against h13. **Fix:** move the camp's cookfire behind the wagon (camp layout, the same in every view), and lower its wisp's sway. Warm the lantern's light on the sand toward amber (less red in the sand's response to it, or a yellower light). **Accept:** the plume's column at x 0.48-0.58, rising +8 or more over the sky; the pool h 8-20 at 50-60. |
| R20B-7 | dusk-fire, A | should-fix | **new regression** (c1e7577c2) | clean patch; dusk-fire x 0-0.35, y 0.36-0.70 | **The lit sand overshot red and dimmed.** Clean-patch G/R 0.50-0.52 against 0.58 (r19 0.56-0.58). Dusk-fire's lit share left fell 25.1 -> 15.9 % (mockup 24.9), its shoulder to 77.7 (82.9). **Fix:** the key's green back toward 0.8 with the ×2.5 saturation kept, and its intensity back toward 2.0. Check that A's near floor stays at 85 or lower. **Accept:** G/R 0.55-0.60 on both clean patches; dusk-fire's lit share left 22-28 %, shoulder 80-86. |
| R20B-8 | D, C | should-fix | **repeated** (R19B-5, R19B-9) | D y 0.30-0.68; C x 0.55-0.95, y 0.48-0.70 | **D's sky and the open land.** Pink streaks across D's mid sky (90.7 h339 against 72.1 h277). The horizon line is coral 123 against peach 159. The land is 40.5 against 16, the near band 41 against 59. C's ground is 56 against 34. **Fix:** as R19B-5 and R19B-9: thin the clouds at D's heading, and warm and lift the late strip's horizon rows toward (209,146,108). Shade the troughs of the banded dune rows by facing under the shipped key. **Accept:** D's mid 65-80 at h 260-310; its horizon peak 145 or more at h 15-30; D's land left 30 or less. |
| R20B-9 | dusk-fire | should-fix | **repeated** (since round 1) | x 0.15-0.6, y 0.15-0.27 | **The ray.** Still absent from dusk-fire and a speck in A. It needs a real behaviour that brings it near, captured in a real moment with its motion, or the lead names it a mockup conflict. |
| R20B-10 | process | nit | **new** | README, c1e7577c2 | Four claims don't hold on the seats' boxes: "B's band orange" (h353), "violet-blue" haze (B/R 0.58), "D's band 118 against 116" (peak 123 against 159), and "A's lit diagonal" (+2 in the box). The new crest's 39.1 deg face is walkable by its slope, but no walk-test leg climbs it; add one leg over it. |

SCORE signal-dunes: 6.8

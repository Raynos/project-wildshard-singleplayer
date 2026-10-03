# Round 22, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendment), the brief, `scores.md` with the lead's
  rulings (the fog ruling and the camera-distance rule among them), and the three round-21 Signal Dunes seat files.
- The "Signal Dunes, round 22" section of `art/mockup-council/round-22/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1239-c43b91ce/` (`mock-*`, h1-h4, first-frame, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 21's `20261003-1206-21fe6dbf/`.
- The five ledger mockups, Lanczos-scaled to 780x1688.
- Source, read-only: `git diff 21fe6dbf4 c43b91cef` over `src/shards/sunscar-dunes`, `src/engine/world/skyRig.ts` and
  `art/sunscar-dunes/round-25-sky/prep.py`; the bodies of 02cc4e1ba, 2fcdd4696 and 080a1267d; the walk-test file
  `progress/physics/sd-r22-b-muso9wjb.json`.

How I measured (round 21 seat B's tools and regions; they reproduce its r21 numbers: A's diagonal 64.4, the row-demeaned
r A +0.61 / dusk-fire +0.28, C's far land 55.6, the flame box 1 929 over 245):
- **Brightness** is Rec. 709 luma. **Sat** is the mean (max - min) / max. **h** is the HLS hue of the region's mean RGB.
  **B/R** is mean blue over mean red; **G/R** likewise.
- **Row-demeaned r** is the Pearson r of a 10x7 grid of sigma-12 luma over the dune band (x 0-1, y 0.38-0.58), each
  row's mean removed.
- **Edge trace:** per 2 %-wide column, the strongest lit-above / shade-below step in sigma-4 luma (±6 px).
- **Grid dE:** CIELAB distance between 12x12 cell means of mockup and game over a band, averaged (dL = lightness part,
  dAB = colour part). One number per band for "did this view move toward its mockup".
- **The clean patch** is x 10-160, y 1160-1400 px (clear of the coil and the HUD). Regions are frame fractions.

## What changed (r21 to r22)

| View | Mean \|RGB diff\| | Pixels with \|dY\| > 8 | Sky, y < 0.33 | Land, y 0.33-0.60 | Viewmodel band, y 0.60-0.86 |
|---|---|---|---|---|---|
| dusk-fire | 4.6 | 16.9 % | 0.1 | **14.6** | 1.8 |
| A | 4.0 | 14.8 % | 0.1 | **12.6** | 1.7 |
| B | 2.1 | 3.3 % | 0.9 | 4.7 | 1.7 |
| C | 5.2 | 16.8 % | 2.4 (sparks and smoke only; x 0.6-1 is 1.2-1.6) | **11.3** | 5.0 (the pool) |
| D | 7.1 | 23.5 % | **5.5** (9-13 in y 0.05-0.46) | **17.1** | 2.3 |

Two things moved: **the land in every view** (the weaker, darker fog) and **D's late sky**. Nothing else: the hold, the
fire, B's and C's skies, and A's and dusk-fire's skies are pixel-level unchanged. The aerials moved most (aerial-overview
37.4): the lavender sheet of round 21 is a sand-coloured dune sea again.

**Grid dE to the mockup, r21 → r22** (lower is closer):

| View | Sky band | Land band |
|---|---|---|
| dusk-fire | 29.5 → 29.1 | **24.1 → 19.6** (dL 7.8 → 9.2, dAB 21.8 → 16.9) |
| A | 19.1 → 19.3 | **17.2 → 14.1** |
| B | 11.4 → 11.1 | 14.2 → 12.8 |
| C | 18.8 → 18.8 | **26.7 → 20.0** |
| D | **17.5 → 7.4** | **24.4 → 18.1** |

Every land band moved toward its mockup, all in colour (dAB); dusk-fire's lightness moved away (the band is now too
dark). D's sky more than halved its distance.

## Measurements (mockup / r21 / r22)

### The fog and the far land

`look/render.ts` at the capture: `FOG.color` `0x5e5288` → `0x3e3452` (luma ~56), density 0.0028 → 0.0013, scaled down
to a fifth between dusk 0.30 and 0.75 (smoothstep). The update now writes `FOG.color` every frame (no lerp), and the
late `DUSK_FOG` (`0x1a1733`) is deleted. Compose edits `scene.fog` in place; the engine's `targets.fog` is a live getter.

| Region | Mockup | r21 | r22 |
|---|---|---|---|
| A far strip right x 0.6-1, y 0.37-0.40 | 40.5, h325, B/R 0.89 | 70.8, h318, 0.91 | **53.3, h0, 0.60** |
| A far strip left x 0-0.4, y 0.375-0.395 | 71.7, h15, B/R 0.44 | 100.3, h339, 0.84 | **89.3, h15, 0.63** |
| A mid band x 0-1, y 0.38-0.50 | 55.5 (77,50,46) h7, B/R 0.60, sat 0.37 | 61.6 h315, 0.93, 0.30 | **46.5 (63,42,44) h353, 0.70, 0.36** |
| dusk-fire mid band x 0-1, y 0.38-0.50 | 54.8 (82,49,36) h17, B/R 0.43 | 58.6 h295, 1.02 | **41.8 (57,37,42) h345, 0.74** |
| dusk-fire far strip right | 34.5 | 64.8 | **47.8** |
| B backdrop right x 0.6-1, y 0.44-0.48 | 21.5 | 47.1 | **36.6, h2** |
| B land left x 0-0.2, y 0.455-0.475 | 39.4 | 61.8 | 57.2 |
| C far land x 0.6-0.9, y 0.48-0.53 | 16.1 (25,13,20) | 55.6 (68,50,77) | **33.7 (55,27,32) h350** |
| D land left x 0-0.5, y 0.52-0.62 | 16.0 | 49.9 | **42.7** |
| D land right x 0.5-1, y 0.52-0.62 | 16.0 | 49.9 | **31.3** |
| Far land / horizon sky, A · dusk-fire · B · C · D | 0.26 · 0.28 · 0.17 · 0.18 · 0.14 | 0.53 · 0.55 · 0.53 · 0.81 · 0.43 | **0.40 · 0.41 · 0.42 · 0.49 · 0.38** |
| clip.mp4 1 fps: sky / far band y 0.40-0.50 / ground y 0.55-0.90 | (none) | 94-75 / 57-64 / 50-53 | **83-60 / 27-31 / 25-33** |

- **The lilac is gone.** Every far and mid band turned from violet (h280-339) back to warm (h345-15), and moved toward
  its mockup in value. The aerials and the clip read as a sand-coloured dune sea.
- **It is still about twice too light at late dusk.** Far land / horizon sky is 0.38-0.49 against 0.14-0.28. C's far
  dune is 34 against 16, D's land 31-43 against 16.
- **At the spawn the mid band went too dark.** With the fog's lift gone, A's mid band is 46.5 against 55.5 and
  dusk-fire's 41.8 against 54.8 (median 37.7 against 56.7). The fog had been hiding that the key does not light these
  faces (finding R22B-1).

### The spawn pair: the dune band

| Region / metric | Mockup | r21 | r22 |
|---|---|---|---|
| **Row-demeaned r, A** (y 0.38-0.58 / 0.36-0.56) | | +0.61 / +0.58 | **+0.54 / +0.53** |
| **Row-demeaned r, dusk-fire** | | +0.28 / +0.10 | **+0.39 / +0.25** |
| A band luma p10 / p50 / p90 | 33.6 / 42.3 / 105.6 | 47.4 / 62.6 / 99.0 | **30.4 / 41.0 / 95.3** |
| A lit diagonal x 0.4-0.7, y 0.40-0.44 | **96.7** (154,84,50) h20, sat 0.65 | 64.4 h312, 0.31 | **46.2 (63,41,45) h351, 0.35** |
| A above the line x 0.55-0.85, y 0.43-0.465 | 83.3 h18, sat 0.59 | 68.9 h344, 0.37 | **56.8 h8, 0.54** |
| A below the line x 0.55-0.85, y 0.49-0.53 | 36.2 h307 | 47.1 h267 | **31.1 h304** |
| A tower mound x 0.45-0.75, y 0.38-0.42 | 73.1 h15 | 65.6 h285 | **42.6 h334** |
| A left lee x 0-0.3, y 0.40-0.50 | 39.6 | 52.8 | **40.3** |
| A edge step at x 0.20 / 0.25 / 0.30 / 0.35 | -30 / -41 / -51 / -50 | -38 / -33 / -25 / -19 | **-46 / -40 / -33 / -26** |
| A edge step at x 0.55 / 0.65 / 0.75 / 0.85 (y 0.405-0.53) | -54 / -44 / -50 / -31 | -9 / -12 / -15 / -14 | -12 / -16 / -20 / -20 |
| A lit quarter of the band | h20, s0.67, 104.9 | | h19, s0.49, 93.5 |
| dusk-fire lit shoulder x 0-0.35, y 0.50-0.70 | 82.9 h22, sat 0.70 | 79.6 h11, 0.49 | 76.1 h15, 0.54 |
| dusk-fire saddle x 0.35-0.9, y 0.46-0.56 | 54.6 h16 | 56.7 h314 | **42.6 h352** |
| dusk-fire lower right x 0.6-0.97, y 0.48-0.56 | 46.1 h10 | 55.6 h311 | **40.7 h350** |
| dusk-fire lit quarter | h21, s0.68, 86.4 | | h14, s0.55, 79.4 |
| Clean patch A / dusk-fire, G/R | 57.2 / 74.8, 0.57 / 0.59 | 72.6 / 69.9, 0.53 / 0.51 | 72.0 / 69.2, **0.52 / 0.50** |

- **A's tonal spread now matches** (p10/p50/p90 30/41/95 against 34/42/106; r21 was washed to 47/63/99), and the
  below-line shade is right (31 against 36). **But the light falls in the wrong places.** The mockup's brightest
  pixels are the diagonal face and the tower mound; the game's are the near floor and the pale far flat. The diagonal
  is 46 against 97, the worst since round 16; round 21's 64 was the lilac fog's lift, not light.
- **The step across the line** is stronger on the left (x 0.2-0.35, -26 to -46 against -30 to -51) but still a third
  of the mockup's on the right (x 0.55-0.85).
- **Dusk-fire's pattern recovered part of its round-20 match** (r +0.39; r20 +0.45), and its colour is warm again. Its
  saddle and lower right are now 8-12 under the mockup's.
- **The lit sand is red-orange, not amber.** G/R 0.50-0.52 against 0.57-0.59, the lit quarters h14-19 at sat
  0.49-0.55 against h20-21 at 0.67-0.68. This reproduces the builder's own hue check.

### B

| Region | Mockup | r21 | r22 |
|---|---|---|---|
| Glow band left x 0-0.35, y 0.40-0.45 | 111.1 h12 | 89.5 h359 | 89.5 h359 (unchanged) |
| Glow right x 0.75-0.95, y 0.40-0.44 | 136.1 h18 | 94.4 h5 | 88.9 h8 |
| Mid sky x 0-1, y 0.25-0.38 | 59.6 h258, B/R 1.46 | 56.1 h298, 1.01 | 55.9 h297, 1.02 (unchanged) |
| Sky texture, high-pass sd, y 0.22-0.40 | 3.81 | 9.58 | 9.58 (unchanged) |
| Lantern pool x 0.40-0.56, y 0.515-0.54 | 56.9 (88,50,38) **h14** | 60.3 (101,49,52) h356 | **56.9 (101,45,43) h2** |
| Wagon front x 0.48-0.62, y 0.47-0.52 | 45.7 h17, sat 0.71 | 51.0 h357, 0.56 | **44.8 h8, 0.78** |
| Clean patch, B/R | 39.8, 0.44 | 35.6, 0.52 | 34.3, 0.48 |

The pool's value now matches exactly, and the hue moved from pink toward red-orange; it is still 12 deg short of amber.
**B's sky did not change at all** (sky diff 0.9): its streaks (high-pass sd 9.6 against 3.8) and its dim band remain.

### C

| Region | Mockup | r21 | r22 |
|---|---|---|---|
| Far land x 0.6-0.9, y 0.48-0.53 | 16.1 h325 | 55.6 h280 | **33.7 h350** |
| Pool (100,1000)-(190,1120) | 59.5 (109,48,27) h16 | 76.7 (138,61,56) h4 | **67.4 (120,54,48) h5** |
| Ground right x 0.55-0.95, y 0.60-0.70 | 33.7 h11 | 59.5 h0 | **52.6 h1** |
| Plinth x 0.33-0.5, y 0.60-0.68 | 45.7 h15 | 70.3 h3 | **61.9 h4** |
| Clean patch, B/R | 33.0, 0.42 | 41.1, 0.58 | 37.4, 0.55 |
| Flame box (150,350)-(450,900): over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 11 175 / 3 771 / 1 929 | 11 659 / 3 762 / 1 822 |
| Horizon sky x 0.6-0.9, y 0.40-0.45 | 89.1 h335 | 68.6 h298 | 68.3 h298 (unchanged) |
| Smoke body / plume | 48.7 h309 / 50.4 h320 | 54.7 / 47.2 | 55.0 / 47.6 (unchanged) |

The far dune is back to a dark warm silhouette (half the round-21 gap), and the pool, ground and plinth all fell 8-10
toward the mockup. They are still red (h1-5), not amber (h11-16). The pool's green matches (G/R 0.45 against 0.44); its
fault is **blue**, 48 against 27, which comes from the violet fill under the fire's light. The fire and the smoke are
unchanged.

### D

| Region | Mockup | r21 | r22 |
|---|---|---|---|
| Middle sky (40,507)-(546,675) | 61.8 (68,56,102) h256 | 75.5 (116,61,101) h316 | **61.9 (73,55,102) h263** |
| Rows 30-36 % | 57.9 (60,53,100) | 67.6 (97,55,101) | **55.7 (59,50,102)** |
| Rows 36-42 % | 70.9 (89,62,104) | 90.4 (153,71,99) | **75.2 (102,65,99)** |
| Sky texture, high-pass sd | 4.08 | 5.05 | 4.67 |
| Red channel by heading, rows 30-42 %: 321° / 325-355° | 75 / 73-75 | 131 / 121-131 | **90 / 78-81** |
| Horizon glow peak, row mean x 0.05-0.6 | **169 at y 0.497** (213,154,116) h23 | 129 at y 0.454 | 131 at y 0.472, (168,108,92) h12 |
| Land left / right, y 0.52-0.62 | 16.0 / 16.0 | 49.9 / 49.9 | **42.7 / 31.3** |
| Land rows y 0.48-0.70, every 0.02 (x 0-0.5) | 151 56 16 16 19 16 13 20 60 54 48 | 55 45 56 49 50 48 47 45 45 43 41 | 51 31 39 39 46 46 45 44 43 42 40 |
| Left lit stripe (0,1080)-(195,1148) | 60.3 | 42.1 | 40.5 |
| Clean patch, B/R | 35.9, 0.53 | 37.8, 0.70 | 36.5, 0.65 |

- **D's sky is the round's biggest gain.** The magenta streaks are gone and the mid sky matches the mockup to within
  1 in value and 7 deg in hue. The builder's row numbers reproduce exactly.
- **The glow line does not.** Its peak is 131 against 169, and the builder's "mockup 160,103,99" is a mockup row above
  the real peak (213,154,116 at y 0.497).
- **The heading edit shows at D's left edge:** the 321° column is red 90 where the rest is 78-81 and the mockup is flat
  at 73-75. That is the 316-324° ease, inside D's frame.
- **The land has no transverse bands.** The mockup alternates near-black troughs (13-20) with lit rims (54-60). The game
  is a smooth 39-46 ramp.

### The hold

Unchanged since round 21 (viewmodel band diff 1.7-2.3): one braided ring, ~0.25 of the frame wide with its top at
~0.66, against two coils ~0.5 wide topping out at ~0.58-0.61 in A, B and C. The builder lists it as not addressed.

## Ledger-5 checks

- **Views:** `meta.json` camAt is identical shot for shot to round 21's, and the cameras blob a4219aa is unchanged. No
  breach.
- **Staging:** the `staged` map is unchanged and `pageErrors` is empty. 02cc4e1ba and 080a1267d touch `render.ts` and
  `build.ts` (the fog and the waymark light), which hold no stage logic that differs from play. No breach.
- **The fog ruling: passes, no void.**
  - The colour is one constant (`0x3e3452`) at every dusk step. The late lerp toward `0x1a1733` is gone from the
    source, which closes round 21's source half (R21B-1).
  - The density only falls with dusk, to a fifth; it never rises.
  - On the pixels, the far land sits at or above the near land in every late view: D's far 31-43 over a near patch of
    36.5, the clip's far band 27-31 over its ground 25-33. No band moves toward black with distance.
  - **Nit:** `0x3e3452` (luma ~56) is darker than every view's horizon sky (68-133 on screen). So "taken from the
    horizon sky" holds in hue only, and on a sunlit far face brighter than ~56 the fog darkens slightly. At 0.0013 the
    effect is small (18 % at 150 m), and no measured band shows it. The lead may want to say whether a "ground-level
    horizon violet" meets the ruling.
- **The camera-distance rule:** no new shard term reads camera distance. The fog's density factor is a function of
  `DUSK` only.
- **D's late sky** (2fcdd4696) edits the panorama texture by column heading in `prep.py`, so it is world-space. Every
  player facing 316-366° at late dusk sees it. It is not a per-camera term, and there is no breach.
  - Its window was chosen from frame edges ("D's frame spans ~323-359; B's (303) ends by ~321").
  - No other capture looks that way at late dusk (h4 faces 341° but at the early sky, with a sky diff of 0.0), so
    "holds from any view" is untested. See R22B-6.
- **The walk test is now on disk:** `sd-r22-b-muso9wjb.json`, 7 legs, 0 stuck, 0 slide frames. The waymark-east → west
  leg crosses the round-21 crest's footprint near (0..-7, -5..-8) at 13-16 m. Round 21's nit is closed.
- **No narrowing:** h1, h4 and first-frame took the same land shift as the scored views (land diff 9-11). h2 moved 4.2
  and h3 0.3. Nothing was dropped or hidden.
- **Process nit:** the README's generated "All shard commits" omits 2fcdd4696, because it touches only
  `public/assets/sunscar-dunes/` and `art/`. Its prose does cover it, but the generator should list commits under
  `public/assets/<slug>/` too.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup -> view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` -> `mock-dusk-fire` | **6.7** | 1. **The sky (x 0-1, y 0.05-0.36). Repeated, untouched.** Sky band 106 sat 0.65 against 86 sat 0.47; the top is navy (B/R 2.33) where the mockup's is a grey dusk (1.24); grid dE 29, the view's largest. The big ray over the tower is absent. 2. **The mid dunes went dark (x 0.35-1, y 0.40-0.56). New in value, gain in colour.** The lilac is gone (saddle h352 against h314 in r21; mockup h16) and r rose to +0.39, but the saddle is 42.6 against 54.6 and the band median 37.7 against 56.7. 3. **The lit shoulder and near sand are red-orange (x 0-0.35, y 0.50-0.80). Repeated.** 76 h15 sat 0.54 against 83 h22 sat 0.70; G/R 0.50 against 0.59. The ring is upright where the mockup's loop is slack and diagonal. |
| `round-9-review/A-spawn-dusk-light` -> `mock-A-spawn` | **6.9** | 1. **The gold diagonal is dark (x 0.4-0.85, y 0.38-0.47). Repeated since round 9.** 46 h351 against 97 h20; the tower mound 43 against 73; the step right of x 0.55 a third of the mockup's. The band's spread now matches (30/41/95 against 34/42/106), but its light sits on the near floor and the pale far flat. 2. **The far flat (x 0-0.4, y 0.375-0.40). Repeated, warmer.** A pale strip at 89 against 72, now warm (h15) instead of lilac; it still reads as a second horizon under the ranges. 3. **The hold (x 0.3-1, y 0.62-0.86). Repeated.** One ring ~0.25 wide, top ~0.66, against two broad coils ~0.5 wide, top ~0.60. **Gain:** the lilac is gone (land dE 17.2 → 14.1; mid band B/R 0.70 against 0.60, r21 0.93). |
| `round-9-review/B-quest-logbook` -> `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The sky and its band (x 0-1, y 0.15-0.45). Repeated, untouched.** Streaky pink-violet clouds (high-pass sd 9.6 against 3.8; mid sky h297 against h258); the glow band 89 h359 against 111 h12, the right 89 against 136. 2. **The land and the light colour (y 0.44-0.60). Closer.** Backdrop right 37 against 21.5 (r21 47), land left 57 against 39. The pool matches in value (56.9) but is h2 against h14; the wagon front is h8 against h17. 3. **The plume and the hold (x 0.4-1, y 0.15-0.86). Repeated.** The wisp rises at the wagon's right end, not over the hood; one ring where the mockup has two coils. |
| `round-9-review/C-waymark-fire` -> `mock-C-waymark` (staged `waymarks-lit`) | **7.5** | 1. **The firelit ground is red and bright (x 0.1-0.95, y 0.55-0.70). Repeated, closer.** Pool 67 h5 against 60 h16 (r21 77), ground right 53 against 34, plinth 62 against 46; the blue under the fire is 48 against 27. 2. **The smoke and the fire (x 0.2-0.45, y 0-0.45). Repeated, unchanged.** A straight column to the top where the mockup's billows up-left; the white core 1 822 against 2 722 over 245; the fingered bowl and twisted shaft against a worn post. 3. **The far dune (x 0.3-1, y 0.47-0.55). Gain, still light.** A warm dark silhouette again at 34 h350 (r21 56 lilac), against 16; land dE 26.7 → 20.0. |
| `round-9-review/D-hands-whip` -> `mock-D-hands` (staged `waymarks-lit`) | **6.9** | 1. **The land has no bands (x 0-1, y 0.48-0.70). Repeated, closer in value.** A smooth ramp at 39-46 where the mockup alternates troughs at 13-20 with lit rims at 54-60; land 43 / 31 against 16 (r21 50 / 50). The lit stripe is 40.5 against 60.3. 2. **The horizon glow (x 0-0.7, y 0.45-0.50). Repeated.** It peaks at 131 at y 0.472 against 169 at y 0.497 (peach h23 against h12). 3. **The hand (x 0.4-1, y 0.60-0.86). Repeated.** One stiff ring where the mockup hangs two or three slack coils. **Gain:** the sky now matches (middle sky 61.9 h263 against 61.8 h256; sky dE 17.5 → 7.4); only a faint pink at the left edge (the ease at 321°). |

**Seat score, Signal Dunes: (6.7 + 6.9 + 6.9 + 7.5 + 6.9) / 5 = 6.98, so 7.0.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4, 6.7, 6.8,
  6.8.
- Up 0.18 from round 21. Every land band moved toward its mockup (grid dE down 1.4 to 6.7 per view), and D's sky closed
  most of its gap.
- Most of that gain undoes round 21's lilac fog. Against round 20, the net gains are:
  - D's sky;
  - A's crest geometry;
  - C's pool.
- The unrounded 6.98 is for the lead's three-seat mean.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The fog subtle: 0.0013, the colour 0x3e3452, the late lerp toward 0x1a1733 removed, thins with dusk | **True** | Source as stated. The clip's far band sits above its ground (27-31 over 25-33), so nothing moves toward black. |
| C far band 54.6 → 35.5, D 49.7 → 42.7 | **True** | My boxes: C 55.6 → 33.7, D land left 49.9 → 42.7, right 49.9 → 31.3. |
| A's mid dunes warm, not lilac | **True, and too dark** | The mid band is h353, B/R 0.70 (r21 h315, 0.93), but 46.5 against 55.5. The diagonal fell to 46.2 (r21 64.4). |
| The compose fix leaves the screen unchanged | **Consistent** | No view shows a fog-colour step between dusk steps, and the colour is now one constant. I can't separate it from 02cc4e1ba in one capture. |
| D's rows 59,50,102 and 100,64,100; the glow 160,99,89 (mockup 160,103,99) | **Rows true; the glow's mockup figure is wrong** | Rows (59,50,102) and (102,65,99) reproduce. The mockup's real glow peak is (213,154,116) at 169 luma, y 0.497. The game peaks at 131. |
| The sky above 5° averaged ±25°: pink streaks gone in D, B and C | **True for D only** | D's sky diff is 9-13. B's is 0.9 (high-pass sd 9.58 → 9.58), and C's right sky is 1.2-1.6. Both are at dusk steps that don't show the late painting's upper sky. |
| B's rows unchanged | **True** | B's glow band and mid sky are identical to round 21. |
| C's pool: the light 14 → 9 cd, the fire term 0.18 → 0.12; near sand 63.7 → 57.2 | **True in direction** | Source as stated. Pool 76.7 → 67.4, ground right 59.5 → 52.6. B's lantern pool fell 60.3 → 56.9 with it. |
| The walk test: 7 legs, 0 stuck | **True** | One leg crosses the round-21 crest. |
| Hue check: A h20 s0.51, dusk-fire h16 s0.56, C h3, B h3 | **True** | A h19 s0.49, dusk-fire h14 s0.55, C h1, B h3. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R22B-1 | A, dusk-fire | should-fix | **repeated** (rounds 9-21; R21B-2), now exposed by the weaker fog | A x 0.4-0.85, y 0.38-0.47; dusk-fire x 0.35-1, y 0.40-0.56 | **The key does not light the spawn's crest and mound.** Without the lilac lift, A's diagonal is 46 against 97, the tower mound 43 against 73, and dusk-fire's saddle 43 against 55. The tonal spread is right (A 30/41/95 against 34/42/106), so this is not exposure: the lit pixels are on the near floor and the far flat, not on the crest's back. **Fix:** render A's and dusk-fire's views offline under candidate global key directions and elevations (one key, never per view, per the lead's ruling). Pick the one that puts N·L ≥ 0.5 on the crest's back and the mound's camera side while dusk-fire's saddle stays in shade. Do not lift the fill or the exposure: the near floor is already 72 against 57. **Accept:** A's diagonal box ≥ 80 at h 10-30, sat ≥ 0.5; the tower mound ≥ 60; A's r ≥ +0.55 and dusk-fire's ≥ +0.40; A's clean patch ≤ 72. |
| R22B-2 | A, dusk-fire, B, C | should-fix | **repeated** (round 17's "beige", now red-orange) | the clean patches; A and dusk-fire's lit quarters; B and C's pools | **The lit sand is red-orange, not amber, and the late sand carries extra blue.** At early dusk, G/R is 0.50-0.52 against 0.57-0.59, and the lit quarters are h14-19, sat 0.49-0.55, against h20-21, 0.67-0.68. At late dusk, B/R is 0.48-0.65 against 0.42-0.53. The fire pools' blue is 48 against 27 (C) at a matching G/R, so the pink comes from the violet fill added under the fire. **Fix:** raise the sand albedo's or the key's green share by about 10 % (toward G/R 0.57). Cut the late hemi fill's blue on sand so the late clean patches reach B/R ≤ 0.55. Inside a fire's reach, let the fire term replace part of the violet fill rather than add on top of it. **Accept:** A's and dusk-fire's lit quarters at h 18-24, sat ≥ 0.60; C's pool h ≥ 12 with B ≤ 35; B's pool h ≥ 10. |
| R22B-3 | D, C, B | should-fix | **repeated** (R21B-1, half closed) | D x 0-1, y 0.48-0.70; C x 0.3-1, y 0.47-0.55; B x 0.6-1, y 0.44-0.48 | **The late land is still twice the mockups' and lacks D's bands.** Far land / horizon sky is 0.38-0.49 against 0.14-0.28. D's land is a smooth 39-46 ramp where the mockup alternates 13-20 troughs with 54-60 rims; C's far dune is 34 against 16. The fog is now weak, so this is the land's own light. **Fix:** darken by facing, as the fog ruling requires: at late dusk, slip faces turned from the glow drop to the mockups' trough value, and rims facing the glow keep the key. If the field around D lacks lee faces toward the camera, that is a form fix in the zoom-out plan. **Accept:** D's land left ≤ 25 with a lit stripe ≥ 50 inside y 0.60-0.70; C's far land ≤ 25. |
| R22B-4 | B, dusk-fire | should-fix | **repeated** (R21B-6), untouched | B x 0-1, y 0.15-0.45; dusk-fire x 0-1, y 0.05-0.36 | **The skies the round did not reach.** The late-sky averaging never shows at B's staged dusk 0.5: B's sky is pixel-identical (streak sd 9.6 against 3.8; band 89 h359 against 111 h12). Dusk-fire's sky (dE 29, the view's biggest gap) is untouched: band 106 at sat 0.65 against 86 at 0.47; top B/R 2.33 against 1.24. **Fix:** apply the same averaging, and warm the band, in whichever painting B's dusk blend shows at B's heading. Desaturate the early painting's upper sky and band toward the mockup's dusty grey-amber. **Accept:** B's sky high-pass sd ≤ 5 and band h 5-25 at ≥ 105; dusk-fire's sky band sat ≤ 0.55 at 85-95, top B/R ≤ 1.6. |
| R22B-5 | A, B, C (dusk-fire, D) | should-fix | **repeated** (R21B-4) | x 0.3-1, y 0.55-0.86 | **The hold:** one ring ~0.25 wide, top ~0.66, against two coils ~0.5 wide, top ~0.58-0.61. Keep the pose, enlarge `LOOP` so two turns show, and raise its top to ~0.60, as one idle hold. **Accept:** A's loop top at 0.58-0.62 with two turns, and C's plinth clear. |
| R22B-6 | D | nit | **new** (2fcdd4696) | D x 0-0.1, y 0.30-0.50; prep.py | **D's sky edit is a heading sector cut to two frames' edges.** It is world-space, so no breach. Its 316-324° ease shows inside D's left edge (red 90 against 78-81, mockup flat 75), and no other late capture looks that way. **Fix:** widen the ease to ≥ 20° and place it by the sky's own gradient, not by B's and D's frame edges. Add one late-dusk hero shot at ~315° so the seats can see the transition holds. |
| R22B-7 | D | nit | **repeated** | D x 0-0.7, y 0.45-0.50 | **D's glow line:** 131 at y 0.472 against 169 peach (h23) at y 0.497, and the commit compares against the wrong mockup row. Lift the late painting's 0-2° rows at D's heading toward (213,154,116), and measure the peak row, not a fixed row. |
| R22B-8 | C, B | nit | **repeated** (R21B-7) | C x 0.2-0.45, y 0-0.33; B x 0.45-0.75, y 0.15-0.45 | The smoke: C's is a straight column, where the mockup's billows up-left; B's wisp rises at the wagon's right end, not over the hood. Lean C's plume up-left and fade it by y 0.10; move B's source to the hood. |
| R22B-9 | process | nit | **new** | README generator | The generated commit list skips commits that touch only `public/assets/<slug>/` (2fcdd4696). List them. Two claims don't hold on the seats' boxes: "streaks gone in B and C" (B and C are unchanged), and D's glow "mockup 160,103,99" (the peak is 213,154,116). |

SCORE signal-dunes: 7.0

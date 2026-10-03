# Round 19, seat B, Signal Dunes (Claude, lens: evidence, measured region by region)

What I reviewed:
- `docs/process/COUNCIL.md`, the ledger (Jake's 7.0 bar and phase amendments), the brief, `scores.md` (with the lead's
  ruling that the key may be art-directed apart from the painted glow), and both round-18 Signal Dunes seat files.
- The "Signal Dunes, round 19" section of `art/mockup-council/round-19/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1047-671128ac/` (`mock-*`, h1–h4, both aerials, `first-frame`,
  `clip.mp4` at 1 fps, `meta.json`), against round 18's `20261003-1028-52e843cd/` and round 17's `20261003-0947-8c70feaf/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git diff 52e843cdb 671128acd -- src/shards/sunscar-dunes` (`look/painted.ts`, `look/render.ts`,
  `world/fireFx.ts`, `species/duneRay.ts`, `layout.ts`, `weapons/whipModel.ts`, `manifest.ts`).

How I measured (round 18 seat B's tools and regions; its numbers reproduce: A's top 97.8, A's sky box 132.2, A's
diagonal 47.6, row-demeaned r A −0.37 / dusk-fire −0.35):
- **Brightness** is Rec. 709 luma. **Sat** is the mean (max − min) / max. **C** is the chroma of the median RGB, **h** its hue.
- **Fine** is the mean |luma − luma blurred at σ 2|.
- **Row-demeaned r** is the Pearson r of a 10×7 grid of σ-12 luma over the dune band x 0–1, y 0.38–0.58, with each
  row's mean removed.
- **The clean patch** is x 10–160, y 1160–1400. **Regions** are frame fractions (x left → right, y top → bottom).

## What changed (r18 → r19)

| View | Mean \|RGB diff\| | Pixels changed > 20 | Sky, y < 0.33 | Land, y 0.33–0.60 | Viewmodel band, y 0.60–0.86 |
|---|---|---|---|---|---|
| dusk-fire | 23.9 | 45.5 % | **43.2** | 22.0 | 12.6 |
| A | 24.0 | 47.0 % | **42.7** | 22.3 | 13.1 |
| B | 26.9 | 40.6 % | **60.5** | 19.2 | 5.9 |
| C | 8.9 | 13.2 % | 15.3 | 10.0 | 3.9 |
| D | **2.9** | 1.6 % | **0.0** | 5.1 | 5.2 |

D's sky is pixel-identical to round 18's: D's staged dusk sits past the end of the new blend, so it shows the same
late strip. D moved only in its land and its hold.

## Measurements (mockup / r18 / r19)

### Sky

| View, region | Mockup | r18 | r19 |
|---|---|---|---|
| A top, x 0.45–0.62, y 0.08–0.12 | 30.0 (27,28,56) h237 | 97.8 h310 | **34.4 (33,30,78) h243** |
| A upper, x 0.05–0.55, y 0.11–0.16 | 36.3 | 100.0 | **37.5** |
| A, x 0.05–0.45, y 0.22–0.26 / 0.26–0.30 | 77.5 / 97.0 | 126.0 / 136.3 | 90.4 / 110.5 |
| A glow right of the tower, x 0.65–0.95, y 0.30–0.34 | 153.1 h24 | 161.8 | 132.8 h24 |
| dusk-fire top, x 0.45–0.62, y 0.08–0.12 | 35.5 (37,34,42), C 8 | 97.2 | 33.8 (32,30,79), **C 49** |
| dusk-fire, x 0.1–0.9, y 0.24–0.30 | 83.9, sat 0.48 | 135.4 | 107.9, sat 0.66 |
| dusk-fire glow right, x 0.6–1, y 0.33–0.37 | 97.2 | 135.5 | 85.5 |
| B top, x 0.05–0.6, y 0.08–0.12 | 31.6 (20,26,63) | 80.1 | **12.9 (1,3,66)**, sat 0.94 |
| B upper, x 0.05–0.6, y 0.12–0.20 | 34.4 | 84.2 | 19.9 (13,14,70) |
| B mid, x 0.05–0.4, y 0.25–0.38 | 57.4 | 106.5 | **54.3** |
| B glow right, x 0.75–0.95, y 0.40–0.44 | 136.1 (230,128,81) **h18** | 135.6 h334 | 94.5 (174,90,128) **h332** |
| C top, x 0.45–0.62, y 0.03–0.08 | 22.4 (15,21,55) | 73.6 (the pale column) | **6.3 (0,1,60)**, sat 0.98 |
| C upper left, x 0.02–0.3, y 0.10–0.30 | 43.5 (52,39,52) | 26.3 | 20.3 (1,13,82), sat 0.92 |
| C glow band, x 0.6–1, y 0.44–0.47 | 72.5 h357 | 71.9 h290 | 48.1 **h355** |
| D mid, x 0.05–0.95, y 0.34–0.44 | 72.1 h277 | 90.3 h336 | 90.3 h336 (identical) |
| D horizon, x 0–0.7, y 0.47–0.50 | 148.2 (209,145,107) | 82.6 | **71.9** |

- **A's and dusk-fire's upper sky is fixed:** navy at the mockup's value, with stars. The magenta of round 18 is gone.
- **The band under it is still hot and saturated:** A +13, dusk-fire +24 (sat 0.66 against 0.48).
- **Dusk-fire's mockup sky is a muted amber-grey** (top C 8). The game's is a saturated navy over a red-orange gradient.
- **B's sky now matches in the middle (54 against 57) but not at either end.**
  - The top is a near-pure blue with clipped R and G (1,3,66), at 13 against 32.
  - Dark cloud streaks cross the middle, where the mockup is clean and starry.
  - The band is still magenta (h332 against h18) and dim (94.5 against 136).
- **C's top is a clipped pure blue,** (0,1,60) at 6 against the mockup's (15,21,55) at 22.

**A new artefact: vertical streaks in the low sky.** Just above the 3D ranges, every warm view has visible vertical
striations:
- A at x 0.30–0.53, y 0.31–0.345, and dusk-fire at x 0.4–0.75, y 0.30–0.36;
- h1, `first-frame` and all ten clip frames.

In A's box, the column high-pass (41 px) reaches **5.5 luma**, with a top/bottom coherence of **+0.93**. The
mockup's is 3.0 / +0.28 (its clouds), and r18's 0.7 / +0.01.

The cause is in `look/painted.ts`: `max(elev, 2.5)` holds each heading's 2.5° texel row all the way down to the 3D
horizon. Every heading's local detail in that row (painted range tops, cloud edges) is drawn out into a vertical bar.

### The spawn pair: the dune band (the decoupled key)

| Region / metric | Mockup | r18 | r19 |
|---|---|---|---|
| **Row-demeaned r: dusk-fire / A** | | −0.35 / −0.37 | **+0.43 / +0.15** |
| Share over 80, left / right half (y 0.36–0.56): dusk-fire | 24.9 / 0.9 % | 16.5 / 30.0 % | **25.1 / 3.9 %** |
| Share over 80, left / right half: A | 28.1 / 17.3 % | 8.6 / 32.6 % | 42.2 / 8.7 % |
| dusk-fire saddle, x 0.35–0.9, y 0.46–0.56 | 54.6 | 71.5 | **48.7** |
| dusk-fire lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 73.7 | **49.7** |
| dusk-fire lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 74.4 | **85.4** |
| dusk-fire clean patch | 74.8 | 68.4 | **74.5** |
| dusk-fire far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 66.2 | 49.7 |
| A lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** | 47.6 | **46.4** |
| A tower mound, x 0.45–0.75, y 0.38–0.42 | 73.1 | 41.3 | 39.3 |
| A left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 57.6 | 60.1 |
| A under the crest, x 0.5–1, y 0.48–0.54 | 42.5 | 73.7 | **51.0** |
| A near floor, x 0–0.3, y 0.58–0.70 / clean patch | 70.4 / 57.2 | 72.5 / 65.7 | **96.5 / 77.5** |
| Shade (Y < 45) B/R: A / dusk-fire | 1.00 / 0.82 | 0.76 / 0.75 | **0.84 / 0.88** |
| Sat by luma bin, 20–40 … 100–120: A | .25 .32 .61 .66 .68 | .37 .47 .60 .55 .48 | .31 .50 .56 .53 .46 |
| Sat by luma bin: dusk-fire | .21 .45 .67 .68 .65 | .36 .41 .57 .55 .47 | .31 .53 .60 .53 .46 |

- **Dusk-fire's light now sits where its mockup's does.** The left shoulder is lit, and the saddle and lower right are
  in shade at the mockup's values. The left/right split of lit sand matches within 3 points. This is the round's biggest
  gain, and the builder's +0.42 reproduces (+0.43).
- **A moved from mirrored to weakly right (+0.15), but its signature lit diagonal is still not there** (46 against 97),
  and the tower mound stays dark.
  - The near floor overshoots more than before (96.5 against 70.4). The left lee is lit where the mockup shades it.
  - As the builder says, A needs the landform, not the key.
- **The shade is cooled** (B/R 0.84–0.88 against 0.82–1.00; the 20–40 bin's sat 0.31 against 0.21–0.25).
- **The brightest sand still greys** (0.46 against 0.65–0.68).

### C: fire, smoke, horizon

| Region | Mockup | r18 | r19 |
|---|---|---|---|
| Flame box (150,350)–(450,900): pixels over 150 / 230 / 245 | 13 733 / 5 557 / 2 722 | 10 295 / 2 248 / 121 | 10 796 / **4 225 / 834** |
| Saturated orange (sat > 0.5, Y > 80) in that box | 30 018 | 23 485 | **13 839** |
| Smoke above the fire, y 0.03–0.15, x 0.45–0.65 | 25–30 | 62–97 (pale column) | 6–21 |
| The mockup's plume, x 0.2–0.35, y 0.15–0.30 | 46.4 | 46.2 | **23.2** (bare sky) |
| Skyline right, x 0.6 / 0.7 / 0.8 / 0.9 / 0.95 | .469 .466 .463 .430 .455 | .488 .484 .484 .484 .484 | **.455 .452 .450 .450 .451** |
| Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 37.8 | 34.4 |
| Ground right, x 0.55–0.95, y 0.60–0.70 | 33.7 | 55.6 | 56.2 |

- **The core is 7× brighter** (834 pixels over 245 against 121; still 31 % of the mockup's).
  - But the boost bleached the tongues: the saturated orange fell from 23.5 k to 13.8 k, against 30 k.
- **The sparks now drift up and left, as in the mockup.**
- **The skyline is fixed:** the 25 m rise brought it into the mockup's range.
- **There is no smoke at all.** The plume region is bare sky, at 23 against 46. See finding R19B-1: a code bug, not a look.

### B, D and the hold

| Region | Mockup | r18 | r19 |
|---|---|---|---|
| B skyline, x 0.75 / 0.82 / 0.88 / 0.94 / 0.98 | .437 .438 .439 .432 .419 | .440 .449 .453 .455 .456 | **.430 .427 .430 .436 .442** |
| B backdrop right, x 0.6–1, y 0.44–0.48 | 21.5 | 53.1 | **35.6** |
| B wagon plume, x 0.47–0.56, y 0.22–0.38, against the sky beside it | 64.5 / 55.5 (+9) | 104.7 / 103.4 | **49.8 / 48.8 (+1, none)** |
| B sand by the wagon, x 0.2–0.75, y 0.50–0.53 | 56.2 | 39.2 | 46.2 |
| B whole-frame grid r (y 0–0.6, row-demeaned) | | +0.32 | **+0.83** |
| D land left / right, y 0.52–0.62 | 16.0 / 16.0 | 36.1 / 29.5 | **43.1** / 31.6 |
| D lit near band, x 0–0.4, y 0.64–0.68 | 58.9 | 37.3 | 42.6 |
| Glove back, D (mockup (590,1130)–(740,1260); game x 0.61–0.73, y 0.677–0.724): Y, p95, fine | 30.4, 79, **8.3** | 32.5, 56, 2.5 | 34.8, 59, **3.9** |
| Loop top (by eye on the D and C crops) | about 0.60 (coils beside the fist) | about 0.50 | about 0.53 |
| h2 wisp column, x 0.45–0.6, y 0.15–0.35 | | 90.5 | 48.8 (gone) |

### Ledger-5 checks

- **Views:** `cameras.json` is unchanged (a4219aa). The only real-camera move is h3's +5.01 m from waymark 0's
  25 m rise, which is disclosed. No mock camera moved.
- **Staging:** no stage handler changed.
- **The ray's route (row 5) is ordinary behaviour.** `DuneRayBrain` patrols its home, which is now the tower, at 34 m
  and 22 m up whenever the player is beyond 55 m (or `calm`). Inside that range it comes for the player as before.
  - There is no per-view input and no stage.
  - The parity `ray` pose is a test pose, not a mock camera.
- **The camera-distance rule: no breach.**
  - `painted.ts` samples by direction only.
  - `render.ts`'s change is a lighting mix.
  - The smoke's `vFar` is the old alpha fade on FX (and the smoke isn't drawn at all).
  - The late clip's ground (y 0.55–0.90, 1 fps) is 33, 35, 35, 34, 33, 31, 29, 27, 26, 25 (r18 32 … 23): no step.
- **The key is one global constant,** `KEY.dir` (−0.34, 0.2, −0.92). Under the lead's ruling, its distance from the
  glow is not a breach.
- **Device and HUD:** 390×844 touch, the baseline HUD, `pageErrors` empty.
- **No narrowing: one regression outside the views.** Every fire's smoke and the caravan's cookfire wisp are gone
  everywhere (R19B-1): h2's wisp went from 90.5 to 48.8, the bare sky. It is a bug, not a breach.

No score is voided.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.7** | 1. **The ray is missing (x 0.15–0.6, y 0.15–0.27).** The mockup's large ray over the tower is a main subject. The game shows open sky there, and its ray is a small speck in A instead. 2. **The sky (y 0.05–0.36).** The top value now matches (33.8 against 35.5; r18 97), but it is a saturated navy (C 49 against 8) over a red-orange gradient (y 0.24–0.30 at 108, sat 0.66, against 84, sat 0.48). Vertical streaks run above the ranges (x 0.4–0.75, y 0.30–0.36). 3. **The far land and the hold (x 0.6–1, y 0.37–0.40; x 0.3–1, y 0.50–0.86).** The far strip is pale (49.7 against 34.5), and the loop is a hoop on a stick at the crosshair. **Gain:** the dune band's light matches (row-demeaned r +0.43, lit share left/right 25/4 % against 25/1 %, clean patch 74.5 against 74.8). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.6** | 1. **No lit diagonal (x 0.4–0.7, y 0.40–0.44). Repeated.** 46 against 97, the tower mound 39 against 73, the left lee lit (60 against 40), and the near floor 96.5 against 70.4. Row-demeaned r is +0.15 (r18 −0.37). 2. **The sky's middle (y 0.22–0.34).** The cloud banks are thin violet streaks, where the mockup has broad red-orange banks. The band is 90–110 against 77–97, and the glow right of the tower is 133 against 153. Vertical streaks run at x 0.30–0.53, y 0.31–0.345. **Gain:** the upper sky is the mockup's navy (34–38 against 30–39). 3. **The hold (x 0.25–1, y 0.50–0.86).** It is one smaller ring at the crosshair, where the mockup has two broad coils low in the frame. A small ray sits left of the tower, where the mockup has none. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.6** | 1. **The horizon band (x 0–1, y 0.38–0.46).** It is magenta-violet (h332, 94.5), where the mockup's is orange (h18, 136). 2. **The sky's ends (y 0.05–0.25).** The top is a clipped near-pure blue (1,3,66) at 13 against 32, and dark cloud streaks cross the middle, where the mockup is clean and starry. **Gain:** the middle matches (54 against 57), and the frame's grid r is +0.83 (r18 +0.32). 3. **The plume is gone (x 0.47–0.56, y 0.22–0.38).** It is 1 luma above the sky, against the mockup's +9 (R19B-1). The sand by the wagon is 46 against 56. **Gain:** the skyline now matches (0.427–0.442 against 0.419–0.439), and the backdrop is 35.6 against 21.5 (r18 53). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.9** | 1. **No smoke (x 0.2–0.4, y 0.10–0.35). Regression.** The mockup's brown billow is bare sky (23 against 46). The smoke mesh is never added to the scene (R19B-1). **Gain:** the sparks drift left with the mockup's. 2. **The sky (x 0–1, y 0–0.3).** A clipped pure blue, (0,1,60) at 6 against (15,21,55) at 22, and sat 0.92 upper left against 0.38. The glow band's hue now matches (h355), but it is dimmer (48 against 72.5). 3. **The fire and ground (x 0.25–0.5, y 0.25–0.5; x 0.55–0.95, y 0.60–0.70).** The core is 7× r18's (834 over 245 against 2 722), but the tongues bleached (orange 13.8 k against 30 k). The ground is a flat pink-red at 56 against 34. The loop still covers the plinth's right half. **Gain:** the skyline is now in the mockup's range. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.6** | 1. **The sky (y 0.3–0.5). Unchanged, repeated.** Pink cloud streaks (90, h336) cross a mid-sky the mockup keeps clear (72, h277). The peach horizon band is 72 against 148 (r18 83). 2. **The land (y 0.52–0.72). Repeated, slightly worse.** Left 43 against 16 (r18 36), and the lit near band 42.6 against 58.9. 3. **The hold (x 0.55–1, y 0.55–0.86).** It is one ring on a stick; the mockup's coils hang beside the fist. The leather gained grain (fine 3.9; r18 2.5), but it is still smooth against the mockup's 8.3, and its p95 is 59 against 79. |

**Seat score, Signal Dunes: (6.7 + 6.6 + 6.6 + 6.9 + 6.6) / 5 = 6.68, so 6.7.**
- My earlier scores: 4.8, 5.3, 5.3, 5.4, 5.7, 5.5, 5.7, 6.1, 6.6, 6.8, 6.9, 6.9, 6.9, 6.7, 6.7, 6.4, 6.6, 6.4.
- Up 0.3 from round 18:
  - Dusk-fire gained 0.6: its light is finally right and its upper sky is fixed.
  - A gained 0.4: the sky is fixed, but the diagonal is still missing.
  - B gained 0.3: the sky's middle and the skyline improved, but the band is magenta and the plume is gone.
  - C gained 0.1: the core, the sparks and the skyline improved, but the smoke is gone and the top sky is clipped blue.
  - D lost 0.1: it is unchanged and its land is lighter.
- Still under 7.0. The two cheapest points are a one-line code fix (the smoke) and the low-sky streaks.

## The builder's claims checked against the pixels and the source

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The key at 20° left of north: dusk-fire +0.42, A +0.13 | **True** | +0.43 / +0.15 on the seats' band. |
| A's top 40 / 41 (the mockup's / the game's) | **True** | 34.4–38.7 against 30–39, navy. |
| D's sky 40–115 against the mockup's 31–116 | **Not new** | D's sky is pixel-identical to r18's. Its horizon is 72 against 148, its middle 90 against 72. |
| B's sky within a few points | **Only in the middle** | The top is 13 against 32 (clipped blue). The band is 94.5 against 136, h332 against h18. |
| The glow band is still a little hot | **True** | A +13, dusk-fire +24. |
| No painted ranges under 2.5°, so the 3D ranges own the horizon | **True, with a new artefact** | Vertical streaks: column high-pass 5.5 luma, coherence +0.93 (A x 0.30–0.53, y 0.31–0.345). |
| The 45° seam is gone | **True** | h3's upper sky is an even navy with stars. Note its R and G sit at 0, (0,0,31–54). |
| A slow sky over the quest (dusk 0.45–0.86) | **True in code** | B (0.50) is about 96 % early × 0.64. |
| A lit smoke, warm at its foot, dark above | **False: no smoke is drawn** | `fireFx.ts:266` (at 671128acd): `add(smoke)` sits inside the `//` comment that 5e8904aa9 inserted, so the mesh is never added. C's plume region, B's wagon plume and h2's wisp are bare sky. |
| A larger white-hot core | **True, at a cost** | 834 pixels over 245 (r18 121, mockup 2 722). The saturated orange fell from 23.5 k to 13.8 k. |
| Procedural leather on the glove | **Partly** | Fine 3.9 against 2.5 (mockup 8.3). |
| A smaller loop, its top below the crosshair, clear of C's plinth | **Smaller and lower: yes. Clear of the plinth: no** | The top is about 0.53. It still covers the plinth's right half in C. |
| A cooler, desaturated shade | **True** | Shade B/R 0.84 / 0.88 against 1.00 / 0.82. |
| Skylines: B's dune 24 m, waymark 0's rise 25 m | **True** | B 0.427–0.442 against 0.419–0.439; C 0.450–0.455 against 0.430–0.469. |
| The ray's patrol is ordinary, not staged | **True** | `duneRay.ts`: a `near` gate on distance and `calm` only. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Status | Region | Fix |
|---|---|---|---|---|---|
| R19B-1 | C, B (and every fire, h2) | **must-fix** | **new regression** (5e8904aa9) | C x 0.2–0.4, y 0.10–0.35; B x 0.47–0.56, y 0.22–0.38 | **The smoke is never added to the scene.** In `world/fireFx.ts` line 266, the round-18b comment `// round 18b (…): half as wide` was pasted mid-line, before `smoke.position.y = …; smoke.renderOrder = 1; add(smoke);`, so those statements are commented out. **Fix:** move the comment to the end of the line, or onto its own line. Then judge the round-19 colour ramp (warm foot, near-black above) on C's frame. **Accept:** C's plume box x 0.2–0.35, y 0.15–0.30 at 35–55 (the mockup's 46; now 23). B's plume column 5–12 above the sky beside it (the mockup's +9; now +1). h2's wisp back. |
| R19B-2 | A, dusk-fire (h1, clip) | should-fix | **new regression** (671128acd) | A x 0.30–0.53, y 0.31–0.345; dusk-fire x 0.4–0.75, y 0.30–0.36 | **Vertical streaks in the low sky.** `max(elev, 2.5)` in `look/painted.ts` stretches each heading's 2.5° texel row down to the 3D horizon. **Fix:** below about 4°, blend to a heading-blurred sample (for example 8–16 taps over ±4° of heading at the 2.5° row, like the 38° top fill), so the colour keeps the glow's broad gradient without the row's local detail. **Accept:** A's box column high-pass max ≤ 2 luma and top/bottom coherence ≤ 0.3 (now 5.5 / +0.93), with no streaks in h1 or the clip. |
| R19B-3 | A | should-fix | **repeated** (rounds 9–18) | x 0.4–0.75, y 0.38–0.50; near floor x 0–0.3, y 0.58–0.70 | **A's lit diagonal and tower mound.** Diagonal 46 against 97, mound 39 against 73, left lee 60 against 40, row-demeaned r +0.15. Under the fixed key (−0.34, 0.2, −0.92), the builder's own sweep shows that the landform, not the key, holds A back. **Fix:** test crest orientations offline on the bake under the shipped key, scored on A, dusk-fire and h1 together. The candidate is round 13's crest with its windward face turned toward the key, so its long face runs across A's x 0.4–0.7 and the tower mound's near flank faces the key. Place it in the dune sea, not by A's frame. **Accept:** A ≥ +0.3 with dusk-fire held at ≥ +0.35; A's diagonal ≥ 75; the near floor ≤ 80. |
| R19B-4 | B, C | should-fix | **repeated** (B's band since r18), **new** (the clipped tops) | B y 0.05–0.25 and 0.38–0.46; C y 0–0.3 | **B's band is magenta and the sky tops are clipped blue.** B: band h332 at 94.5 against h18 at 136, top (1,3,66) at 13 against 32. C: top (0,1,60) at 6 against (15,21,55) at 22. The early strip × 0.64 fixed A but crushed B's top, and the early strip's band at B's heading (about 303°) is pink. **Fix:** re-colour the early strip's glow band toward orange (h 10–25) at headings about 270–330°, where B's mockup paints it. Floor the dome's R and G at about the mockup's (15–20, 20–26) in the dark rows, so no channel clips. Keep A's top. **Accept:** B's top 25–40 with R ≥ 12; B's band h 0–30, luma ≥ 115; C's top 15–30 with R ≥ 10; A's top still ≤ 45. |
| R19B-5 | B, D | should-fix | **repeated** | B y 0.20–0.38; D y 0.30–0.50 | **Cloud streaks where the mockups' skies are clean and starry.** B has dark streaks across the middle; D has pink streaks (90, h336, against 72, h277) and a dim horizon band (72 against 148). **Fix:** thin the clouds in both strips at headings about 290–350° (B 303°, D 338°), and warm and lift the late strip's horizon row toward (209,145,107) at D's heading. **Accept:** D's middle at 65–80, h 260–310; D's horizon band ≥ 120; B's middle sd ≤ 12 (now 20.2, mockup 9.9). |
| R19B-6 | C (dusk-fire's lit faces) | should-fix | **repeated**, half fixed | C x 0.25–0.5, y 0.25–0.5 | **The core bleaches the tongues.** The `2.8 × smoothstep(0.62, 1, lum)` boost raised the pixels over 245 from 121 to 834 (mockup 2 722), but it cut the saturated orange from 23.5 k to 13.8 k (mockup 30 k). **Fix:** gate the boost by height in the flipbook cell, so only the lower third, over the logs, goes white and the upper tongues keep the orange pow curve. Raise the crown logs' emissive so they read inside it. **Accept:** over 245 ≥ 1 500, with saturated orange ≥ 22 k. |
| R19B-7 | all five | should-fix | **repeated** (R18B-3) | x 0.3–0.7, y 0.50–0.75 | **The hold.** One ring on a stick, its top at about 0.53. The mockups hang coils beside the fist, their tops at about 0.60, and in C the ring still covers the plinth's right half. **Fix:** keep glove-hd4. Hang the two turns (`LOOP.turns` 2) down beside the fist rather than up from the handle's top, as D's mockup does. It stays the one idle hold. **Accept:** the loop's top ≥ 0.58 in A; C's plinth (x 0.33–0.5, y 0.60–0.68) clear. |
| R19B-8 | dusk-fire (A) | should-fix | **repeated** (since round 1) | dusk-fire x 0.15–0.6, y 0.15–0.27 | **The ray: the mockup's large ray over the tower is absent from dusk-fire.** A, whose mockup has none, shows a small one. Row 5's patrol (34 m round a tower 145 m out) can only make it a speck from the spawn, about 5 % of the frame's width against the mockup's about 43 %. No stage may fix this. **Fix:** a real behaviour that brings it near: for example, the patrol's notice reaching the spawn so it circles in from the tower, captured in a real moment with its motion. Otherwise, the lead names it a mockup conflict. |
| R19B-9 | D (B, C) | should-fix | **repeated** | D y 0.52–0.72; C x 0.55–0.95, y 0.48–0.70 | **The far and open land is too light.** D left 43 against 16 (r18 36), C's far land 34 against 16, and C's ground 56 against 34. **Fix:** plan row 9's banded dune rows (shaded troughs by facing under the shipped key), and less flat-ground fill at the late dusk, without any camera-distance term. |
| R19B-10 | A, dusk-fire | nit | **repeated** | lit band y 0.38–0.58 | The brightest bin is still grey: 0.46 against 0.65–0.68. |
| R19B-11 | process | nit | **new** | README, 671128acd | The README's "a lit smoke" and "B within a few points" don't hold (R19B-1, R19B-4). D's "40–115" is the unchanged r18 sky. For a one-line visual change, check the frame for the change before writing the claim. |

SCORE signal-dunes: 6.7

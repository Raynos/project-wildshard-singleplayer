# Round 13, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- The "Signal Dunes, round 13" section of `art/mockup-council/round-13/README.md` and its five sheets.
- The full-res frames in `progress/sunscar-dunes/20261003-0648-50cd2d82/`: every `mock-*`, h1–h4, both aerials,
  `first-frame`, `clip.mp4` at 1 fps and `meta.json`.
- Round 12's capture `20261003-0611-c83fb063/`, for before and after, on the same regions.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- The builder's overlay `art/sunscar-dunes/round-22-landforms/overlay-A-duskfire.jpg`.

**Source checks (read-only):**
- `git show` of e790c0407, 5ba40cc0b, f59c79c30 and 50cd2d823.
- `layout.ts` LANDFORMS, `world/dunes.ts` `landforms()` and `field()`, and `look/render.ts` (KEY, `bakeDuneShadow`, the
  `away` term) at 50cd2d82.
- The terrain bake decoded (256², 500 m) at c83fb063 and at 50cd2d82: transects across the crest, slope statistics, the
  braziers' ground, and a sight-line test.
- The world points (crest polyline, mound rim, tower, braziers) projected through meta.json camAt into the A, dusk-fire
  and aerial frames. They land on the tower in every frame, so the projection is right.

**How I measured:**
- All brightness is Rec. 709 luma on the decoded JPEGs.
- Clean sand is the seats' patch, x 10–190, y 1160–1420. Fine detail is mean |luma − luma blurred at σ 2|.
- Grid r is the Pearson r of a 10×7 grid of mean luma over a named band, mockup against game. Regions are fractions of
  the portrait frame (x left → right, y top → bottom).
- My round-12 numbers reproduce seat C's round-12 table to within 0.1 on every clean patch.

**The short version.** Rows 1 and 3 changed the world and the late light, not just a coefficient, and they fix the
oldest finding on the list: A's left side is no longer lit (47.6 against the mockup's 45.0; it was 88.9). The
dusk-fire dome now reads as a broad separate mound under the tower. The late clip lost its black blots.

The pixels give back as much as they gain, though:
- **The crest doesn't make the mockup's light/shade split.** It runs exactly along the key's azimuth (cos −0.999), and
  its steep face points away from the spawn, not toward it as the README claims. A's mockup diagonal is still 50.6
  against 96.5, and the area under it is lit (69.3 against 42.5).
- **The late cut now reaches the player's feet.** With the distance gate gone, flat ground loses about 40 % at full
  dusk, underfoot included. C's near sand is 18.1 against 32.6, its pool 29.4 against 40.4, and D's lit near band 31.7
  against 58.7. The same change sent C's far land back to round 11's level (34.9 against 16.1).
- **The world outside the spawn's view got softer while the cone got sharper.** Faces steeper than 15° rose from 24.0 to
  29.7 % inside the spawn cone and fell from 28.3 to 18.6 % everywhere else. From the tower deck (h4), the land is now a
  flat rippled sheet.

The mean drops a little. No breach voids a score.

## Measurements (mockup / r12 / r13)

| View | Clean sand | Fine | Sky box (40,300)–(540,600) | Grid r, y 0.36–0.58 (r12 → r13) | Whole r, rows 120–1400 (mean diff) |
|---|---|---|---|---|---|
| dusk-fire | 73.8 / 65.8 / **73.5** | 9.3 / 9.0 / **5.4** | 75.9 / 100.0 / **98.3** | +0.47 → **+0.44** | +0.56 (19.7) → **+0.59** (19.7) |
| A spawn | 57.4 / 69.8 / **76.0** | 9.3 / 9.9 / **5.1** | 88.3 / 93.5 / **91.8** | +0.12 → **+0.33** | +0.65 (20.6) → **+0.68** (19.8) |
| B logbook | 39.7 / 35.9 / **26.3** | 2.0 / 3.1 / **2.4** | 50.1 / 46.7 / **46.6** | +0.74 → **+0.85** | +0.73 (11.9) → **+0.81** (11.2) |
| C waymark | 32.6 / 35.2 / **18.1** | 0.4 / 1.3 / **1.2** | 52.5 / 51.6 / **54.7** | +0.68 → **+0.46** | +0.62 (16.7) → **+0.55** (18.1) |
| D hands | 34.9 / 33.2 / **26.0** | 0.4 / 1.5 / **1.3** | 50.0 / 49.9 / **49.9** | +0.77 → **+0.76** | +0.79 (12.6) → **+0.79** (12.9) |

### Regions (mockup / r12 / r13)

| View | Region | Mockup | r12 | r13 |
|---|---|---|---|---|
| A | Left lee, x 0–0.3, y 0.38–0.44 | 45.0 | 88.9 | **47.6** |
| A | The mockup's lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.5 | 55.7 | **50.6** |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 54.1 | **69.3** |
| A | Right edge, x 0.9–1, y 0.52–0.545 | 33.5 | 56.1 | **68.9** |
| A | Sky, full width, y 0.24–0.30 / 0.30–0.36 | 102.6 / 109.8 | 111.2 / 96.0 | **110.7 / 91.9** |
| dusk-fire | Lit left shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 68.4 | **71.6** |
| dusk-fire | Saddle shade, x 0.35–0.9, y 0.46–0.56 | 54.6 | 55.7 | **65.8** |
| dusk-fire | Lower right, x 0.6–0.97, y 0.48–0.56 | 46.1 | 52.9 | **66.2** |
| dusk-fire | Sky, full width, y 0.24–0.30 | 85.0 | 116.7 | **116.3** |
| B | Wagon front, x 0.45–0.60, y 0.41–0.47 | 58.3 | 46.0 | **38.6** |
| B | Land left of camp, x 0–0.2, y 0.455–0.475 | 39.9 | 58.4 | **40.1** |
| B | Horizon glow, x 0.72–0.9, y 0.40–0.47 | 87.5 | 83.7 | **61.4** |
| B | Backdrop right of camp, x 0.6–1, y 0.44–0.48 | 21.4 | 50.1 | **28.4** |
| B | Mid sand, x 0.1–0.6, y 0.52–0.60 | 42.0 | 43.2 | **34.6** |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 9.3 | **34.9** |
| C | Pool, x 150–450, y 1060–1150 | 40.4 | 50.7 | **29.4** |
| C | Left ground, x 0–0.25, y 0.55–0.65 | 66.4 | 61.3 | **47.8** |
| D | Land, left half, y 0.52–0.62 | 16.0 | 34.3 | **33.5** |
| D | Land, right half, y 0.52–0.62 | 16.0 | 10.9 | **24.9** |
| D | Lit near band, x 0–0.4, y 0.64–0.68 | 58.7 | 37.6 | **31.7** |

### The crest, from the bake

- **Transect at the middle of segment 2**, every 10 m from 80 m on the far side to 80 m on the spawn side:
  `2.0 0.3 0.1 0.2 0.6 1.7 4.9 8.9 10.8 | 10.7 11.1 11.9 12.1 11.3 9.5 7.4 5.9`.
  - The steepest face is on the **far** side (23.8°). The spawn side is a 12° shoulder that stays at 11–12 m for
    40 m.
  - At 80 % along segment 2: far side 15.6°, spawn side 4.1°. On segment 1: far 21.8°, spawn 13.2°.
  - Why: `leeSide: -1` puts the lee profile on the side where `side < 0`, and the spawn is at `side = +37`. The layout
    comment's own convention ("+1: … the spawn's side here") says the opposite of the value set.
- **The crest runs along the key light.**
  - The crest's direction is (0.416, 0.909), and the key's azimuth, from `KEY.dir` (−0.45, 0.2, −0.87), is
    (−0.46, −0.89). Their cosine is −0.999.
  - So the light grazes along the crest rather than across it. The key's N·L on the two sides is about the same
    (0.26 / 0.23 against 0.18–0.24 at 80 %; 0.59–0.65 against 0.51–0.62 on segment 1).
  - No crest built on this line can show a lit face over a shaded one under this key.
- **Downwind check.** The field's slip faces fall downwind, toward (−0.643, 0.766), which is the spawn side (dot
  0.90). So the authored crest's steep face points **upwind**, the opposite of every other dune in the field.
- **The terrain outside the spawn's view:**

  | Bake | Spawn cone (±30°, 220 m): slope p90 / faces > 15° | h4 cone: p90 / > 15° | Rest of the inner 400 m: p90 / > 15° |
  |---|---|---|---|
  | r12 | 19.1° / 24.0 % | 11.5° / 7.2 % | 21.1° / 28.3 % |
  | r13 | **25.5° / 29.7 %** | **9.1° / 5.5 %** | **18.3° / 18.6 %** |

  82 % of the cells moved more than 0.5 m (e790c0407's wave retune plus the landforms).
- **Ground under each camera and site, r12 → r13:**
  - spawn 19.64 → 17.02;
  - tower 15.54 → 18.01;
  - caravan and B 14.76 → 5.37;
  - C 10.85 → 15.81;
  - **waymark 0 at (58, −34): 9.21 → 0.13**, the field's floor (h3 stands there).
  - From C's camera the terrain now rises 1.01 m over the sight line to waymark 0's bowl (r12: 0.20 m). In C's frame
    only its smoke shows (x ≈ 0.88, y 0.52). The mockup has "WAYMARK 64 M" standing on a far ridge there.

### clip.mp4 (late-dusk orbit, frames 1–10 at 1 fps)

| | Ground, y 0.55–0.90 | Glow band, y 0.10–0.20 |
|---|---|---|
| r12 | 15.1 21.9 23.7 20.6 16.3 12.1 8.8 7.2 8.1 10.4 | 179 → 127 |
| r13 | **27.4 31.7 33.1 32.9 32.9 32.3 31.0 29.0 27.3 25.8** | 179 → 127 |

- The black blots and lit ovals are gone. This is the round's cleanest fix.
- The late dunes now read as soft, nearly uniform brown swells.

### The low-sky clipped band (blue < 10 and red > 60, y 0.15–0.45)

| Shot | r12 | r13 |
|---|---|---|
| h2 | 3.60 %, worst row 547/780 | **1.07 %, worst row 150** |
| h4 | 2.73 %, worst row 288 | **3.08 %, worst row 288, at (96, 23, 1)** |

- h2's drop comes from the new pale dune behind the camp, which now hides most of the stripe. The band itself is
  unchanged.
- The README's test (blue < 30 and red > 110) read 0.01 % in round 12 too. It never caught this stripe.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.3** | 1. **The landform's light (x 0.35–1, y 0.46–0.56). A regression in value, a gain in form.** The tower now stands on a broad separate dome, closer to the mockup's silhouette. But the dome is lit on its left with a shaded crescent under it, and the saddle and lower right are lit (65.8 and 66.2 against 54.6 and 46.1; r12 55.7 and 52.9). The mockup has a dark dome over a shaded saddle under a big lit near-left shoulder (71.6 against 82.9). Grid r is +0.47 → +0.44. 2. **The sky (x 0.5–1, y 0.10–0.36). Repeated: round 12's regression is unchanged.** The cream-orange banks are still on the right, and the band at y 0.24–0.30 is 116.3 against 85.0. There is still no ray over the tower. 3. **The near field (y 0.56–0.86).** The value matches again (73.5 against 73.8), but the grain halved (fine 5.4 against 9.3; r12 9.0) into a soft regular ripple. Sefa and the upright double ring still fill the mockup's open foreground. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.5** | 1. **The diagonal crest (x 0.3–1, y 0.38–0.56). Repeated, but half fixed.** The left lee is finally shaded (47.6 against 45.0; r12 88.9), and grid r rose +0.12 → +0.33. But the mockup's lit diagonal is 50.6 against 96.5, and the shade under it is lit: 69.3 against 42.5, and 68.9 against 33.5 at the right edge. The crest runs along the key's azimuth, and its slip face points away from the camera. 2. **The tower and the mound (x 0.4–0.6, y 0.28–0.40).** The tower stands about 1.8× the mockup's height (about 0.091 of the frame against 0.051; r12 0.073) on a near dome. In the mockup it is a small tower on a far separate dune behind the diagonal. 3. **Near sand and sky (y 0.56–0.86; y 0.24–0.36).** The near sand is further off: 76.0 against 57.4 (r12 69.8), with the grain halved (5.1 against 9.3). The sky gradient is still inverted (110.7 / 91.9 against 102.6 / 109.8). Sefa and the rings are unchanged. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The values went down (x 0–1, y 0.41–0.86).** With the sand bell removed (correct under ledger 5), the clean sand is 26.3 against 39.7 and the mid sand 34.6 against 42.0. The wagon front is 38.6 against 58.3 (r12 46.0), so the camp reads as a dark lump with a lantern. 2. **The backdrop and glow (x 0.6–1, y 0.40–0.48). Mixed.** The land left of the camp now matches (40.1 against 39.9), and grid r rose to +0.85. But a pale lit dune now rises behind the camp on the right and cuts the horizon glow (61.4 against 87.5). The mockup's glow runs low and broad over a dark ridge. 3. **Caravan, smoke and coil. Repeated.** The tailboard is still saturated paint. The wisp still rises at x 0.72, not over the wagon. The upright double ring sits where the mockup has a broad low coil. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **6.5** | 1. **The ground and pool (x 0–1, y 0.55–0.86). A regression.** The late cut now covers flat ground underfoot: the near sand is 18.1 against 32.6 (r12 35.2), the pool 29.4 against 40.4 (r12 50.7), and the left ground 47.8 against 66.4. The mockup's fire-warmed orange floor reads as dark brown. 2. **The backdrop (x 0.5–1, y 0.44–0.56). A regression.** The far land is back at 34.9 against 16.1 (r12 9.3). A blue range of mountains now shows on the horizon, where the mockup has a dark dune line. Waymark 0 sank 9.1 m into a trough, so the mockup's second waymark on the right ridge is gone and only its smoke shows. Grid r fell +0.68 → +0.46. 3. **The fire. Repeated.** It is the size of the mockup's fire, but the core is pale and the licks are holed. There are no logs, no grey-brown billow up-left, and the embers fly right. The coil still covers the plinth. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.5** | 1. **The land (x 0–1, y 0.52–0.70). A regression.** The right half lost round 12's dark bands: it is now a lit rising dune slope, 24.9 against 16.0 (r12 10.9). The left is still 33.5 against 16.0. The mockup's lit near band is 31.7 against 58.7 (r12 37.6), because the late cut darkens it. 2. **The hero hand and coil (x 0.55–1, y 0.55–0.86). Repeated.** A crusted mitt with flecks and large upright rings crossing the centre. The mockup has a slim loop beside a stitched, folded gauntlet. Row 4 is not in this capture. 3. **The tower and the afterglow (y 0.44–0.52).** The tower is now partly hidden behind the far crest at x ≈ 0.93, under the SIGNAL TOWER chip. The afterglow band is still shallower than the mockup's. |

**Seat score, Signal Dunes: (6.3 + 6.5 + 6.9 + 6.5 + 6.5) / 5 = 6.54, so 6.5.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7.
- A gained (+0.2). B (−0.1), C (−0.5) and D (−0.2) lost, mostly to the late cut on flat ground and to the far land and
  far waymark that moved with the new ground.

## Builder's claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| "A crest spline … with a 30 m slip face toward the spawn and a 70 m windward face" | **False in the bake** | The steep side is the far side (23.8° against the spawn side's 12.1°, and 15.6° against 4.1° at 80 % along). `leeSide: -1` puts the lee where `side < 0`, and the spawn is at `side = +37`. |
| "The tower's broad mound: 21.5 m high over 62 m" | **True as code** | The tower ground is 18.01 in the bake (15.54 before). It reads as a dome in A, dusk-fire, h1 and both aerials. |
| "Dune-band grid correlation A 0.00 → +0.37, dusk-fire +0.21 → +0.37" | **A true in direction; dusk-fire does not reproduce against round 12** | My 10×7 grid over y 0.36–0.58: A +0.12 → +0.33, and dusk-fire **+0.47 → +0.44** (other bands +0.49 → +0.44, +0.44 → +0.32). dusk-fire's baseline of 0.21 is not round 12's capture. |
| "The old crest lines and the near ridge are removed" | **True** | `CREST_LINES` is empty and `CRESTS` is empty. A's right edge no longer has the ridge's lit hump. It now has the crest's lit shoulder instead (68.9 against 33.5). |
| Row 3: the shadow re-baked to ±520 m, a sharper penumbra, cast shade 0.28 | **True as code; small effect in the scored views** | Hard-edged oval shade pools show in both aerials and in h3's lower right. The far skirt shows no visible cast shade from h4 or D. |
| "The late-dusk darkening has no distance gate now" | **True, and the cut now reaches underfoot** | `away = smoothstep(0.3, 0.85, uDusk) * (1 − smoothstep(-0.05, 0.2, toGlow))`, a 45 % cut. Flat ground (toGlow 0) gets about 40 %. The clip is fixed (25.8–33.1 against 7.2–23.7). C's near sand is 18.1 against 32.6, its pool 29.4 against 40.4, and D's near band 31.7 against 58.7. |
| "The B sand bell is removed" | **True** | The term is gone from the sand shader. B's clean sand 35.9 → 26.3, which is honest. |
| "The low-sky red stripe in h2 is 0.02 % (blue < 30 and red > 110)" | **True by a test that never caught it; the stripe is still there** | That test read 0.01 % in round 12 too. With blue < 10 and red > 60: h2 1.07 % (it fell because the new dune hides it), and **h4 3.08 %, a full row of 288 clipped pixels at (96, 23, 1)**, unchanged. |
| "No camera was re-aimed" | **True** | The cameras blob is still a4219aa3, and every move in camAt is vertical, matching the bake's ground change. |
| gpuMB re-recorded "at the m5 parity measurement of 073a0e7ed" | **Acceptable** | 073a0e7ed descends from 5ba40cc0b, and only `budgetCeilings.ts` differs in the shard between 073a0e7ed and the capture. |

## Findings, ranked by score gained

1. **Turn the crest so that the key crosses it, with its slip face toward the spawn (A, dusk-fire; x 0.3–1,
   y 0.38–0.56).** *Repeated since round 1 (half fixed); the claim is false.*
   - Today the crest runs along the key's azimuth (cos −0.999), and its steep face points away from the spawn and
     upwind. So A's lit diagonal is 50.6 against 96.5, and the shade under it is 69.3 against 42.5.
   - dusk-fire's saddle and lower right are lit too: 65.8 and 66.2 against 54.6 and 46.1.
   - Fix:
     - Flip `leeSide` to +1, so the slip face faces the spawn and downwind like every other dune in the field.
     - Turn the crest polyline, or swing the key's azimuth within what the mockups' sun position allows, so the key falls
       across the crest at 45° or more. The windward face is then lit and the slip face shaded, as in both spawn
       mockups.
   - Check it on the bake (the steep side's sign) and from A, dusk-fire, h1 and both aerials before committing.
2. **Give the late cut a floor under the player's feet, and key it on facing rather than on flat ground (C, D, every
   late view).** *Regression.*
   - Removing the distance gate was right, and the clip proves it. But a 40 % cut on flat ground darkens the waymark's
     fire-lit floor and D's lit band.
   - Fix:
     - Apply the term only to faces turned from the glow (toGlow < 0, for example `1 − smoothstep(-0.3, 0.0, toGlow)`),
       not to flat ground.
     - Let the fire's light pool add after the cut.
   - Targets: C's near sand about 33, its pool about 40, D's near band about 58, and the clip's ground at 25 or more.
   - The same change should put C's far land back toward 16 without a distance term.
3. **Keep the dune field real outside the spawn's view (h4, h3, the aerials, C's backdrop).** *Regression, should-fix
   under ledger 5's no-narrowing.*
   - Steep faces fell from 28.3 to 18.6 % outside the spawn cone and rose from 24.0 to 29.7 % inside it.
   - h4 now looks over a flat rippled sheet, where round 12 showed a shaded dune.
   - Waymark 0 sits on the field's floor (0.13 m). h3 now looks out of a trough, and C lost the mockup's second waymark
     on its far ridge.
   - Fix:
     - Restore the field's relief outside the authored footprints. Plan row 1 asked for transverse bands toward D and
       20–40 m relief everywhere, not one crest.
     - Put waymark 0 back on a rise visible from C (the ground at round 12 was 9.2 m).
     - Check h4 and C's backdrop as well as A.
4. **dusk-fire's sky: take the banks out of its right half (dusk-fire; x 0.5–1, y 0.10–0.36).** *Repeated, round 12
   finding 1, untouched.*
   - The band at y 0.24–0.30 is 116 against 85.
   - Row 5 (the painted sky) is the plan's lever for this. Until it lands, this view caps near 6.5.
5. **A's tower size (A; x 0.4–0.6, y 0.28–0.40).** *New.*
   - The mound lifted the tower's ground 2.5 m and dropped the spawn eye 2.6 m. The tower is now about 1.8× the height
     on screen of A's mockup tower (dusk-fire's is about 1.2×).
   - A and dusk-fire share the camera, so this is partly a mockup conflict.
   - Fix: keep the mound top near the horizon, but don't raise it further. Let the lead rule which mockup sets the
     tower's size.
6. **The near grain at the spawn (A, dusk-fire; y 0.65–0.86).** *Regression, undeclared.*
   - Fine detail fell 9.9 → 5.1 and 9.0 → 5.4 (both mockups 9.3) when the spawn ground moved.
   - Row 2 (the sand material) should restore the grain without depending on the slope's facing.
7. **B's camp values (B; x 0.45–0.9, y 0.40–0.60).** *New, after the bell's honest removal.*
   - Light the wagon from its own lantern and a real local light (plan row 7): its front is 38.6 against 58.3.
   - Lower the pale dune behind the camp, or shade its camera face, so the glow runs broad and low (61.4 against
     87.5).
8. **The clipped low-sky band (h4 y ≈ 0.35, h2 behind the camp).** *Repeated; the fix claim is false.*
   - Test with blue < 10 at any red, and keep blue ≥ ~20 in the band term.
9. **Viewmodel, Sefa, the fire's core, B's smoke.** *Repeated. Plan rows 4, 6, 7 and 9, not in this capture.*

## Ledger-5 audit

- **Views: no breach.**
  - The cameras blob is the same (a4219aa3), and the README says so. All camAt moves are vertical and match the bake's
    ground change at each spot exactly:
    - B and h2: −9.39 and −9.40 (ground 14.76 → 5.37);
    - C: +4.96 (10.85 → 15.81);
    - h3: −9.08 (9.22 → 0.13);
    - spawn: −2.58.
  - No turn was hidden.
- **The authored landforms: real terrain, so no breach. Two should-fixes.**
  - They are global and walkable: max slope 39.2° in the bake, the navmesh re-baked. They show in both aerials, h1 and
    first-frame, and they are not cards or decals.
  - Their placement is by A's frame: the layout comment specifies "from the frame's x 0.3 at y 0.40 to the right edge
    at y 0.47". Plan row 1 sanctions composing from the mockups, so I don't count that as a breach. But it is the
    pattern the round-8 Sky Reach ruling warns against, and it didn't buy the light the frame wanted (finding 1).
  - **No narrowing, should-fix (finding 3):** relief moved into the spawn cone and out of the rest of the field. h4 is
    now a flat sheet, waymark 0 sits on the floor, and C lost its far waymark.
- **The late cut: no breach.**
  - The distance gate is gone (round 12's should-fix is closed), and the term is monotonic in dusk.
  - Its new cost lands on C and D (finding 2). That is honest global lighting, not a shortcut.
- **The B sand bell: closed.** It is gone from the shader, and the drop in B's sand is accepted as real.
- **Staged state: unchanged and reachable.**
  - No commit touches staging code, `meta.staged` holds the same three entries, and `duskOf` and `fillAt` are
    unchanged.
- **Global look: no per-view switches.**
  - The shadow map, the cut, the crest and the mound are all shard-wide, and no debug-only state shows.
- **Device and HUD: no breach.**
  - 390×844 touch, stored 780 wide, with the baseline HUD in every scored frame.
  - The 30 fps chip shows; `pageErrors: []`; `active: []`; 59 programs.
  - gpuMB 109.74 is re-recorded as a ratchet, inside the phone limits. Frame time and total memory are not on this
    surface: unverified, not breached.

SCORE signal-dunes: 6.5

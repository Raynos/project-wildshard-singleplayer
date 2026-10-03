# Round 20, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar and the phase amendments), the brief, `scores.md` (the lead's
  camera-distance rule and key-light ruling), and round 19's seat A, B and C files.
- The "Signal Dunes, round 20" section of `art/mockup-council/round-20/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1134-e4d15d35/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 19's `20261003-1047-671128ac/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 3489318b9, c1e7577c2, 2057866be and e4d15d354; `look/render.ts`, `look/painted.ts`,
  `world/fireFx.ts`, `world/build.ts`, `layout.ts`, `src/engine/world/Atmosphere.ts` (the fog chunk),
  `src/engine/ui/Perf.ts`, and the walk-test file `progress/physics/sd-r21-b-muslzi8h.json`. No engine commit lies
  between the two captures.

**How I measured:** the same tools and regions as my round-19 file. Its r19 numbers reproduce to within 0.5 (A's upper
sky 37.5, dusk-fire's saddle 48.2, B's top 19.9), and the row-demeaned r to within 0.05 (A +0.16 against +0.14).
- Rec. 709 luma on the decoded JPEGs; **sat** = mean (max − min) / max; **h** = HLS hue of the region's mean colour.
- **Regions:** frame fractions (x left → right, y top → bottom). **Clean sand:** x 10–150 px, y 1180–1400 px.
- **Row-demeaned r:** the Pearson r of a 10×7 grid of σ-12 luma over the dune band (y 0.36–0.56), each row's mean removed.
- **The flame box** this round is x 0.2–0.6, y 0.15–0.5 for all three images, so its counts differ from my r19 table's.

**The short version:**
- **Real gains:**
  - **The low-sky streaks are gone** in A, dusk-fire, h1, the first frame, the aerials and the clip. I checked this
    contrast-stretched.
  - **The smoke draws again.** C has a pale column over the fire, about twice the sky beside it. B has a wisp, but
    it rises right of the wagon.
  - **B's upper sky is fixed** (31.0 against 34.4; r19 19.9).
  - **The lantern lights B's wagon front** (42.5 against 45.7; r19 29.6).
- **But most of the batch moved little:**
  - A's lit diagonal is 48.7 against 96.7: the fourth round with no change.
  - B's band is still magenta-pink (h 339 against the mockup's orange h 12), so the claim that it is orange fails.
  - The horizon line's peak barely moved (D 129 against 166; r19 125).
  - C's and D's frames changed in only 4–6 % of pixels.
- **Two regressions:**
  - The flame's white-hot core is 294 px over 245 (r19 979; mockup 2 732).
  - h3 has a new flat violet shelf on its horizon.
- **The second crest is real terrain, but it lands low and short.** Its lit back sits where A's mockup has shade
  (x 0.55–1, y 0.49–0.55: 54.5 against 39.4). Row-demeaned r moves +0.16 → +0.22.
- **Ledger 5: no breach.**
  - The new aerial perspective is the engine's real exponential fog. It is one constant density, the same in every
    view, at 34.3 % at 150 m as claimed.
  - At C's and D's dusk its colour is near-black, so there it darkens by distance. The working tree already holds an
    uncommitted change that triples the density with the dusk. That is outside this capture, and I flag it for the
    lead below.

## Measurements (mockup / r19 / r20)

| View | Region | Mockup | r19 | r20 |
|---|---|---|---|---|
| A | Upper sky, x 0.05–0.55, y 0.11–0.16 | 36.3 | 37.5 | 40.6 |
| A | Sky, x 0.05–0.55, y 0.22–0.26 / 0.26–0.30 | 79.0 / 99.5 | 90.6 / 110.9 | 93.5 / 111.0 |
| A | Horizon peak (row mean, x 0.62–1) | 162 | 132 | 135 |
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** (154,84,49) | 46.4 | **48.7** (66,43,45) |
| A | Shade under it, x 0.5–1, y 0.48–0.54 | 42.5 | 51.0 | 51.3 |
| A | The new crest's lobe, x 0.55–1, y 0.49–0.55 | 39.4 (shade) | 57.2 | 54.5 (lit) |
| A | Over 80 in the band, left / right half | 28 / 17 % | 42 / 9 % | 34 / **2 %** |
| A | Far strip right, x 0.6–1, y 0.385–0.405 | 38.2 | 55.0 | 52.0 |
| A | Clean sand | 56.7 (86,49,35) | 76.3 | **70.5** (115,59,41) |
| A | Row-demeaned r | | +0.16 | +0.22 |
| dusk-fire | Upper sky, x 0.05–0.55, y 0.11–0.16 | 45.1, sat 0.18 | 38.0, sat 0.59 | 41.0, sat 0.58 |
| dusk-fire | Sky, y 0.24–0.30 / horizon peak (x 0.62–1) | 84.0 / 131 | 107.4 / 121 | 107.5 / 126 |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 | 85.4 | 77.7 |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 | 48.2 | 45.9 |
| dusk-fire | The new crest's lobe, x 0.55–1, y 0.49–0.55 | 44.6 | 49.9 | 51.4 |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 49.7 | 45.2 |
| dusk-fire | Clean sand | 74.1 (113,66,38) | 73.7 (115,64,42) | 68.1 (114,57,39) |
| dusk-fire | Row-demeaned r | | +0.37 | +0.38 |
| B | Upper sky, x 0.05–0.6, y 0.12–0.20 | 34.4 | 19.9 | **31.0** |
| B | Glow band, x 0–0.35, y 0.40–0.45 | 111.1, **h 12** (181,93,72) | 95.0, h 321 | 87.2, **h 339** (146,68,96) |
| B | Land left of the camp, x 0–0.2, y 0.455–0.475 / backdrop right, x 0.6–1, y 0.44–0.48 | 39.4 / 21.5 | 60.1 / 35.6 | 54.3 / 37.0 |
| B | Wagon front, x 0.48–0.62, y 0.47–0.52 | 45.7, h 17, sat 0.71 | 29.6 | 42.5, **h 6, sat 0.81** |
| B | Plume: column luma over the sky beside it, y 0.15–0.35 | 58 over 46, at x 0.50–0.54 (over the wagon) | none | 51 over 47, at **x 0.74–0.78** |
| C | Upper-left sky, x 0.02–0.3, y 0.10–0.30 | 43.5, sat 0.38 | 20.3, sat 0.92 | 22.9, **sat 0.86** |
| C | Plume, x 0.2–0.45, y 0.15–0.33 | 50.4, h 320 | 29.1 | 39.9, h 244 |
| C | Column over the fire, x 0.24–0.36, y 0.05–0.25 / sky beside it | diffuse, 39–41 | 12–15 / 12 | **27–35** / 15 |
| C | Flame box: pixels over 150 / 230 / 245 | 13 804 / 5 557 / 2 732 | 11 504 / 4 549 / 979 | 11 379 / 3 873 / **294** |
| C | Far land, x 0.6–0.9, y 0.48–0.53 / ground right, x 0.55–0.95, y 0.60–0.70 | 16.1 / 33.7 | 34.4 / 56.2 | 31.9 / 56.2 |
| D | Upper / mid sky (x 0.05–0.7, y 0.08–0.30 / 0.30–0.40) | 38.9 / 61.8 | 44.1 / 75.5 | 43.8 / 75.4 |
| D | Horizon peak (row mean, x 0–0.7) | **166** | 125 | **129** |
| D | Land, x 0–0.5, y 0.52–0.62 / lit near band, x 0–0.4, y 0.64–0.68 | 16.0 / 58.9 | 43.1 / 42.6 | 41.0 / 41.2 |
| B (low band) | Peak, x 0–0.35 | 128 | 114 | 109 |

**Pixels changed r19 → r20** (|ΔY| > 8): A 15.6 %, dusk-fire 13.8 %, B 16.5 %, **C 5.6 %, D 4.0 %**. The viewmodel
region (x 0.55–1, y 0.66–0.86) changed by a mean |ΔY| of 0.6–2.1 in all five, so the hold and glove are as in round 19.

**Sand saturation by luma bin** (y 0.38–0.50 full width, plus x 0–0.22, y 0.50–0.70). The bins are 20–40, 40–60,
60–80, 80–100 and 100–120:

| View | Mockup | r19 | r20 | Lit (Y > 65) G/R, mockup / r19 / r20 |
|---|---|---|---|---|
| A | 0.25 / 0.35 / 0.59 / 0.65 / 0.67 | 0.29 / 0.45 / 0.51 / 0.51 / 0.46 | 0.31 / 0.41 / **0.49 / 0.51 / 0.47** | 0.56 / 0.70 / 0.66 |
| dusk-fire | 0.20 / 0.56 / 0.68 / 0.69 / 0.65 | 0.29 / 0.48 / 0.54 / 0.53 / 0.46 | 0.32 / 0.44 / **0.53 / 0.54 / 0.40** | 0.56 / 0.67 / 0.62 |

- **The near patch overshot into red:** G/R is 0.50 in both spawn views against the mockups' 0.57–0.58.
- **The lit dune faces in the band are still beige-saturated:** the upper bins are 0.47–0.54 against 0.59–0.69.
- So the ×2.5 reached the flat floor but not the faces the mockups light.

**The late clip (1 fps), ground y 0.55–0.90:** 29.0, 30.9, 30.7, 30.1, 29.4, 28.2, 26.8, 25.5, 24.5, 23.9 (r19 31.1 …
24.4).
- No step, and no streaks.
- The far band (y 0.40–0.50) flattens at 27–28 (r19 rose to 31).
- In frames 7–10 the engine's far-ring strip under the ranges is now paler than the fogged dunes in front of it, which
  reads as inverted aerial perspective (nit).

**h3's new horizon shelf:**
- Rows 994–1030 (x 600–760) are a flat 80, with a hard top edge under a sky of 98.
- In r19 the same column ran smoothly at 105 down to the ranges.
- This comes from c1e7577c2's low-sky average. Below 5° it samples the strip at `max(elev, 1.2)`. At h3's heading the
  painted ranges reach above 1.2°, so their dark texels are averaged into a violet band: a second horizon, round 18's
  artifact in a new form.
- It is not visible in the five scored views. I checked A, dusk-fire, B, C and D contrast-stretched.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.7** | 1. **The forms (x 0–1, y 0.40–0.85). Repeated.** The light holds (r +0.38, saddle 45.9 against 49.5), and the streaks right of the tower are gone (a gain). But the mockup's one big lit slope with a crisp diagonal crest is still a flat lit floor, a soft shade band and lumpy mounds. The new crest adds a lit lobe low on the right where the mockup is in shade (51.4 against 44.6). The shoulder dipped (77.7 against 82.9). 2. **The sky (y 0.05–0.36). Repeated.** It is a saturated navy (sat 0.58 against 0.18) over a hot band (107.5 against 84). The mockup's big dark ray over the tower (x 0.2–0.6, y 0.2–0.27) is absent. 3. **The hold (x 0.3–1, y 0.53–0.86). Repeated, unchanged.** An upright ring on the handle and a straight cord, against one low, loose loop. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.5** | 1. **No lit crest diagonal (x 0.3–0.8, y 0.38–0.56). Repeated since round 9.** It is 48.7 against 96.7, the fourth round unchanged. The second crest put its lit back at x 0.55–1, y 0.49–0.55 (54.5), under the mockup's diagonal and where the mockup is in shade (39.4). The right half's lit share fell to 2 % against 17 %. r +0.22. 2. **The sky (y 0.05–0.37). Gain, then repeated.** The streaks are gone and the upper sky is close (40.6 against 36.3). The band still runs hot (93.5 against 79), the red-orange cloud banks are thin violet streaks, and a small ray glides at x 0.27, y 0.28, which the mockup doesn't have. 3. **The hold (x 0.25–1, y 0.53–0.88). Repeated.** One upright ring on a stick, against two broad coils at the bottom edge. The near floor is closer (70.5 against 56.7; r19 76.3) but now redder than the mockup (G/R 0.51 against 0.57). |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.7** | 1. **The sky's band (x 0–1, y 0.36–0.48). Repeated.** The top is fixed (31 against 34.4; r19 19.9). The mockup's clean orange band (111, h 12) is a darker magenta-pink (87, h 339), and pink cloud streaks still cross a sky the mockup keeps starry. 2. **The caravan's smoke and light (x 0.4–0.8, y 0.1–0.58). New, mixed.** A wisp is back, but it rises from right of the wagon (x 0.74–0.78), while the mockup's plume rises over the wagon (x 0.50–0.54). The lantern now lights the wagon's front to the mockup's value (42.5 against 45.7), but red (h 6, sat 0.81 against h 17, 0.71), and it lays a red-pink pool on the sand at the crosshair, where the mockup warms the crates and sand amber. 3. **The land and the hold (y 0.44–0.88).** The land left of the camp is 54 against 39 (r19 60), and the backdrop right is 37 against 21.5. The ring stands over the cargo's line. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.3** | 1. **The smoke and fire (x 0.2–0.6, y 0–0.5). Gain with a regression.** The plume is back: a pale column over the fire at 27–35 against the sky's 15, and the plume region rose from 29 to 40 against 50. But it is a straight, even ribbon going up out of frame, where the mockup has a billow drifting up-left. The white-hot core fell to 294 px over 245 (r19 979; mockup 2 732), and the logs still don't read. The sparks still stream up-left as in the mockup. 2. **The upper sky (x 0–0.6, y 0–0.35). Repeated, unchanged.** A saturated royal blue (sat 0.86, (12,20,80)) against violet-grey (sat 0.38). 3. **The ground and the hold (y 0.44–0.75). Repeated.** The far land is 32 against 16 and the open ground 56 against 34, both lit flat. The ring still cuts the plinth's lower left. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.3** | 1. **The horizon and sky (y 0.05–0.50). Repeated.** The streaks are gone, but the peach horizon line, the mockup's brightest feature, peaks at 129 against 166. Pink cloud streaks cross a mid sky the mockup keeps clean (75 against 62). 2. **The land (y 0.50–0.72). Repeated.** A flat field at 41 against dark bands at 16, with the lit near band 41 against 59. A dark smoke wisp now rises over the first waymark (x 0.27, y 0.43–0.47), which the mockup doesn't have, and the tower's new 30-tread stair hangs off its right side. 3. **The hand (x 0.55–1, y 0.6–0.86). Repeated, unchanged.** One upright ring on a stick, where the mockup hangs coils beside the fist. The leather is less creased than the mockup's. |

**Seat score, Signal Dunes: (6.7 + 6.5 + 6.7 + 7.3 + 6.3) / 5 = 6.70, so 6.7.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3, 6.6.
- Up 0.1 from round 19:
  - dusk-fire +0.1 and A +0.1, from the streaks gone and the near floor down, less the lobe in the wrong place;
  - B +0.2, from the top, the lit wagon and a visible wisp, less the red pool;
  - C +0.1, from the smoke, less the core;
  - D flat (4 % of its pixels changed).

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| The smoke draws again | **True** | C's column is 27–35 against the sky's 15. B has a wisp, but right of the wagon, not over it. |
| No streaks | **True** | Contrast-stretched A, dusk-fire, D, h1, the aerials and the clip are clean. |
| The horizon line is back ("D's band 118 against 116") | **Not by the peak** | The peaks are D 129 against 166, A 135 against 162 and dusk-fire 126 against 131, about +4 on r19. Also, h3 gained a dark shelf. |
| B's band orange, not magenta | **False** | h 339 at 87 against h 12 at 111 (r19 h 321). It moved slightly toward red; it is still pink. |
| The early gain eases in: A's top 43 against 40.5, B's 29 against 33 | **True** | A 40.6 against 36.3, B 31.0 against 34.4. |
| The blend window is 0.35–0.95, off the staged dusks | **True** | Smoothstep gives A and dusk-fire 0 %, B 16 % and C and D 94 % late. No quest dusk sits on an end. |
| A's lit diagonal: row-demeaned r A +0.23, dusk-fire +0.42 held | **True as numbers; the diagonal itself is not there** | I get +0.22 and +0.38. The diagonal box is 48.7 against 96.7. The lit back sits below it, on the mockup's shade. |
| "By eye: a lit dune lobe low on A's right and in h1, the tower's mound still clear" | **True** | And that is the problem: the mockup's lit sweep is higher and long, not a low lobe. |
| Lit sand: dusk-fire's near patch (113,57,39) against (113,66,38) | **True, and an overshoot** | My clean patch is (114,57,39). G/R 0.50 against 0.58 is redder than the mockup. The band's lit faces are still under-saturated (0.47–0.54 against 0.59–0.69). |
| The flame's white core only in the brightest | **True, and a regression of round 19's gain** | Over 245: 294 against 2 732 (r19 979). |
| Aerial perspective: the engine's exponential fog, about 35 % at 150 m | **True** | `fogDist.value = AERIAL_FOG` (0.0028) every frame. 1 − e^(−0.42) = 34.3 %. Atmosphere.ts `fog_fragment` applies it to every fog-compiled material. |
| Far bands: A 55 / 58, dusk-fire 38 / 50 | **Plausible; the gap stays** | My far strips are A 52 against 38 and dusk-fire 45 against 34.5. Both moved 3–5 toward the mockups. |
| Walk test: 7 legs, 0 stuck | **True** | `sd-r21-b-muslzi8h.json`: 7 legs, `stuck: []` in each, `walkErrors: []`. |
| No camera moved | **True** | cameras blob a4219aa in both captures, and every `camAt` is identical. |

## Findings, ranked by score gained

1. **The hold, in all five views (x 0.25–1, y 0.53–0.88).** *Repeated; now the single most persistent difference
   (the lead says the same).*
   - Every mockup shows a whip coiled and hanging low:
     - A and B: two broad coils at the bottom edge;
     - dusk-fire: one loose loop to the left of the fist;
     - D: coils hanging beside the fist.
   - The game shows one upright ring on a raised stick, centred, cutting C's plinth and B's cargo line.
   - **Fix:** change the one idle hold to the mockups' pose. Hang the coiled cord from the fist, below and to the
     left of it, with the handle lower. It stays one hold for all five; this is not a per-view pose.
   - **Accept:** the loop's top at y ≥ 0.60 in all five, and nothing over C's plinth.
2. **A's lit diagonal (A x 0.3–0.8, y 0.38–0.56).** *Repeated (round 9 on); the second crest missed it.*
   - The new crest's lit back lands at y 0.49–0.55 (54.5), on the mockup's shade (39.4). The diagonal box is unchanged
     (48.7 against 96.7).
   - **Fix:** move the second crest's line farther out and higher in A's frame, so its key-lit windward back fills
     x 0.3–0.8, y 0.38–0.48, and its slip face, not its back, sits at y 0.49–0.55.
   - Keep it a dune of the sea, the same shape class as its neighbours: in the overview it reads as a thin spur.
   - Re-check dusk-fire, where the lobe now lights the mockup's shaded right side (51.4 against 44.6).
   - **Accept:** A's diagonal ≥ 75, the lobe region ≤ 45, and dusk-fire's r ≥ +0.35.
3. **Late-dusk skies, C, D and B.** *Repeated, unchanged for several rounds.*
   - C's zenith is royal blue (sat 0.86 against 0.38).
   - D's mid sky has pink streaks (75 against 62), and its peach line peaks at 129 against 166.
   - B's band is pink (h 339 against h 12).
   - **Fix:** in the painting, by heading, which is world-space and global:
     - desaturate the zenith toward violet-grey at C's heading;
     - clear the clouds and lift the peach band at D's;
     - warm B's low band to orange at B's.
   - Don't move the blend window to get there.
4. **B's caravan: the plume beside the wagon and a red lantern pool (B x 0.4–0.8, y 0.1–0.58; h2).** *New, from
   3489318b9 and the ×2.5 direct-light saturation.*
   - **The wisp's source is right of the wagon** (x 0.74–0.78). The mockup's plume rises over the canvas (x 0.50–0.54).
   - **The lantern's point light goes through the sand's ×2.5 direct saturation.** That turns its orange (0xff7a30)
     into a red-pink pool (h 2–6, sat 0.81 on the wagon, against h 17, 0.71).
   - **Fix:**
     - Move the wisp's source to the wagon's stovepipe or centre.
     - Exempt point lights from the sand's saturation boost: apply it to the key's share of `directDiffuse` only.
     - Or give the lantern a yellower colour.
   - **Accept:** the wagon front at h 12–20, and the pool no redder than the lit sand beside it.
5. **C's flame core and the smoke's form (C x 0.2–0.6, y 0–0.5).** *Regression (core) and a partial gain (smoke).*
   - Over 245: 294 against 2 732 (r19 979). The smoke is a straight, even ribbon going straight up.
   - **Fix:**
     - Restore a white-yellow core over the logs. Round 19's boost threshold read better; the bleaching was in the
       tongues' colour curve, not in the core.
     - Break the smoke into puffs that widen and drift up-left with the sparks, attached to the fire's top, lit warm at
       the foot.
   - **Accept:** over 245 ≥ 900; C's plume region ≥ 45 with its centre left of the fire.
6. **The late land is too bright (D x 0–0.5, y 0.52–0.72; C x 0.6–0.9, y 0.48–0.53).** *Repeated.*
   - D is 41 against 16 and C 32 against 16.
   - **Fix:** darken by facing: the existing `away` term on faces turned from the glow. Not by a fog that turns
     near-black and thickens with the dusk (see the audit).
7. **h3's horizon shelf (h3 x 0.5–1, y 0.59–0.61).** *New regression, outside the scored five.*
   - **Fix:** average only sky texels in the low-sky hold. Mask the painted ranges out of the strip, or take each
     heading's hold from the first row above the ranges, so no range texel is smeared into the sky.
   - **Accept:** h3's column is monotonic from 98 down to the ranges.
8. **The lit sand in the band (A and dusk-fire, y 0.38–0.56).** *Repeated, half fixed.*
   - The flat floor went red (G/R 0.50 against 0.57), while the lit faces stayed under-saturated (0.47–0.54 against
     0.59–0.69).
   - **Fix:** put the saturation on faces by N·L (high on key-facing slopes, lower on the near-flat floor), not one
     global ×2.5.
9. **Nits:**
   - The dark smoke wisp over D's first waymark; the mockup has none.
   - The tower's 30-tread stair now hangs visibly off D's tower.
   - The engine's far-ring strip is paler than the fogged dunes in front of it in the late clip.
   - The one point light jumps to whichever lit source is nearest the player, so a lit brazier's pool switches off
     when the player stands nearer the caravan.
   - D's FPS chip is red: p50 > 33.4 ms on the capture host (Perf.ts:277; the budget check needs `?perf=1`, so it isn't
     that). In r19 it was amber. Worth one phone-parity run at e4d15d354.

## Ledger-5 audit

- **The aerial perspective is the engine's fog, the same everywhere. No breach.**
  - `render.ts` sets `targets.fogU.fogDistDensity` to the constant `AERIAL_FOG = 0.0028` on every update, at every
    dusk.
  - The shader is the engine's `fog_fragment` (Atmosphere.ts): `1 − exp(−fogDistDensity · rayLen)`. Its uniforms are
    injected into every fog-compiled material by `setInheritedPatch`.
  - `fog: false` is set only on the glove and whip (the viewmodel), the fire FX, the sky domes and the storm shell.
    Those are the right exclusions.
  - No new shard shader term reads camera distance. The `sandFar` terms are the pre-existing zero-mean detail fades,
    unchanged this round.
  - **Does it hide material?** No. The far bands moved only 3–5 points (A 55 → 52 against 38; dusk-fire 50 → 45 against
    34.5; C 34 → 32 and D 43 → 41 against 16), so the far-land gap is still in plain view and I scored it.
  - **Red-team note for the lead:**
    - The fog colour still lerps with the dusk to `DUSK_FOG` 0x0d0b1c, which is near-black, while D's horizon is the
      brightest thing in its frame.
    - At C's and D's dusk this "aerial perspective" therefore darkens with distance instead of hazing toward the sky.
    - Its late density is 31× round 19's: 0.00045 × 0.2 = 0.00009 → 0.0028, about 1.3 % → 34 % at 150 m.
    - That is inside the lead's rule ("or the engine fog"), so it is no breach. The measured effect is small (the late
      clip's ground is −1 to −2).
  - **Forward warning:**
    - The working tree, uncommitted and not in this capture, already has `fogDist.value = AERIAL_FOG * (1 + 2 * late)`,
      commented "darkening by fog is allowed".
    - At late dusk that is 1 − e^(−1.26), 72 % at 150 m, toward near-black. That is round 10's fade to black under the
      fog's name.
    - I recommend the lead rule before round 21 that the engine-fog exemption covers a fog whose colour follows the
      sky at the horizon. A near-black fog whose density rises with the quest is a brightness-by-distance term and
      counts toward the fourth-term void.
- **The second crest is real terrain, placed by A's frame. Should-fix (repeated from round 13), not a breach.**
  - It is in the bake: `terrain.json` hash and `landscapeHash` changed, and the navmesh was re-baked.
  - The same lobe shows in h1, aerial-spawn and aerial-overview.
  - The walk test is 7 legs, 0 stuck, with a 39.1° max climb against the 40° limit.
  - Every `camAt` is unchanged, so no camera rode the new ground.
  - But its line was chosen "on A's diagonal" and tuned on five variants of one frame correlation. In the overview it
    reads as a thin spur, not a dune of the sea.
  - **Fix:** shape it as a member of the dune sea (finding 2) and say so in the commit.
- **The sky's blend window, 0.35–0.95: global, monotonic, off the staged dusks. No breach; round 19's should-fix is
  closed.**
  - B now shows a 16 % blend, so a mid-blend sky is on the scored surface.
  - The early gain is by elevation, and the low-sky average is by heading at the true elevation. Both are
    world-space, with no view input. h3's shelf is an artifact, not a cheat.
- **The lantern light: real play state. No breach.**
  - The one point light goes to the nearest lit source to the player, every frame, in play.
  - At B's staged `logbook` no waymark burns, so the lantern holds it. That is reachable by walking to the caravan
    before any waymark.
  - Nothing in the capture code touches it.
- **Staged state: the handlers are unchanged.** c1e7577c2 touches a file with a stage handler, but its edits are the
  smoke's line break, the sky, the fog, the sand, the flame and the stair count; none changes what a stage sets. B is
  at dusk 0.50, C and D at 0.86, as in round 19.
- **Still props and frozen poses:** none. The flame and smoke animate, the hold is the one idle pose, and the ray flies
  free.
- **Global grade: none.** `lut: null`. The ×2.5 saturation is a lighting term, global, and it is scored where it hurts
  (B's pool, the red floor).
- **No narrowing:**
  - Gains outside the five: h1, the first frame, the aerials and the clip lost their streaks.
  - Losses: h3's horizon shelf, h2's red pool.
  - h4 is unchanged.
  - The late clip's ground holds at 24–31 with no step.
- **Device and HUD:** 390×844 touch, stored 780 wide, the baseline HUD, `pageErrors: []`, no QA retakes, 59 programs
  (r19 57). The gpuMB re-record is +0.006 MB, inside the phone limits. D's red FPS chip is a nit above.

No score is voided.

SCORE signal-dunes: 6.7

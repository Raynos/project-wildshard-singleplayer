# Round 24, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` (the camera-distance
  rule, the key ruling, the fog ruling, the round-22 rulings), and round 23's seat A, B and C files.
- The "Signal Dunes, round 24" section of `art/mockup-council/round-24/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1406-7db2a5a2/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 23's `20261003-1325-8f296fb4/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 5d0be40ff, a5dc51367, 8382bdad6, 81c1f8034, 38496b429 and 7db2a5a26;
  `layout.ts`; `cameras.json`; the baked `terrain.bin` at 8f296fb4b and 7db2a5a26; `progress/physics/sd-r24-b-musrfqm6.json`.

**How I measured:** the same tools and regions as my round-23 file; its r23 numbers reproduce (A's diagonal 86.8 h24,
A's row-demeaned r +0.47, dusk-fire +0.58, D's rows 30 35 35 39 …).
- Rec. 709 luma on the decoded JPEGs; **s** = mean (max − min) / max; **h** = hue of the region's mean colour.
- **Row-demeaned r:** Pearson r of a 10×7 grid of σ-12 luma over y 0.36–0.56, each row's mean removed.
- **Red share:** pixels with hue < 12° or > 350° and s > 0.5. **Lilac:** hue 240–330°.
- Regions are frame fractions (x left → right, y top → bottom). The coil now sits at x ~0.45–0.88, y 0.60–0.85, so
  every near-sand box below is either left of it or says so.

## The short version

- **The D move is legitimate: no void.** The new stand is where the mockup's composition is, on two cues the builder's
  predictor did not optimise: the tower's apparent size and the mockup's own minimap. It is the ground beside the spawn.
  But it did not buy what it was chosen for: D's land is still flat-lit (median 34.6 vs 13.7) and has fewer bands than
  before. Ruling and evidence in the audit.
- **The new sunset saturation term (2.5) turns the shade red, not the light gold.**
  - The lit quarter barely moved (A s 0.43 → 0.47, dusk-fire 0.46 → 0.51; mockups 0.66 / 0.68).
  - Red pixels went from 6–7 % to 23–30 % of the spawn pair's dune band (mockups 2 %).
  - h3's near ground is s 0.99, h2's s 0.91, and aerial-spawn has a hard-edged red stain.
  - The term's ramp ends on B's staged dusk (0.5): a should-fix, not a void.
- **Real gains:**
  - dusk-fire's saddle is fixed (30.9 → 47.4 vs 49.5), and its shoulder too (72.0 → 82.2 vs 82.9);
  - the hold hangs right in every view, and C's plinth is clear;
  - D's glow line is peach and bright (126 → 151 vs 166);
  - B's sky streaks are gone;
  - the late clip's black blots are gone (p5 3.4 → 12.4).
- **No breach anywhere. Seat score 7.0.**

## Measurements (mockup / r23 / r24)

| View | Region | Mockup | r23 | r24 |
|---|---|---|---|---|
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | 96.7 h20 s0.65 | 86.8 h24 s0.47 | **78.9 h18 s0.54** |
| A | Trough, x 0.2–0.6, y 0.47–0.53 | 42.7 h318 | 95.3 h26 | 92.4 h21 |
| A | Left lee, x 0–0.3, y 0.40–0.50 | 39.6 h309 | 54.7 | 52.0 |
| A | Right shade band, x 0.55–1, y 0.47–0.55 | 44.1 h348 s0.31 | 44.8 h6 s0.42 | **58.5 h11 s0.65** |
| A | Right stripe, x 0.8–1, y 0.50–0.56 | 37.4 h326 s0.27 | 27.7 h303 | **46.4 h7 s0.69** |
| A | Lit quarter of y 0.36–0.56 | 158,89,54 h20 s0.66 | 129,100,75 h28 s0.43 | 132,94,70 h23 s0.47 |
| A | Coil-free near sand, x 0–0.08, y 0.62–0.80 | 59.7 | 78.3 | 78.3 |
| A | Row-demeaned r | | +0.47 | +0.50 |
| A | Warm / lilac / red share, y 0.36–0.62 | 41 / 41 / 2 % | 56 / 18 / 6 % | 68 / 10 / **23 %** |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 h13 s0.39 | 30.9 h326 | **47.4 h7 s0.63** |
| dusk-fire | Shoulder, x 0–0.35, y 0.50–0.70 | 82.9 h22 | 72.0 h22 | **82.2 h18** |
| dusk-fire | Right low band, x 0.55–1, y 0.50–0.58 | 45.7 h6 s0.28 | 31.1 h337 | 41.7 h7 s0.65 |
| dusk-fire | Lit quarter | 130,73,42 h21 s0.68 | h26 s0.46 | 126,85,62 h21 s0.51 |
| dusk-fire | Row-demeaned r | | +0.58 | +0.54 |
| dusk-fire | Warm / lilac / red share | 53 / 16 / 2 % | 47 / 28 / 7 % | 59 / 16 / **30 %** |
| dusk-fire | Sky, y 0.05–0.36 | 66.5 h14 s0.36 | 74.8 h356 s0.58 | unchanged |
| B | Glow band left / right, y 0.40–0.45 | 111 / 112 | 89 / 78 | 90 / 79 |
| B | Mid sky, y 0.30–0.38 | 65.7 h271 | 64.0 h320 | 64.1 h321 |
| B | Lantern pool | 56.9 h14 | 58.6 h11 | 57.7 h10 |
| B | Backdrop right | 17.2 | 37.5 | 36.5 |
| C | Plinth, x 0.40–0.52, y 0.565–0.60 | 70.2 h19 | 51.0 (coil) | **90.0 h13 (clear)** |
| C | Ground right / far land | 33.7 / 16.1 | 50.6 / 31.7 | 49.1 / 32.6 |
| C | Low sky right | 80.8 h342 | 58.6 h305 | 58.8 h305 |
| D | Land rows y 0.53–0.63, full width | 16 12 21 14 15 | 28 27 29 37 40 | **35 34 32 32 33** |
| D | Land rows y 0.50–0.70, x 0–0.5 (sd) | sd 18.8 | sd 3.2 | sd 5.4 |
| D | Land y 0.50–0.70: median; share < 8 | 13.7; 1.9 % | 40.2; 12.1 % | 34.6; 1.0 % |
| D | Far land right, x 0.5–1, y 0.50–0.58 | 23.0 | 21.5 | **34.4** |
| D | Lit stripe, x 0–0.4, y 0.63–0.67 | 54.0 | 39.2 | 43.8 |
| D | Glow peak (row mean, x 0–0.7) | 166 at y 0.497 | 126 at 0.454 | **151 at 0.472** |
| D | Horizon (first dark row) | y 0.509 | 0.488 | 0.480 |
| D | Tower width (legs, of frame width) | 0.048 | 0.037 | **0.047** |
| h2 | Ground left, x 0–0.4, y 0.62–0.80 | | 34.8 h14 s0.76 | 34.2 h10 **s0.91** |
| h3 | Near ground, x 0–0.35, y 0.70–0.80 | | 41.3 h18 s0.83 | 36.6 h11 **s0.99** |
| aerial-spawn | Patch, x 0.82–1, y 0.66–0.76 | | 50.2 h12 s0.65 | 44.9 h12 **s0.90** |
| Late clip | Ground y 0.55–0.90, s 1 … 10: mean; p5 | | 27.9 … 19.9; 7.4 … 3.4 | 31.0 … 23.1; **17.5 … 13.4** |
| Late clip | Far band y 0.22–0.30 | | 28.8 … 32.8 | 31.0 … 33.1 |

**Pixels changed r23 → r24** (|ΔY| > 8):
- **Scored views:** A 12.2 %, dusk-fire 13.3 %, B 6.8 %, C 6.9 %, D 22.4 % (the move).
- **Hero views and aerials:** first-frame / h1 12 %, h2 9.3 %, h3 6.7 %, h4 5.9 %, aerial-spawn 3.0 %, aerial-overview
  0.4 %.
- Outside the coil, the changes in the unstaged views are almost all the saturation term's red cast on the ground.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.8** | 1. **The sky (y 0.05–0.36). Repeated, untouched for many rounds.** Navy at s 0.59 against a dusty grey dusk at 0.36, and no ray over the tower. 2. **The dune colour (x 0–1, y 0.40–0.62). New.** The values now match: saddle 47.4 vs 49.5, shoulder 82.2 vs 82.9 (both fixed). But the saddle and the right band are saturated red (h7 s 0.63–0.65 against h6–13 s 0.28–0.39), and 30 % of the band is red against 2 %. A red stripe runs along the right edge (x 0.8–1, y 0.52–0.57). 3. **The hold (x 0.45–0.88, y 0.60–0.85). Much closer.** One coil centre-right, as the mockup's single loop (x 0.38–0.75), but still two stacked turns and a mottled fist. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.7** | 1. **The ridge's light (x 0–0.8, y 0.40–0.55). Repeated, mixed.** The diagonal's colour is closer (h18 s 0.54 vs h20 s 0.65), but its value fell (86.8 → 78.9 vs 96.7). The trough under it is still lit (92 vs 43). 2. **The right side lost its shade (x 0.55–1, y 0.47–0.56). New regression.** The mockup's violet shade (44 h348 s 0.31) is now red-lit sand (58.5 h11 s 0.65), with a hard red streak at the right edge (46 h7 s 0.69). Lilac fell from 41 % to 10 % of the band, red rose from 2 % to 23 %. 3. **The near sand and the hold (y 0.60–0.85). Repeated, and better.** The coil-free sand is still 78 vs 60. The coil now hangs right of the fist (x 0.45–0.88; mockup 0.33–0.80): the right side, slightly smaller. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.1** | 1. **The low glow band (x 0–1, y 0.40–0.45). Repeated, unchanged.** 90 / 79 against 111 / 112. 2. **The sky (y 0.10–0.38). Better.** The pink streaks are gone, but the mid sky is still magenta (h321 vs h271). 3. **The camp's finish (x 0.4–1, y 0.40–0.56). Partly fixed.** The plume now rises over the canvas (x ~0.56 vs 0.53). The backdrop right is 36.5 vs 17.2, and the canvas, cargo and wheels are still blocky. The hold sits on the right, as in the mockup. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.5** | 1. **The open ground and far land (x 0.55–0.95, y 0.48–0.70). Repeated.** 49 vs 34 and 33 vs 16: lit flat and too bright outside the pool. 2. **The fire and smoke (x 0.2–0.6, y 0.08–0.50). Repeated.** The core is good (p95 228 vs 238), but the tongues are upright and the smoke is a column, not the up-left billow. 3. **The low sky (x 0.6–1, y 0.40–0.47). Repeated.** 59 h305 vs 81 h342. The round-23 regression is fixed: the plinth stands clear (90 vs 70), and the coil hangs low-right as in the mockup. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`, **moved 49 m**) | **6.9** | 1. **The land is flat-lit rolling dunes, not long dark bands (x 0–1, y 0.50–0.70). Repeated, and less banded across the width.** The full-width rows are 32–35 against 12–21 (sd 1.3; r23 5.2). The far right lost its dark lees (34 vs 23; r23 21.5). The lit stripe is 44 vs 54. 2. **The hold (x 0.45–0.88, y 0.60–0.85). Much better.** The coil now hangs right, where the mockup's small loops are (x 0.57–0.80), not a lasso on the left. It is still two broad stacked turns, not 2–3 slim vertical ones. 3. **The horizon (y 0.44–0.53). Better, with a new cost.** The glow line is now peach and bright (151 vs 166; r23 126), and the tower's scale and x match. The horizon sits at 0.48 vs 0.51, and the lit waymark the mockup shows at x 0.06, y 0.53 is now under the HOVER button (x 0.08, y 0.49). Only its smoke shows. |

**Seat score, Signal Dunes: (6.8 + 6.7 + 7.1 + 7.5 + 6.9) / 5 = 7.00, so 7.0.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3,
  6.6, 6.7, 6.6, 6.8, 6.9.
- **Up 0.1 from round 23.** The gains: the hold's placement in all five views, dusk-fire's saddle, C's plinth, D's glow
  line and B's sky.
- **Held back by:** the saturation term's red cast in the spawn pair; A's trough and dimmer diagonal; D's flat land; and
  the skies of dusk-fire, B and C, untouched.
- **I give the D move no credit for land:** D's land is no closer.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| D's rows 0.53–0.63 "now 11, 4, 11, 17, 23" (38496b429) | **Not supported at the captured SHA** | The capture has 35 34 32 32 33 full-width, 24 30 30 34 40 in the left third and 37 32 30 31 35 in x 0.1–0.6. The numbers came from before 7db2a5a26 raised the late term from ×0.25 to ×0.45. The README's own "D's median 33.6, not met" is the honest one. |
| "From the new spot … a lit waymark at the left" | **Hidden** | Waymark 1 projects to x 0.081, y 0.49–0.50 (119 m away). It is under the HOVER button (x 0–0.095, y 0.425–0.495); only smoke and embers show at its right edge. |
| D at 151 m, tower at x 0.85 | **True** | Tower (8, −75) projects to x 0.850; its base is at y 0.493. |
| Saturation 2.5 → 1.6: "the spawn pair keeps round 22's hue" and the lit sand goes gold | **Partly** | The lit quarter's hue is right (A h23, dusk-fire h21; mockups h20/21), but s is only 0.47 / 0.51 against 0.66 / 0.68. The term's main visible effect is red mid-tones and shade (finding 1). |
| Dusk-fire's saddle 31.4 → 47.4, r +0.59 | **Saddle true; r +0.54 on my grid** | 47.4 h7 (mockup 49.5 h13). The value is right; the hue is redder and twice as saturated. |
| A's diagonal 88.7 → 78.9; A's r +0.52 | **True (78.9; r +0.50)** | The README states the diagonal's loss. |
| The coil at x ~0.45–0.85, top ~0.6; C's plinth clear | **True** | C's plinth box 51 → 90 (mockup 70), with no cord in it. |
| The late term at ×0.45: D below luma 8 at 2.6 %, C 2.1 % | **True in direction** | D's land y 0.50–0.70 under 8 is 1.0 % (r23 12.1 %). The clip's p5 at s 6–10 is 12.4–13.4 (r23 3.4), which meets my round-23 accept (≥ 10). |
| The ridge's south cap tapered; the aerial's lens shrank | **True** | Terrain changed on 873 cells (x −30…50, z −36…56, max 2.39 m). The aerial and clip lens is now a soft, small pool. |
| B's plume at x 0.565 | **True by eye** | The cookfire moved in the caravan's own frame onto the approach's sight line (a5dc51367). It is a real prop and stays put at every heading. |
| D's glow line 200,140,105 (mockup 198,140,105) | **True in colour, 0.03 high** | r24 y 0.46: 188,132,98; the mockup peaks at y 0.49: 206,148,111. |
| Walk test 7 legs, 0 stuck | **True** | See the audit. |

## Findings, ranked by score gained

1. **The sunset saturation term paints the shade red (A, dusk-fire, h1–h3, aerial-spawn).** *New regression.*
   - **What it does:** `mix(vec3(dL), directDiffuse, 2.5)` scales chroma about luma at every pixel the key reaches.
     Faces the key barely reaches gain chroma out of all proportion to their light.
   - **The result:** the lit quarter gained 0.04–0.05 of s, while the mid-tones and shade went red:
     - red share A 6 → 23 %, dusk-fire 7 → 30 % (mockups 2 %);
     - A's violet right band became 58.5 h11 s 0.65;
     - h3's ground s 0.99, h2's s 0.91.
   - **The fill swap's hard edge:** the warm-fill swap keys on `(1 − sandShade)`, so a baked shadow edge becomes a hard
     red edge. That is aerial-spawn's stain (s 0.90) and A's right streak.
   - **Fix:**
     - Put the gold in the highlights, not the mid-tones: weight the saturation boost by the direct term's own strength
       (or warm the key's colour), and leave the near-shadow faces at 1.6.
     - Feather the warm-fill mask (or derive it from N·L, not the baked shadow), so no shadow edge turns into a colour
       edge.
     - Move the ramp's ends off the staged dusks (see the audit).
   - **Accept:**
     - the red share ≤ 8 % in A's and dusk-fire's band;
     - the lit quarter s ≥ 0.55 at h 18–24;
     - A's right band back to s ≤ 0.45 and lilac share ≥ 25 %;
     - h3's near ground s ≤ 0.85;
     - no hard-edged patch in aerial-spawn.
2. **D's land needs real bands (D x 0–1, y 0.50–0.70).** *Repeated. The camera move did not fix it.*
   - **The numbers:**
     - the median is 34.6 vs 13.7;
     - the full-width rows are flat (sd 1.3);
     - the far right lost the dark lees it had at the old stand (34 vs 23).
   - **The ruling below freezes D at this stand**, so the remaining fix is terrain and light in D's 30–150 m band
     north-north-west of the hub: two or three transverse dune lees, built like the field's own crescents. The ridge's
     west faces are already in this view; they need to read as long dark lees under thin lit rims, not as a smooth
     rolling floor.
   - Don't darken the whole field from the late term again: round 23 showed that buys black blots.
   - **Accept:** full-width rows y 0.53–0.63 ≤ 25 with sd ≥ 6, and the clip's late p5 ≥ 10.
3. **A's lit diagonal and trough (A x 0–0.8, y 0.40–0.55).** *Repeated; the diagonal regressed 8.*
   - **The numbers:** the trough is 92 vs 43; the diagonal 78.9 vs 96.7.
   - **Fix:** round 23's finding 1 stands: narrow the ridge's lit west flank so the shade returns under the diagonal.
     The fix for finding 1 should also restore the right side's violet.
   - **Accept:** the trough ≤ 55 with the diagonal ≥ 85.
4. **The untouched skies.** *Repeated.*
   - **dusk-fire** (y 0.05–0.36): s 0.59 vs 0.36. It needs the dusty charcoal-amber, not navy.
   - **B's glow band** (y 0.40–0.45): 90 / 79 vs 111 / 112.
   - **C's low sky right:** 59 h305 vs 81 h342.
   - **Fix:** make each a world-panorama change that is smooth across headings (see finding 6).
5. **D's waymark under the HUD (D x 0.08, y 0.49).** *New, a side effect of the move.*
   - The mockup's small fire stands just below the HOVER button. Ours is under it.
   - **Don't move the camera again** for this. Score it as a cost. If anything, the far brazier's flame could sit a
     little lower on its rise, but only if mockup C's composition (the same brazier) holds.
6. **B's early-sky edit is a window centred on B's heading (8382bdad6).** *Should-fix, a repeat of the round-22
   pattern.*
   - It is full within ±15° of 303° and gone by ±45°, sized "clear of A's 0 and dusk-fire's 352". B's frame spans
     ±18.6°.
   - It is smooth, so there is no seam, and it is world-space, so it is no breach. But it is the same "window cut to a
     camera's frame" the lead flagged for D.
   - **Fix:** widen the ease to ±70°, like the late sky's.
7. **Process.**
   - Quote D's rows from the capture, not from a predictor run at an earlier late term.
   - The QA screen check was skipped (`qa.skipped`: "the model lock stayed busy for 120 s"). I checked every frame by
     eye: all are world frames.

## Ledger-5 audit

### The D move (38496b429): legitimate, no void, but D is frozen here

The lead's three questions:

1. **Does the new stand reproduce mockup D's composition? Yes, better than any earlier stand, on cues the predictor
   did not target.**
   - **The tower's size.** The mockup's tower legs span 0.048 of the frame's width. Mockup A's tower, seen from the
     spawn (145 m in the game), spans 0.045. So the mockup draws D's tower at about the spawn's distance.
     - New stand (151 m): 0.047.
     - Old stand (198 m): 0.037, 77 % of the mockup's.
     - Every stand since round 8 ((118, 88), (38, 122), (36, 92)) was 170–200 m out, too far.
   - **The mockup's own minimap.** Mockup D's minimap puts the arrow at the trail hub, with three trails radiating
     below it. That is the same picture as mockup A's minimap, at the spawn.
     - The game's hub is the spawn: every `TRAIL` starts there.
     - The new stand is 25 m from the hub, and its minimap matches the mockup's (the hub just right of the arrow, three
       trails).
     - The old stand was 64 m away, and its minimap showed the hub far down-right.
   - **The tower's x** is 0.850 against the mockup's 0.85.
   - **What the stand does not reproduce:**
     - the long dark bands (that is a land gap, finding 2);
     - the waymark, now under HOVER;
     - the horizon, 0.03 high.
   - **The predictor matched land rows, and the capture shows it failed to deliver them.** So the stand was not won on
     the land; it holds on the tower and the map.
2. **Is it a reachable place a player would stand? Yes.**
   - **The ground:** baked terrain at (25, 75) is 19.99 m, with a 14.6° slope. The eye at 21.70 is 1.71 m up, the same
     eye height as the spawn's (21.35 → 23.05).
   - **The place:** it is 25 m east-south-east of the spawn, on unchanged terrain (r23 = r24 there).
   - **The staged state:** waymarks-lit at dusk 0.86. A player who walks back to the hub after the third brazier stands
     here, and the mockup's own minimap places its player there.
3. **Was it chosen to escape the flat-lit land? Its motive, yes; its effect, no.**
   - **The motive:** the commit says so ("D stood on the waymark rise: its land rows … lit flat"). The candidates were
     ranked by a late-light predictor of D's land rows: a camera search scored on the weak area. That is the exact
     pattern ledger 5 forbids.
   - **The effect:** the captured land is not closer.
     - The median is 40.2 → 34.6 (mockup 13.7).
     - The full-width band structure got flatter (sd 5.2 → 1.3).
     - The far right lost its dark lees.
   - So the move did not get the view out of the land problem. It moved to the composition the mockup actually draws
     (tower scale, minimap hub), which ledger 5 allows.

**Ruling:** no breach, and D is scored, not void, on these conditions:
- D is **frozen at (25, 75), yaw 19.7**: the tower scale and the minimap now pin it. A fourth relocation would void D.
- D's land is a terrain and light job (finding 2).
- I gave the move no land credit. D's 6.9 comes from the hold, the glow line and the tower's scale.

### The other checks

- **The saturation term (5d0be40ff): fitted to the staged dusks; should-fix, not void.**
  - `mix(2.5, 1.6, smoothstep(0.2, 0.5, uDusk))`: its two values are named after two staged views ("the spawn pair's
    lit sand closest to its mockups there"; "1.6 from the logbook's dusk, where the lantern pool must stay amber"). The
    ramp ends exactly at B's staged 0.50.
  - It is global, monotonic, a time-of-day term reached by play, and declared, the same as round 11's `fillAt` and
    round 19's blend window. Those were should-fixes.
  - **Fix:** a ramp whose ends don't sit on staged values.
  - It does not hide a material gap. It adds a red cast that costs likeness (finding 1), and that is how I scored it.
  - It touches every unstaged hero view (h1–h3, the aerials) at the sunset. That is "no narrowing" damage outside the
    scored views, a should-fix, since it is a look regression, not content removed.
- **Camera distance: none.**
  - The diff 8f296fb4b..7db2a5a26 adds no `cameraPosition`, view-distance or fog term.
  - The late term is still `smoothstep(uDusk) × facing-to-glow × slope`; only its depth changed, 0.75 → 0.55.
- **Fog: unchanged.** The clip's far band climbs 31.0 → 33.1 through the late dusk, and nothing goes toward black.
- **The late facing term: legal, and round 23's should-fix is closed.** The clip's late p5 is 12.4–13.4 (r23 3.4),
  and D's share under luma 8 is 1.0 %.
- **Sky edits:**
  - **D's glow line (81c1f8034)** uses the existing smooth ±70° weight: no seam, no breach.
  - **B's early-sky window (8382bdad6)** is smooth but sized to B's frame (finding 6): a should-fix.
  - Both are panorama edits at infinity, which the ledger allows.
- **Staging:** the stages are the same as round 23's, and no stage handler changed. D's settle is 11 s, reaching dusk
  ~0.86. `pageErrors: []`, 59 programs, 30 fps / 33 ms in every shot. The QA screen check was skipped this round
  (process note, finding 7).
- **Still props, frozen poses:** none new.
  - The hold is one idle pose (`LOOP`) in all twelve shots.
  - The cookfire moved in the caravan's own frame and is a real prop, visible from every side.
- **The walk-test file `progress/physics/sd-r24-b-musrfqm6.json`: verified on the new terrain.**
  - **When it ran:** the build id decodes to 19:03:37 UTC, the file's date is 19:03:46 UTC, and 7db2a5a26 was
    committed at 19:06:52 UTC.
  - **Where it walked:** the caravan → well leg crosses the changed south end for 121 frames. On those cells the
    walker's y is a median 0.03 m above the new heights and 0.80 m above the old ones.
  - **The result:** 7 legs, all `stuck: []`, 0 air, slide or swim frames, and `walkErrors: []`.
  - No leg passes D's stand, but it is 25 m from the spawn on a 14.6° slope, well under the 40° climb.

No score is voided.

SCORE signal-dunes: 7.0

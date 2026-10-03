# Round 23, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` (the camera-distance
  rule, the key ruling, the fog ruling, the two rulings after round 22), and round 22's seat A, B and C files.
- The "Signal Dunes, round 23" section of `art/mockup-council/round-23/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1325-8f296fb4/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 22's `20261003-1239-c43b91ce/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of aab0d0a2f, 0add5da36, a1563f4a9 and 8f296fb4b; `layout.ts`, `world/dunes.ts`,
  `look/render.ts`; both baked `terrain.bin` files (0add5da36^ and 0add5da36, which is HEAD's); both `dusk-late.webp`
  files; `progress/physics/sd-r23-b-muspl0kj.json`.

**How I measured:** the same tools and regions as my round-22 file, whose r22 numbers reproduce (A's diagonal 46.2 h 351,
A's row-demeaned r +0.53, dusk-fire +0.25).
- Rec. 709 luma on the decoded JPEGs; **s** = mean (max − min) / max; **h** = hue of the region's mean colour.
- **Row-demeaned r:** the Pearson r of a 10×7 grid of σ-12 luma over the dune band (y 0.36–0.56), each row's mean removed.
- **Warm / lilac / pale share:** warm = hue < 35° or > 350°, s > 0.4, Y > 55; lilac = hue 240–330°; pale = s < 0.4, Y > 70.
- Regions are frame fractions (x left → right, y top → bottom).
- **Coil-free crops:** the bigger coil now covers x 0.10–0.60, y 0.565–0.84 in every view, so every near-sand number
  below either avoids it or says that it includes it.

## The short version

- **The ridge is real, walkable and inside the field's own envelope.** It passes ledger 5's "one world", with one
  should-fix: its south end is a 30–33° cap that reads as a black lens in the aerials and the clip.
- **A's lit face is bright and its hue is right, but it hit the box, not the picture.**
  - The box went 46 → 87 (mockup 97). The hue is h 24 (mockup h 20), but the saturation is 0.47 against 0.65, so the
    face reads pale cream, not amber.
  - The mockup's shaded lee under the diagonal is now lit: 55 against 40 (r22 matched it, 40).
  - The light falls down to the left, where the mockup's diagonal falls down to the right. The band's r went *down*,
    +0.53 → +0.47.
- **Dusk-fire's light pattern is the best yet:** r +0.57 (r22 +0.25), and its left is warm (68 % warm-lit against the
  mockup's 60 %). But the right half is a dark lilac slip face, 27–30 against the mockup's 42–58, and the saddle fell to
  30.9 h 326 (mockup 49.5 h 13).
- **D's sky ruling is met.** The late painting's window edges are gone (the largest red step per 3° of heading near the
  old edges went 40 → under 4), and the clip's sky seam is gone.
- **The new hold is the right size in A, B and C, but it sits about 0.2 of the frame too far left in all five views.**
  In C its top arc now covers the brazier's plinth and pool. D and dusk-fire hang a small loop on the right; they got a
  big lasso on the left.
- **The late facing term (×0.25) is legal, and it bought little.** D's land median only went 39.4 → 37.3 (mockup 12.8),
  but the clip's late ground now has near-black blots: p5 3.4, against 16.4 in r22. Should-fix.
- **No breach, no void.**

## Measurements (mockup / r22 / r23)

| View | Region | Mockup | r22 | r23 |
|---|---|---|---|---|
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7 h 20 s 0.65** | 46.2 h 351 s 0.35 | **86.8 h 24 s 0.47** |
| A | Tower mound, x 0.45–0.75, y 0.38–0.42 | 73.1 h 15 | 42.6 h 334 | 60.8 h 11 |
| A | Mid dunes right, x 0.55–1, y 0.38–0.47 | 60.8 h 11 | 50.2 h 2 | 64.1 h 17 |
| A | Left lee, x 0–0.3, y 0.40–0.50 | **39.6** h 309 | 40.3 | **54.7** h 8 |
| A | Band mean, y 0.36–0.56 | 55.9 | 51.2 | 67.2 |
| A | Row-demeaned r (y 0.36–0.56; 0.38–0.52; 0.34–0.60) | | +0.53; +0.32; +0.48 | **+0.47; +0.29; +0.43** |
| A | Warm / lilac / pale share, band left; right | 34/41/1; 25/59/0 % | 28/40/8; 31/43/0 % | **57/17/12; 52/30/1 %** |
| A | Near floor x 0.05–0.4, y 0.62–0.75 (**coil inside**) | 62.8 | 81.8 (coil 0 %) | 67.3 (coil 20 %) |
| A | Same, sand pixels only (Y ≥ 40) | 69.0 | 82.1 | **79.9** |
| A | Coil-free sand: x 0–0.08, y 0.62–0.80 / x 0.65–0.95, y 0.58–0.66 | 59.7 / 75.2 | 78.9 / 70.4 | 78.3 / 61.4 |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 h 22 s 0.70 | 76.1 h 15 | 72.0 h 22 s 0.58 |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 h 13 | 39.8 h 347 | **30.9 h 326** |
| dusk-fire | Mid dunes left, x 0–0.45, y 0.40–0.50 | 62.5 h 18 | 40.8 h 342 | 82.9 h 24 |
| dusk-fire | Row-demeaned r (three bands) | | +0.25; +0.09; +0.03 | **+0.57; +0.46; +0.33** |
| dusk-fire | Warm / lilac share, band left; right | 60/12; 33/26 % | 24/42; 26/56 % | 68/11; **23/61 %** |
| dusk-fire | Grid columns 6–9, rows 3–6 (the right half) | 41–64 | | **26–33** |
| dusk-fire | Sky above the horizon / upper sky sat | 96.8 / 0.24 | 113.2 / 0.54 | 113.1 / 0.53 (unchanged) |
| B | Glow band left / right, y 0.40–0.45 | 105.8 / 94.7 | 91.3 / 67.9 | 90.9 / 67.7 |
| B | Wagon front | 45.7 h 17 | 44.8 h 8 | **48.2 h 16** |
| B | Lantern pool, x 0.40–0.56, y 0.515–0.54 | 56.9 h 14 | 56.9 h 2 | **58.6 h 11** |
| B | Backdrop right, x 0.7–1, y 0.44–0.48 | 17.2 | 37.9 | 37.5 |
| B | Mid sky | 59.9 h 258 | 55.9 h 297 | 55.1 h 293 |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 33.7 | 31.7 |
| C | Dune behind the brazier | 41.0 h 358 | 37.4 h 347 | 35.6 h 346 |
| C | Ground right, x 0.55–0.95, y 0.60–0.70 | 33.7 | 52.6 | 50.6 |
| C | Coil-free ground right, x 0.65–0.95, y 0.58–0.66 | 34.1 | 61.7 | 59.6 |
| C | Low sky right | 85.3 h 320 | 61.9 h 285 | 61.9 h 285 |
| D | Land, x 0–0.5, y 0.52–0.62 | 16.0 | 42.7 | 37.2 |
| D | Far land right, x 0.5–1, y 0.50–0.58 | 23.0 s 0.53 | 28.0 s 0.38 | **21.5 s 0.54** |
| D | Land rows y 0.50–0.70, per 2 % (x 0–0.5) | 56 16 16 19 16 13 20 60 54 48 (sd 18.8) | sd 4.4 | 30 35 35 39 37 40 41 41 40 40 (sd 3.2) |
| D | Land p5 / p50 / p95, y 0.50–0.62 | 10.6 / 12.8 / 93.7 | 12.7 / 39.4 / 50.8 | **4.3** / 37.3 / 50.4 |
| D | Rows 30–36 % / 36–42 % | 57.9 h 249 / 70.9 h 279 | 55.7 / 75.2 | 55.6 / 74.9 (unchanged) |
| Late clip | Ground y 0.55–0.90, s 1 … 10: mean; p5 | | 32.7 … 25.5; 20.9 … 17.4 | 27.9 … **19.9; 7.4 … 3.4** |
| Late clip | Far band y 0.22–0.30, s 1 … 10 | | 29.9 … 33.5 | 28.8 … 32.8 |
| Late clip | Top-sky red step per 1/12 column, s 4–6 | | 15, 19, 23 | **6, 8, 13** |

**Pixels changed r22 → r23** (|ΔY| > 8): A 19.0 %, dusk-fire 18.7 %, B 4.1 %, C 6.7 %, D 7.1 %; first-frame and h1
17.9 %, h2 4.6 %, h3 4.1 %, h4 4.4 %, aerial-spawn 8.0 %, aerial-overview 1.6 %.
- Outside the spawn's views, nothing regressed except the hold. h2–h4 land bands moved under 1.2.
- The spawn's land band rose 70 → 82, from the ridge.

**The light pattern, made visible.** These are the dune band's grids (y 0.36–0.56, 10 columns × 7 rows, luma).
- **Mockup A:** the bright cells step down to the right: row 1, cols 3–5 (91–101); row 2, cols 5–6 (103, 96); row 3,
  cols 6–7 (90, 84); row 4, col 8 (68). Under them, rows 3–4 cols 0–5 are a shaded lee at 36–46.
- **Game A:** the bright cells widen down to the *left*: row 3, cols 2–6 (81–103); row 4, cols 1–5 (88–107); row 5,
  cols 0–4 (88–110). The shade sits at cols 8–9 (26–36).
- So the lit window was filled by a lit slab, and the slab also lit the mockup's lee.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.6** | 1. **The right half is a dark lilac slip face (x 0.55–1, y 0.42–0.60). New, from the ridge.** The grid's right half is 26–33, where the mockup's is 41–64. The saddle is 30.9 h 326 against 49.5 h 13, and the band right is 61 % lilac against 26 %. The left is now warm and lit (68 % warm, mid dunes 83 h 24 against 62.5 h 18, a little hot), and the pattern r is the shard's best (+0.57). 2. **The sky (y 0.05–0.36). Repeated, untouched.** Navy at s 0.53 against a grey dusk at 0.24, over a hot band (113 against 97). The big ray over the tower is absent. 3. **The hold (x 0.10–0.60, y 0.565–0.84). Regressed.** The mockup hangs one slack loop centre-right (x 0.38–0.75). Ours is a big double lasso on the left, the fist at x 0.6–0.85. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.7** | 1. **The diagonal is now a pale slab, falling the wrong way (x 0–0.8, y 0.40–0.60). Changed.** The box value is nearly there (86.8 h 24 against 96.7 h 20). But the face is cream (s 0.47 against 0.65; 12 % pale pixels on the left, against 1 %). It widens down to the left and lights the mockup's lee (55 against 40). The mockup's stripe falls to the right over that shade. r +0.47 (r22 +0.53). 2. **The far strip, the floor and the right shade (y 0.37–0.40; x 0–0.08, y 0.62–0.80; x 0.75–1, y 0.47–0.62). Repeated.** The far strip is 78 / 51 against 71 / 43. The coil-free near sand is 78 against 60. The dark wedge at the right edge is where the mockup's lit diagonal runs out (68 there). 3. **The hold (x 0.10–0.60, y 0.565–0.84). Closer in size, wrong place.** It has two coils about 0.5 wide, as in the mockup, but centred at x 0.35 against the mockup's 0.55, with the fist further right. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **7.0** | 1. **The low glow band (x 0–1, y 0.40–0.45). Repeated, unchanged.** 91 / 68 against 106 / 95. 2. **The camp (x 0.4–0.8, y 0.1–0.55). Partly fixed.** The lantern pool is amber at last (58.6 h 11 against 56.9 h 14), and the wagon front is h 16 against 17. The wisp still rises at x 0.71 against 0.53 (row 7 landed after this capture). The backdrop right is 37.5 against 17.2. 3. **The sky and the hold. Repeated.** Pink cloud streaks (h 293 against 258). The coils are the right size but sit about 0.2 left of the mockup's (x 0.33–0.85). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.4** | 1. **The hold now covers the brazier's foot (x 0.10–0.60, y 0.565–0.84). Regression.** The coil's top arc runs across the plinth (y 0.57–0.60), and its ring frames the fire's ground pool. In the mockup the plinth and pool stand clear, with the coils below-right (x 0.35–0.9, y 0.62–0.95). 2. **The open ground is lit flat and bright (x 0.55–0.95, y 0.58–0.70). Repeated.** It is 50.6 against 33.7 (coil-free 59.6 against 34.1), and the far land is 31.7 against 16.1. 3. **The fire, smoke and low sky (x 0.2–1, y 0–0.5). Repeated.** The tongues are smooth, the smoke is a column, and the low sky right is 61.9 h 285 against 85.3 h 320. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.8** | 1. **The land is a smooth lit ramp, not bands (x 0–0.5, y 0.50–0.70). Repeated, slightly better.** The row sd is 3.2 against 18.8. The land median is 37 against 13. Only the far right now matches: 21.5 s 0.54 against 23.0 s 0.53. 2. **The hold (x 0.10–0.60, y 0.565–0.84). Regressed.** The mockup's two or three slim loops hang vertically on the right (x 0.6–0.85). Ours is a big lasso on the left that covers a third of the land. 3. **The horizon glow (x 0–0.7, y 0.44–0.50). Repeated.** It peaks at 126 against 166, and sits higher. The sky is unchanged, and the seam is fixed. |

**Seat score, Signal Dunes: (6.6 + 6.7 + 7.0 + 7.4 + 6.8) / 5 = 6.90, so 6.9.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3,
  6.6, 6.7, 6.6, 6.8.
- Up 0.06 from round 22. The spawn pair gained: they are lit and warm at last, and dusk-fire's pattern is the best yet.
  B's camp colour gained too.
- The new hold took about as much back, from C, D and dusk-fire.
- What holds the shard under 7.0:
  - A's light is a slab, not a stripe over shade;
  - dusk-fire's right half is in shadow;
  - D's land has no bands;
  - the skies of dusk-fire, B and C are untouched.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| A's diagonal 46.3 → 86.9 h 24 | **True** | 46.2 h 351 → 86.8 h 24. But see finding 1: the box filled, and the pattern r fell. |
| A's lee 32.7 → 47.5 (mockup 42.5) | **Moved away on my window** | My left lee: 40.3 → 54.7 (mockup 39.6). In r22 it matched. |
| A's near ground 71.6 → 60.5 (mockup 57.1) | **Not supported: it is the coil** | On my window it went 81.8 → 67.3, but 20 % of that window is now coil (Y < 40; 0 % in r22). The sand pixels alone are 82.1 → 79.9. The coil-free left strip is 78.9 → 78.3. This repeats the round-8 / round-10 coil-in-crop error. |
| Dusk-fire's shoulder 74.2, saddle 30.9 (worse) | **True, and honestly stated** | 72.0 h 22; 30.9 h 326. |
| Row-mean-removed r: dusk-fire +0.56, A +0.47 | **True** | +0.57 / +0.47. A's is down from +0.53 in r22, which the README doesn't say. |
| "h1 and both aerials checked: real dunes, shadow pools of the same kind as before" | **Mostly** | Real dunes, yes. But the ridge's south cap adds a new isolated black lens in aerial-overview (x 0.55–0.70, y 0.65) and in the clip (s 1–4, y 0.55–0.65). The field's pools are long crescents; this one is short and steep. See the audit. |
| Walk test 7 legs, 0 stuck, on the new terrain | **True** | See the audit. |
| Row 4: the late shift full within ±10°, easing to none by ±70°; largest red step per 3° 21.2 → 3.7 | **True** | `wh = ease((70 − dh) / 60)`. The paintings differ only at headings 270–20 (mean \|Δ\| ≤ 5). Near the old edges the largest red step per 3° went 40.4 → under 4. Steps of 16–22 remain at rows 480–540, headings 12 and 48. Those are the painting's own range edges and were there before. Clip top-sky steps at s 4–6: 15 / 19 / 23 → 6 / 8 / 13. |
| Row 2: D's land 37.1 → 35.0, C's far band 35.3 → 31.1 | **True in direction** | My D land 42.7 → 37.2 (across the whole batch); C 33.7 → 31.7. |
| B's lantern pool h 3 → h 11 | **True** | h 2 → h 11, 58.6 (mockup h 14, 56.9). |
| The hold: two coils ~0.5 wide, tops 0.57–0.60 in A, B, C | **True as measured; misplaced** | The coil spans x 0.10–0.60 with its top at y 0.565 in every view. The mockups' A, B and C coils are centred about 0.2 further right. |
| The README's commit list | **Complete** | `git log c43b91ce..8f296fb4b` over the shard's source, assets, baked terrain and sky prep lists exactly the four commits named. Round 22's process item is closed. |

## Findings, ranked by score gained

1. **A's light: a stripe over shade, not a slab (A x 0–0.8, y 0.40–0.60).** *Changed: the box is fixed, the pattern is
   not.*
   - The ridge lights the mockup's lee (55 against 40). Its lit face widens down to the left where the mockup's falls
     to the right, and it is pale (s 0.47 against 0.65).
   - **Fix:**
     - Narrow the lit flank so the shade returns under it on the left: the ridge's west face at x 0–0.5, y 0.45–0.55
       should read as the lee.
     - Warm the key-lit sand's saturation at dusk 0 (row 6, 5d0be40ff, is after this capture; measure it on this window).
   - **Accept:**
     - A's left lee ≤ 45 while the box stays ≥ 80.
     - The band r ≥ +0.55.
     - The lit quarter s ≥ 0.55 at h 15–25.
     - The pale share on the left ≤ 4 %.
2. **The hold: move it right, and keep the frame's subjects clear (all five, x 0.10–0.60, y 0.565–0.84).** *Size closer
   in A, B and C; placement regressed in C, D and dusk-fire.*
   - **Fix:**
     - Swing the coil about 0.2 of the frame right and about 0.05 down. It should hang from and below the fist, as all
       five mockups draw it, not rise up-left like a lasso.
     - Keep one pose for every view.
   - **Accept:**
     - The coil centred at x 0.50–0.60, its top ≥ y 0.60.
     - C's plinth (x 0.40–0.52, y 0.565–0.60) clear of cord.
3. **Dusk-fire's right half (x 0.55–1, y 0.42–0.60).** *New, from the ridge.*
   - The ridge's west slip face and the tower dune's shade put the right half at 26–33 against 41–64, and lilac.
   - **Fix:** the same move as finding 1. Pulling the ridge's lit flank back toward the spawn's right lets the tower
     dune's warm face show again on the right. Don't brighten it from the fill.
   - **Accept:** the saddle ≥ 42 at h 5–20, with r ≥ +0.50.
4. **D's land bands (D x 0–0.5, y 0.50–0.70).** *Repeated.*
   - The ×0.25 facing term moved the median 2 points and created near-black blots elsewhere (finding 6).
   - The builder is right that this needs landform: one or two low transverse rims across D's view, on the waymark
     rise's own downslope, built like the field's crescents and not placed by D's frame edges.
   - **Accept:** the row sd ≥ 10, and the land median ≤ 28.
5. **B's glow band and C's open ground.** *Repeated, untouched this round.*
   - B's glow band is 91 / 68 against 106 / 95. C's ground right is 51 against 34.
   - The fixes are in round 22's file (findings 3 and 4).
6. **The late facing term's black blots.** *New regression, outside the scored views.*
   - The clip's late ground p5 went 16.4 → 3.4. That is darker than any mockup's darkest land (D's p5 10.6).
   - **Fix:** floor the term at about ×0.45 on the indirect, or cut the direct only.
   - **Accept:** the clip's p5 ≥ 10 at s 6–10.
7. **Process.** Quote coil-free near-sand numbers (A's "near ground 60.5" is the coil). Say when a pattern r goes down
   (A +0.53 → +0.47).

## Ledger-5 audit

- **The ridge (0add5da36): one world, no breach. One should-fix: its end cap.** I checked it on the baked heightfield,
  not just in frames.
  - **What changed.** The terrain differs from round 22 only over x −34…48, z −48…56, about 4 700 m². The heights there
    rose by up to 9.6 m, 3.0 m on average. The second crest was replaced by a ridge from (11.6, 54.4) at 20.8 m, through
    (−3.6, −6) at 18.8 m, to (−34.3, −11.8) at 16.4 m.
  - **Real and walkable.** It is baked terrain, and the navmesh was re-baked.
    - Its steepest cell is 33.3°, under the field's own 39.1°.
    - The playable area's slope distribution is unchanged: p50 10.0 / p90 24.3 / p99 34.0, with 2.97 → 3.02 % of cells
      over 30°.
    - The height p95 is 19.9 → 20.0. The crest's 16–21 m sits in the field's normal range (max 26.5).
  - **The field's grammar.**
    - The field's crests run across the wind (`WIND` −0.643, 0.766). The ridge's two segments are 36° and 29° off that
      transverse line.
    - Its west slip face (26–32°, downhill −0.97, 0.25) is 36° off downwind.
    - The field's steep faces split 50 % within 30° of downwind and 25 % facing upwind. Adding the ridge leaves that
      split at 49 / 25 %.
    - Cross-sections show a crest with a ~30° west face and a gentler east face, the field's own shape.
  - **One world, not a set piece.** The ridge was placed and shaped from one camera position: A, dusk-fire, h1 and
    first-frame all stand at (0, 23.05, 70). No other hero view sees it. But it obeys the same profile, slope and aspect
    rules as the rest of the field. In aerial-spawn it reads as one more long dune with a shaded west flank. This is the
    same standing should-fix as rounds 12–13 ("placed by A's frame"), not a breach.
  - **The should-fix: the south end cap.** The ridge ends 16–25 m in front of the spawn with `fade: 0.1`. That makes a
    blunt 26–33° cap over x 9–32, z 42–50, facing south-south-east (downhill 0.5, 0.86, 70° off downwind) and away from
    the key.
    - In aerial-overview and in the clip (s 1–4) it is a short, black, lens-shaped pool. The field's slip faces are long
      crescents, so this one reads as a hole.
    - **Fix:** fade the ridge's south end over ≥ 0.3 of its length into the spawn crest, as the first crest does.
- **Camera-distance terms: none.**
  - 8f296fb4b's `away` term is `smoothstep(uDusk) × f(dot(N.xz, glowXZ)) × g(|N.xz|)`: the normal, a world direction and
    the global dusk. It has no `cameraPosition` and no `sandFar`.
  - aab0d0a2f's lamp / fire tint switches on the light's own gain (`step(0.5, w)`), the same at every lantern and
    waymark.
  - `sandFar` and the fog lines are unchanged since round 22.
- **The fog: unchanged, no breach.** The late clip's far band climbs 28.8 → 32.8 while the ground falls. Nothing moves
  toward black through the fog.
- **The late facing term: legal under the round-16 rule, but a "no narrowing" should-fix.** It darkens by facing. It
  bought D 2 points and pushed the clip's late ground p5 to 3.4 (r22 16.4) and D's own p5 to 4.3 (mockup 10.6). That
  is near-black blotching in real play, outside the scored views (finding 6).
- **D's sky (a1563f4a9): the round-22 ruling is met.** The shift eases over ±70° with no edge in any frame. The window
  was cut to D's heading and is now a broad, smooth falloff; the clip shows no seam.
- **Global grade and metric gaming.**
  - No LUT. The saturation change (2.5 → 1.6) is a global material constant, not a grade.
  - A's lit box was the accept window I set in round 22, and it was met. But the pixels show it met by lighting a slab
    that also fills the mockup's lee, and the pattern r went down. That is a likeness gap, scored as one (finding 1),
    not a breach.
  - The README's near-ground gain is the coil. That is a claim error, not a shortcut.
- **The views and the staging:** `cameras`, `camAt` and `staged` are identical to round 22's, and the stage handlers are
  untouched. No QA retakes, `pageErrors: []`, 59 programs, 30 fps / 33 ms in every shot.
- **Still props and frozen poses:** none new. The hold is one idle pose in all twelve shots.
- **The walk-test file `progress/physics/sd-r23-b-muspl0kj.json`: verified on the new terrain.**
  - The build id decodes to 18:11:44 UTC, four minutes before 0add5da36 was committed.
  - The traces prove it walked the new ground. On the cells the ridge changed, the walkers' y is a median 0.02–0.03 m
    above the new heights, and 1.1–2.9 m above the old ones.
  - The east → west waymark leg crosses the ridge for 287 frames.
  - All 7 legs have `stuck: []`, 0 air, slide or swim frames, and `walkErrors: []`.

No score is voided.

SCORE signal-dunes: 6.9

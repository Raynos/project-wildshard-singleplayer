# Round 22, seat C (Claude, red team), Signal Dunes

**What I reviewed:**
- `docs/process/COUNCIL.md`, the ledger (the 7.0 bar, the phase amendments), the brief, `scores.md` (the camera-distance
  rule, the key ruling, the fog ruling), and round 21's seat A, B and C files.
- The "Signal Dunes, round 22" section of `art/mockup-council/round-22/README.md` and its five sheets.
- Every frame in `progress/sunscar-dunes/20261003-1239-c43b91ce/` (`mock-*`, `first-frame`, h1–h4, both aerials,
  `clip.mp4` at 1 fps, `meta.json`), each against round 21's `20261003-1206-21fe6dbf/`.
- The five ledger mockups, Lanczos-scaled to 780×1688.
- Source, read-only: `git show` of 02cc4e1ba, 2fcdd4696, 080a1267d and the engine's 69b3f0b8a; `look/render.ts`,
  `look/painted.ts`, `look/sky.ts` and `look/dusk.ts` at c43b91cef; the engine's fog chunk (`Atmosphere.ts`), the ridge
  haze (`Horizon.ts`) and `skyRig.setKeyLight`; `dusk-late.webp` at both shas; `progress/physics/sd-r22-b-muso9wjb.json`.

**How I measured:** the same tools and regions as my round-21 file, and its r21 numbers reproduce exactly (A's lit
diagonal 64.4, A's row-demeaned r +0.58, dusk-fire +0.10, C's core 2 086 → my r21 column below).
- Rec. 709 luma on the decoded JPEGs; **sat** = mean (max − min) / max; **h** = hue of the region's mean colour;
  **B/R** = mean blue over mean red.
- **Row-demeaned r:** the Pearson r of a 10×7 grid of σ-12 luma over the dune band (y 0.36–0.56), each row's mean removed.
- **Warm-lit share:** pixels with hue < 35° or > 350°, sat > 0.4 and Y > 55. **Lilac share:** hue 240–330°.
- **Lit quarter:** the brightest 25 % of the band y 0.36–0.56 (the builder's hue check).
- Regions are frame fractions (x left → right, y top → bottom). Headings: 0 = the spawn's forward (−z), 90 = +x; the
  portrait frame spans ±18.6° of heading.

## The short version

- **The lilac wash is gone, and the colour moved back toward the mockups in all five views.** This is mostly round 21's
  fog regression undone, not new likeness.
  - A's warm-lit share in the band is 28 / 31 % (left / right; mockup 35 / 26; r21 12 / 11). Dusk-fire's is 24 / 26 %
    (mockup 60 / 33; r21 11 / 11).
  - A's mid dunes right are h 2, B/R 0.56 (mockup h 11, 0.53; r21 h 325, 0.87).
  - C's dune behind the brazier is 37.4 at h 347 (mockup 41.0 at h 358; r21 59.0 at h 284). That is the dark ridge back.
  - The late clip's ground is 25–33 (r21 50–53, r20 24–31). The aerial overview's land is 51 (r21 86).
- **D's sky is the real new gain.** The magenta streaks are gone. Rows 30–36 % measure 59, 49, 101 (mockup 60, 52, 100),
  and the mid sky is 76 at h 306 (mockup 72 at h 281; r21 91 at h 340).
- **What the wash had hidden is now plain.** A's lit diagonal box fell to 46.2, back to round 20's 48.7 (mockup 96.7). Its
  hue is h 351, pink-red, where the mockup's is h 20, amber. A and dusk-fire's mid bands are now darker than the mockups'
  and still pink, not amber.
- **Ledger 5: no breach, no void, one should-fix.** D's sky edit is world-space (no camera term), but it is placed by D's
  frame edges. It cuts a 50°-wide window (headings 316–6) into the late panorama, and its two edges show as a moving
  vertical seam in `clip.mp4`. The fog thins with the dusk, never thickens, and does not go toward black.
- **The walk-test file checks out:** 7 legs, 0 stuck, on the round-21 terrain.

## Measurements (mockup / r21 / r22)

| View | Region | Mockup | r21 | r22 |
|---|---|---|---|---|
| A | Lit diagonal, x 0.4–0.7, y 0.40–0.44 | **96.7** h 20 | 64.4 h 312 | **46.2 h 351**, B/R 0.70 |
| A | Tower mound, x 0.45–0.75, y 0.38–0.42 | 73.1 h 15 | 65.6 h 285 | 42.6 h 334 |
| A | Mid dunes right, x 0.55–1, y 0.38–0.47 | 60.8 h 11, B/R 0.53 | 66.8 h 325, 0.87 | **50.2 h 2, 0.56** |
| A | Left lee, x 0–0.3, y 0.40–0.50 | 39.6 | 52.8 | 40.3 |
| A | Far strip left / right | 71.7 / 38.2 | 100.3 / 70.3 | 89.3 / 52.3 (h 15 / 1) |
| A | Near floor, x 0.05–0.4, y 0.62–0.75 | 62.8 | 82.5 | 81.8 |
| A | Warm-lit / lilac share, band left; right | 35 / 45; 26 / 59 % | 12 / 60; 11 / 61 % | **28 / 41; 31 / 43 %** |
| A | Row-demeaned r (y 0.36–0.56; 0.38–0.52; 0.34–0.60) | | +0.58; +0.42; +0.49 | +0.53; +0.32; +0.48 |
| A | Lit quarter | h 20, s 0.66, 101 | h 5, s 0.36, 94 | h 18, s 0.48, 89 |
| dusk-fire | Lit shoulder, x 0–0.35, y 0.50–0.70 | 82.9 h 22, sat 0.70 | 79.6 h 11 | 76.1 h 15, sat 0.54 |
| dusk-fire | Saddle, x 0.55–0.9, y 0.46–0.56 | 49.5 h 13 | 55.1 h 305 | **39.8 h 347** |
| dusk-fire | Mid dunes left, x 0–0.45, y 0.40–0.50 | 62.5 h 18 | 54.8 h 307 | **40.8 h 342** |
| dusk-fire | Far strip right, x 0.6–1, y 0.37–0.40 | 34.5 | 64.8 | 47.8 |
| dusk-fire | Warm-lit / lilac share, band left | 60 / 12 % | 11 / 70 % | 24 / 44 % |
| dusk-fire | Row-demeaned r (three bands) | | +0.10; −0.12; −0.01 | **+0.25**; +0.09; +0.04 |
| dusk-fire | Sky above the horizon / upper sky sat | 103.6 / 0.20 | 122.0 / 0.54 | 120.5 / 0.54 |
| B | Glow band left / right (y 0.40–0.45) | 111.1 h 12 / 136.1 h 18 | 89.5 / 94.4 | 89.5 / **88.9** |
| B | Land left of camp / backdrop right | 41.2 h 8 / 17.7 | 47.4 h 326 / 44.5 | **39.1 h 352** / 34.5 |
| B | Wagon front, x 0.48–0.62, y 0.47–0.52 | 45.7 h 17, sat 0.71 | 51.0 h 357 | 44.8 h 8, sat 0.78 |
| B | Lantern pool, x 0.40–0.56, y 0.515–0.54 | 56.9 h 14 | 60.3 h 356 | 56.9 **h 2** |
| B | Mid sky, x 0.05–0.95, y 0.25–0.38 | 59.9 h 258 | 56.0 h 298 | 55.9 h 297 (unchanged) |
| C | Upper-left sky, x 0.02–0.3, y 0.10–0.30 | 43.5, sat 0.38 | 36.5, sat 0.52 | 35.3, sat 0.53 |
| C | Flame box over 150 / 230 / 245 | 13 804 / 5 557 / 2 732 | 11 913 / 4 086 / 2 086 | 12 423 / 4 087 / 1 976 |
| C | Far land, x 0.6–0.9, y 0.48–0.53 | 16.1 | 55.6 h 280 | **33.7 h 350** |
| C | Dune behind the brazier, x 0.55–1, y 0.45–0.49 | 41.0 h 358 | 59.0 h 284 | **37.4 h 347** |
| C | Ground right, x 0.55–0.95, y 0.60–0.70 | 33.7 | 59.5 | 52.6 |
| C | Near sand, x 0.05–0.4, y 0.58–0.66 | 66.4 h 17, sat 0.75 | 83.6 | 73.7 h 7, sat 0.61 |
| C | Low sky right, x 0.6–1, y 0.38–0.44 | 85.3 h 320 | 62.5 h 284 | 61.9 h 285 |
| D | Land, x 0–0.5, y 0.52–0.62 | 16.0 | 49.9 | **42.7** |
| D | Far land right, x 0.5–1, y 0.50–0.58 | 23.0 | 50.0, B/R 1.20 | **28.0, B/R 0.79** |
| D | Mid sky, x 0.05–0.95, y 0.34–0.44 | 72.1 h 281 | 90.9 h 340 | **76.0 h 306** |
| D | Rows 30–36 % / 36–42 % (RGB) | 60,52,100 / 88,62,103 | 97,55,101 / 153,70,98 | 59,49,101 / 101,64,98 |
| D | Glow line (brightest row, x 0–0.7) | y 0.497, 166 | y 0.454, 129 | y 0.454, **126** (168,108,92) |
| Late clip | Ground y 0.55–0.90, s 1 … 10 | | 50.6 … 50.0 | **30.9 … 24.8** |
| Late clip | Far band y 0.22–0.30, s 1 … 10 | | 53.7 … 72.4 | 28.9 … 32.4 |
| aerial-overview | Land y 0.35–0.60 | | 85.5 | 51.0 |

**Pixels changed r21 → r22** (|ΔY| > 8): A 14.8 %, dusk-fire 16.9 %, B 3.3 %, C 16.8 %, D 23.5 %; first-frame 15.3 %,
h1 15.3 %, h2 2.7 %, h3 11.2 %, h4 12.0 %, aerial-spawn 81 %, aerial-overview 94 %. Every land band y 0.35–0.60 got
darker, by −0.2 (h3) to −34.6 (overview).

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **6.4** | 1. **The mid band is dark and pink, not amber (x 0–1, y 0.40–0.56). Repeated; the lilac is gone.** The saddle is 39.8 at h 347 (mockup 49.5 at h 13), and the mid dunes left are 40.8 at h 342 (mockup 62.5 at h 18). The warm-lit share is 24 % against 60 %. The light pattern partly recovered: r +0.25 (r21 +0.10, r20 +0.38). 2. **The sky (y 0.05–0.36). Repeated.** It is saturated navy (sat 0.54 against 0.20) over a hot band (120.5 against 103.6), and the mockup's big ray over the tower is missing. 3. **The hold (x 0.35–0.85, y 0.62–0.86). Unchanged.** It is a closed braided ring, where the mockup's loop is slack and open, with the cord running off the frame. |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **6.5** | 1. **No lit amber diagonal (x 0.3–0.8, y 0.38–0.46). Repeated since round 9; the wash had hidden it.** The diagonal box is 46.2 at h 351 against 96.7 at h 20, and the tower mound is 42.6 against 73.1. The colour is right only on the right-hand dunes (h 2, B/R 0.56) and the lit crest tops. The form is still right (r +0.53). 2. **The far strip and the floor (y 0.37–0.41; x 0.05–0.4, y 0.62–0.75). Repeated.** The far strip is 89 / 52 against 72 / 38. The ranges are a dark silhouette where the mockup's are pale blue-grey. The near floor is 81.8 against 62.8. 3. **The hold (x 0.4–1, y 0.66–0.88). Unchanged.** It is one ring where the mockup has two broad coils, and the small ray at x 0.27, y 0.28 is still not in the mockup. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.9** | 1. **The low glow band (x 0–1, y 0.40–0.46). Repeated, slightly worse on the right.** It is 89.5 / 88.9 against 111 / 136 (r21 right 94.4). The darker fog colour feeds the ridge haze (`Horizon.ts` 161 mixes `fogColor` at 0.85), so the ranges and the band under them dimmed (dY −5 to −10 at x 0.4–1). 2. **The camp's light and smoke (x 0.4–0.8, y 0.1–0.55). Repeated, partly fixed.** The pool is still red (h 2 against 14), and it reads as a red patch under the crosshair. The plume still rises at x 0.71 against the mockup's 0.53. The land is better: left 39.1 at h 352 (mockup 41.2 at h 8); the backdrop right is 34.5 against 17.7. 3. **The sky and the hold. Repeated.** Pink cloud streaks cross the mid sky (h 297 against 258; B shows only 16 % of the late painting, so the ±25° averaging barely reached it). One ring where the mockup has two coils. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **7.6** | 1. **The open ground is lit flat and bright (x 0.05–0.95, y 0.58–0.75). Repeated, improved.** The ground right is 52.6 against 33.7, and the near sand 73.7 at h 7 against 66.4 at h 17, sat 0.61 against 0.75. The mockup's sand goes dark beyond the fire's pool. 2. **The fire and smoke (x 0.2–0.6, y 0–0.5). Repeated.** The core is 1 976 against 2 732, and the tongues are orange. The smoke still rises as a column where the mockup's billows up-left with the sparks, and the logs don't read. 3. **The low sky right (x 0.6–1, y 0.38–0.44). Repeated.** It is a magenta band (61.9 at h 285) where the mockup's is a paler mauve (85.3 at h 320). The gain this round is the dune behind the fire: dark again (37.4 at h 347 against 41.0 at h 358), so the fire stands out from it as in the mockup. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **6.8** | 1. **The land is a lit mauve dune field (x 0–1, y 0.50–0.72). Repeated, improved.** It is 42.7 against 16; the far right is 28 against 23 (r21 50). The mockup's land is near-black, with flat transverse bands. 2. **The horizon glow (x 0–0.7, y 0.44–0.50). Repeated.** The peak is 126 against 166 (r21 129), and it sits at y 0.454 against 0.497. The hue is now peach, a gain. The window's eased edge tints the left edge pinker (x 0–0.05: h 326 against 296). 3. **The hold (x 0.4–1, y 0.60–0.86). Unchanged.** It is one stiff ring where the mockup has two or three slack loops hanging vertically. The gain this round is the sky: a clean violet gradient, rows 30–36 % within 1–3 of the mockup. |

**Seat score, Signal Dunes: (6.4 + 6.5 + 6.9 + 7.6 + 6.8) / 5 = 6.84, so 6.8.**
- This seat's earlier scores: 4.6, 5.1, 4.9, 5.2, 5.6, 5.3, 5.7, 6.1, 6.4, 6.4, 6.7, 6.7, 6.5, 6.4, 6.4, 6.3, 6.5, 6.3,
  6.6, 6.7, 6.6.
- Up 0.2 from round 21. About half of it is round 21's fog regression undone (A, dusk-fire, C). The rest is D's sky and C's
  ridge.
- What holds the shard under 7.0 is unchanged since round 9: no amber lit faces in the spawn pair, D's lit land, and the
  one-ring hold in every view.

## Builder claims checked against the pixels

| Claim (README / commits) | Verdict | Evidence |
|---|---|---|
| Fog 0.0013, thinning to a fifth by the blue hour, never thickening | **True** | `fogDist.value = AERIAL_FOG * (1 − 0.8·smoothstep((dusk − 0.3) / 0.45))`, a shared uniform. |
| The colour is one constant, now live (080a1267d + 69b3f0b8a) | **True** | `compose` edits `scene.fog` in place; `update` writes `FOG.color` to `targets.fog`, a live getter. No lerp remains. |
| The colour is "the horizon's darker violet near the ground" | **True as worded, not the ruling's colour** | 0x3e3452 (sRGB Y 56) matches the painting's *below-horizon* band (−4 to −1°: Y 44–83). The horizon sky itself (0 to 3°) is Y 90–154 toward the glow. The comment in `update` still says "the horizon sky's lighter violet-blue" (stale). |
| C's far band 54.6 → 35.5, D's 49.7 → 42.7 | **True** | My regions: C 55.6 → 33.7, D 49.9 → 42.7. |
| A's mid dunes warm, not lilac | **True** | h 2, B/R 0.56 against the mockup's h 11, 0.53. The diagonal box is still h 351. |
| D's rows 30–36 % 59,50,102 and 36–42 % 100,64,100 | **True** | 59,49,101 and 101,64,98. |
| D's glow line "keeps its value", 160,99,89 against the mockup's 160,103,99 | **Hue true, value no** | Its brightest row is 126 (168,108,92), where the mockup's is 166 (213,154,116), lower in the frame. The builder's mockup row isn't the mockup's peak. |
| "B's rows unchanged" | **Nearly** | B's sky rows changed ≤ 1.4 except the right tenth (red −4 at y 0.30–0.40), where the window's eased edge reaches B at its 16 % late blend. B's glow band right fell 5.5, from the fog colour, not the sky. |
| "Toward D's view only" | **True, and that is the problem** | The late painting changed only at headings 316–6: mean |Δ| 17–24 at 0–14° there, ≤ 4 everywhere else. See the audit. |
| C's near sand 63.7 → 57.2 | **The direction is true** | On my region it went 83.6 → 73.7 (mockup 66.4). |
| The walk test: 7 legs, 0 stuck | **True** | See the audit. |
| The builder's hue table | **Reproduces approximately, and it is honest** | Lit quarter: A h 18, s 0.48 (claimed h 20, s 0.51); dusk-fire h 13, s 0.52 (h 16, s 0.56); B h 4 (h 3). It names its own shortfalls. |
| The README's "all shard commits between the captures" | **Incomplete, a repeat of round 21** | It omits 2fcdd4696, which touched only `public/assets/sunscar-dunes/` and `art/`, the same gap round 21 named for f4effe449. The batch list does name it. |

## Findings, ranked by score gained

1. **The spawn pair's lit faces: amber and bright, not pink and dark (A x 0.3–0.8, y 0.38–0.46; dusk-fire x 0–0.9,
   y 0.40–0.56).** *Repeated since round 9; round 21's wash had hidden it.*
   - With the lift gone, A's diagonal is 46.2 at h 351 (mockup 96.7 at h 20) and dusk-fire's mid dunes are 40.8 at h 342
     (62.5 at h 18). The lit quarter's hue is close on A (h 18 against 20), but its saturation and value are short
     (s 0.48 against 0.66).
   - The faces that should catch the key read pink. So the cool fill and the violet fog are still winning over the warm
     key on faces turned toward the key.
   - **Fix:**
     - Raise the key's share against the fill at the early dusk only (`keyAt` / `fillAt` near dusk 0), and keep the lit
       sand's tone amber.
     - Check it on the lit quarter's hue *and* the box's value, never on value alone.
   - **Accept:**
     - A's diagonal box ≥ 75 at h 12–25.
     - Dusk-fire's mid dunes left ≥ 55 at h 10–25.
     - A's warm-lit share holding ≥ 28 / 26 %, and its r ≥ +0.45.
2. **D's land, and the late sky's window (D x 0–1, y 0.50–0.72; the late painting at headings 316–6).**
   *Land repeated; the window is new.*
   - The land is 42.7 against 16.
   - The window (see the audit) shows as a moving seam in the clip.
   - **Fix:**
     - Make the late violet / peach shift a property of the whole late painting. Widen its easing to at least ±30° beyond
       D's frame, or weight it smoothly by the distance in heading from the glow. Its edges should never fall at a frame
       edge.
     - Get D's land down from facing and the existing away-from-key shade on far faces, never from the fog.
   - **Accept:**
     - In `clip.mp4` s 4–6, no 1/12-column step in the top sky row's red over 15. Today it is 163 → 121 → 109.
     - D's rows 30–42 % within 15 of the mockup.
     - D's land ≤ 30.
3. **B's low glow and camp (B x 0–1, y 0.40–0.55).** *Repeated; the glow band right regressed −5.5.*
   - **Fix:**
     - Exempt the point lights from the sand's direct-saturation boost, so the amber lantern lays an amber pool.
     - Move the wisp's source to the wagon's hood or stovepipe.
     - Lift the low glow band at B's heading in the early painting, which is the one B mostly shows.
   - **Accept:**
     - The pool at h 10–20.
     - The plume's peak within x 0.48–0.58.
     - The glow band right ≥ 110.
4. **C's open ground (C x 0.05–0.95, y 0.58–0.75).** *Repeated, improved.*
   - The ground right is 52.6 against 33.7.
   - **Fix:** the fire pool is now right-sized. What lights the ground past it is the late fill, so lower the late hemi
     fill on upward-facing sand rather than the fire.
   - **Accept:** the ground right ≤ 40, with the near pool still ≥ 60.
5. **The hold: two slack loops, not one ring (all five, x 0.35–1, y 0.6–0.88).** *Repeated; the builder didn't address it
   this round.*
   - **Fix:** in the one idle pose, open the ring into two overlapping loops hanging below the fist, with the cord running
     off-frame.
6. **Process.**
   - **The README's commit list.** It must include asset-only shard commits (2fcdd4696; f4effe449 last round).
   - **Quote the mockup's real glow peak.** It is 166 at y 0.497, not the 160 row.
   - **Fix the stale fog comment in `update`.** It says "lighter violet-blue"; the colour is the darker 0x3e3452.

## Ledger-5 audit

- **D's late sky (2fcdd4696): world-space, so no breach. It is placed by D's frame edges and shows as a seam in real
  play: should-fix under "no narrowing". New.**
  - **No per-camera term.** `painted.ts` takes the heading as `atan(d.x, −d.z)` of the dome's own vertex direction
    (`vDir = normalize(position)`). It has no camera position and no per-view uniform, and the edit is baked into
    `dusk-late.webp`. Every player facing 316–6° at a late dusk sees the same pixels.
  - **The window.** The diff of the two late paintings is ≤ 4 everywhere except headings 316–6, where it is 17–24 at
    0–14°. `prep.py` picks the ranges by frames: "D's frame spans ~323–359; B's (303) ends by ~321".
    - Inside, at 6–12°, the hue is h 270–274. Just outside it is h 311–314 (the magenta sky): a 40° hue swing over the
      8° ease.
    - The glow line turns from h 351 to h 7 over the same ease.
    - In the panorama it reads as a blue rectangle cut between two pink sectors.
  - **Do the hero views and aerials hold?** They can't show it. h1, h4, first-frame and both aerials are at the early
    dusk (`wL` 0). h4 faces 341°, inside the window, but sees only the early painting. h3 faces 168°.
  - **The clip does show it.** The camera pans left across 340–0° while the dusk deepens. At s 4–6 the top sky row's
    red falls 163 → 121 → 109 over two to three twelfths of the frame (hue 341 → 317). In round 21 the same rows were
    smooth (150–164).
    - So the edit that made D's frame match left a vertical seam that sweeps through a non-scored real-play view.
    - I score D on its frame and don't void, because the brief allows a world-space edit. The lead may rule the stricter
      reading; under it, D's sky gain goes. Fix: finding 2.
- **The fog: no breach. It thins with the dusk and never goes toward black.**
  - **Density.** It is monotonic, falling from 0.0013 to 0.00026 by dusk 0.75, and global (one uniform, no view input).
  - **Colour.** One constant, now live. The late lerp toward 0x1a1733 is gone.
  - **The ruling's test, measured on the far bands:**
    - The late clip's far band (28.9–32.4) sits at or above its near ground (24.8–33.0) in every frame, and it climbs
      over the clip as the fog thins.
    - C's far land (33.7) and D's (28.0) are above their mockups' (16.1, 23.0).
    - Nothing moves toward black.
    - The thinning *reveals* the land's own lighting. With density at 0 it shows the unfogged surface, which is not a
      cut.
  - **The sun-side tint** (`fogSunColor` × 0.07 late, toward the key at 340°, which is D's heading) is linear luminance
    0.032 against the fog's 0.041, about the same level, at 7.5 % fog at 300 m. That's negligible, not toward black.
  - **One gap against the ruling's words (should-fix, the lead's call).** The ruling asks for the colour "taken from
    the horizon sky", lifting far land "lighter, toward the sky". 0x3e3452 is the painting's below-horizon band, darker
    than the horizon sky at every heading but the anti-glow. At the early dusk's full density it pulls lit far faces down
    a little. The pixels still pass the far-band test.
- **Camera-distance terms: none new.** Between the captures `render.ts` changed only the fog lines and the sand's fire
  term (0.18 → 0.12), and `build.ts` only `WAY_LIGHT` 14 → 9. Both are global constants, the same at every waymark and at
  the lantern. `sandFar` and `fireFx.ts` are unchanged.
- **Landforms:** no terrain change (`public/assets/baked/sunscar-dunes/` untouched), and no landform placed for a frame.
- **The walk-test file: verified.**
  - The build id `b-muso9wjb` decodes to 17:35:05 UTC (12:35 local). That is after 234085dba (12:05), and the terrain
    hasn't changed since.
  - The 7 legs chain end to start: spawn → caravan → well → east waymark → west waymark → tower → north waymark →
    basin. Every leg has `stuck: []`, and there are 0 air, slide or swim frames and `walkErrors: []`.
  - This closes round 21's process item.
- **The view and the staging:** `camAt`, `staged` and the `cameras` blob are identical to round 21's. The stage handlers
  are untouched.
- **Still props and frozen poses:** none. The flame, smoke and sparks animate, and the hold is one idle pose in all twelve
  shots.
- **Global grade and metric gaming:** `lut: null`. Unlike round 21, the builder's luma boxes went *down* (A's diagonal
  64.4 → 46.2). The README quotes hue beside value and names its own shortfalls. I found no gaming in this batch, except
  that the sky window was tuned to D's frame (above).
- **Device and HUD:** 390×844 touch stored 780 wide, the baseline HUD, `pageErrors: []`, no QA retakes, 59 programs. The
  FPS chip reads 30 fps / 33 ms in every shot.

No score is voided.

SCORE signal-dunes: 6.8

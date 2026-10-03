# Round 13, seat B, Sky Reach (Claude, lens: evidence, measured region by region)

2026-10-03. The bar is 7.0 (ledger 4 as Jake amended it). I score the same way regardless.

Surface:
- The Sky Reach section of `art/mockup-council/round-13/README.md` and the five sheets `art/mockup-council/round-13/far-reach-*.jpg`.
- `progress/far-reach/20261003-0719-8512344b/`: every `mock-*`, h1–h4, both aerials, `clip.mp4` (0.5 fps tiles) and `meta.json`.
- Round 12's capture `20261003-0608-591bd5b5`, for before and after.
- The five ledger mockups at full resolution.
- `project/archive/2026-10-03-sky-reach-top10.md` and the row boards' READMEs (`art/far-reach/round-23` to `round-29`).
- `git diff 591bd5b5d 8512344bd -- src/shards/far-reach`, read for `stormRoc.ts`, `skyIsles.ts`, `skyIsleHd.ts`,
  `WarFan.ts` and `isle.ts`. Also read the engine's LUT path (`world/lut.ts`, `world/skyRig.ts`, `core/Game.ts`) and
  `public/assets/lut/far-reach.bin`.

Method:
- My round-9 to round-12 method. Each frame is resized to 780×1688 (Lanczos). Regions are fractions of the frame (x left
  to right, y top to bottom, HUD included).
- On each patch:
  - Rec. 709 luminance (L): p10 / p50 / p90, its standard deviation and the share above 230;
  - mean RGB, chroma (max − min) and the hue of the mean;
  - "hp", fine detail: the standard deviation of L minus its 3 px Gaussian blur;
  - "white", the share with L > 170 and chroma < 60 (daisies, white cloud tops).
- **Fair crops.** The fan's leaf now starts at x 0.57–0.58 in the ground rows. Every foreground patch stops at x ≤ 0.36.
- **Before / after.** Every round-12 patch is re-measured on the round-12 capture in the same run. My round-12 numbers
  reproduce to ±0.3.
- A whole-frame diff (|ΔL| > 12) changes 34–45 % of each mock view (round 12: about 23 %). The changes are below
  y 0.20: the isles, the meadow, the fan and D's Roc. **Above y 0.20 the frames are pixel-identical to round 12**
  (mean |Δ| 0.01–0.16 levels on A's and C's sky; 1.5–1.7 on D's storm). That matters for the LUT claim, below.

## Measured (mockup / round 12 / round 13)

| Patch | Mockup | Round 12 | Round 13 | Reading |
|---|---|---|---|---|
| A near ground x 0.03–0.32, y 0.68–0.82: p50; p90; sd; hp | 59; 100; 29.7; 19.8 | 61; 90; 22.1; 15.3 | **53; 106; 32.9; 21.5** | the spread and detail are back; now a match within ~6 levels |
| A nearest band x 0–0.36, y 0.76–0.84: p50; p90; sd | 56; 102; 30.1 | 57; 85; 19.8 | **46; 105; 34.7** | the spread matches; the median is a little dark |
| B near ground (same patch): p50; p90; sd; hp | 65; 124; 34.8; 22.1 | 65; 101; 24.0; 16.0 | **61; 122; 32.4; 24.2** | a match |
| C near ground x 0.05–0.36, y 0.77–0.85: p50; p90; chroma | 66; 131; 47 | 78; 115; 63 | **74; 131; 56** | closer |
| D near ground x 0–0.36, y 0.74–0.84: p50; chroma | 55; 35 | 84; 67 | **58; 42** | **closed: the largest ground gap of round 12** |
| D floor behind the dais x 0–0.36, y 0.70–0.74: p50; hp | 66; 24.3 | 42; 13.2 | **69; 23.6** | **closed** |
| P foreground x 0–0.36, y 0.62–0.84: p50; p90; sd | 69; 159; 46.4 | 52; 80; 19.3 | **53; 108; 29.9** | better, still the furthest of the five |
| Near-meadow highlights (top 10 % of L), hue / chroma (A / B / D) | 34° 78 / 35° 80 / 34° 77 | 46° 79 / 45° 79 / 42° 91 | **40° 80 / 38° 79 / 38° 67** | the lit blades turned from straw toward the mockups' warm gold |
| White specks, fan-clear near patch (A / B / P) | 0.2 / 0.3 / 4.7 % | 0.2 / 0.0 / 0.0 % | 0.6 / 0.0 / 0.0 % | daisies in A only; none in B's or P's patches |
| A cluster band y 0.22–0.36: p50; chroma; hp | 174; 80; 11.6 | 155; 68; 13.0 | 157; 74; 13.6 | a little closer |
| A isle rock (pure rock patches): p50; hue; chroma | 95–118; 18–22°; 46–88 | 69; 30°; 39 | **74–104; 30–32°; 41–57** | lighter, still olive-ochre where the mockup's rock is rose-brown |
| A band under the cluster y 0.36–0.46: > 230 | 5.2 % | 14.1 % | 15.6 % | slightly worse, 3× the mockup |
| A subject band y 0.45–0.65 p50; under the bridge x 0.25–0.75, y 0.53–0.60 p50 | 87; 108 | 68; 73 | **76; 84** | closer |
| A beside the bridge, left x 0.12–0.30, y 0.55–0.62: hue; hp; p90 | 24°; 17.2; 155 | 27°; 15.1; 185 | **39°; 9.6; 105** | **new: the windmill keel is a smooth olive-green mass (finding 2)** |
| B cluster band y 0.25–0.36 p50 | 169 | 121 | **152** | closer |
| C upper sky x 0.05–0.38, y 0.10–0.25: p50; chroma | 205; 70 | 152; 35 | 152; 35 | unchanged (pixel-identical) |
| C top band x 0.20–0.60, y 0.04–0.09: sd; hp | 10.9; 4.1 | 3.1; 0.3 | 3.1; 0.3 | unchanged |
| D sun patch x 0.05–0.45, y 0.44–0.50: > 230; p50 | 36.8 %; 224 | 23.0 %; 219 | **3.2 %; 192** | **the sun is behind the Roc's tail** |
| D whole frame: p99; play rows y 0.05–0.85 > 230 | 240; 2.9 % | 229; 1.1 % | **222; 0.4 %** | D is the dimmest it has been |
| D between the stones x 0.30–0.50, y 0.50–0.60: chroma; white | 71; 8.0 % | 104; 0.4 % | 109; 0.4 % | unchanged: an orange haze, no white cloud tops |
| D storm x 0.05–0.65, y 0.09–0.25: p50; chroma; hue | 87; 25; 328° | 71; 35; 294° | 70; 35; 294° | unchanged, violet |
| Fan leaf (teal mask), share of the frame; its leftmost x at y 0.66–0.70 (A / D) | — | 1.89 %; 0.500 / 0.497 | **1.15 %; 0.571 / 0.571** | about 40 % smaller, further right |
| Leaf-mask IoU with the mockup's leaf (A / B / C / P) | — | 0.17 / 0.17 / 0.11 / 0.16 | **0.31 / 0.26 / 0.08 / 0.15** | up in A and B; down in C, flat in P |

The Roc, read off full-resolution crops of D (y 0.12–0.56):
- **The mockup's eagle:** spans x 0.02–0.97 and y 0.165–0.425 (0.26 of the frame's height), seen three-quarter on. Its
  white head and yellow beak sit at x 0.51, y 0.35, well below the boss bar, and its talons are gold. The sun is visible
  at x 0.24, y 0.46.
- **Round 13's Roc:** a modelled eagle. The slate-and-cream wing split and the layered flight feathers read, which is a
  real gain on round 12's flat bar.
  - **Size:** it runs off both frame edges and spans y 0.167–0.50 (0.33 of the height).
  - **Pose:** belly-on to the camera.
  - **The head:** at y 0.23–0.27, exactly behind the HUD boss bar (y 0.245–0.275). Only a brown crown pokes above the
    bar, so no face, eye or beak reads.
  - **The talons:** grey-white, not gold.
  - **Two defects in the model** (crop x 0.25–0.75, y 0.37–0.53):
    - Bright yellow zig-zag cracks run from both legs down through the tail. They are the sky showing through the mesh:
      a skinning or seam tear.
    - A stray grey beaked lump sits in the middle of the tail.
  - **The sun:** the tail covers it.

## Scores

| Mockup | Score | The three biggest differences (region) |
|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.5** (r12 7.2) | 1. **The cluster (x 0–1, y 0.17–0.40)** now has the mockup's forms: rounded rock masses, overhangs and long root curtains, and the cone picket is gone. But the caps are olive moss mounds with one small tree each, not bushy green-gold crowns. The masses are wide and shallow beside the mockup's deep tapering keels. The rock is olive-ochre (hue 30–32° against 18–22°), and the cluster sits higher and wider (top y 0.20 against 0.26; across the whole width against x 0.08–0.88). The cloud wall under it is still hot (15.6 % over 230 against 5.2 %). 2. **Beside and under the bridge (x 0.12–0.88, y 0.52–0.62)** is now a smooth, faceted olive-green mass: the windmill isle's keel wears the canopy model (finding 2). It should be the mockup's falling rock and cloud (hp 9.6 against 17.2). The mill's lattice sails against the mockup's cloth are unchanged. 3. **The meadow (x 0–0.36, y 0.66–0.84)** now matches on numbers (p50 53 against 59, p90 106 against 100, sd 33 against 30; highlight hue 40° against 34°), with daisies and orange flowers. But it reads as an even hatched mat of thin pale strokes, with none of the mockup's three grey boulders. The fan is smaller and lower right (leaf from x 0.57), closer to A's; the glove is mostly under JUMP. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **7.2** (7.0) | 1. **The sky (y 0.18–0.47), scored on finish under the lead's ruling:** the cluster is now rooted, rounded masses instead of a flat shelf with a cone picket, and the band is closer (p50 152 against 169; it was 121). The windmill isle's keel behind the keeper (x 0.52–0.78, y 0.40–0.47) is the same green blob as in A. 2. **The keeper and lectern (x 0.07–0.27, y 0.45–0.62) are unchanged:** a plain coat beside the mockup's scarf, satchel and layered cloth, and a simple book stand (plan row 10's keeper half is open). 3. **The foreground (x 0–0.45, y 0.58–0.86)** now matches in value (p50 61 against 65, p90 122 against 124, sd 32 against 35), with two lit grey rocks. But the blades read as a hatched straw mat, and there are no white daisies in the patch (0.0 % against 0.3 %). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **6.8** (6.5) | 1. **The fan (x 0.55–1.0, y 0.58–0.81).** The pivot is now at the lower right with the leaf opening up-left, which is C's orientation, and the tassel shows. But it is the modest hold, half C's hero size: the leaf IoU fell (0.11 → 0.08), and C's leaf sweeps across the centre (x 0.39–0.90, y 0.51–0.81). The glove is under JUMP. 2. **The sky (y 0.04–0.40) is pixel-identical to round 12:** grey-mauve above ~25° (152 against 205, chroma 35 against 70; top band sd 3.1 against 10.9). The isles' finish improved as in A. 3. **The foreground (x 0.05–0.36, y 0.77–0.85)** is closer (p50 74 against 66, p90 131 against 131) but has no rock or flowers. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-opening`) | **7.3** (7.5) | 1. **The Roc (x 0–1, y 0.17–0.50)** is now a feathered eagle with the mockup's wing split, but it doesn't read as the mockup's shot. It is belly-on and runs off both frame edges at 1.3× the mockup's height. Its head hides behind the boss bar, so no face or beak shows, and the talons are grey. The tail shows sky through yellow tear lines and carries a stray beaked lump. 2. **The light:** the Roc's tail covers the sun (sun patch 3.2 % over 230 against 36.8 %; whole-frame p99 222 against 240), so D lost its low-sun focal point. The gap between the stones is still an orange haze with no white-topped cloud sea (white 0.4 % against 8 %), and the storm is still violet (hue 294° against 328°). 3. **The arena (y 0.55–0.86):** the ground is fixed (near 58 against 55, floor 69 against 66), and the stones carry cut spiral runes much like the mockup's. But the dais is a smooth brown disc with a raised rim and a centre spike, with grass tufts growing on it, where the mockup has cut slabs and an inlaid compass star. The fan still covers the right half from x 0.57, where the mockup shows a sliver. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **6.1** (5.9) | 1. **The mill isle (x 0.38–0.95, y 0.36–0.56) regressed:** its keel is now a big olive-green moss ball (the canopy model), where the mockup's is a dark rock spur with hanging roots. The deck is still the broad flat shelf. 2. **The ray and its wake are absent from this frame for the third round** (the mockup's second subject, x 0.42–0.62, y 0.29–0.36). The ray now shows in A and C, at the right edge. 3. **The foreground (x 0–0.36, y 0.62–0.84)** is better (p90 108 against 159, it was 80; sd 30 against 46, it was 19) but has no white daisies (0 % against 4.7 %) and no rock spur edge. The cluster's isles are better formed (ruled presence). |

**Seat score, Sky Reach: (7.5 + 7.2 + 6.8 + 7.3 + 6.1) / 5 = 6.98, rounded to 7.0** (round 12, this seat: 6.8).

Rows 1, 3 and 4 moved A, B and C. Two new regressions cost points: the green windmill keel in A, B and P, and the Roc
hiding the sun and its own head in D.

## The README's claims, checked

| Claim | Verdict | Evidence |
|---|---|---|
| Row 10, half: one shard LUT fitted to the five mockups, in this capture | **Not in the frames** | Everything above y 0.20 is pixel-identical to round 12, and so are unchanged objects: A's left bridge post (58.0, 35.9, 19.1) → (57.9, 35.9, 19.0), C's post (62.0, 38.8, 21.8) → (62.4, 39.1, 22.0). Evaluated on those exact colours, `far-reach.bin` (33³, b-g-r order) gives (65.0, 43.2, 25.5) and (69.8, 46.0, 28.6), and C's upper sky (185, 159, 153) → (197, 170, 168). None of these shifts is in the capture, so `sky.lut` was null when it rendered. `lutUrl()` returns null when the build's byte table (`bytes.generated.ts`, build-derived) doesn't list the file. Applied offline to these frames, the LUT would help D's storm (p50 70 → 84, mockup 87) and A's cluster (157 → 167, mockup 174). It would overshoot C's and D's near ground (74 → 83 against 66; 58 → 66 against 55) and grey C's upper sky further (chroma 35 → 31 against 70). |
| Row 1, modelled islands | **Verified, a large form gain** | Rounded masses, overhangs and root curtains in A, B, C and P, plus the aerials and the clip. The aerials still show the playable isles' keels as skirts under flat discs. `keel.windmill` wears `isle-canopy-hd` with `clipTop`, so the canopy model's foliage, lifted by the new `leaf` term (`mix(vec3(l), c, 1.35) * vec3(1.02, 1.12, 0.78) * 1.15`), becomes the windmill isle's whole underside: finding 2. |
| Row 2, modelled trees | **Verified** | Hunyuan pines, an oak and a bush in A, B, C, P, h1–h3. The cone picket is gone from the cluster. |
| Row 3, the smaller, lower fan; IoU A 0.35 → 0.67, B 0.22 → 0.46 | **Direction verified for A and B, not for C** | The leaf (teal mask) is 1.89 → 1.15 % of the frame, and its leftmost x at the dais rows is 0.497 → 0.571. Leaf-only IoU A 0.17 → 0.31, B 0.17 → 0.26, but C 0.11 → 0.08 and P 0.16 → 0.15. The builder's polygons add the hand and guards, so the absolute numbers differ. |
| Row 4, a green, varied meadow; near medians A 57, C 76, D 59 | **Reproduces within 4** | My near-ground medians: A 53.2, C 74.1, D 58.0. Spread, detail and highlight hue moved onto the mockups in A, B and D. The board's AFTER was a separate HEAD capture, which explains small offsets. |
| Row 7, the carved crown set | **Partly** | The stones' spiral runes read. The dais is a smooth disc with a raised rim and a centre spike, not cut slabs and a compass, and grass grows through it. |
| Row 8, the Hunyuan eagle, "pitched head-up as the mockup flies it" | **Model verified; the frame regresses in two ways** | `ROC_HD.pitch` π/2 → 0.45 and `ROC_SPAN` 19 → 16. In D's take-off the head-up pitch puts the belly and tail at the camera and the head behind the boss bar, and the tail covers the sun. The tail shows tear lines and a stray lump. |
| "The top 1 % of luminance is 229–238 in all five views" | **False for D** | The full-frame p99 is A 237, B 234, C 238, D **222**, P 236. |
| Kept should-fixes: a retry resets the Roc to its perch | **Verified in code** | `restart()` now places the Roc on `PERCH()` with the perched yaw and sets `angle`. Round 12's should-fix is closed. |
| Kept: crag o6 out of the arena's airspace | **True for o6; o3 moved into the same spot** | o6 went from (9, −186) to (34, −175). But `o3` went from (−4, −170, y 72) to **(−4, −186), r 12, y 86, keel 20**, 5.7 m from the crown's centre (0, −190). That puts its keel's bottom (about y 66) over the dais, above the Roc's lap (y 55). |
| Kept: the take-off faces the entrance | **Unchanged** | It still steers to `(DAIS.x, CROWN.z + CROWN.r)`, which lies on D's camera axis, 13 m east of the bridge landing (round 12, seat C's should-fix, open). |

## Ledger 5

- **Cameras:** the cameras blob (`f3e3cb06…`) and every `camAt` match round 12. Staging is unchanged (`roc-opening` on
  D, `quest-crown` on h4; `active` is D only). `qa.retaken` is empty, every shot is `world`, there are no page errors,
  and `programs` went from 101 to 102.
- **D's staged frame:** the same 3.3 s take-off as round 12, now with a retry that replays from the perch (closed). Not
  void. The new model's pose and tears are finish problems, not staging.
- **Global grade:** the LUT, the one change that could hide a material gap, is not in these frames (above). When it
  lands, check its predicted overshoot on C's and D's ground.
- **The keel clip** (`clipTop`, a fragment discard above the model's turf line) is real geometry cut under a real deck,
  the same from every view. Not a breach.
- **No narrowing:** h1–h4, the aerials and the clip show the same world with the new isles, trees and meadow. Nothing
  moved for a mock view: o3's and o6's moves serve A's cluster and the arena, and are global. One side effect: h4 no
  longer shows the Roc, because its staged state is quest-complete, as in round 12.
- **Should-fix, new:** `o3` now occupies the arena airspace that o6 was moved out of (above).
- **Budget:** GPU ceilings re-recorded (phone 249 MB). Six isle models and five trees, all instanced, within the
  1.8 GB / 1.0 GB caps per the README. No phone-tier fps reading was quoted.

## Findings, ranked by score gained

1. **New, a regression: D's Roc covers the sun and hides its own head** (D, x 0–1, y 0.17–0.50).
   - **Evidence:**
     - The sun patch is 3.2 % over 230 against 36.8 %, and the frame's p99 is 222 against 240.
     - The head sits at y 0.23–0.27, under the boss bar (0.245–0.275).
     - The bird is 0.33 of the frame tall against 0.26, and its wings run off both edges where the mockup's stay inside
       (0.02–0.97).
     - Yellow tear lines run through the legs and tail, and a stray beaked lump sits in the tail.
   - **Fix:**
     - Repair the mesh: weld the seams and re-weight the leg and tail vertices to one bone each in `rocRig`, then
       delete the stray lump in Blender before `finish.sh`.
     - Lower the pitch from 0.45 toward the mockup's near-level glide, so the head leads above the breast instead of
       tucking up.
     - Let the take-off arc a few degrees off the camera axis so the bird shows three-quarter on and clears the sun. If
       you aim it at the player's position (round 12, seat C), every path gets the same arc.
   - **The target:** head and beak at y ~0.33–0.37, below the bar; the sun patch back near 30 %+ over 230.
2. **New, a regression: the windmill isle's keel is a green moss ball** (A x 0.12–0.88, y 0.52–0.62; B x 0.52–0.78,
   y 0.40–0.47; P x 0.38–0.95, y 0.40–0.56).
   - **Evidence:** `WEAR['keel.windmill'] = isle-canopy-hd`, clipped at its turf line, so the canopy paint's
     spilled-over foliage, boosted by the new `leaf` lift, becomes the whole underside. Beside A's bridge the hue is
     39° against 24°, hp 9.6 against 17.2 and p90 105 against 155. The mockups show grey-brown rock falling away, with
     roots and clouds beside it.
   - **Fix:** put the windmill (and crown) keels on `isle-mass-hd` or `isle-spire-hd`. Apply the `leaf` lift only above
     the model's turf line (the `farLocalY` varying already exists for `clipTop`).
3. **Repeated: the isles' finish** (A, B, C, P: x 0–1, y 0.17–0.40).
   - **Evidence:** the forms now match. The rock is olive-ochre against rose-brown (hue 30–32° against 18–22°). The caps
     are moss mounds with a single small tree, against bushy green-gold crowns spilling over the rim. The masses are
     wide and shallow beside the mockup's deep, tapering keels. The cluster sits ~0.06 of the frame higher than A's.
   - **Fix:** pull the stone tint toward the mockup's hazed rose (about 150, 110, 90 lit; 110, 85, 75 shade). Stretch
     the cluster's keels toward the top of `SKY_ISLE_HD.stretch`. Stand two or three of the new modelled pines and
     bushes on each cap, at the rim. Lower the cluster a few degrees, keeping the ruling's one world.
4. **New, verify: the LUT isn't in the capture.** Rebuild with the byte table listing `/assets/lut/far-reach.bin` and
   re-capture. Before keeping it, check the offline prediction above: it helps D's storm and A's cluster, but overshoots
   C's and D's near ground by +17 and +11 and greys C's sky. If the next capture confirms that, refit with C's and D's
   ground weighted.
5. **Repeated: D's horizon and storm** (x 0.05–0.7, y 0.44–0.62; x 0.05–0.65, y 0.09–0.25).
   - **Evidence:** the gap between the stones is still an orange haze (chroma 109 against 71, white 0.4 % against
     8 %). The storm is still violet (hue 294° against 328°, chroma 35 against 25).
   - **Fix:** plan row 5's cloud layer, with white lit tops, below the crown's rim, plus two or three `isle-shelf-hd`
     isles in the gap, as the mockup has. Desaturate the storm toward slate.
6. **New: D's dais** (x 0.15–0.60, y 0.64–0.72) is a smooth disc with a centre spike, and grass grows through it.
   - **Fix:** project the mockup's slab joints and compass star into its map, drop the spike, and keep the sward clear
     of the dais footprint.
7. **Repeated: C's sky** (x 0.05–0.60, y 0.04–0.25): pixel-identical for a third round (152 against 205, chroma 35
   against 70, top band sd 3.1 against 10.9). Plan row 5 or 9: warm the shared dome above ~25° and give the top band
   cloud structure.
8. **Repeated: proposal B's ray** (x 0.42–0.80, y 0.29–0.47): absent for the third round, though the ray now shows in A
   and C. Bring the lap's near arc in front of the mill at sail height, checked on a sweep of the lap.
9. **Repeated: the meadow's last step** (all ground views, x 0–0.36, y 0.62–0.86).
   - **Evidence:** the numbers now match in A, B and D, but the blades read as a hatched mat of thin pale strokes.
     There are no daisies in B's or P's patches (0 % against 0.3 / 4.7 %), and A's three foreground boulders are
     missing.
   - **Fix:** soften the blade edges (wider, fewer strands per tuft), add daisy drifts on the B and P approaches, and
     add rocks beside A's path where `clearOfWalks` allows.
10. **Should-fix, new (ledger 5 neighbourhood): `o3` over the arena.** Slide it along the line from A's camera to about
    z −150, scaling its r and y by 150/186, so it keeps its place in A and leaves the crown's sky to the storm.
11. **Repeated: the keeper** (B), the mill's cloth sails (A, C, P), and the fan's size in D (it covers the dais's right
    half from x 0.57).

SCORE sky-reach: 7.0

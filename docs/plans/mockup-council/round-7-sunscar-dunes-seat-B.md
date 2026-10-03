# Round 7, seat B, Signal Dunes (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-7/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0156-eeee0e02/` (780×1688: every `mock-*`, the four hero views, both
aerials, `clip.mp4` sampled at 0.5 fps); round 6's `20261003-0132-28e3eb78/` and round 5's `20261003-0057-56c23085/` for
before/after; the five ledger mockups at full resolution, each scaled (Lanczos) to 780×1688. Every view was set out as
mockup | r5 | r6 | r7 and cropped region by region (sky band, dune band, the tower-dune terminator at 1×, foreground sand
at 1×, the brazier at 1×, the coil strands at 3×, the glove at 1.8×). All values are Rec. 709 luma
(0.2126 R + 0.7152 G + 0.0722 B) and RGB means, measured with numpy on decoded JPEGs. Patches, so the columns compare with
rounds 4–6: ground 500×250 @40,1050 (this one holds part of the coil since round 6, kept only for continuity); **clean sand
clear of the viewmodel, Sefa and the HUD, x 10–240, y 1150–1450** (round 6 seat C's patch; the one this seat's verdicts
rest on); sky 500×300 @40,300; fine detail = mean |luma − Gaussian-blurred luma| (σ 2 px); macro spread = p5–p95 of luma
blurred at σ 12 px. Round 6's numbers reproduce within ±1. Source checks: `git diff 28e3eb78..eeee0e02 --
src/shards/sunscar-dunes/` (`layout.ts`, `look/render.ts`, `look/sky.ts`, `world/dunes.ts`, `world/meshes.ts`,
`world/places.ts`; commits `b3beecc14`, `c691d95f2`, `19e78bf2e`). Regions are fractions of the frame (x left → right,
y top → bottom). Per-dimension marks: composition and subject (Comp), forms and silhouettes (Form), materials and detail
(Mat), light and colour (Light), density and depth (Depth), hands / weapon / HUD (Hands).

## Measurements (mockup / r7 / r6 / r5)

| View | Clean sand RGB (luma, p50) | Clean sand p5–p95 (spread) | Clean sand p99 | Fine detail, clean sand | Sky patch luma |
|---|---|---|---|---|---|
| dusk-fire | 108,65,39 (72, 70) / **116,66,37 (75, 78)** / 93,48,27 (56) / 119,68,38 (77, 78) | 41–110 (69) / **45–95 (50)** / 52 / 38 | 128 / **100** / 88 / 97 | 8.8 / **4.0** / 6.2 / 2.5 | 76 / 90 / 90 / 94 |
| A spawn | 84,50,36 (56, 54) / **118,68,39 (77, 78)** / 97,52,30 (60, 61) / 121,71,40 (79, 81) | 18–96 (78) / **50–97 (47)** / 50 / 40 | 116 / **102** / 90 / 99 | 9.2 / **3.9** / 6.1 / 2.5 | 88 / 82 / 85 / 86 |
| B logbook | 60,34,28 (39) / 72,41,33 (47) / 71,40,33 (46) / 61,35,30 (40) | 27–50 (23) / 23–65 (42) / 41 / 40 | 56 / 72 / 71 / 67 | 2.2 / 4.7 / 4.6 / 4.3 | 50 / 44 / 44 / 44 |
| C waymark | 52,28,23 (32) / **34,13,17 (18)** / 31,11,15 (16) / 38,16,18 (21) | 23–38 (15) / 7–33 (26) / 19 / 40 | 47 / 37 / 35 / 55 | 0.8 / 1.5 / 1.5 / 1.1 | 53 / 40 / 42 / 39 |
| D hands | 50,31,28 (35, 33) / **51,26,27 (31, 32)** / 34,14,18 (18) / 51,26,27 (31, 31) | 17–49 (32) / 17–41 (24) / 24 / 23 | 53 / 44 / 36 / 43 | 1.0 / 1.3 / 2.3 / 1.0 | 50 / 38 / 38 / 38 |

Named patches:
- **Dune band, 10-column luma grid** (dusk-fire and A, y 0.36–0.69). r7's grid is r5's to within ±3 on every lit cell;
  only the shade cells moved, **down**: the tower dune's camera face is 22–26 (r5 28–31; the mockups' shade 28–45).
  Lit dune faces top out at 85–89 in both r5 and r7 (the mockups' lit faces 100–107 in A, 80–92 in dusk-fire).
- **dusk-fire shade face** (mockup x 0.3–0.6, y 0.385–0.41; game x 0.28–0.40, y 0.44–0.52): 38,30,34 (32, sd 9.8) /
  **36,20,29 (24, sd 2.5)** / 76,39,28 (46, sd 3.1) / 43,25,34 (29, sd 1.7). The shade face is back, but 8 below the
  mockup and still flat (sd 2.5 vs 9.8).
- **A shade block** (x 0.55–0.85, y 0.43–0.50): r7 **24, sd 1.9** / r6 51 / r5 30. Mockup A's shade faces 33–45.
- **Lit faces, the crest-band claim:** dusk-fire's lit right shoulder (x 0.7–1, y 0.46–0.53) r7 83.2, p95 92, p99 97 vs r5
  83.4, p95 91, p99 94; A's left flank (x 0.1–0.4, y 0.42–0.50) r7 p95 89, p99 97 vs r5 p95 89, p99 97 (identical). Lower-left
  lit sand (x 0.02–0.4, y 0.62–0.8): mockup 74, sd 20, p95 109 / r7 76, sd 17, p95 95 / r5 81, sd 8, p95 93.
- **Coil strand** (a strip on the coil's left arc, no sand; D): mockup 42,21,20 (mean 26, **p50 15**, p95 87, p99 146) /
  **r7 54,29,21 (34, p50 26, p95 71, p99 74)** / r6 95,47,24 (55, p50 56) / r5 61,33,33 (39). The value is back near the
  mockup's; the bright pixels are flat albedo (p99 74, sd 20) where the mockup's are sheen (p99 146).
- **C flame** (box x 150–450, y 350–900; pixels over luma 150): mockup 248,210,143 (213, p99.5 252) / **r7 239,193,141
  (200, p99.5 224)** / r6 200 / r5 189. Saturated orange pixels (R > 170, 40 < G < 150, B < 90): 13 468 / **2 679** /
  1 834 / 3 176. White-hot (luma > 230): 5 557 / **370** / 375 / 371. The flame is round 6's.
- **A sky band** (y 0.18–0.39): mockup luma 88, cloud brights (luma > 140) 21 k px / r7 94, 56 k / r6 92, 51 k / r5 98, 65 k.
- **Frame diffs** (mean |ΔRGB| over the whole frame): D r7 vs r5 **2.9** (r6 vs r5 8.8); B r7 vs r6 2.1. Apart from the
  viewmodel, r7's D, A, dusk-fire and C are round 5's pictures.

Reading:
- **The revert landed.** The dunes, the camera heights, the tower dune's shade face, C's next waymark and D's framing are
  round 5's again, and the late-dusk ground is round 5's (D clean sand 51,26,27 in both).
- **But half the grain went with it.** Fine detail on clean sand is 3.9–4.0 in A and dusk-fire: up from r5's 2.5, down from
  r6's 6.1–6.2, against the mockups' 8.8–9.2. At 1× the r7 foreground reads as r5's sine corduroy with a faint grain, not
  r6's speckle. The grain code is unchanged (`render.ts` diff touches only the fill and a graze term), so the loss comes
  with the terrain under the camera: the near sand is farther from the eye on round 5's slope, and the grain's octaves go
  sub-pixel there.
- **A's near sand is too bright again** (p50 78 vs the mockup's 54); round 6 had matched it (61). Dusk-fire's is near
  (78 vs 70).
- **The shade went darker, not textured.** The fill change in `render.ts` (`mix(1.0, 1.15, uDusk)` → `mix(0.8, 1.15,
  uDusk)`, less floor) took the shade to 24, under the mockups' 32, and left it flat.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.0** | 6 / 5 / 6 / 6 / 6 / 6 | 1. **The terminator is a vertical smear, not a crest line (x 0.2–0.6, y 0.40–0.55).** The shade mass is back (r6 had none), but its left edge is round 5's soft vertical band at x 0.22–0.28, running straight down the dome and following no crest, and it is now stronger. The mockup's shade boundary is one crisp diagonal from the tower's foot down to the right, with a lit left shoulder (grid cells 77–92) beside the shaded saddle (42–48, x 0.6–1, y 0.51–0.56). The game's lit shoulder is on the right (83–89). Shade 24 (sd 2.5) vs 32 (sd 9.8). 2. **Sky (y 0.12–0.38).** The pale peach flakes are thinner than round 5's (the `sky.ts` coverage cut), but still in rows edge to edge across a violet upper sky; the mockup's sky is orange-brown high up with a few grey-brown banks at the right only. The lavender range is a flat cut-out. No ray, the lamp unlit (the reachable first step). 3. **Coil and sand (x 0.3–0.7, y 0.55–0.85).** The coil is the mockup's size and now dark brown, but its pattern reads as pale rectangles staggered in rows (see D). The sand's mean is right (75 vs 72) but the grain is half the mockup's (4.0 vs 8.8) and the lit sand has no crest glints (p99 100 vs 128). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 5 / 4 / 5 / 5 / 5 / 6 | 1. **One dome, not receding crests (x 0–1, y 0.38–0.60).** Unchanged from round 5: the mockup's four diagonal knife-edge crests, lit to 100–107 beside 33–45 shade, become one dome with a lit left flank (≤ 89) and a flat shade block now at 24 (sd 1.9), split by the same vertical smear at x 0.47–0.52. The tower stands larger and higher on its dome than the mockup's small tower on the farthest crest. 2. **Foreground (y 0.6–0.86).** The near sand is 22 brighter than the mockup's (p50 78 vs 54), with half its spread (47 vs 78), no lit crowns or black troughs (p99 102 vs 116), and 40 % of its grain (3.9 vs 9.2): regular parallel bands. Sefa and her chip are the real first step and stay. 3. **Sky and hand.** Pale flakes in rows over a violet sky, where the mockup has red-orange broken patches with dark undersides low over the horizon (y 0.19–0.32) and orange to high up. The coil: one double loop at x 0.33–0.62 against the mockup's two big rings from the bottom edge (x 0.33–0.86); the glove has a pale dashed line along its upper outline. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 7 / 6 / 5 / 5 / 6 / 6 | 1. **The camp, unchanged since round 5 (x 0.12–1, y 0.39–0.55).** The canvas glows one even saturated orange end to end with no falloff from the lantern, which has no glow; crates and sacks at the left are black slabs (the mockup lights them warm); the tent is a flat grey plane leaning off the right edge; the horse is end-on; the smoke a thin straight column. 2. **Sky and sand.** Plum sky (53,39,69, luma 44) vs the mockup's blue-violet starfield (49,46,92, 50); sand 47 vs 39 with diagonal bands and grain (fine 4.7 vs 2.2) where the mockup's is dim and even. 3. **The coil (x 0.3–0.62, y 0.6–0.85).** Now dark brown (a gain on r6's copper), but the pale staggered rectangles read as a pattern, not a plait, and the mockup's two big rings span x 0.33–0.85. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 5 / 5 / 5 / 6 / 6 / 6 | 1. **The fire (x 0.3–0.47, y 0.26–0.50).** The Λ is gone and a dark charred log end now shows inside the rim, but the flame is round 6's smooth cream tongues: 2 679 saturated-orange pixels against the mockup's 13 468, a white-hot core of 370 against 5 557. No burning log pile inside the flame, embers are white specks not orange streaks sweeping up-left, the smoke a soft column not a billow. 2. **The backdrop (x 0–1, y 0.22–0.55).** Round 5's: the next waymark is back on the right (x 0.83) with its plume (round 6 had hidden it), but a dark dune shoulder still runs across the upper left behind the bowl, where the mockup has the bowl against open sky over a low flat horizon at y 0.53. Sky 40 vs 53. The near sand is dark maroon (34,13,17, luma 18) against the mockup's brown (52,28,23, 32). 3. **Brazier and hand.** Clean brick plinth and twisted copper post vs sooty iron on fieldstone; the "5 M" chip clipped at the left edge; the coil as in B. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.5** | 5 / 4 / 5 / 6 / 5 / 6 | 1. **The landform and the tower (x 0–1, y 0.40–0.85).** Round 5's frame (mean diff 2.9): the tower dune's hump across x 0.5–1 with whorled diagonal ripples over all the near sand, and the tower's lower half behind the crest under its "SIGNAL TOWER 197 M" chip. The mockup is a flat horizon at y 0.51 over long parallel dark-lined bands and smooth near sand, the tower whole on the horizon; the game's horizon sits at y ≈ 0.44, so its afterglow band (mockup luma ~130 at y 0.46–0.53) is ground (52). 2. **The hero hand (x 0.4–1, y 0.56–0.86).** The coil's value is now near the mockup's (p50 26 vs 15) and the copper is gone. But at 3× it is a dark tube printed with flat pale-tan rectangles in staggered rows (a tape or checkerboard), with no strand relief, no lozenges and no sheen (p99 74, flat albedo); the mockup's is a plait of dark lozenge strands each catching a bright rim (p99 146). The new stitching reads as a pale dashed line along the forearm's upper silhouette, like a zipper, while the mockup's glove has stitched panels, knuckle creases and crackle over the back of the hand. 3. **Sky.** Zenith matches (30,33,74 vs 28,31,70); the sky patch is 38 vs 50 and the afterglow a thin hot orange stripe, not the mockup's broad peach-to-pink band. |

**Seat score, Signal Dunes: (6.0 + 5.5 + 6.0 + 5.5 + 5.5) / 5 = 5.7** (this seat: round 1 4.8, round 2 5.3, round 3 5.3,
round 4 5.4, round 5 5.7, round 6 5.5).

Round 7 is round 5's picture with three gains (the coil's value, C's Λ gone, slightly thinner clouds) and three costs
(half of round 6's grain lost, A's near sand bright again, shade 8 below the mockups and still flat). It recovered round
6's regressions; it did not move the view past round 5.

## Builder's claims checked against the frames and the code

| Claim (round-7 README) | Verdict | Evidence |
|---|---|---|
| D median 37 (round 5 36, mockup 40), rgb 57,31,32 | **True (ROI-dependent)** | On x 0–250, y 900–1100: r7 p50 38, 59,34,35 (r5 37). On the clean patch: 32 vs mockup 33, 51,26,27 = r5 exactly. Hue still redder than the mockup (G 26 vs 31). |
| dusk-fire and A at round 5's light (p50 75) | **True; for A that is a step away from the mockup** | Clean sand p50: dusk-fire 78 (r5 78; mockup 70), A 78 (r5 81; **mockup 54**). Round 6 had A at 61. Every lit grid cell is within ±3 of r5. |
| A fine detail 5.8 (round 5 5.3) | **Not reproduced; the grain is partly lost** | No patch reproduces either number with the brief's method (σ 2). On clean sand A is 3.9 (r5 2.5, r6 6.1, mockup 9.2); on the whole lower frame 4.7 (r5 4.0, r6 5.5); the best patch found (x 0–250, y 800–1000) gives r7 5.0 / r5 4.9. Visually the 1× foreground is r5's corduroy with a faint grain. The README should name its ROI and σ. |
| The plait dark brown, diagonal strands, dark gaps, one warm rim each, sheen roughness 0.45 | **Colour true; pattern and sheen not as rendered** | Strand strip p50 26 (mockup 15; r6 56): the copper is gone. But `meshes.ts` draws `sa` bands across the cord (model-space `sin(...·48)`), staggered by `sign(sb)`, and colours the "rim" `smoothstep(0.45, 0.95, sp)` as flat tan albedo: at 3× this is pale rectangles in alternating rows, not diagonal strands, and no specular highlight reads (p99 74 vs 146). |
| A highlight on the crest band only | **Not visible** | `render.ts` multiplies the key by up to 1.9 where N·L is 0–0.22. Lit-face p95/p99 are r5's (dusk-fire shoulder 92/97 vs 91/94; A flank 89/97 = 89/97); no bright line along any crest or terminator at 1×. The mockup's crest/grazing highlights reach 110–128. Either the band is too narrow for phone pixels or the faces at that N·L are already in baked shadow (`* sandVis`). |
| The dunes back to round 5's (128 m wave, tower lift 13 over 58 m), terrain and navmesh re-baked | **True** | `dunes.ts` WAVE 128 / LEE 0.45 / AMP_MAX 22, `layout.ts` CRESTS lift 13 ease 58; `camAt` back to round 5's exactly; aerials = r5's. |
| Logs kept (no glow unlit) | **True; their ends now show a little** | `kindling` lean −0.8, length 0.34: one dark charred lump shows inside C's rim; h3's unlit bowl has no glow. Still no burning log pile inside the flame. |
| Stitching kept | **Present, reads as a zipper** | `c691d95f2` seams in model space: in every view a pale dashed line runs along the forearm's top outline; nothing reads over the back of the hand at 780 px. |
| (unlisted) `sky.ts` cloud cover | **Not in the README's claims** | Coverage threshold 0.55 → 0.64, band top 0.24 → 0.2: bright cloud pixels in A's sky band 65 k (r5) → 56 k (mockup 21 k). A small honest gain; the round's change list should name it. |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Region | Fix |
|---|---|---|---|---|
| R7B-1 | dusk-fire, A (then every view) | must-fix | dusk-fire x 0.2–0.6, y 0.40–0.55; A x 0.45–0.85, y 0.42–0.52 | **Make the shade boundary the crest, and texture the shade.** The vertical smear (dusk-fire x 0.22–0.28, A x 0.47–0.52) is the baked shadow map's edge, not a landform edge (R5B-1, open since round 5). Take the key's terminator from the terrain normal (N·L) and let the baked map add only cast shadow, sharpened, so the line follows the dome's crest. Lift the fill back so shade faces sit at the mockups' ~32 (today 24) and let the ripple normal modulate the fill so the shade's sd rises from ~2 toward ~10. Check it on the 10-column grid: dusk-fire's lit-left / shaded-saddle split, A's alternating lit/shade diagonals. |
| R7B-2 | A, dusk-fire | must-fix | foreground x 0–0.4, y 0.6–0.86 | **The grain has to survive at the views' distance, and A's sand has to come down.** Clean-sand fine detail 3.9–4.0 vs r6's 6.1 and the mockups' 8.8–9.2; A p50 78 vs 54. Re-tune the grain octaves' scale (or a distance-aware grain) on round 5's terrain, measured on the clean patch x 10–240, y 1150–1450, until detail ≥ 6 there; take A's near-field key/exposure down so p50 ≈ 55–60 while dusk-fire stays ≈ 70, and push the top (p99 → 115–128) with grazing ripple crowns rather than raising the mean. |
| R7B-3 | D (hero), all five | must-fix | coil x 0.33–0.63, y 0.56–0.86; glove x 0.6–1, y 0.6–0.85 | **The plait's pattern.** The value is now right; the pattern is wrong. Drop the flat tan "rim" albedo; derive the braid from the cord's own coordinate (arc length and angle round the tube, not model-space xyz) so each strand is a lozenge leaning ~45° to the cord, alternating direction per row, shaded across its width in the normal (dark at both edges), with roughness low on the strand crowns so the key and the viewer-side light give each strand one narrow bright rim (mockup strip p99 146; today 74). Check at 3× against D's strip. Move the glove's stitch line off the silhouette onto the back-of-hand panels, and add knuckle creases (glove detail still a fraction of the mockup's). |
| R7B-4 | D, C | should-fix | D x 0–1, y 0.40–0.55; C x 0–0.6, y 0.22–0.45 | **Regional low bands, not a global reshape** (round 6 proved a global wave change breaks C and D). Keep round 5's field, and flatten only the region the waymark line and D's approach cross: a wide low-amplitude, long-wave ease (as `PADS`/`CRESTS` already ease locally) so D sees long flat bands under a horizon at y ≈ 0.51 with the tower whole, and C's bowl stands against sky over a low horizon with the next waymark still visible. Re-bake, walk 0 stuck, show the aerials. |
| R7B-5 | C (every lit brazier) | should-fix | x 0.3–0.47, y 0.26–0.50 | **Fire finish, unchanged for two rounds.** Keep the edge of the flame saturated orange and add a small white-yellow core low (saturated px 2 679 vs 13 468; core 370 vs 5 557). Raise the crown logs so 6–8 glowing ends criss-cross inside the flame's base when lit. Embers as orange streaks drifting up-left; smoke widening; sooty iron and fieldstone. |
| R7B-6 | A, dusk-fire | should-fix | y 0.12–0.40 | **Clouds:** the cut in `sky.ts` helped a little (56 k vs 65 k bright px; mockup 21 k). Confine them lower (A: y 0.19–0.32) and darken their undersides red-orange (A) / grey-brown, right side only (dusk-fire); keep the upper sky warm orange-brown in dusk-fire, not violet. |
| R7B-7 | B | should-fix | x 0.12–1, y 0.39–0.55 | **The camp, unchanged since round 5:** light falling off from the lantern, a lantern glow, light on the crates, the tent small and dark behind a side-on horse, a widening plume; sky toward 49,46,92 and sand toward 39. |
| R7B-8 | process | nit | round README | Name the ROI and σ behind every builder number (the "A fine 5.8 / r5 5.3" pair reproduces on no patch), and list every look change in the claims (`sky.ts` was omitted). |

## No-shortcut check (ledger 5)

- **Views:** no `mock-*` camera changed; the real camera positions moved back to round 5's exactly because `dunes.ts` and
  `layout.ts` reverted field-wide (verified in the diff and `camAt`). The aerials and the clip show round 5's dunes
  everywhere; no shot-only ground.
- **Staged state:** no commit touched `plugin.ts` (`stage()`, `duskOf`) between the captures; `meta.json` lists B
  (`logbook`) and C/D (`waymarks-lit`), reachable by the player's own handlers as rounds 4–6 verified. C keeps its flame,
  embers, plume, pool and toasts.
- **Viewmodel:** the hold is the single `HD_GLOVE` constant (unchanged); h1, h3, h4 and the clip show the same coil,
  pattern and stitch line as the mock views. No frozen pose.
- **Look global:** the plait, the fill change, the graze term and the cloud cut are in shared shaders; h1–h4 and the
  aerials carry them.
- **Painted stand-ins:** none in the playable area; range and clouds at infinity. The aerial-overview still shows soft
  dark blobs in the baked shadow and the clip pale strips between the range layers (look defects, not breaches).
- **Device and HUD:** 390×844 phone and touch, stored 780 wide, baseline HUD, 30 fps chip, 0 page errors. No frame-time or
  memory trace is on this surface, so the budgets are unverified here, not breached.

SCORE signal-dunes: 5.7

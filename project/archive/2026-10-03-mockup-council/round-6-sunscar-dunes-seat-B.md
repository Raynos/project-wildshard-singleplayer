# Round 6, seat B, Signal Dunes (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-6/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0132-28e3eb78/` (780×1688: every `mock-*`, the four hero views, both
aerials, `clip.mp4` sampled at 0.5 fps); round 5's `progress/sunscar-dunes/20261003-0057-56c23085/` for before/after; the
five ledger mockups at full resolution, each scaled to 780×1688. Every view was cropped as mockup | round 6 | round 5
triptychs region by region (sky band, dune band, foreground sand at 1.2×, the brazier at 1×, the hand at 0.8×, the coil
strands and glove at 2–3×). All values are Rec. 709 luma (0.2126 R + 0.7152 G + 0.0722 B) and RGB means, measured with
numpy on the patches this seat used in rounds 4–5 (sky 500×300 @40,300; zenith 400×150 @40,200; ground 500×250 @40,1050;
the lower-left ground's p5–p95 over x 50–390, y 880–1350; fine detail = mean |luma − Gaussian-blurred luma|, σ 2 px).
Round 5's numbers reproduce within ±1 (e.g. dusk-fire spread 45, fine 2.8), so the columns compare. New this round, to
separate **form contrast** from **grain**: the macro spread, p5–p95 of luma blurred at 12 px, on the dune band and the
foreground. Source checks: the three shard commits between the captures (`f81b2ed09`, `55a286313`, `1c872018f`);
`meta.json` (cameras blob `d78968c7`, unchanged; `camAt`). Regions are fractions of the frame (x left → right, y top →
bottom). Per-dimension marks: composition and subject (Comp), forms and silhouettes (Form), materials and detail (Mat),
light and colour (Light), density and depth (Depth), hands / weapon / HUD (Hands).

## Measurements (mockup / round 6 / round 5)

| View | Ground patch (RGB, luma) | Lower-left p5–p95 (spread) | Fine detail, ground | Dune band macro spread | Foreground macro spread |
|---|---|---|---|---|---|
| dusk-fire | 106,61,36 (70) / **90,46,26 (54)** / 114,64,37 (73) | 42–106 (64) / 34–78 (**44**) / 47–92 (45) | 8.7 / **6.1** / 2.8 | 46 / **27** / 56 (y 0.40–0.60) | 31 / 20 / 13 |
| A spawn | 92,52,36 (60) / 90,46,27 (55) / 110,63,37 (72) | 19–110 (91) / 26–81 (**55**) / 35–94 (59) | 7.8 / **5.9** / 3.0 | 70 / **43** / 58 (y 0.40–0.58) | 54 / 21 / 37 |
| B logbook | 59,31,26 (37) / 73,41,32 (48) / 71,42,36 (49) | 16–52 (36) / 32–84 (53) / 33–85 (52) | 1.7 / 5.3 / 4.0 | — | 26 / 27 / 32 |
| C waymark | 62,31,22 (37) / 56,26,21 (33) / 77,42,28 (49) | 23–105 (81) / 9–91 (**82**) / 9–113 (104) | 1.0 / 2.8 / 1.4 | — | 72 / 74 / 96 |
| D hands | 58,34,31 (40) / **44,18,18 (24)** / 56,30,30 (36) | 11–64 (53) / 10–52 (**42**) / 27–49 (23) | 1.8 / 3.5 / 1.4 | — | 47 / 33 / 16 |

Named patches (mockup / round 6 / round 5):
- **dusk-fire tower-dune shade face** (mockup x 0.3–0.6, y 0.385–0.41; game x 0.28–0.40, y 0.44–0.52): 38,30,34 (32, sd 10)
  / **76,39,28 (46, sd 3)** / 43,25,34 (29, sd 2). The round-5 shade face is gone: that part of the dome is now mid-lit.
- **dusk-fire lit lower-left sand** (x 0.02–0.4, y 0.62–0.8): 74, sd 20, p95 109 / **61, sd 14, p95 81** / 81, sd 8, p95 93.
- **A clear sand** (x 0–0.3, y 0.70–0.83): 58 (sd 20) / **61 (sd 13)** / 83 (sd 9).
- **dusk-fire 10×10 luma grid, y 0.36–0.86**: the mockup's cells run 28–88 (a lit left block of 80–88 beside a shaded
  saddle of 42–48 at x 0.6–1, y 0.51–0.56). Round 6's run 38–66 outside the hand, with no block brighter than 66.
- **Coil strands** (a strip on the coil's left arc, no sand): D 45,23,20 (median luma 22) / **89,43,22 (52)** / r5 ≈ 33;
  A 40,20,16 (21) / **97,48,25 (58)**; B 38,15,12 (18) / **73,37,23 (43)**.
- **Glove, D** (the fist's back, 140×150 px): 50,28,22 (32, sd 26, p99 119, detail 8.6) / **32,15,12 (18, sd 15, p99 58,
  detail 1.9)**.
- **Flame, C** (box x 150–450, y 350–900): pixels above luma 150: 249,211,145 (215, p99 251) / **241,195,143 (201, p99
  226)** / 233,183,129 (189). Saturated orange pixels (R > 170, 40 < G < 150, B < 90): 13 468 / **1 834** / 3 176.
  White-hot (luma > 230): 5 557 / **375** / 371.
- **Firelight pool, C** (x 150–450, y 1060–1150): 69,34,23 (**40**) / 74,37,26 (**44**) / 115,68,39 (76).
- **D sky column** (x 360–470): the mockup's afterglow climbs 77 → 155 over y 0.40–0.48 and meets the ground at y 0.51;
  round 6 peaks at **88** at y 0.44–0.46 and meets a near dune at y 0.47. Mid-sky (y 0.30) 57 / **40**.

Reading:
- **The grain landed.** Fine detail on the ground roughly doubled (dusk-fire 2.8 → 6.1, A 3.0 → 5.9; the mockups 7.8–8.7),
  and the near sand's mean came down to the mockup's (A clear sand 61 vs 58). At 1.2× the sand now has a speckled grain
  where it was a smooth sine corduroy. This is the round's real gain.
- **The form contrast went the other way.** The dune band's macro spread halved in dusk-fire (56 → 27, mockup 46) and fell
  in A (58 → 43, mockup 70). The shade face that sat at the mockup's value in round 5 is now a mid-tone 46, and the lit
  sand tops out at p95 81 against 109. So the lower-left spread "held" (45 → 44) only because grain replaced form: the
  picture reads as one warm brown field with texture, not lit faces against shade faces.
- **The coil went copper.** It is bigger, but its strands are now 2.5× the mockups' value and saturated orange.
- **D's ground went dark red** (44,18,18 against 58,34,31), as the builder says.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.0** | 6 / 6 / 6 / 5 / 6 / 5 | 1. **The light no longer models the dunes (x 0–1, y 0.38–0.85).** The vertical smear at x 0.22–0.27 is gone and the dome carries ripples, but its camera face is now a mid-lit 46 (sd 3) where the mockup has a crisp crest over a 32 shade face. The mockup's lit left foreground block (80–88) beside the shaded saddle (42–48, x 0.6–1, y 0.51–0.56) is one even 50–66 field in the game: dune-band macro spread 27 against 46, lit p95 81 against 109. 2. **The coil (x 0.33–0.62, y 0.58–0.84).** It is now one large round loop, close to the mockup's size, but it reads as a copper fishnet: a regular grid of dark lines over bright tan cells (strands 89–97,43–48,22–25, luma 52–58), where the mockup's loop is dark brown lozenge strands (≈ 45,23,20, luma 22) with a bright rim on each. The glove is smoother and darker than the mockup's (D numbers). 3. **Sky (y 0.12–0.38), unchanged since round 5.** Pale peach cloud flakes in rows edge to edge across a violet sky (sky patch 90 vs 76), where the mockup has an orange-brown sky with a few grey-brown banks at the right only (x 0.65–1, y 0.25–0.35). No ray, and the lamp unlit (the reachable first step, unstaged). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 5 / 4 / 6 / 5 / 5 / 5 | 1. **Still one dome, now with less shape (x 0–1, y 0.38–0.60).** The mockup has three to four diagonal knife-edge crests, each lit to 100–117 beside a 33–45 shade face, receding to the tower on the farthest. The game shows one big rounded dome under the tower with a soft, terminator-less fall-off to its right (x 0.5–0.75 at 45–50 against the left flank's 55–77): macro spread 43 against 70 (round 5: 58). The shorter wave's crests are not visible between the camera and the dome from the 13 m eye. The tower stands ~1.3–1.8× the mockup's height on screen. 2. **Foreground (y 0.6–0.85).** The near sand's mean and grain are now near the mockup's (61 vs 58; detail 5.5–5.9 vs 7.7–7.8), but the ripples are still near-parallel bands with no lit crowns or black troughs (sd 13 vs 20, macro 21 vs 54). Sefa and her chip are the real first step and stay. 3. **Coil and sky.** The mockup's two big dark rings span x 0.33–0.86; the game's copper loop spans x 0.34–0.63 (round 5: 0.45–0.68). Sky as in dusk-fire: pale flakes in rows against the mockup's red-orange broken patches low over the horizon. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 7 / 6 / 5 / 5 / 6 / 5 | 1. **The camp, unchanged since round 5 (x 0.12–1, y 0.39–0.53).** The canvas still glows a uniform saturated orange from end to end, with no falloff from the lantern, which has no glow. The crates and sacks at the left are black slabs; the tent is a flat grey plane leaning off the right edge; the horse is end-on; the cookfire smoke is a thin straight column. 2. **The coil (x 0.33–0.62, y 0.58–0.85).** Bigger than round 5 but copper (73,37,23, luma 43) against the mockup's dark brown double ring (38,15,12, luma 18) spanning x 0.33–0.85. 3. **Sky and sand.** The sky is still plum (53,38,68) against the mockup's blue-violet starfield (49,46,92). The sand is still brighter (48 vs 37) and now carries visible ripple bands and grain where the mockup's dusk sand is dim and even (fine 5.3 vs 1.7). |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 4 / 5 / 6 / 6 / 5 / 5 | 1. **The backdrop (x 0–1, y 0.22–0.55).** The reshaped dunes put a dark dune face behind the whole brazier: its top edge runs at y 0.36–0.40 across the frame. The mockup has the bowl against open sky over a low flat horizon at y ≈ 0.53, and the next waymark standing on the right horizon (x 0.89, "WAYMARK 64 M"). In round 5 that next waymark and its plume showed at x 0.83; in round 6 it is hidden behind the dune (x 0.55–1, y 0.25–0.5 at 1.2×). A subject of the mockup is gone. 2. **The flame (x 0.3–0.47, y 0.26–0.40).** The Λ is gone: the crown logs are short, charred and invisible above the rim, and the unlit bowl in `h3-waymark` shows no red glow. The pool is now the mockup's value (44 vs 40; round 5 76). But the flame is still smooth cream tongues: it got brighter by getting paler (1 834 saturated-orange pixels against the mockup's 13 468, a white-hot core of 375 against 5 557). The mockup shows burning logs inside a ragged orange mass; the game shows no fuel at all. Embers are white dots, not orange streaks up-left. 3. **Brazier and hand.** A clean brick plinth and twisted copper column against sooty iron on fieldstone; the copper coil against the mockup's big low dark rings. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **4.5** | 4 / 4 / 4 / 5 / 4 / 4 | 1. **The terrain (x 0–1, y 0.36–0.85).** The real camera dropped 3.1 m into a trough, and a near slip face now fills the left two thirds from y 0.37 down, covered in whorled ripples. The mockup is a flat horizon at y 0.51 over long parallel dark-lined bands and smooth near sand. The tower is more buried than in round 5: only its top half shows over the tower dune (x 0.72–0.86, y 0.38–0.46), still under its "SIGNAL TOWER 197 M" chip. 2. **The hero hand (x 0.4–1, y 0.56–0.86).** The mockup's subject is a dark brown plait (luma 22) with lit strand edges beside a creased, stitched gauntlet (detail 8.6, p99 119). The game's coil is a copper fishnet (luma 52) and the glove is a smooth dark mitt (luma 18, detail 1.9, p99 58) with bead-like finger segments. 3. **Light and colour (y 0.30–0.55; ground).** The zenith still matches (30,32,73 vs 27,31,70), but the mid-sky is 40 against 57 and the afterglow peaks at 88 in a thin stripe where the mockup climbs to 155 across y 0.40–0.50. The ground went dark red (44,18,18 against 58,34,31). |

**Seat score, Signal Dunes: (6.0 + 5.5 + 6.0 + 5.5 + 4.5) / 5 = 5.5** (this seat: round 1 4.8, round 2 5.3, round 3 5.3,
round 4 5.4, round 5 5.7)

What gained: the sand's grain (fine detail ×2); the near sand's mean in A and dusk-fire; the brazier's Λ and the glowing
logs on the unlit bowl gone; C's pool at the mockup's value; the vertical smear gone; the coil bigger.

What gave it back: the dunes' lit/shade modelling (macro spread halved in dusk-fire); the coil's colour; the dune reshape
putting a slope in front of D's camera and a dune behind C's brazier (the next waymark lost); D's ground darker and redder.

## Builder's claims checked against the frames and the code

| Claim (round-6 README) | Verdict | Evidence |
|---|---|---|
| dusk-fire spread 62/45, fine 8.5/6.5 | **Fine detail true; the spread did not move** | This seat's patch: spread 44 (round 5 45; mockup 64), fine 6.1 (2.8; 8.7). The commit's "was 35" is not round 5's capture on this patch. The macro (form) spread on the dune band fell 56 → 27. |
| A spread 79/50, fine 7.2/6.6 | **Fine detail true; spread slightly down** | Spread 55 (r5 59; mockup 91), fine 5.9 (3.0; 7.8). |
| D spread 53/45 | **True in number, for the wrong reason** | 42 (r5 23; mockup 53). The rise comes from a near slip face that entered the frame and a darker floor (p5 27 → 10), not the mockup's long dark-lined bands. |
| B 34/42; C 67/77 | **Direction true** | B 53 vs 36 on this patch (B's ground is still bright and now textured). C 82 vs 81: the pool came down. |
| Anisotropic grain with cm and mm octaves | **True** | Detail ×2 on every foreground; visible speckle at 1.2×. The grain is dark speckle stretched sideways (a woven look at 1.2×); the mockups' grain has bright glints too. |
| Noise-bent ripple crests, not sine stripes | **Weakly** | At 1.2× the dusk-fire and A foreground ripples are still near-parallel horizontal bands; the bend is slight. No lit crowns or dark troughs (foreground macro 20–21 vs 31–54). |
| Ripples on slip faces so shade faces carry texture | **True, but the shade face itself is gone** | The dome carries ripples (dusk-fire, A, aerial-spawn). The round-5 shade face patch is now 46 (sd 3) against the mockup's 32 (sd 10). |
| Charred unlit logs, no glow unlit, only their ends over the rim | **First two true; the ends do not show** | `places.ts` `kindling`: emissive removed, lean −1.15, length 0.26–0.32. h3's unlit bowl has no red; C shows no logs at all inside the flame at 780 px, where the mockup shows a burning log pile. |
| Brighter flame with half the light pool | **True in value; colour moved away** | Brights 189 → 201 (mockup 215); pool 76 → 44 (40). Saturated orange pixels fell 3 176 → 1 834 (mockup 13 468): `fireFx.ts` scaled the body ×1.35, which pushes the tongues toward cream. |
| The whip a crossing plait | **Not as rendered** | At 2–3× the coil is a regular square-diamond lattice of thin dark lines over bright copper cells (a fishnet or snakeskin), evenly lit round the tube. The mockups' strands are long lozenges at ~45°, dark, each with one bright rim. The commit applied the plait "before the leather desaturation so it stays copper-brown": the result is copper at 2.5× the mockups' value. |
| The coil bigger and low | **True, still ~55 % of the two-ring mockups** | `HD_GLOVE` size 0.22 → 0.3, rot z 0.25 → 0.3: one constant, the same in h1, h3, h4 and the clip. A: x 0.34–0.63 against 0.33–0.86. |
| The reshaped dunes (WAVE 128 → 72, AMP 22 → 12, CRESTS lift 20, ease 70) put crests and saddles between the camera and the tower | **Global, not visible from the views** | `dunes.ts` and `layout.ts` are field-wide constants, re-baked; the aerials and the clip show the shorter wave everywhere (no shot-only ground). From the 13 m eye in A and dusk-fire no intervening crest line reads; in C and D the change moved terrain into the frame against the mockups. |
| Known short: C and D darker; the stitching faint | **True** | D 44,18,18 vs 58,34,31; glove detail 1.9 vs 8.6. C's ground is in fact near (56,26,21 vs 62,31,22). |

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Region | Fix |
|---|---|---|---|---|
| R6B-1 | all five (D is the hero) | must-fix | coil, x 0.33–0.63, y 0.58–0.85 | **The coil's material regressed to copper fishnet.** Strands measure 89–97,43–48,22–25 (luma 52–58) against the mockups' 38–45,15–23,12–20 (luma 18–22); round 5's coil was ~33. Keep the new size. In `whipModel.ts`, apply the leather darkening/desaturation after the plait so the base returns to the mockups' dark brown, and change the pattern from a square lattice to the mockups' lozenges: one strand set running at ~45° round the tube, each strand shaded across its width (dark at both edges, one narrow bright rim on the lit side), with the dark gaps between strands. Check at 3× against D's strip. |
| R6B-2 | dusk-fire, A (B, D) | must-fix | dune band y 0.38–0.62; foreground y 0.6–0.85 | **Put the form back without losing the grain.** Dune-band macro spread 27 (dusk-fire) and 43 (A) against 46 and 70; the tower dune's camera face 46 against a 32 shade face; lit p95 81 against 109. Keep the new grain and the near-field mean (~58–61). Restore a crisp terminator on the dune faces (the slope term from the terrain normal against the low key, steeper in its response), keep shade faces at ~30–35 with their ripples, and lift the lit stoss faces and ripple crowns to p95 ~105–115. Target: the 10×10 grid shows the mockup's lit block (80–88) beside a shaded saddle (42–48) in dusk-fire and A's alternating diagonal lit/shade bands. |
| R6B-3 | D, C | must-fix | D x 0–1, y 0.36–0.85; C x 0–1, y 0.22–0.55 | **The field-wide reshape moved terrain against two mockups.** D: the real camera dropped 3.1 m into a trough facing a slip face; the mockup's flat horizon and long bands are gone, and the tower is more buried. C: a dune now fills the sky behind the brazier and hides the next waymark, a mockup subject. Fix in the terrain the player walks, not per shot, and show it in the aerials: the mockups place the waymark route and the east approach to the tower on low, long transverse bands with broad flat interdunes. Give those regions the lower amplitude and longer wave (a regional amplitude falloff along the waymark line and east of the tower, as `PADS` already do locally), and ease the tower dune's east flank so the tower stands whole from (118, 88). Re-bake, walk 0 stuck, re-check h3 and both aerials. |
| R6B-4 | C (h3, h4: every brazier) | should-fix | C x 0.3–0.47, y 0.26–0.50 | **The flame is brighter but paler, with no fuel.** Saturated orange 1 834 px against 13 468; core 375 against 5 557. Keep the pool (44 ≈ 40). In `fireFx.ts`, keep the edge colour saturated orange rather than scaling the whole body by 1.35; add a white-yellow core low in the flame. Show the log pile's glowing ends inside the bowl when lit (they are invisible at 780 px). Embers as orange streaks drifting up-left. Sooty iron and fieldstone for the brazier and plinth. |
| R6B-5 | D (all) | should-fix | glove x 0.55–1, y 0.6–0.86 | **The gauntlet's surface.** Luma 18 vs 32, p99 58 vs 119, detail 1.9 vs 8.6. Add a normal or detail map carrying seams, stitching and knuckle creases; lift the base toward ~32 and break the sheen into many small highlights. The fingers read as beads; give them the mockup's wrapped, creased leather. |
| R6B-6 | D, B | should-fix | D ground y 0.55–0.85; D sky y 0.30–0.50; B sky | **Colour.** D's ground is 44,18,18 against 58,34,31: lift and neutralise it. D's afterglow should climb to ~155 across y 0.40–0.50 (today a peak of 88 in a thin stripe), with mid-sky ~57 (today 40). B's sky toward 49,46,92 (today 53,38,68) and its sand down to ~37. |
| R6B-7 | A, dusk-fire | should-fix | y 0.12–0.40 | **The clouds, unchanged since round 5.** Pale peach flakes in rows edge to edge. A: broken red-orange patches with dark undersides, low (y 0.19–0.32). Dusk-fire: a few grey-brown banks at the right only (x 0.65–1, y 0.25–0.35), the sky orange-brown above. |
| R6B-8 | B | should-fix | x 0.12–1, y 0.39–0.53 | **The camp, unchanged since round 5** (R5B-6): the wagon's light falling off from the lantern, a lantern glow, light reaching the crates, the tent small and dark behind a side-on horse, a widening plume. |
| R6B-9 | aerials | nit | `aerial-spawn` x 0.4–0.6, y 0.3–0.85; `aerial-overview` x 0.55–0.9, y 0.45–0.6 | A wide soft dark band runs from the tower toward the spawn, much wider than a lattice tower's shadow, and a jagged dark blob lies beside the tower in the overview. Check whether the baked shadow map's resolution is smearing the tower's cast shadow; a lattice should cast a thin hatched shadow. |

## No-shortcut check (ledger 5)

- **Views:** the cameras blob is unchanged (`d78968c7`). The real camera heights moved 3–8 m because `dunes.ts` (WAVE,
  LEE, AMP_MAX) and `layout.ts` (CRESTS lift 20, ease 70) changed field-wide. No camera was re-aimed.
- **Ground shaped for the shot? No.** The change is a global wave constant plus the tower dune, re-baked into the terrain
  and the navmesh. The aerials and the clip show the shorter wave and its crescent ripple fields across the whole field,
  and the hero views (h1, h3, h4) show the same dunes. It helped none of the views' compositions and hurt C and D, which is
  the opposite of a shortcut.
- **Staged state: reachable.** No commit touched `stage()` or `duskOf` between the captures. `meta.json` lists B
  (`logbook`) and C/D (`waymarks-lit`); earlier rounds traced both to the player's own handlers. C keeps its flame,
  embers, plume, pool and toasts ("STEP COMPLETE · LIGHT THE WAYMARKS", "OBJECTIVE · LIGHT THE SIGNAL FIRE").
- **The glove's idle hold:** one constant, `HD_GLOVE` (size 0.3, pos (0.05, −0.23, 0), rot (−0.45, 0, 0.3)), with no
  camera branch. h1, h3, h4 and the clip show the same coil and fist as the mock views. No frozen pose.
- **Painted stand-ins:** none in the playable area. The range and clouds are at infinity. The clip still shows pale
  strips between the range layers (a look defect at infinity, not a breach).
- **Device, HUD:** 390×844 phone and touch, stored 780 wide, baseline HUD, 0 page errors. The fps chip reads 30 (red in
  dusk-fire and B, amber elsewhere); this surface has no frame-time or memory trace, so the budgets are unverified here,
  not breached.

SCORE signal-dunes: 5.5

# Round 5, seat B, Signal Dunes (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-5/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0057-56c23085/` (780×1688: every `mock-*`, the four hero views, both
aerials, `clip.mp4` sampled at 0.8 fps); round 4's `progress/sunscar-dunes/20261003-0019-8221a34a/` for before/after; the
five ledger mockups at full resolution. Each mockup was scaled to 780×1688 and set beside the round-5 and round-4 frames,
then cropped region by region (the dune band, the sky band, the foreground, the wagon, the brazier, the glove at 2×, the
unlit bowl in h3 at 2×). All values are Rec. 709 luma (0.2126 R + 0.7152 G + 0.0722 B) and RGB means, measured with numpy
on the same patches round 4's seat B used, so the columns compare across rounds: sky 500×300 @40,300; zenith 400×150
@40,200; ground 500×250 @40,1050; the lower-left ground's p5–p95 over x 50–390, y 880–1350 (Sefa masked out in A); fine
detail is the mean |luma − Gaussian-blurred luma| (σ 2 px) over the ground patch. Round 4's numbers reproduce to within
±2, so the method matches. Source checks: the diff `8221a34a..56c23085` in `src/shards/sunscar-dunes/` (9 files; commits
`7f5d30dcb`, `0d4101be0`); `meta.json` (cameras blob `d78968c7`, unchanged, and the new `camAt`). Regions are fractions of
the frame (x left → right, y top → bottom). Per-dimension marks: composition and subject (Comp), forms and silhouettes
(Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands / weapon / HUD (Hands).

## Measurements (mockup / round 5 / round 4)

| View | Sky patch (luma) | Zenith | Ground patch (luma, sd) | Lower-left ground p5–p95 (spread) | Fine detail, ground |
|---|---|---|---|---|---|
| dusk-fire | 104,69,56 (76) / 136,83,78 (94) / 133,81,78 (92) | 55,48,52 / 59,40,65 / 59,40,65 | 107,62,36 (70, 24) / 115,65,37 (73, 20) / 111,59,34 (68, 12) | 42–106 (64) / 47–92 (**45**) / 41–77 (36) | 8.6 / **2.7** / 1.8 |
| A spawn | 133,77,69 (88) / 124,75,76 (86) / 123,75,76 (85) | 49,42,68 / 55,38,63 / 55,38,63 | 92,53,36 (60, 27) / 111,63,38 (72, 23) / 109,59,35 (68, 15) | 19–110 (91) / 47–95 (**48**) / 42–79 (37) | 7.7 / **2.9** / 2.2 |
| B logbook | 49,46,92 (50) / 53,39,69 (44) / 55,37,64 (42) | 29,33,75 / 34,28,59 / 33,24,52 | 59,32,26 (37, 12) / **72,43,36 (49, 16)** / 85,51,40 (58, 14) | 16–52 (36) / 33–85 (52) / 44–95 (51) | 1.7 / 3.9 / 4.2 |
| C waymark | 63,47,71 (52) / 44,36,59 (**39**) / 39,27,43 (31) | 44,35,58 / 35,35,69 / 22,16,38 | 63,31,23 (37, 10) / 78,42,29 (49, 30) / 86,46,30 (53, 32) | 23–105 (81) / 9–113 (104) / 14–122 (109) | 0.8 / 1.3 / 1.0 |
| D hands | 49,46,91 (50) / 38,34,73 (**38**) / 27,17,47 (21) | 28,31,70 / **30,33,74** / 13,9,36 | 58,35,31 (40, 17) / **57,31,30 (36, 9)** / 70,39,37 (45, 8) | 11–64 (53) / 27–49 (**23**) / 39–59 (20) | 1.5 / 1.3 / 1.0 |

Named patches (luma mean, sd; mockup / round 5 / round 4):
- **dusk-fire shade face** (mockup x 0.3–0.6, y 0.385–0.41; game x 0.28–0.40, y 0.44–0.52): 38,30,34 (32, sd 9.8) /
  **43,25,34 (29, sd 1.7)** / 19,1,1 (5, sd 1.7).
- **dusk-fire lit lower-left sand** (x 0.02–0.4, y 0.62–0.8): 74 (sd 20) / 81 (sd **8**) / 71 (sd 4).
- **A, a 20×13 luma grid over the dune band (y 0.36–0.60).** The mockup alternates four diagonal lit faces (100–117)
  with shade faces (33–45) down the band. The game has one dome: a lit left flank at 55–87 and a uniform shade block of
  28–31 (x 0.5–0.85, y 0.40–0.53, sd 1.5). The brightest dune face in the game's band is ~87, against the mockup's ~115.
- **Glove, D** (mockup x 0.73–0.85, y 0.65–0.71; game x 0.61–0.71, y 0.675–0.74): 63,36,27 (41, sd 30, p99 131,
  detail 9.2) / **42,22,19 (26, sd 20, p99 105, detail 3.4)** / 64,26,20 (34, sd 12, p99 57).
- **Flame, C** (pixels above luma 150 in the flame box): 252,211,138 (214, p99 254) / 237,181,119 (188, p99 216) /
  242,190,130 (196).
- **Firelight pool, C** (round the plinth): 81,38,23 (**46**) / 145,87,44 (**97**) / 158,98,50 (107).
- **Wagon canvas, B**: 114,62,44 (72) / 125,65,30 (75) / 40,9,6 (16).

Reading:
- The black hole is gone. The shade faces now sit at the mockups' level (29 vs 32) and in a cool violet-brown. But they
  are flat: sd 1.7 against the mockup's 9.8, so no ripple or grain reads inside them.
- The lit sand rose only a little: the dune band's brightest faces are ~87 against ~115, and the lit foreground has 40 %
  of the mockup's internal contrast (sd 8 vs 20). So the spread grew from 36–37 to 45–48, but that is still half of A's
  91 and 70 % of dusk-fire's 64.
- The fine detail moved 1.8–2.2 → 2.7–2.9, a third of the mockups' 7.7–8.6.
- The late skies are now blue-violet. D's zenith matches (30,33,74 vs 28,31,70); its sky patch is 38 against 50; C's is
  39 against 52.
- The glove is now a neutral dark brown, a little darker than the mockup's, with a real highlight. Its detail is still a
  third of the mockup's.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **6.0** | 6 / 5 / 5 / 6 / 6 / 6 | 1. **The tower dune's shade face is flat, and its edge is a smear (x 0.22–0.6, y 0.38–0.53).** It is a cool violet-brown now (43,25,34 against the mockup's 38,30,34), where round 4 had black. But it is one tone (sd 1.7 vs 9.8) and its left edge is a soft vertical band at x 0.22–0.27 that follows no crest. The mockup's shaded dune has a crisp crest line and a separate shaded near saddle across y 0.5–0.6, with a lit left shoulder. The game's lit shoulder is on the right (x 0.6–1, y 0.46–0.52, luma 80–90), and the left foreground is a flat swale. 2. **Sky (y 0.14–0.38).** The mockup is orange-brown to high up, with a few muted grey-brown banks at the right (x 0.65–1, y 0.25–0.35) and the ray over the lit tower lamp. The game has a violet upper sky full of pale peach cloud flakes across the whole width. They are broader and less hatched than round 4's, but still pale, with no dark cores reading (band brights 230,158,100 vs 200,118,69). There is no ray and the lamp is unlit (a reachable, unstaged state). 3. **Hand and sand (x 0.45–1, y 0.55–0.85).** The hold now lies the mockup's way: a loop leaning left with the fist low right. The glove is dark brown leather with a cuff. But the coil is about half the mockup's loop and reads as a pale grey-brown tube with bead-like segments, not a crisp dark plait with bright strand edges. The foreground sand has a third of the mockup's fine detail (2.7 vs 8.6). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.5** | 5 / 4 / 5 / 6 / 5 / 5 | 1. **One dome, not receding crests (x 0–1, y 0.37–0.60).** The grid above: the mockup's four diagonal knife-edge crests, each lit to 100–117 beside a 33–45 shade face, recede to the tower on the farthest. The game shows one smooth dome that fills the band: a lit flank at ≤ 87 and a uniform shade block at 28–31. Behind it is a flat plain and a flat lavender range cut-out. The shade is no longer black (luma 4 → 29): that is the round's real gain. 2. **Sky (y 0.17–0.38).** The means match (sky luma 86 vs 88). But the mockup's broken red-orange cloud patches with dark undersides, low over the horizon (241,134,59 at the brights), are peach flakes in the game (221,151,97), spread up to y 0.17. 3. **Foreground and hand (y 0.6–0.92).** The mockup has bold grazing ripples and grain to the bottom edge (spread 91, detail 7.7). The game has regular sine ripples in one mid-brown (spread 48, detail 2.9). The mockup's two big low coils span x 0.34–0.85, y 0.6–0.84. The game's loop spans x 0.45–0.68, y 0.63–0.78: low and leaning left as ruled, but under half the size. Sefa and her chip are the quest's real first step, and stay. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 7 / 6 / 5 / 5 / 6 / 5 | 1. **The wagon now glows, as if lit from within (x 0.38–0.62, y 0.39–0.52).** The canvas is lit, with hoop ridges and torn edges at the back (luma 16 → 75; the mockup's 72). But it is one flat saturated orange (125,65,30) from end to end, with no falloff from the lantern. The opening is a pale flat panel, and the lantern itself has no glow. The mockup's light pools round the lantern and leaves the canvas sides dim and pale. The crates and sacks at the left (x 0.12–0.3, y 0.47–0.51) are still black slabs; the mockup lights them warm. 2. **Tent and horse (x 0.86–1, y 0.43–0.51; x 0.78–0.82).** The tent is still a large flat plane leaning off the right edge, darker than round 4 but the same shape. The mockup's tent is small and dark, behind a side-on pack horse. The game horse is end-on. The smoke is still a narrow straight column. 3. **Sky and ground (y 0.05–0.45; y 0.55–0.9).** The sky is still purple-maroon (53,39,69, luma 44) against the mockup's blue-violet starfield (49,46,92, luma 50): about 23 short in blue. The sand is still too bright (luma 49 vs 37), with a bright pool under the wheels and broad diagonal bands where the mockup has dim, even sand. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 6 / 5 / 4 / 5 / 6 / 5 | 1. **The fire and its logs (x 0.27–0.47, y 0.30–0.50).** The red bars no longer pierce the bowl. But the crown logs now stand as a tall tepee of flat, unshaded, saturated red sticks. In C it reads as a dark-red "Λ" inside the flame. On the unlit bowl in `h3-waymark` (x 0.4–0.6, y 0.47–0.52, 2× crop) it is a glowing red cone above the cage, with the brazier not burning. The flame is still a few smooth pale-peach tongues (brights 237,181,119, p99 216) against the mockup's ragged orange mass with a white-hot core (252,211,138, p99 254), over a pile of glowing logs. The embers are a few white dots; the mockup's are orange streaks sweeping up-left. 2. **The pool and backdrop (y 0.28–0.7).** The pool is twice the mockup's value (luma 97 vs 46) and is a pale band across x 0.15–0.55, not the mockup's tight saturated glow round the plinth. A dark dune shoulder still fills the upper left behind the bowl, where the mockup has a low flat horizon and sky. The sky patch is 39 against 52. The plinth is clean brick, not fieldstone, and the post is a twisted rope. 3. **Hand (x 0.45–1, y 0.6–0.9).** The mockup's hand is a big low dark coil, backlit. The game's is the smaller left-leaning loop. The next waymark is right at x 0.83. The "5 M" chip is still cut at the left edge (x 0, y 0.25). |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.5** | 5 / 4 / 5 / 6 / 5 / 6 | 1. **The hand (x 0.45–1, y 0.58–0.85).** The leather is now a neutral dark brown (42,22,19 against 63,36,27), with a sheen (p99 105 vs 131) and a cuff, and the white thumb patch is gone. But at 2× the stitched panels, creases and crackle of the mockup's glove do not read (detail 3.4 vs 9.2). The plait reads as stacked beads in a pale grey-brown, not crisp crossing strands. Under the ruling, the loop leans left and low; the mockup's stands upright beside the fist. That difference is a consequence of the ruling, and visible. 2. **Dune forms (x 0–1, y 0.43–0.85).** Unchanged from round 4. The mockup has long flat parallel bands with dark lee lines over smooth near sand (spread 53). The game has the tower dune's hump across x 0.5–1, y 0.43–0.52, with diagonal whorled ripples over all the near sand (spread 23, half). The ground mean is now right (luma 36 vs 40). 3. **Sky and tower (y 0.05–0.47; x 0.8–0.9, y 0.40–0.45).** The zenith now matches (30,33,74 vs 28,31,70), the round's other gain. But the sky patch is still darker (38 vs 50), and the afterglow is a thin hot orange stripe, not the mockup's broad peach-to-pink band. The tower's lower half is still behind the dune crest, and its "SIGNAL TOWER 197 M" chip covers the cabin. |

**Seat score, Signal Dunes: (6.0 + 5.5 + 6.0 + 5.5 + 5.5) / 5 = 5.7** (this seat: round 1 4.8, round 2 5.3, round 3 5.3,
round 4 5.4)

What gained:
- the shade faces are out of black, and are a cool violet-brown;
- the late skies are blue-violet, and D's zenith matches;
- the glove is brown leather with a sheen;
- the bars no longer pierce the bowl;
- the wagon catches light;
- the stepped bar on the far sand is gone.

What still holds it near 6:
- the landforms: one dome in A and dusk-fire, and the diagonal hump with ripples in D;
- the lit side is still dim, so the spread is half of the mockups';
- the sand has a third of the mockups' detail;
- the clouds;
- the fire's finish, now with a red tepee in place of the red bars;
- a coil half the mockups' size.

## Builder's claims checked against the frames and the code

| Claim (round-5 README) | Verdict | Evidence |
|---|---|---|
| The shade faces cool violet-brown, not black | **True on value and hue; flat** | dusk-fire 43,25,34 (luma 29) against the mockup's 38,30,34 (32). But sd 1.7 against 9.8. The edge is still a soft vertical smear (dusk-fire x 0.22–0.27; A x 0.47–0.52). |
| Brighter lit crests | **Slightly** | dusk-fire's lit foreground is 71 → 81, but the dune band's lit faces are ≤ 87–90 against the mockups' 100–117, and the p95 of the dune band is 90–95 against 99–112. |
| A's spread 62 (mockup 79, was ~40); dusk-fire's 34 (mockup 62) | **Direction confirmed, on another region** | On round 4's lower-left patch: A 37 → 48 (mockup 91), dusk-fire 36 → 45 (mockup 64). The builder's band differs from this seat's. Both agree the spread is short by a third to a half. |
| D's ground (57,30,31) vs (60,37,33); D's zenith (31,33,74) vs (32,34,75) | **True** | Ground 57,31,30 vs 58,35,31; zenith 30,33,74 vs 28,31,70. But D's sky patch lower down is 38 against 50 luma, and its ground spread is 23 against 53. |
| The logs back inside the bowl | **True; a new defect replaces the old one** | No bar passes the cage (C, h3, h4). The crown logs now stand as a tall flat-red tepee, glowing on the unlit h3 bowl, and a dark-red Λ inside C's flame. Round 3's seats flagged the same Λ. |
| The glove neutral dark brown with a sheen; the thumb patch fixed | **True** | 42,22,19, p99 105 (round 4 64,26,20, p99 57). No white patch at 2×. Detail 3.4 vs 9.2. |
| The idle hold the big low coil (the ruling): fist low right, loop leaning left and low | **Pose true, size not** | `whipModel.ts` `HD_GLOVE` is one constant (size 0.2 → 0.22, rot (0,0,0) → (−0.45, 0, 0.25)), with no camera branch. The hero views show the same hold. The loop is ~0.23 of the frame wide against the mockups' ~0.5 (A, B). |
| The sunset clouds as irregular banks with dark cores | **Partly** | The flakes are broader and less hatched than round 4's (A, dusk-fire sky crops). They are still pale peach, spread to y 0.17, and their dark cores barely read. They are not the mockup A's red-orange broken patches or dusk-fire's grey-brown banks. |
| The late skies blue-violet | **True for C and D, short for B** | C's zenith 35,35,69, D's 30,33,74. B's sky is still 53,39,69 against 49,46,92. |
| The tent dark canvas | **Darker, same shape** | It is still the large flat plane at the right edge, not the small tent behind the horse. |
| The far-sand stepped strip fixed | **True for the strip** | The long stepped dark bar is gone from `aerial-overview` and the rectangle from `aerial-spawn`. Soft round dark blobs remain at those places (`aerial-spawn` x 0.38–0.45, y 0.2–0.23; `aerial-overview` x 0.4–0.45, y 0.24–0.3). |
| The wagon lit by its own lantern (`7f5d30dcb`) | **Lit, but uniformly** | The canvas went from luma 16 to 75 (the mockup's 72), but it is evenly saturated orange with no falloff from the lantern, and the lantern has no glow. |
| Flame orange with a small core | **Not visible** | The brights are paler than round 4 (237,181,119 vs 242,190,130) and much paler than the mockup's (252,211,138, p99 254 vs 216). |
| "No commit touched staging code" | **Inexact** | `plugin.ts` `duskOf` changed: SCOUT_FLAG 0.25 → 0.38 (`0d4101be0`). `stage()` snaps to `duskOf`, so B's staged dusk moved. It is the same function play reads every frame (`sunscar.dusk` system), so the change is global and reachable (see below). But the round's list should name it. |

## No-shortcut check (ledger 5)

- **Staged state: reachable.** `stage()` itself is unchanged.
  - B's dusk is now 0.38. It comes from `duskOf`, which the update system also calls each frame, so a player who has
    talked to Sefa eases to 0.38 at 0.02/s within ~20 s.
  - C and D run the player's own path (the logbook, well, oil, each brazier's interact and light), as earlier rounds
    verified. All three are in `meta.json` `staged`.
- **A staged frame is a real play frame.**
  - The viewmodel is the single `HD_GLOVE` constant, the same in h1–h4 and the clip, with no per-camera transform. The
    ruled low coil is one hold for every view.
  - C keeps its flame, embers, plume and toasts. No breach.
- **Views:** the cameras blob is still `d78968c7`, so no re-aim. `camAt` is recorded for the first time. No camera
  height can be compared yet.
- **The look is global.**
  - The h1–h4 hero views and the aerials show the same violet shade faces, cloud flakes, brown glove, lit wagon and
    red tepee as the mock views.
  - `keyAt`, the fill floor and the sky changes are in `look/`, not keyed on a capture.
  - The red tepee is in h3 too, so the mock views hide nothing worse.
- **Painted stand-ins:** none in the playable area; the range is at infinity.
- **Device, HUD, budget:** 390×844 phone, stored 780 wide, baseline HUD, 30 fps chip, 0 page errors. Parity is reported
  green at `0d4101be0` (the capture commit's message); the capture commit `56c23085` adds only progress files. No breach.

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Region | Fix |
|---|---|---|---|---|
| R5B-1 | A, dusk-fire (D) | must-fix | A x 0–1, y 0.37–0.60; dusk-fire x 0–1, y 0.38–0.62 | **The landform is the biggest gap left, now that the light is near.** A's mockup has four diagonal crests receding to the tower, each a lit face (100–117) beside a shade face (33–45). The game has one dome. Keep the tower dune, and add the intervening diagonal crests between the spawn (0, 21.3, 70) and the dome in the real terrain (`layout.ts` CRESTS). Each crest needs a sharp crest line, so the lit/shade split runs along it: take the terminator from the terrain normal against the key, and use the baked map only for cast shadow. That also removes the vertical smear at dusk-fire x 0.22–0.27 and A x 0.47–0.52. For dusk-fire, add the shaded near saddle across y 0.5–0.6 with the lit shoulder on the left. Re-bake, walk 0 stuck. Re-measure the 20×13 luma grid against the mockup's alternation. |
| R5B-2 | A, dusk-fire, D | must-fix | lit faces and foreground, y 0.4–0.9 | **Texture and highlight in the sand, not more mean.** The shade faces are at the right value but flat (sd 1.7 vs 9.8). The lit faces top out ~87–90 (mockup 100–117). The lit sand's sd is 8 against 20, and the fine detail is 2.7–2.9 against 7.7–8.6. Carry the ripple and grain modulation into the shade (the fill term should be modulated by the same ripple normal), lift the grazing highlight on the crest edges and the near ripple crests, and add grain-scale variance. Targets: shade-face sd ≈ 10, the lit p95 ≈ 100–110, detail ≥ 6 on the ground patch. In D, the near sand should be smooth and the middle long transverse bands (R4B-7, still open). |
| R5B-3 | C (h3, h4: every brazier) | must-fix | C x 0.3–0.45, y 0.38–0.48; h3 x 0.4–0.6, y 0.47–0.52 | **The red tepee.** The crown logs (`world/places.ts` `kindling`) now stand as a tall cone of flat, unshaded, emissive red sticks. They glow on an unlit bowl, and read as a dark-red Λ inside the lit flame. Lay them as a low, charred pile inside the rim, with only their ends glowing, and no emissive until the brazier is lit. Then the flame: orange tongues with a white-hot core (the mockup's brights 252,211,138, p99 254; today 237,181,119, p99 216), embers as orange streaks up-left, the pool a tight saturated glow round the plinth at luma ~46 (today 97, a pale band), fieldstone not brick. |
| R5B-4 | A, B, C, dusk-fire (D) | should-fix | x 0.3–0.9, y 0.58–0.86 | **The coil's size and finish.** The ruling's low left-leaning hold has landed, but the loop is about half the mockups' (A x 0.34–0.85 against the game's 0.45–0.68). Scale the coil, not the glove, toward the mockups' span in the one idle constant. The plait reads as pale grey-brown beads: make it the mockup's dark brown (~43,22,19 on D's coil) with dark gaps between two crossing strand directions and bright strand edges (a normal map or tighter bake). Bring the glove's detail up from 3.4 toward 9 (seams, creases, knuckle highlights; its p99 is already 105 of 131). |
| R5B-5 | A, dusk-fire | should-fix | y 0.14–0.38 | **The clouds still read as pale flakes.** Mockup A: broken red-orange patches with dark undersides, low (y 0.19–0.32), brights ~241,134,59. Dusk-fire: a few muted grey-brown banks at the right only (x 0.65–1, y 0.25–0.35), brights ~200,118,69. The game's are peach (221–230,151–158,97–100) across the whole band. Saturate and darken the cover toward those colours, confine it lower, and in dusk-fire thin it to the right-hand banks. |
| R5B-6 | B | should-fix | x 0.12–1, y 0.39–0.52; y 0.05–0.45 | **The caravan's light and the camp.** Make the wagon's firelight term fall off from the lantern (bright round the opening, dim pale canvas at the far end), not a uniform 125,65,30. Give the lantern a glow. Let the same light reach the crates at the left, which are still black slabs. Make the tent small and dark behind a side-on horse, and the smoke a widening plume. Pull the sky to blue-violet (today 53,39,69 against 49,46,92), and the sand down from luma 49 to ~37. |
| R5B-7 | D | should-fix | x 0.5–1, y 0.40–0.52 | **The tower is still buried, and under its chip** (R4B-7). Lower the tower dune's D-facing flank (an asymmetric ease) so the tower stands whole on the band line from (118, 88). Widen the afterglow from a thin orange stripe into a peach-to-pink band, and lift the sky patch from 38 toward 50. |
| R5B-8 | aerials | nit | `aerial-spawn` x 0.38–0.45, y 0.2–0.23; `aerial-overview` x 0.4–0.45, y 0.24–0.3 | The stepped strip is gone, but soft dark blobs remain where it was. Check that they are cast by real geometry; if not, they are the same baked-map edge, faded rather than removed. |
| R5B-9 | provenance | nit | round README | `duskOf`'s SCOUT step (0.25 → 0.38) is read by `stage()`. The README has since added a commit list naming it (after seat C), so this is closed. For round 6, generate the commit list from the diff of every file `stage()` calls into, not from `stage()` alone. |
| R5B-10 | dusk-fire | nit | x 0.2–0.6, y 0.08–0.3 | **The ray and the lit tower lamp** are still absent (R4B-10). The ray's normal glide, timed into this view, needs no staging. |

SCORE signal-dunes: 5.7

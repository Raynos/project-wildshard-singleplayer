# Round 4, seat B, Signal Dunes (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-4/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261003-0019-8221a34a/` (780×1688: every `mock-*`, the four hero views, both
aerials, `clip.mp4` sampled at 0.8 fps); round 3's `progress/sunscar-dunes/20261002-2351-a9e50413/` for before/after; the
five ledger mockups at full resolution. Each mockup was scaled to 780×1688 and set beside the round-4 and round-3 frames,
then cropped region by region at 1:1 (tower and dune, sky band, foreground, wagon, brazier bowl at 2.5×, glove at 2×
and 3×). Measured with numpy on luma (Rec. 709) and RGB means: the earlier rounds' patches (sky 500×300 @40,300; zenith
400×150 @40,200; ground 500×250 @40,1050), the ground's percentiles over the left lower frame (x 50–390, y 880–1350, clear
of the whip and HUD; Sefa masked out in A), named lit / shade patches, a glove patch (120×100 @620,1110) and fine detail
(mean |luma − Gaussian-blurred luma|, σ 2 px). Source checks at the capture's commit `8221a34a` (cameras blob `d78968c7`),
diffed against `a9e50413`. Regions are fractions of the frame (x left → right, y top → bottom). Per-dimension marks:
composition and subject (Comp), forms and silhouettes (Form), materials and detail (Mat), light and colour (Light),
density and depth (Depth), hands / weapon / HUD (Hands).

## Measurements (mockup / round 4 / round 3)

| View | Sky patch | Zenith | Ground patch | Lower-left ground p5–p95 (spread) | Fine detail, ground |
|---|---|---|---|---|---|
| dusk-fire | 104,69,56 / 133,80,77 / 92,64,82 | 54,48,52 / 59,40,65 / 50,45,79 | 106,61,36 / 111,59,34 / 93,54,40 | 42–104 (62) / 40–76 (36) / 35–68 (33) | 7.4 / 1.9 / 0.9 |
| A spawn | 132,77,69 / 122,74,76 / 145,94,85 | 49,42,68 / 54,37,63 / 76,55,80 | 92,52,36 / 108,58,35 / 100,59,43 | 19–110 (91) / 42–79 (37) / 50–73 (23) | 7.8 / 2.2 / 1.6 |
| B logbook | 49,46,92 / **54,36,64** / 57,49,86 | 28,32,74 / **32,24,51** / 39,40,77 | 59,31,26 / **84,51,40** / 77,47,40 | 16–51 (35) / 43–94 (51) / 46–66 (20) | 1.7 / 4.3 / 2.0 |
| C waymark | 63,47,70 / **38,27,42** / 44,40,61 | 43,34,57 / **22,16,37** / 22,32,54 | 62,31,22 / 85,46,30 / 93,58,43 | 23–104 (81) / 13–122 (109) / 37–119 (82) | 1.0 / 1.1 / 0.8 |
| D hands | 49,46,90 / **26,17,46** / 35,35,68 | 27,31,70 / **13,9,36** / 8,27,55 | 58,34,31 / 70,38,36 / 70,44,42 | 10–63 (53) / 39–58 (19) / 44–56 (12) | 1.8 / 1.0 / 0.8 |

Named patches (luma mean, sd):
- **dusk-fire shade.** The mockup's tower-dune face (x 0.3–0.6, y 0.385–0.41) is 32 (sd 9). The game's dark face
  (x 0.28–0.40, y 0.44–0.52) is **4 (sd 1)**.
- **dusk-fire lit.** The mockup's lit lower-left sand is 75 (sd 18); the game's is 68 (sd 7).
- **A.** The mockup's lit face is 88 and its shade face 34. The game's shade (x 0.62–0.75, y 0.45–0.52) is **4 (sd 1)**.
- **Glove (D).** The mockup is 47,27,24 (luma 32, sd 20, detail 8.3). Round 4 is **37,8,4** (luma 14, sd 12, detail
  1.5). Round 3 was 95,63,48 (luma 69).

Reading:
- The tonal spread moved, but only toward black. The darks now reach 4 where every mockup's shade face sits at ~32–34
  and keeps its texture.
- The lights stayed low: p95 is 76–79 against the mockups' 104–110 in A and dusk-fire.
- So the spread is still 40–60 % of the mockups', and it now has a black hole in the middle of the subject.
- The late skies (B, C, D) went from teal to maroon, but also to about half the mockups' value, with less blue.
- The glove left the fog. It overshot to a saturated red-black at less than half the mockup's value, with a fifth of its
  fine detail.

## Signal Dunes (sunscar-dunes)

| Mockup → view | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` | **5.5** | 6 / 5 / 4 / 5 / 6 / 4 | 1. **The tower dune's face is a black hole (x 0.25–0.5, y 0.38–0.52).** The subject is back: the tower crowns a big dome, and with pitch −10 the horizon sits at y ≈ 0.38 (mockup 0.34, round 3 0.48). But the dome's camera face is a featureless near-black blob (luma 4, sd 1, no ripples) with a straight near-vertical left edge and a dark red seam along its lower edge (x 0.6–0.8, y 0.52). The mockup's face is a textured violet-brown shade (32) under a crisp crest line. The mockup's broad flat-topped dune and the shaded near saddle across the centre (y 0.5–0.6) are still a dome over a flat plain. 2. **Sky (y 0.12–0.38).** The mockup is orange-brown, with a few grey-brown banks lit from below at the right (x 0.65–1, y 0.25–0.35) and the dark ray over the tower. The game has a violet upper sky full of hard-edged cream brush strokes with dark fringes across the whole width. There is no ray, and the tower lamp is unlit (an unstaged, reachable state). 3. **Hand and sand (x 0.5–1, y 0.55–0.85; x 0–0.5, y 0.6–0.85).** The mockup has one low diagonal loop of crisp dark plait and a creased glove at the bottom edge. The game has D's upright fist with an orange beaded coil. The foreground sand carries a quarter of the mockup's fine detail (1.9 vs 7.4) and no lit highlights (p95 76 vs 104). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **5.0** | 5 / 4 / 4 / 5 / 5 / 4 | 1. **Dune forms (x 0–1, y 0.39–0.6).** The mockup has three overlapping knife-edge crests sweeping diagonally, each a lit face (88) beside a violet shade face (34), with the tower on the farthest. The game has one smooth dome filling the band, its right half a black blob (x 0.5–0.83, y 0.39–0.55, luma 4) behind a vertical terminator under the tower. Round 3's low layered ridges are gone behind it. The tower is now ~1.4× the mockup's lattice height (was ~1.8×). 2. **Sky (y 0.17–0.38).** The means are now close (sky 122,74,76 vs 132,77,69; zenith 54,37,63 vs 49,42,68). But the mockup's broken orange-red cloud patches, lit from below and confined to y 0.19–0.32, are rows of thin cream strokes with dark fringes in the game, stretched along one axis. The far range is a flat lavender cut-out where the mockup has layered blue-grey ranges. 3. **Foreground and hand (y 0.6–0.92).** The mockup has bold grazing ripples and grain glints to the bottom edge (detail 7.8, spread 91). The game has faint low-contrast bands (2.2, spread 37), and no glints show. Sefa and her chip stay (the quest's first step). The viewmodel is as in dusk-fire, against the mockup's big low double coil. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 7 / 6 / 4 / 5 / 6 / 4 | 1. **Wagon and props (x 0.15–0.65, y 0.4–0.52).** The re-aim works: the wagon is three-quarter from behind-left, its side running off right, at the mockup's size and place. But its canvas is a dark red-brown shell where the mockup's is pale torn cloth, lit from inside. The lantern is a small rectangle in a flat beige opening with no glow. The wheels are black, and the crates and sacks are black-maroon silhouettes with no planks (2.5× zoom). The mockup lights the crates warm at the left. 2. **Tent, horse, smoke (x 0.83–1, y 0.43–0.51; x 0.6–0.63, y 0.18–0.45).** The tent is a single pale flat plane leaning at the right edge; the mockup's is a small dark tent behind a side-on pack horse. The game horse is an end-on black silhouette. The smoke is a thin pale ribbon where the mockup has a soft widening plume. 3. **Sky and ground (y 0.05–0.45; y 0.55–0.9).** The streaks are gone, as claimed. But the sky turned maroon (54,36,64 vs 49,46,92; zenith 32,24,51 vs 28,32,74), with a handful of faint stars against the mockup's starfield. The sand is too bright (84,51,40 vs 59,31,26), with a bright pool under the wheels. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 6 / 5 / 4 / 5 / 6 / 4 | 1. **The logs poke out through the bowl (x 0.27–0.48, y 0.48–0.50).** The "Λ" is gone, but the flattened crown logs now stick out of the bowl's sides as flat red bars (2.5× zoom). This is new since round 3, and it is in every brazier: `h3-waymark` shows a big red X on the unlit bowl, and `h4-tower-deck` shows it too. The flame is still a few smooth pale-peach tongues against the mockup's ragged orange mass over glowing logs. The embers are a few dots; the mockup has a sweep of orange streaks up-left. 2. **Light (y 0.05–0.7).** The sky is now darker than the mockup (38,27,42 vs 63,47,70) and violet-black, not dusk violet. The pool is a pale beige band across x 0–0.8 (ground 85,46,30 vs 62,31,22), not the mockup's saturated pool round the plinth. 3. **Backdrop, brazier, hand.** A dark dune shoulder rises behind the brazier on the left; the mockup has a low flat horizon with sky above the bowl. The bowl sits at x 0.37 (mockup 0.48). The plinth is clean brick, not fieldstone. The next waymark is on the right horizon (x 0.83, mockup 0.89). The mockup's hand is a big low dark coil; the game's is D's upright fist. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **5.0** | 5 / 4 / 5 / 4 / 5 / 5 | 1. **The hand (x 0.6–1, y 0.58–0.85).** The pose now matches the mockup: fist low right, cuff off the corner, coil upright beside it, handle running down. The fog is gone (no clay). But the leather is a saturated red-black (37,8,4, luma 14) against the mockup's neutral dark brown (47,27,24, luma 32). It is smooth at 2× and 3× (detail 1.5 vs 8.3): no seams, creases or crackle are readable. A white chip shows where the coil enters the fist (x 0.83, y 0.64). The coil is an orange, beaded tube, where the mockup has a dark brown plait with bright strand edges. 2. **Dune forms (x 0–1, y 0.43–0.85).** The mockup has long flat parallel bands with dark lee lines and smooth near sand. The game has the tower dune's new hump filling x 0.5–1, y 0.43–0.52, from the lift-13 crest seen from 197 m. Below it, diagonal ripples cross the near sand. The spread is 19 against 53, and the floor 39 against 10. 3. **Sky and tower (y 0.05–0.47; x 0.8–0.84, y 0.40–0.44).** The streaks and the seam are gone, as claimed. But the sky is near-black violet (26,17,46; zenith 13,9,36), half the mockup's lavender-blue (49,46,90; 27,31,70), with fewer, fainter stars and a thin orange line for the mockup's broad peach-to-pink afterglow. The tower is at the mockup's x, but on the dune hump, and its top is under its world chip. |

**Seat score, Signal Dunes: (5.5 + 5.0 + 6.0 + 5.5 + 5.0) / 5 = 5.4** (this seat: round 1 4.8, round 2 5.3, round 3 5.3)

What gained:
- dusk-fire's composition: the tower crowns a dune again, and the horizon is near the mockup's height;
- the viewmodel's pose and its fog;
- B's three-quarter wagon;
- no streaks late;
- no cairns.

What gave it back:
- the black shade blob on the subject dune of A and dusk-fire;
- the logs through every brazier;
- the late skies at half value;
- a glove that overshot to red-black.

## Builder's claims checked against the frames and the code

| Claim (round-4 README) | Verdict | Evidence |
|---|---|---|
| Regenerated stitched gauntlet, flared cuff, plaited coil, out of the fog, dark painted leather, posed as mockup D (the idle hold) | **Pose and fog true; finish not visible; value overshot** | `meshes.ts`: `m.fog = false` and no ramp for `glove-hd2`. `whipModel.ts` `HD_GLOVE` is one constant, and `Bullwhip.ts` sets one rest position, with no capture or camera branch, so this is the idle hold players see (h1–h4 show the same pose). The cuff reads. The stitching and plait do not read at 780 px (detail 1.5 vs 8.3). The glove is 37,8,4 against 47,27,24. |
| The tower crowning a big dune again; dusk-fire's dark dune and saddle | **Dune true; saddle not visible; the dark face is black** | `layout.ts` CRESTS lift 4 → 13, ease 34 → 58. The tower is on a dome peak in A and dusk-fire. There is no shaded near saddle between the camera and the dome. The face is luma 4. The same dome now humps into D's view. |
| Deep shadows, darker ripple troughs, less fill (A and dusk-fire still short of the spread) | **True, overshot at the dark end** | `render.ts`: shadow `mix(0.38 → 0.2)`, `smoothstep(0.25, 0.75)`, indirect `×0.62` at dusk 0. `manifest.ts`: hemi 1.1 → 0.8, lift 0.018 → 0.004, contrast 0.12. Together the shade faces go to 4 (the mockups' are 32–34). The highlights did not rise (p95 76–79 vs 104–110), so the spread is still ~40–60 %. The builder's "A 47 vs the mockup's 82" agrees in direction with my 37 vs 91 on another region. |
| Crisp thin cloud bands low over the horizon | **Crisp and thin: yes. Like the mockups: no** | `sky.ts` stretch `vec2(0.7, 1.9) → (1.1, 7.0)` and a band cap of `h < 0.2`. The result is rows of cream brush strokes with dark fringes over y 0.17–0.38. The mockup A has orange-red broken patches lit from below; the mockup dusk-fire has grey-brown banks at the right. |
| Violet skies | **Hue moved, value fell** | `sky.ts` `dusk`, `indigo` and the late indigo changed. The skies are no longer teal or navy, but B, C and D are about half the mockups' sky value and redder (table). |
| mock-B three-quarter from behind the tailboard | **True** | Cameras blob: (−65.5, 48.5) yaw 31.5 → (−58.8, 42.1) yaw 53.8. The wagon's side runs off right, as in the mockup. |
| No trail cairns | **True** | `dressing.ts` `cairns: 0`. There is no rag in B's foreground and no marker in A or dusk-fire. |
| Planked crates | **Not visible** | At 22 m against the afterglow the crates and sacks are black-maroon silhouettes (zoom). Nothing lights them. |
| The flame base fixed | **The Λ is fixed, but a new defect replaces it** | `places.ts` `kindling` crown lean −0.42 → −1.05. The logs now pass through the bowl wall as red bars in C, h3 and h4. |
| A dark ray | **Not verifiable** | `duneRay.ts` RAY_TINT is darker, but no frame of this capture shows the ray: not dusk-fire, the hero views, the aerials, or the clip at its scale. |
| (commit `8221a34a`, not in the README) Rippled underfoot to the bottom edge, grain glints | **Partly** | Faint bands now reach the bottom of A (detail 2.2, was 1.6; the mockup 7.8). No glints are visible. |
| Camera changes | **Listed correctly** | The `54039a0a → d78968c7` diff is exactly dusk-fire pitch −3 → −10, B's move and D yaw 50 → 46. All three move toward their mockups: dusk-fire's horizon is now y 0.38 (mockup 0.34, was 0.48), and D's tower is at x ≈ 0.82 (mockup 0.85). No camera is within the new crest's 58 m ease (the tower is at (8, −75); the nearest scored camera, C, is ~77 m away). |

## No-shortcut check (ledger 5)

- **Staged state: reachable, unchanged.** `plugin.ts` is not in the `a9e50413..8221a34a` diff. `logbook` and
  `waymarks-lit` run the player's own path, as rounds 1–3 verified. All three staged shots are listed in `meta.json`.
- **A staged frame is a real play frame.**
  - B, C and D stage quest state only. C carries its toasts, flame, embers and plume.
  - The viewmodel is the single idle constant, with no per-shot transform.
  - No breach.
- **Views:** all three re-aims move toward their mockups' cameras and are named (above). None dodges a weak area. The
  hero views and aerials show the same black shade blobs (`aerial-overview`, `aerial-spawn`) and the same brazier
  defect (h3, h4), so the mock views are not hiding something worse.
- **Painted stand-ins:** none in the playable area. The black blob is the baked dune shadow
  (`uSandShadow`), lit through the new shade floor. It is a shading defect, not a painted card.
- **Device, HUD, budget:** 390×844 phone, stored 780 wide, baseline HUD, 30 fps chip in every frame, 0 page errors.
  - Parity and the GPU ceiling were recorded at `4174b8d99` (commit `87b0c8daa`), not at the captured `8221a34a`.
  - The one commit in between changes only sand shader arithmetic. I did not re-measure.
- No breach found.

## Findings, ranked (most score per change first)

| # | Mockup(s) | Severity | Region | Fix |
|---|---|---|---|---|
| R4B-1 | dusk-fire, A (D) | must-fix | dusk-fire x 0.25–0.5, y 0.38–0.52; A x 0.5–0.83, y 0.39–0.55 | **The shade faces are black, the lit faces are still dim.** Raise the shaded sand to the mockups' measured shade faces: luma ~32–34 with texture (sd ~9), a violet-brown tone, and ripples still visible in it. Today it is 4 with sd 1. The levers are the ones this round changed: the dune-shadow floor `mix(0.2, 1.0, sandVis)`, the indirect `×0.62` at dusk 0, hemi 0.8 and lift 0.004. Then take the spread from the top end: the lit sand's p95 to ~104–110 (today 76–79), the mockups' grazing highlights on the crests and near ripples. Re-measure both patches and the p5–p95 of the lower-left ground per view; the targets are the mockup columns above. Find the dark red seam at the blob's lower edge (dusk-fire x 0.6–0.8, y 0.52; A x 0.9–1, y 0.53) and remove it. |
| R4B-2 | C (and every brazier: h3, h4) | must-fix | x 0.27–0.48, y 0.48–0.50 | **The logs pierce the bowl.** The crown kindling's lean went −0.42 → −1.05 (`world/places.ts` `kindling`), so the logs' tips pass through the bowl wall as flat red bars, and as a red X on an unlit brazier. Keep every log inside the bowl's inner radius: shorten them at that lean, or lay them as a low pile inside the rim. Check it at the unlit h3 view as well as the lit C. |
| R4B-3 | D (all five) | must-fix | x 0.6–1, y 0.58–0.85 | **The glove overshot to red-black, and its detail does not read.** Bring the glove to the mockup's neutral dark brown, 47,27,24 at luma ~32 (today 37,8,4: the painted map plus the dim `vec3(0.3, 0.24, 0.2)` viewer light gives almost no green or blue). Make the seams, crackle and creases read at 780 px: a sharper map or a detail normal. The target is fine detail near the mockup's 8 (today 1.5). Darken the coil from orange to the mockup's dark brown, and give the strands dark gaps and bright edges, not beads. Remove the white chip at the fist (x 0.83, y 0.64). Keep the pose: it is D's, the idle hold, one pose for all five (R2B-3). |
| R4B-4 | B, C, D | should-fix | y 0.05–0.47 | **The late skies are half the mockups' value and too red.** Measured sky and zenith, mockup against game: D 49,46,90 and 27,31,70 against 26,17,46 and 13,9,36; B 49,46,92 and 28,32,74 against 54,36,64 and 32,24,51; C 63,47,70 against 38,27,42. Lift the late `indigo` and `dusk` toward those patches with more blue. In D, widen the afterglow from a thin orange line into the mockup's peach-to-pink band. Make the stars as many and as bright as the mockups' (B and D are starfields). Re-measure the same patches. |
| R4B-5 | A, dusk-fire | should-fix | y 0.17–0.38 | **The cloud strokes.** The `vec2(1.1, 7.0)` stretch draws rows of cream strokes with dark fringes. The mockup A has broken orange-red patches lit from below at y 0.19–0.32; dusk-fire has a few grey-brown banks at the right only (x 0.65–1, y 0.25–0.35). Use less stretch and broken shapes. Colour the cover from the existing `belly` and `hot` terms (orange-red toward the glow, rose away from it), not cream, and drop the dark fringe. Keep it inside the band. |
| R4B-6 | B | should-fix | x 0.15–1, y 0.4–0.52 | **The caravan's finish under its own light.** Put a warm light at the lantern so the tailboard, the canvas underside and the crates at the left catch it, as in the mockup; the lantern needs a glow. Make the canvas the mockup's pale torn cloth over the hoops, not a dark red shell. Replace the pale flat tent plane with the small dark tent behind the horse, and turn the horse side-on in the real layout. Bring the sand down to ~59,31,26 (today 84,51,40) and shrink the pool under the wheels. Make the cookfire smoke a soft widening plume (the wisp is still a ribbon). |
| R4B-7 | D | should-fix | x 0.5–1, y 0.43–0.52; y 0.5–0.85 | **D's field.** The tower's new 58 m dune humps into D's right half from 197 m, where the mockup has flat bands. Jake's dusk-fire wins the tower dune, so shape its D-facing flank lower and longer (an asymmetric ease) so the tower stands nearly on the band line from (118, 88). Give D's east field the long parallel transverse ridges with dark lee lines (R3B-4, still open), and keep the near sand there smooth rather than diagonally rippled. |
| R4B-8 | C | should-fix | x 0–0.8, y 0.2–0.7 | **The fire, still open from R3B-6.** Ragged orange tongues over glowing logs. Ember streaks swept up-left. A grey plume lit from below. A tight saturated pool round the plinth (today a pale band across x 0–0.8). A soot iron bowl on a fieldstone plinth. |
| R4B-9 | A | should-fix | x 0–1, y 0.6–0.92 | **The near ripples.** They now reach the bottom edge, but at about a quarter of the mockup's fine detail (2.2 vs 7.8, spread 37 vs 91), and the claimed grain glints don't show. Lift the near ripple contrast and the glints until the lower-left patch measures near the mockup's. |
| R4B-10 | dusk-fire | nit | x 0.2–0.6, y 0.08–0.3 | **The ray and the tower lamp**, the mockup's other subjects, are absent. The ray glides its normal circle (`RAY_HOME` (−18, 30), r 20 m, 14 m up) in front of the spawn. A capture at a moment that circle carries it into this view, effects intact, is a real play frame and needs no staging. The unlit lamp stays a difference unless a lit lamp is a real state at this quest step. |
| R4B-11 | provenance | nit | round README | The claims list omits `8221a34a`'s own claim (rippled underfoot, glints). Parity and memory were recorded at `4174b8d99`, one commit before the captured SHA. Say so in the README, or re-run parity at the captured SHA. |

SCORE signal-dunes: 5.4

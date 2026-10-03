# Round 3, seat C (Claude, red team: the demanding art director), Signal Dunes

Surface: `art/mockup-council/round-3/README.md` (Signal Dunes section) and its five `sunscar-dunes-*.jpg` sheets; the
full-res frames in `progress/sunscar-dunes/20261002-2351-a9e50413/` (every `mock-*`, the hero views, both aerials,
`clip.mp4` sampled at 0.5 fps), against round 2's `progress/sunscar-dunes/20261002-2243-cb48ab8f/` and the five ledger
mockups at full resolution. Each pair was scaled to 780×1688 and cropped region by region (sky, horizon and tower,
middle ground, foreground, viewmodel at 3× pixel zoom). Measured with ImageMagick: the round-2 seat B patches (sky
500×300+40+300, ground 500×250+40+1050) and, new this round, the **contrast** of the ground: grey-level standard deviation
and minimum over the left half of the lower frame (390×420+0+880, clear of the whip) and the full lower band
(780×300+0+850). Source checks at the capture's commit `a9e50413` (cameras blob `54039a0a`): `look/render.ts`,
`layout.ts`, `plugin.ts` (`stage`), `quest/install.ts`, `world/build.ts`, and the commits `3e401441e`, `6a4321dd7`,
`b69c79d16`, `4148a4475` between the two captures. Regions are fractions of the portrait frame (x left → right, y top →
bottom).

What landed since round 2, verified in the frames: the mean colours now sit on the mockups' patches (ground A 100,59,43
vs 92,52,36; dusk-fire 93,54,40 vs 106,61,36; D 70,44,42 vs 58,34,31); the blue-black late views and the X-ray glove are
gone; the trail stakes are gone; B is now framed from the tailboard into the afterglow with a horse and tent at the right;
C has the next waymark in frame; the flame is orange. These are real. This seat scores the picture.

## The measurement that matters this round: the frames hit the means and lost the picture

| View | Ground sd, left half (mockup / r3 / r2) | Ground sd, lower band (mockup / r3 / r2) | Darkest ground value (mockup / r3) |
|---|---|---|---|
| dusk-fire | 19 / **11** / 12 | 21 / **11** / 21 | 2 / **19** |
| A spawn | 26 / **9** / 20 | 30 / **12** / 24 | 8 / **23** |
| B logbook | 12 / **6** / 6 | 17 / **11** / 15 | 0 / **26** |
| C waymark | 25 / 27 / 31 | 26 / 26 / 30 | 0 / **20** |
| D hands | 19 / **3** / 6 | 24 / **9** / 22 | 0 / **41** |

Round 2's seat B gave a mean colour per patch as a target, and the builder calibrated to it (`3e401441e`: "no crushed
darks in the grade, a warm hemisphere fill"; `6a4321dd7`: "a softer dune-shadow edge", "a warm late fill and floor").
The means now match, but the ground's tonal range is a third to a half of the mockups' (D: a sixth), and no pixel of
sand goes below ~20 where every mockup reaches black in its troughs and shadow faces. Only C keeps its range, and only
because its firelight pool supplies it. That is why A, dusk-fire and D read as a soft brown wash under the HUD. It is not
a ledger breach (it is the shipped look, in every hero view and the clip too), but it is a metric met at the expense of
the image, and it is the largest single difference left.

## Signal Dunes (sunscar-dunes)

| Mockup → game view | Score | The three biggest differences (region) |
|---|---|---|
| `round-2-dunes/C-dusk-signal-fire` → `mock-dusk-fire` (Jake's pick) | **4.0** | 1. **The tower dune is gone (x 0–1, y 0.33–0.75).** The mockup's subject is a big rounded dune crowned by the tower (tower base at y 0.33, the dune's dark face filling x 0.05–0.95, y 0.33–0.42), a near saddle in deep shade sweeping across the centre, and lit, grain-textured sand at the bottom left. The game's tower stands on the far horizon (base y 0.50, below the lavender range line), and the frame below it is a flat brown plain with soft dark smudges (x 0.15–0.45, y 0.52–0.60) and no crest anywhere; ground sd 11 against 19. Round 2 at least had a dome under the tower. 2. **Framing and sky (y 0–0.5).** The game horizon sits at y 0.48 against the mockup's 0.36, so half the frame is sky; that sky is filled with large smeared, dark-cored cloud strokes (x 0–1, y 0.15–0.42) that look motion-blurred, where the mockup has a few small grey-brown banks lit from below at the right (x 0.65–1, y 0.25–0.35) and a clear orange glow. No dune ray, tower lamp unlit. 3. **Hand and whip (x 0.5–1, y 0.55–0.85).** The mockup: one low diagonal loop of crisp dark plaited leather with specular, in a dark creased glove. The game: an upright double loop in a pale tan with low-contrast herringbone that reads as twisted rope, and a smooth clay fist with no seams, the same value as the sand behind it, hazed by the scene fog (the builder's own later commit `fc53958d0`: "it read as tan clay fogged into the sand"). |
| `round-9-review/A-spawn-dusk-light` → `mock-A-spawn` | **4.5** | 1. **Dune form and surface (x 0–1, y 0.40–0.85).** The mockup's whole lower frame is grazing light: three overlapping knife-edge crests, each a warm lit face beside a deep violet-brown shade, and bold ripples to the bottom edge with lit crests and black troughs. The game has soft low humps, no crest line, no lit face, and **no ripples at all near the camera** (sd 9 against 26; `render.ts` patch line 102 deliberately makes the near ripples "fine low-contrast", which matches D's smooth foreground but contradicts A's). Round 2's frame had visible ripples; this is a regression in ground detail. 2. **Tower and horizon (x 0.5–0.65, y 0.33–0.45).** The mockup's tower crowns a dune that rises above the far ranges; the game's stands on flat ground at the horizon with the lavender range behind its legs, so it reads as planted on the plain, not on a peak (the post-capture `fc53958d0` raises CRESTS: not in this capture). 3. **Sky (y 0.08–0.40).** Small broken orange-pink cloud banks low over a clean gradient in the mockup; large smeared strokes across 60 % of the game sky. Sefa and her chip in the lower left are the quest's real first step and stay. The viewmodel as in dusk-fire. |
| `round-9-review/B-quest-logbook` → `mock-B-logbook` (staged `logbook`) | **6.0** | 1. **Wagon finish and light (x 0.42–0.62, y 0.40–0.52).** The composition now matches (wagon on the low horizon against the afterglow, smoke above it, horse and tent at the right). But the mockup's wagon is lit from inside by a bright lantern, with planked tailboard, spoked wheels, hoops and torn sagging canvas; the game's is a backlit silhouette: a lumpy canvas shell with jagged edges, a flat yellow rectangle for the lantern on a black stick, navy-blue corner posts, and no wheel readable. 2. **Props and tent (x 0.22–0.36 and 0.6–1, y 0.48–0.53).** Crates and sacks are black boxes and black sausages (texturing landed after the capture, `57e258d2c`); the tent is a flat, untextured grey-brown triangle with a hard edge; the horse is fine. 3. **Sky, smoke, ground (y 0.05–0.45; y 0.55–0.9).** The mockup's smoke is a soft widening plume; the game's is still a thin straight pale ribbon (x 0.53, y 0.18–0.40). The sky carries ruled streaks and a grainy band at the top; the far range is a flat lavender cut-out. The sand is smooth and featureless (sd 6 against 12) where the mockup's has soft ripples catching the lantern. |
| `round-9-review/C-waymark-fire` → `mock-C-waymark` (staged `waymarks-lit`) | **5.5** | 1. **Fire, smoke and embers (x 0.25–0.5, y 0–0.5).** The mockup: a big turbulent fire of ragged orange tongues over visible burning logs, a billowing grey plume and a long sweep of orange ember streaks to the upper left. The game: a narrower, smooth-edged flame over two crossed sticks that read as a capital "Λ"; the embers are sparse round dots; the smoke is a wide, pale, soft-edged vertical column rising straight to the top of the frame behind the minimap (x 0.35–0.6, y 0–0.45) that reads as a light beam, not smoke. 2. **Backdrop and pool (x 0–1, y 0.35–0.68).** The mockup's horizon is low and flat with sky round the bowl; the game's brazier stands in front of a dark dune shoulder rising to the left. The firelight pool is a large flat beige ellipse spanning x 0–1, y 0.56–0.68, brighter and paler than the mockup's tight orange pool on rippled sand. The next waymark is in frame (x 0.83, y 0.43), small, with a slanted dark smoke streak. 3. **Brazier and hand (x 0.3–0.45, y 0.45–0.62; x 0.5–1, y 0.55–0.85).** The mockup's base is soot-dark iron on rough fieldstone; the game's is a clean copper bowl on a crisp new brick plinth. Viewmodel as above. Toasts, mood and palette are the closest in the shard. |
| `round-9-review/D-hands-whip` → `mock-D-hands` (staged `waymarks-lit`) | **4.5** | 1. **The hand is the subject, and it is clay (x 0.5–1, y 0.55–0.85).** The mockup is a hero shot of a worn, stitched, creased leather glove with lit knuckles and a dark plaited whip with bright strand edges. The game: a smooth tan clay fist with soft blotchy speculars and a pale rope coil, no seams, no cuff, no dark gaps between strands, fogged to the sand's value (3× zoom). 2. **The ridge bands are gone (x 0–1, y 0.5–0.85).** The mockup's lower half is three or four long horizontal ridge bands with crisp dark lee lines; the game's is one uniform brown haze (sd 3 against 19, darkest value 41 against 0). Round 2 at least showed two domes. 3. **Sky and tower (y 0.15–0.5; x 0.72–1, y 0.42–0.5).** The mockup's blue hour is clean, with stars and no clouds; the game still has ruled pink streaks (y 0.32–0.46; the README claims the banks clear with the dusk: not at D's dusk in this capture) and a hard horizontal seam at y ≈ 0.24, grainy navy above, smooth violet below. The tower is pushed to x ≈ 0.92 and its world chip "SIGNAL TOWER" (x 0.72–1, y 0.44–0.47) covers its top; the mockup's stands clear at x 0.85. |

**Seat score, Signal Dunes: (4.0 + 4.5 + 6.0 + 5.5 + 4.5) / 5 = 4.9** (this seat in round 2: 5.1).

## Builder's claims checked

| Claim (round-3 README) | Verdict | Evidence |
|---|---|---|
| Light calibrated on the measured patches | **true for the means, at the cost of contrast** | Means match (above). Ground sd halves to a sixth; the black floor lifts to 19–41 (table). |
| Layered diagonal crests across the spawn view, the tower on a dune crest | **not visible** | A and dusk-fire show soft humps and no crest line; the tower's base sits below the range line on flat ground. Aerials (`aerial-spawn`, `aerial-overview`) show blurred dark blobs and long dark cast-shadow streaks, no crest lines. |
| Orange cloud banks lit from below, clearing with the dusk | **partly** | Banks exist in A and dusk-fire but as large smeared strokes, not the mockups' small broken banks; B and D still carry ruled streaks. |
| Glove without the rim, lit from the viewer side, coil lower and diagonal | **partly** | The X-ray is gone. The fist and coil are now fogged clay and rope; the coil is still an upright double loop in A, B, C, dusk-fire. |
| Flame orange with a yellow core, a dark plume, embers that fade | **partly** | Orange, yes; the plume reads as a pale beam (C, y 0–0.45); the far waymark in C still trails a slanted streak. |
| Tent lit canvas, a pack horse, no trail stakes | **true** | B: tent visible (flat), horse at x 0.78; dusk-fire and A: no stakes. |

## Findings, ranked by score gained

1. **Calibrate the value structure, not one patch mean** (all five, worst D, A, dusk-fire; y 0.45–0.9). Evidence: the
   contrast table; `3e401441e` "no crushed darks", `6a4321dd7` "softer dune-shadow edge", "warm late fill and floor";
   the scene fog `FOG 0x40304a` from 80 m. Fix: per mockup, measure two ground patches (a lit face and a shade face, or
   a ripple crest and its trough) and the ground's sd, and tune the key-to-fill ratio and the shadow edge until both
   pairs and the sd land; let the troughs, lee lines and creases reach near-black as the mockups do (a floor on the
   fill's colour, not on its value). In A, restore the near ripples at the mockup's strength (bold, grazing, to the
   bottom edge); D's near sand stays smooth but its ridge lee lines must be dark. Re-measure the table above; the target
   is the mockup column.
2. **Build the tower dune and the dune rows the mockups are composed on** (dusk-fire, A, D; x 0–1, y 0.33–0.85).
   Fix: a real rounded tower dune whose dark face fills the band under the tower from the spawn (the mockup has it as
   wide as the frame), the near saddle in shade before it, and the tower's base above the far range line; from D's
   east-crest camera, long transverse rows with crisp lee edges. Then pitch `mock-dusk-fire` down until its horizon sits
   at y ≈ 0.36 (it is at 0.48; a re-aim toward the mockup's camera is allowed) and name it in the README. `fc53958d0`
   (CRESTS lift 8 over 36 m) landed after this capture: verify it in the next one, from the first-person views, not the
   aerials. Re-bake the navmesh, keep 0 stuck.
3. **The viewmodel: dark worn leather, out of the fog, braid you can count** (all five; D is the hero). Fix: take the
   viewmodel out of scene fog (`fc53958d0` claims this after the capture); darken the leather well below the sand's value
   (every mockup's glove and whip are darker than the ground behind them); give the plait dark gaps between strands
   (AO or normal depth) and bright strand-edge speculars instead of the low-contrast herringbone that reads as rope; add
   the seams, creases and cuff (the README admits not done); lay the coil as one low diagonal loop in A, B, C and
   dusk-fire's idle (only D's mockup shows upright loops). Same finish in attacks; no per-camera transform.
4. **The sky: small banks, no seam, no ruled streaks late** (dusk-fire, A, D, B; y 0–0.5). Fix: the cloud banks smaller,
   crisper-edged and lit from below, confined to a band within ~0.15 of the frame above the horizon, with clean gradient
   above (A, dusk-fire); no streaks at D's dusk (`fc53958d0` claims this) or at B's; remove the hard horizontal
   seam between the grainy upper dome and the smooth lower sky (D y ≈ 0.24, also the top of B and C; it was in round 2
   too). Give the far range an aerial gradient and remove the pale strips between its layers (clip, every frame).
5. **The caravan as a lit, built object** (B; x 0.22–1, y 0.40–0.53). Fix: light the wagon from the lantern (a warm
   point light inside the hoops, so the tailboard planks and canvas underside glow as the mockup's do); make the wheels
   read from this camera; recolour the navy corner posts to wood; clean the canvas shell's jagged edges into sagging
   cloth over hoops; a lantern with a glass and frame, not a flat rectangle; texture the tent canvas; replace the smoke
   ribbon with a widening plume. The crate and sack texturing (`57e258d2c`) is after this capture: verify next round.
6. **The waymark fire** (C; x 0.25–0.6, y 0–0.68). Fix: a pile of logs inside the bowl in place of the "Λ"; ragged
   tongues with turbulence; ember streaks swept up and to the left; the smoke as darker, lobed billows leaning with the
   wind, fading out well before the top of the frame (now a pale vertical beam); the pool tighter and more orange, with
   the sand's ripples catching it; a sooted iron bowl and a rough stone plinth.
7. **D's re-aim: unnamed and overshot** (D; x 0.72–1, y 0.42–0.5; provenance). The README lists the B, C and dusk-fire
   re-aims but not `mock-D-hands` yaw 42 → 50 (`4148a4475`). It moved the tower to x ≈ 0.92, past the mockup's 0.85, and
   under its own world chip. Fix: about halfway back, so the tower stands clear at x ≈ 0.85, and list it in the README.

## No-shortcut check (ledger 5)

- **Staged state: reachable.** `stage()` runs the player's path (Sefa's flag, logbook, well, then oil and crack per
  waymark). C's new camera stands 11 m from the second brazier in the list (−44, −22), but the step completes on
  `{ all: [...] }` in any order (`quest/install.ts:56`), so a player who lights that one last sees exactly these toasts
  there. B (`logbook`) and D (`waymarks-lit`, east crest) are as in round 2.
- **Transient look:** the A and dusk-fire golden hour holds only until the player talks to Sefa (`6a4321dd7`: the sun
  drops fast once the quest starts). The spawn state is a state a player holds as long as they like, so this is allowed;
  but the mockups' brightest look is now the shortest one in play.
- **Views:** B, C and dusk-fire re-aims move toward their mockups and are named. D's yaw change is not named
  (finding 7); it moves toward the mockup's tower position but overshoots. No view dodges a weak area that I can find;
  the hero views and the clip show the same flat, low-contrast ground, so the mock views are not hiding something worse.
- **Painted stand-ins:** none in the playable area. The dune shading is a baked self-shadow texture from the terrain's
  own heights (`bakeDuneShadow`), the pool and glow are light effects on every waymark, clouds and range are at
  infinity.
- **Device and HUD:** 390×844 phone and touch stored at 780 wide, baseline HUD, 30 fps chip in every frame, 0 page
  errors. No breach found.

SCORE signal-dunes: 4.9

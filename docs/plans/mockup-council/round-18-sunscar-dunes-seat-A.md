# Mockup council — round 18, Signal Dunes, seat A

2026-10-03 · Codex · lens: game art direction · amended bar **7.0**.

## Surface and verdict

Reviewed the frozen ledger, brief, council protocol, scores and all requested earlier Signal Dunes seats (round 1 and rounds 3–17). Scored the five round-18 Signal Dunes sheets, their original mockups and the full-resolution game frames in `progress/sunscar-dunes/20261003-1028-52e843cd/`. Also inspected first-frame, all four hero views, both aerials and the ten-second orbit, sampled at half-second intervals. Source verification uses **52e843cdb093398d3641d4747716f197b870dd14**, against round 17's **8c70feaf2**. Later sky, smoke, key and round-19 changes receive no credit.

**Picture likeness: 6.3/10, below 7.0.** These are recognisably the same desert locations, but the sky, the placement of light on the dune faces and the held whip differ immediately. The new flame has much better broken tongues; the glove now presents its back and cuff. Those gains do not compensate for the brighter early sky.

**Ledger §5 finding: no narrowing.** The replacement sky introduces a conspicuous speckled colour boundary in the ordinary h3 view, absent in round 17, and a second painted horizon visible from the aerial/orbit. The sky chosen to improve the five views must also work elsewhere. I flag this surface for **void/re-run under no narrowing** (finding R18A-SD1). The numerical score below describes appearance, not eligibility to pass. Painting at infinity itself is allowed.

## Scores

Regions use the whole frame: x increases left to right, y top to bottom; coordinates are fractions of width/height.

| Mockup → game view | Score | Three biggest differences, with frame regions |
| --- | ---: | --- |
| `round-9-review/A-spawn-dusk-light.jpg` → `mock-A-spawn` | **5.9** | **1. Sky, x 0–1 / y .08–.35:** bright magenta and broad soft pink clouds replace dark navy, sharp stars and low, orange-edged cloud filaments. This changes the time-of-day impression over most of the upper frame. **2. Dunes/light, x 0–1 / y .35–.62:** the target's golden diagonal face over cool shadow is still dim; pale windward slopes occupy the shaded trough. The tower mound is present, but the arrangement of lit faces is different. **3. Hold, x .25–1 / y .50–.85:** a raised, apparently single oval on a long straight handle replaces large, lower overlapping coils. The glove has a better facing, but still broad smooth/faceted surfaces. |
| `round-9-review/B-quest-logbook.jpg` → `mock-B-logbook` | **6.3** | **1. Sky, x 0–1 / y .10–.43:** a bright blue/mauve cloud field replaces the dark, relatively quiet starry sky and thin low afterglow. **2. Caravan, x .45–1 / y .40–.53:** the right subject is present, but pale canvas with black blotches, plain timber, simple sacks and weak ground contact are rougher than the layered weathered cloth, lantern-lit wood and settled camp in the target; cooking smoke bends right instead of rising above the wagon. **3. Hold, x .25–1 / y .50–.85:** the upright oval and exposed straight handle dominate the centre instead of the target's low double coil. The 22 m marker is above the wagon rather than attached visually to its entrance. |
| `round-9-review/C-waymark-fire.jpg` → `mock-C-waymark` | **6.8** | **1. Smoke/sky, x .20–.85 / y 0–.42:** a broad pale diagonal plume rises right through the notice/minimap area; the target billows predominantly left and remains darker away from its hot foot. The saturated blue, noisy sky patches are also unlike its smoother violet field. **2. Fire assembly, x .25–.50 / y .30–.60:** broken orange tongues are substantially better, but the target has a stronger near-white core, visibly burning diagonal fuel, rougher post/plinth and a more concentrated gold pool. **3. Foreground/depth, x .25–.90 / y .48–.85:** the raised loop crosses the post and base; the distant dune remains too light and the near floor too busy, reducing separation between the fire and dark land. |
| `round-9-review/D-hands-whip.jpg` → `mock-D-hands` | **6.5** | **1. Hand/whip, x .25–1 / y .50–.85:** the back and cuff now face us, but the loop is high and central on an exposed rigid handle; the target is a smaller low-right folded coil held close to the fist, with sharply resolved creases, stitches and leather grain. **2. Land bands, x 0–1 / y .49–.68:** rolling brown ground replaces several dark horizontal dune bands and the bright near-left stripe. **3. Sky, x 0–1 / y .20–.49:** textured pink/purple cloud banks and a higher pink glow replace the target's quiet blue-to-violet gradient and narrow amber horizon. |
| `round-2-dunes/C-dusk-signal-fire.jpg` → `mock-dusk-fire` | **6.0** | **1. Sky/subject, x 0–1 / y .08–.37:** magenta/orange sky replaces dusty charcoal and amber; the large overhead ray is missing from this instant. **2. Ground composition, x 0–1 / y .35–.70:** the dark tower mound survives, but the pale right saddle and muted left shoulder do not reproduce the strong gold shoulder / cool trough contrast. **3. Hold/tower, x .25–1 / y .28–.85:** the upright loop, long handle and hanging tail differ from the low diagonal coil and close grip; the tower reads as a sparse regular lattice rather than the denser weathered scaffold. |

**Seat mean:** (5.9 + 6.3 + 6.8 + 6.5 + 6.0) / 5 = **6.30 → 6.3**.

## Rec. 709 measurements

Brightness is **Y = .2126R + .7152G + .0722B**, on decoded RGB values in the 0–255 screenshot range. Targets were resized once with Lanczos to the game's **780 × 1688**. These are matching screen windows, not matched physical surface samples; percentile/count comparisons describe the captured animation instant. No max-channel or red-channel brightness is used. Pixel boxes below are `(left, top)–(right, bottom)`, right/bottom exclusive.

| Window | Target Y | Round 17 Y | Round 18 Y | Reading |
| --- | ---: | ---: | ---: | --- |
| A upper sky, (40,180)–(280,300) | 37.7 | 41.2 | **100.9** | Now 2.68× target brightness; the earlier value match regressed. |
| B upper sky, same box | 31.0 | 28.5 | **83.1** | Now 2.68× target. |
| B middle sky, (40,300)–(400,600) | 48.9 | 46.4 | **99.0** | Broad bright sky, rather than a local highlight problem. |
| D upper sky, (40,180)–(280,300) | 29.8 | 37.2 | **37.4** | D's upper value is much closer than A/B's; its clouds/glow remain different. |
| Dusk-fire upper sky, same box | 48.4 | 41.1 | **103.8** | Also far too bright and more magenta than dusty grey. |
| A golden diagonal, (312,675)–(546,742) | 96.7 | 47.6 | **47.7** | Warmer sand did not restore the defining lit face. |
| A shade below, (468,810)–(780,911) | 43.9 | 80.0 | **74.1** | Some improvement, but the target's shade is still occupied by much lighter ground. |
| Dusk-fire left shoulder, (0,844)–(195,1182) | 83.7 | 76.2 | **78.1** | Mean is fairly close; target has greater local highlight spread. |
| Dusk-fire saddle, (429,776)–(702,945) | 49.5 | 79.9 | **73.9** | Still too pale despite an improvement. |
| C clear pool ground, (100,1000)–(190,1120) | 59.5 | 59.3 | **75.0** | New pool is brighter here, but spreads as a smoother reddish wash. |
| C far land, (468,810)–(702,894) | 16.1 | 49.1 | **37.8** | Better than round 17; still more than twice the target's value. |
| D left land, (0,878)–(195,1046) | 16.0 | 36.6 | **36.8** | The missing dark transverse bands remain. |
| D near-left stripe, (0,1080)–(195,1148) | 60.3 | 37.2 | **37.2** | Wrong light placement rather than an overall exposure issue. |

Unobscured near sand, `(10,1160)–(150,1400)`, gives target/game Y: **A 57.2/65.3; B 39.8/34.6; C 32.9/41.6; D 35.8/34.1; dusk-fire 75.3/68.3**. One global exposure adjustment would trade these errors against each other.

For C's flame box **(150,520)–(450,900)**, target / round 17 / round 18 counts are:

| Luminance threshold | Target | Round 17 | Round 18 |
| --- | ---: | ---: | ---: |
| Y > 200 | 8,681 | 5,906 | **5,998** |
| Y > 230 | 5,212 | 1,993 | **1,876** |
| Y > 240 | 3,431 | 236 | **1** |
| Y > 245 | 2,483 | 7 | **0** |

The new fire is better shaped, not better matched in very-hot luminance. Its box's 99th percentile is **233.1**, versus target **250.4**. This does not prove every flipbook frame has a weaker core; it does disprove treating this captured yellow core as target-equivalent white.

## Builder claims checked

| README claim | Verification |
| --- | --- |
| Amber key; direct saturation ×2.1; cooler desaturated fill | **Implemented.** Captured `look/render.ts` uses Rec. 709 weights to separate direct/indirect light, saturates the direct term ×2.1 and cools/desaturates fill; key RGB is (1,.8,.44). Sand looks warmer. Placement is unchanged, as the README explicitly warns: the later art-directed key ruling is not rendered here. |
| Lit-sand saturation matches the stated ranges | **Direction supported; headline ranges not independently reproduced.** The README does not specify its sample masks/bins. In an explicit ground window `(78,675)–(741,827)`, using HSV saturation and **Y** bins, A's Y60–80 saturation rises .526→.606 (target .549), but Y80–100 is .487 (target .664). Dusk-fire is .497→.581 at Y60–80 (target .649), and .485 at Y80–100 (target .671). A's separate near-sand saturation is .743 versus .589 target; warm does not mean uniformly closer. These windows must not be confused with the builder's unspecified selection. |
| B mound 19 m; waymark-0 rise 20 m | **Source change confirmed** from 17→19 m and 18→20 m respectively; real terrain and navigation assets changed. Their heights are not camera offsets. The ordinary h3 camera rises 2 m with the ground, as disclosed. |
| Two painted skies; late painting fits every sky band; no stars early; no seams | **Two stages and early-star removal confirmed; likeness/no-seams claim rejected.** Normal B at dusk .50 still samples the early painting: blend is .50–.54. A has no stars despite its target. H3 has a new conspicuous blue/speckled boundary across y roughly .22–.36; round 17's h3 sky was continuous. The aerial and orbit show a second violet painted skyline behind the real terrain. No-star early treatment is an art mismatch, not a forbidden staging change. |
| Mantaflow flame, glowing crown logs, lit smoke, real short-range light | **Implementation confirmed; appearance mixed.** The 32-frame atlas runs and crossfades with world time. Crown-log emissive switches on when lit. One flickering point light follows the lit waymark nearest the actual player; the existing sand-light pools remain. The flame's turbulent silhouette improves, but visible logs remain predominantly dark upright fingers, the core falls short in Y, and the pale right-drifting smoke differs from the target. |
| Glove-hd4 shows back/cuff; teardrop above handle | **Implemented and visible.** The new model, smaller scale and rotation expose the back and cuff; the code loop is reposed above the handle. The resulting high oval/long stick silhouette is the wrong hold, and the glove does not yet have the target's fine leather finish. |
| No camera re-aim; no dusk stage/curve change | **Confirmed for the five scored views.** Camera hash is unchanged and all five `camAt` records match round 17. The 2 m h3 move is recorded. Stage logic and monotonic .02/s dusk easing are unchanged. |
| GPU memory 149.95 MB, +40 MB; phone limits held | **GPU allocation reproduced; total-phone conclusion unverified.** The committed calibration report at `011e46d7b` records **149.9466 MB** for the phone poses; ceilings were updated from **109.8873 MB**. Its only red D-class fields are the old GPU ceilings; walk.stuck, touch, pause/resume and disposal-error checks are green. However combat swing/shots are `n/a`, kills empty. M5 measurements with a phone viewport do not establish sustained physical-iPhone fps or total loading/Explorer process memory. This is incomplete proof, not a measured memory-limit breach. |

## Ranked findings and concrete fixes

1. **R18A-SD1 — Must-fix, ledger §5 no narrowing: restore one coherent sky everywhere.** **A/B/dusk-fire upper half; C/D sky; h3 y .22–.36; aerial/orbit horizon.** Regrade the shared early panorama to dark navy overhead and lower amber/red cloud edges, with crisp stars where dark; retain the appropriate dusty/amber character of the dusk pick. Keep a continuous dome across all elevations/headings. Inspect texture gradients, colour transfer, quantisation/dither and the extension above the strip; remove the large blue/speckled boundary, rather than hiding it by re-aiming h3. Remove terrain-looking silhouettes from the sky strip where the real skyline already supplies them, or integrate the distant panorama so it makes one horizon from ground and flight views. The two global skies may blend with quest dusk, but the narrow .50–.54 blend and B's early sample need deliberate review. Re-run all five fixed views, both aerials and a full look-around after this repair. **This demonstrated wider-view regression requires a new eligible surface.**

2. **R18A-SD2 — Should-fix: place the light on the right real dune faces.** **A/dusk-fire x 0–1 / y .35–.70; C far land y .48–.53; D y .49–.68.** Use the lead-permitted single global key direction and compatible dune normals to restore A's bright diagonal, dusk-fire's gold shoulder/cool saddle and D's narrow lit rim over dark transverse bands. Preserve readable distant crests and actual routes. Use the measured windows to judge placement: A's intended light is 47.7 against 96.7, while its shade is 74.1 against 43.9. Do not solve that inversion with another global saturation/exposure boost or camera-distance darkening. The small mound-height corrections do not solve it.

3. **R18A-SD3 — Should-fix: rebuild the shared resting hold around the fist.** **All five views, x .25–1 / y .50–.85; D/dusk-fire especially.** Shorten the exposed straight handle, lower and move the loop toward the right hand, tilt it into a folded/overlapping coil and bring the tail behind the grip. Preserve the new back-of-hand/cuff facing. Add real folds, seams and leather microdetail, avoiding broad faceted white highlights on the knuckles. A/B/C's larger coils and D's smaller coil are differing target holds; choose a believable common resting pose or normal player-controlled poses, never a camera-specific prop transform. Keep the post/crosshair clear, and verify the hold through normal attacks and returns to rest.

4. **R18A-SD4 — Should-fix: finish the fire's thermal hierarchy and smoke motion.** **C x .20–.85 / y 0–.65.** Keep the new turbulent flame. Raise a limited near-white core after the complete render pipeline, checking **Y**, while leaving orange outer tongues and transparent edges. Make a few diagonal fuel pieces visibly burn rather than reading only as dark rim fingers. Shape smoke as irregular darker billows drifting left with the embers, warm at its foot and darker aloft; remove the pale broad rightward beam. Concentrate the sand pool toward gold near the base, with rough contact detail on the post/plinth, rather than brightening the whole foreground. Judge several live animation phases; do not freeze the best atlas frame or suppress the quest notices.

5. **R18A-SD5 — Should-fix: give the caravan the target's material/contact finish.** **B x .35–1 / y .40–.56.** Replace large black canvas blotches with thinner torn edges, tan folds and weathered shading; resolve timber/joinery and lantern spill at the opening, settle sacks/crates/wheels into the sand with convincing contact. Make the cooking plume rise over the caravan before drifting. Retain the actual horses and props; no new camp content is needed.

6. **R18A-SD6 — Should-fix: recover the dusk shot's ray and scaffold character in ordinary play.** **Dusk-fire x .10–.55 / y .15–.35; tower x .35–.60 / y .28–.40.** Give the existing ray a normal patrol that can produce the overhead silhouette near the tower; do not pose a stationary ray solely for capture. Weather and vary the tower members, cross-bracing and top structure so the silhouette reads as the target's substantial scaffold. Keep its climb/collision intact. A missing moving animal in one frame alone is not proof of a gameplay regression.

## Remaining ledger checks

- **Views/HUD/device:** fixed phone/touch views, baseline controls and live notice stack remain. At full health the normal vitals row can hide; do not add the old target's ammo/journal or suppress the new quest chip solely for likeness. Aerial HUD/viewmodel hiding belongs to the inspection orbit, not the five scored first-person views. Meta records zero page errors, no QA retakes, 59 programs and load 7 s.
- **Reachable staging:** B's `logbook` stage means Sefa spoken to, book still unread; that is a normal player state. At the recorded 22 m, absence of a read interaction is appropriate. C/D call the real logbook/well/waymark handlers; all three waymarks burn, oil is collected and poured, the well lifts and the tower remains unlit. C snaps only to the two-waymark dusk (.74), then eases after the last ignition: after 3 s it is approximately .80 and ordinary completion notices/effects are live. D's 11 s settle reaches .86 and notices expire. A player can light the western waymark last and back away while its completion notices remain; ignition order is not locked. No held attack pose or fire clock is frozen.
- **Grounded views:** bilinear sampling of the captured baked height grid gives eye heights above terrain **A/dusk 1.700 m, B 1.698 m, C 1.705 m, D 1.695 m** (metadata rounded to centimetres). These are standing views, not concealed flying cameras. Maximum bilinear-cell corner slope is approximately **40.7°**; this is a geometry check, not a complete route/combat test.
- **Real 3D:** terrain, caravan, brazier, scaffold and held model remain geometry. The dome is at infinity; animated flame/smoke sprites are effects, not substitutions for walkable structures. No playable-area screenshot card was found.
- **No new distance-darkening breach:** the lead-accepted residual grain/glint issue is not reopened. The late orbit's full-width ground box, native pixels `(0,642)–(540,1051)`, has mean Y **21.8–33.5** across 19 half-second samples, with at most **.075%** below Y 5. The old near-black late world has not returned. This does not excuse the separate new sky regression.
- **Evidence limits:** the recorder calms creatures and `active` is empty. Hero/orbit inspection and the limited parity report do not certify combat, physical-phone performance, total process-memory limits or production served-build identity. No measured breach of those budgets is asserted.

SCORE signal-dunes: 6.3

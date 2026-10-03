# Round 10 — Signal Dunes — seat A

Lens: game art director. Reviewed the frozen ledger, brief, scores, council protocol, round-1 seats and rounds 3–9 Signal Dunes seats before scoring. This review judges the captured build **0ae71b2aac1015d0647d892eed3aaf909dfc8ed5**, not subsequent working-tree changes.

Surface: the Signal Dunes section of `art/mockup-council/round-10/README.md`, all five Signal Dunes comparison sheets, their full-resolution mockups, and every JPEG in `progress/sunscar-dunes/20261003-0432-0ae71b2a/`. Also inspected samples spanning the full ten-second orbit clip and compared the five scored frames with round 9. Source verification uses the captured SHA. Regions below are percentages of the original portrait frame, excluding sheet labels.

## Scores

| Mockup | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
| --- | ---: | --- | --- | --- |
| A — spawn dusk light | **6.0** | **Land, y 35–60%:** the target's long golden diagonal crest and broad shaded slip face are still replaced by a tower mound, open trough and a small pointed shadow wedge on the right. The new ridge has not supplied the dominant foreground landform. | **Sky, y 18–36%:** caramel cloud clumps float well above the horizon; the target has intricate, low, red-orange banks with dark interiors and much finer broken edges. The game sky and near sand are substantially brighter. | **Hands/coil, lower centre/right:** larger, lower loops are visible, but remain upright, evenly paired ovals with repeated braid markings. The target's broad overlapping low coils and quieter glove silhouette read differently. Sefa and her labels also occupy the target's open vista. |
| B — quest logbook | **6.5** | **Wagon, centre y 40–52%:** the large smooth orange wash obscures the opening and canvas. The target resolves an open arch, torn cloth, timber, wheels and a small hot lantern; the game still reads as a rounded covered body with a dark board below it. | **Camp and smoke, centre/left y 20–52%:** crates now stand up, but their faces and sacks lack the target's weathered, locally illuminated detail. Smoke remains a long pale narrow ribbon rather than the target's irregular, dissipating plume. | **Ground and held coil, y 58–85%:** the ground is darker than the target with stronger fine ripple contrast, while two regularly spaced tall loops replace its broad low overlapping coils. |
| C — waymark fire | **6.5** | **Fire, centre-left y 29–48%:** the hotter centre and thinner tips land, but the silhouette is still smooth orange cutout tongues around a soft white centre. The target has a tangled, turbulent, near-white fire rooted in visibly burning crossed fuel. | **Brazier/base, centre-left y 46–61%:** grey paint helps, but the decorated twisted shaft and regular brick courses differ from the worn straight post and irregular stone drum. The bowl/fuel contact lacks the target's hot, detailed edge. | **Light and smoke, y 18–65%:** smoke is much less substantial and differently shaped; the nearby dune silhouette rises behind the bowl rather than leaving the target's low open horizon. The pool has less convincing bright-to-dark structure, and sand outside it remains too textured. |
| D — hands/whip | **7.0** | **Held object, lower right y 63–85%:** the game exposes rounded finger/mitt forms covered in fine shiny crinkle; the target resolves knuckle folds, seams and broad worn leather planes. Larger double loops occupy much more of the centre than its compact held loop. | **Land, y 50–65%:** darker distant layers help, but the near and middle dunes remain visibly rippled and undulate differently from the target's smooth, broad, nearly black bands and restrained crest rims. | **Horizon, y 43–51%:** a bright line is present, but it has a narrow intense peach strip under an orange band; the target's broader, softer pale afterglow and quieter tonal transition are different. The objective markers also add visual clutter over the tower. |
| C — dusk signal fire (round-2 pick) | **6.5** | **Land, y 35–60%:** the broad tower mound is recognizable, but the target's lit left shoulder and continuous diagonal saddle are absent. The new isolated pointed wedge on the right does not match that saddle. | **Sky/hero silhouette, y 18–37%:** brighter violet-orange sky and high caramel banks replace the dusty amber sky with restrained grey banks at the right. The large ray crossing above the tower is absent from this scored frame. | **Held coil and beacon:** the lower larger coil is still two upright loops rather than the target's low loose diagonal loop. At the tower, the tiny keeper light and empty cage do not reproduce the visible flame and occupied platform silhouette. |

**Seat score: (6.0 + 6.5 + 6.5 + 7.0 + 6.5) / 5 = 6.5/10.** Below the bar. These are clearly the same places, but differences in landforms, clouds, fire and hero materials are immediate, rather than differences one has to look for. Changes since round 9 are evidence of implementation, not score bonuses.

The mockups disagree about the exact idle coil pose, and the older dusk pick has an older HUD. I have not demanded a separate pose or HUD for each camera. The current common idle and shipped baseline HUD are judged as shown; shot-specific substitutions would not be a valid fix.

## Rec. 709 measurements

All values are **Y = 0.2126 R + 0.7152 G + 0.0722 B**, on decoded RGB in the 0–255 scale, as specified by the brief. These are display-image luminance measurements, not linear-light radiometry. Mockups were resized with Lanczos to the stored game's 780 × 1688 resolution; games were already that size. Coordinates below are half-open pixel rectangles. No red-channel or maximum-channel brightness claims are used.

The builder's stated clean patch is **x 10–240, y 1150–1450**. I independently calculated it, then ran `art/sunscar-dunes/round-21-council-tools/measure.py` on the named captures; the results agree. “Fine” is mean absolute Y difference from the image blurred with a 2 px Gaussian, using the script's RGB-blur method.

| View | Mockup mean Y | Round 9 mean Y | Round 10 mean Y | Mockup fine | Round 10 fine |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 56.2 | 67.8 | **79.4** | 9.3 | 11.0 |
| B | 39.0 | 41.6 | **32.3** | 2.2 | 3.8 |
| C waymark | 32.4 | 41.8 | **35.7** | 0.7 | 2.3 |
| D | 34.5 | 38.3 | **34.0** | 0.9 | 2.4 |
| Dusk pick | 72.0 | 63.4 | **76.3** | 9.0 | 10.1 |

The README's B/C/D **36.6 / 37.5 / 33.4** do **not** reproduce on these final JPEGs. The broader direction does: C and D darken toward their targets, while B overshoots darker and A becomes brighter. Narrowing the patch to x 10–180 gives mockup/game A **55.6/82.7**, B **38.9/31.1**, C **32.2/36.1**, D **34.6/33.8**, dusk **73.4/80.3**; the conclusion survives a more conservative exclusion of the held object. The close D mean does not establish matching surface finish: its fine contrast is still higher.

Additional matching regions:

| Region at 780 × 1688 | Mockup | Round 9 | Round 10 | Reading |
| --- | ---: | ---: | ---: | --- |
| A sky, x 40–540, y 300–600: mean Y | 88.3 | 92.9 | **107.7** | The changed cloud bank increases brightness in this region rather than matching the target's darker complex masses. |
| Dusk sky, same rectangle: mean Y | 75.9 | 94.2 | **112.8** | The bright violet/caramel atmosphere remains a large colour/value mismatch. |
| C flame, x 150–450, y 530–900: Y p99 | 250.4 | 224.4 | **232.6** | Hotter than round 9, still below the target. This rectangle excludes the notification stack. |
| C flame, same rectangle: pixels Y > 235 | 4,338 | 4 | **687** | Near-white area is about 16% of the target in this matching flame window. This measures the window, not a separately segmented flame. |
| C ground below bowl, x 150–450, y 1060–1150: mean Y | 40.4 | 59.2 | **50.7** | The pool is dimmer, but its placement and falloff still differ. |
| B wagon opening, x 330–430, y 725–840: mean Y / p99 | 45.3 / 234.6 | 67.9 / 178.6 | **92.6 / 213.6** | A brighter broad wash accompanies a still weaker peak; brightness alone is not a lantern match. |
| B wagon opening, same rectangle: fine | 14.6 | 6.3 | **2.8** | Detail in the opening is further flattened by the halo. |
| D distant-left land, x 100–220, y 850–900: mean Y | 22.4 | 73.7 | **32.0** | The far-land darkening is substantial and observable, though this corresponding screen region is still brighter. |

These regions corroborate visible differences; they do not replace composition and material judgment with a whole-frame average. A and the dusk pick ask for different values on similar ground, so one global exposure adjustment cannot solve both.

## README claim verification

| Claim | Result against the captured build |
| --- | --- |
| Only dusk-fire yaw moved, −10° → −8° | **Verified.** Both `cameras.json` diff and the two captures' `camAt` agree. Every other recorded camera is identical, including hero views and heights. Dusk-fire position/FOV are unchanged; direction changes from [0.170, −0.216, −0.961] to [0.136, −0.216, −0.967]. This puts the tower closer to the mockup's horizontal position. |
| New real crest and re-baked terrain/navmesh | **Verified as implementation.** `layout.ts` declares the named segment and 7.5 m lift; `world/dunes.ts` adds its continuous height contribution. Both baked binaries and hashes change. The aerials show actual relief. Its silhouette is still insufficient. I did not independently rerun the claimed max-climb test or parity walk. |
| NNW key, crisp terminator, horizon line, darker far land | **Verified as implementation and visible effect.** `look/render.ts` changes the key to normalized (−0.45, 0.20, −0.87), adds a narrow normal-response ramp, and darkens distance lighting/fog/haze at dusk. `look/sky.ts` adds the horizon band. D's distant land darkens in the images. The six-azimuth sweep's result is described in a source comment, not independently reproduced here; this does not establish a matched light layout. |
| Hot core and bowl width | **Partly successful.** Flame quads narrow and the core gain rises; luminance confirms a hotter core. Orange contours still read as flat shapes, with too little hot fuel/near-white flame. Bowl scale by itself does not fix the supporting post and base. |
| Hot lantern centre/halo and standing cargo | **Present, but halo is a regression in detail.** `world/fireFx.ts` raises lamp halo gain and disables its depth test; the scored frame shows a broad orange veil over the canvas. Raised/stacked crates are visible. They still lack the target's readable material and local contact-light detail. |
| Greyed post | **Verified, incomplete match.** The colour treatment changes; shaft ornament and regular masonry remain conspicuous geometric differences. |
| Lower idle, larger loops, cord 0.04, albedo creases | **Verified.** `weapons/whipModel.ts` moves the glove y from −0.23 to −0.27, enlarges the loop radii and changes cord 0.03 → 0.04. `world/meshes.ts` strengthens crease modulation in the glove map. The result is visible as extra fine crinkle, not the target's structural leather folds. |
| Clouds broken into masses | **Verified, wrong character.** A coarse noise octave and taller cloud envelope replace the smooth strips. The resulting masses are puffy, high, warm blobs; the mockups call for lower, more fibrous banks with dark structure. |
| Page errors zero / parity green | `meta.json` records zero page errors. **Parity is a README claim, not independently certified by this seat.** A 30 fps badge, six-second load and 58 programs do not establish sustained phone performance or the memory limits. |

## Ranked findings

1. **R10A-SD-1 — Landforms before exposure.** A and dusk pick, middle y 35–60%, especially the new right-hand wedge. The ridge is real, but its short tapered footprint produces a small isolated point instead of the mockups' long diagonal crest/slip-face system. Rework the ridge's length, curvature, endpoint taper and connection to adjacent dunes in the terrain height function. Match the projected crest lines and lit/shaded face boundaries at both fixed spawn views, then inspect the aerials and walk the altered terrain. Preserve the broad tower mound; do not substitute a camera-relative shadow or move the camera.

2. **R10A-SD-2 — Cloud structure and sky values.** A/dusk pick, y 18–36%. The changed sky is brighter in both sampled windows and its clouds read as soft caramel clumps. Lower and flatten the bank envelope, break it into thin overlapping filaments with holes, darken the upper/interior mass and concentrate warm rims on the lower edges. Tune spatial sky colour so the dusty amber dusk pick and A's indigo ceiling are approached together. Judge both fixed views after each change; do not brighten the whole sky to strengthen one rim.

3. **R10A-SD-3 — Fire rooted in fuel.** C, centre-left y 29–48%, plus the distant beacon in the dusk pick. The narrower flame has cleaner tips but remains graphic. Break its continuous orange contours into overlapping turbulent licks and gaps, preserve a broader hot region directly over the actual fuel, and make the exposed logs look charred/hot where flame contacts them. Give the beacon a readable fire/platform silhouette at distance. Validate several animation frames and side views, retaining all normal smoke and embers; a single ideal frozen flame is not a solution.

4. **R10A-SD-4 — Lantern lighting should reveal the wagon.** B, centre y 40–52%. The opening's mean rises while its fine contrast collapses. Reduce the large halo, restore sensible occlusion, and position the visible lantern within an actual readable open arch. Use local light on torn canvas, hoop edges, tailboard and cargo rather than an additive veil across the whole body. Keep the newly upright cargo, but expose plank/cloth/sack variation and contact shadows. Check the ordinary h2 approach and a side view as well as B.

5. **R10A-SD-5 — Structural leather and a less regular common coil.** All held-object regions, especially D lower right. The new albedo crinkle supplies small bright flecks across rounded forms; it does not describe knuckles, folded finger joints, seams or worn panels. Add broad directional folds and seam geometry/material structure, subordinate the fine noise, and introduce modest irregularity in braid crowns and loop spacing. Fit one playable common hold to the set; the conflicting compact D pose is not authorization for a per-shot swap.

6. **R10A-SD-6 — Separate dusk value from ripple finish.** B/C/D, clean lower-left sand and the ground around C's bowl. B is now too dark in the specified patch; C/D remain more finely contrasted despite close means. Reduce the amplitude/regularity of late near ripples and tune the actual fire-pool falloff and ambient contribution spatially. Preserve the far-land darkening. Re-measure the final captured JPEGs and replace the README's stale B/C/D values; a value before later commits is not evidence for this capture.

7. **R10A-SD-7 — Finish the unchanged supporting materials.** C's post/base and B's smoke/cargo. Grey colour does not erase the spiral shaft or regular brick courses; use a worn straight support and irregular fieldstone form/detail consistent with the mockup. Make the camp smoke widen, curl and dissolve through several overlapping soft wisps rather than one long pale ribbon, while retaining one world-consistent wind. These are existing subjects, not requests for additional content.

## Ledger §5 checks

- **Fixed views:** the only recorded change is the disclosed dusk-fire re-aim. Its tower placement moves toward the mockup, with no position/FOV change or cropped-away weak area. Other cameras and their actual heights are unchanged. Pass on the evidence supplied.
- **Real geometry:** the new crest is in the terrain height function and bake; wagon, cargo, post and coil are world/weapon geometry. Sky changes are at infinity. Flame/halo effects do not replace walkable structures. The depth-test-disabled lantern halo is an art/occlusion problem (finding 4), not evidence of substituted geometry. No confirmed screenshot-geometry shortcut found.
- **Staged state:** the metadata lists exactly B=`logbook`, C/D=`waymarks-lit`, unchanged from round 9. At the captured SHA, B sets the same Sefa-met flag as dialogue, leaves the book unread and snaps dusk to 0.50; eleven seconds later it remains at that reachable state. C runs the book interaction, well pull/oil interaction and actual oil/light actions; dusk is settled at two-lit 0.74 before the final light. The normal update advances at 0.02/s, so the three-second shot is about 0.80, rather than showing fresh notices at an instantly snapped 0.86.
- **C's spatial/timing reachability:** the staging helper lights the array's last brazier remotely, so it is not itself a filmed walkthrough. However, gameplay permits the three braziers in any order (`quest/install.ts` uses all flags, not a sequence). A player can leave the pictured west brazier at (−44, −22) last. Its camera at (−53.9, −17.2) is about 11 m away; a 7–8 m lash plus the bowl's crack radius lets the player light from nearby and step back a few metres during those three seconds. The fire, completion notices and intermediate dusk can coexist here. This is code-supported reachability, not a new physical replay by this seat.
- **D:** its eleven-second settle passes the six seconds needed to reach 0.86 from 0.74. Lit waymarks and that dusk persist while a player walks to D; fresh notices need not persist. No transient hand pose is frozen, and fire effects remain present. Pass for the staged state.
- **Phone/HUD:** the scored frames retain the touch controls and baseline HUD. HUD-hidden aerials are inspection views, not scored replacements. Capture code calms creatures for static shots but does not replace the held weapon with a special frozen action; the orbit samples show moving flyers and running fire effects. The missing large ray in the dusk frame remains a composition gap, not a reason to paste one over it.
- **No narrowing / budgets:** hero views, aerials and clip samples retain the caravan, tower, route and lit braziers. They establish that the changes extend beyond the five cameras, but do not exercise combat, traversal under load or sustained phone memory/FPS. The changed terrain/navmesh is present; the README's parity/max-climb claims need their actual reports to certify those checks. No demonstrated breach on this review surface; performance and full-play regression remain unverified, not silently passed.

No confirmed ledger violation requiring a void. The visual score remains below 8 on the captured evidence.

SCORE signal-dunes: 6.5

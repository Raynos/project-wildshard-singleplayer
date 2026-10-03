# Mockup council — round 7, Signal Dunes, seat A

Lens: game art director comparing the game with the frozen mockups. Only Signal Dunes is scored.

Read COUNCIL.md, ledger.md, brief.md, scores.md and the earlier Signal Dunes seats for rounds 1–6. Reviewed the five
Signal Dunes sheets, the original mockups at full resolution, all five matching game frames, first-frame, four hero
views, both aerials, and clip.mp4 sampled once per second across ten seconds. Compared the scored views with rounds
5 and 6. Evidence: `progress/sunscar-dunes/20261003-0156-eeee0e02/`. Source checks use captured commit
`eeee0e0298dcf0ec53ccb034589043f85af15158`, not the newer working tree. Regions are fractions of the portrait picture,
x left to right and y top to bottom, excluding sheet titles.

**Signal Dunes: 5.8/10 as a diagnostic image comparison, below 8.** The terrain reversion restores the shadow mass,
C's distant waymark and D's open view. These are recognizable scenes, but the different ridge arrangement, cloud
structure, fire and leather finish remain immediately visible. Scores award no points for effort or recovery.
**C's staged combination of settled dusk and fresh completion notices is not a normal reachable play frame:** see
R7-A-P1 below. Its number and the five-view mean are diagnostic only; the round cannot establish a ledger-compliant pass.

## Signal Dunes (`sunscar-dunes`)

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `A-spawn-dusk-light.jpg` → `mock-A-spawn` | 6.0 | **Landscape, x 0–1 / y 0.35–0.70:** the mockup's bright diagonal near ridge overlaps a separate shaded tower dune and several receding crests. The game has one rounded tower mound above a broad swale. Its restored dark face does not supply that near ridge, sharp golden crest or layered depth. Sefa occupies the left foreground; keep her ordinary quest role. | **Sky, x 0–1 / y 0.18–0.40:** internally textured burnt-orange banks become pale peach flakes and long horizontal lines against plum. The distant range is a crisp lavender silhouette rather than hazy receding ranges. | **Foreground, y 0.60–0.85:** the mockup's irregular grazing-lit grain and broad bottom-entering coils become regular ripple bands and smaller inward loops beside an exposed fist. The whip's alternating light rectangles still read as a patterned tube, rather than crossing leather strips. |
| `B-quest-logbook.jpg` → `mock-B-logbook` | 6.0 | **Wagon, x 0.28–0.62 / y 0.40–0.54:** recognizable hoops and torn cloth are present, but the evenly orange shell, broad flat tailboard and small rectangular lamp lack the target's distinct boards, spokes, weathered cloth and localized lantern glow. | **Camp/plume, x 0.12–1 / y 0.20–0.55:** cargo is mostly dark slabs, the animal is end-on, the tent is a large flat sheet at the edge, and smoke is a thin continuous ribbon. The target's readable cargo, side-on animal and widening broken plume are obvious differences. | **Ground/weapon/sky:** the game has brighter, more strongly patterned near sand, a smaller higher coil and plum sky rather than the target's dim soft sand, broad low coils and blue-violet starfield. The baseline pin/tracker and absent distant READ prompt also differ; do not fabricate UI for the picture. |
| `C-waymark-fire.jpg` → `mock-C-waymark` | 6.0 (diagnostic; staged frame void) | **Fire, x 0.25–0.50 / y 0.30–0.51:** a few smooth cream tongues and sparse dot sparks replace ragged orange combustion, an irregular hot core, visibly burning logs and a broad stream of ember streaks. Some short fuel tips now show, without the old lambda; they still do not read as the target's burning log bed. | **Brazier/light, x 0.20–0.55 / y 0.47–0.66:** copper bowl, twisted shaft and regular clean brick courses replace soot-dark iron on rough fieldstone. The broad pale pool lacks the target's concentrated orange illumination and granular falloff. | **Composition, middle/lower:** the fire is left of the target and backed by a high diagonal dune instead of sky above a low horizon. The next lit waymark is restored at right, but its base is obscured. The small inward coil, clipped left marker and higher notice stack differ. The settled dusk plus fresh notices fails the timing check below. |
| `D-hands-whip.jpg` → `mock-D-hands` | 5.5 | **Hero glove/coil, x 0.35–1 / y 0.60–0.85:** a cuff stitch line now reads, but the glove retains broad mottled panels and bead-like fingers instead of the target's sharp knuckle folds, worn edges and many small leather highlights. The whip is an alternating block lattice with flat-looking light cells, not curved overlapping plait strips. | **Landscape, x 0–1 / y 0.45–0.85:** restoring round 5 removes the close flank, but diagonal rolling mounds and whorled ripples still replace long horizontal dark ridge bands and smooth near sand. The tower remains on a hump and partly covered by its pin. | **Sky/horizon, y 0.20–0.52:** the mid-sky is dimmer, the afterglow narrower and more orange, and the pale range harder than the target's broad soft peach-pink transition. Similar near-ground brightness does not fix these forms or the large value bands. |
| `C-dusk-signal-fire.jpg` → `mock-dusk-fire` | 5.5 | **Landscape, x 0–1 / y 0.35–0.85:** the restored dark tower face is recognizable, but the sweeping near shaded saddle and bright raked left shoulder become a rounded mound over a shallow swale, with the lit shoulder chiefly at right. The granular crest highlights remain weaker than the target. | **Sky/focal subjects, x 0–1 / y 0.17–0.44:** the target's amber/grey-brown atmosphere and restrained right-side cloud banks become purple with pale flakes across the width and ruled streaks. Its large ray and burning tower lamp/fire are absent. The tall empty upper cage differs from the target's occupied platform silhouette. | **Weapon, x 0.35–1 / y 0.60–0.85:** the larger coil improves span over round 5, but the block pattern and exposed fist differ from the dark diagonal plait and creased leather. The old ammo/FIRE layout differs from the required baseline melee HUD. |

**Diagnostic seat mean: (6.0 + 6.0 + 6.0 + 5.5 + 5.5) / 5 = 5.8.**

## Rec. 709 measurements

All brightness is `Y = 0.2126 R + 0.7152 G + 0.0722 B` on decoded JPEG RGB, 0–255, as required by the brief.
These are displayed-image comparisons, not linear-light radiometry. Original mockups were resized with Lanczos to
780×1688. The **clean sand rectangle is (10,1150)–(240,1450)** in every image, clear of the viewmodel, Sefa and controls.
Fine detail is mean absolute difference from Gaussian-blurred Y, sigma 2 pixels. The blur is applied to that rectangle.
Spread is p95 minus p5. These are the same fixed coordinates across all four columns, not an average contaminated by
the enlarged coil. The README does not define its ROI or fine-detail algorithm; its exact figures cannot be reproduced.

Values in each cell are **mockup / round 5 / round 6 / round 7**.

| View | Clean sand Y median | Clean sand Y mean | p95−p5 spread | p99 highlights | Fine detail |
|---|---|---|---|---|---|
| A | 53.8 / 80.6 / 61.2 / **78.3** | 56.2 / 79.1 / 60.2 / **76.8** | 78.1 / 40.0 / 49.7 / **46.9** | 116.1 / 98.8 / 90.0 / **102.2** | 9.18 / 2.52 / 6.07 / **3.87** |
| B | 39.2 / 40.5 / 47.1 / **48.0** | 39.0 / 40.1 / 46.0 / **46.9** | 22.5 / 40.7 / 41.5 / **42.1** | 56.2 / 66.5 / 70.8 / **72.1** | 2.23 / 4.25 / 4.61 / **4.67** |
| C | 33.5 / 16.6 / 15.4 / **16.3** | 32.4 / 20.7 / 15.5 / **18.0** | 14.9 / 39.8 / 19.2 / **26.3** | 47.0 / 54.9 / 34.6 / **37.2** | 0.83 / 1.06 / 1.48 / **1.49** |
| D | 33.2 / 31.4 / 18.5 / **31.6** | 34.5 / 31.2 / 18.3 / **31.2** | 31.6 / 23.2 / 23.4 / **24.3** | 53.0 / 43.4 / 35.9 / **44.4** | 1.02 / 0.97 / 2.26 / **1.28** |
| dusk-fire | 69.7 / 78.0 / 57.1 / **77.7** | 72.0 / 77.0 / 56.0 / **74.9** | 69.0 / 37.6 / 51.7 / **49.9** | 128.0 / 97.3 / 87.7 / **99.7** | 8.83 / 2.52 / 6.15 / **3.98** |

Additional regions:

- **Sky, (40,300)–(540,600), target / round 7 Y mean:** A 88.3 / 81.6; B 50.1 / 44.0; C 52.5 / 39.6;
  D 50.0 / 37.7; dusk-fire 75.9 / 89.6. This is a sky-region reading, including clouds/smoke where present, not an
  isolated zenith measurement.
- **C flame, (180,500)–(470,820), pixels with Y > 150:** target / round 5 / round 6 / round 7 mean Y
  **213.2 / 187.6 / 200.4 / 199.8**, p99 **253.6 / 216.0 / 226.8 / 224.7**. The round-6 brightness gain is retained,
  but its smooth pale silhouette and highlight ceiling still differ. A bright red channel is not the measurement.
- **D hand/cuff, common box (620,1110)–(740,1210):** target / round 7 Y mean **31.6 / 25.5**, p99 **100.8 / 68.1**,
  detail **8.31 / 3.42**. Round 6 detail was 1.46. This shows added visible surface variation, while the phone-sized
  render still lacks the target's crease/stitch/highlight finish. This box compares picture regions, not isolated
  samples of exactly the same leather panel after the model grew.
- **Dune-band macro spread:** blur Y at sigma 12 within x 0–780, A y 710–980 and dusk-fire
  y 692–980. Target / round 5 / round 6 / round 7: A **70.4 / 45.8 / 30.2 / 51.9**;
  dusk-fire **45.9 / 56.3 / 26.6 / 62.1**. The dark mass has returned. A larger aggregate spread in dusk-fire does
  not mean the right lit shoulder and shaded saddle occupy the right places.

## README claims verified

| Claim | Verdict against captured source and pictures |
|---|---|
| No mock camera changed; real heights exactly back to round 5 | **Supported.** Recorded camera blob remains `d78968c7b3a011f4e320415406300cfe3f899fbb`. Every scored `camAt` position, direction and FOV equals round 5's. The README's round-6 height deltas match the metadata. `world/dunes.ts` and `layout.ts` are identical to round 5 at this commit. |
| D median 37, round 5 36, mockup 40; RGB 57,31,32 | **Restoration supported; exact numbers unverified without the ROI.** On the declared clean patch, medians are 31.6 / 31.4 / 33.2; RGB mean is 50.8,25.8,26.9 versus target 49.8,30.6,27.9. D returns to round 5 rather than remaining round 6's dark red. Its ridge arrangement and spread remain different. |
| A/dusk-fire at round 5 light, p50 75 | **Approximately supported on near sand.** Clean medians are A 78.3 versus round 5 80.6, dusk-fire 77.7 versus 78.0. These readings do not establish the whole target light hierarchy: A's target patch is 53.8 and dusk-fire's is 69.7, with substantially stronger highlights/spread. |
| A fine detail 5.8, round 5 5.3; grain retained | **Source grain retained; gain over round 5 visible, exact figures not reproducible.** My clean patch gives 3.87 versus 2.52, target 9.18. It is also below round 6's 6.07 under the restored viewpoint/light. Retaining shader grain does not retain its entire rendered contrast. |
| Plait dark brown, diagonal strands, dark gaps, one warm rim, roughness 0.45 | **Brown/gaps and source constants supported; finished plait not delivered.** `world/meshes.ts:wornLeather()` changes frequency 70→48, brown strand colours, alternating `sa * sign(sb)` and whip roughness 0.85→0.45. The frame is no longer copper-orange, but the pattern remains light rectangular cells and dark diagonal bands projected from model xyz. It lacks curved alternating overlaps and strand relief following the cord. |
| Larger low coil retained | **Supported as the ordinary hold; match partial.** `HD_GLOVE.size` remains 0.30, with one constant transform. A/B/C still have less broad, bottom-entering coils than their targets, and enlarging the entire model also exposes a larger fist. No special D transform is requested. |
| Logs retained, no unlit glow or lambda | **Rendered defect repaired, but not literally unchanged logs.** `kindling()` changes crown lean from −1.15 to −0.8 and length from 0.26–0.32 to 0.34–0.40, exposing short tips. No emissive red cone or protruding glowing bars appear in h3/C. Fuel still lacks the target's burning log finish. |
| Stitched gauntlet seam | **Present and visible, incomplete finish.** Pale dashes run along the cuff/back over a dark welt. They improve detail, but do not supply the target's sharp folded leather, stitched panel relief and small knuckle highlights. |
| Highlight on crest band only | **A normal-angle gate exists; spatial exclusivity is not established.** `look/render.ts` boosts direct diffuse on unshadowed normals grazing the key. It does not identify geometric crests: any eligible slope can receive it. The rendered target's bright diagonal crest remains absent, and clean-sand p99 is still below the targets. |
| No staging-code change | **Supported, but unchanged does not prove full reachability.** No `plugin.ts`/dusk staging change occurs between the captures. R7-A-P1 finds an existing timing inconsistency using additional source evidence. |

## Ranked findings and concrete fixes

Art rows continue the earlier named gaps and are `should-fix`. R7-A-P1 is the prerequisite for valid scored evidence.

| Rank / ID | Mockups and frame region | Concrete fix |
|---|---|---|
| 1 / R7-A-P1 / must-fix | C, notices y 0.18–0.31 plus whole-frame dusk; ledger §5 staged real play frame | **Recapture a real combination of dusk and completion UI.** At the captured commit, `plugin.ts:31` gives two-waymark target 0.74 and three-waymark target 0.86; `look/dusk.ts:11,20–22` eases at 0.02/s. Thus reaching 0.86 after the last light takes at least **6 seconds**. `world/build.ts:93–94` raises the last flag and immediately emits the all-lit toast; `ToastStack.ts:5,47–54` removes it after **3.2 + 0.5 = 3.7 seconds**. The helper instead executes all lights then `setDusk(..., true)` (`plugin.ts:55–57`); the recorder waits only 3 seconds, producing the visible fresh all-lit/step/objective notices at already-settled dusk. Earlier seats verified handlers and the eventual milestone, but missed this simultaneous-state timing. Stage a genuine two-lit settled predecessor, perform the last normal oil/crack action and let dusk ease while capturing its real notices/effects; alternatively capture the fully settled three-lit state after notices naturally disappear. Do not preserve notices artificially or snap the final transition. Record actual dusk and stage elapsed time with the recapture. C is void as pass evidence until then. |
| 2 / R7-A-SD1 | A/dusk-fire y 0.35–0.85; D y 0.45–0.85 | Keep the restored shade and open sightlines, then shape the missing real ridge arrangement: A's diagonal near crest before a separate tower dune; dusk-fire's shaded saddle and lit left shoulder; D's long low transverse bands and smooth near swale. Make the terminator follow those forms and put grazing highlights on their crests/ripple tops. Preserve routes, rebuild navigation and verify walking. Measure separate lit/shaded regions, not just the whole band's spread. |
| 3 / R7-A-SD2 | All weapons; D x 0.35–1 / y 0.60–0.85 | Use cord-following braid coordinates or a proper normal/bake with alternating overlapping strips and restrained edge sheen. The xyz block pattern still wraps like printed checks. Keep dark leather and the single sustained hold; separate coil sizing from fist sizing to approach A/B/C's broad low loops. Preserve the new thread, but add seam grooves, folds and knuckle relief that read at phone size. Trace the surviving pale top-of-fist specular patch in B; do not call a colour clamp a complete fix. |
| 4 / R7-A-SD3 | A/dusk-fire sky y 0.18–0.40; B/D middle sky and horizon | Replace flakes/ruled lines with irregular internally shaded cloud banks: burnt orange in A, restrained grey-brown chiefly at right in dusk-fire. Use the normal quest dusk progression. B needs the clearer blue-violet starfield; D needs lighter mid-sky and broader peach-pink afterglow. Fade and separate the far ranges instead of presenting a crisp lavender cut-out. |
| 5 / R7-A-SD4 | C fire/plume/base x 0.20–0.55 / y 0.30–0.66 | Retain contained dark unlit fuel. Build ragged orange edges around a smaller irregular hot core and visible burning log ends; break/lean smoke and vary short warm ember streaks. Weather bowl/shaft to soot iron and the plinth to uneven fieldstone. Concentrate orange ground light around the base with granular falloff. Preserve the restored distant waymark and real effects when recapturing C. |
| 6 / R7-A-SD5 | B wagon/cargo x 0.12–1 / y 0.40–0.55; smoke above | Localize lantern light to the opening and near cloth; give the lamp visible glow and let its normal light reveal cargo planks/sacks. Separate hoops, pale sagging cloth, tailboard boards and wheel spokes. Present the existing animal side-on and integrate the tent at the smaller background scale. Replace the smoke ribbon with widening broken lobes; soften/dim the nearby sand toward the target. |
| 7 / R7-A-SD6 | dusk-fire tower/fire/ray x 0.15–0.60 / y 0.17–0.44 | Capture the actual illuminated-tower milestone with its normal quest/dusk/summon effects, or document and implement a genuine pre-signal beacon if that is the intended small target flame. Time the moving ray on its ordinary route at the target scale. No isolated flame switch, frozen ray or capture-only pose. Match the occupied platform/bracing silhouette. |
| 8 / R7-A-SD7 | aerial-overview boundary y about 0.25–0.30; far ranges in clip | Continue the earlier terrain/shading join check: the contextual views still show broad dark lobes and a horizontal field transition, while the clip shows pale strips between range layers. Trace actual terrain/normal and baked-map continuity, distinguish genuine dune cast shade from map-edge artifacts, and check ground as well as aerial views. Do not hide these with re-aims. |
| 9 / R7-A-P2 / should-fix | README and capture compliance evidence | Publish exact measurement rectangles/masks and blur method alongside quantitative claims. Attach served-build identity/shipping status, the code-equivalent parity result, phone frame-time and total loading/Explorer memory readings. This is missing verification, not a measured budget violation. |

## Ledger §5 audit

- **Views:** no re-aim. Camera blob unchanged and every scored actual camera exactly matches round 5, including FOV 72.
  The documented real height moves reverse round 6's terrain change. The global dunes/crest reversion is visible in
  hero views and aerials; no camera-conditioned landscape or deliberate dodge was found.
- **Real geometry/look:** terrain, tower, wagon, cargo, animal, tent, braziers and weapon are ordinary world meshes.
  Sky/ranges are distant backdrop; fire/smoke/pools are effects on real structures. No painted card substitutes for
  a walkable subject. Grain, plait, seams and fuel appear in contextual views too, not only scored pictures.
- **B `logbook`: reachable.** SCOUT_FLAG matches Sefa's initial dialogue (`quest/scout.ts:20`), leaving the logbook
  unread. Normal play can ease to dusk 0.38 and hold this milestone; B settles eleven seconds and has no completion
  notices. Its 22 m camera is outside the real 2.4 m interaction radius. Keep the normal absence of a READ prompt.
- **C/D milestone:** the helper invokes the real logbook, well pull, jar, and each brazier's oil/light handlers,
  including raised bucket, removed jar, visible oil, labels, flags and flames. The quest permits any brazier order.
  Three lit braziers with dusk 0.86 is eventually reachable; **C's fresh-notice combination is not**, as R7-A-P1
  establishes. D's eleven-second settle and faded notices avoid that timing mismatch. This is source verification,
  not a new physical-device walkthrough. B/C/D are correctly listed in `meta.json.staged`.
- **Pose/effects:** one ordinary `HD_GLOVE` transform, no frozen attack or staged weapon pose; C retains its fire,
  smoke, sparks and pool. The recorder calms creatures, so its orbit is not combat regression evidence. Before Sefa,
  ordinary quest code already keeps the ray on its home glide; it is not frozen into the missing dusk-fire subject.
- **A/dusk-fire:** reachable initial state, unlit tower and Sefa objective. Dusk-fire does not capture the target's
  burning-tower/ray conjunction; missing subjects lose similarity points.
- **Phone/HUD:** captured recorder requests 390×844 @3, phone tier and touch, saving 780×1688 JPEGs and restoring
  baseline HUD/viewmodel after aerials. No shot-only HUD/look was found. Old mockup UI does not authorize a restyle.
- **No narrowing/budget/shipping:** the inspected diff retains quest/combat and changes ordinary materials/terrain.
  Commit `eeee0e02` reports m5 parity green at `19e78bf2e`; `src/` and the recorder are identical between those two
  revisions. The round surface does not attach that result, measured phone frame-time distributions, total process
  loading/Explorer memory or deployment identity. Its caller-supplied SHA, 30 fps chip and zero page errors do not
  establish all ledger limits. Wider frames reveal no demonstrated new regression, but do not prove normal combat.

The five numbers describe the supplied images. The 8/10 art bar is unmet, and C requires a real-play recapture before
the round can count as pass evidence. Only Signal Dunes is scored here.

SCORE signal-dunes: 5.8

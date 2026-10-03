# Mockup council — round 6, Signal Dunes, seat A

Lens: game art director comparing the game frames with the frozen mockups. Only Signal Dunes is scored.

Read COUNCIL.md, ledger.md, brief.md, scores.md and the earlier Signal Dunes seats for rounds 1–5. Reviewed the five
Signal Dunes comparison sheets, the five original mockups resized from their full resolution, all five matching game
frames, first-frame, the four hero views, both aerials, and clip.mp4 sampled once per second across its ten seconds.
Evidence: `progress/sunscar-dunes/20261003-0132-28e3eb78/`. Source checks use captured commit
`28e3eb78c51d6f41618d83e2ca23be34384ab4d0` and its diff from `56c23085`, not the newer working tree. The recorded camera
blob remains `d78968c7b3a011f4e320415406300cfe3f899fbb`. Regions below are fractions of each portrait image, x left to
right and y top to bottom, excluding sheet titles.

**Signal Dunes scores 6.1/10, below 8.** The grain is more visible, the coils are larger, and the protruding glowing
log triangle is repaired. The landscape composition, cloud forms, fire detail and leather finish still differ without
having to search. The terrain revision also makes D's foreground composition less like its target. These are picture
similarity scores; implementation effort and earlier scores earn no points.

## Signal Dunes (`sunscar-dunes`)

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `A-spawn-dusk-light.jpg` → `mock-A-spawn` | 6.0 | **Landscape, x 0–1 / y 0.36–0.70:** the target's diagonal lit foreground crest crosses a deep cool slip face, overlapping a separate tower dune and receding ridges. The game still faces one dominant rounded mound above a swale. Shorter terrain waves have not delivered the target's visible sequence of crests or its narrow grazing highlight. Sefa occupies the left foreground; retain her ordinary quest role. | **Sky, x 0–1 / y 0.18–0.40:** broken red-orange cloud banks with internal texture become broad pale peach flakes and long horizontal streaks against purple. The pale, crisp distant range lacks the target's receding hazy layers. | **Foreground, y 0.60–0.85:** grain is now apparent, but pronounced regular ripple bands and a smaller inward coil differ from the target's granular grazing relief and broad coils entering at the bottom. The enlarged exposed fist still sits higher; the whip's lattice pattern is much lighter than the target's dark leather strands. |
| `B-quest-logbook.jpg` → `mock-B-logbook` | 6.5 | **Wagon, x 0.28–0.62 / y 0.40–0.53:** the game has readable hoops and warm canvas, but broad uniformly orange panels, a flat lower board and a small non-glowing lantern replace the target's weathered cloth, boards, spokes and localized interior light. | **Camp and plume, x 0.12–1 / y 0.20–0.55:** cargo remains dark slabs/lumps, the horse is end-on, the tent is a large flat panel at the right edge, and the smoke is a thin continuous ribbon. The target has readable cargo, a side-on animal, a smaller integrated tent and expanding broken smoke. | **Foreground/sky:** the game sand remains brighter and more finely patterned than the target; the enlarged coil still occupies less of the lower centre. Its sky is plum rather than the target's blue-violet starfield. The different baseline pin/tracker and missing distant READ prompt remain visible differences; do not fabricate UI for the shot. |
| `C-waymark-fire.jpg` → `mock-C-waymark` | 6.5 | **Fire, x 0.26–0.49 / y 0.31–0.51:** the log triangle is gone and the flame is brighter, but it is still a few smooth cream tongues. The target has turbulent orange edges, a broken hot core, burning logs, wind-leaning smoke and a broad stream of warm ember streaks. The game retains sparse dots and a soft column. | **Brazier/light, x 0.20–0.55 / y 0.47–0.66:** a warm copper bowl, twisted shaft and clean regular brick base replace soot-dark iron and irregular stone. The reduced pool is closer in brightness but remains pale and smooth; the target's concentrated orange light picks out ground relief around the plinth. | **Composition, middle/lower frame:** the bowl sits left of the target and against a high diagonal dune instead of sky above a low horizon. The distant waymark is not clearly readable in this supplied frame at the target's right-horizon position. The coil is larger but still much smaller/higher than the target's low loops; a marker is clipped at left. |
| `D-hands-whip.jpg` → `mock-D-hands` | 5.5 | **Landscape, x 0–1 / y 0.44–0.84:** a large close diagonal ripple-covered slope now dominates, where the target has long low horizontal ridge bands and smooth near sand. The tower remains partly obscured by terrain and its pin. A larger tonal spread does not repair those different forms. | **Hero glove/whip, x 0.55–1 / y 0.60–0.84:** the target shows stitched panels, sharp knuckle creases, worn edges and distinct crossing plait relief. The game is a broadly mottled dark fist with faint seams and a conspicuous tan diamond grid on a rounded coil. The common low-coil ruling is accepted; no special D pose is requested. | **Sky and exposure, y 0.15–0.84:** the mid-sky remains dimmer, the afterglow narrower and more orange, and the ground is now substantially darker/redder than the target. The close slope emphasizes coarse ripple stripes rather than the target's quiet blue-hour depth. |
| `C-dusk-signal-fire.jpg` → `mock-dusk-fire` | 6.0 | **Landscape, x 0–1 / y 0.34–0.85:** a real tower dune and finer grain exist, but the target's sweeping shaded saddle and brightly raked left shoulder become a rounded mound, shallow swale and striped foreground. Ground light is darker and its spread remains short. | **Sky/focal subjects, x 0–1 / y 0.17–0.44:** the amber/grey-brown atmosphere and restrained clouds at the right become purple sky with pale flakes across the width and ruled streaks. The large ray above the tower and its burning lamp/fire are absent. The tower's very tall empty upper cage differs from the target's occupied platform/bracing. | **Weapon, x 0.40–1 / y 0.60–0.85:** the larger coil is closer in span, but its tan grid and broad exposed fist differ from the target's dark interwoven loop and finely creased leather. The old mockup's ammo/FIRE layout also differs from the required baseline melee HUD. |

**Seat score: (6.0 + 6.5 + 6.5 + 5.5 + 6.0) / 5 = 6.1.**

## Rec. 709 measurements and README verification

All brightness values use `Y = 0.2126 R + 0.7152 G + 0.0722 B` on decoded JPEG RGB values, 0–255, as specified by
the brief. These are displayed-image comparisons, not linear-light radiometry. Mockups are resized with Lanczos to
780×1688, the stored game size. Ground mean uses `(40,1050)–(540,1300)`. Spread is p95 minus p5 over
`(50,880)–(390,1350)`; in A, `(80,900)–(245,1170)` is excluded from both images to avoid Sefa. Fine detail is the mean
absolute difference from Gaussian-blurred Y, sigma 2 pixels, over the ground-mean box. Broad boxes measure the image's
structure, not isolated material properties. The README gives no exact ground-band ROI/mask, so its precise numbers
are not reproducible; the following checks their direction using the earlier seat A method.

| View | Ground RGB mean, mockup / round 6 | Ground Y mean, mockup / round 6 | Ground spread, mockup / round 5 / round 6 | Fine detail, mockup / round 5 / round 6 | Sky-box Y, mockup / round 6 |
|---|---|---|---|---|---|
| A | 92.4,52.9,36.5 / 90.0,46.8,27.2 | 60.1 / 54.6 | 91.7 / 48.1 / 51.3 | 7.74 / 2.95 / 5.77 | 88.3 / 85.0 |
| B | 59.3,31.9,26.3 / 73.3,41.5,32.4 | 37.3 / 47.6 | 35.8 / 51.7 / 52.6 | 1.68 / 3.91 / 5.15 | 50.1 / 44.0 |
| C | 63.0,31.2,22.7 / 57.0,26.5,21.1 | 37.4 / 32.6 | 81.1 / 104.1 / 81.5 | 0.81 / 1.26 / 2.69 | 52.5 / 42.3 |
| D | 58.1,34.8,31.3 / 44.1,18.9,18.9 | 39.5 / 24.3 | 52.9 / 22.6 / 41.9 | 1.50 / 1.29 / 3.40 | 50.0 / 37.7 |
| dusk-fire | 106.6,62.0,36.4 / 90.7,46.3,26.1 | 69.6 / 54.3 | 64.5 / 45.1 / 44.3 | 8.58 / 2.70 / 5.97 | 75.9 / 90.1 |

Sky box is `(40,300)–(540,600)`, the earlier seats' region; it includes cloud/smoke where present and is not an
isolated zenith reading. Ground fine detail above the mockup in B/C/D is not automatically a gain: D calls for smooth
near sand, while the game adds ripple/grain everywhere in that frame.

Additional checks:

- **C flame:** within common box `(180,500)–(470,820)`, selecting only pixels with Y above 150, mean Y is
  **213.2 / 187.6 / 200.4** for mockup / round 5 / round 6; p99 is **253.6 / 216.0 / 226.8**. Brighter is supported,
  but the target's hot highlights and turbulent edges remain absent. This is luminance, not clipped red-channel glow.
- **C ground pool:** subject-relative patches, mockup x 0.25–0.65 / y 0.55–0.65, game x 0.20–0.60 / y 0.57–0.66,
  yield Y **60.1 / 80.6 / 66.9** for mockup / round 5 / round 6. The pool is dimmer and nearer the target. Its rendered
  brightness is not halved; background light, compositing and changed terrain also contribute.

| README claim | Verification |
|---|---|
| Dusk-fire spread 62/45, fine detail 8.5/6.5; A spread 79/50, fine 7.2/6.6 | **Direction supported, exact fine values ROI-dependent.** My dusk-fire spread is 64.5/44.3 and A 91.7/51.3. Fine detail rose strongly, to 5.97 and 5.77 respectively, but remains below the mockups. Neither spread closes the visual placement of crest light and shadow. |
| D spread 53/45; B 34/42; C 67/77 | **D's increase supported; exact B/C values unverified without the builder's ROI.** My spreads are D 52.9/41.9, B 35.8/52.6, C 81.1/81.5. In D the improvement comes with a darker, closer slope and stronger ripple pattern, not the target's horizontal ridge bands. |
| Anisotropic grain, finer octaves, noise-bent crests, ripples on slip faces | **Source and visible grain supported; target relief incomplete.** `look/render.ts` adds anisotropy 8, three grain samplings, value-noise phase bending and a stronger ripple term on slopes. Grain survives in A/dusk-fire. Larger bands still read as regular corduroy, and A still lacks its bright diagonal crest. Source scales alone do not verify literal millimetre detail on the phone. |
| Charred unlit logs, short/splayed, no lambda or unlit glow | **Supported.** `world/places.ts:kindling()` removes crown emissive and shortens/flattens the logs. C has no tall triangle; unlit h3 has no red glowing tent and no long bars piercing the cage. The bowl's upright cage fingers remain, correctly distinct from the logs. |
| Brighter flame, half the light pool | **Flame brighter; pool reduced, not halved in displayed luminance.** Flame multiplier rises 0.95 → 1.35. Pool coefficients change 0.42 → 0.20 and 0.50 → 0.32, so even source amplitudes are not uniformly halved. Measurements above confirm the rendered direction. |
| Crossing plait, larger low coil | **Larger ordinary hold supported; finished plait not delivered.** `HD_GLOVE.size` rises 0.22 → 0.30 with one offset/rotation. `world/meshes.ts` adds two sine strand sets in model coordinates and roughness 0.85 on the whip. The result is a regular diamond net on tan leather, not curved interwoven strips with recessed crossings and individual highlights. The whole gauntlet is enlarged, so the exposed fist also grows. |
| C/D ground dark; stitching faint | **Supported.** C ground Y 32.6 vs 37.4; D 24.3 vs 39.5. Panel stitching and knuckle creases remain much weaker than the D mockup. |
| No camera re-aim or staging-code change | **Supported with the documented real-height distinction.** Camera blob and directions remain unchanged; `plugin.ts`, including `stage()` and `duskOf()`, is unchanged in the captured shard diff. The listed terrain-driven camera height changes agree with `camAt`. |

## Ranked findings

Art findings below are `should-fix`, continuing the earlier seats' named gaps. They require only the mockups' existing
subjects and finish, with changes available in normal play.

| Rank / ID | Mockups and frame region | Concrete fix |
|---|---|---|
| 1 / R6-A-SD1 | A/dusk-fire landscape, y 0.35–0.85; D y 0.44–0.84 | Rework the real ridge arrangement, not just its wavelength. A needs a distinct diagonal near crest crossing in front of the shaded tower dune; dusk-fire needs its shaded saddle and lit left shoulder. D needs long low transverse bands and a smooth near swale instead of the new tall diagonal foreground slope. Preserve the tower dune and ordinary routes; rebuild terrain/navigation and verify walking after the layout change. Judge silhouette and highlight placement from all fixed views and aerials. |
| 2 / R6-A-SD2 | A/dusk-fire sky, y 0.18–0.40; B/D sky and horizon | Replace pale flakes and ruled sunset streaks with irregular internally shaded cloud banks: orange-red in A, restrained grey-brown mostly at the right in dusk-fire. Preserve the real dusk progression. D needs a broader peach-pink afterglow and lighter mid-sky; B needs its blue-violet starfield. Soften and separate far ranges through atmospheric depth. Similar sky averages do not establish similar cloud form. |
| 3 / R6-A-SD3 | Every lower-right weapon; D x 0.55–1 / y 0.60–0.84 | Keep the single sustained low hold, but separate coil sizing from fist sizing so the large low loops can occupy the target region. Replace the model-space diamond grid with braid coordinates following the curved thong, giving alternating strand overlap, dark recessed crossings and narrow highlights. Make glove seam grooves, stitch rows, knuckle creases and worn cuff edges read at phone size. Inspect the bright patches at the thumb/knuckles in B/h3 rather than treating colour clamps as a completed surface repair. |
| 4 / R6-A-SD4 | C fire/plume/base, x 0.20–0.55 / y 0.31–0.66 | Keep the contained non-emissive unlit logs. Break the flame into ragged orange edges around the hot core, and break/lean the smoke with the wind. Use short varied warm ember streaks near the fire. Weather the real bowl/shaft toward soot iron and the base toward irregular dark stone. Keep the reduced pool, but make its saturated local falloff reveal ground relief. Restore a clear normal sightline to the right-side waymark without hiding the brazier's finish. |
| 5 / R6-A-SD5 | B wagon/cargo, x 0.12–1 / y 0.40–0.55; plume above | Localize lamp light to the opening/near cloth instead of uniformly orange canvas; give the lamp visible glow and let its real light reveal cargo boards and sacks. Separate hoop, cloth, plank and spoke detail. Present the existing horse side-on and integrate the smaller dark tent behind it in the ordinary caravan layout. Replace the cookfire ribbon with widening broken downwind smoke. Bring the surrounding sand nearer the target's dim value without losing its soft relief. |
| 6 / R6-A-SD6 | dusk-fire, tower top and ray, x 0.15–0.60 / y 0.17–0.44 | Capture the real illuminated-tower milestone, including quest/dusk/summon side effects, or implement/document a genuine pre-signal beacon if that is what the target flame means. Time the existing moving ray's ordinary route across this view at the target scale. No frozen creature, isolated fire toggle or shot-only pose. Match the tower's occupied platform/bracing silhouette. |
| 7 / R6-A-SD7 | aerial-overview x 0–1 / y about 0.25–0.30; around the tower dune and its cast shade | Finish the terrain/shading join repair. The wider capture still shows a conspicuous horizontal boundary and broad soft dark lobes on the field. Trace the height/normal and baked-shadow continuity across the join; distinguish actual cast shade from map-edge artifacts. Check the repaired result from aerial and ground viewpoints, retaining the current cameras. This continues the earlier unresolved boundary finding, not a claim that all dark patches are fake. |
| 8 / R6-A-P1 | Capture provenance and ledger evidence | Attach served-build identity and shipping status, the code-equivalent parity report, measured phone frame times and total loading/Explorer memory. Preserve `camAt` and name terrain-driven viewpoint changes. The round's zero page errors and 30 fps chip do not establish all these checks. |

## Ledger §5: no-shortcut and reachable-state audit

- **Views and terrain:** camera blob unchanged, FOV 72 and directions unchanged. The README correctly records actual
  height changes: A/dusk-fire −8.29 m, B −5.86 m, C +2.98 m, D about −3.09 m. `world/dunes.ts` changes the global
  wave/amplitude and `layout.ts` changes the tower crest; the baked terrain/navmesh change with them. Hero views,
  aerials and the orbit show those same real ridges. I found no per-shot terrain or camera-conditioned landscape
  change. The new framing still misses the targets, especially D; that is a composition regression, not evidence of
  deliberate dodging or a confirmed grounds for voiding the round.
- **Real geometry:** dunes, tower, caravan, cargo, horse, tent, braziers and viewmodel are meshes in the ordinary world.
  Sky/ranges are distant backdrop. Flame, smoke and light pools are effects on real structures. No painted card or
  overlay substitutes for a walkable subject. The aerial boundary is a rendering/terrain continuity issue.
- **B `logbook`: reachable by source inspection.** `stage()` sets SCOUT_FLAG, matching Sefa's first dialogue, and
  leaves the logbook unread. Ordinary play eases to dusk 0.38 at 0.02 per second. The stage snaps to that same target
  and settles eleven seconds. The photographed location is outside the logbook's 2.4 m interaction radius; do not
  fabricate the mockup's distant READ prompt.
- **C/D `waymarks-lit`: reachable by source inspection.** The unchanged helper calls the real logbook interaction,
  well pull, oil-jar interaction, and each brazier's oil interaction/light action. `world/build.ts` supplies the read
  label, raised bucket, removed jar, visible poured oil, flame/glow, labels and flags. C's three-second settle exceeds
  the 1.2-second bucket lift; D settles eleven seconds. The all-waymarks target dusk 0.86 is ordinary play state.
  Quest completion accepts all three flags without ordering the braziers, so the photographed brazier can be lit
  last in play. All three staged shots are named in `meta.json`. This is handler verification, not a new playthrough.
- **Held pose/effects:** the enlarged gauntlet uses one ordinary idle transform. No staged weapon pose or frozen
  attack was found. C retains flame, smoke, embers, pool and completion notices. The recorder calms creatures; A and
  dusk-fire remain before Sefa, when the ray ordinarily stays on its home glide. Its missing appearance over the
  tower earns no subject-match points. An orbit with calm creatures is not combat regression evidence.
- **Dusk-fire:** unstaged, with the Sefa objective and unlit signal tower. It is a reachable initial scene, but does
  not depict the target's illuminated tower/ray conjunction. The supplied image is scored as it stands.
- **Phone/HUD:** captured recorder requests 390×844 @3, phone tier and touch, then stores 780×1688 JPEGs. It restores
  the baseline HUD/viewmodel for the scored first-person views. No special look, hidden tracker or restyled controls
  was found. Keep the normal HUD despite old mockup differences.
- **No narrowing/budgets/shipping:** the captured shard diff retains quest/combat and changes the normal look and
  geometry globally. `28e3eb78` reports parity green at `1c872018f`; its own change is progress evidence, and the
  shard code matches that reported revision. The round README does not attach its result or exact-build process
  memory/frame-time/deployment evidence. Metadata accepts the caller's SHA rather than comparing it to served-build
  identity. These remain verification gaps, not measured budget failures or demonstrated gameplay regressions.

No confirmed screenshot shortcut warrants voiding the numerical comparison. The named staged milestones are supported
as player-reachable states; exact-build compliance remains incompletely evidenced. The supplied images are below 8/10.

SCORE signal-dunes: 6.1

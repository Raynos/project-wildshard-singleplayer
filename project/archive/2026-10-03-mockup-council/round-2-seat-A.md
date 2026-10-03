# Mockup council — round 2, seat A

Lens: game art director comparing the game with the frozen mockups. Only Signal Dunes is scored.

Read COUNCIL.md, the ledger, brief, scores and all three round-1 seats in full. Reviewed the five supplied comparison
sheets, all five original mockups and matching game JPEGs at their stored full resolution, first-frame, all four hero
views, both aerials, and the orbit clip sampled once per second throughout. The round directory contains five sheets,
all Signal Dunes. Evidence: `progress/sunscar-dunes/20261002-2243-cb48ab8f/`; source checks use captured commit
`cb48ab8f48e3108acfd195646311a55d1c00ab25`, not the newer working tree. Regions below describe the portrait picture,
excluding the comparison sheet's title.

The scene is recognizable, but its differences are immediately visible. It does not have the mockups' finish or
composition at the 8/10 bar. Scores measure the supplied images, without credit for work performed.

## Signal Dunes (`sunscar-dunes`)

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `A-spawn-dusk-light.jpg` → `mock-A-spawn` | 5.0 | **Middle through lower landscape:** the target's diagonal foreground crest overlaps a separate, shadowed tower dune and successive ridges. The game faces one broad, mostly orange mound, with flags and Sefa occupying the otherwise empty foreground. The grazing highlight / cool slip-face division is missing from the dominant slope. | **Upper half:** irregular orange-lit cloud banks under a subdued indigo sky become thin, smooth horizontal streaks under saturated navy. A conspicuous grainy horizontal transition remains above the streaks. | **Lower right:** the target's broad coils are held low, with the hand mostly at the bottom edge. The game's smaller upright loops and entire fist sit much higher; the leather reads mottled rather than showing distinct crossing braid strands and restrained edge highlights. |
| `B-quest-logbook.jpg` → `mock-B-logbook` | 5.5 | **Central wagon and surrounding props:** the open end and hanging lamp are now presented, but the target has a substantial planked tailboard, readable wheels, weathered hoops and ragged cloth. The game reads as a narrow, simple opening with a pale panel, red lower face and block-like crates. The target's animal at the right is not readable in this matching frame, though it exists in h2. | **Behind and above the wagon:** a bright dune rises directly behind it where the target has a low, dark, receding horizon. The smoke is a thin translucent ribbon instead of a broken, expanding plume; the black tent at the right is a hard triangular mass. | **Lower half:** harsh dark sand grain and regular ripple bands replace the target's softer, gently varied sand. The smaller, higher whip exposes much more foreground and lacks the target's low coil silhouette. |
| `C-waymark-fire.jpg` → `mock-C-waymark` | 6.0 | **Centre-left flame and upper-left plume:** fire and visible logs exist, but the flame is a few smooth pale tongues, with round bright sparks and a narrow dark smoke streak. The target has broken orange flame detail, turbulent smoke and irregular ember streaks. | **Middle background and brazier base:** the game puts the tower prominently behind the fire at the left, whereas the target shows a small next waymark at the right over a low dune line. The game's clean pale block courses and red shaft lack the target's soot-dark, irregular masonry and iron finish. | **Lower right:** the small upright coil and exposed fist differ from the target's large low coils and hand entering at the bottom. The game also retains much coarser dark grain beneath the visible warm fire pool. |
| `D-hands-whip.jpg` → `mock-D-hands` | 5.0 | **Lower right, principal subject:** the glove has texture, but the target shows stitched leather panels, folds, a cuff and crisply interwoven braid lit along its strands. The game has an upright oval double loop and a fist higher and farther inward, with broad mottling and weak braid relief. | **Middle and lower landscape:** the target's long, nearly horizontal shadow bands and quiet foreground become peaked overlapping hills, conspicuous spark trails and a tower partly obscured by its pin. These are different silhouettes, not details one has to search for. | **Upper half and horizon:** the target's soft violet afterglow becomes deep saturated blue over a strong orange band, thin straight streaks and the same grainy horizontal sky seam. The dusk is darker than spawn but still does not match the target's value and colour hierarchy. |
| `C-dusk-signal-fire.jpg` → `mock-dusk-fire` | 4.5 | **Upper-middle subject:** the tower is now a dark lattice left of centre, but it is unlit and the large flying creature above it is absent. The target's focal conjunction of fire, tower and creature is not captured. | **Middle through foreground:** the target's rounded tower dune has a broad dark face, with a nearer sweeping saddle and raking highlights down to the weapon. The game is a front-facing orange ramp with trail flags, a narrow shadow along its right crest and little comparable overlap. | **Sky and lower-right weapon:** the target's muted grey-brown cloud banks and low diagonal leather coil become saturated blue/orange sky streaks, a visible horizontal seam and a high upright double loop. Baseline melee controls also differ from this older mockup's weapon HUD. |

**Seat score: (5.0 + 5.5 + 6.0 + 5.0 + 4.5) / 5 = 5.2.**

## Builder claims checked against the frames

| README claim | Verification |
|---|---|
| Stage runs the player's path with every side effect | **Supported by source inspection for the named stages.** `plugin.ts:stage()` now calls the real logbook interaction, well pull and jar interaction, then each brazier's oil interaction and light action. `world/build.ts` supplies the read label, raised-bucket animation, hidden jar, visible oil, fire, glow, flags and labels. The recorder settles C for three seconds, longer than the well lift animation; D settles longer. This repairs round-1 A-P2. This is inspection of the normal handlers, not a new playthrough. |
| Crests turned toward the tower with a side key light | **Code changed; intended image result only partial.** WIND and KEY changed, and aerials show lit/shaded dune rows. A and dusk-fire still present a broad orange mound instead of the target's overlapping diagonal crest / saddle structure. The claim does not establish a composition match. |
| Far blue-grey range ring | **Visible.** A, D, dusk-fire, aerials and clip show it. It reads as a crisp, fairly uniform silhouette rather than the target's several hazy receding ranges. |
| Pale band, trail / smoke removed | **The pale strip down the tower dune is gone in A and dusk-fire.** The separate cookfire smoke in B and h2 still reads as a thin ribbon/beam. The grainy horizontal sky seam is also still present; it is a different defect. |
| Dark steel-lattice tower | **Visible.** X bracing and antenna replace the earlier pale stand. Its upper cage is unusually tall and open relative to the lower occupied structure; matching its silhouette and signal state remains necessary. |
| Waymark fire as wide as bowl, embers, plume and warm pool | **Present, finish partial.** C has a substantial flame, logs, sparks, smoke and a clear warm pool against dark ground. The fire remains smooth and pale, sparks dot-like and smoke columnar; the target's turbulent orange combustion is missing. |
| Wagon props | **Present, finish/layout partial.** B shows crates, sacks/rocks, barrel, hanging lamp and tent. h2 confirms the animal exists. The target's animal is not readable in B, its cargo is more integrated, and its wood/canvas detail is substantially richer. |
| Dusk deepens with quest steps in real play | **Supported.** `duskOf()` derives light from normal quest flags and lit braziers; the update system calls `setDusk()` and `stepDusk()`. A/B versus C/D visibly differ. Staging snaps to a value normal play can reach after easing; it is not a separate debug-only look. The resulting palette remains unlike the targets. |
| Glove and whip in worn tan leather with plait visible | **Texture and warmer leather visible; plait only weakly supported visually.** At stored full resolution the coils look mottled with faint diagonal patterning, not the target's crossing strands. The glove lacks the target's clear stitching/panel relief, and its silhouette/pose remains wrong. |

## Ranked findings and concrete fixes

These continue the round-1 art findings and check their revisions. Each is `should-fix` against the frozen target;
none proposes unrelated content or a special screenshot look.

| Rank / ID | Mockups and frame region | Concrete fix |
|---|---|---|
| 1 / R2-A-SD1 (continues R1-A-SD1) | A and dusk-fire, middle through foreground; D, middle dune bands | Rebuild the actual arrival sightline into separate overlapping crests and a saddle before the tower dune. Give A a diagonal near ridge with a narrow warm edge and cool shadow face; give dusk-fire the rounded dark tower face beyond the nearer saddle. D needs long low dune bands rather than pointed hills. Judge the silhouettes at the fixed matching views, retain traversable slopes/routes, and update affected terrain/navigation. The aerial rows alone do not solve the first-person composition. |
| 2 / R2-A-SD2 (continues R1-A-SD2) | All skies, especially A and dusk-fire; A/B ground | Remove the grainy horizontal sky seam in the shipped shader/compositing path. Replace A/dusk-fire's thin straight streaks with the irregular illuminated cloud banks the targets show, and mute the saturated zenith/horizon toward their violet or grey-brown dusk. Keep the real quest-driven dusk progression. On the dunes, restore grazing highlights and cool readable faces instead of lighting the dominant spawn ramp nearly uniformly orange. Reduce B's high-contrast sand grain and soften its repetitive ripple bands. |
| 3 / R2-A-SD3 (continues R1-A-SD3) | Every lower-right viewmodel; D's hero hand and coil | Repose the normal viewmodel lower and obliquely, matching D's grip and low coil, with the larger low coil silhouette shown in A/B/C available through real idle/weapon states. Give the whip readable crossing strands through mesh/normal detail, with strand edge highlights, and give the glove stitched panels, folds and cuff separation. Preserve that finish in normal attacks; do not add camera-specific model transforms. |
| 4 / R2-A-SD4 (continues R1-A-SD4) | B, wagon opening, cargo, right-side animal/tent and smoke | Make the real tailboard, planks, wheel spokes, hoops and torn canvas readable from B's matching view. Replace plain cargo cubes with the target's weathered crates and soft sacks; integrate them with ground/contact shading. Present the existing tethered animal beside the tent as the target does, keeping all geometry in the normal caravan layout. Break the cookfire smoke into expanding, curling opacity rather than a long thin ribbon. Retain the corrected logbook quest state. |
| 5 / R2-A-SD5 (continues R1-A-SD5) | C, flame/plume, base and right horizon | Keep the working local light pool and logs, but add ragged orange flame edges, a smaller hot core, irregular ember streaks and smoke lobes with soft broken sides. Weather and darken the real stone/iron base. Restore a target-matching sightline to the next waymark on the right; the prominent tower substituted at the left changes the scene. Preserve the actual quest state and baseline toast behaviour. |
| 6 / R2-A-SD6 (continues R1-A-SD6) | dusk-fire, tower top and flying creature above it | Capture the signal-lit milestone through the normal tower interaction after the waymarks, including its boss-summon side effects. The current unstaged spawn frame cannot show the target's burning tower. Verify that the existing ray's ordinary flight crosses the sightline at the target's apparent scale; adjust its real route if needed and capture that naturally occurring moment. Do not paste in or freeze a creature solely for the shot. Reassess the tower's cage/deck proportions against the original silhouette. |

## Ledger §5: no-shortcut and reachable-state checks

- **Real geometry:** source and contextual views show real terrain, tower, wagon, cargo, animal, braziers and viewmodel.
  I found no image overlay or walkable-object decal replacing their geometry. Flame, smoke and light-pool effects are
  effects on real braziers, not painted substitutes for the structures. The distant range is horizon scenery.
- **Phone tier / HUD:** the recorder at the captured commit requests 390×844 @3 with phone tier and touch, then
  downsizes its PNG to a 780×1688 JPEG. The scored first-person shots restore the baseline HUD and viewmodel after
  aerial capture. HUD differences from old mockups are visible, but a custom vitals/ammo strip or hidden objective
  would violate the baseline requirement; do not manufacture those for similarity points.
- **B's `logbook`: reachable.** Sefa's initial dialogue sets SCOUT_FLAG, which is what this stage sets. The tracker
  correctly names the logbook and its pin is present. The target's distant interaction prompt is not justification
  for inventing a shot-only prompt outside the game's real interaction range.
- **C/D's `waymarks-lit`: reachable by the normal handlers.** The stage now includes the missing world side effects
  identified in round 1. Both are listed in meta.json and show the tower objective; C's completion toasts arise from
  those actions. The helper's source supports reachability, though metadata does not assert each final side effect.
- **Camera re-aims: partially documented, target matching incomplete.** B presents the open wagon end and D puts the
  tower at the right, so both have a visible target-matching purpose. C's note explicitly substitutes the tower for
  a next waymark hidden behind a dune; that is not the target's composition. Restore the missing sightline through
  normal layout changes, rather than accepting an easier substitute subject. I cannot establish deliberate dodging
  from these images alone. Also, the committed camera diff changes `mock-dusk-fire` yaw from −16 to −10; the round
  README omits this re-aim. **R2-A-P1 / should-fix:** document that change and its target-camera reason alongside B/C/D,
  using the recorded camera blob `b213ad79598024f402b50b447e212e36553621a5`.
- **Budget/provenance/narrowing evidence remains incomplete (R1-A-P3).** The capture has zero recorded page errors,
  but its SHA is still caller-supplied and the recorder does not compare it with served-build identity. The preceding
  `78cc2a19d` commit reports parity at `1c1d6ae1f` (walk, combat, leak, pause/resume) and calibrated GPU memory; that
  is useful nearby evidence, not exact `cb48ab8f` total loading/Explorer memory or phone frame-time evidence. The
  round README supplies neither that evidence nor deployment status. Hero views and an orbit cannot establish full
  quest/combat regression coverage. Attach the exact build identity, shipping status and existing performance,
  process-memory and normal quest/combat gate results. This is a proof gap, not a finding that the limits were exceeded.

No confirmed screenshot cheat warrants declaring the numerical comparison void. The repaired named quest milestones
are reachable by source inspection. Camera compliance and exact-build gate evidence still need closing; the images
remain well below 8 regardless.

SCORE signal-dunes: 5.2

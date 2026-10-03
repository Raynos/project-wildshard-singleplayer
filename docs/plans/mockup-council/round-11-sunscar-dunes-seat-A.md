# Mockup council — round 11, seat A — Signal Dunes

Art director lens. Reviewed the council protocol, frozen ledger, brief, scores, round-1 seats and Signal Dunes seats
from rounds 3–10; the round-11 Signal Dunes README, all five comparison sheets, the five original mockups, and
`progress/sunscar-dunes/20261003-0511-ea6ccc86/` (matching frames, first frame, four heroes, two aerials and the
10-second orbit, sampled every 0.5 s). Source checks use captured commit `ea6ccc86bf05471520f52db7b6686f89efdd8e9e`.
These scores judge the captured appearance, with no points for effort, commits or progress.

## Scores

Regions are fractions of the complete portrait frame, origin at the upper left. The differences are conspicuous at
phone size. The scenes are recognizable, but their forms and material finish still require substantial changes to
reach the brief's 8: differences you have to look for.

| Mockup → matching game frame | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `round-9-review/A-spawn-dusk-light.jpg` → `mock-A-spawn.jpg` | **6.0** | **Dune composition and light, x 0–1, y 0.34–0.66.** The target has a long descending diagonal, a luminous thin crest and a broad cool lee beneath it, followed by a separate tower mound. The game has a ridge rising toward the tower, one blunt purple shadow patch on the right, and comparatively uniform tan sand. A long ridge exists in 3D, but its projection does not reproduce this composition. Clean near sand is Y **78.1 versus 57.4**. | **Clouds and depth, x 0–1, y 0.18–0.39.** The orange/violet palette is close, but soft separated clumps replace the target's fine, ragged, overlapping banks lit from below. The far ranges read as broad smooth cutouts rather than many interlocking dune shoulders. | **Held weapon, x 0.25–1, y 0.55–0.85.** The game's upright, regularly braided twin loops and crinkled gauntlet differ from the target's lower, heavier dark loops and simpler shaded hand. The added small-scale texture does not supply the same leather finish. |
| `round-9-review/B-quest-logbook.jpg` → `mock-B-logbook.jpg` | **6.5** | **Caravan finish, x 0.43–0.72, y 0.40–0.51.** The open back and contained warm lantern now read correctly. The target nevertheless has finer torn cloth, thin hoops, wheel spokes, weathered boards and an uneven grounded silhouette. The game remains a thicker, simpler cloth shell over a broad orange tailboard. | **Camp and sand, x 0.15–1, y 0.45–0.62.** Crates, sacks, barrel and horse are simple, spaced forms rather than the target's detailed, half-buried spill. The repeated diagonal ripple bands are more pronounced; the cookfire plume now bends but remains much fainter than the target's substantial curling column. | **Viewmodel, x 0.25–1, y 0.56–0.85.** The dark low coil and softly shaded hand in the target become upright loops with strong repeated chevrons and a mottled glove. The otherwise close blue-hour sky makes this foreground mismatch especially visible. |
| `round-9-review/C-waymark-fire.jpg` → `mock-C-waymark.jpg` | **6.5** | **Fire and smoke, x 0.18–0.53, y 0.24–0.51.** There is a larger white core and more overlapping tongues, but their long smooth orange contours still read as graphic cutouts. The target is a turbulent mass rooted in visibly burning logs, with a substantial brown plume lit orange at its foot. The game's logs remain dark and its plume barely reads. | **Brazier, plinth and light pool, x 0.24–0.55, y 0.45–0.62.** A twisted shaft and pale regular brick base replace the target's weathered upright post and rough dark fieldstone drum. The coil covers part of the base. The target's localized orange pool and surrounding dark lee are replaced by a broader, quieter brown field. | **Backdrop and foreground, x 0–1, y 0.43–0.85.** A high sloping dune shoulder enters from the left where the target has low dark bands. The target's broad low coil becomes the same upright paired loops seen in B and D, moving attention away from the brazier. |
| `round-9-review/D-hands-whip.jpg` → `mock-D-hands.jpg` | **6.5** | **Hand/coil shape and finish, x 0.25–1, y 0.55–0.85.** The target's compact loop hangs beside a defined fist on the right; the game coil is much taller and wider and occupies the centre. Its uniform chevrons and crinkled highlights lack the target's broad leather folds, stitched construction and controlled glancing strand highlights. | **Terrain bands, x 0–1, y 0.49–0.67.** The target has smooth transverse ridges with dark lee strips. The game shows rolling diagonal forms and textured sand with a much lighter middle-left field: Y **40.5 versus 16.2** in a clear matching box. Darkening distant fill has not built these missing shadow shapes. | **Horizon/tower, x 0–1, y 0.43–0.55.** The sky's upper value is very close, but the low orange band is more saturated, and the broad far silhouettes are heavier. The tower's lower structure is interrupted by terrain and its world pin crosses the upper structure, weakening the target's clear silhouette. |
| `round-2-dunes/C-dusk-signal-fire.jpg` → `mock-dusk-fire.jpg` | **6.0** | **Hero dune and saddle, x 0–1, y 0.34–0.64.** The target tower crowns a broad mound behind a continuous diagonal foreground saddle, with a lit left shoulder and a sweeping shaded hollow. The game's tower stands at the end of a shallow-looking ridge, beside a blunt detached dark wedge. Matching the near-sand mean has not matched the large forms or their lighting. | **Sky and focal subjects, x 0–1, y 0.15–0.39.** Purple/orange sky and clumps on both sides replace the target's dusty amber atmosphere and restrained grey bank at the right. The large ray over the tower is absent in this matching frame; the keeper flame is a pin light rather than a readable flame over a substantial platform. | **Held coil, x 0.25–1, y 0.56–0.85.** Two large upright loops and a mottled glove replace the target's single low diagonal loop and broad worn leather folds. The game uses much more of the lower centre for the weapon. |

**Seat score: (6.0 + 6.5 + 6.5 + 6.5 + 6.0) / 5 = 6.3.**

## Rec. 709 measurements

Measurements use **Y = 0.2126 R + 0.7152 G + 0.0722 B**, on decoded RGB values from 0–255, following the brief and
earlier seats. Originals are resized to 780×1688 with Lanczos; game JPEGs are already that size. Boxes are half-open
pixel coordinates at that size. This is image-value comparison, not a linear-light radiometric measurement.
Fine detail is mean absolute difference from a Gaussian blur of radius 2 px. Texture scores remain visual judgments.

Clean sand: **x 10–190, y 1160–1420**, clear of the weapon, Sefa and controls. Each cell is mockup / game.

| View | Mean Y | p95–p5 spread | Fine detail | Reading |
|---|---:|---:|---:|---|
| dusk-fire | 73.8 / **74.6** | 65.5 / **62.3** | 9.5 / **9.7** | This small patch matches well; the hero mound and saddle still do not. |
| A | 57.4 / **78.1** | 62.0 / **64.3** | 9.4 / **10.7** | Mean remains about 21 high; adding contrast or grain would address the wrong problem. |
| B | 39.7 / **35.2** | 18.8 / **29.6** | 2.0 / **2.7** | Slightly dark, with excessive ripple spread. |
| C | 32.6 / **34.0** | 10.8 / **19.5** | 0.1 / **1.3** | Value close; target patch is much smoother. |
| D | 34.9 / **33.6** | 24.6 / **15.9** | 0.2 / **1.4** | Value close; game adds fine texture while lacking the target's broad value variation. |

The README reproduces within 0.1 for A and within 0.4 for C/D; those small discrepancies do not change the conclusion.
The previous capture's same patch was dusk-fire 82.5, A 86.1, B 31.8, C 36.9 and D 34.3. The current dusk-fire mean
is better without resolving A's remaining mismatch. The two spawn mockups themselves differ by **16.4 Y** on this
patch despite sharing a camera position with an 8° yaw difference. Their ground means cannot both be targets for a
single global exposure adjustment; judge the projected illuminated and shaded faces as well.

| Additional matching region | Mockup | Round 10 | Round 11 | Meaning |
|---|---:|---:|---:|---|
| C flame, x 150–450, y 520–900: pixels Y > 230 | 5,212 | 1,689 | **3,006** | Hot area grew to about 58% of the target in this window. |
| Same: pixels Y > 235 | 4,338 | 687 | **2,427** | A material increase, not just clipped red. |
| Same: pixels Y > 245 | 2,483 | 0 | **539** | The strongest hot region remains much smaller. |
| Same: Y p99 | 250.4 | 232.5 | **242.1** | Hotter, but the core's structure and fuel still differ. |
| C pool, x 150–450, y 1060–1150: mean Y | 40.4 | — | **47.9** | This is a frame region, including the differently placed base/coil; it is not a segmented light measurement. |
| D middle-left terrain, x 0–190, y 870–1030: mean Y | 16.2 | — | **40.5** | This region excludes the coil: the missing dark lee bands remain visible numerically. |

The flame window excludes the notification stack. The README's **828 → 2,403** claim has no specified region or
frame phase and does not reproduce on the lead's two matching captures in this fixed window. Its direction is
supported; its exact counts are unverified. This window can include embers and measures one animation sample.

Sky box **x 40–540, y 300–600**, mockup / game mean Y: dusk-fire **75.9 / 93.4**, A **88.3 / 87.5**,
B **50.1 / 46.5**, C **52.5 / 50.3**, D **50.0 / 49.9**. A and the late skies are close in average brightness;
dusk-fire's atmosphere remains too bright and violet. A matching average does not establish matching cloud shapes.

## Builder claims checked

| README claim/change | Verdict at the captured revision |
|---|---|
| No mock camera changed; h3 lowered 0.28 m and h4 lowered 0.16 m | **Confirmed.** Compared both captures' `camAt` for every shot. Mock positions, directions and FOV match. The two hero height changes are listed in the lead's README, including h3 which the builder omitted. |
| Long diagonal crest, steep lee and trough behind | **Real geometry confirmed; visual match incomplete.** `layout.ts` has the stated segment, lift, widths and trough; `world/dunes.ts` evaluates them in the height field. Aerials show the raised ridge and dark lee. Its silhouette and lit-side projection still differ substantially from A and the dusk pick. |
| Caravan turned 180°; navmesh re-baked | **Confirmed as changes.** `CARAVAN.yaw` gains π; the matching frame now faces the open back/tailboard. Baked terrain/navmesh binaries and metadata changed. That verifies a rebake artifact, not a new independent walk or collision test by this seat. |
| Near-sand numbers | **Substantially reproduced**, as above. C/D mockup differences are below half a luminance point. |
| Glow line appears only late | **Source confirmed.** The added narrow line is multiplied by `smoothstep(0.3, 0.75, uDusk)`, so it is absent at spawn dusk 0. The ordinary sunset gradient remains. D shows the late narrow line. |
| Far-land fill starts at 30 m | **Confirmed, with useful limits.** The old 8–60 m multiplication of direct and indirect light is replaced by 30–200 m attenuation of **indirect fill only**, reaching a 0.6 attenuation factor at late dusk. Direct light remains. The full orbit retains readable terrain; it does not repeat the earlier near-black collapse. D's missing lee bands still need actual form/light changes. |
| Lantern halo depth-tested, 0.5 m | **Confirmed.** `addLampGlow(lamp, 0.5, …)` and the cloned material's default depth test replace the 2.4 scale and explicit disabled depth test. In B the canvas is no longer covered by a broad halo. The helper scales a 2×2 quad by 0.5: 0.5 is its scale/radial extent, not a 0.5 m full-width quad. |
| Clouds are filaments; ranges darker | **Source changes confirmed, appearance only partly successful.** Higher-frequency holes/filament modulation is present and far-ring haze is reduced. In A and dusk-fire the visible clouds still group into soft clumps; the ranges still have broad smooth profiles. |
| Fire side tongues and increased hot pixels | **Tongues and increased luminance confirmed.** Two extra flame quads and a broader/hotter core are present. Exact README counts are unverified; the reproducible comparison is above. Smooth graphic tips, dark fuel and weak smoke remain. |
| Cookfire wisp curls | **Confirmed, modest visible result.** Its 16-row quad can bend; sway/widening increased and it fades upwards. B shows a bent, faint plume rather than the old straight column, still weaker than the mockup. |
| Plait sheen and darker gauntlet | **Code and visible direction confirmed; finish incomplete.** A relief-dependent glancing term is added to `viewerLit`, the braid map is darker, and glove tint/crinkle/thread gains fall. The coil has separation and glancing edges, but the repeated chevrons dominate. The glove remains mottled rather than convincingly stitched, folded leather. |
| Hold at y −0.245 | **Confirmed.** One `HD_GLOVE` constant is used for every view. It is raised from −0.27; there is no per-shot viewmodel transform. The dominant coil silhouette remains unlike D and the dusk pick. |
| Staging/dusk values unchanged since round 9 | **Confirmed for state targets and staging.** The quest dusk targets and normal easing/stage sequence are unchanged. Lighting at those targets did change: `fillAt` now includes an additional fill peak around dusk 0.5, and the wagon also gains a pale-cloth shader treatment. |
| Parity green at ready SHA, 0 stuck, GPU within 108.99 MB | **Reported, not independently reproduced.** The supplied capture records 0 page errors, load 6 s and 59 programs. It does not contain the underlying ready-SHA parity report or physical-phone frame/memory readings. The FPS chip and GPU estimate do not prove total process memory or sustained iPhone performance. |

## No-shortcut check — ledger 5

- **Views:** the five scored cameras are fixed from round 10. The hero height changes are disclosed. The aerials,
  heroes and orbit expose the same terrain and prop limitations as the matching frames.
- **Geometry/look/HUD:** the ridge, wagon and braziers are world meshes. Clouds/far panorama remain beyond the
  playable area. Fire sprites are ordinary animated effects attached to real braziers. Source lighting/material
  changes apply in play, with one ordinary held-weapon transform. The scored frames retain the baseline touch HUD.
- **B is reachable:** `stage('logbook')` sets the same scout flag as Sefa's conversation, leaves the logbook unread
  and settles dusk at 0.5. A player can talk to Sefa, wait, then approach the wagon. Its 22 m marker is ordinary
  tracking; the capture does not fabricate the mockup's distant READ interaction prompt.
- **C/D are reachable quest/light states:** staging reads the logbook, raises/takes oil, oils/lights two braziers,
  settles their dusk at 0.74, then lights the last through the normal handler. Normal update continues at 0.02 dusk
  units/s: C's 3 s settle reaches about 0.80 with the final notice; D's 11 s reaches 0.86 after notices expire.
  `build.ts` permits the braziers in any order. A player can leave the west brazier last, oil it within 3 m, lash it
  from 7–8 m and step back to the approximately 11 m C view during that interval. D's state persists during the walk
  to its viewpoint. The stage helper itself completes the northern brazier last and teleports for capture, so it is
  a state setup, not a recorded traversal; the same pictured state can be reached with the player's west-last order.
- **Effects are live:** flame/smoke/ember time updates continue; no held transient attack pose or effect suppression
  was found in staging. The orbit samples show changing smoke/fire effects. The recorder calms creatures and lists
  no active creature shots, so this surface supplies no combat-behaviour validation. The missing ray above the tower
  remains a scored subject difference, not permission to paste or freeze a ray into the view.
- **No narrowing:** quest/combat handlers remain installed and the navmesh was rebuilt. The context images show
  readable terrain after the far-fill correction. An artifact/source review does not independently prove the reported
  walk parity, all combat or the physical-phone budget. Those remain evidence limits, not demonstrated violations.

**No score-voiding shortcut demonstrated in this surface.** The phone uses the documented 390×844 @3 capture setup
with 780×1688 stored frames; physical-phone sustained 30 fps and the 1.8 GB / 1.0 GB total-memory limits remain
unverified by the supplied evidence.

## Findings, ranked by likely score gain

| Rank / finding | Mockups and frame region | Concrete fix |
|---|---|---|
| **1 — R11A-SD-1: projected dune forms and their light** | A and dusk-fire, x 0–1, y 0.34–0.66; D, x 0–1, y 0.49–0.67 | Shape the actual ridge so A sees the long descending diagonal and a separate tower mound; restore the dusk pick's continuous saddle and sweeping shaded hollow. Check the silhouettes after terrain smoothing at the fixed cameras, then light the exposed slopes with grazing warm highlights and cool lee faces. D needs transverse dark lee strips, not further camera-distance darkening. Match these large regions before touching grain. Validate the same geometry from the heroes, orbit and route. |
| **2 — R11A-SD-2: leather construction and coil weight** | All five, especially D/dusk-fire, x 0.25–1, y 0.55–0.85 | Replace the glove's crinkle/fleck emphasis with broad knuckle folds, legible seams, cuff panels and controlled worn-edge highlights. Break the braid's mechanically uniform chevrons into interwoven strands with dark gaps and restrained crown sheen. Give the real idle coil more natural sag and less central dominance. D/dusk want a compact or low diagonal loop, while A–C show larger low coils: choose a coherent ordinary hold and check all five together; no camera-specific transforms or frozen transient pose. |
| **3 — R11A-SD-3: fire rooted in burning fuel** | C, x 0.18–0.53, y 0.24–0.51 | Break the long continuous orange contours with overlapping, torn turbulent licks and gaps. Keep a broad hot yellow-white region directly over the logs, make exposed log ends visibly charred/glowing, and build the brown smoke volume lit from below. The fixed window's >230 region is 3,006 versus 5,212, but counts alone are insufficient: inspect several live phases and side views. Keep ember and smoke drift consistent in world space. |
| **4 — R11A-SD-4: the dusk focal silhouette** | dusk-fire, x 0.17–0.60, y 0.18–0.39 | Make the existing keeper flame and occupied platform readable at the fixed distant view. Capture the existing ray's real glide above the tower with its ordinary animation and effects, or adjust its ordinary entry path/timing so that encounter is naturally available at the spawn view. Preserve the quest state and dusk; do not substitute a completed-signal state solely for the shot. |
| **5 — R11A-SD-5: caravan and brazier structure** | B, x 0.15–1, y 0.40–0.53; C, x 0.24–0.55, y 0.45–0.62 | Keep B's corrected open back and small lantern. Refine cloth thickness, torn edges, hoops, wheel spokes and weathered planks; settle cargo into an uneven half-buried pile with readable slats/sacks. Replace C's regular pale brick block with the mockup's dark irregular fieldstone drum and weather its supporting post. These are asset/form problems rather than exposure problems. |
| **6 — R11A-SD-6: cloud structure and dusty depth** | A/dusk-fire, x 0–1, y 0.18–0.39 | Make the world-space cloud banks finer and more overlapped, with ragged holes and darker cores rather than separated soft clumps. Retain A's close sky value while shifting the dusk pick's view toward dusty amber and the restrained grey bank at the right. Increase interlocking dune profiles and atmospheric layering in the distant ranges without flattening the near terrain. |
| **7 — R11A-SD-7: sand value versus texture** | Clean sand box x 10–190, y 1160–1420; C pool x 150–450, y 1060–1150 | A remains Y 78.1 versus 57.4 while dusk-fire is already 74.6 versus 73.8: solve the lit/shaded face distribution together rather than globally dimming to one patch. Soften the late ripple/grain pattern, particularly C/D, and localize C's orange pool around the plinth. Preserve the corrected late far-fill behaviour and remeasure both spawn views and the entire orbit after any lighting adjustment. |

SCORE signal-dunes: 6.3

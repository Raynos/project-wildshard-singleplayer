# Brine Puffer reference review

Date: 2026-10-18. Status: V23 complete candidate inspected; implementation remains unaccepted.

## V20–V23 consolidated review, 17:14 UTC

V20's outward eye recentering made both frontal pupils visible. V21 hero and
side views confirmed no return of protruding eye coins. Exact-profile iris
occlusion is expected for these forward-facing recessed eyes; do not enlarge
the aperture merely to force full-profile visibility. The reference's small
side thumbnail is oblique and does not establish that requirement.

V22's connected cream muzzle projected as an oversized visor. V23 reduced it
and restored buried crown/shoulder spines and an ochre border on the tail face.
V23 is therefore reviewed as a complete identity candidate, without the earlier
anatomy-only exclusions. Actual hero, front and side renders were inspected.

| Visual criterion | /5 | V23 evidence |
| --- | ---: | --- |
| Silhouette | 3.25 | Spines and tail improve identity, but profile feet remain almost leaf-thin and toes read as small saw teeth. |
| Face / character | 2.75 | Pupils read; cream nose still forms an X/bow-tie across inner eyes and the broad orange cheek lacks the target's thick brow wedge. |
| Facet language | 3.0 | Closed hull has coherent broad planes, but residual horizontal bands and mechanically repeated foot tips differ from target. |
| Palette | 2.5 | Cream appears grey and orange peach-like; target is warmer ivory/gold with stronger burnt orange and deeper teal contrast. |
| Reference fidelity | 2.75 | Recognizable puffer identity and improved construction, but face, foot volume and color remain materially short of the approved image. |

Highest-impact next corrections, sent directly to the builder:

1. Give each foot real fore/aft volume with a swept cross-section around its
   centerline. Increasing only lateral width or vertical thickness does not
   fix its leaf-like side profile. Make terminal tips broad contiguous lobes.
2. Remove cream nose side wings extending over the inner eyes. Follow the
   upper mouth boundary with a compact peaked arch, tapering into mouth
   corners; retain stable pupil positions and containment checks.
3. Form an integrated thick orange upper brow, rather than relying on a broad
   flat orange cheek patch. Then add nostrils and a warm tongue/interior.
4. Warm the ivory and strengthen orange/teal contrast under consistent light.

The native export and topology checks are technical evidence, not visual
acceptance. No animation, gameplay, runtime integration or phone-performance
score is assigned. V23 remains unaccepted. This review is frozen for checkpoint.

## V19 front-eye gate, 16:57 UTC

Lowering the eye assembly exposes more gold, but the frontal pupils remain
behind the inner nasal wall. The eye-read gate still fails; face/character
remains **2.25/5**. This frontal evidence supersedes earlier hero-based advice
to move the visible eye medially. The explicit medial offset plus recession
along an outward normal shifts the lenses too far inward in world space.

Test a small outward tangent shift of the whole eye assembly, retaining its
lowered height and recomputing containment. Open the upper lid modestly only
if it still obstructs the centered pupil. Add a front-camera-to-pupil visibility
ray against the final cut hull to identify the obstructing wall. Containment
and visibility are separate requirements; passing one does not prove the other.

This was the earlier checkpoint boundary; subsequent results appear above.

## V18 four-view gate, 16:55 UTC

Actual front, side and both three-quarter renders were inspected. The mirror
correction works: opposing hero views consistently swap near/far visibility.
However, the frontal view hides both pupils, leaving gold upper-inner crescents
above large black teardrop sockets; the side view shows little eye. Revised
face/character score across views: **2.25/5**, below the earlier hero-only 2.75.

Test lowering the complete eye assembly within the socket while recomputing
containment, then modestly opening the upper lid only if necessary. Inspect
front first. Do not alter the far eye asymmetrically to suit one camera. The
central teal bridge dips too far over both eyes; the eventual cream nose
bridge should be integrated rather than applied as a separate facial mask.

The side view also reveals nearly leaf-thin feet in the fore/aft direction
and a tail border visible mainly on thickness edges. These remain genuine
3D reference-fidelity issues, not reasons to abandon the improved closed hull.

## V17 eye gate, 16:50 UTC

The near eye now reads as recessed and hooded, a genuine improvement.
Provisional face/character score: **2.75/5**. The far eye is excessively
occluded, so the whole face is not accepted.

Source inspection identifies a concrete mirror defect: the upper clipping
slope uses `0.30 + 0.50*u` for both eyes while each local tangent points toward
positive world X. The upper lids therefore are not reflections. Apply the
side sign consistently to rim sampling, cavity clipping and iris clipping.
Inspect front and mirrored three-quarter views before altering one eye's depth.
Preserve the actual-hull clearance test; the mirror defect does not justify
returning to nominal-plane containment.

## V16 eye gate, 16:47 UTC

The unified orange cheek field improves on the two stripes. The actual eye
render fails containment: round lenses project beyond the hood, and the far
eye reads as an upright coin. Provisional face/character score: **1.5/5**.
The unchanged base retains silhouette 3.25/5 and facet language 3/5; spines
remain deliberately absent. No overall acceptance follows from those scores.

Checking against a nominal cutter plane is insufficient because the curved
hull recedes behind it. Sample the original pre-cut hull along the local eye
normal, constrain the entire lens behind its actual surface, and constrain
the lens footprint to the cavity's clipped upper arc. Reduce cap bulge and
pupil/highlight depth increments to avoid stacked coin-like layers. Deepen
the socket if necessary rather than shrinking the visible eye into a slit.

## V15 anatomy gate, 16:43 UTC

Connected color-region cuts remove V14's fragmented triangles, and cavity
walls now read as coherent dark recesses. The base is ready for a recessed-eye
render, not another hull restart. Provisional geometry-only scores:
**silhouette 3.25/5; facet language 3/5**. Finished face/character and
reference-fidelity scores remain deferred while iris and spines are absent.

Near aperture is approximately 82 × 61 pixels against a pouch width of 338:
the 0.24 width ratio matches the target. Preserve this opening size. Socket
center to mouth separation remains approximately 0.26 pouch-width versus
the target's 0.19; establish the visible iris center before another cavity
position adjustment. Its amber lower lobe should fill the rounded socket,
with the upper third occluded by a shared sloping brow. Inspect side-on to
ensure all eye geometry stays behind the aperture plane.

Merge the two orange stripes and their intervening teal gap into one localized
cheek/brow field, terminating around the outer orbit. The near cream edge is
too straight and can rise gently under the eye. Narrow crown triangles and
slightly excess mouth height are secondary to evaluating the actual eyes.

## V14 anatomy gate, 16:37 UTC

The actual V14 hero render improves lower-pouch fullness and flattening. Keep
the closed hull rather than restart its topology. Provisional geometry-only
scores: **silhouette 3.25/5; facet layout 2.5/5**. Eyes and spines remain
deliberately absent; no finished character/fidelity score is assigned.

Near-socket-to-mouth horizontal spacing is approximately 96 pixels, or
0.27 of pouch width, improved from V13's 0.33 toward the target's 0.19.
Check again with the recessed iris defining the actual visible eye center
before making another large orbital-position adjustment.

The isolated orange cheek triangle and cream zigzags are material-boundary
artifacts. Insert a connected semantic boundary through affected triangles,
reuse intersection vertices along shared edges, and triangulate each region.
Do not color entire broad triangles by centroid. Assign cavity wall colors by
their construction identity instead of a global normal-direction threshold.
Reduce small crown silhouette bumps while retaining broad irregular facets.
The next useful gate is a coherent teal/orange/cream shell with recessed eyes,
not additional decorative geometry masking these boundaries.

## V13 anatomy gate, 16:34 UTC

The actual V13 hero render shows a meaningful structural improvement: the
hanging facial-mask seam is gone and the face belongs to one rounded mass.
This is a base-shape review. Iris and spines are deliberately omitted and are
not penalized. Provisional geometry-only scores: **silhouette 3/5; facet
layout 2/5**. Character and finished reference fidelity are deferred for this
deliberately incomplete anatomy gate. A reported zero-non-manifold-edge
check supports connectivity, not visual acceptance or animation quality.

Approximate V13 projected cream-region bounds are x275–631, y508–717:
356 × 209, or 1.70:1, already near the target's 1.65:1. Do not globally widen
the pouch without checking this ratio. Its lower third still tapers too
strongly; retain more lower width and flatten the bottom arc instead.

Near socket center is approximately (450,474), mouth center (566,486).
Their horizontal separation divided by pouch width is about 0.33; the
target's corresponding ratio is 0.19. Move the orbit forward and medially
toward the nose, while keeping its recessed curved frame. Target vertical
separation is also greater: about 0.10 of pouch width versus V13's 0.03.
These manually read landmarks are approximate and camera-dependent.

V13 mouth is approximately 86 × 63 pixels; scaling the target to the same
pouch width suggests about 99 × 55. Slightly broaden and shorten its opening.
The long flat crown shelf, horizontal facet belts and huge triangular orange
cheek field remain conspicuous. Stagger the hull's angular sections and
vertex heights; author semantic cheek/brow boundary loops rather than
coloring entire large faces by their centroids. Preserve the newly closed hull.

These measurements and priorities were sent to the V14 builder before its
next render. They are guidance, not a claim that later geometry implements them.

## V12 evidence and verdict

Approved reference: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
Actual comparison: V11 and V12 `matched-style.png` studio renders, with V12
completed at approximately 16:29 UTC. Source inspected:
`art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v12.py`.

V12 is a visual regression. The crown has fewer distracting raised tiles, but
the face reads as a flat hanging mask, with an exposed side boundary. Amber
eye pieces protrude from narrow rectangular slots. The cream throat is too
tall and narrow. A successful export does not establish visual acceptance.

Provisional ratings, from the actual V12 hero render only:

| Visual criterion | /5 | Evidence |
| --- | ---: | --- |
| Silhouette | 2.0 | Crown and spines identify a puffer, but long legs and narrow hanging throat miss the squat pear form. |
| Face / character | 1.0 | Slot eyes, exposed iris tabs and flat facial surround lose the target's deep angry gaze. |
| Facet language | 2.0 | Crown simplification helps; regular horizontal bands and flat front grid remain conspicuous. |
| Palette | 2.5 | Teal/orange/cream zones exist; cream is grey and orange muted relative to reference. |
| Reference fidelity | 1.5 | Main colors and spines survive, but facial anatomy, mass distribution and tail presentation differ materially. |

No animation, gameplay, phone performance, runtime integration or all-angle
quality rating is implied. The hero render alone cannot establish those.

## Measured target landmarks

Approximate pixels in the approved 1024 × 1536 image, using its large left hero:

| Feature | Bounds / size |
| --- | --- |
| Complete creature | x16–465, y410–826 |
| Core body including pouch | x119–465, y474–778 |
| Cream pouch | x207–465, y622–778; 258 × 156 |
| Near visible eye aperture | x315–376, y579–622; 61 × 43 |
| Dark mouth | x360–432, y607–647; 72 × 40 |
| Near main foot | x82–220, y701–826; 138 × 125 |
| Tail fan | x16–133, y570–716; 117 × 146 |

Normalize against pouch width: eye 0.24; mouth 0.28; main foot width 0.53 and
height 0.48; tail width 0.45. These are projected shape guides, not exact
3D dimensions. V11 eye width was approximately 0.18, foot width/height
0.44/0.62, and tail width 0.21. V12 has not repaired the tail presentation.

## Why the patches fail

- Separate mantle tiles, pouch, facial cards and lip frames accumulate seams
  instead of establishing one anatomical surface.
- V12 replaces those with a front grid, but its outer columns do not join the
  cranial body. A shared front grid is not a closed integrated hull.
- Rectangular row omissions make eye slots. The fixed forward-facing iris
  plane does not share the curved socket's orientation or depth, so iris and
  socket intersect visually.
- Symmetric latitude rows produce belts across the throat. The reference uses
  irregular broad triangles and a flattened lower arc.
- Adjusting camera alone cannot repair those geometric problems. A roughly
  42–48° yaw is a useful camera trial, not a recovered reference specification.

## Reconstruction priorities

1. Author a closed cranial/throat hull with a broad upper-middle pouch and
   flattened lower arc. Share side and underside boundary vertices explicitly.
2. Make eye sockets as named local loops on that hull, with rounded lower arcs
   and diagonal upper lids. Recess iris and socket wall along the same local
   outward normal; do not place every iris in a fixed global plane.
3. Preserve a large round amber lower lobe beneath a thick tapering brow. Do
   not shrink the whole eye into a slit to obtain an angry expression.
4. Connect cheek, brow and nose loops to adjacent hull vertices. Give the
   mouth a real recessed opening and warm dark interior, without a raised frame.
5. Shorten and splay the main flipper-feet; use four broad radial cream tips.
   Keep rear supports subordinate. Rotate or reshape the tail to present its
   broad fan, with ochre border on the visible face, not only its thickness.
6. Keep a few integrated shoulder folds, but remove raised tile outlines.
   Stagger broad throat triangles so no continuous latitude ridge dominates.
7. Warm the cream, deepen teal shadows and strengthen orange saturation.
   Sampled rendered colors are lighting-dependent, not direct albedo targets.

Before detail passes, inspect the closed hull with dark eye/mouth openings
from front, side and three-quarter views. A geometry connection must survive
those views; overlapping screen-space silhouettes are insufficient.

Exact back/underside topology, camera parameters and hidden anatomy remain
inferred. The approved small front/side/back thumbnails provide coarse checks,
not enough evidence to claim a unique reconstruction.

## 2026-10-18: V26 from V9, complete-identity multiview review

Reviewed `tmp/puffer-lowpoly-v26-from-v9/matched-style.png` and all nine numbered PNGs, 01 front through 09 elevated back. The original approved low-poly concept remains authoritative; derived nine-angle AI mockups are approximate. Those derived pictures inconsistently show the tail face-on from side, rear and overhead, vary toe/spine layouts, and introduce ambiguous paired orange-rim side forms in front views. They cannot be literal calibrated geometry targets.

**V26 overall resemblance: 3.21/5**, unchanged full-identity rubric: silhouette/proportions **3.1** (35%), face/expression **3.2** (30%), defining details **3.5** (20%), facet/style **3.1** (15%). No animation, gameplay or export quality is scored. The original ranking remains a dated inventory rather than silently changing its V9 score.

The matched hero improves V9's filled tail, pointed four-lobe toes and lower pouch contour while preserving its brows, rounded amber eyes, open mouth and spines. However, actual side/top/back views expose inherited defects that the earlier V9 hero-only score could not certify: fins are broad ribbons with nearly knife-thin fore/aft depth; the pouch hangs forward as a separate ball; orange orbital walls project as long tubes/straps; raised mantle plates produce broken overlapping edges. The tongue remains weakly readable. Side and elevated-side frames crop beak/tail extremes, so nine files do not constitute fully framed nine-angle evidence.

The lower all-view score versus V9's 3.43 single-view estimate reflects stronger evidence, not a claim that V26's matched hero regressed. Neither reaches 4.5/5.

Next bounded correction: preserve each fin's frontal width, orange top band and four distinct terminal lobes while adding real Y-depth cross-sections; roughly 0.07–0.10 half-depth at midfoot and 0.09–0.12 at the fan are initial modelling estimates, not reference-certified dimensions. Fit each diagnostic camera to the same complete object bounds. Then shorten orbital sidewalls without shrinking the amber opening, reduce muzzle shelf depth while keeping the peaked arch/tongue/nostrils, and integrate mantle surface relief without deleting the authored broad facets or spines.

## 2026-10-18: V27 full multiview result

Reviewed `tmp/puffer-lowpoly-v27-from-v9/matched-style.png` and all nine numbered diagnostic views. **Overall 3.04/5:** silhouette/proportions 2.9, face/expression 3.2, defining details 3.2, facet/style 2.8, using the same 35/30/20/15 weights. Diagnostic framing now contains the geometry and fin fore/aft depth is real. However, exposed cylindrical fin-root caps read as detached boots; orange top bands shrink to vertical hems, toe wedges become little teeth, and mantle overlaps remain fractured. This is a visual regression despite a useful volumetric construction test. V28 is unscored until actual renders exist. The historical 31-version ranking remains unchanged.

## 2026-10-18: unchanged V9 fair-camera baseline

Reviewed all ten images in `tmp/puffer-v9-shared-baseline/`: matched original hero plus nine shared-camera diagnostic frames. The capture owner reports an unchanged V9 blend with fingerprint checks in `baseline-capture.json`. Actual images independently confirm the knife-thin fins, hanging pouch, long orbital cylinders, C-shaped tail and layered mantle were present in V9.

**V9 with full multiview evidence: 3.07/5** (silhouette 2.9, face 3.2, details 3.2, facets 3.0). This is a new evidence-specific assessment, distinct from the historical hero-only 3.43. On comparable multiview evidence, V26 (3.21) is ahead of unchanged V9 (3.07), with V27 (3.04) approximately tied but showing the documented boot-root regression. Small differences are close calls. None approaches 4.5. Keep the original ranking's stated cutoff and source coverage rather than silently revising its past judgments.

## 2026-10-18: V28 full multiview result

Reviewed matched hero and all nine diagnostics in `tmp/puffer-lowpoly-v28-from-v9/`. **Overall 3.33/5:** silhouette/proportions 3.3, face/expression 3.25, defining details 3.6, facet/style 3.2, same 35/30/20/15 weights. Current best on comparable multiview evidence, ahead of V26 3.21, unchanged V9 3.07 and V27 3.04; still below 4.5.

Direct approved-target gains: complete face-bordered tail, readable tongue, broader four-lobe tips and retained rounded eyes/brows/spines. Side evidence now shows real fin volume and buried roots. Remaining high-impact defects: long upright conical fins rather than low diagonal fans; long projecting orbital walls and cream beak shelf; a black triangular gap above the cream nose bridge in top/elevated-front views, separate from the intended mouth cavity. Union topology did not alone solve the cream pouch's separated visual mass. Reduce visible upright fin length, restore a broad orange distal dorsal band, then integrate sockets and nose while preserving projected amber aperture and thick brow character.

Hidden-view coherence is judged against the approved original's small side/rear thumbnails and internally consistent 3D attachment, not literal derived-AI anatomy. No penalty is imposed for the tail failing to face every contradictory generated camera. Exact hidden underside/spine-root anatomy remains inferred. Historical all-version ranking and its original cutoff remain unchanged. No animation/runtime/export acceptance is asserted.


## 2026-10-18: V29 full multiview result

Reviewed all ten PNGs in `tmp/puffer-lowpoly-v29-from-v9/`. **Overall 3.37/5:** silhouette/proportions 3.4, face/expression 3.25, details 3.6, facet/style 3.2; total computed using decimal arithmetic with the unchanged 35/30/20/15 weights. This is a modest stance improvement over V28, not a major fidelity jump. Lower body and shorter wider feet reduce the elevated belly gap and improve squatness. Rear feet remain nearly as prominent as forefeet in the hero, and tall conical shoulders still differ from the original's low sloping fan silhouette. Existing long orbital sidewalls, cream shelf and black gap above the nose remain unchanged.

Next three priorities: repair connected nasal bridge and reduce orbital projection without sacrificing visible rounded amber lobes or thick brows; subordinate rear supports while retaining stable real depth; replace conspicuous mantle layering with coherent broad facets without deleting the crown detail. V30 remains unscored before actual images. All scores refer to the approved original, with derived hidden-view art treated as approximate.


## 2026-10-18: V30 face regression

All ten actual PNGs in `tmp/puffer-lowpoly-v30-from-v9/` reviewed. **Overall 2.92/5**, computed from silhouette 3.2, face 2.3, details 3.2, facets 3.1 at unchanged 35/30/20/15 weights. V29 remains the best reviewed multiview candidate at 3.37.

The socket transplant is a direct character regression: the near eye is enlarged and recessed into an oversized brown hanging cavity; far-eye readability is poor in the hero; elevated-front loses both irises entirely; orange cheek/brow geometry becomes thin straight bars/cards rather than the approved substantial sloping wedges. The connected cream bridge closes the prior gap but expands into a broad white central slab. Body, feet, spines and tail remain recognizable, so the failure is specifically facial rather than detail deletion across the whole model.

Next priorities: restore V9 visible eye coordinates/aperture and projected iris area; sculpt surrounding hull forward around that stable eye placement, keeping rounded amber lower lobes visible from front and hero; retain a compact peaked cream bridge with nostrils and a true mouth beneath, avoiding a broad central visor. Native diagnostics reportedly trace a 24 cm rearward eye relocation, which is a builder/helper diagnosis rather than a measurement inferred from these images. V31 remains unscored until actual render evidence.

## 2026-10-18: V31 rejected structural failure

Independently inspected `tmp/puffer-lowpoly-v31-from-v9/matched-style.png`: the body and pouch are missing, leaving floating face pieces/spines and exposed fin-root caps. Seven frames existed when checked, but the builder stopped the run before completing the nine-view set (reported exit 130). This is a rejected structural failure, not a valid new candidate; no complete-view resemblance score is assigned. V29 remains best reviewed at 3.37. Builder reports a malformed cheek-patch rear closure causing a destructive Boolean and is adding volume/manifold/bounds checks; eye visibility against an emptied hull is not sufficient validation.

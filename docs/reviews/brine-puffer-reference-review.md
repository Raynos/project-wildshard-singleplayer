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


## 2026-10-18: V36 full multiview result

Reviewed matched hero and all nine actual diagnostics in `tmp/puffer-lowpoly-v36-from-v9-full/`. **Overall 3.35/5:** silhouette/proportions 3.4, face/expression 3.3, details 3.6, facet/style 3.0, decimal-calculated at unchanged 35/30/20/15 weights. Effectively a close call with V29 (3.37), not a defensible new best; retain V29 as best reviewed. No alternate camera was substituted into scoring.

The tapered brows recover anger and rounded amber lower lobes remain visible from front/hero. Nasal bridge continuity improves over V29's black upper gap. However, side/elevated-side views expose folded orange cheek shelves and sawtooth surface intersections; these are direct geometric artifacts, not disagreements with inferred AI anatomy. The brow and cheek still lack the original's clean broad planar wedge-to-cheek transition. Core stance, prominent rear feet, long cream shelf and raised mantle layering remain.

Three next priorities: replace the folded cheek shelves with a coherent sparse surface joining outer socket to warm cheek; remove raised mantle overlaps while preserving broad purposeful facets and all spines; subordinate rear fins and keep low sloping forefoot fans. Existing eye coordinates and readable iris lobes should remain protected during cheek work. V33–V35 were hero-only local gates and were not assigned full-view scores; V31 remains rejected structural failure. V37 is not scored before actual evidence.


## 2026-10-18: V38 full multiview result

Reviewed all ten actual images in `tmp/puffer-lowpoly-v38-from-v9-full/`, original matched hero and fixed nine diagnostics. **Overall 3.51/5:** silhouette/proportions 3.6, face/expression 3.35, details 3.6, facet/style 3.5, decimal-calculated with unchanged weights. New best reviewed full-view candidate, ahead of V29 3.37; still below 4.5 and unaccepted.

The mantle is now a continuous broad faceted body rather than overlapping shingles, and moving pouch/mouth rearward reduces the separate forward-ball impression in side views. Those are genuine geometric improvements under the same cameras. All defining features remain. The cleaner mantle still has somewhat regular longitudinal bands and broad rectangular top patches, so it is not yet the approved irregular triangulated surface language. Folded orange cheek ledges remain visible in profile, and rear feet are too prominent relative to forefeet. Front toe wedges still read as hem-mounted triangles rather than broad integrated terminal lobes.

Next three priorities: subordinate rear distal fins while preserving buried roots; build four broad ridge-topped forefoot lobes sharing bases with the orange dorsal fan; replace folded cheek ledges with a coherent warm transition around the eye without reducing projected iris visibility. Hidden-view evaluation is coherent construction checked against the original small side/rear thumbnails, not exact imitation of derived AI tail orientation. V39 remains unscored pending actual renders.


## 2026-10-18: V44 full multiview result

Reviewed original hero `tmp/puffer-lowpoly-v44-from-v9/matched-style.png` plus all nine `tmp/puffer-v44-shared-4p2/` diagnostic PNGs. Cross-checked unchanged V38 at the same 4.2 framing in front, left, top and elevated-left views, alongside the previously reviewed complete V38 set. **Overall 3.62/5:** silhouette/proportions 3.7, face/expression 3.5, details 3.8, facet/style 3.4, decimal-calculated at unchanged weights. A modest defensible new best over V38 3.51, still below 4.5 and unaccepted.

Actual gains: broad head surface replaces folded projecting cheek sheets; eye region is better integrated into cranial mass; reduced rear fins establish better fore/rear hierarchy; fuller front toe tops preserve four readable lobes. Remaining direct-target mismatches: cream lateral cheek forms a square shelf/crease and notch above foreleg rather than a continuous tapered pouch transition; orange side field remains a nearly horizontal belt; brows are thin front blades rather than substantial seated wedges. Body and pouch facet rows remain too regular. The improved coherence is not a claim of exact hidden anatomy.

Next three priorities: reshape the local cheek-to-pouch union into one tapered volume without changing eye positions; define a sloped warm cheek boundary using actual surface topology; stagger selected facet-row heights and diagonals while preserving silhouette and semantic boundaries. Keep the four full toe lobes and reduced rear support size. Camera-only variants were not used to raise the score.

## 2026-10-18: V46–V50 local studies and V51 full review

V46 hero softened the cheek crease while retaining a squared lateral cream field. V47 hero's interior row staggering did not materially remove the horizontal pouch belts. V48 failed pure geometry preflight; V49 stopped before rendering due to dispatch variable shadowing, per builder reports. V50's actual hero showed deep concave pouch flutes after fixed-vertex edge flips and was rejected as a local regression, without a full nine-view score. Diagonal connectivity alone is insufficient: future changes must preserve gently convex surface quality, allowing bounded interior motion rather than optimizing only silhouette or normal-change magnitude.

V51 returns to V46 geometry and increases exposed lower amber lobe and upper brow weight. Reviewed `tmp/puffer-lowpoly-v51-from-v9/matched-style.png` plus all nine actual diagnostic PNGs in `tmp/puffer-v51-shared-4p2/`. **Overall 3.69/5**, decimal-computed from silhouette/proportions 3.75, face/expression 3.65, defining details 3.8, facet/style 3.45 at unchanged 35/30/20/15 weights. Modest new best versus V44 3.62; the small difference is a close judgment, not perceptual hundredth-point precision.

Front and hero gain fuller rounded amber lower lobes and heavier sloping brows, with both pupils retained. Side views show no projecting eye coins, though profile iris visibility remains limited. Softer cheek transition also helps. Remaining direct-target gaps: horizontal body/pouch belts and squared lateral cream field; brow still lacks the seated rearward top-plane mass of the approved wedge; near foreleg remains conical rather than a compact sloping flipper. Preserve V51 as the best fallback while testing bounded improvements. No runtime, animation or export score is included.

The owner's updated stopping condition is **4.0/5 or V100, whichever occurs first**, then the other four enemies. This changes the stopping condition only, not scoring weights or standards. V51 is below 4.0 and remains unaccepted. Historical ranking cutoff remains untouched.

## 2026-10-18: V52 local gate and V53 full review

V52's actual hero added isolated upper orange tabs rather than a convincing seated brow top plane. It was not promoted or given a full-view score. V53 returns to V51 face geometry and uses convex resampling for the pouch instead of V50's fixed-vertex edge flips.

Reviewed `tmp/puffer-lowpoly-v53-from-v9/matched-style.png` and all nine actual shared-4.2 diagnostic images in `tmp/puffer-v53-shared-4p2/`. **Overall 3.76/5**, decimal-computed from silhouette/proportions 3.8, face/expression 3.65, defining details 3.8, facet/style 3.85 with unchanged weights. New best reviewed versus V51 3.69, still below 4.0 and unaccepted.

Broad convex irregular cream planes now break the pouch's middle/lower horizontal belt in front, hero and elevated views without the rejected concave flutes. The dominant pouch mass, eyes, brows and identity details remain. Remaining priorities are the squared lateral cream field and tiny teal triangular sliver/notch at its side union (especially left/elevated-left), regular teal mantle belts, and conical upper foreleg rather than a low sloping fan. Preserve successful lower pouch planes and stable face while addressing these separately. No alternate camera, runtime behavior, animation or export credit is included.

## 2026-10-18: V54 local paint gate and V55 full review

V54 hero's sloped orange/cream boundary was a modest credible semantic-field improvement; no full score was assigned to that single view. V55 combines it with a shorter/wider buried foreleg root, preserving toe fan, ground contact and the successful convex pouch.

Reviewed original hero `tmp/puffer-lowpoly-v55-from-v9/matched-style.png` and all nine actual `tmp/puffer-v55-shared-4p2/` diagnostic images. **Overall 3.81/5**, decimal-computed from silhouette/proportions 3.85, face/expression 3.75, details 3.8, facet/style 3.85 at unchanged weights. Modest new best versus V53 3.76, still below 4.0 and unaccepted.

The diagonal warm cheek field better follows the approved target; foreleg shoulder is lower and more sloped, while side views retain real depth and embedded roots. Pouch, eye/brow and four-lobe toe identity remain. The leg change is subtle, not a major silhouette redesign. Remaining priorities: regular teal mantle latitude belts; tiny lateral cream union sliver/notch; brow/eye proportions still somewhat flatter than the target. A bounded convex mantle broad-facet pass has greater leverage than repeated tiny foot adjustments. Do not change eyes or successful lower pouch planes during that pass.

## 2026-10-18: V56 local mantle gate and V57 full review

V56's rear-mantle convex resampling was a credible hero-local cleanup requiring side/back evidence. V57 combines that change with narrower/receded outer cream arch wings, retaining mouth, eye and nostril anchors.

Reviewed `tmp/puffer-lowpoly-v57-from-v9/matched-style.png` plus all nine actual shared-4.2 views in `tmp/puffer-v57-shared-4p2/`. **Overall 3.87/5**, decimal-computed from silhouette/proportions 3.85, face/expression 3.9, details 3.8, facet/style 3.95 at unchanged weights. New best versus V55 3.81; explicitly below 4.0, without rounding up to the stopping threshold.

The compact cream arch improves eye-to-mouth balance and remains attached in side views rather than becoming a floating ribbon. Rear mantle shows broader diagonal convex planes, and visible spine roots remain seated. The intentionally pinned front crown/side retain some regular bands. A tiny lateral cream union sliver persists. Tail remains a uniformly thick regular polygonal disk rather than the approved irregular faceted fan. These remaining differences should be addressed without reopening the successful eyes, mouth or pouch. Tail orientation is not judged against contradictory generated nine-view art. No runtime/animation/export credit or final acceptance is implied.

## 2026-10-18: V58 resumed static full review

Reviewed original hero `tmp/puffer-lowpoly-v58-from-v9/matched-style.png` and all nine actual fixed-4.2 images `01-front.png` through `09-elevated-back.png` in `tmp/puffer-v58-shared-4p2/`. Reopened the approved original and V57 hero, left and elevated-back comparisons. **Overall 3.90/5**, decimal-code calculated from silhouette/proportions 3.85, face/expression 3.90, defining details 3.95, facet/style 3.95 at unchanged 35/30/20/15 weights. A modest new best over V57 3.87, still below 4.0. Hundredths describe rubric arithmetic, not perceptual measurement precision.

The tail-only change replaces the uniform flat polygonal coin with broad faceted fill, an irregular outline and tapered edge thickness. Side, top and rear diagnostics retain a coherent stem and closed-looking fan. This is a defining-detail improvement; unchanged face, body and stance receive no improvement credit. Edge-on tail visibility is physically expected and is not penalized for contradicting generated multiview art. The approved original remains authoritative.

Largest remaining direct target mismatch is the broad flat/banded front crown and blade-like orange brows compared with the approved raised irregular crown planes and seated brow wedges. A bounded convex front-crown plane/mass pass is the next useful study, preserving eye positions, mouth, brow lower edge, spine seating and successful pouch planes. Avoid repeating the failed isolated rear brow tabs or rebuilding the eyes. The small lateral cream union notch remains a secondary construction defect. Hidden anatomy is judged for coherence, not exact invented reconstruction.

Runtime gait, hit/death behavior, numeric rig tests and functional export checks contribute no static likeness credit. Animation ratings are documented separately in `brine-puffer-animation-v57/provisional-animation-ratings.md`. V58 is the best static study, not a newly validated animated/native replacement or final acceptance.

## 2026-10-18: V59 full review, unpromoted crown study

Reviewed original hero `tmp/puffer-lowpoly-v59-from-v9/matched-style.png` and all nine fixed-4.2 diagnostics in `tmp/puffer-v59-shared-4p2/`, against V58 and the approved original. **Overall 3.89/5:** silhouette/proportions 3.85, face/expression 3.90, defining details 3.95, facet/style 3.90. Decimal calculation at unchanged 35/30/20/15 weights gives 3.8925, rounded half-up to 3.89. Retain V58 at 3.90 as best reviewed. The 0.01 difference does not imply statistical or perceptual precision; V59 is unpromoted because it offers no meaningful overall target-match gain.

The convex crown patch is coherent in top, side and elevated views, and visible spine roots remain seated. There is no major new opening or floating-part regression. However, removing the front latitude bands replaces them with oversized plain diamond and lateral planes. The hero reads more helmet-like, while the approved original has more articulated irregular crown planes. Face, stance, pouch and V58 tail remain unchanged and receive no new credit.

Next bounded study should use V58 rather than accumulate this unpromoted crown change: reshape the existing orange brow slab into a connected tapered wedge with a readable top plane, preserving the lower hood edge and visible pupil coordinates. Replace the existing volume rather than append isolated rear orange tabs, which failed in V52. Keep the eye anatomy, compact mouth arch and successful pouch fixed. No final 4.0 acceptance, runtime bonus, animation score or public playable replacement follows from this static study.

## 2026-10-18: V60 full review, unpromoted tie

Reviewed original hero `tmp/puffer-lowpoly-v60-from-v9/matched-style.png` and all nine actual fixed-4.2 images in `tmp/puffer-v60-shared-4p2/`, against V58 and the approved original. **Overall 3.90/5**, tied with V58: silhouette/proportions 3.85, face/expression 3.90, defining details 3.95, facet/style 3.95. Decimal-code calculation at unchanged 35/30/20/15 weights is exactly 3.9000. Retain V58 as best-reviewed fallback; V60 is not promoted because there is no meaningful overall gain. Scores remain subjective judgments, not hundredth-point perceptual measurements.

The connected brow volume provides a readable top plane in the hero and retains both pupils. No obvious open attachment seam appears. But the front brow becomes rectangular/bar-like, and elevated-front, elevated-side and elevated-back views expose broad pointed orange rear corners resembling extra tabs. The approved brow is a seated tapered wedge rather than a rectangular extrusion or projecting orange ear. Added depth therefore trades one mismatch for another.

Next bounded study may keep V60's connected central top-plane volume while tapering the lateral/rear footprint into the skull. Reduce the projected rear corner, preserving the lower hood edge and pupil visibility; avoid a uniform thickness increase or separate overlay. This is a local study, not final acceptance. No runtime, rig or animation credit is included.

## 2026-10-18: V61 hero-only gate, unpromoted

Inspected `tmp/puffer-lowpoly-v61-from-v9/matched-style.png`. The narrowed brow footprint exposes a thin orange splinter behind the near brow, approximately image x377–400/y502–515, while the main brow still reads rectangular. No compelling target-match improvement offsets the artifact. Do not spend a full nine-view capture on this state; preserve it as an unpromoted hero study, with no full-view score. An exposed lower return/support after narrowing is a plausible cause, not a topology-proven diagnosis from the image.

Return to V58 for the separate primary-crown-spine proportion study. Approximate projected landmarks in the approved main hero: tip (284,411), base (271,474)–(337,477), base-width/height about 1.0. Current matched hero: tip (364,292), base approximately (343,368)–(386,360), ratio about 0.60. The current primary spine therefore reads narrower and more upright. These are camera-dependent image estimates, not recovered 3D dimensions. A bounded broader base and modest tip lean should preserve root burial and height, then be checked in hero and side views. Do not combine this with the unpromoted brow changes.

## 2026-10-18: V63 full review, primary-spine correction

Reviewed original hero `tmp/puffer-lowpoly-v63-from-v9/matched-style.png` and all nine actual fixed-4.2 images `01-front.png` through `09-elevated-back.png` in `tmp/puffer-v63-shared-4p2/`, against V58 hero and the approved original. **Overall 3.93/5**, a modest new static best: silhouette/proportions 3.90, face/expression 3.90, defining details 4.00, facet/style 3.95. Decimal-code calculation at unchanged 35/30/20/15 weights gives 3.9275, rounded to 3.93. This remains below 4.0; hundredths reflect rubric arithmetic rather than perceptual precision. No animation, export or runtime credit is included.

V63 broadens the primary crown spine and corrects its projected lean toward screen-left, retaining the V58 baseline elsewhere. Approximate hero landmarks: tip (354,295), base (338,370)–(414,360), width/height about 1.09, versus approved original approximately 1.0 and V58 approximately 0.60. The asymmetric wedge now better matches the directly visible target silhouette. Side, top, rear and elevated diagnostics show a seated root and no obvious collision with adjacent spines. Adjacent projections overlap from some angles without evidence of a floating root or merged spike. The unchanged face, pouch, limbs and crown receive no improvement credit. V62's wrong-direction intermediate was reported by the builder and was not independently rated here.

Remaining direct differences include flat blade-like brows, regular front crown planes, the small lateral cream transition notch, and a mouth rim that reads as a separate beak. A bounded mouth-continuity study is better supported than changing overall mouth size. Approximate dark-opening landmarks in the approved main hero are x363–433/y607–647 (70 by 40 pixels); V63 is x485–578/y518–578 (93 by 60 pixels). Height/width is approximately 0.57 versus 0.65. Current mouth is somewhat taller in projection, not demonstrably too small. Camera yaw and face orientation differ, so these are screening estimates, not recovered 3D ratios or justification for global enlargement.

The V63 ivory point at approximately x535–552/y510–533 interrupts the upper aperture. Its straight lower cream rail spans approximately x489–584/y563–591, with a distinct dark strip beneath it. The approved lower edge around x363–435/y639–652 instead flows into a broad tapered lower facet ending near (411,668). A useful bounded improvement would remove the hanging central point and integrate the lower rim into the pouch through a tapered continuous plane, preserving the dark open cavity, visible coral tongue, aperture size, eyes and pouch silhouette. Do not close the mouth or infer unseen internal anatomy. These pixel landmarks are approximate and camera-dependent.

## 2026-10-18: V64 full review, mouth continuity

Reviewed the actual hero `tmp/puffer-lowpoly-v64-from-v9/matched-style.png` and every image `01-front.png` through `09-elevated-back.png` in `tmp/puffer-v64-shared-4p2/`. Reopened V63 hero and the approved original for comparison. **Overall 3.96/5**, a modest new static best: silhouette/proportions 3.90, face/expression 4.00, defining details 4.00, facet/style 3.95. Decimal-code calculation with unchanged 35/30/20/15 weights gives 3.9575, rounded half-up to 3.96. It remains below the 4.0 stopping threshold. Scores are subjective and the arithmetic is not a claim of hundredth-point visual precision.

The hanging ivory point is removed, making the dark upper arch continuous. The lower rail is shallower and transitions into the pouch; side and elevated-side views no longer show the previous conspicuously projecting lower bar. Front and elevated-front retain a visible dark cavity and coral tongue. The open-mouth expression remains intact. No gross new opening, detached lip or spine-seating regression is visible. A thin straight lower edge remains, so this is an improvement in continuity rather than an exact reconstruction of the target's broader tapered lower facet. Only face/expression receives improvement credit; all unchanged geometry retains its previous component values.

Remaining direct target differences: thin blade-like orange brows, regular front crown bands, a small lateral cream transition notch, and sharp individual ivory toe ends rather than the approved broad faceted fin lobes. A possible next bounded study is distal forefoot-lobe broadening and top-ridge taper while pinning the overall fan outline, roots, ankle and ground contact. Preserve V64's successful face and avoid reopening the failed rear brow-tab approach. Such a study has no guaranteed score gain; actual hero and full-view evidence remain necessary. No runtime, animation, rig or final acceptance is implied by this static review.

## 2026-10-18: V65 hero-only gate, unpromoted toe study

Inspected actual `tmp/puffer-lowpoly-v65-from-v9/matched-style.png` against V64 and the approved original. **No full-view score:** the hero does not justify a nine-view capture in this state. Broadening removes V64's narrow tooth-like ends, but the tall front caps and chamfered corners now read as cuboid paw digits. The approved forefoot has flatter angular fin lobes, with broad sloping planes reaching an asymmetric pointed/blunt terminal edge. Four similarly block-fronted digits trade one mismatch for another.

Preserve the useful broader lobe roots and shallower clefts while lowering the distal cap's upper edge and tapering its top ridge toward an off-center angular tip. Keep sole, total fan extrema, root attachment and successful V64 face/body fixed. Do not revert to narrow tetrahedral teeth. V65 is an unpromoted hero study; V64 remains best reviewed at 3.96/5. A new correction requires its own actual-image gate and full nine views before a score.

## 2026-10-18: V66 rejection and V67 hero-only gate

Inspected actual heroes `tmp/puffer-lowpoly-v66-from-v9/matched-style.png` and `tmp/puffer-lowpoly-v67-from-v9/matched-style.png`. V66 lowers and slopes the toe caps but retains broad trapezoidal terminal contours, so the paw-digit impression persists. Preserve V66 as an unpromoted hero-only study, with no full-view score. Lowering height alone did not address the visible contour mismatch.

V67 retracts the two distal shoulders toward one off-center angular terminal while retaining broad roots. The resulting zigzag ends remove the conspicuous flat caps and are a plausible modest improvement over V64's narrower teeth and V65/V66's pads. This hero warrants a full nine-view capture, but receives no final score yet. Broad root blocks remain visible in the hero; front and side diagnostics must establish a continuous fin-like taper and attached lobe volumes before any promotion. V64 remains the best fully reviewed candidate pending that evidence.

## 2026-10-18: V67 full review, angular forefoot lobes

Reviewed actual hero `tmp/puffer-lowpoly-v67-from-v9/matched-style.png` and all nine fixed-4.2 images `01-front.png` through `09-elevated-back.png` in `tmp/puffer-v67-shared-4p2/`, with V64 and the approved original as comparisons. **Overall 3.98/5**, exact weighted total **3.9750**: silhouette/proportions 3.95, face/expression 4.00, defining details 4.00, facet/style 3.95 at unchanged 35/30/20/15 weights. Decimal-code rounding is half-up. This remains below 4.0; do not round it to the stopping threshold. The small increment is a subjective bounded contour judgment, not evidence of hundredth-point perceptual precision.

The broad forefoot roots now flow toward angular off-center tips rather than V64's narrower teeth or V65/V66's flat-fronted pads. Top and elevated-front views show broad bases and shallow valleys; side views taper toward the ground without the tall terminal caps. No obvious detached lobe or new ground gap is visible. Straight-on front still reads relatively flat, limiting the gain. Only silhouette/proportions receives a modest increase; unchanged face, defining details and facet language receive no additional credit.

V67 is the new best reviewed static study, not a newly validated animated replacement. Remaining target differences include blade-like brows, regular front-crown bands and the small lateral cream transition notch. If a bounded brow study is attempted, keep the rear footprint and lower hood/eye anchors fixed and work only on the central/front upper ridge: the previous rearward-depth approach produced tabs and exposed slivers. Preserve the successful mouth, pouch and forefoot changes. No guaranteed score gain, runtime bonus or final acceptance follows from proximity to 4.0.

## 2026-10-18: V68 full review, unpromoted brow tie

Reviewed actual hero `tmp/puffer-lowpoly-v68-from-v9/matched-style.png` and all nine actual fixed-4.2 views in `tmp/puffer-v68-shared-4p2/`, against V67 and the approved original. **Overall 3.98/5, an unpromoted tie with V67:** silhouette/proportions 3.95, face/expression 4.00, defining details 4.00, facet/style 3.95. Decimal-code calculation gives exactly 3.9750 at unchanged 35/30/20/15 weights, rounded half-up to 3.98. Retain V67 as best-reviewed fallback; neither version meets 4.0.

The two inclined brow planes provide visible relief in the hero and retain both pupils. No new obvious detached fragment, open seam or V61-style orange splinter appears. However, front and elevated-front views still read as pinched folded flaps; elevated-side views retain a flat return rather than the approved thick seated wedge. The added crease trades flatness for a folded appearance without a meaningful net resemblance gain. Image evidence does not establish whether the mesh is mathematically concave; this is a visual reading, not a topology diagnosis. Unchanged geometry receives no credit and proximity to the threshold does not justify incremental score inflation.

The remaining front crown bands and lateral cream transition notch persist. A further brow study would need a clearly different supported convex cross-section, rather than another tiny ridge lift or rearward tab extension. Preserve V67's successful eye positions, mouth, pouch, spine and forefoot geometry. No animation, runtime or export acceptance follows from this static comparison.

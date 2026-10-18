# Brine Puffer reference review

Date: 2026-10-18. Status: V18 four-view eye gate inspected; implementation remains unaccepted.

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

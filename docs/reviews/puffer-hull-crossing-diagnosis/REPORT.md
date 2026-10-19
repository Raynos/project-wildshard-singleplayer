# Puffer hull: independent source diagnosis

2026-10-19. **Do not admit the selected hull. Repair three local contact/fold
neighborhoods before any broader aesthetic work.** No source geometry was changed.

## Result

The nine pairs in the existing crossing-audit.json are real transverse
self-intersections, not intentional intersections between separately closed parts.
They all belong to the first 1,022 triangles of part 0, the same welded hull.
An independently implemented normalized plane-slice/line-interval predicate
reproduces all nine in native precision and float32 export precision.

The original audit's shared-vertex exclusion hides **12 additional proper
crossings**. Selected has **21** under the independent test, in both precisions.
These are not shared-corner touches: every reported segment has positive length
and its midpoint has strictly positive barycentric coordinates in both faces.
Ordinary adjacent-edge/corner contacts are excluded by the interior predicate.
Coplanar overlaps are not counted, so 21 is not a full intersection certification.

Selected pairs (zero-based body face IDs):

- Left lower flank: 726/776, 776/847, 781/847.
- Positive-X orbital transition: 813/875, 813/876, 813/877, 813/878,
  813/879, 813/897.
- Negative-X orbital transition: 814/898, 817/898, 820/898.
- Positive-X mouth wall: 866/996, 866/998, 870/998, 876/994,
  876/996, 876/998, 878/998.
- Negative-X mouth wall: 884/935, 886/935.

Pass2 also has 21, but its left-flank 776/838 becomes selected 726/776.
Consequently, "zero new crossing pairs" is only true within the old test's
restricted scope. There is one newly detected shared-vertex pair in selected.

## Constructive cause, rather than a generic topology warning

The inherited hull has geometric contacts that its exact-edge manifold graph
does not encode. V71 welded vertex 280 lies **inside nonincident face 813**:
barycentric weights (0.52775942, 0.07245296, 0.39978762), plane residual
1.1348e-8 source units. This is not a corner/edge shared by those primitives.
Likewise vertex 173 lies inside face 776 (residual 1.5493e-8), and vertex
174 lies inside face 847 (5.9916e-10). Those latter overlapping local sheets
already produce the robust V71 crossing 776/847.

The V71 scan detects three pairs; two are precision-scale sliver penetrations
(301/847 and 776/838, smallest midpoint barycentric coordinates 2.10e-8 and
3.10e-7). Do not equate these with the robust inherited 776/847 fold.

Pass2 build_candidate.py transforms **every already-partitioned hull vertex
independently** using nonlinear reshape(), including semantic-cut and Boolean
intersection vertices (lines 35–36). A nonlinear vertex map does not preserve
collinearity, face-plane incidence, or the original straight triangle surface.
For example, V71 vertices 439–464–463 are collinear to 3.32e-8 units; vertex
464 moves 0.00090958 units off the transformed endpoint segment in pass2.
The mirrored 473–471–470 chain has the same defect. These are the mouth-wall
intersection neighborhoods. On the positive orbital contact, vertex 280 goes
from the plane of face 813 to -8.495e-6 units behind it; other vertices of
875/876 remain on the other side. That is the constructive crossing mechanism.

The selected closed-anatomy build retains pass2 connectivity and adds another
nonlinear shape() plus per-vertex limiter. Its normal-hemisphere criterion tests
each face in isolation; it cannot prevent one face crossing a different face.
Most facial pairs remain exact or nearly exact; the lower-flank crossing moves
among incident faces. Closing the four separate head inlays does not affect any
of these hull faces.

The older V71 constructor unions mantle/pouch, locally smooths shared vertices,
triangulates moved polygons, cuts the mouth, then partitions paint. That chain
explains the available semantic/Boolean boundary vertices; the saved final V71
alone cannot prove which upstream operation first created the left fold. No
claim assigning that first failure to a specific Boolean or smoothing pass is
made without a preserved pre-operation mesh. The evidence does establish the
initial V71 contact/fold and its later nonlinear promotion to proper crossings.

## Exact source locations

`diagnosis.json` pins the three native files and records, for every affected
face, exact V71/pass2/selected coordinates, selected welded vertex IDs, and
positions-array offsets. Every implicated welded vertex includes **all**
(face, corner) occurrences, so a source correction cannot accidentally update
only one duplicate in the flat array. Vertex IDs mean first exact-coordinate
occurrence in the selected first 3,066 vertices, not Blender object IDs.
Array offsets are zero-based scalar offsets; face i starts at positions[9*i].

The JSON includes intersection endpoints, lengths, both midpoint barycentric
triples, and shared-vertex counts. The shortest reported segment is 3.4645e-7
units (813/878); the longest is about 0.065319 (884/935). These should be judged
by the contact construction and float32 reproduction, not by an arbitrary
visual-size waiver.

## Smallest coherent correction to implement next

Do not repeat pass3's replacement pouch or global remeshing. Keep the selected
volume, crown, silhouette anchors, expressive face, separate appendages and
four closed inlays. Resolve the local *surface arrangement* of the three
neighborhoods, not the whole bowl:

1. Left lower flank: remove the double-covered/folded local sheet and recover a
   single exterior patch across the current boundary. Original V71 geometry is
   already crossed here, so rolling this area back to V71 is not a correction.
2. Positive and negative orbital/mouth shoulders: resolve the nonincident
   contact vertices into a single exterior patch, with the actual cavity-depth
   boundary retained. Reuse selected macro anchors and construct semantic-cut
   vertices by barycentric interpolation on the corrected carrier triangles.
   Do not independently reapply nonlinear reshape() to newly cut vertices.
3. Keep old colors/skin semantics attached by source-face correspondence. Do not
   merely weld a vertex into a face interior: without removing the overlapping
   sheet, that creates a nonmanifold vertex rather than a valid solid.

`neighborhoods.json` supplies conservative, connected disk-shaped **repair
stencils**, not an implemented mesh: 26 left-flank faces, 46 positive-X faces,
and 67 negative-X faces. Each has Euler characteristic 1 and a degree-two
boundary (14, 22, and 25 boundary vertices). The negative-X stencil includes
8 extra surrounding faces to remove a pinched boundary. They are disjoint and
cover all 21 crossings. All boundary coordinates are recorded. These 139 faces
are a bounded work envelope; there is no claim that all must be replaced or
that this is a mathematically minimum face count. Start with the actual contact
arrangement inside each disk and retain unaffected triangles wherever possible.
The other 883 hull triangles and all non-hull parts can remain byte-exact.

The boundary-fixed approach avoids a new pouch design; it does **not** by itself
prove volume or silhouette preservation. Before accepting a repair, require:
- exact closure/orientation and positive volume in native and float32;
- a full hull test including shared-vertex pairs and coplanar-overlap handling;
- no nonincident vertex/face or edge/edge contacts hidden by adjacency skips;
- exact preservation outside the explicit local stencil and unchanged bones,
  face assembly, spike/fin/tail geometry and closed inlays;
- original finite root samples repeated, quantitative volume/support deltas,
  then matched real views to verify the selected silhouette and seating.

## Reproduction and limits

From repository root:

    OPENBLAS_NUM_THREADS=1 python docs/reviews/puffer-hull-crossing-diagnosis/diagnose.py
    OPENBLAS_NUM_THREADS=1 python docs/reviews/puffer-hull-crossing-diagnosis/analyze_neighborhoods.py

Both programs only read original sources and write their own JSON beside this
report. They import numpy, no Blender, original producer, or original crossing
audit. No render, browser, build, original asset, engine, physics, Site, or Git
state was changed. No correction, likeness improvement, runtime admission,
continuous attachment, or animation claim is made. The latest independent
static review still prefers selected to pass2 without accepting it.

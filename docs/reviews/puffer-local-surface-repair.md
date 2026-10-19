# Puffer: bounded local surface repair attempt

2026-10-19. **Failed preservation/admission gates; retain for diagnosis only.**
One complete editable candidate and its exact float32 GLB are preserved in
`art/driftwood-isle/puffer-complete-remaster/local-surface-repair/`.
The selected source and all previous attempts remain untouched. No runtime,
render, browser, build, animation, visual-quality or aesthetic approval is claimed.

## What was changed

`build_candidate.py` uses the three disks from the independent crossing diagnosis.
It solves a discrete harmonic surface inside each fixed boundary, retaining explicit
cheek, lower-flank macro and cavity-depth anchors. This is a local vertex-position
solve, not a global remesh or new pouch. There is no trajectory compensation,
face removal, hidden triangle, face-index reversal or material/normal flag trick.

Only 29 welded interior vertices move, changing 81 of the 139 permitted hull faces.
All 883 outside hull faces are exact, as are the other 58 envelope faces. Boundary
coordinates, all non-hull anatomy, eight bone pivots, skin weights/indices, paint,
fur values, face order and semantic face ownership remain exact. A full seven-part
native file is provided, not a shell or isolated patch. Its source SHA is pinned
in the producer; regenerating native and GLB produces identical hashes.

## Results and why this is not accepted

- Proper transverse hull crossings: **21 selected → 0 candidate**, native and
  float32. The independent plane-section test includes shared-vertex pairs.
- Additional contact checking finds **four coplanar hull overlaps and four
  nonincident vertex/face contacts**, in both precisions. These involve unchanged
  hull faces 1009–1013, outside every approved stencil. `scope-blockers.json`
  verifies the same defects in the untouched selected source. The largest
  projected overlap is about 1.038e-8 square source units. They are small but are
  reported, not waived or hidden by an adjacency exclusion.
- No nonincident edge/edge interior contacts found at the documented tolerance.
- All individual edge-connected components retain closed, oppositely directed
  two-face edge incidence, vertex-link manifoldness, nonzero triangle areas and
  positive signed volume in native and float32 precision.
- The unchanged recessed-palate part contains two exact point contacts between
  separate closed components. Welding the entire part by position gives two
  two-cycle vertex links; individual components remain manifold. This is reported
  separately and is not misrepresented as a newly introduced manifold defect.
- **19 corresponding geometric face normals reverse hemisphere** through the
  local vertex motion (minimum dot −0.99114). Face indices and normal flags never
  reverse, but this still fails the requested no-normal-flip preservation gate.
- Hull volume: 1.20465634945 → 1.20277834366, a **0.155896% decrease**. Exact volume
  is not preserved. Maximum local vertex movement is **0.145178 source units**.
  This can visibly change local facial form and requires review; it is not
  dismissed on the basis of small total volume change.
- All **4,102 sampled exterior support directions** are identical, including the
  six axes. This preserves tested convex supports, not every view-dependent
  silhouette, local concavity or painted contour.
- All original finite spike, tail and fin root samples remain inside; their
  maximum signed distances are unchanged. This is not continuous or animated
  seating certification.
- Actual GLB attributes, names, single-sided material, colors, skin and bind
  hierarchy pass **46/46** round-trip checks. GLB size is **636,280 bytes**.

## Files and reproduction

Within the candidate directory:

- `local-repair-native.json`: full editable, explicitly unaccepted candidate.
- `local-repair-study.glb`: complete single-sided float32 export.
- `build_candidate.py`, `construction-receipt.json`: bounded solve and source pin.
- `intersections.py`, `validate.py`, `validation.json`: independent geometric
  predicates, both-precision checks, preservation, support and root measurements.
- `verify_scope_blockers.py`, `scope-blockers.json`: original-source comparison
  for the newly detected out-of-stencil contacts and component distinction.
- `export_glb.py`, `audit_glb_roundtrip.py`, their receipts and `reproduction.json`:
  deterministic export and actual binary round-trip evidence.

Run from repository root, with `D` set to the candidate directory above:

    OPENBLAS_NUM_THREADS=1 python "$D/build_candidate.py"
    OPENBLAS_NUM_THREADS=1 python "$D/export_glb.py"
    OPENBLAS_NUM_THREADS=1 python "$D/audit_glb_roundtrip.py"
    OPENBLAS_NUM_THREADS=1 python "$D/validate.py"
    OPENBLAS_NUM_THREADS=1 python "$D/verify_scope_blockers.py"

`validate.py` writes all results and the explicit `allGatesPass: false`; it does
not silently skip failed gates. Contact tests use 1e-9 distance and 1e-12 projected
coplanar area tolerances, not exact arithmetic certification. Proper intersections
use the independent diagnosis predicate, not the earlier shared-vertex-skipping
producer audit. Normal-hemisphere, volume and contact failures remain visible.

## Boundary of this attempt

The three provided disks suffice to remove the diagnosed 21 proper crossings,
but cannot establish a fully non-self-contacting hull while all outside faces
remain exact: the newly detected coplanar region is outside those disks. Do not
admit this candidate, stretch the scope silently, compensate the volume elsewhere,
or delete the evidence. Any next repair needs a reviewed local envelope for the
1009–1013 contact region and a more shape-preserving construction inside the
current disks. Matched real views remain unrun under the active host lease.

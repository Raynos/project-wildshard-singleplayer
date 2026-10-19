# Selected Conch: bounded geometry admission candidate

## Decision and scope

The latest independent paired review narrowly retained **complete-pass2**, with its fuller face. This work starts from that exact retained source and GLB. It does not substitute the rejected complete-character-refinement, rescore unchanged art, supersede conflicting historical reviews, or grant visual/runtime acceptance.

A separate diagnostic candidate corrects **four proven source sweep defects**. The complete editable source is `art/driftwood-isle/approved-conch/selected-geometry-admission/build_selected_conch.py`; its local audit helper is `geometry_checks.py`. The frozen GLB is `conch-study.glb`. No production or shared runtime source is changed.

## Source failures retained

Audit occurs before mirroring and the source's inherited normal recalculation. The exact selected baseline has:

- Raised breast -1: 3 opposed side triangles, 3 opposed strip pairs; minimum radial cosine -0.9564138.
- Raised breast +1: 4 opposed side triangles, 2 opposed strip pairs; minimum -0.8832837.
- Shoulder armor -1: 1 opposed side triangle; minimum -0.0048689.
- Shoulder armor +1: 1 opposed side triangle, 3 opposed strip pairs; minimum -0.9116371.

`baseline-source-sweep.json` records original source polygon indices. `baseline-source-indexed.json` preserves indexed geometry. Merely switching those four sweeps to continuous transported frames still fails; `rejected-transport-only-sweep.json` preserves that result, and `prepare_rejected_transport.py` reproduces that rejected source without overwriting the corrected source.

## Exact bounded change

Only these four sweeps use transported frames. Centerlines, section counts, flute, connectivity and material assignments stay fixed. A bounded radius solve shrinks the two inner breast stations to 0.60 of original on authored side -1 and 0.69 on +1; both terminal breast radii stay unchanged. Shoulder station scales are `[1,1,.97,.98]` and `[1,1,.98,.97]`. These shrinkages are structural corrections, not a claimed visual improvement; they require independent whole-character review.

Every changed mesh has exactly 21 changed source-indexed points and 43 geometry-derived polygon normals. **All original source polygons, triangulated source connectivity and material assignments remain exact. All 47 other meshes remain exact**, including the fuller cranium, cheeks, jaw, eyes, shell and shield. No new winding repair, forced normal flips, cap triangulation, overlay extrusion, decimation, or surface deletion was introduced. The original whole-character mirror and existing normal recalculation remain unchanged.

`indexed-diff.json` gives every changed point and polygon normal, before/after. `glb-indexed-diff.json` compares exact retained and corrected GLBs. Exporter vertex/index ordering changes on the four altered meshes are explicit: resolving points back to original source indices proves the same oriented triangle multisets per material. The other 47 meshes' decoded attributes and indices are exact.

## Checks and limits

- All 36 final source sweeps have no opposed side triangles or strip pairs. Minimum radial cosine remains above 0.02.
- All 51 final meshes have zero proper nonadjacent intra-mesh crossings under the existing crossing check. Shared-vertex/coplanar contact and inter-mesh anatomical intersections are not covered.
- Seven source-gate tests and twelve native-contract tests pass. The native adapter is a separately pinned copy within this candidate directory; the shared exporter and existing codec are untouched. It handles 2,190 triangles, 6,570 expanded native vertices, 15 diagnostic parts/bones; no animation readiness is claimed.
- Exact native codec round-trip, malformed data rejection, pinned-input rejection, rest-preserving axes/pivots, derived hinge weights, geometry counts and reproducible native outputs are checked.
- The baseline's 21 **non-opposed** polygon/facet normal differences on shell/cranium caps remain exact; minimum cosine is 0.1021282. The stricter all-closed/unit-facet diagnostic still reports `passed:false`, preserved in both facet JSON files. That diagnostic is not the existing native contract: no defect is concealed by flattening legitimate cap shading. Native recomputed triangle shading can differ from Blender polygon shading.
- Eyes close as assembled socket/back/lens surfaces. Original open nostril/pupil/glint overlays stay unchanged. GLB double-sided materials are not a per-part packed-body field; actual native culling/visibility remains a runtime review requirement.
- Diagnostic bones are derived attachment stations, not an authored rig or verified animation. Native/GLB geometry tests do not establish movement, contacts, collisions, appearance, phone performance or production admission.

## Matched capture protocol

`render_matches.py` executes original hero and original nine-view lighting/camera/render code for both baseline and correction, with fresh scenes for each studio setup. Hero is 780×960 at 24 samples; nine views are 496×700 at 16 samples. Original complete-pass1 frozen camera matrices are reused exactly, as in pass2. Only optional `.blend` saving is suppressed. Raw PNG bytes are never modified or recompressed. All capture files and regenerated GLBs are hashed in `capture-receipts.json`; decoded capture GLBs are checked against frozen variants. Captures are for the parent's independent review, not self-scoring or runtime promotion.

No shared engine, AI, physics, public host, app build, browser, Git/Site publication or production assets were touched.

### Completed capture verification

All 20 actual PNGs are present and hash-verified. Both rebuilt capture GLBs decode exactly to their frozen baseline/corrected variant, including ordered indices and materials. Nine-view camera receipts match byte-for-byte and match selected pass2's retained cameras. Final capture verification recorded 14,418,324 bytes (about 13.75 MiB), below the 20 MiB budget; no `.blend` files. See `capture-verification.json`, `capture-receipts.json`, and `glb-indexed-diff.json`. This is ready for independent review only.

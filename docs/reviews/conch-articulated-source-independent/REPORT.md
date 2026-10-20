# Independent articulated Conch source review

2026-10-20. Source-only review of `art/driftwood-isle/approved-conch/articulated-source-candidate1`. No original asset, candidate source or test output was edited. No motion, physics, app build, Git/public write or quality score. This report is the only authored deliverable. Root retains checkpoint authority.

## Initial verdict: exact packed seam repair required

The new segmentation is explicit anatomical reauthoring, not a disguised dominant-weight reassignment. Its exact retained attributes, basis conversion, eight-owner budget and source-extreme recipe are independently verified below. **However, two claimed closed new hinge pieces are not closed in exact packed float32 geometry.** This is a concrete source-fidelity blocker, not a runtime penetration or visible-quality finding.

For the right hinge shin and ankle-cuff chunks, four edges each occur once instead of twice, with four directed-orientation mismatches. A nominally shared cut point becomes:

- x=.9138782024383545, y=.20029392838478088, z=.24089646339416504;
- x=.9138782024383545, y=.20029394328594208, z=.24089646339416504.

The gap is one float32 ULP at this magnitude, 1.4901161193847656e-8m. Opposite edge traversal in `clip` computes mathematically equal intersections with slightly different double arithmetic. `mesh_report` rounds positions to nine decimals before packing, so its closed-edge test conceals the eventual float32 split. It must not be treated as an exact packed seam proof.

Independent extraction: iterate construction.json changes in order, maintaining a separate corner cursor per owner. Unchanged row length is 3*sourceTriangles; changed row length is 3*(retainedSurfaceTriangles+newCapTriangles). Slice each chunk from its owner part; convert positions to float32; count exact undirected and directed position-tuple edges without rounding. Ten other new/changed chunks pass exact closure; only `Leg hinge 1:legRightKnee` and `Leg hinge 1:legRightAnkle` fail. All twelve changed chunks have positive signed volume.

Recommended narrow repair, communicated to root/writer: canonicalize original shared-edge endpoint order and compute each cut intersection with identical arithmetic for both traversal directions and split owners. Retain the failed bytes. Add exact packed closure and shared-seam identity regressions, not a widened epsilon, snapped arbitrary envelope, normal change or contact tolerance. Revised bytes require a separate pin and recheck; this initial verdict does not cover future corrections.

## Reviewed initial corrected-identifier freeze

These are the inspected bytes after the content-addressed identifier correction, before the new seam repair. The original checkpoint and identifier failure remain preserved by the writer/root.

| File relative to candidate directory | SHA-256 |
| --- | --- |
| generate.py | 77ead9c8d44df36ede9efc49b4111d69f1e9b65da86f82ce8df844e7ee6352bf |
| model.json | 727d2f3c343f33e9b132304eb0e2ad159a2b9f6f5046289ba71c3b571857f765 |
| metadata.json | 2a863362e98b272ff03107bf5ff30b90e99b2236bcb0aa36c0a80b80ec8ffc05 |
| payload.bin | d116f65ae2a70b605d82c7fe924ddfbaf8fd06be588016ac3130c06f468f5eb9 |
| recipe.json | 2dc438caca6a3396e48f9ae51a600c83a7cbf97ebd5ffd4a7654e7b8b14e5ed0 |
| contract.json | 37e10f67124db7c7e43eb5670643036ed8153a074314789cd030ca66553d6952 |
| construction.json | 336bd05306101b6db9bbdbf1edbd4643388abdfd232f1a2fc5685584fd7b055f |
| freeze.json | d47912fb70d156826d8e92953addd7ba596165d286b9d4aa3e6eba10c7e7d597 |
| test_source.py | a5a3f4581095bfdf0eb8d0f9835432adf8c9f397831be652bef82c7638194550 |
| native.test.ts | 221eb37839494e96a5ab5f376ec9384817cd640cadb92afffd821699ac1b15f5 |

All six output hashes and the generator hash match this freeze. The actual selected predecessor remains source SHA256 `3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929`; original geometry and the rejected rigid-leg motion remain separate, unchanged references.

## Independently established source facts

- Candidate has 7,194 expanded corners / 2,398 triangles, versus selected6,570 /2,190. Eight rendered owner parts retain fifteen bind joints.
- Exactly5,802 unaffected corners retain their original ordered positions and normals under B=diag(-1,1,-1), and original linear colors exactly. This is attribute equality, not unchanged skin ownership: upper-body components have deliberately been regrouped into fixed assemblies.
- All51 original source mesh names are accounted for by the construction stream. The affected original768 corners comprise both continuous hinges264 and feet/toes504. New affected geometry totals1,392 corners:1,032 retained/split exterior corners plus360 new cap corners.
- Both hinges are segmented from geometry-ring labels, not skin maxima. Source ring stations are identified by nearest original hip/knee/ankle station, with exactly eight distinct source points per ring. Continuous intervals[0,1], [1,1.9], [1.9,2] partition the original strip; the ankle seam is explicitly proximal to the ankle, not falsely described as the original ankle ring.
- The hinge results contain152 exterior triangles and96 new cap triangles. Source inspection supports conservation of old exterior by clipping each source triangle into complementary intervals; the writer's area test is a source calculation, not an articulation/collision proof. The original94 blended corners are replaced through this declared segmented geometry and rigid ownership; their old weights are not secretly reassigned on an unchanged hinge.
- Feet/toes are explicitly intersected with y>=0. They contain192 retained/split exterior triangles and24 new sole caps. Below-plane tips really are removed, not lifted or retained in a hidden collider. This intentional silhouette/geometry loss is disclosed, not an assertion that all original tissue survives. Unaffected toes can produce zero new cap triangles.
- All120 new cap triangles have normals aligned with their actual geometric face normals: independently measured cosine range[.9999999999999997,1.0000000000000002]. They are new geometry/material samples. Original untouched normals are not renormalized. New split attributes interpolate source attributes; cap centers inherit averaged boundary color. Packed vertex colors/normals do not preserve Blender shader roughness or per-primitive double-sided behavior by themselves.
- Both ankle parts reach exactly y=0; every other part has positive minimumY. There is no root translation, hidden collider padding or source-wide lift. This is bind-pose geometry, not an admissible foot-contact motion or guarantee about cap/armor overlap after bending.

Independent verification decompressed payload.bin and checked every stored f32/u16 attribute of all eight parts against the corresponding cast of model.json. Bones match the metadata. The corrected metadata file identifier ends in the actual compressed payload SHA256. I have not yet run the native consumer against the pending seam repair; prior tests/receipts remain the writer's evidence, not an independent run.

## Basis, ownership and support

B=Ry(pi)=diag(-1,1,-1) is a proper rotation with determinant+1. All preserved positions/normals, all fifteen absolute bind pivots and the recipe coordinate conversion consistently apply it. New positions/caps are produced in source coordinates and then converted. Source -Z becomes actor+Z; original Left maps to actor negativeX, rapier to actor positiveX, as the contract explicitly states. There is no root-facing offset in this source. Future rotations must follow B*R*B^-1, not reuse old Euler values without conversion; no motion programs are present to verify yet.

I independently rebuilt exact hull extremes from each part's float32-rendered positions and subtracted its converted global bind pivot. Every ordered recipe coordinate matches. Counts are body70, rapierArm40, left thigh32/shin32/foot47, right thigh34/shin29/foot49:333 total, maximum70, eight unique owners. All are original candidate surface points, including the intentionally new surface caps/cuts, not arbitrary synthetic support points. No hull budget increase or point padding appears.

The rigid contract explicitly fixes shell, head, both eye branches, shield upper/forearm and rapier forearm. Body owns torso/shell/head/eyes/whole shield; rapier shoulder owns the complete weapon arm. Six leg owners independently carry thigh/shin/foot segments. Every candidate corner has one weight1 on its declared owner; no positive influence is dropped at runtime. This makes a coherent conditional support model possible, but says nothing about aesthetically acceptable loss of head/eye/shield/elbow motion or acceptable articulated seams.

The body hull volume is6.695396606558937m^3. It encloses the broad torso/shell/whole-shield assembly. Although mathematically rigid under this contract, that envelope creates substantial collision bridges and cannot be accepted as meaningful anatomy or finite-obstacle behavior solely because its point count fits. The writer explicitly leaves this tradeoff open. No automatic source redesign or boundary-equality requirement follows: the independent Iguana correction still permits concave render geometry inside a coherent convex proxy.

## Remaining admission boundaries

Native dimensions were changed and remain diagnostic, including bodyRadius .5285780711819618, bodyHalfLen .3338400900363922, headRadius .4168165250961169, capsuleAxisZ. These are not an actual living hit-volume coverage or motor-clearance proof. The source does not authorize using them as accepted gameplay dimensions.

After the exact seam repair is frozen, recheck its packed topology and run the existing consumer only with root's lane clearance. Still required: independently reviewed meaningful assembly/segmentation tradeoffs, explicit safe knee/ankle/hip articulation range, seam gap/armor overlap review, full actor-aligned native source admission, authoritative contact-capable motion and actual runtime/physics tests. No source-only pass supplies motion quality, ground support during gait, weapon alignment, death/loot, defeat/Retry/reload, persistence or physical-phone performance. No app/public promotion is approved here.

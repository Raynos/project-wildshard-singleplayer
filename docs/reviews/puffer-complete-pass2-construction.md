# Puffer complete pass 2: construction and limits

Status: frozen unaccepted static candidate; all twenty matched captures complete, awaiting independent visual assessment.
No runtime, Site, physics, collider, animation, or admission-gate changes.

## Reference and measured intent

Authoritative pixels: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`, 1024×1536. The large left specimen is the principal proportion reference; the gameplay specimen demonstrates the inflated pouch. The tiny generated rear views do not establish exact hidden anatomy.

Approximate hand-read image-space landmarks on the large left specimen:

- Teal crown apex near (288, 474); descending face roof near (423, 578).
- Main cream pouch spans approximately x=212–465 and y=623–777.
- Dominant crown tip near (283, 412); large left shoulder spike near (183, 454).
- Visible front-left fin footprint approximately x=82–220, y=765–826.

These are visible projected landmarks, not calibrated 3D measurements or camera-independent ground truth. They motivate a stronger crown-to-face descent, a genuinely inflated lower-front mass, and bold spikes seated in the shoulder. No exact reconstruction of the unseen surface is claimed.

The fresh prior paired assessment preferred V71 to the first complete assembly. Therefore this candidate starts from V71, preserving its angular brow/beak geometry, complete head arrays, four broad wedge-tipped fin parts, and all eight bone definitions exactly. The first complete assembly supplies only its thicker cream-bordered tail. This is a new complete rendered candidate, not a claim that selecting individually preferred components guarantees improvement.

## Substantial geometric work

The body is changed in native coordinates with a deterministic continuous authored volume map. Crown mass behind the eye line rises while the upper-front roof descends. The flanks expand, and the lower-front pouch expands sideways and forward with a modest lower bulge. This is not the old ≤2 cm local rail proposal:

- Main closed hull volume: 1.0566597766 → 1.2237031777 source units cubed, +15.8086%.
- Maximum hull-vertex displacement: 0.12880535 source units.
- Main hull retains 1,022 triangles and its exact edge connectivity; no claim of longitudinal rail retopology.
- Forty-four rear cheek triangles change from orange to teal. Teal regions use a coherent field rather than the old threshold bands; no random paint noise is added.
- Existing eight spine locations and their crown/shoulder hierarchy are retained. Shoulder and flank wedges have wider roots and stronger tips; roots are seated against the actual changed hull.

Editable source: `art/driftwood-isle/puffer-complete-remaster/pass2/build_candidate.py`.
Complete rig-ready native source: `art/driftwood-isle/puffer-complete-remaster/pass2/pass2-native.json`.
The native file retains the original seven semantic mesh parts and eight-bone architecture. It is a static source study, not an admitted runtime asset.

## Attachment and topology evidence

`construction-receipt.json` records immutable source hashes, actual hull volume, each edited spike's indexed vertices/faces and sampled signed root clearance, exact-preservation assertions, and the candidate hash. All eight spike root corners, pairwise midpoint samples, and root centroids are at least 0.004 source units inside the new hull. The former crown-spine 1/7 sampled exposures are specifically addressed by reseating their roots; this does not prove continuous overlap or animated attachment.

The reused tail's original proximal cap samples have maximum signed distance −0.07141401. `fin-root-audit.json` samples each unchanged fin's authored highest proximal ring, all pairwise midpoint samples and centroid against the actual new hull. Maximum distances: front left −0.07317721, front right −0.07327028, both rear −0.03249336. All sampled roots are inside. These checks neither establish continuous cap containment nor rule out all intersecting surfaces.

`audit_topology.py` reruns exact-coordinate connected-surface checks without welding or repair. The main body and edited spikes remain closed/oriented. Full-model topology preflight still FAILS: four unchanged head components contain 7, 2, 2 and 2 triangles, corresponding to the previously diagnosed single-sided palate, tongue and nostril inlays. No waiver is introduced. Runtime material/culling behavior remains untested.

Native JSON exceeds the historical one-million-byte raw-asset cap; no runtime-size admission is claimed or cap raised. The source retains full exact floating-point arrays so that unchanged identity components can be compared exactly. A separate actual GLB export (`pass2-study.glb`) is 626,380 bytes and retains all 10,293 vertices, seven parts, eight joints and skin weights. `glb-roundtrip-audit.json` verifies 46/46 attribute/bind/material/size checks against the native source. Its native arrays are converted only to IEEE float32; `glb-validation.json` reports zero errors and zero warnings. This meets the file-size ceiling without implying geometry/runtime acceptance. `export_glb.py` is the reproducible bridge; it preserves the single-sided material rather than concealing the inherited open inlays.

## Capture and review

`render_matched.py` uses actual frozen native positions/colors with identity transforms. It produces V71 and pass2 under exactly the same ten cameras, materials, three lights and Cycles settings: 600×740, 24 samples, no denoising, AgX. Hero scale is 3.2; the complete nine standard views use 4.2. No camera-dependent geometry, selected-view substitute, or mockup is used.

Independent assessment must inspect the approved original first and all ten actual candidate views, then compare retained V71. Construction metrics are not likeness credit. This author assigns no score, acceptance, or predicted threshold result. Historical V71 3.60 and the later paired 3.8625 assessment remain distinct; the first complete assembly's 3.65 rejection remains preserved.

## Capture closure

All twenty actual captures completed in the shared heavy build lease (185.98 seconds). Full-resolution previews preserve 600×740 framing. `output-closure.json` verifies twenty captures, ten views per candidate, native/script/raw/preview hashes, matched cameras/targets/scales, and preview size caps. All ten pass2 raw frames were directly inspected for capture completeness. Portrait comparison/contact sheets are overviews; the separate full-resolution frames are authoritative for review. Horizontal flank bands remain visible, so the report does not describe that issue as solved.

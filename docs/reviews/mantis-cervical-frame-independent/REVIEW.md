# Independent Mantis cervical-frame review

## Verdict

**Neither model meets the 4/5 likeness target. Candidate: 3.670/5; exact complete-pass2 predecessor: 3.670/5. No rounding.** The repaired candidate is narrowly preferable for local neck-to-skull continuity, but there is no material global likeness gain or regression. Hero is its strongest view; the elevated front hides too much neck to establish full-model likeness.

Independent scores for both: silhouette **3.6** (35%), face **3.7** (30%), details **3.8** (20%), facet language **3.6** (15%). These are newly assigned, not transferred. The historical 3.935 was read only after scoring was frozen and every baseline frame inspected. I disagree with that more generous overall assessment: the long curved neck, low horizontal abdomen, broad planar leaf fan and broad facial planes warrant material deductions against the approved concept. A sub-4 original cannot make its repair pass by inheritance.

## What changed visually

At full-frame scale, hero, frontal, rear and top changes are minimal. Side and elevated-side views show a slightly fuller, more continuous terminal throat/collar under the skull. The predecessor has a more exposed terminal ledge/dark break. The candidate keeps the outer neck arch and pointed skull intact. I see no new gross detached-head appearance, conspicuous new gap or damaging collar bulge. The long pale zigzag underside and overlapping bark ribbons remain; the repair does not solve the broader proportion mismatch.

Static visible anatomy is not articulated-anatomy acceptance. The packet reports incident skull intersections changing 33 to 24, with new rear-collar counts 10 and 12 and throat count 8. Those disclosed overlaps cannot be dismissed merely because these views look coherent. Motion/deformation, collision/contact and combat readability remain untested. Zero reported opposed normals and native/source correspondence do not establish visual acceptance.

## Method and evidence

Read approved original first; inspected all ten candidate full 638×900 PNGs individually; froze `rubric-frozen.json` and candidate scores before any predecessor images, author claims or historical scores; then inspected all ten baseline PNGs individually. Rear/top views establish coherence rather than invented exact correspondence with an unseen concept angle. Per-view observations are in `review.json`. No boards/crops replaced full-image inspection.

Independent read-only `verify.py` passed all **22 input pins**, all **20 raw PNG hashes/dimensions/byte sizes**, and every pair's camera and settings equality against the common manifest. Renderer source was inspected: shared union-bounds cameras, common nine-view orthographic scale, separate shared hero, Cycles 20 samples, seed 0, no denoising, AgX, identical three lights and ground. This verifies present artifacts and receipts, not a newly executed render.

Candidate rebuilt GLB is byte-exact to frozen `f2c8a05301e00f0cb2c41dc0efe67c1ed162f606ee8aecf7f1446a317165fd67`. Baseline frozen `3566ee1301fd6461d59ff5627ae922856f952667310f6d36463c2ff706927604` versus rebuilt `eb5ca75ade327ae8c0eeb1cdae3166e65b0cbdea3f7be9b63e626f0d15798100` differs in exactly the recorded 90 material/mesh `.001` suffixes: all remaining JSON and binary chunks are identical. Both portable meshes and metrics match their frozen inputs. Full hashes and check scope are in `verification.json`.

No source edits, new captures, caches, renders, builds, Git operations or promotion were performed. Only this review directory was written.

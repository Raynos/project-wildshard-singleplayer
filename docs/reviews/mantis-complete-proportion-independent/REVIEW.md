# Mantis complete-proportion: independent static review

**Best of the two exact reviewed assets: complete-proportion-study. Likeness 3.915/5, below 4. No visual acceptance. Animation remains unaccepted.**

## Method and frozen judgment

Opened the approved original `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp` first. Viewed each full candidate PNG individually: hero, front, left, right, back, top, diag-front, diag-left, diag-right, diag-back. Wrote `frozen-candidate.json` before opening predecessor images, evidence receipts, source, or prior scores. Then inspected each of the ten matched cervical-frame-repair predecessor PNGs individually. No prior review score was read or transferred. Original/reference UI and background receive no credit.

Weights: silhouette 35%, face 30%, details 20%, facet treatment 15%. Candidate category scores: 3.9 / 3.8 / 3.9 / 4.2. Exact weighted result: **3.915**. Fresh predecessor scores: 3.7 / 3.6 / 3.8 / 4.2; exact weighted result **3.765**. Candidate lead **0.150**, with no rounding to a pass. This establishes best only within this exact pair, not every historical Mantis study.

## What improved and what still defines the gap

The candidate's less crowded, more pointed leaf fan, tighter forward reach, longer tapered mask, and lifted abdominal taper improve the complete reference gesture. Hero is the strongest likeness view. The front and elevated-front show a clearer face/leaf balance. Side views remain the decisive weakness: a long, smoothly arched cervical beam dominates a low horizontal body rather than the original's more compact, angular chest-to-head relationship.

Green eyes, twig antennae, wooden limbs and pale toothed sickles unmistakably identify this as the intended creature. The head still reads as a narrow planar mask with flat green panels; the original has fuller eye facets and a more integrated brow/cheek volume. Repeated kite-like leaf construction and conspicuous straight brown ribs feel more engineered than the original's irregular folded leaf masses. Sickle outer arcs and sparse large teeth simplify the original's jagged rhythm. Regular paired limbs and thorax plates also soften its splintered character. These are defining-feature limitations, not requests to add arbitrary microdetail.

`review.json` records a separate observation for each matched view. The reference offers two stylized poses, not orthographics. Back and top coherence can be reviewed, but exact hidden-side likeness cannot be established. Blade/head overlaps in elevated side views are projection ambiguity, not proof of collision. Numerical precision prevents threshold rounding; it does not make aesthetic scoring objective.

## Evidence closure and limits

`verify.py` rechecks input/file/raw PNG hashes, PNG dimensions/lengths, paired cameras and all recorded lighting/render settings. It compares frozen and captured GLB, mesh JSON and metrics bytes; independently executes the inspected geometry audit functions with all top-level producer code excluded. It does not render, rebuild, touch source assets or run the application. Exact results are in `closure.json`.

Both assets contain 89 mesh objects and 3,052 triangles. Candidate source/GLB position/material/triangle correspondence is exact; topology has zero boundary/nonmanifold edges or degenerate triangles. No opposed stored normals and no nonadjacent self-intersection parts were found. **639 candidate triangles deviate from geometric facet normals at cosine <0.999**, versus 595 predecessor triangles. Minimum candidate stored-normal/facet cosine is **0.1775645656903133**, although minimum stored-normal/source-polygon cosine is **0.9999999968575035**. These are nonplanar source-polygon shading differences, not an all-facets-flat guarantee. Layered cross-object intersections remain; static topology does not approve articulation or contacts.

No exact complete-proportion native payload exists in the supplied study. The older complete-pass2 native data cannot establish this candidate's native-normal closure. Source/GLB static closure passes; exact native closure and animation are **not established**. Recorded rebuild equality is byte-verified against existing outputs, not independently re-rendered or rebuilt by this reviewer. Tests earn zero visual points.

Writes are confined to this review directory; no Git operations, source/engine changes, browser, build, render, or generated images/caches.

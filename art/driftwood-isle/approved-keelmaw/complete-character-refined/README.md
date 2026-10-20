# Keelmaw complete-character refinement

One fresh complete editable source revision derived from retained `complete-character-next`, 20 October 2026. Source-only WIP for independent review. No self-score, visual acceptance, runtime promotion, native animation acceptance or contact acceptance.

## Scope and target

The authoritative approved hero and supporting corrected Explorer sheet were inspected before editing, together with the actual previous hero/top renders and `docs/reviews/keelmaw-complete-independent/REPORT.md`. The World sheet was also inspected as supporting evidence. The original hero remains authoritative; AI hidden-surface anatomy and camera conventions remain approximate and contradictory in places.

The complete revision changes torso cross-sections to emphasize shoulders and narrow the rump; thickens forelimbs relative to rear limbs; shortens all head/jaw geometry coherently around the retained rig pivot; deepens the ivory cheek/jaw; places smaller eyes inside a slanted brow aperture; smooths and continuously tapers the swept tail with a pale underside; and replaces the regular dorsal gold rails with body-normal armor patches and selected asymmetric crest accents. Tail armor uses its actual sweep tangent rather than world-aligned gold crossbars. This is an authored anatomical attempt, not a claim of likeness improvement.

The original 19 named bones, parent hierarchy, bind positions and 19-part contract remain unchanged. Rigid single-bone component skinning remains. Mesh components are closed individually, not welded into one animal. No physics recipe, collider, pose authority, root lift, solver, engine, admission or gameplay code changed. Existing dimension metadata is an unadmitted placeholder, not newly validated contact coverage.

## Files and evidence

- `build_keelmaw.py`: complete final editable producer.
- `capture_baseline.py`: retained complete-character-next geometry, with only an evaluated-camera update before the projection measurement. Baseline geometry is not the old initial v1.
- `model/`: native source, GLB, packed native payload, metadata, construction and source audit.
- `review/`: twenty labeled compact views, paired hero and nine-view boards, hash-pinned capture receipt.
- `verification.json`: source contracts, test and storage checks, exact evidence pins and limits.
- An initial full capture with an over-occluded eye aperture is retained with its exact producing source under `tmp/keelmaw-complete-refined/aperture-occluded-first-captures/`. A second solid-socket capture is likewise retained under `solid-socket-occluded-captures/`. Both exposed a construction error: a solid dark socket obscured the iris. The final source replaces it with a closed annular recess with an actual opening. These intermediate captures are superseded, not scored or presented as the final candidate.
- Raw PNGs and logs remain outside Git under `tmp/keelmaw-complete-refined/`.

Both producers use the same ten explicit cameras, lighting, ground, 600×720 raster, 32 Cycles samples, target and orthographic scale. The dependency graph is now updated before producer projection. Independently computed `audit_framing.py` bounds remain authoritative, rather than the INVALID historical complete-character-next pre-render bounds. Producer-vs-independent bounds differ by at most 0.016 pixels at the near-vertical top camera (float32 track-quaternion versus explicit orthographic frame); all other views are below 0.0002 pixels. An initial arbitrary 1e-5 NDC comparison failed only there. The reproducibility check uses a disclosed 0.1-pixel comparison tolerance, while independent strict all-vertex containment and 31.9+ pixel candidate margins remain unchanged. There are no per-image crops, image warps or AI-render substitutes. Actual source meshes are rendered; this is not in-game evidence. Low-angle ground/background boundary and render grain are retained for honest matched comparison.

`audit_source.py` validates exact float32 native/GLB corner position, color, rigid skin joint and oriented-triangle multisets; exported normals against geometric winding; nine numerical single-sided visibility sets; single-sided materials; positive closed manifold components; nonzero triangle areas; and inverse-bind closure. `source.test.ts` exercises the actual packed native consumer and compares all attributes and absolute binds. These checks do not establish deformation, contact, collision coverage, natural motion, combat or performance.

## Reproduce

From repository root, use installed Blender only:

    WS_HEAVY_ROOT="$PWD/../heavy-lanes" PYTHONDONTWRITEBYTECODE=1 python3 scripts/heavy-lane.py build -- blender -b -t 2 -P art/driftwood-isle/approved-keelmaw/complete-character-refined/build_keelmaw.py -- --out tmp/keelmaw-complete-refined/final --render
    WS_HEAVY_ROOT="$PWD/../heavy-lanes" PYTHONDONTWRITEBYTECODE=1 python3 scripts/heavy-lane.py build -- blender -b -t 2 -P art/driftwood-isle/approved-keelmaw/complete-character-refined/capture_baseline.py -- --out tmp/keelmaw-complete-refined/baseline --render
    python3 art/driftwood-isle/approved-keelmaw/complete-character-refined/audit_source.py tmp/keelmaw-complete-refined/final
    python3 art/driftwood-isle/approved-keelmaw/complete-character-refined/audit_framing.py tmp/keelmaw-complete-refined/final
    python3 art/driftwood-isle/approved-keelmaw/complete-character-refined/audit_framing.py tmp/keelmaw-complete-refined/baseline
    node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/approved-keelmaw/complete-character-refined/vitest.config.ts
    python3 art/driftwood-isle/approved-keelmaw/complete-character-refined/make_review.py

No packages installed, Mac/browser used, shared index changed, commit created, remote pushed, or Site published by this worker. Existing sources, assets and unrelated work are preserved.

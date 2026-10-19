# Mantis complete-pass2: independent static review

## Verdict

**Retain complete-pass2 as the better static study, but do not accept or promote it.** Its original-first score is **3.935/5**, below the exact 4.0 gate. Structural/provenance checks pass within the limits below; those checks cannot raise the art score or grant runtime/animation acceptance.

Read the approved original and every candidate full PNG before construction source, baseline imagery or other reviewers. The original-first judgment is recorded unchanged in [frozen-initial-judgment.md](frozen-initial-judgment.md). No prior reviewer report was used. Then inspected every corresponding actual baseline PNG, not just a board or claimed gain.

## Original-fidelity rubric

Scores are whole-model judgments, not view averages. Weights: silhouette/anatomy 35%, face 30%, details 20%, style 15%.

- Candidate: **3.8 / 4.0 / 3.8 / 4.3** → **3.935** exactly.
- Baseline, independently judged after candidate freeze: **3.6 / 3.8 / 3.7 / 4.3** → **3.785** exactly.
- The candidate's local comparative improvement is 0.150; it does not remove the absolute gate failure. No rounding to 4, averaging reviewers, or importing gains from another review.

Both preserve the leaf-backed wood mantis identity, green eyes, antenna tips and cream saw edges. Candidate's curved neck and reduced chest/cheek bulk are closer to the original's predatory organic sweep. Neither fully achieves the original's articulated forearm mass, clean integrated throat and convincing transitions between anatomy and bark plates.

## All-view comparison

Each row refers to individual 638×900 PNGs under `tmp/mantis-complete-pass2/{candidate,baseline}/`, viewed at full source image size through the image viewer.

- **hero:** candidate's arched neck and tucked face improve the overall creature read. Baseline chest is bulky and straight. Candidate still has thin angular arm rods and a large fan of leaves.
- **front:** candidate reduces the baseline's paired cheek/chest slabs, but the central cream throat remains narrow and rod-like. Both have a symmetric mask-like face and broad cutout teeth. Candidate foliage overlaps behind the head more heavily.
- **back:** baseline's four leaves leave a clean central spine channel; candidate's overlapping leaves hide much of that channel. Candidate's asymmetric layered fan is closer to organic foliage, but this is not an unqualified improvement in readability.
- **left:** candidate's curved cervical silhouette is a substantial improvement over the baseline's straight rising beam. Final root visually joins the neck. The thin edge-on scythe and straight narrow upper arm remain visible weaknesses.
- **right:** same curved-neck improvement; candidate's head reads less broad and helmet-like. The pale strip beneath the neck still reads as a separate element; blade thinness and blocky abdomen persist.
- **top:** both clearly expose four walking legs and two forelimbs. Candidate leaves overlap into a larger continuous mass; baseline is more spatially separated. Neither overhead view alone establishes inter-part clearance.
- **diag-front:** candidate has a narrower, less buried face, with a more congested leaf backdrop. The blades retain a recognizable hook but large simplified teeth.
- **diag-back:** candidate has a slimmer curved neck outline; leaf overlap masks the base more than baseline. Both retain a bulky angular rear body and comparatively simple feet.
- **diag-left:** candidate loses the baseline's overly straight bulky chest beam and achieves better predatory curvature. Angular arm elbows and broad leaf planes remain prominent.
- **diag-right:** candidate's curved chest and smaller facial shell are better integrated overall. The retained candidate is still a static study, with slender arm links, exposed pale throat and heavy rear fan.

## Evidence and closure

[closure.json](closure.json) records **42 independent checks, all passing**, including recomputed file hashes, all 20 raw frame hashes/dimensions, preserved input hashes, camera identity and full geometry projection fit. [check_closure.py](check_closure.py) is reproducible and writes only this review folder.

- Candidate source SHA-256: `ec5645e1dda1aa88df12043f2361e39b98291544e2588314d9ce628b0349fb0e`.
- Candidate GLB SHA-256: `3566ee1301fd6461d59ff5627ae922856f952667310f6d36463c2ff706927604`.
- Final raw/art candidate GLB bytes are equal; JSON mesh/metrics values are equal, allowing the documented terminal LF. Raw/art camera values are equal. The renderer source uses the same camera transforms for both models, a common nine-view union scale, common lights/world/AgX/samples, and a separate matched union-fitted hero scale. All mesh vertices fit all 20 frames under independently recomputed projections.
- Historical pass1 GLB SHA-256 is `fdb5872d81e9b6e59c3a08bf4d23c064e87de1ea45e3c88d3a994fb356c29989`; rebuilt matched-baseline GLB is `0adddeb15f637766e68cfb237d4dd37509bac03e3bb1f0fe7fd9e8eb1eb5fb8b`. **They are not byte-identical.** Independent GLB parsing found exactly 84 material/mesh datablock-name differences, each the historic `.001` suffix. Removing only those names leaves identical JSON and identical non-JSON chunks. Historic/rebuilt portable mesh and metrics are byte-identical. This is bounded semantic/export equivalence, not historical GLB byte equality.
- Failed-root evidence manifests and all preserved raw frame hashes verify. Viewed the failed left PNG: the arm root visibly floats ahead of the neck. Its normalized published source differs from the exact captured source only in trailing whitespace, independently proven by string normalization and AST equality. Final source is exactly that normalized source with the one shoulder-root expression changed from `(s*.14,-.22,1.94)` to `(s*.12,.10,1.94)`. The failed attempt stays failed and preserved.
- Final source hash agrees with the execution provenance receipt. This review did **not** independently observe or replay the render execution; source identity is supported by the preserved receipt, correction comparison and output identity checks, not a fresh rebuild proof.

The inspected structural checker was replayed with its output confined here: [replayed-structural-preflight.json](replayed-structural-preflight.json). It passes 89 mesh objects, 20 static pivots and 3,052 triangles, checks exported GLB vertex sets against authored parts, finite accessors, indices and closed-edge/positive-volume properties. This is a replay of inspected checker code, separate from the independently authored hash/camera/AST/GLB comparison checks. It is not proof against intersections or all geometric defects.

## Required next improvement

Keep pass2's curved-neck/face gains and the failed attempt's provenance. Improve forearm mass and organic folded transitions, then integrate the throat into the chest silhouette and refine leaf layering/teeth toward the original. Reinspect the whole model against the original before any new comparative scoring. These are recommendations only; this review made no asset changes.

## Admission boundary

**No runtime, animation, rig, motion-contact, performance, collision or gameplay acceptance.** Existing mapping limits identify missing derived neck/abdomen joints, new unmapped neck parts and required parent changes. Static closed parts and a visibly seated arm root do not prove connected deformation or clearance during attack/walk. Existing V7 scores or admission cannot transfer.

No builds, renders, Git commands, remote writes, child agents, labels or product edits were performed. Writes were confined to this review directory.

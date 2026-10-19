# Splinter Mantis: independent complete-character review

2026-10-19. Static likeness and evidence review only. No model, image, production, runtime, native, rig, animation or gameplay acceptance.

## Result

Narrowly retain the actual complete-proportion-study baseline for visual likeness. Complete-character-pass improves the upright chest/head placement, but its short broad mask and laterally pointed eyes lose some of the baseline's tapered, predatory expression. The numerical difference is too small to describe as a decisive quality gap. Neither is a final likeness match.

The candidate score was frozen at **3.50/5 (70.0/100)** before opening any baseline image or previous review/evidence. See `blind-freeze.md`, which remains unchanged. Fixed weights: silhouette 35%, face 30%, signature details 20%, facet style 15%. Frozen component scores: 3.4, 3.1, 3.8, 4.0.

After inspecting all ten baseline PNGs individually, this reviewer's separate current paired baseline assessment is silhouette 3.3, face 3.4, details 3.8, facet style 4.0, weighted **3.555/5 (71.1/100)**. This is a new paired judgment, not a revision, normalization or replacement of any historical score. No historical judgment was edited. Structural test results earn zero likeness points.

## Method and per-view paired judgment

Approved original opened first: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`. Its large left Explorer figure is the main likeness target; the right action figure is supporting evidence. Neither supplies ground truth for unseen angles.

All ten candidate images were opened individually at full resolution before the freeze, followed by all ten baseline images at full resolution. These are the actual 638 × 900 PNGs under `tmp/mantis-complete-character-pass/{candidate,baseline}/`, not labelled derivatives or thumbnail boards. Inspection order for each: hero, front, back, left, right, top, diag-front, diag-back, diag-left, diag-right. Then the author evidence document and audit sources were read.

- Hero: candidate neck is closer to the reference's raised stance, but baseline's lower face better preserves the long tapered hunting expression. Small overall preference for baseline.
- Front: baseline has a clearer elongated triangular mask and less sideways-eye emphasis. Candidate's broader crown and short chin read more squat. Baseline preferred.
- Back: four-leaf fan, hip width and leg arrangement effectively unchanged; candidate's higher head/antennae are visible. No strong likeness preference from this unseen reference angle.
- Left: candidate removes the exaggerated horizontal arch, a silhouette improvement toward the standing reference. It also exposes a long rigid trunk and shallow face. Candidate neck placement preferred; baseline face preferred.
- Right: same split as left. Neither solves thin edge-on scythes or overly straight limb bars.
- Top: candidate head is less forward-reaching, baseline mask has more taper. Fan and appendage arrangement are substantially the same. Unseen angle has low confidence as a likeness discriminator.
- Diag-front: baseline retains a distinctly descending sharp mask; candidate's eye wedges dominate. Baseline preferred for expression.
- Diag-back: similar leaves, abdomen and limbs; candidate neck appears more upright. Too little reference support for a firm overall preference.
- Diag-left: candidate's neck posture improves standing-read; baseline has a more purposeful forward face. Mixed.
- Diag-right: candidate reduces the overextended arch, but baseline retains the sharper beak-like mask. Mixed.

Neither candidate warrants acceptance simply because the four walking legs, paired raptorial chains, leaf fan and antennae are complete. Those structures are necessary, and both possess them.

## Source, capture and geometry verification

`verify.py` is a read-only audit recheck. It removes only output `write_text` expression calls from the existing audit scripts in memory, executes the checks against the original input locations, and compares the entire recomputed results to stored audits. It does not rebuild, render or modify source assets. Bytecode writes are disabled. Its output is `verification.json`.

Verified:

- All 40 input pins match, including the approved original and pinned baseline files.
- All 54 evidence-file hashes and all 20 raw PNG hashes match.
- Both producer hashes match their capture receipts.
- Each frozen GLB exactly matches the corresponding already-rebuilt capture GLB byte-for-byte, stronger than non-name semantic equality alone.
- Both rebuilt mesh and metrics JSON files equal the frozen artifacts.
- All ten paired camera dictionaries and render settings match each other and `cameras.json`; all captured-view raw hashes match receipts. The renderer source derives cameras from union bounds, uses the same nine-view orthographic scale, and a separately fitted shared hero camera. Seed, samples, lights, resolution and AgX setup are shared.
- Recomputed geometry, scope and intersection audits exactly match stored full results.
- Candidate has 89 mesh parts, 3,052 triangles and 20 static pivot labels. Source/GLB position/material/triangle correspondence passes. Closed oriented per-part topology, positive signed volume, zero boundary/nonmanifold edges, zero degenerate triangles and zero opposed normals pass.
- Minimum candidate normal/facet cosine: 0.9999999075091911. No facet deviation below 0.999.
- 33 changed vertex parts; 54 protected parts retain vertex positions, colors, joint labels and exported triangle sets. Two other unchanged chest-splinter parts bring the total unchanged vertex parts to 56. No unchanged-part tessellation changes.
- Inclusive paired intersection scan reports zero nonadjacent within-part intersections; cross-object triangle-pair intersections remain 3,310 candidate versus 3,238 baseline. These are retained overlaps, not proof of safe contacts, articulation or collision behavior.
- Producer contains the seven-station cervical centerline and grouped head transform. Existing loop triangles are made explicit after normal recalculation, rather than selecting new surface diagonals. Some comments retain predecessor phrasing such as “horizontal cervical arch” and “narrow the complete cranial assembly”; geometry and paired images, rather than those comments, determine this review.
- Failed-topology-scope artifacts remain present and hash-pinned in the evidence manifest. Their existence is not acceptance of the failed attempt.

The already-rebuilt files and capture receipts were checked; this reviewer did not independently rebuild or rerender the producer. PNG provenance is established by those matching artifacts, audited capture code and receipts, not by independently recreating pixels. No native-engine parity, motion, rig mapping, gameplay or contact claim is made.

## Recommended next visual direction

Keep this candidate as an unaccepted alternate. Preserve the baseline as the narrow preferred actual likeness study. A subsequent deliberate revision could combine the candidate's more upright chest placement with a longer, narrower descending face and less laterally pointed eye silhouette, while giving the neck a more organic forward transition. This is a proposed direction, not an invented hybrid winner or an instruction to change the current assets.

# Colossus complete-pass3 independent static review

Reviewed 2026-10-19. **Candidate: 3.52/5 exactly; does not meet >=4. Retain complete-pass1 as the closer of the two actual matched candidates.** No runtime, animation, collision or phone-performance acceptance is granted.

## Judgment order and limits

I read repository/process requirements, the approved original and the capture receipt. I individually opened the full candidate PNGs in this order: hero, front, left, right, back, top, diag-front, diag-left, diag-right, diag-back. I then wrote `frozen-initial.json` before opening any predecessor image or construction prose. The original's large catalogue figure is the primary target; the smaller side/back depictions corroborate it. Its in-game pose is not a demand to copy the same pose.

I next opened all ten full predecessor PNGs individually in that same order, then examined receipts, source, cameras and construction prose. No contact sheet or compressed preview substituted for a full PNG. No prior independent scores were read. This is imperfect blinding: version names, role labels, receipt metadata and the task's description of preserved failure were visible. The initial candidate score has not been changed by seeing the predecessor or by engineering validation.

## Frozen candidate rubric

Scores out of five: silhouette/proportions 3.6 at 35%; face/expression 3.2 at 30%; defining details 3.8 at 20%; facet/style 3.6 at 15%.

Exact weighted sum: 1.26 + 0.96 + 0.76 + 0.54 = **3.52**. No rounding to four and no deduction inferred from another review's score.

The identity is strong: wood-root guardian, branch crown, cyan chest heart, framing ribs, foliage and stone feet. Likeness is held back by the compressed dark face, broad crouched proportions and repetitive shallow-looking leaf planes. The concept's pale elongated mask, conspicuous stern cyan eyes, sinuous root anatomy and hanging foliage have a different visual rhythm.

## Full-frame observations and matched comparison

| View | Candidate observation | Matched pass1 comparison |
| --- | --- | --- |
| Hero | Crown has useful uneven branching; the small dark face recedes above the bright core. | Long pale mask and clearer stern eyes are closer to the original; canopy is too blocky. |
| Front | Broad chest, short leg rhythm and hook-loop hands produce a stocky stance. | Similar broad body limitation, but face reads immediately; separated fingers better suggest hands. |
| Left | Thick back volume and narrow forward face; shoulder leaves break up the wood. | Deeper hanging foliage improves canopy continuity, though its regular rim is artificial. |
| Right | Bright shoulder planes dominate; foliage forms bands at arm joints. | More continuous drape, also overlarge and repetitive. Neither resolves organic rooting. |
| Back | Irregular exposed wood/leaf mixture is an improvement over a single solid-looking mantle. | Larger canopy is fuller but too roof-like; pass3 wins this local comparison. |
| Top | Offset leaf clusters create gaps and expose branch/body structure. | Dense repeated lobes make a more uniform cap; pass3 is less mechanical locally. |
| Diag-front | Face compresses into the crown and the eyes become tiny accents. | The longer mask remains distinct from crown and crystal and is substantially closer. |
| Diag-left | Dark split face and thin eye line lack the original's pale pointed expression. | Pale wedge preserves recognizability better, though still simplified. |
| Diag-right | Crown asymmetry works; small leaves read as attached polygon badges. | Larger repeated leaves are clumsy but provide more of the original hanging mass. |
| Diag-back | Broken canopy edge is more irregular; arms and legs remain chunky. | Fuller hanging perimeter is closer in mass, but repetition is greater. Mixed result. |

## Actual best and preserved disagreement

My independently assigned matched pass1 scores are silhouette/proportions 3.6, face/expression 3.9, defining details 3.6, facet/style 3.5. Weighted exactly: 1.26 + 1.17 + 0.72 + 0.525 = **3.675/5**. This is this review's contextual comparison, not a replacement for any earlier frozen review. Pass1 also falls below four.

Select **pass1** as actual best of these two. Pass3's crown asymmetry and less regular canopy arrangement are worthwhile local gains. They do not offset the loss of the long pale facial mask and readable expression, which carry 30% of the rubric. The shorter mask described in construction prose is a likeness regression in my judgment. The construction's claim of lobed foliage depth can be geometrically true while the actual lit plates still read as shallow repeated badges. These disagreements are retained rather than harmonized with the author's intent or anyone else's score.

Next visual priorities: restore a readable pale pointed face and eye silhouette; retain unequal branch directions; replace repeated bright leaf badges with larger layered drooping groups rooted in shoulder/back anatomy; then revisit the lankier root-body and hands. This is a review recommendation, not authorization or implementation.

## Source, render and preservation closure

`hash-verification.json` records a fresh byte-count and SHA-256 check of all listed entries: capture receipt 26, source closure 7, final closure 52, predecessor preservation 80, checkpoint closure 8, failed-initial closure 26. **No missing files or mismatches.** Counts overlap across receipts; they are not unique-file totals. All twenty inspected PNGs are covered by the capture receipt.

All ten camera pairs have identical positions, target and orthographic scale. Shared render source specifies 525x700, 16 Cycles samples without denoising, Standard view transform, world color (0.12,0.12,0.12), orthographic scale 7.7 and target (0,0,2.90). Both versions reset the scene and execute their respective preserved source. The same fixed world lights are created for both: Key (-4,-6,9), 1500, size 5; Fill (5,-3,5), 850, size 4; Rim (0,4,7), 1800, size 3. They target (0,0,3); lights do not follow the camera. Candidate-only correction retains predecessor camera records. Actual camera receipt pairs match. Source inspection verifies this shared setup; I did not independently rerender, so execution provenance remains based on the preserved script/log/receipt chain.

Final GLB hash is `7006a6ab2033b6894cd6067ba37b76bce45d041d6b39c577eadf8d3b290c03f3`; captured candidate GLB matches it. Source hash is `89de2593df27c0e6f9dd51e85af56ca06b02e28eecb37612781613ba58f76524`, matching metrics and closures. Approved original hash is `157fe0ad0db0705fd0ca4604b0bbf6d24893a935079f7529b29b010a25bb80d3`.

The preserved failed-initial source, GLB, validation, metrics and ten labelled images remain present and receipt-valid; its distinct GLB hash is `49abcadfffe46d934d4e77311b6204fa58f42574595eb048c9457e280a1ce7e5`. It is construction history, not the independently scored initial candidate. The frozen initial judgment here concerns the corrected candidate submitted for this review. The two concepts must not be conflated.

I reran the supplied read-only GLB validator into `validation-recheck.json`: 309 meshes, 1069 material primitives, 6304 triangles, finite attributes, valid indices, no external dependencies, zero reported boundary/nonmanifold/winding/zero-area/nonpositive-volume defects, zero skins and animations. This confirms the reported static checks, not global watertight union, intersection freedom, rig readiness, runtime behavior or performance. Structural success contributes **zero extra likeness points**.

Construction prose discloses render/browser contention in the initial capture and later candidate-only correction. The shared-light matched static frames are still usable for this narrow visual comparison; neither timing nor topology constitutes phone-performance evidence.

Only this review directory was authored. No product edits, builds, Git actions or remote writes were performed.

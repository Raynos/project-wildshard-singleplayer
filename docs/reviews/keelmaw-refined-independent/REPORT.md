# Keelmaw refined: independent static likeness review

**Verdict: improved working source, not an accepted final character.** Candidate **3.245/5** (3.25 rounded), fresh baseline **2.930/5**, delta **+0.315**. The **4/5 target is not met**. Continue from `complete-character-refined`; do not promote it on this review.

Review date: 20 October 2026. Reviewed source is retained by local commit `19a1988f778875b7920faf57660df05d74da8946`. No commit, publication, runtime edit or promotion was performed by this reviewer.

## Independent method

- Read repository AGENTS and relevant Git, review/mockup, subagent and judging instructions.
- Inspected the original `art/driftwood-isle/concepts/approved-nine-2026-10-19/keelmaw-hero.png` first. SHA-256: `69eb665a0f2224f1a35e61934304eb0ee4e205912c5b38d0bbfbe9ca160ac4d3`.
- Opened all ten actual PNGs under `tmp/keelmaw-complete-refined/final/` individually, not just thumbnails or a contact sheet. Locked candidate scores at **12:23:01 UTC**, before seeing baseline images.
- Then opened all ten actual PNGs under `tmp/keelmaw-complete-refined/baseline/` individually and locked a separate baseline score. Historical numerical scores were never read. The verifier hashes a prior review without displaying its contents.
- Category scores are holistic across the ten views. Rear/top views test coherent 3D translation, not invented certainty about the concept's hidden surfaces. Missing concept background/type and different illustration lighting were not penalized. The paired renders share cameras, but are not a pixel-matched reconstruction of the illustrated hero camera.
- Rubric: 0 absent/unrelated; 1 token cues; 2 weak adaptation; 3 recognizable with material deviations; 4 faithful with only minor deviations; 5 exceptionally close 3D translation. Technical validity contributes no likeness points.

## Locked scores

| Category | Weight | Candidate | Baseline | Reason |
|---|---:|---:|---:|---|
| Silhouette | 35% | 3.4 | 3.0 | Fuller shoulders and a smooth, tapered tail improve the flat, kinked baseline; short box head and oversized plain forelimbs remain unlike the concept. |
| Face | 30% | 2.8 | 2.8 | Recessed eye is less protruding, but still lacks the angular angry brow; shorter muzzle loses reach. Both have a rectangular tooth-grille jaw and thin straight keel. Net facial likeness is not materially improved. |
| Defining details | 20% | 3.6 | 3.1 | Barnacles, ropes, amber eyes, ivory jaw, gold claws/spines and teal scutes identify Keelmaw. Candidate replaces three dominant gold rails with more believable accents and tail plates. Rope braid, prow/keel shape and teeth remain schematic. |
| Facet/style | 15% | 3.3 | 2.8 | Both are genuinely faceted and within Driftwood's broad style. Candidate has better plate breakup; concept has much richer integrated moss/ochre facets and articulated limb/cheek surfaces than either model. |
| **Weighted total** | **100%** | **3.245** | **2.930** | **+0.315, below 4.0** |

Exact math and per-image SHA-256 pins are in `scores.json`, `candidate-score-lock.json` and `baseline-score-lock.json`. Apparent three-decimal precision is arithmetic, not a claim of psychometric accuracy.

## All ten views, compared after score locks

| Actual PNG view | Candidate observation | Baseline comparison |
|---|---|---|
| hero | Clear creature identity, continuous curled tail, substantial shoulders; broad slab forelimb and short box jaw dominate. | Flatter torso and very large repetitive gold wedges; eye protrudes and tail visibly kinks. |
| front | Complete planted stance; tunnel-like maw split by a thin straight keel; eyes almost disappear. | Same core face issue; oversized dorsal spikes and raised angular tail compete with the face. |
| back | Rounded/tapered tail and fuller body survive reversal. | Angular segmented tail and oversized spines expose the assembly more strongly. |
| left | Shoulder mass and taper improve; huge plain cheek and uniformly needle-like teeth remain. | Long flat barrel and three regular dorsal spike rows are less animal-like. |
| right | Amber eye, barnacle clusters and curved tail read clearly; eye still looks small and button-like. | Long head has more reach, but exposed round eye and mechanical dorsal repetition remain. |
| top | Complete feet, thick hook tail, straps and body plates are real 3D; head is still rectangular. | Three straight gold rails form a gridded saddle; tail bends sharply. |
| elevated-front | Fuller body reads; face loses visibility behind the flat forehead and central divider. | Taller gold rows overwhelm the long narrow head; same weak facial hierarchy. |
| elevated-back | Much better taper and armor continuity; straps become thin zigzags with bright ends. | Rectangular spiked saddle and kinked tail are more conspicuous. |
| elevated-left | Real mouth volume, teeth and barnacle holes; expression still square/toy-like. | Low body and bulky regular spikes create a less convincing crocodilian mass. |
| elevated-right | More coherent anatomical hierarchy and less gold clutter; face and plain limbs remain limiting. | Gold wedges dominate; long straight torso and schematic mouth persist. |

No view showed a cropped appendage. No single favorable hero angle was used to waive the front, top or rear deficiencies. Low-angle floor/background boundaries and grain are capture limitations, not anatomical defects.

## Verification and reproducibility

**PASS for evidence consistency and supplied validation; no fresh Blender render claim.** Ran the repository's `verify_delivery.py`, `audit_framing.py` for both sets, and `audit_source.py` for the candidate. A narrow write redirect preserved every existing package and raw-evidence byte; all audit outputs were written only inside this review directory. Re-run from repository root with:

    PYTHONDONTWRITEBYTECODE=1 python3 docs/reviews/keelmaw-refined-independent/recheck_evidence.py

- All **20 actual PNG hashes** and **3 reference hashes** match the capture receipt. Every PNG is **600 × 720**.
- All ten paired camera records are exactly equal after excluding geometry-derived bounds. Delivery verification also confirms identical render-setup source blocks, including lighting, camera and ground setup.
- Fresh independent orthographic projection of every native vertex reproduces both saved framing reports exactly. Every vertex lies strictly inside the raster. Minimum margins: **candidate 31.9066 px**, **baseline 14.5545 px**.
- Producer vs independently recomputed framing differs by at most **0.015607 px**, below the disclosed **0.1 px** tolerance. Historical pre-dependency-graph bounds are not used as acceptance evidence.
- Candidate native/GLB/source audit reran and exactly matched its retained report: **6,830 triangles**, exact position/color/rigid-skin/oriented-triangle parity, valid normals, positive closed individual components, single-sided visibility parity, no zero-area triangles and inverse-bind closure.
- Delivery verifier confirms unchanged 19-bone/19-part contracts, baseline native payload/metadata equality with retained previous source, final rendered-model byte equality and candidate-local storage caps. Source audit checks individual closed components, not welded animal anatomy.
- No Blender geometry regeneration or rerender was run, so byte-identical renderer reproducibility is **not independently established** here. The existing consumer-test pass is recorded by the verifier, not rerun by this review. No animation, collision/contact, combat, runtime admission or phone-performance acceptance follows from these static checks.

Details: `evidence-checks.json`, `delivery-verification.json`, `candidate-source-audit.json`, and both fresh `*-verified-framing.json` files. Reviewed inputs were hash-snapshotted before and after all checks and remained unchanged.

## Highest-value next refinement

1. **Solve the face before adding more decoration.** Broaden the maw and ivory cheek into the concept's powerful wedge, articulate jaw corners/lip contour, give the brow a clear inward-sloping plane with a readable amber eye, and replace the plain thin bar with a shaped, integrated woody keel. Vary tooth size and angle rather than a straight needle grille.
2. **Keep the candidate's torso/tail improvement, but break up limb slabs.** Add purposeful scute planes and dark foot/claw beds, preserving planted weight without ballooning the forearm or turning the shoulder into an isolated block.
3. **Integrate surface character.** Use irregular, body-following moss/ochre facet groups and fewer more intentional gold accents; make rope and barnacle attachment feel embedded rather than bright repeated strap terminals. More triangle count alone is not the goal.

Do not restore the baseline's oversized parallel spike rails merely to make the revision look busier. The next pass should improve the face and anatomical hierarchy, then face another independent all-view review. This recommendation selects a working source only; it is not approval to change runtime assets or assert that the approved hero has been matched.

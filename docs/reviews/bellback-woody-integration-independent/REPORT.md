# Bellback woody integration: independent static review

**Retain woody-character-integration as the closer of these two candidates, but do not accept it against the 4/5 target.** Exact candidate score **3.73/5**; independently scored retained pass3 **3.6425/5**; exact gain **0.0875**. No rounding, transferred score, or structural bonus.

## Original-first scoring

Viewed the approved `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp` first. Then opened all ten complete candidate PNGs individually, hero followed by the nine named views. Wrote `visual-freeze.json` before reading baseline images, prior scores or construction prose. Then opened all ten complete pass3 PNGs individually and froze `comparison.json`. No prior review scores were consulted. Source and technical receipts were read only afterward.

Weights: silhouette 35%, face 30%, details 20%, facet 15%.

- Candidate: 3.6, 3.7, 3.8, 4.0 respectively; weighted sum 3.73.
- Pass3: 3.55, 3.5, 3.75, 4.0 respectively; weighted sum 3.6425.

The original is a heavy, crouched wreck-crab guardian with a dominant flared bell, compact descending woody face, aggressive inset amber eyes, a broad broken ivory bite, splayed load-bearing legs and an irregular lashed timber mass. The reference supplies front-oblique views, so unseen rear anatomy is an inference, not an exact reference match.

## All-view findings

- Hero: candidate has the clearer descending timber muzzle and removes pass3's distracting pale forehead spikes. Both retain the readable bell, clapper and solid feet. Candidate's long paired ivory forms read more as tusks than the original jagged bite.
- Front: candidate's squint is aggressive and readable; its narrowed central face and long chin are less broad and broken than the original. Pass3 has a wider bite but a flatter, mask-like upper face.
- Left: candidate lowers the snout tip, yet its horizontal jaw and long neck/head still read reptilian. Parallel carrier rails dominate both versions.
- Right: confirms the same structural visual weakness rather than hiding it on one side. Candidate's smaller orange eye stays readable beneath its heavy brow.
- Back: largely unchanged plain hull end-cap, straight high timbers and stout four-legged body. This is coherent volume but still mechanical and boxy, not a demonstrated likeness gain.
- Top: candidate narrows and shortens the face slightly and substitutes wooden crown chips. Bell and cage remain dominant, but the body/head plan reads elongated rather than compact crab-like.
- Diagonal front: improved woody descent and lower eye posture; the two long ivory halves narrow the bite. Pass3's pale forehead spikes remain a stronger mismatch.
- Diagonal left: candidate's wedge is cleaner, but the horizontal side rails and elevated rectangular carrier persist.
- Diagonal right: same tradeoff; no special angle rescues the long lizard-like jaw profile.
- Diagonal back: no material visual identity improvement. Rear cage and broad plain hull remain the weakest whole-character shapes.

## What needs to improve

1. Bring the head/jaw together as a shorter, broader descending timber mass with a jagged interlocking bite. Keep the amber squint and wooden crown; avoid enlarging the pendant tusks.
2. Change the whole side silhouette: compact the long barrel/fence impression and make the limb/body mass read as a crouched, splayed wreck guardian. A face-only polish cannot close the silhouette gap.
3. Break the regular parallel rails with deliberate broad wreck shapes and meaningful lashings; reduce plain end-cap dominance at the rear. Preserve bell visibility and all-side solidity.

## Static closure

`python docs/reviews/bellback-woody-integration-independent/verify.py` passes. The read-only verifier independently checks 48 package/raw/pair hashes, all ten exact camera/target/scale pairs, light parity, both source hashes and capture-script hashes against receipts, and candidate GLB byte equality with both capture exports. Exact original, candidate source, candidate GLB and pair-manifest pins are embedded in the verifier.

Direct GLB accessor inspection confirms 4,806 triangles, 90 meshes, 214 primitives, finite positions/normals, in-range triangle indices, positive triangle area and consistently aligned unit normals; maximum unit-normal error is 1.2827242001911543e-7. No external buffer/image dependencies were found. The source explicitly builds flat-shaded geometry, corrects normals, exports the creature before adding the review environment and uses the pinned capture script. Existing component-topology receipts report no nonmanifold/degenerate failures; those Blender-side checks were not rerun.

This verifies static byte/receipt closure and exported geometry, not a fresh source reproduction. No rendering, runtime import, animation, intersection, browser, game integration or performance testing occurred. These proofs do not raise the visual score. No source/assets or Git state were changed by this review.

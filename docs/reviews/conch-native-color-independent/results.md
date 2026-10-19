# Independent Conch authored-color REST review

## Decision

**Reject as an appearance upgrade for promotion.** Keep as a valid diagnostic experiment. This is neither a rejection of the entire character project nor an animation/quality-complete verdict. Frozen blind likeness is **2.95/5 (59/100)** with silhouette 3.5, face 2.0, details 3.0, facet style 3.5 under unchanged weights 35/30/20/15. See `blind-freeze.md`; the number was saved before opening baseline/source images, earlier scores or provenance. It was not adjusted after discovering the older retained 64.75/100 rating. Different review judgments are not evidence of measured regression.

## All paired images inspected

Opened approved original art first, all nine candidate-native PNGs second, froze the score, then opened all 18 baseline/source PNGs individually. No crops or enhanced screenshots were substituted for native evidence.

- Front: candidate/baseline effectively tie at native viewing size. Pale shield edge and blade remain legible, but head and torso stay dark. Dense red/orange stippling in cavity and around eyes persists. Source has cleaner cavity planes and more coherent beak, though it also lacks the original concept's clear face presentation.
- Diag-front: shell silhouette reads well in all passes; candidate still has dark, noisy facial planes. Source separates the face/cavity more cleanly. No convincing candidate improvement over baseline.
- Left: conical shell and shield remain strong shapes. Candidate/baseline limb speckling contrasts with source's cleaner planes; face is occluded by design from this angle.
- Right: thin blade and long leg read, but body is subordinate to giant shell. Candidate and baseline remain visually equivalent; source body planes are cleaner.
- Back: shell colors and silhouette dominate; candidate does not remove dark mesh-like body patterning. Source's body segmentation is clearer.
- Diag-back: candidate/baseline show noisy underside and essentially the same broad shell color impression; source's broad surface shading differs visibly but is still faceted.
- Diag-left: shell lip strongly occludes actor; no legibility gain. Source gives cleaner continuous shell/body planes. This is the sole view where reported source-pixel distance gets slightly worse.
- Diag-right: blade/leg silhouette survives; candidate body stippling and palette remain close to baseline.
- Top: genuine overhead, complete shell/blade/shield extent in frame; body is mostly physically occluded. Useful for containment, weak for facial likeness. No material visual win.

The source is a diagnostic comparison, not the approved concept and not a quality target to optimize blindly. Its cleaner rendering does not fix all silhouette/proportion/face departures from that concept. The concept is cream/peach/coral and maroon with clearly separated amber stalk eyes, an open readable face, and pale claw planes. Native remains harder orange/ochre/dark red, with face swallowed by the cavity.

## Independently checked evidence

Read `conch-native-color-view.md` and `conch-native-color-view-results.md` only after blind freeze and comparative inspection. Read actual capture/adapter code to distinguish assertions from observations.

- Capture report completed with zero recorded errors and nine triples; identityBefore equals identityAfter structurally.
- Independently hashed all 27 image files against their report SHA-256 values: all match.
- Compared actual runtime attribute dictionaries to `tmp/conch-selected-view-qa/attempt3/actual-runtime-geometry.json`: all six legacy channels exactly equal (positions, normals, colors, skin indices, skin weights, fur lengths).
- Independently converted original admitted `colorsLinear` values to Float32 and compared them with actual runtime `aAuthoredColour`: all 19,710 components exactly equal.
- The report's pre-facet-original comparison still records 19,503 changed normal components (maximum absolute difference 0.9947603344917297) and all 19,710 changed legacy color components (maximum 0.11659270524978638). Those are historical differences, not new mutations caused by this candidate. Exact authored color does not mean legacy normals or legacy colors were restored.
- In every triple, source/native/root transforms match exactly; rendered baseline/native/source light snapshots match exactly. A small difference between pre-render light state and rendered lights is present, but rendered passes agree. Adapter code samples three composer renders synchronously, with one common simulation observation and camera, using the live lentToon configuration. No animation inference follows.
- Independently checked every projected bounding-box corner lies inside the clip volume and every camera lies in its admitted room bounds. All native stills visually show complete model extents without frame clipping; self-occlusion is not clipping. All 27 reported warm-pixel visibility checks pass. Warm-color detection is heuristic, not proof of visual quality.
- Candidate graph differs from retained baseline at paint input only. Adapter compiles baseline with unchanged compileGraph/live ToonLook, copies public material state including tint/emissive, and restores candidate materials. This controls far more than an unmatched material comparison, but does not make source materials equivalent to native materials.

## Material and scope limits

Actual native material report is MeshStandardNodeMaterial with tint approximately [0.769731, 0.782758, 0.808812] and vertexColors false; custom graph attribute consumption is the relevant authored-color path. Source uses its own materials. Therefore source/native differences mix source-material response and native shader/normal/rendering behavior. Do not claim this pass isolates a normal defect, gamma error, or unique root cause of stippling. The unchanged appearance shows authored-color input alone is insufficient here.

Reported RGB heuristic error is slightly lower in eight views and higher in diag-left. Front falls only 8.171 to 8.020; diag-left rises 16.823 to 16.999. That metric is not segmentation, likeness, perceptual significance or acceptance. Visible near-tie with baseline outweighs a small numerical reduction for selecting an appearance upgrade.

This is REST diagnostic evidence at 402×874, not animation, gameplay cadence, combat distance, collider correctness, physical phone performance or shipping acceptance. Next appearance investigation should target the persistent face/cavity and limb rendering defect under matched controls, while separately addressing pale palette and face/stalk readability. No source, image, build, Site or Git changes were made by this reviewer; only this review directory was written.

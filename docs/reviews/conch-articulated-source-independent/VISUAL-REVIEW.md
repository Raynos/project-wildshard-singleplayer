# Independent articulated Conch matched static review

2026-10-20, 21:47 UTC. Actual rendered-image review only. No source/scripts, existing reports, Git, motion, physics, app build or public artifact changed. This new Markdown report is the only written deliverable.

## Verdict

**Fresh candidate likeness3.89/5; fresh matched retained predecessor3.89/5. Both are below4.0 in this review.** The candidate preserves the visible retained character at rest without a discernible material likeness regression at these image sizes. There is no visible improvement sufficient to award additional points. This is a static tie, not an acceptance of the new joints, sole cuts, fixed upper-body assembly or its motion tradeoffs.

The initial source review's exact seam issue and repaired-source test result remain separate. Geometry closure, packing,333 hull points and passing tests add zero likeness points.

## Method, references and scoring

Opened the authoritative approved original `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp`, including both character depictions. Then opened all20 original PNGs individually through the image viewer: selected and articulated hero, front, back, left, right, top, diag-front, diag-back, diag-left and diag-right. Each was inspected as its complete original frame, not through a contact sheet, thumbnail, numerical difference image or a crop. Heroes are780×960; all nine-view frames496×700. No rerender or image alteration was performed.

I read the construction/receipt and prior historical scores before this review, so this is not a blinded comparison. The scores below are fresh judgments of the actual supplied matched images, not inherited source scores or scores inferred from the source-preservation proof.

Unchanged35/30/20/15 rubric:

| Criterion | Candidate | Fresh matched predecessor | Weight | Weighted contribution, each |
| --- | ---: | ---: | ---: | ---: |
| Silhouette/proportion | 3.9 | 3.9 | .35 | 1.365 |
| Face/expression | 3.7 | 3.7 | .30 | 1.110 |
| Defining details | 4.0 | 4.0 | .20 | .800 |
| Facet/style | 4.1 | 4.1 | .15 | .615 |
| Total | 3.89 | 3.89 | 1.00 | 3.890 |

- **Silhouette/proportion:** The towering asymmetrical cream/coral stepped shell, burgundy crouch, broad shield and opposing long blade immediately read as the approved Conch Duelist. The current shell's large rounded rear mass and very broad, heavy opening dominate the comparatively squat front body; the reference's silhouette has a more agile separation between the pointed face, chest and limb gestures. Side and rear views reinforce the shell's bulky bulb-like lower mass. This is a shared baseline issue, not a candidate regression.
- **Face/expression:** Yellow inset slit eyes on upright red stalks preserve the alert creature identity. The current central face reads as a short, wide angular beak with prominent lateral cheek blocks and a relatively dark, compressed chest beneath it. The approved reference's small pointed face and sharper stalking expression read more cleanly. Frontal and hero images carry this deduction; unseen back/top facial details are not invented reference requirements.
- **Defining details:** Stepped shell whorls, warm recessed throat, cream rim, dark body plates, slit pupils, asymmetric shield/rapier and pointed toes are all present. The shield's broad convex face and long weapon clearly distinguish the combat role. Neither candidate nor predecessor is missing a defining appendage. Some original claw/face relationships remain more sculpturally integrated in the concept than in these blockier assemblies.
- **Facet/style:** Large readable low-poly color facets and the cream/salmon/burgundy palette are convincing. No smooth plastic or noisy tiny-detail treatment has replaced the intended style. The studio images have visible Cycles grain, especially inside the shell and in shadows; that is not modeled detail and earns no points. AgX/studio differences from the concept or actual engine are not treated as source-material equivalence.

The historical selected-source4.05 and native3.15 remain intact as separate judgments. This review disagrees modestly with the former on likeness, especially face/proportion, and does not revise it. It is not valid to report a candidate decline of.16 by subtracting scores from different reviews/captures: the fresh matched comparison here is exactly tied. Likewise these Cycles studio images cannot raise or replace the historical actual native-render score3.15. No averaging, rounding up to4, or score transfer is appropriate.

## Actual directions, anatomy and framing

The labels were checked against anatomy in the images and the camera coordinates, rather than accepted as proof of coverage:

| Supplied view | What is actually visible in both variants |
| --- | --- |
| Hero | Slightly elevated front three-quarter; open shell throat, both eyes, face, shield front, weapon and both feet. Entire shell tip and blade tip fit. |
| Front | Near-horizontal frontal view along studio+Y; eye pair and central face below the shell opening, broad shield on viewer left and blade on viewer right. Both legs/feet fit. |
| Back | Shell's closed cream/salmon outer whorls, rear burgundy body and leg backs; face/throat are correctly occluded. Weapon and rear shield edges remain visible. |
| Left | Studio-X profile, weapon-side anatomy and thin edge of shell opening; overlapping legs are a real side-view occlusion, not missing geometry. |
| Right | Opposite studio+X profile, shield-side mass and closed outer shell; face largely hidden behind shell rim. The correct opposite side is shown, not a duplicate of left. |
| Top | Near-vertical view of shell spiral/tip and asymmetrical shoulder/arm spread; face/legs substantially occluded by shell. No sole or joint-interior assessment follows. |
| Diag-front | Elevated frontal view looking down into the open throat and across knees/feet. It is not a45-degree azimuth view. |
| Diag-back | Elevated rear view of closed shell, upper rear body and splayed legs; no false claim of front-face visibility. |
| Diag-left | Elevated weapon-side profile, shell rim projection, long weapon and near foot. |
| Diag-right | Elevated shield-side profile, outer shell, shield face/edge and near foot. |

The four `diag-*` cameras are elevated versions of the cardinal directions, not four additional diagonal azimuths. The hero supplies the additional oblique-front angle. Camera positions independently confirm this: front/back are approximately(0,+/-10,1.84), left/right(+/-10,0,1.84), top(0,0,11.84); elevated cardinals have height approximately9.6–9.8. This is the inherited nine-view protocol, honestly described, not fabricated full circular azimuth coverage.

All20 frames show complete overall models within their portrait borders; no shell tip, blade tip or foot is visibly cropped. Matching camera framing and stance are preserved within each pair. Internal occlusion is substantial in side/top views and is disclosed rather than treated as absent anatomy. No obvious mirrored/reversed character, missing component or gross changed silhouette appears in the candidate.

## What the static comparison cannot resolve

The main candidate changes are geometrically meaningful but poorly exposed in these resting views:

- New knee/cuff closure surfaces are chiefly internal at bind. These images do not show a bend opening the seam and cannot accept caps, tearing, overlap, armor interpenetration or a usable articulation range.
- The y>=0 sole cuts remove small real original regions. The ground obscures the underside;496×700 whole-body views and even the hero do not adequately expose the new sole-cap silhouette. No claim that the cuts are visually perfect or invisible under motion is made.
- The fixed torso/head/eyes/shield assembly and locked rapier elbow look essentially unchanged at rest. Losing their independent motion may be a major readability cost; still images cannot judge it.
- The broad braced-shield/body collision envelope is not shown as collision evidence. Visible anatomy equivalence does not accept obstacle behavior or bridge volumes.
- None of the20 frames proves actual native shading, complete motion, contacts, planted feet, strike timing/reach, damage, death, loot, defeat/Retry/reload, persistence or phone performance. There is no animation or combat score here.

## Independent evidence verification

Independently hashed all20 original PNGs against capture-receipt.json and checked their actual image dimensions. All match. Independently compared camera, lights, resolution, sample count, seed and groundZ for every one of the10 pairs; all match. Independently verified all46 files in the source final-manifest remain unchanged. This establishes byte identity and consistent recorded setup, not a new renderer execution.

The inspected renderer reads both pinned native source JSONs directly, transforms selected by B=Ry(pi), then applies the same proper actor-to-Blender C=(-x,z,y) to both. For the predecessor C*B recovers the original studio orientation. It builds static absolute bind geometry with identity object transforms, imports source colors and custom normals, and does not alter stance for framing. Blender normal normalization/quantization is explicitly measured rather than exact; maximum receipt delta9.713997379265157e-5. Uniform roughness.76/metallic0 studio material is not engine toon-shader equivalence.

Key pins:

- Authoritative original hero:90073e7f4eae70b1e135c87740325d6a7a7da94c67cf761b03c5184c507a65cb.
- Selected source:3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929.
- Articulated source:560abb099f474ddb86733f143e39652874298bba67f15fd1da7a63f1c4e91b3e.
- capture-receipt.json:8c57f57653ee98ddae003bbc39bff2f7bafc3a5387c756e8ee28aa6f62b9ba35.
- capture-verification.json:8114322dba48dbc7a685db053566c636267c118c9e2dd09bf492fc7604b6cd09.
- render_matches.py:6effda79ce0d8bba677ec32606daa5f7775a9172980ad08c3e39f531d0add7c2.
- Camera source:305663ad9378980ae5e3950a6b1d75b9057c34634304bf1994f30d5a84dc27ae.
- source-evidence-manifest.json:a24af1f9011e7afd4737728a36119deee51bb9e01b25fdc5e5074323c9663858.

All raw images remain at the candidate's `static-review/raw-attempt1/`; their complete per-image hashes are in the pinned capture receipt. I did not inspect compressed preview derivatives as scoring evidence and make no remote-publication verification claim.

Recommendation: retain both sources and this honest static tie. Do not promote the candidate or declare the4.0 likeness gate satisfied from this review. Any continuation should explicitly assess exposed articulation/sole tradeoffs and actual selected-source runtime behavior, without erasing the prior source4.05/native3.15 disagreement or turning source tests into art points.

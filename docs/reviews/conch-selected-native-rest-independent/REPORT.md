# Independent Conch native REST appearance review

**Verdict: capture comparison valid; visual acceptance withheld. Native-to-approved-concept likeness: 64.75/100.** This is an actual arena-host REST diagnostic, not a gameplay, animation or Blender result.

## Blind native-first assessment

Inspected the exact approved `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp` first, then each of the nine attempt3 native PNGs individually, in the order recorded in `native-first-freeze.json`. Wrote that score freeze before opening any paired source PNG or prior score. Then inspected all nine source PNGs individually. No structural/admission points, transferred Blender scores or upward rounding.

| Criterion | Weight | Native score | Visible basis |
|---|---:|---:|---|
| Silhouette | 35% | 72 | Recognizable spiral shell, shield claw and long opposite blade. In the front/rest views the shell reads as a broad bonnet/dish over a compact body; the reference has a more strongly ascending stacked spiral and more expansive stance. Side/back views establish genuine volume, not reference equivalence. |
| Face | 30% | 55 | Amber eyes/stalks survive frontally, but are small and dark. Face/beak expression is less clean and less predatory than the reference; native fine stippling further obscures it. |
| Details | 20% | 65 | Shell bands and asymmetric tools read. Reference purple-red armor separation, sharp beak, feet and arm contours are less legible here. |
| Facet/color treatment | 15% | 64 | Large shell facets read, but body/face noise fights clean planar shading. Cream/coral reference becomes darker ochre/orange and deep red-brown in this host. |

Weighted arithmetic: 72×.35 + 55×.30 + 65×.20 + 64×.15 = **64.75**. This is a subjective graphics likeness score for the supplied diagnostic framing. The reference itself is stylized concept art with different lighting/perspective; it is not a pixel-aligned ground truth.

## Paired source/native appearance

Both paths already share the broad geometry/pose departures from the concept. The native renderer adds an appearance difference: source face and body show cleaner, more continuous planes; native face/body have conspicuous fine stippling. Large shell highlight/facet regions redistribute, particularly overhead and oblique. Neither the dark host lighting nor the compact framing should be mistaken for a pure mesh-authoring failure. The comparison does not isolate which shader/material/post-facet change causes each pixel difference.

The following measurements use the union of warm-colored pixels in the two full raw 402×874 PNGs. This is a useful heuristic for this warm character against its blue room, **not a perfect silhouette segmentation or quality percentage**. RGB MAE is on 0–255 channel values; >8 means any RGB channel differs by more than eight. No image was resized, edited or rendered for this review.

| View | RGB MAE | Pixels >8 | Individually observed difference |
|---|---:|---:|---|
| front | 8.389 | 49.08% | Same weapon outline; native face/stalk interior noticeably noisier. |
| left | 14.465 | 61.64% | Same tall profile; native broad shell face flatter/brighter in places, limb noise stronger. |
| right | 10.165 | 55.47% | Blade/leg silhouettes align; native dark upper leg is less cleanly planar. |
| back | 13.492 | 68.08% | Shell facets redistribute light; native exposed underside/body stipples. |
| top | 16.702 | 78.16% | Same broad shell outline; substantial shell-plane shading differences. Face naturally hidden. |
| diag-front | 12.554 | 68.33% | Source head planes cleaner; native central face looks mottled. |
| diag-left | 17.061 | 69.88% | Shell basin planes visibly change value; native limb stippling remains. |
| diag-right | 15.758 | 72.59% | Same narrow blade/shell profile; shell facet boundaries/value and body texture differ. |
| diag-back | 13.792 | 69.39% | Matching shell bulk; different large shell-plane light pattern and noisy native underside. |

## Provenance, camera and completeness

`verify.py` independently reads existing files only; its successful output is `verification.json`. It checks current exact host inventory (139 files), all build input hashes, all native pins, source GLB hash and hosted copy, before/after capture identities, all 18 image hashes, and each separately saved observation against its report entry. Source GLB SHA-256 is `21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a`. Host inventory receipt SHA-256 is `6b9375aa5b718f1c52ea10a0bfb04b3c16f9e066fecd8c693e06cdb4e3bdb00a`.

- Comparison implementation loads that GLB with its source materials; native is the actual 6,570-vertex, 15-bone arena actor. The two synchronous composer passes switch visibility while sharing camera and root. Native shaders are unchanged by this comparison.
- Every pair's source/native/root matrix is exactly equal. Root changes **between views** as the host simulation advances; this is not a frozen nine-angle simulation turntable. The camera tracks the actor for each pair. Exact roots, camera positions and quaternions are in the verification output and original observations.
- Every observed bone has zero rotation and unit scale. This confirms the sampled rest transforms, not animation fidelity, motion continuity or skinning under movement.
- Vertical FOV 95°, aspect 402/874, camera distance 6.481802053463358. Camera positions pass the actual room inset bounds; all projected bounding-box corners are inside the image. Visual inspection independently confirms the complete projected character in all 18 images, with no ceiling occlusion or image-edge clipping. Self-occluded faces/limbs in rear/top views remain naturally hidden.
- Rendered directional light is RGB [1,.97,.9], intensity 2.7; hemisphere RGB [.7835377915,.7835377915,.7835377915], intensity 1.15. **Native/source/after rendered light snapshots match exactly in every pair.** Pre-render `before` light world matrices differ from the rendered snapshots in all nine views, so “all four snapshots identical” would be false. The recorder observes a renderer update before its first finished pass. Its light schema does not separately record directional targets or hemisphere ground color; source inspection establishes shared live light objects, not an exhaustive serialized lighting proof.
- Canvas data URLs exclude the HTML diagnostic label; raw PNGs are unlabeled internal evidence. They should not be presented as labeled gameplay screenshots.

## Actual post-facet attributes

Recomputed against Float32-converted admitted native input, not accepted from a prior claim:

- Positions: 0/19,710 components changed. Skin indices: 0/26,280; weights: 0/26,280; fur lengths: 0/6,570.
- Normals: 19,503/19,710 components changed, max absolute component delta .9947603344917297. Normalized angular comparison: 75 vertices across 25 triangles exceed 1°, maximum 84.13826629267662°. Component changes therefore must not be reported as nearly every normal having a large directional change.
- Colors: all 19,710 components changed, maximum absolute linear component delta .11659270524978638.

Normal/color preservation is **false**. Equal position/rig arrays prove neither visual equivalence nor a quality pass.

## Retained failures and scope

Attempt1 failed with “Light state changed within matched pair.” Attempt2's `completed: true` did not establish image completeness: top and all four diagonal pairs were ceiling-occluded (their native frames have zero warm character pixels; directly inspected the blank top frame). These five failed pairs and both earlier attempts remain untouched; the verifier records SHA-256 inventories of their existing files. Attempt3 fixes camera containment, not all appearance issues.

- **Graphics:** real 3D conch character and asymmetric gear are recognizable; facial/material treatment still needs work before visual acceptance.
- **Appearance:** 64.75/100 native-first likeness, with additional measurable source/native shading drift. No 95% claim.
- **Readability:** shell and weapon roles are readable at these frames; face and dark limbs are marginal. Character occupies roughly 131–292 pixels of frame height across views, with much empty room. This is diagnostic capture readability, not validated combat-distance readability.
- **Untested:** animation, combat behavior, interruptions, physical-phone rendering/performance, human enjoyment/fun. No promotion or acceptance for any of these.

Recommended next work: investigate native face/body stippling and shell/material shading against these exact source pairs, then re-evaluate actual native presentation. Preserve the frozen score and failed captures as history rather than retroactively improving their claims.

Recheck from repository root: `PYTHONDONTWRITEBYTECODE=1 python3 docs/reviews/conch-selected-native-rest-independent/verify.py`.

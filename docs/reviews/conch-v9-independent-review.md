# Conch Duelist V9 independent likeness review

Reviewed 2026-10-19. Static visual comparison only. **3.1375/5; strictly above 3.5: NO.** This is a new assessment against the approved original, not an increment from an earlier score. Prior scores were not used to calculate this result.

## Frozen evidence

- Approved original: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp`; SHA-256 `90073e7f4eae70b1e135c87740325d6a7a7da94c67cf761b03c5184c507a65cb`.
- Frozen builder: `art/driftwood-isle/approved-conch/build_conch_lowpoly_v9.py`; SHA-256 `134cb0af591a24f3713e18e94960388180f883d2df6102b69be7afbe149dc4ea`.
- Actual GLB: `tmp/conch-v9/conch-study.glb`; SHA-256 `0ac31d7cb39387f2c7c60c7a2b2c66fba15a05e267dd0a660783f8686abb08bc`.
- Actual hero comparison: `tmp/conch-v9/comparison-v9-board.webp`; SHA-256 `fa1ceb92b41a5253f4aff6e1ff33188fa87d35ec3adfae9600e65af0f307c09c`.
- Individually inspected all nine actual full frames: `tmp/conch-v9/color-v9-{front,left,right,back,top,diag-front,diag-left,diag-right,diag-back}.png`, plus the original and comparison board. The nine-view montage was not substituted for these frames.

## Exact weighted score

| Criterion | Score / 5 | Weight | Contribution |
| --- | ---: | ---: | ---: |
| Silhouette and proportions | 3.25 | 0.35 | 1.1375 |
| Face and character | 3.00 | 0.30 | 0.9000 |
| Defining details | 3.25 | 0.20 | 0.6500 |
| Facet style and palette | 3.00 | 0.15 | 0.4500 |
| **Total** | | | **3.1375** |

## Findings

The model is recognizably the intended shell-bearing duelist: tall coral/ivory conch, burgundy body, stalked amber slit eyes, asymmetric shield claw and pointed rapier, planted bent legs. Those defining features earn real credit.

- **Silhouette:** the approved shell is a broad sequence of angular, overlapping whorl shoulders. V9 reads as a comparatively narrow striped cone beside a flared aperture plate. The hero/front show the mismatch immediately; left, right, back and the rear diagonals confirm that the shell's horizontal rings and tapered-cone construction dominate the volume. Its lower flare resembles a skirt rather than the original's heavy irregular shell mass. The claw is a compact convex shield rather than the original's long, blade-like wedge.
- **Face:** amber slit eyes and elevated stalks preserve identity, but their rectangular/diamond frames read flatter and more upright than the original's pointed, hooded predatory eye shapes. The face is a simple triangular mask with tiny nostrils rather than the target's sculpted cheek/brow-to-hook transitions. Front and diag-front make this particularly clear. The exposed flat torso under it also reduces the compact armored-crustacean impression.
- **Details:** the aperture has a real recess and a strong ivory rim, but its internal curled strip distracts from the original's broad, uncomplicated dark-orange cavity. The shell ridge path is too regular. Claw/rapier, toes and limb segmentation are present but simplify the target's intersecting angular armor and orange/cream transitions.
- **Style:** the broad warm palette is right. However, large uniform salmon panels, clean narrow cream stripes, flat eye inserts and simple burgundy limb blocks do not reproduce the target's large, irregular triangular color/facet rhythm. This is visible across the front and back and from the top, not just a lighting difference in the hero.

The top view shows a coherent conical volume, but also the separation between its circular spiral and the broad aperture lip. Diag-left and diag-right expose the lip as a conspicuous plate-like projection; diag-back reinforces the cone-and-stripe reading. The original does not specify hidden anatomy, so unseen rear details are not scored as literal missing reference features. These views instead test whether the approved front-facing design has been resolved into a convincing volume.

## Highest-impact next construction correction

**Rebuild the shell as one designed, asymmetric whorl-and-aperture volume.** Establish several broad offset angular shoulder masses, increasing in width toward the large lower whorl, and carry the final whorl continuously into the flared mouth. Design the cream bands as broad oblique planes on those masses, rather than narrow regular strips around a cone. In front/three-quarter silhouette, the shell should supply the original's stepped triangular shoulders and wide sloping cheek beside the cavity; in side/back views, those shoulders must remain substantial volumes. Preserve an actual recess and watertight shell walls.

This is a construction change, not a request to iterate rim width, eye spacing or small color values again. Fix the largest identity-bearing structure first; the next meaningful pass after that would be the hooded eye housings and sculpted hooked face. Minor material tuning alone is unlikely to close the present gap.

## Scope and structural caveat

The supplied topology audit reports 4,098 triangles across 40 meshes, with zero boundary/nonmanifold/degenerate edges or faces in the main shell and aperture meshes; eye layers and nostril overlays have explicitly recorded component boundaries. These facts are separate from likeness and do not increase the visual score. No new topology computation, animation test, runtime integration, performance test or fun assessment was performed. The render completion status is supplied as terminal 0, not a playable-enemy acceptance.

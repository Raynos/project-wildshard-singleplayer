# Pearlglass Medusa complete-character independent source review

Reviewed 2026-10-19. **Prefer complete-character-next, 3.2925/5, over retained v2, fresh 3.015/5. Neither meets 4/5.** Static source likeness only; no model, runtime, animation, collision, combat or phone acceptance.

## Method and disclosure

Read AGENTS.md, current DRIFTWOOD-ENEMIES plan and STATE. STATE exposed the historical Medusa 2.75 before review: this is not a historically score-blind review. The historical number was not used as the baseline score or averaged into either result. Inspected authoritative approved pearlglass-medusa-hero.png, then corrected World and Explorer nine-view sheets. Those AI sheets only inform uncertain hidden surfaces, never override the hero. Inspected all ten final candidate raw PNGs individually at original 600×720, then locked and reported candidate scores before opening any baseline image. Subsequently inspected all ten v2 raw PNGs individually at original size and scored them afresh. No board, thumbnail or paired composite replaced any original.

The face/expression component is applied to the characteristic central orange organ, surrounding fronds and its readable focal expression; no eyes or mouth are expected or invented.

## Locked rubric

| Source | Silhouette/proportions 35% | Focal organ 30% | Defining details 20% | Facet/style 15% | Exact total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Complete-character-next | 3.35 | 3.0 | 3.4 | 3.6 | **3.2925** |
| Retained v2, fresh review | 3.0 | 2.8 | 3.0 | 3.5 | **3.015** |

Candidate: 1.1725 + 0.9 + 0.68 + 0.54 = 3.2925. Baseline: 1.05 + 0.84 + 0.6 + 0.525 = 3.015. Difference 0.2775. No rounding, cross-model averaging or structural-test credit. Historical 2.75 remains a separate judgment.

The candidate earns its improvement through a fuller, less sawtoothed bell, bowed ribs, better broad ribbon sections and more face-seated barnacles. It remains visibly less convincing than the approved hero: its focal organ has a dominant plain pale-yellow polygon rather than a luminous compact amber cluster; cream ribs look like separate straps with exposed rim ends; the bell crown converges into a pinwheel; ribbons retain abrupt lower sticks and crowded crossings rather than graceful tapering curls. Palette is identifiable, but very pale highlights and deep side shadows flatten the intended amber/mint hierarchy.

## All-original view report

All rows are direct inspections, not extrapolations. Overall preference favors the candidate; local tradeoffs remain.

| View | Complete-next observation | Retained v2 observation | Comparison |
| --- | --- | --- | --- |
| Hero | Fuller bell and bowed ivory arches; exposed organ is still a large flat yellow plate. Broad ribbons have visible twists, but central overlap and blunt tails weaken elegance. | Thin zigzag bell lip, layered straight ribs, spiky orange hanging core and angular tapered ribbons. | Candidate preferred for bell/ribbon character; neither reproduces orange organ complexity. |
| Front | Recessed teal underside reads well. Organ's single large face dominates; front-right ribbon is heavy and the tail tips are straight. | Jagged umbrella edge, orange spikes and repeated barnacle triplets; clearer open spaces but harsh polygon zigzags. | Candidate preferred, with focal-organ and tail corrections essential. |
| Left | Fuller cap silhouette and rounder ribbon folds; ivory ends poke through lateral cap. Backlit crowded streamers obscure central anatomy. | Thin stepped side cap and visibly edge-mounted barnacle pegs; streamers bend like strips of folded card. | Candidate preferred; side rim integration still fails visually. |
| Right | Better cap volume and broad flowing outer ribbon; end stubs and rib protrusions remain. Core is partly hidden by attachments. | Strong faceted cone and thin angular ribbons with peg-like details. | Candidate preferred for broad forms, not organ readability. |
| Back | Fuller crown; long pale faces still wash out patches. Dark orange center and thick ribbon crossings reduce readability. | Sawtoothed perimeter and skinny needle ends; angular ribbon curtain separates somewhat better. | Candidate preferred in bell, mixed in lower-body spacing. |
| Top | Less star-shaped outline, but many thin triangles radiate into a central pinwheel; cream tips visibly puncture edge. | Strongly regular star outline, long radial triangles and repeated rim protrusions. | Candidate preferred, but top is still substantially unlike the hero's purposeful patchwork. |
| Elevated front | Rounded dome, fuller folds, visible barnacles; crown pinwheel and massive cap hide focal anatomy. | Regular scalloped umbrella with radiating stripes and crisp angular streamers. | Candidate preferred; no false assumption that this must reveal hero underside at a different angle. |
| Elevated left | Broader cap and curled ribbon sections; two conspicuous cream side protrusions and dark interior. | Repeated scallops, pinwheel and pointed cardboard-like streamers; exposed barnacle edges. | Candidate preferred; cap/rib integration remains unfinished. |
| Elevated right | Less mechanical outline and more rounded ribbon bends, but broad pale crown and stub tails persist. | Radial cap sectors and sharply folded lower streamers; thin end needles. | Candidate preferred with a persistent crown-top weakness. |
| Elevated back | Fuller rear cap, broad irregular patchwork and robust streamers. Central starburst and visible perimeter tabs remain. | Strong umbrella sectors, sawtooth edge and highly angular lower geometry. | Candidate preferred, still below target. |

Every original contains the complete subject within the frame. Top views naturally hide most hanging anatomy; no hidden-view likeness is inferred from that occlusion. Side darkening and sampling noise affect how precisely tiny surface details can be judged, but do not conceal the major shape failures.

## Evidence integrity and camera checks

Checkpoint SHA-256 is 7a4fb822a794dbb59d037d99f962ce74ee5c4c2a13611dee7a4310f87d2e26f5. All 40 listed files match byte sizes and hashes. GLB is 791048 bytes, SHA-256 3fc2f82d7248c35bffce2b716c24ee979e7de330901d5b72fa4b1a5bd967e3c3. Each candidate PNG matches both checkpoint and capture-provenance; each baseline PNG matches capture-provenance. All twenty are 600×720. See verification.json for machine-readable checks.

Actual producer render blocks are identical, not merely labels: orthographic scale 5.15, camera radius 8, target (0,0,-1.10) in Blender, 600×720 at 100%, Cycles 32 samples, Standard view transform, exposure -0.9, same three area lights and hidden ground. Camera JSON is byte-identical. Hero azimuth/elevation is 23/-8 degrees; cardinal views 0/0, -90/0, 90/0, 180/0; top 0/89.9; elevated cardinals use 39 degrees. The geometry axis mapping is +Y-up/+Z-front to Blender (x,-z,y-3.35). Visible underside/side/back progression is consistent with these poses. These are matched source cameras, not claims of exact pixel alignment with AI mockup cameras.

Six actual-consumer tests are recorded passing; final log matches its checksum. Inspected test source covers typed attributes/binds, fresh geometry/normalized skin, numeric own-rig clips, live weighted bounds, rejected actual FlightMotion death and normal/winding agreement. Tests were not rerun because they write evidence outside this review's ownership. Source includes explicit normals; this closes the prior missing native normal attribute, without turning a source render into runtime proof. GLB triangle/color/skin equivalence does not certify the final native material, emission, tone mapping or lighting response; current test rigs use MeshBasicMaterial for weighted bounds. Keep these appearance differences explicit.

Retained inward-ribbon and missing-native-normals failure directories exist and were untouched. No builds, browsers, models, Sites, Git or production files changed during this review. Only this review directory was written.

## Integrated next correction

Reconstruct the visible system together rather than optimize isolated rubric components:

1. Establish the approved bell-to-organ-to-ribbon proportions and negative spaces from the hero first. Retain the improved cap volume, but make its low scallops, teal cavity and ivory rib seats one coherent shell. Remove exposed side/top ivory tabs rather than hiding them with a camera.
2. Replace the pinwheel crown with irregular broad triangular patches and a softer, uneven dome. Avoid merely adding triangles; make plane sizes and pastel regions purposeful from all elevated cameras.
3. Integrate a compact orange lobe cluster and short curled fronds around a smaller bright central feature. Preserve its visibility through the rib opening and ribbon attachments. The present broad yellow plate is not an adequate focal-organ match.
4. Redistribute all ribbons together for open readable gaps, broad twisting middle sections, varied lengths and genuinely curling tapered ends. Resolve the congested central crossings and straight stick-like terminal sections in front, side and rear views. Retain face-mounted hollow barnacles with varied clusters and keep their scale subordinate.
5. Re-render all ten matched source cameras, then independently lock the same rubric again. Check a separate actual native material/render before any visual runtime claim; the static source result alone cannot clear that gate.

Default flight death remains rejected at minimum vertex Y -1.1913332079183132 m. The live bound minimum 0.081116245769556 m at existing root 1.2 m/scale 0.35 is a weighted-pose measurement only. No root lift, physics exemption, flight-height change or runtime admission is recommended. Existing physical-corpse admission and actual animation/combat/readability evidence remain separate open requirements.

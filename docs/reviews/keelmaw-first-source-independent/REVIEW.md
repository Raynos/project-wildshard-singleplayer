# Keelmaw: independent first complete source review

2026-10-19. **Complete source likeness: 2.75/5. Below the 4/5 target. No visual or runtime acceptance.** This is an independent assessment of the final camera-corrected source, not a copied earlier score or a gameplay review.

## Method and unchanged rubric

Read repository AGENTS.md, the active DRIFTWOOD-ENEMIES plan and its State. Inspected the approved original hero, World nine-panel original and corrected Explorer nine-panel original at their original 1536×1024 resolution. Inspected each of the ten original actual 600×720 PNGs individually with `view_image(detail="original")`: hero, front, left, right, back, top, elevated-front, elevated-left, elevated-right, elevated-back. No contact-sheet-only judgment and no upscaling represented as additional detail. All ten paths and hashes are in `inspection-receipt.json`.

The original hero is authoritative. AI World/Explorer panels help examine approximate hidden surfaces, not enforce impossible camera/shape consistency. Category scores were locked and sent to the coordinator before reading the builder README, audit conclusions or any builder opinion. No builder likeness score was used. Later technical reading did not change the score.

| Category | Weight | Score /5 | Contribution |
|---|---:|---:|---:|
| Silhouette | 35% | 2.7 | 0.945 |
| Face | 30% | 2.5 | 0.750 |
| Defining details | 20% | 3.1 | 0.620 |
| Facet/style | 15% | 2.9 | 0.435 |
| Exact total | 100% | **2.750** | **2.750** |

Arithmetic correction to the preliminary coordinator message: the unchanged category scores sum to **2.750/5**, not the initially reported 2.745. Final independent score: **2.75/5**. No category was changed to fit the correction.

## What works

It is recognizably Keelmaw: a four-legged crocodilian with an open hinged mouth, amber slit eyes, pale jaw/belly, gold central snout keel, dorsal crests, recurved tail, ropes and hollow barnacle clusters. The side views are legible; all four feet and sixteen claws are readily accounted for across top/elevated views. Colors remain in the green/ochre/ivory family and genuinely faceted geometry remains coherent around the animal. These are substantive source achievements.

## Integrated corrections, in priority order

1. **Rebuild the mass relationships together.** The reference is low, broad, heavy and shoulder-dominant, with thick forearms, a deep pale jaw/cheek wedge and a stout curling tail. The actual is a straighter cylindrical trunk on four repeated bent tubular legs, with a relatively narrow long head and finer tapering tail. Widen/lower the torso and shoulder transition, spread and thicken the forelimbs into broad planted feet, bring head width and cheek depth into that mass, and thicken the tail root/curl. Preserve a continuous anatomical flow rather than enlarging isolated primitives. Judge these changes simultaneously in hero, front, both sides and top.
2. **Rebuild the facial structure, not just the eye color.** The actual upper muzzle reads as a flat tapered board, its cheek as a small pale insert, and its lower jaw as a thin trough. The hero's massive ivory cheek/jaw, angular recessed brow and deeply framed mouth are the character. Build a broader sculpted upper snout with interlocking plates, deepen the cheek-to-jaw transition, recess the eye beneath a purposeful slanted brow, and vary tooth size/spacing while retaining a convincing mouth cavity. The central gold keel currently reads as a narrow vertical bar spanning the opening; integrate its volume into the snout and lip silhouette so it does not visually cage the mouth.
3. **Replace the regular dorsal grid with body-following armor.** Top and elevated-back reveal rectangular rows like fitted tiles, topped by nearly identical triangular pyramids. The hero has layered, irregular, swept plate ridges whose scale and direction follow the torso and tail. Make the plate silhouette and facet flow part of the body, vary crest height/lean, and carry that rhythm through shoulders, neck and tail. Do not solve this by adding more identical spikes.
4. **Integrate the nautical details into the volumes.** Thin regular straps and small repetitive barnacle stacks convey the idea but have much less weight and placement specificity than the chunky braided ropes and uneven clustered shells in the hero. Give ropes visible twisted cross-section and believable paths around body/neck; position asymmetric barnacle groups along those paths with varied shell sizes and recesses. Maintain clear attachment instead of bolt-like rows perched at the sides of a flat armored deck.
5. **Refine the facet language after proportion corrections.** Large triangular body patches, lime strips, smooth broad leg bands and uniformly gold spikes make the current model read more schematic/toy-like. The target uses purposeful larger form planes plus medium irregular armor facets and restrained mossy color breaks. Improve geometry rhythm and color grouping together, without substituting noisy texture for the low-poly design.

## Individual capture observations and direction/framing checks

- **Hero:** same general head-right three-quarter category as approved hero; actual camera is more elevated/distant and the tail exits the left image boundary. The reference's broad looming head/forequarters and thick curled tail are not matched. This clipped frame cannot prove complete silhouette.
- **Front:** correctly front-facing, four-limb arrangement consistent across views; narrow muzzle opening and central gold strip dominate. Small pale cheeks and round visible eye sockets reduce the predatory face. Full visible frontal body fits.
- **Left:** snout points screen-left as both target sheets label it. Complete side fits tightly. Cylindrical trunk, repeated leg bend and comb-like crest rhythm are especially exposed.
- **Right:** snout points screen-right as both targets label it. Complete side fits tightly. Jaw, cheek and uniform triangular teeth give a mechanically regular profile; side direction is not swapped.
- **Back:** correctly rear-facing, tail crossing the foreground. Camera category fits both references, but tail curl placement differs between the AI sheets themselves. Narrow rear mass and regular plates remain visible. Full rear silhouette fits.
- **Top:** head points screen-left and matches corrected Explorer. World top points screen-right. Therefore the camera-correction claim cannot mean matching both references simultaneously. Four feet and the recurved tail are coherent, but plate grid, narrow head and repeated limb plan become most obvious. Fits with a tight right tail margin.
- **Elevated front:** truly elevated front; differs from Explorer's noticeably oblique front-three-quarter pose. Actual narrow head, repeated crest rows and broad limb spacing read clearly. Full animal fits.
- **Elevated left:** head-left three-quarter direction matches the target category. Best complete oblique view of the actual; full curling tail is visible. Limb/body assembly and small pale jaw remain unlike the hero.
- **Elevated right:** head-right category matches targets, but tail is clipped on the left. Do not use this frame to declare tail fidelity or complete framing.
- **Elevated back:** correct rear elevated category; all four limbs and tail visible. The actual tail curls to screen-right while Explorer's elevated-back curl is on screen-left and World differs again. These generated hidden-angle inconsistencies do not authorize mirrored anatomy. Regular deck-like plate grid and small feet remain actual weaknesses.

No obvious missing or duplicate limb is visible. Occlusion prevents proving every attachment from every angle. Consistent source geometry and multiple views support a coherent four-legged assembly; static renders do not prove deformation quality or anatomical joint function.

## Provenance and technical boundaries

`inspection-receipt.json` records all SHA-256 checks. All 18 final-checkpoint entries match. Its base-checkpoint digest matches the existing checkpoint exactly. Of 62 base-checkpoint entries, only the expected current producer path differs: its preserved pre-top-roll copy matches the older pin. The producer diff is limited to optional view selection, top camera roll and camera metadata; no geometry modification is present there.

The final native JSON and packed payload are byte-identical across retained v1, v5 render output and v6-top output. The v1 source pins match: native JSON `eaaae47bc5316d1278d36295e7c08995e89d7a688888d9f90d25d7909a9a372d`, GLB `cf69a48b8ed0411f66fd8deb657c71c0c8702c518537bc7d92ed955017c2dd12`, payload `de184ee931dc9218b2514ab279069195de50bb85f3305a81ef4b8c59dd01fd38`. Direct JSON counts confirm 7,080 triangles, 19 bones and 19 parts.

All three inspected nativeSite reference originals are byte-identical to the repository references used by the pairing script. For every actual view, independently reproducing the script's label/resize/WebP encoding in memory yielded byte-identical final matched-review-v2 files. Thus the delivered individual images are derived from the original PNGs inspected here. Raw PNG hashes were independently recorded now; the prior checkpoint only listed their directories rather than per-PNG pins. Existing render logs and producer support the render provenance, but this review did not rerender the model or independently execute Blender.

The builder's retained strict corpse-contact result remains **3/4 failed**, not acceptance: fixed penetration 26.38 / 11.78 / 3.13 / 13.59 mm against 5 mm. This review reads retained results; it does not rerun those tests. Source parity and closed-component checks do not erase the contact failure. The mesh is an articulated overlapping-solid assembly with rigid one-bone weights, not proof of welded anatomy or organic deformation.

No runtime/site/model changes, Blender rerenders, product builds, browser runs or network writes were performed. Static source render likeness says nothing about animation, attack timing, combat readability, phone performance or fun. Those remain unscored and unaccepted. The original inspection resolution and sampling noise limit fine-surface judgment; AI hidden-angle inconsistency limits exact contour matching. Neither limitation explains away the large silhouette/face differences visible against the authoritative hero.

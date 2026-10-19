# Bloomthroat Iguana complete-character independent review

2026-10-19. Static source review only. Preferred actual candidate: **complete-character-next**, but **not accepted**. No animation, contact, gameplay, phone-performance or runtime acceptance follows.

## Exact independent score

Scores out of 5, weighted 35% silhouette, 30% face, 20% characteristic details, 15% facet/style:

- Complete-next: 3.10 / 2.70 / 3.10 / 3.25. Contributions 1.085 + 0.810 + 0.620 + 0.4875 = **3.0025/5**.
- Retained v3, freshly reviewed: 2.60 / 2.50 / 2.35 / 3.30. Contributions 0.910 + 0.750 + 0.470 + 0.495 = **2.625/5**.
- Difference: **+0.3775**. Strict >=4 requirement fails for both; no rounding up.

These are holistic all-view likeness scores, not an average of invented per-image measurements. Candidate scores were locked in a parent message after inspecting the authoritative hero, two approximate reference sheets and all ten candidate PNGs, before viewing any v3 image or reading builder narrative. Required STATE reading had already exposed a historical 2.245 score, so this is not fully rating-blind. That historical result remains separate and is not replaced or averaged with this fresh 2.625 assessment.

## Evidence and verification

Candidate checkpoint SHA-256: `62019c41ae7d2a52cb45fd7a6669b425f95b9c98786e306dc93df1135edc4375`.

Every actual candidate PNG in `tmp/bloomthroat-iguana-complete-next-final-renders` and every actual baseline PNG in `tmp/bloomthroat-iguana-v3-renders` was individually opened at native **600 × 720**, using original image detail, in hero/front/left/right/back/top/elevated-front/elevated-left/elevated-right/elevated-back order. Boards or WebPs were not substitutes for those inspections. Original approved hero is authoritative. World/Explorer nine-view AI images are approximate inferred hidden anatomy, not a calibrated ground truth or a real game capture.

`pin-verification.json`: **72/72 pass**: candidate checkpoint, all 33 deliverable size/SHA pins, seven reference/dependency SHA pins, ten final raw PNG SHA/dimension checks, ten retained v3 WebP SHA pins, ten retained raw v3 PNG provenance/dimension checks and camera-record equality. Checkpoint `baselineCaptures` means WebPs; raw PNGs correctly verify against v3 `capture-provenance.json`.

Directly compared producer capture code: same orthographic 5.3 scale, target (0.10, 0.18, 0.9), radius 8, ten azimuth/elevation pairs, 600×720 at 100%, Cycles 32 samples/no denoising, Standard transform/exposure -1.2, world color, ground height/material, three area-light positions/powers/sizes and aim. Candidate adds a two-thread execution limit only. No framing change explains the apparent anatomical gains. Baseline is preserved historical capture, not a fresh rerender. Camera equality proves matched source framing, not matching AI camera calibration or runtime equivalence.

## All-view observations

| View | Complete-next actual | Retained v3 actual / comparison |
| --- | --- | --- |
| Hero | Coherent rising back/neck, larger teal shoulder/cheek masses, heavier dark claws and broad tail tip improve identity. Muzzle is a flat-ended tube, exposed circular eyes are insufficiently integrated, dewlap reads as hanging hard strips. | Separate upright oval neck dominates, cheek beads form a regular rectangle, tail tip remains narrow, fingers look thin. Complete-next clearly preferred. |
| Front | Wider throat color and stout planted front feet read better. Oval snout end and stalk-like eye discs look unlike the hero's integrated brow/cheek expression. Throat lower contour is repetitive. | Narrow pleated throat and long splayed limbs leave a hollow chest impression. Face is also generic, but brow-to-muzzle has somewhat more variation. Candidate preferred overall. |
| Left | Sloping cervical line is a major correction; tail paddle reads. Neck transition is still abrupt, torso sides broad slabs, throat is narrow edge-on and hangs in rigid strips. | Detached-looking oval neck and floating-looking dorsal triangles break the long crest profile; narrow tail end and tiny claws. Candidate preferred. |
| Right | Same whole-body gain survives reverse view. Foreleg is angular/pillar-like; shoulder plates form a bulky cluster rather than flowing scale mantle; dewlap is thin and rigid. | Neck oval, bead cheek and thin limb ends recur. Candidate preferred without claiming hidden-side exactness. |
| Back | Thick curved tail with a recognizable enlarged end, broader haunch support. Crest remains sparse alternating pyramids; tail color blocks are too simple. | Thin dorsal fin line and tapering tail lack the hero's broad terminal leaf. Candidate preferred silhouette; v3 has more color variation. |
| Top | Tail end finally has substantial width; dark five-claw feet are legible; skull is more directed. Long rectangular trunk bands and isolated crest studs look schematic. | Round skull, pinched neck junction, tiny crest line and skeletal hands; highly triangulated tail coloration has more texture-like variety but weaker form. Candidate preferred anatomy. |
| Elevated front | Better forefoot mass and broad bloom shape; blunt oval muzzle/eye protrusions remain conspicuous. Torso reads like segmented bands rather than organic triangular planes. | Small fan throat, round disconnected head and thin digits. Candidate preferred identity and stance. |
| Elevated left | Integrated neck/back improvement holds; teal scales and larger tail end add identity. Head has a large planar cap, far eye looks like a knob, limb elbows are sharply mechanical. | Tall separate neck oval very conspicuous, cheek looks manufactured, tapering tail. Candidate preferred whole character. |
| Elevated right | Better descending dorsal profile and chunky claws; eye disc sits outside a broad block head, wrist scales repeat like bracelets. Tail tip foreshortening is expected and not clipping. | Baseline neck-to-body transition remains poor and feet spindly; extra triangular planes are visually livelier. Candidate preferred despite lower facet-style score. |
| Elevated back | Continuous silhouette and expanded tail paddle survive the angle; sparse crest and plain broad longitudinal bands weaken detail. | Narrow crest, separate neck/head lobes and patterned but narrow tail end. Candidate preferred form; hidden reference surfaces remain approximate. |

No obvious frame clipping prevents judging any of these ten views. Render grain is visible and common to both capture setups; it is not scored as anatomy.

## Consequential integrated corrections still needed

1. **Head, neck and expression together.** Replace the flat-ended tube muzzle and externally mounted eye discs with the hero's tapering wedge skull, embedded brow/socket and continuous cheek/jaw transition. Preserve the successful rising neck, but broaden its connection into chest/shoulders instead of adding another upright oval.
2. **Bloom volume and attachment.** Build a layered coral/pink fan with distinct overlapping lobes and varied facets, fuller through the lower throat and naturally rooted below the jaw. Current seven strips give a corrugated hanging-curtain effect, especially side-on; increasing size alone would not solve it.
3. **Organic stance and feet.** Keep dark stout claws, but make shoulder-to-elbow-to-wrist masses flow and vary toe splay/knuckle construction. Current forelegs are hinged blocks and wrist teal clusters resemble repeated bracelets; the hero has weighty muscular limbs and integrated scale patches.
4. **Crest, mantle and tail as one hierarchy.** Grow and vary the connected dorsal scale rhythm, including neck and tail root, rather than isolated equal pyramids. Keep the enlarged terminal paddle but improve curved taper, asymmetric leaf outline and teal/gold facet placement. Current large plain surfaces lose the hero's irregular triangular structure; avoid replacing them with uniformly noisy triangulation.

The new model advances multiple linked features rather than merely recoloring v3. Nevertheless, it remains visibly a simplified reconstruction. Source manifold checks, valid normals, skinning/packing parity and 192 numeric poses are useful engineering evidence only; none establishes likeness, animation quality, collision/death settling or gameplay readiness.

## Scope

Reviewed existing sources, metadata and pixels; wrote only this review directory. No models, runtime, captures, browser, build, Site or Git state changed. No new render or model workflow run. Builder says no further edits are planned for this checkpoint, so this verdict applies to the frozen source rather than an anticipated correction.

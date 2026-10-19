# Conch Duelist V10 repair — independent likeness review

Date: 2026-10-19 UTC. Scope: static visual likeness to the approved original, using actual Blender output. Verdict: **3.30/5; strictly above 3.5: NO.**

## Frozen evidence

- Approved original: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp`; SHA-256 `90073e7f4eae70b1e135c87740325d6a7a7da94c67cf761b03c5184c507a65cb`.
- Source: `art/driftwood-isle/approved-conch/build_conch_lowpoly_v10_repair.py`; SHA-256 verified `dc4323505e4c18652505ecca9362a097b5f348e55a1f03d348bf89717bd7d358`.
- Actual GLB: `tmp/conch-v10_repair/conch-study.glb`; SHA-256 verified `a2b10ba9e6fc4d29f41b644ac484e51fc4cc02755abe6d889455f057413c30b2`.
- Comparison board: `tmp/conch-v10_repair/comparison-v10_repair-board.webp`; SHA-256 `6b510e9d203601620e2cfc9340236b0eeb54922ffe5c30e2faf4ea08f19502b3`.
- Nine-view board: `tmp/conch-v10_repair/nine-view-v10_repair-board.webp`; SHA-256 `fc8acdb447f853705af0781da89fa18d30b870c9d71c115b47444024093224e1`.
- Inspected the original, comparison board, full hero `color-front.png`, nine-view board, and every full frame `color-v10_repair-{front,left,right,back,top,diag-front,diag-left,diag-right,diag-back}.png` in that evidence directory. Boards were not substitutes for full-frame inspection.

Read repository AGENTS, GIT and coordinator STATE. No earlier review documents were consulted; scores below are assigned from this candidate and the original. STATE contains historical status, which is not used as scoring evidence. Closure/crossing audits and successful render exits are structural evidence only, with no likeness credit.

## Exact rubric

| Category | Weight | Score / 5 | Weighted contribution |
| --- | ---: | ---: | ---: |
| Silhouette and proportions | 35% | 3.50 | 1.225 |
| Face and character | 30% | 3.00 | 0.900 |
| Distinctive details | 20% | 3.25 | 0.650 |
| Facet style and palette | 15% | 3.50 | 0.525 |
| Total | 100% | **3.30** | **3.300** |

Calculation: 3.50 × 0.35 + 3.00 × 0.30 + 3.25 × 0.20 + 3.50 × 0.15 = **3.300**. No rounding or cross-enemy averaging changes the failed threshold.

## Findings across the views

The model is immediately recognizable as the intended conch warrior: tall cream/coral shell, deep orange aperture, burgundy limbs, separate golden stalk eyes, a large defensive claw and a long pale thrusting claw. The open cavity has real depth in front and diagonal-front views. The asymmetry and crouch survive the walk-around evidence.

1. **Shell proportions and surface rhythm remain the largest silhouette gap.** The target's tall, tapering, diagonally interlocked whorls have irregular angular ridges and a sharp swept opening. The actual side and rear views resolve into bulbous stacked circular tiers with broad cream shelves and nearly continuous orange belts. The hero partly disguises this rotational regularity. Top and diagonal-right also show a broad cap and long planar lip. The reference has no authoritative rear view, so unseen anatomy is not being scored against an invented rear design; these views expose how the visible target forms were constructed.
2. **Face is legible but lacks the target's predatory expression.** In hero/front/diagonal-front the eyes are flat, thick-edged quadrilateral plaques with simple slit pupils; the original has sharper tilted almond-like sockets and stronger brow/eye shaping. The actual orange face is a largely planar triangular pendant with tiny nostril marks. It misses the target's cheek volume, descending hooked beak and layered transition into the chest. The stalks and palette establish identity, but expression and sculptural integration are weaker.
3. **Body and defensive claw are over-simplified.** The target has a compact armored chest, differentiated dark belly plates, substantial shoulders and muscular, sharply bent limbs. The actual torso reads as one elongated burgundy pod, particularly from the back; shoulder and knee pieces read as separate blocks. The shield claw has the right broad function and colors but is an oval/leaf-like slab with a long straight cream division, missing the target's more jagged, swelling, asymmetric faceted shell shape. The narrow attacking claw is recognizable, though sparse in intermediate ridges and color breakup. Feet are small and paddle-like beside the target's more substantial angular toes.
4. **The broad low-poly language is correct; the facet composition is still generic.** Flat shading and the cream/coral/burgundy palette fit. Broad uniform orange strips, pale shelves and repeated limb polygons lack the reference's varied triangular value planes. Render grain is not treated as geometric detail, and studio lighting differences alone are not penalized.

## Most useful next correction

First reshape the shell whorls away from broad circular shelves toward taller, uneven, interlocking diagonal wedges while preserving the valid open cavity. In the same bounded likeness pass, give the eyes shaped pointed sockets and the beak cheek/hook volume, then break up the plain torso and shield into the target's authored masses. Re-render the same hero and full nine views; do not substitute topology success for a new visual review.

This verdict covers only the frozen candidate's static likeness. It makes no claims about rigging, animation, combat, gameplay, performance, runtime admission or fun. No production or model assets were changed by this review.

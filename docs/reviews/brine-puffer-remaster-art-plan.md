# Brine Puffer: artistic remaster plan

## Purpose and current verdict

The goal is a recognizable, coherent, animated low-poly Brine Puffer that closely matches the owner-approved reference, not a higher version number or a flattering render. The owner received the ranked artistic plan on 2026-10-19 (message Sentinel_0678010cb62481919a47490e91df85bb). Execution starts after the current arena-lighting work is resolved.

Reference authority: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`. Derived nine-angle AI references are approximate studies of hidden surfaces; they cannot override the approved original or define contradictory tail orientations.

Preserve V71, every earlier source and failed study, and the tested playable candidate. V71 is the latest retained static study, with modest improvements over V70. The fresh independent reviewer scores it 3.60/5: silhouette 3.5, face 3.5, details 4.0, facet/style 3.5. Earlier incremental reviews rated some versions more highly; that disagreement remains visible and is not resolved by choosing the most favorable score. V71 is not a final accepted model.

The stopping condition remains an honestly reviewed 4/5 or V100, whichever comes first, followed by work on the other four creatures. This plan promises a better-directed process, not an automatic 4/5 result. Do not manufacture versions to approach the cap.

## Diagnosis

The inherited model architecture now limits likeness more than missing detail. Its mantle starts as ten axial sections with fourteen angular sectors. Staggering axial samples removed some ring edges but left long, nearly horizontal longitudinal flank connections. Repeated unions and surface patches improved closure while retaining a separate pouch, broad side transitions and an assembled appearance.

The facial construction descends from V9's forward eye discs, extruded brow shapes and return walls. Repairs alternated between exposed cylindrical sockets, hidden pupils, thin bars, rear tabs and folded cheek strips. V70's compact volume is a useful local improvement, but a closed convex brow is not automatically the thick, seated wedge in the reference.

The fins similarly descend from lofted ankle sections and appended toe solids. Their volume and angular ends improved, yet they still tend to read as extended legs rather than short, broad, weight-bearing flippers. These are architectural issues. More polygons, random color variation, higher-resolution textures or dramatic lighting will not resolve them.

## Ranked artistic priorities

1. **Unify the body and pouch.** Author one compact skull-to-cheek-to-pouch cage with a rounded upper mass and broad lower planes. Preserve the successful dominant cream belly, but remove the separate helmet-and-ball read and square lateral transition. Treat inherited lattice vertices as construction history, not mandatory artistic anchors. Compare core width, height and depth in fixed front, side and hero views; camera uncertainty prevents inferring exact 3D dimensions from the concept alone.

2. **Design an integrated face.** Build orbital boundary loops directly into the new head cage. Seat a thick, tapered orange brow over a readable rounded amber lower lobe, with warm cheek planes connecting to the muzzle. Preserve expression and visible pupils across views. Permit deliberate, documented landmark changes where reference fit requires them rather than protecting flawed V9 geometry indefinitely. Do not return to independent eye cards, long socket tubes or detached brow tabs.

3. **Make short fin-fans carry the body.** Use continuous shoulder-to-fan topology, with a buried broad root, sloping dorsal surface and shared radial ridges. The body should sit low between the fins. Four broad angular terminal lobes should form a coherent cream edge with shallow valleys, not a row of teeth or cuboid paw digits. Preserve floor contact and useful ground footprint, then re-author attachment weights for the new topology.

4. **Shape the mouth as anatomy.** Keep an open, expressive dark cavity and readable coral tongue. Form a compact ivory upper arch with nostril-bearing peak and a lower transition flowing into the pouch. Retain the successful removal of the central intrusion and detached lower rail. Do not enlarge the mouth without consistent opening-only measurements; prior measurements sometimes included the surrounding cream lip.

5. **Author the planes deliberately.** Replace latitude-driven belts with a small number of purposeful broad, gently convex planes. Use actual topology and volume, not paint noise or raised shingles. A restrained sculpt or proportional-edit blockout can guide the cage, followed by intentional low-poly retopology. Avoid automatic decimation as the final artistic decision. The failed fixed-vertex diagonal flips demonstrated that manifold meshes can still develop deep concave flutes.

6. **Keep a clear spine hierarchy.** Preserve the successful broad, left-biased primary crown wedge as a reference point, with fewer subordinate shoulder spines. Roots must visibly emerge from the body without floating caps or collisions. Do not claim that every cap corner is buried: inherited partially exposed corners have been documented, and visible seating plus measured clearance must be reassessed on the new cage.

7. **Retain a true tail fan.** Keep one modest, irregular, closed fan with tapered thickness and an ochre border on its visible face. The retained tail study improved this. Its orientation must be coherent in 3D, not rotate toward each camera as some derived AI views imply. Preserve an attached root and useful animation pivot.

8. **Paint large coherent regions.** Teal mantle, warm ivory pouch and burnt-orange facial accents should follow anatomical planes. Avoid rectangular masks, racing stripes and per-triangle confetti. Evaluate unchanged albedo in the actual game before warming it to compensate for a studio render: the game uses toon shading and grading that differ from Blender's studio setup.

9. **Give thickness and motion equal attention.** Thin profile sheets, unsupported return faces and exposed root caps must fail review even if the hero looks attractive. Use the motion-safe body-to-belly-to-head hierarchy as a starting point, with explicit new bind and weight audits. Blend roots into body motion and allow distal fins to move. Validate breathing, brace/release, hit, death and stepping in actual runtime; neither numeric continuity nor a floor-safe sweep proves visually planted feet.

10. **Use a blind three-blockout gate.** Produce three genuinely different anatomical blockouts, not three minor parameter changes. Review anonymous fixed-camera comparisons against the original before choosing one. Include a more compact continuous pear-shaped body, a broader low-slung cheek-and-pouch interpretation, and a distinct but reference-grounded shoulder/fin arrangement. The alternatives must remain the same approved creature. Select the strongest shape and expression before committing to detail, paint or rigging.

## Execution sequence

### A. Reference and blockout

Create an explicit landmark sheet from the approved image and existing actual views. Separate visible facts from inferred hidden anatomy. Establish the same hero, front and both side cameras, neutral clay lighting and framing for all three blockouts. Keep a V71 comparison beside them. Review silhouette, eye-to-mouth balance, pouch integration and fin stance first.

The independent reviewer selects the strongest candidate or rejects all three with specific visible reasons. Do not award detail credit to an unfinished blockout or mistake a prettier presentation for a better shape. A branch with repeated clear regressions should be reconsidered rather than repaired indefinitely through tiny additions.

### B. Deliberate cage and facial construction

Build the chosen continuous low-poly cage with editable topology. Use broad sculpting only as a volume guide; retopologize the orbital, cheek, mouth and fin transitions intentionally. Establish the face in clay and flat color before sparse surface details. Keep checkpoints before each substantial anatomical operation.

Structural checks remain hard: finite positions, nondegenerate faces, consistent orientation, appropriate closed components, no unintended intersections, measured attachment clearance and documented silhouette changes. Use convexity checks only where the intended anatomy is convex. Do not force inherited nonconvex boundaries into a global convexity assumption or relax failed guards merely to obtain an export.

### C. Paint, sparse detail and rig

Assign the large color regions along the new planes. Add the restrained spine hierarchy, tail border, nostrils and tongue after the main shape passes. Rebind the new topology using explicit bone names and normalized weights. Keep skull, socket rims and eyes moving coherently during inflation; independently animated head parts must not detach from surrounding skin.

Preserve an editable Blender working source locally and ordinary reproducible generator/mesh/native sources suitable for the repository. Respect existing storage gates: heavy working scenes and reproducible GLB exports may remain in ignored temporary storage, while genuine runtime-native JSON, source, receipts and compact evidence form the ordinary closure. Do not wrap or chunk binary backups to evade budgets.

### D. Actual runtime and independent review

Capture the unchanged candidate in the established fixed nine views plus the original hero. Include clay, flat-color and actual-game views when they clarify whether a problem is geometry, paint or lighting. Keep camera and exposure changes explicit; do not optimize presentation to hide profile defects.

Run real animation and combat checks on the new bind mesh, including stop/resume, turns, attack, hit interruption, death/retry and ground/root behavior. Preserve the currently tested playable fallback until the replacement passes its own visual and functional gates.

## Review contract

Use the fixed weighting: silhouette 35%, face 30%, details 20%, facets/style 15%. Ask the independent reviewer for component scores and visible evidence before computing the total. Keep uncertainty, reviewer disagreement and hidden-surface assumptions explicit. Score full-view candidates with comparable evidence; do not compare a favorable hero-only estimate to a complete nine-view assessment as if they were equivalent.

No score is promised by this plan. The meaningful result is a coherent creature that looks closer to the approved original from multiple angles and remains convincing while moving in the actual arena.

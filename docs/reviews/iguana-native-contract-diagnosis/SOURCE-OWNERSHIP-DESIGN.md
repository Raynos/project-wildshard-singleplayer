# One bounded Iguana source-ownership design

2026-10-20. Design only. No model, rig, pose, engine, admission or physics change. Companion to REPORT.md.

## Verdict

**The selected geometry and independent animated-death transforms do not fit an exact, unpadded eight-rigid-part interpretation unchanged.** A concrete eight-owner source candidate is possible only by substantially re-authoring the anatomy into eight genuinely convex, rigidly moving solids. Its point budget fits; its likeness and animation costs are substantial. Do not mistake that budget result for a desirable visual candidate or contact acceptance.

The recommended design experiment is one eight-solid anatomy variant, not a parameter sweep and not invisible collider enlargement. The rendered anatomy and collision solids must be the same authored shapes. Preserve the selected original; do not categorically relabel its existing skin weights. If retaining the curled tail, seven separately folding petals, bent/toed limbs and independent head/neck articulation is mandatory, this particular eight-solid candidate is unsuitable. That is a concrete source-design limit, not an invented approval gate or permission to expand the engine.

## What the existing source actually requires

The retained source has 11,610 triangle corners / 3,870 triangles, 27 bones and 16 render parts. Corner counts include repeated positions.

- Tail: 528 corners / 176 triangles / 90 distinct positions. Of these, **420 corners / 70 distinct positions** have two influences, affecting **160 triangles**. Tail0–tail3 have distinct transforms over the authored motion, so this is genuine continuously blended deformation, not a single rigid surface.
- Four legs together: 6,048 corners / 2,016 triangles / 1,136 per-part distinct positions. There are 480 two-influence corners / 80 positions / 240 affected triangles. However, shin and foot local transforms remain constant relative to their leg root in the present clips. Their skin transforms are therefore identical to that leg root's skin transform. These mixed weights do **not**, by themselves, require extra collision owners. Their concave bent-limb, separated-toe geometry remains a different problem.
- Seven petals: 546 corners / 182 triangles / 105 per-part distinct positions. Each petal is rigid to its own bloom bone, but the seven relative rotations differ. Death Z rotation includes (j−3)*.045*d and the diminishing phase-offset wave, so the flower cannot retain these seven motions on one rigid hull.
- Body: 612 corners / 204 triangles / 114 positions. Neck: 636 / 212 / 130. Head: 3,012 / 1,004 / 560. Jaw: 228 / 76 / 40.

Even ignoring tail and limbs, exact unpadded rigid support of the seven distinct petal volumes plus body, neck and independently rotating head requires ten distinct moving support owners. This lower bound assumes preserving the actual non-symmetric solids and their authored transforms, not allowing a broad enclosing shape or a bounded-envelope substitute. The engine allows eight named-bone convex parts, with no repeated bone name. A copied or enlarged hull cannot eliminate that ownership mismatch.

## One candidate: eight real anatomical solids

Keep actor root on the ground, metre units and +Y/+Z conventions. Keep absolute bind definitions with exactly one parent subtraction. Author this variant from anatomical sections, with no transparent fillers and no ignored leaves:

| Owner | Actual rendered/support solid | Required source change |
|---|---|---|
| body | Continuous convex torso with integrated ridge | Rebuild rising torso/ridge as one convex volume; flatten/reintegrate isolated ridge peaks and source cross-sections where required by living hit ownership. |
| head | One convex cervical/skull wedge | Merge cervical mantle and skull articulation; redesign the lower neck/skull transition rather than keep an unsupported concave bridge. Preserve eyes/markings as surface facets or colour. |
| jaw | One thick convex hanging throat/flower-and-jaw solid | Replace seven separate overlapping/folding petals with a continuous flower-shaped fan/lobe mass; seven coloured surface regions may remain, but no unsupported scallops, loose petal tips or hidden gaps. |
| tail0 | One convex tapered leaf-tail solid | Remove the hooked return/concave curl; author a swept but convex leaf wedge with a broad terminal silhouette. No frozen copy of the weighted curl. |
| legFL, legFR, legBL, legBR | Four separate convex muscular limb/paw wedges | Rebuild elbow/knee hollows and toe gaps into coherent convex limb-paws. Toe and claw markings become facets/colour on real supported silhouettes, not exempt protrusions. |

Each entire rendered solid has one authored rigid owner by construction. This is a new mesh/rig design, **not** “assign every current vertex to its largest influence.” No triangle may cross different moving owners. Overlapping closed attachment volumes may hide joins, but must remain genuinely rendered solid tissue; do not add invisible collision bridges between appendages.

### Quantified budget and exact cost of naïve preservation

I computed read-only convex hulls of the existing source positions in these eight groups with the already installed THREE ConvexHull. These are diagnostics of the candidate's topology/budget, **not** a proposal to install those enclosing hulls around unchanged render meshes.

| Group | Current triangles | Hull extreme points | Hull triangles | Current triangles not on that convex boundary |
|---|---:|---:|---:|---:|
| body | 204 | 79 | 154 | 138 |
| neck + head | 1,216 | 66 | 128 | 1,191 |
| jaw + seven blooms | 258 | 56 | 108 | 232 |
| tail | 176 | 46 | 88 | 168 |
| legFL | 504 | 55 | 106 | 476 |
| legFR | 504 | 54 | 104 | 469 |
| legBL | 504 | 54 | 104 | 476 |
| legBR | 504 | 53 | 102 | 471 |
| Total | 3,870 | **463** | **894** | **3,621** |

All eight point counts are below 128; 463 is below the 512-total limit, leaving 49 points of headroom. This establishes a finite eight-solid topology budget using actual source points, not a guessed decimation target. It does not establish the eventual aesthetically authored solids' point count: retain these per-solid budgets as ceilings and verify the final convex extremes.

Boundary counting method: each original triangle counts as lying on the proposed hull boundary only if all three vertices are on one hull supporting plane within 1e−7 m. 3,621 triangles fail that specific candidate-boundary test. It does not mean 3,621 original triangles are individually invalid, nor prove every possible eight-solid model must change exactly that many. It quantifies how destructive naïve convexification of this one candidate would be. Original internal detail can remain colour/copanar detail, but cannot remain the same exposed concave surface while claiming it equals the convex support solid.

Tail alone makes the padding danger explicit: its actual closed component volume is .6613890638068368 m³; the single hull volume is 1.2298889925152887 m³, approximately 1.86 times as much. About .56850 m³ is filled by convexification. Installing that hull under the existing curled tail would be substantial invisible support, not an exact native contract. A genuine tail redesign is required.

## Rig and motion changes, including animated death

Use eight independently moving owners above; any retained non-owning cosmetic bone must have a fixed relationship and no independently deforming surface. Numeric channels still read the authoritative strike clock. Do not substitute captured death.

- Body retains ground-relative root and torso pivot. Root remains exclusively physical during death.
- Fold neck motion into the head/cervical owner's animation. Current separate neck and head X rotations cannot both be retained with their original pivots. A new single-pivot head/cervical nod must be authored against the same tell/active/recovery phases. Risk: less organic bite reach, changed silhouette arc and weaker tell.
- Jaw/flower remains a separate owner for bite opening and an animated droop during death. Replace the seven independent petal Z/X channels with one coherent fan droop/spread silhouette encoded in the **new geometry**, not seven continuing articulations. Risk: major loss of flower flutter, layered petal readability and defining bloom anatomy. Do not call colour divisions equivalent to seven moving petals.
- Tail0 performs a coherent restrained sweep and death sag of the new convex leaf solid. Remove the old four-bone weighted curl deformation. Risk: loss of curled paddle silhouette and trailing flex; stronger rigid-leaf read.
- Four limb-paws retain separate gait ownership. Their existing descendant-fixed weight blends can be expressed exactly under each leg owner, but the actual concave limb shape must be re-authored. Authored translation-only lifts need review against the new solid's ground contact; no root lift is allowed. Risk: broad mitten feet, weaker five-toe/claw anatomy, and puppet-like stride.
- Corpse recipe uses bone-local bind points from the same solids. For each point v in actor bind space, store inverse(G_bone_bind)*v, without actor scale. Existing prepareRigidCorpse and fixed numeric RigidCorpsePose own hull transforms and local death progression. Render interpolates published local endpoints; no render-owned second death clock.

This retains an animated death in principle, but not the original death motion. Limb and flower losses are real, not automatically acceptable because a structural contract fits.

## Living hit volumes: actual semantics and a bounded choice

The existing live support is not an arbitrary hull list:

- bodyAt is body-bone-local centre; bodyPitch rotates the Z capsule axis toward +Y; neither creates another volume.
- fore is one capsule along the named bone's local **X** axis, with centre at its bone-local `at`. It is a body-damage volume, not a second free longitudinal capsule or an arbitrary convex hit hull.
- headAt/headRadius describe one head-bone sphere. They cannot follow a separately moving lower jaw/flower unless geometry stays inside that sphere throughout motion.

For this candidate, assign main torso to the body-owned tilted Z capsule, shoulder cross-section to a body-owned fore capsule, and cervical/skull tissue to the head sphere. The fore centre comes from the designed shoulder section; its half-length is transverse, not along the rising spine. Body ownership of the fore prevents body-owned chest relying on head rotation for coverage. The **new rendered solid must be authored within its declared volumes**, not the reverse process of repeatedly expanding hit radii until the old sculpture fits.

A single source-derived sanity check demonstrates why bodyAt/bodyPitch alone is not an unchanged-source fix. Using the current trunk's first and last section centres, (0,.63,−1.08) and (0,1.26,.82), gives bodyAt=(0,.165,.07), bodyPitch=.3201707768798952 radians, bodyHalfLen=1.0008621283673391. With radius retained at .623, **108 of the 492 current trunk corners still lie outside this capsule**, maximum radial distance .693751896809865 m. This was direct geometry arithmetic for one anatomically defined axis, not a radius/angle search or a physics test. Do not implement these numbers as a fix. They establish the need to author the actual cross-sections/support partition, including fore semantics, rather than merely point the old capsule uphill.

A final contract must declare what counts as damage-bearing anatomy. This design does not magically give independent live hit volumes to four paws, tail and moving flower: existing live API has only the stated capsule(s)/sphere. If full exact independent live coverage of all eight solids is required, this eight-solid candidate has an additional unresolved limitation and must not be declared representable under the present live API. No leaf/petal exemption is introduced here; all eight solids remain mandatory corpse collision geometry. The current observed live blocker is continuous trunk coverage, and this design specifically resolves its ownership concept, not an unverified all-body damage-volume claim.

## Concrete next deliverable and stop condition

Author one source anatomy diagram and explicit section/owner specification for the eight-solid variant, retaining the numerical budgets above. It must show the changed tail, flower, limb and cervical silhouettes honestly beside the selected reference. Resolve the trunk/fore/head support partition analytically against that actual source. This is ordinary source-design work, not a request for generic physics expansion.

Do not implement the diagnostic convex envelopes as invisible colliders; do not repeat old fallback physics runs. If the proposed visual anatomy cannot retain a recognisable Bloomthroat Iguana, record that failure and retain the selected original as source-only. If a coherent eight-solid variant is authored, then and only then its own source/packed parity, live coverage, animated fixed/render ownership and actual world-contact measurements can determine admission. Neither the 463-point budget nor convex containment proves runtime floor contact.

No acceptance granted. Only this design document was added; no production/model source, active Conch file, dependency, Git state or publication was changed.

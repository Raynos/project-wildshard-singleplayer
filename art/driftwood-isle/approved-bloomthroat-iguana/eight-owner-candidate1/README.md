# Eight-owner Iguana candidate 1: rejected before physics

2026-10-20. One isolated editable source candidate, not gameplay admission.
The selected complete-character-next source is preserved and pinned. No older
fixture was substituted. No app, browser, render, physics world, Mac task,
production asset, schema, core file, Git state or public site was changed.

## Verdict and exact first blocker

The actual `packedCreatureBodies` consumer rejects metadata synchronously at
`src/game/plugin/geometry.ts:1328`:

    Invalid key: Expected never but received "bodyAt"

Its strict `PackedBody.dims` at lines 1325–1327 permits rigidCorpse plus legacy
scalar dimensions and capsuleAxis, but omits bodyAt, bodyPitch, headAt and fore.
AnimalView implements these fields at its live-query boundary, but that does
not make them accepted by this packed input boundary. The load callback was
never invoked. No fields were stripped, substituted after parsing or admitted
through another path. No schema expansion was attempted. All four initial
consumer-based tests stopped here; downstream skin/pose/contact work did not
execute. `blocked-validation.ts.txt` retains that first test attempt, explicitly
marked blocked rather than passed.

The final four focused tests PASS as preservation, recipe-schema, standalone
numeric-program and expected-rejection tests. This is **not candidate admission**.
No full typecheck or app build was run. The repository lint tool selected no
art files even with no-ignore, so no lint-clean claim is made.

## Source and anatomical ownership

The original builder, native source, metadata, payload, GLB and construction
record all match the six exact pins in ownership.json. Every one of 11,610
corners / 3,870 oriented triangles, its float64 source position, linear color,
fur channel and packed float32 position/color bytes remains unchanged. Flat
normals computed from both sets of identical ordered float32 triangles are
exactly equal. The original GLB and its exported normals remain untouched;
no new GLB or normal-export equivalence is claimed.

The new rig has eight explicitly authored owners, not largest-weight labels:

- body: complete original torso and its body-owned ridge detail. Pivot unchanged.
- head: complete neck, skull and jaw assembly, about the original neck pivot.
  This retains all bind anatomy but removes separate neck/head articulation and
  jaw opening. A single combined nod/thrust is not equivalent original motion.
- bloom0: seven layered petals forming one anatomical throat flower. Its actual
  common flower attachment pivot is retained. One sway/droop replaces independent
  petal flutter; grouping and visual quality remain unaccepted.
- tail0: entire curled tail about its original base. Curl is preserved; blended
  four-bone flex is replaced by a single rigid sweep. No tail straightening.
- legFL, legFR, legBL, legBR: each entire limb/paw, including toes and claws,
  on its original leg pivot. One owner each; no unrelated appendages grouped.

Parent-local binds subtract the parent absolute position exactly once. Actor
root remains ground-based, metres, +Y up/+Z forward, no root translation/scale
channel. The exact strike clock remains windup .75 s, active .16 s, recovery .9 s.
Numeric programs are registered for the existing pose owner and remain continuous
at those boundaries. Death remains an authored animated pose, never captured.
Actual RigidCorpsePose integration was blocked by packed admission and is unproven.

Ownership.json enumerates every part's complete triangle range and owner; each
triangle's three corners has exactly one common owner with weight 1. All original
weighted sources remain unchanged. No original animation preservation claim is made.

## Source-derived corpse support

Each hull consists only of extreme points of its own component's actual packed
float32 positions, translated into that owner's bind frame. No actor scale,
padding, decimation, future-pose envelope or fitting sweep is applied.

Recomputed counts: body 79, head assembly 72, flower 44, tail 46, legFL 55,
legFR 54, legBL 54, legBR 53. Total **457**, each below 128 and total below 512.
This happens to equal the earlier diagnostic, but was recomputed from pinned
current bytes. Existing format and engine recipe validators pass. Every selected
extreme is an actual source point, and every component vertex is in its hull.

Since each complete triangle shares a single rigid owner, convexity proves
triangle containment for every shared owner transform. Since all hull extremes
are retained source points, plane support extrema of the component and hull
coincide for any shared transform. This conditional algebra is not collision
acceptance: no Rapier hull allocation, fixed-step contact, root trajectory,
render interpolation or lifecycle integration was tested.

## One live descriptor, and a second necessary-condition failure

There was one descriptor, no parameter sweep:

- Torso capsule: axis through the producer's first/last trunk section centres
  (0,.63,-1.08) and (0,1.26,.82), translated into body-local bodyAt. bodyPitch
  tilts its local Z axis toward +Y exactly as AnimalView does. Radius is the
  maximum source body distance to that segment, not an arbitrary added margin.
- Head sphere: centre of the cranio-cervical assembly's source bounds, translated
  to headAt; radius is its maximum point distance. This shape follows head only.
- fore: a flower-owned local-X capsule using the flower's actual transverse bounds
  and maximum transverse-segment distance. It is not an invented longitudinal
  extra torso, and does not provide extra volumes for the tail or four limbs.

All three named components fit their own same-owner convex shape at bind;
therefore each whole triangle stays covered by that shape under any common
rigid owner transform. This does not infer triangle coverage from vertices
assigned to different members of a shape union.

After preserving the real format rejection, a source-only necessary-condition
check of that same descriptor found **6,132 corners outside all live shapes**
at exact authored idle t=0, speed=0, flinch=0, deathT=-1, strike phase=0.
Standalone numeric evaluation confirms this input produces the bind transforms.
This is not a decoder bypass or a physics trial. Its worst witness is tail
triangle 120, corner 362, point (1.623482346534729,1.8307499885559082,
-1.40488862991333). Outside margins for body/head/fore are respectively
1.3503159654574999 / 1.8399297531809142 / 2.505224790938939 metres.
The complete part/triangle assignments and exact shape endpoints are retained
in live-source-witness.json. Only 1,771 of 3,870 triangles have a single-shape
coverage certificate at this pose. The other triangles are not waived.

One valid authored-pose counterexample disproves full-pose live coverage.
This particular descriptor therefore also fails even apart from the format
boundary. It is not a proof that no alternative generic design could work, nor
permission to enlarge shapes, waive appendages or change the engine.

## Reproduce and stop

From repository root:

    node art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1/build.mjs
    node art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1/diagnose-live.mjs
    node_modules/.bin/vitest run art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1/source.test.ts --config art/driftwood-isle/approved-bloomthroat-iguana/eight-owner-candidate1/vitest.config.ts

The builder refuses changed selected-source pins. Only the candidate directory
is written. The final expected-rejection test must keep the actual consumer
fail-closed. The candidate is stopped: **zero four-direction contact trials,
zero app builds, no public integration or gameplay admission**. Resolving the
format boundary alone would not resolve the demonstrated live coverage failure.

Delivery normalization: removed only the excess trailing blank line from checks.log
for whitespace screening. Substantive test diagnostics are unchanged.

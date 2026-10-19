# Conch motion3: bounded contact candidate, unaccepted WIP

The approved static character milestone remains 3.57. No static shape, native packed payload, bind skeleton, dimensions, combat/AI or shared engine code changes. Motion2 and its failure evidence remain intact.

## Authored changes

- Remove living root bob and whole-body pitch so support does not rise during guard, thrust or recoil. Upper shell/head/arms carry reaction.
- Alternate 3.5cm hip lifts and small yaw steps, with one foot down; this is a contact trial, not a validated no-slip gait.
- Raise the rapier windup and hit reaction. Motion2's downward tip penetrated after simply lowering the body. Give counter windup a separate 0.28rad lateral arm cue; retain real attack clocks.
- Preserve the folded death rotations. Replace blanket +0.36m death lift with 97 uniform deathT samples derived from all 7338 vertices and all four skin weights. Use four normal bounded sample nodes, not a new engine evaluator or relaxed schema. Target 3mm support, with interpolation tested between knots.
- Suppress gait/attack activation as soon as deathT reaches zero, regardless of stale retained AI fields. Other upper-body reaction fades with collapse.

## Evidence and limits

`offline-contact.json` has 7590 independent dense states: 5775 death and 1815 living. Stages, stale attack clocks/guard, flinch, phase, yaw, and uniform scales 0.75/1/1.25 vary. All retain nonnegative support and a vertex within 2cm; global minimum support ranges approximately 2.20–6.22mm. This is geometric support, not a collider or foot-sliding test.

The separate old event-order1 replay covers all734 captured world transforms. Candidate living584 samples have minimum support3.00–4.98mm; nine collapse samples approximately2.98–3.00mm; settled141 samples exactly3mm. All four weights are evaluated;94 vertices are blended.

Baseline uses the actual captured local bone transforms and matches every independent NumPy frame minimum within1e-10m. It retains546/584 living support gaps and141 corpses at15.0365cm. Several captured context records expose a newly applied flinch after the rendered pose, so candidate replay uses observed frame inputs and captured actor worlds, not an invented simultaneous motion2 pose. Idle phase is recovered from its rendered shell rotation.

All captured actor worlds remain upright (yaw only). The authored height curve is scoped to this isolated arena. It is not valid evidence for arbitrary world-rotated physics ragdolls, uneven ground, unsupported scale, or changed current-host death behavior. Fresh current-host capture, weighted verification and visual review remain required. Animation/contact/runtime acceptance are false.

## Reproduce

Run `node node_modules/vitest/vitest.mjs run test/conch-planted-contact.test.ts test/conch-planted-preview.test.ts` and `node --test scripts/conch-planted-admission.test.mjs`.

To explicitly rebake only the authored curve: `CONCH_BAKE_CONTACT=1 node node_modules/vitest/vitest.mjs run test/conch-planted-contact.test.ts`. Then rerun tests and regenerate the strict admission hashes and closure before any build.

Once the heavy lane is assigned, build a new product with `python3 scripts/heavy-lane.py build -- node scripts/build-conch-planted-preview.mjs tmp/conch-planted-preview/motion3-build1`, then build the app with `CONCH_PLANTED_PREVIEW_DIR=tmp/conch-planted-preview/motion3-build1 python3 scripts/heavy-lane.py build -- node scripts/build-conch-planted-preview.mjs --app tmp/conch-planted-preview-dist-build1`. Capture with the existing full-body observer using explicit new output/dist variables, preserving old evidence. The host must include retained-dead/borrowed-subject fixes e5f1e73 or newer.

# Independent selected Conch complete-motion source review

2026-10-20. Separate review of frozen `art/driftwood-isle/approved-conch/selected-complete-motion/`, not a review of the concurrent actor-handoff code. No source edits, physics, native construction, test suite, build, Git or public write. The only authored artifact is this report. Independent in-memory Python/NumPy/SciPy inspection and numeric DAG/FK calculations took under a second each; no heavy lane was used.

## Verdict and must-fix boundaries

**The exact eight-group support invariant is supported by the authored channels. The candidate is not ready for native runtime admission.** Two concrete source/composition problems must be resolved, not deferred to a cosmetic quality score:

1. **Facing contract missing:** the candidate faces/extends in selected-local -Z, but the intended native animal moves forward +Z at yaw0 and publishes root yaw directly. No source-to-actor facing conversion appears in this candidate. Direct attachment would render a backward-facing actor. This is a composition defect, not evidence that the selected-local rapier rotation signs are wrong.
2. **Living flat-floor contact cannot remain at ready calibration:** fixed-root gait lowers selected geometry by 43.462600mm below its ready-pose minimum at distance .1625m. A root placing the ready pose at floor cannot also keep that gait pose clear. This is an exact analytic witness, not an observed Rapier penetration. It requires a legitimate source/contact solution, not padding, arbitrary root lifts, anatomy exemptions or a claim that conditional corpse support solves living contact.

Neither finding invalidates the conditional convex-support mathematics. Conversely that mathematics and the author's six tests do not waive either finding. No motion/readability score is assigned. No app build or promotion is approved.

## Frozen identity and checks actually performed

All twelve files listed in freeze.json independently hash-match their frozen entries. The original selected source remains 6,570 corners / 2,190 triangles / 15 bones / 94 blended corners, not the canonical 7,338-corner fixture.

| File, relative to selected-complete-motion | SHA-256 |
| --- | --- |
| freeze.json | e3592c6daec7316502b08d2ef2656fac8091b3a8acb90004c2db29ea92222f6c |
| prepare.py | 3369682177f8a8e0a0fdd467533d0a2c8f52b2cef8a0b5df475136b518f83b80 |
| poses.json | bf4cee61c1679bff1d32d4b5dcd0b7f6fb4be7ae1315901cd1b73d1fd53e9ea3 |
| recipe.json | 90d78b653ae6b319445b07e8b6c280b5cdafd883ab6720868c0b5c9935f86e54 |
| ownership.json | e3e4921c10ddfb2bc8d0ce2cb4adae28371c8afd17c0444a963755ae0617f110 |
| admission.mjs | 6434f21da13591ca87f2995fe0752387080b2e287ed3dd631f9d5c8ed9a80076 |
| motion.test.ts | a1e5f1f4a074b1d9fe26c5e9bc664d916df7b3674ca07bf4398e312b0b5509f6 |
| final-receipt.json | e2586785891d506a724ef18d0317ba1adbc24cb18c4599c4d594158ffb46f1c3 |
| weight-support.json | ac5d4a40a204a8d46976bf9df3d2acc7668359e9da17f4f08c5bbe2c51caeceb |

Underlying selected JSON hash is `3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929`; color metadata is `99a4920df2bb3fa4368e456b38b40e27e85d905bcccdee8e93776bf0902ae219`; color payload is `640861d7e12003814917b45d38d622a3e796084cf0b86bf88d01353ecfdc4cbb`. Full earlier selected source/normal-channel verification and the original hinge counterexample remain in `../conch-selected-support-audit/REPORT.md`.

The author's final receipt reports six passing focused source tests, strict TypeScript pass, strict recipe/Rapier hull construction with no world step, and source identity admission. I read those tests and the receipt but did not rerun them. In particular their all-weight test writes weight-support.json, so executing it would not be a read-only independent review. Lint selected zero files because art/ is excluded; neither writer nor this review counts that as green lint. Final receipt correctly supersedes the frozen REPORT's earlier pending-test status without changing its frozen bytes.

## Complete channel and clock inspection

All 135 output paths explicitly cover position/rotation/scale XYZ of all fifteen bones. Thirteen rotation channels vary; every other output is constant. All positions are original hierarchical bind offsets, scales are one, and shell/eyes/knees/ankles have constant zero local rotations. Body rotation is also zero. The locks do not depend on strike phase, transition kind, or a branch of an evaluator and therefore survive repeated interruptions and interpolation between any reachable candidate endpoints.

Read owners are the existing detached frame, strike, transition, motion and named entry ports. There is no stage-memory or regular-clock substitute, root channel, callback or stateful DAG local. `channelPrograms.ts` maps strike states idle/windup/active/recover/cooldown to0/1/2/3/4 and selected strike ids to indices1/2. Authored windup .60/.45, active .10 and recover .90 agree with `driftwoodRegularCombat.ts`. Independent evaluation of both strike sequences found maximum boundary rotation difference 5.551115123125783e-17 radians. No discontinuity was found at those exact phase joins.

Hit blending starts at entry with zero recoil at elapsed0, reaches its bounded recoil at .08s and rejoins the moving living target at .32s. Death selects the captured entry at deathT0 and fixed terminal locals at deathT1. These formulas are position-continuous under their stated authoritative inputs. Source inspection does not establish actual host event ordering, pre/post clocks, physical-root ownership or whether every runtime path supplies those inputs correctly.

The gait uses `motion.total`, the actual accumulated Euclidean displacement, not requested speed. `NativeCreaturePose.advance` accumulates sqrt(dx²+dy²+dz²), including vertical movement and shove, with no sign or per-foot support declaration. Thus stopped phase is held; a shove/vertical traversal advances the same cyclic leg swing and turning in place does not. That is an explicit authored behavior, not proof of planted feet or locomotion correctness.

## Reproduced exact support derivation

I independently reproduced every ordered recipe coordinate without running the writer's prepare.py: concatenate each ownership group's original position triples; lexicographically deduplicate with NumPy; apply SciPy ConvexHull without joggling; select its original extreme indices; subtract the declared owner's original global bind pivot. Every coordinate equals recipe.json exactly.

Owners/counts: body+shell84; head+eyes46; shield upper29, forearm27; rapier upper30, forearm39; complete left leg55; complete right leg51. Total361, largest84. There are exactly eight unique owners and no new source positions, padding, hull budget change or anatomy deletion. The numerical plane residual and sampled all-weight residual reported by the writer remain rounding diagnostics, not new contact tolerances.

Because relative leg skin transforms remain at bind, all positive-weight influences on each continuous leg hinge share the hip's skin matrix. Original weights remain unchanged; no largest-weight reassignment is used. The same rigid relation holds shell/body and eyes/head. This makes every triangle in each declared group conditionally contained by that group's convex hull throughout candidate motion, apart from verified storage arithmetic. Common physical-root transforms preserve that statement. Interpolation also preserves these constant local locks.

This is conditional source support, not a requirement that visible triangles lie on the collider boundary. The independent Iguana correction remains in force: concave rendered anatomy can be preserved inside the exact convex hull of its coherent rigid component. Finite-terrain obstacle behavior, actual world contact and meaningful-articulation quality are not established by that theorem.

## Exact living-contact witness

At t=0, no strike/transition and motion.total0, the candidate's minimum source-root Y is -0.009531468152999878m. A complete 101-sample distance cycle has its lowest observed minimum at total .1625m. The gait formula is `sin(total*2*pi/.65)`; there it equals1, so right hip X=-.085rad and left hip X=+.085rad.

The lowest corner is part legRightAnkle, expanded index175, node35 `Toe blade (1, 1)`, primitive0. Original position is (-.9859728217124939,-.0035208482295274734,-.589461088180542). Rotate about right hip c=(-.23,.86,.03): `c + Rx(-.085)*(v-c)` = (-.9859728217124939,-.052994067866151795,-.5139137129527812). Relative to the ready global minimum this is 43.46259971315192mm lower. All intermediate knee/ankle transforms remain bind; no blend ambiguity affects this rigid toe witness.

This witness is independent of any global yaw or common rigid coordinate reorientation about Y. A flat-ground root set to align ready minimum with the floor cannot keep this pose above the same floor. I do not assume an unverified actual root-Y offset or claim a runtime contact measurement. A constant raised root sufficient for this gait would instead float the ready geometry and is not an approved fix. Selected terminal local death minima are not independently a death failure: the corpse root will be physical and is allowed to move/rotate, unlike this fixed-root living comparison.

## Facing and weapon-domain boundary

In `AnimalSim.ts:346–347`, positive forward movement is `(sin(yaw),cos(yaw))` in X/Z; `getHead` similarly uses +Z at yaw0. `NativeCreaturePose` constructor placement in `animation.ts:706` assigns `root.rotation.y=actor.yaw`, with no selected-facing offset. Candidate admission clones selected metadata and adds only rigidCorpse; its 135 channels keep body rotation0. Therefore directly composing this candidate with that native actor leaves its -Z face opposite forward travel. An explicit coordinate/bind/facing contract is required before native use. This review does not authorize changing the engine, canonical clips, selected assets or physical-root semantics.

Independent selected-local FK confirms rapier tip advances in -Z, from approximately (-1.60865438,.18004828,-1.03007261) at ready to (-.99628682,.86562993,-1.82425237) at end-windup/active. Those signs are internally consistent with selected-local facing, but they do not establish actor-forward alignment or contact with the existing 2.4m by .65m damage lane. Lateral position, strike reach, windup extension timing and actual first-damage correspondence remain explicit weapon/contact gates, not passes from phase continuity.

## Required continuation

Keep original source, this frozen failed-contact witness and all prior disagreements. Resolve selected-to-actor facing and the living-contact contradiction in one bounded source contract, preserving the unchanged hull caps and no-root-lift/no-padding rules. Do not spend runtime evidence on an unexplained backward-facing or analytically floor-crossing candidate.

Then verify actual selected native admission, finite living dimensions (the current metadata still carries old diagnostic bodyRadius2.9507175 and capsuleAxisZ), authoritative fixed/render interpolation, all-weight support through actual lethal/late-interruption entries, finite-terrain contact and actual isolated idle/locomotion/attack/hit/death. AI/weapons/damage, rewards/loot, player defeat, Retry/reload, persistence and independent visual review are still pending. Generic canonical-fixture lifecycle and handoff results cannot stand in for these selected-source checks. Physical phone/performance claims remain absent.

# Iguana candidate 1: independent native contract review

Reviewed 2026-10-19 UTC. **Rejected for contact and not admitted for play.**
No visual, animation/readability, gameplay, phone or runtime acceptance is
awarded by this review. Passing diagnostic tests means the measurements ran,
not that the creature passed its physical or quality gates.

## Identity and preservation

Checkpoint SHA-256:
`a32748333fc29ccc6a063ba3c25d63eab21b66915d85a9454dda6e3945075638`.
All 18 candidate file lengths/hashes and all 10 raw-evidence lengths/hashes
were independently checked before and after the tests and matched. The
complete-character-next metadata, payload, native source and GLB pins also
passed the existing admission integrity tests. No frozen candidate, original,
shared source, failure artifact, Git state or published asset was changed.

Read AGENTS.md, docs/process/GIT.md, current DRIFTWOOD-ENEMIES plan and State,
all four authored AI/combat/pose/product sources, admission/build scripts,
frozen test sources and summaries, AnimalView, AnimalFactory, Ragdolls,
numericCreaturePose, borrowed decision ownership, PracticeCreature,
PracticeDecisions and StrikeRunner. This is a focused source and native
numerical review, not an app execution.

## Source and authority

- Complete editable source exists for the bounded one-page decision guest,
  stalk/attack/recovery/stun/death handling, isolated species and combat data,
  authored joint channels and SDK product author. The decision compiles and
  runs through DecisionHost in the focused scenarios. This is not proof of
  complete in-game damage, reward, restart or progression behavior.
- Bite timing is .75 s windup, .16 s active, .9 s recovery; the pose reads the
  existing phase-local strike clock. The pose does not write a gameplay
  clock, root transform or scale. Boundary equality and fully dead stability
  pass the numeric DAG test. Smooth boundaries alone do not prove good motion.
- Admission is deliberately unconditional refusal after source inspection.
  The build entry calls that refusal before creating its output directories
  or bundling the author. No product/app was built in this review.
- The raw product-author function itself is callable source, not a universal
  admission boundary; it is the guarded build entry that refuses. Do not
  treat source integrity, schema checks or direct author calls as permission
  to publish an otherwise rejected candidate.

## Death ownership and actual transforms

AnimalView.startRagdoll selects rigid for this custom Z-axis creature. Its
metadata has no rigidCorpse recipe. Ragdolls therefore has no fixed corpse
pose owner: any supplied RigidCorpsePose in the earlier harness is ignored.
The rejected-harness results only describe frozen lethal local joints.
They cannot support a full animated-death claim.

For the near custom default path, AnimalView.updateRagdoll advances deathT
by dt/.8, decays flinch, supplies zero speed/strafe and attack=-1, calls the
species animation, then calls r.pose(dt). The corrected harness follows that
order. Ragdolls owns root motion and freeze; render animation owns local
joints. The floor top is Y=0, actor root starts at zero with unit scale and
no lift, body bind is (0,.78,-.2), and absolute bind pivots are converted to
parent-local bones once. Default corpse box half-extents are (.55,.39,.64),
center (0,.468,0). There is no collider padding or alternate contact geometry.

Independent strengthened parity test loads actual packed geometry, checks
all positions, four skin indices and weights against native-source within
1e-6, and requires identical bone definitions. It attaches SkinnedMesh parts
to the root, binds the skeleton, then compares manual weighted world-space
vertices with applyBoneTransform followed by mesh.matrixWorld under a
translated, three-axis rotated root at deathT=0,.5,1. It passes at 1e-6.
This extends the supplied detached-mesh parity check to attached mesh world
transforms; the supplied parity test also passes independently.

## Contact results

A fresh-output copy of the corrected physics harness reproduced the four
trial result objects exactly, including minima and final frozen states.
Each trial ran 480 fixed/render steps at 60 Hz with actual Rapier/Physics/
Ragdolls, damage20, zero initial velocity and four horizontal hit directions.
All weighted source vertices were measured at endpoint alpha1 and alpha.5.

- +X: fixed minimum Y -1.4516375611; interpolated -1.4517913413 m
- +Z: fixed -1.1292560193; interpolated -1.1289105005 m
- -X: fixed -1.0456995546; interpolated -1.0451866012 m
- -Z: fixed -1.5885896355; interpolated -1.5865755563 m

Every trial fails the 5 mm flat-floor gate decisively. A collider that settles
successfully does not establish mesh support. No radius/box enlargement,
root lift, solver adjustment or failure waiver is justified by this review.

Independent direct arithmetic over the first construction component's 492
triangle corners reproduced 108 outside the rest torso capsule and 54
outside the torso-plus-head union. These are repeated face corners, not
492 unique vertices. Body capsule center is (0,.78,-.2), half-length .64 on Z,
radius .623; head center is (0,1.51,1.04), radius .574. AnimalView reads these
bone centers. This is a rest-space coverage failure of real continuous trunk,
not solely decoration. A proposed rest-only radius is not animated coverage
or corpse support, and was not applied.

## Exact-clock scope and host distinction

The corrected physics test intentionally animates the preserved iguanaClips,
not the new native exact-clock wrapper. An added independent numeric DAG
comparison checked all output channels at 481 samples from 0 to 8 seconds:
old attack=-1 and new authoritative strike idle produce identical death
outputs within 1e-12, including the .8-second transition. This supports the
negative contact diagnosis under those inputs. It does not prove native
exact-clock lifecycle integration or lethal-pose equivalence during attacks.

The intended isolated PracticeCreature keeps the decision owner while the
body remains among its targets; StrikeRunner cancels on a dead actor. Thus
there is no demonstrated practice-host missing-owner failure here. A separate
integration hazard exists in pageDecisionAuthority: its live predicate uses
actor.alive, so the next fixed tick disposes the owner and removes its control.
numericCreaturePose with strikeIds performs its owner lookup even when dead.
Moving these clips to that page-host path requires a lifecycle test; the
legacy-clip contact harness cannot validate it. This is not claimed as an
observed failure in the intended isolated preview, nor a reason to change
shared engine behavior during this frozen review.

## Executed checks and limits

Executed Node admission tests: 2 passed. Executed the frozen source, motion
and skin-parity test files with their explicit Vitest config: 5 tests passed.
Executed fresh review copies: corrected physics rerun and strengthened packed/
attached-world parity, 2 passed; added dead-channel equivalence, 1 passed.
Vitest reported an advisory about future native config loading of extensionless
imports, with no test failures. Source pins remained unchanged afterward.

Reproduction: run `node --test scripts/bloomthroat-iguana-native-admission.test.mjs`;
run installed Vitest with the frozen config and explicit source.test.ts,
motion.test.ts and skin-parity.test.ts paths. Do not run the frozen physics
or measure-live script directly: they write existing evidence. For physics,
copy only the test into a fresh ignored directory, adjust its relative imports
and its two output destinations, and run it with a focused config. No physics,
pose, timing, threshold or assertion parameters were changed for this rerun.
The strengthened skin test adds packed/native equality and attaches meshes
before binding, then applies mesh.matrixWorld to the THREE result. The DAG
comparison supplies one shared frame and an idle strike observation to both
program evaluators and compares every authored transform channel.

Not tested: admitted AnimalView instance, real weapon event, actual exact-clock
combat-to-death sequence, fade/sinking, nonzero initial motion, varying scale,
far-actor updates, unequal render/fixed rates, terrain, obstacles, graphical
appearance, rendered video, performance, phone, full suite, typecheck, build
or browser. No successful runtime or visual acceptance can be inferred.

## Root preservation addendum

After this independent review, the actual commit hook identified two Node test
promises needing await, import spacing and a void-expression lint error in the
fail-closed build wrapper. Root corrected those without altering model, physics,
AI or clips. The admission call still throws before source inspection or build.
Both original scripts remain in the candidate rejected-hook directory. Two
admission tests pass again; actual pre-commit and commit-message hooks pass.
The updated checkpoint pins these lint-only corrections and retained originals.

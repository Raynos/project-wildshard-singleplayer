# Native practice physical handoff: source milestone

2026-10-20. Default-off implementation under the reviewed single-root proposal.
This is unfinished source engineering, not selected-model, contact, animation,
phone, app-build or public Arena acceptance.

## Implemented ownership

- Explicit native practice `corpse: 'rigid'` requires the existing animated
  rigid recipe, actual instantiated numeric hierarchy and a shared-capacity
  reservation at actor admission. No selected or public composition opts in.
  Capacity reserved for a living actor cannot be stolen by later legacy deaths.
- The real AnimalSim and CombatPipeline prepare a detached lethal pose, bounded
  physical resource and concrete handoff before HP, alive state, publication or
  receipts commit. The exact old CharacterMotor is disabled, not reconstructed.
  Recoverable activation failures restore both its native enabled state and
  cached flag. The same admission lease remains reserved.
- Successful commit switches the one actor's root owner. The disabled old motor
  is retired in the next existing pre-physics phase, or by disposal before it.
  There is one numeric local-pose evaluator, no render evaluator and no new
  physics, decision or animation clock.
- The real demo calls pre preparation, its existing single physics step and
  native post publication. Death in late weapon update or inside native post
  immediately publishes its event endpoint at elapsed zero. The next actual
  physics pair owns the next local/scalar step and physical position/quaternion.
- Collision FK and the bound view consume that physical root. Actor.position
  follows it, while the one local loot receipt retains the lethal position.
  Freeze keeps the existing maximum-age OR completed-and-quiet/sleeping rule;
  released capacity does not cause a living motor to return.
- A numerical pre refusal leaves accepted local pose/hulls intact. If the arena
  still steps physics under its fault policy, post publishes the actual moved
  root with the old locals. A post-capture/publication failure is instead
  terminal: close the owner and surface the error. A surviving body remains
  attached to its concrete lease and counted until explicit cleanup succeeds.
  No failure grants borrowed-world rewind or a silent captured-pose fallback.

## Review failures and repair evidence

The first 14-file actor WIP was protected as `ff332bb683625d30c758c09cefcf56990eefd5d5`.
Its initial 26-test run and focused strict TypeScript passed. Concurrent lint
and hook processes encountered exit 137 without lint diagnostics; isolated
writer lint and root's solo actual hooks subsequently passed. That is resource
contention history, not a waived gate.

Independent review then found three real bugs. Fifteen new regressions failed
against that WIP before repairs:

1. Frozen publication retained a previous/final interpolation interval forever.
   Repair collapses local, root and quaternion endpoints on the final owning
   publication, then copies that exact tuple for every render alpha. Installed
   Three slerp also normalizes nearly identical quaternions at endpoints; physical
   alpha zero/one now copies the actual tuples instead of passing through slerp.
2. A post publication exception could leave a healthy frozen owner with an
   unpublished final endpoint, or strand a live pending local step. All failures
   after capture begins now close the actor owner. Live and final-freeze fault
   tests assert closure, release and no future ticks. An additional actual actor
   test forces persistent body-removal failure: the exact body remains counted,
   other reservations cannot overbook it, and explicit cleanup retries after
   the parent scope has already closed.
3. Invalid detached contacts were not comprehensively validated before numeric
   evaluation. The physical opt-in now refuses nonfinite amount, point,
   direction and prospective scalar fields first. NaN/Infinity regressions cover
   nominal nonlethal/lethal requests, unchanged actor/pose/events/motor/lease and
   a subsequent valid hit. Legacy/default-off hit behavior is unchanged.

The first repair run passed 41/41 across the actual native actor, native corpse
and demo files. The expanded run passed **208/208 in 13 files**, including the
terminal quarantine regression. Its exact focused command is:

```
node_modules/.bin/vitest run \
  test/practice-native-corpse.test.ts test/practice-native-actor.test.ts \
  test/practice-demo-native.test.ts test/native-creature-pose.test.ts \
  test/practice-pose-event-boundary.test.ts \
  test/practice-pose-ownership-boundary.test.ts \
  test/practice-damage-parity.test.ts test/practice-player-loot.test.ts \
  test/practice-encounter-session.test.ts test/practice-root-flinch.test.ts \
  test/native-rigid-corpse-resource.test.ts \
  test/rigid-corpse-default-parity.test.ts test/rigid-corpse-physics.test.ts
```

Current focused strict TypeScript passed after fixing TS2367: TypeScript retained
the pre-capture resource-state narrowing across the mutating capture call. A
concrete resource local held before that check reads the actual post-capture
state without a cast or suppression. The first repair lint reported two test
style errors (global NaN and a newline in a chained test call); both were fixed
without suppressions. Final isolated type-aware lint passed, and the exact final
actor/corpse/demo rerun passed **42/42 in three files**. `git diff --check` passed.
Root's actual checkpoint hooks and independent repair review are separate gates.
No app build or full suite ran.

## What these tests use and do not prove

The fixture reuses the retained canonical rig and admitted decision/weapon
sources, with a deliberately synthetic four-point body hull supplied only in
test model data. It is not the selected Conch mesh and is not a contact recipe.
The actual demo test proves late Sword damage, physical update ownership,
lethal-position loot, bounded freeze, Retry before the first post-lethal tick
and Retry after freeze, with unrelated world/storage sentinels unchanged.
Default-off lifecycle tests remain separate and unchanged.

## Follow-on owner proof

The next bounded slice adds quiet version-3 physical diagnostics: previous and
current quaternion tuples, active/frozen flags, lease/resource state, terminal
state, owning tick identities and whether a local step is pending. A failed
provisional resource remains observable through its lease even if activation
never reached the actor owner. These are bounded output-only observations, not
restorable inputs. Without the opt-in, version-1/2 fields and serialization order
are unchanged. Physical-bound pose-only restore and embedded-world snapshot
restoration still refuse; no rewind authority was added.

Actual additional proofs now cover:

- Fill the real shared cap with legacy rigid corpses, refuse practice actor
  creation before a target/onBegin appears, keep native resource/controller
  counts unchanged, release one slot and admit a fresh actor. A failure after
  reservation and real motor creation also cleans before a valid fresh entry.
- Terminal enabled-state rollback, retired-controller removal before/after
  native effects, and provisional activation plus persistent cleanup failure.
  Failed owners close; surviving resources remain counted and explicit cleanup
  remains retryable after scope closure. Disposing the borrowed host/world first
  leaves native resource disposal safe without touching freed handles.
- The actual demo's physical collapse Retry, reselection and exit remove the
  old body at the native removal boundary and reset the next actor's state.
  Real admitted decision attacks defeat the local player while the enemy still
  holds its reservation; Retry releases/reacquires exactly one slot.
- Actual 30/60/120Hz Game deliveries with 0/1/100 quiet reads produce the exact
  same first 120 fixed actor/control/pose/physical diagnostic endpoints. The
  test compares owning ticks, not nominal elapsed-frame arithmetic: the
  existing scheduler may deliver the boundary tick in the next catch-up frame.
  No clock, timestep or solver setting was changed.
- Duplicate/mismatched pre/post identities refuse without state advancement.
  A hit between pre and physics publishes the physical movement after that
  physics step while retaining event elapsed zero until a prepared local step.
- Opposite quaternion representations of the same actual physical orientation
  retain exact alpha-zero/one endpoints and interpolate the short arc between
  them, without changing physics parameters or advancing on a view read.

Further review caught a genuine placement atomicity bug: native and bound-view
placement wrote actor/mesh coordinates before the pose rejected a physical-root
reset. Both supported entry points now inspect a readonly placement permission
before any write. Live and frozen physical placement refuses with exact actor,
body, pose and view invariance; existing living/default-off placement remains.
This is refusal, not a new physical teleport or restoration capability.

The expanded 13-file regression initially passed **221/221**; after placement,
quaternion-sign and assertion repairs, it passed **224/224**. Current focused
strict TypeScript passed. The final lint attempt caught an unsafe generic Three
Bone assignment in the cap test; an explicit runtime instanceof type guard
replaces that narrowing without a cast or suppression. Its isolated lint rerun
is pending at this source freeze; the 224-test and TypeScript receipts precede
only that test-only type-guard correction.
The first run exposed test setup
errors rather than a new runtime repair: a disposed rig no longer has valid
bone ancestry; the new diagnostic intentionally records a refused pre attempt;
parsed arrays require exact deep comparison, not object identity; and the
borrowed world's own player must retire through its host before world disposal.
The corrected tests retain exact logical publication, capacity and lifecycle
assertions. They do not weaken contact thresholds or change runtime parameters.

Strict TypeScript also caught a vacuous new snapshot-guard assertion calling a
nonexistent method. The regression now calls the actual `snapshotSimHost` API
and requires its borrowed-world refusal message. Terminal failure tests require
the AggregateError class and exact injected nested causes, not just any throw.
Admission tests install the real optional onBegin callback through the actual
demo factory and require zero calls on refusal and one on subsequent admission.

Independent final review and selected consumer contact/motion admission remain
separate. Fresh isolated Retry/reload
with empty stores is the supported persistence behavior, not historical
mid-bout restore. The embedded-world snapshot guard remains intact.

Selected geometry representability, one coherent complete authored pose pass,
weighted surface/contact checks and root's separate private app-build/capture
decision remain later gates. No public pins, cap increase, multi-body/joint
expansion, padding, root lift, solver/timing study or persistent reward/quest
authority is introduced here.

## Private canonical browser engineering gate

No further concrete owner-code blocker is known after the placement repair,
subject to final lint and independent owner-proof review. A private browser
composition would still need root authorization and must explicitly use the
retained canonical test rig, strict numeric ownership probe and synthetic test
hull. The current tests replace graphics only; they exercise real scheduler,
actor and physics ownership, not a real renderer or a visible complete cycle.

Such a build could establish renderer/scheduler/physical-root engineering
evidence only. It would not admit the selected fifteen-bone geometry, the
rejected selected motion, public Conch4, surface coverage, foot contacts or
animation quality. No shared Arena/public pin change follows from it. Historical
mid-bout rewind remains unsupported and is not a prerequisite to a fresh
isolated Retry/reload test. No private app build has been run by this slice.

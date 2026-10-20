# Bounded native single-root rigid corpse: implementation proposal

2026-10-20. Concrete next source slice, not an implemented API, candidate
admission or build request. See NATIVE-CORPSE-BOUNDARY.md for the executable
failure boundary. Recommended order: generic ownership/resource proof first;
then a separate selected-Conch representability gate; only then one complete
numeric pose pass. Passing the first does not waive the second.

Root's reviewed capacity choice supersedes the earlier lethal-time cap refusal:
reserve one existing shared slot when the single native opponent is admitted,
or refuse that creation. An admitted opponent must not survive a valid lethal
hit solely because other corpses subsequently fill the remaining capacity.

## Fixed scope and declaration

Keep the existing native practice selection absent/off by default. Add one
explicit literal `corpse: 'rigid'` to that internal composition selection. Its
shape comes only from the already admitted model's `dims.rigidCorpse`, copied
through the existing strict schema. Do not accept a URL, executable callback,
unvalidated extra JSON, build selector or engine branch naming a creature.

For this first native slice require custom grounded numeric rigs, the existing
practice transition declaration, one matching actor, known unique named bones,
positive finite uniform actor scale and unit scale along every hull's joint
ancestry. Require animated policy (posePolicy absent); explicitly refuse native
`captured` in this slice rather than pass it off as a complete death fold.
Legacy captured-policy behavior stays unchanged.

Retain all current limits: at most 8 convex parts, 128 points per part, 512 total
points, coordinates within +/-20, nondegenerate volumetric hulls, bounded 32-joint
native rig. Keep exactly one dynamic root body, zero joints, existing rigid-body
mass/COM/inertia, damping, throw/spin, friction/restitution and DEBRIS filters.
No implicit dimensions-cuboid fallback in this native opt-in: missing recipe
refuses admission. No extra collision recipe for the living actor.

## Exact API and file changes

The names below specify a reviewable implementation, not a public SDK surface.
Every new runtime member is internal to trusted engine/game composition.

1. **Numeric hull preparation, `engine/physics/rigidCorpse.ts`.** Extract the
   existing point validation, once-only scale, nondegeneracy and Rapier convex
   construction into a helper taking a bounded list of bone names and detached
   rigid transforms. Keep `prepareRigidCorpse(root, bones, ...)` as the unchanged
   legacy adapter which derives those transforms from Three. Add a numeric
   adapter, not an Object3D or Bone proxy. Both adapters share the same checks.
   No schema budget or legacy supported-build change.
2. **Physical root resource, `engine/physics/rigidCorpse.ts` or a small private
   `nativeRigidCorpse.ts`.** Add a non-rendering resource with prepared/live/
   frozen/disposed states. It owns one Rapier body and the bounded colliders,
   accepts already validated local hull transforms, reads root endpoints after
   physics, and removes resources on freeze/disposal. It contains no animation
   function, numeric programme, scene root, bones or render method. Extract the
   existing rigid-body descriptor/mass/throw construction from `ragdoll.ts` so
   the native path does not create a different physical law.
3. **Shared cap, `engine/physics/ragdoll.ts`.** Add an internal admission lease
   against the same per-Physics capacity as legacy Ragdolls. Occupancy is actual
   live corpses plus reserved native slots, bounded by the unchanged phone 2 /
   desktop 6 cap. Keep `live` reporting actual physical corpses, not promises.
   Reserve during native actor admission, transfer that same slot to its corpse
   without another cap check, and release exactly once under the policy below.
   There is no second pool or independent native allowance. Do not put native
   resources in the legacy posed set; SimHost owns their phases exclusively.
4. **Native owner, `engine/sim.ts`.** Bind one native rigid-corpse resource/port
   by actor id under the host scope. Add an explicit borrowed-host pre-physics
   entry point which only services already-dead native corpses and retired
   motors. It must not step physics, events, player, decisions or GameClock.
   `stepEmbedded` keeps its existing once-per-tick control clock. For an actor
   with physical-root ownership, bypass AnimalSim's dead terrain/ground motion
   and the ordinary after-body pose advance; finish the prepared corpse step
   instead. Bind once, reject wrong actor/physics/scope, and detach on disposal.
5. **One pose writer, `game/plugin/animation.ts`.** NativeCreaturePose alone
   prepares dead local transforms and publishes physical root plus native FK.
   Add a quiet numeric FK rigid-transform read, and typed internal
   `prepareCorpseStep(dt, nextTime)` / `publishCorpseRoot(endpoint)` operations.
   They must not construct RigidCorpsePose or call the view's animation. The
   prospective scalar/local/hull step is detached and fully checked before
   copying accepted results; the numeric programme evaluates once, not once
   for rendering and again for collision. A physical root quaternion must be
   retained losslessly as the authoritative endpoint; Euler conversion is only
   for the existing joint/view representation, never a second root integrator.
6. **Typed handoff, `engine/entities/AnimalSim.ts` and its volume port.** Extend
   the prospective applied-hit record with detached finite killing amount,
   point and direction. Add an optional engine-owned prepared body-handoff
   token to the publication result. This is a concrete internal resource token,
   not a shard-supplied function. Logical publication's commit remains copy-only.
   Perform resource activation before HP/alive/transition commit, as below.
7. **Composition, `game/practice/PracticeNativeActor.ts`, `PracticeCreature.ts`
   and `practiceDemo/startPracticeDemo.ts`.** Read the literal opt-in and exact
   recipe; acquire the slot before exposing the new bout's actor/target or
   issuing onBegin, then bind the native owner once. Add its pre-physics phase alongside the
   existing legacy corpse pre phase. Both precede the single physics step.
   The existing native fixed.post and final after-weapon publication remain the
   finishing boundaries. No global change to AnimalView's copy-only branch.

The typed pose/resource port belongs in an engine-owned interface; the engine
must not import NativeCreaturePose from the game layer. It may carry bounded
detached data and trusted owner methods, not authored callback capabilities.
No source selection, recipe or pose row can inject a resource method.

## Admission capacity and legacy compatibility

Acquire synchronously in the opt-in actor/bout construction after pure recipe
validation and before combat registration. Asset-only `PracticeCreature.create`
must not reserve slots for an encounter which has not entered. If no slot is
available, refuse creation with no live target, actor/control registration or
onBegin notification. Construction cleanup removes any partially prepared
resources and releases its slot. Retry/reselection dispose the prior bout before
admitting the fresh one; no existing corpse is evicted to make room.

One lease has the states **reserved for admitted actor -> occupied by its live
corpse -> released**, with direct release from either owned state. Reserving is
bookkeeping only: no dormant second body or collider is allocated while alive.
Activation transfers reserved to live occupancy atomically, leaving total
occupancy unchanged. There is no capacity acquisition or capacity-based refusal
at lethal time. A frozen corpse retains only its published pose and releases
the slot, exactly as existing physical corpse freeze releases capacity.

Release exactly once on admission/construction failure, terminal owner failure,
disposal/exit/reselection/Retry, or physical freeze. A later dispose of an already
frozen/released owner is a no-op for capacity. Player defeat alone retains the
reservation while the admitted living opponent/bout still exists. A recoverable
numeric or resource-preparation hit refusal cleans up that attempt's provisional
body, but **retains the admitted actor's reservation**: its HP/publication remain
unchanged and a subsequent valid lethal hit still has guaranteed capacity.
Releasing on every refused hit would recreate the rejected lethal-cap race. If
failure is terminal, dispose the owner and release; never leave an admitted
living actor with its promise revoked. This distinguishes failed admission or
owner lifetime from a refused transaction inside a still-valid admitted owner.

Compatibility is exact when the native opt-in is absent: zero reservations,
unchanged cap, legacy spawn/null fallback, live count and traces. Mixed ownership
has an unavoidable, explicit difference: one living admitted native opponent
temporarily consumes one slot that legacy previously considered free because
no corpse existed yet. Legacy spawn must count that reservation and can return
its existing cap-full/null result earlier; its existing keyframed fallback is
unchanged. Keeping old mixed-world availability as well as a guaranteed native
slot would require overbooking or another pool, both excluded. No live legacy
corpse is displaced, no tier cap rises, and unused slots remain shared. Tests
must cover this contention rather than claim full mixed-mode behavioral parity.

## Lethal transaction and ownership transfer

Current hit atomicity is non-negotiable. The resource part must finish all
fallible authoring and allocation before committing scalar damage/publication.

1. Prepare the prospective dead numeric pose, event entry/ordinal and complete
   FK exactly as today, off live actor/history/joints. Derive root and named hull
   transforms from that endpoint, never render/interpolated bones. Validate
   recipe compatibility, scale, finite bounds, physics lifetime and current
   motor ownership. Carry existing measured fixed root velocity, including
   actual shove displacement; do not infer velocity from desired speed. The
   first frame has explicit zero measured velocity. Keep the existing rigid
   throw/spin law applied to that base velocity and the real killing hit.
2. Use the actor's existing admission lease to create the prospective
   root/colliders disabled; do not acquire capacity or retest availability.
   On any allocation/configuration failure remove only those provisional
   resources, retain the reservation for this still-admitted actor, and rethrow.
   Never restore the whole physics
   world, damage the actor, publish, advance a clock or queue a receipt here.
3. Activate through the concrete handoff token before the scalar commit: disable
   the exact existing CharacterMotor collider, enable the prepared body, and
   retain the old motor for disposal. Preserve the motor's prior enabled state.
   If an activation setter fails, remove the provisional resource, retain the
   reservation and reinstate that same existing motor's enabled state before rethrowing.
   No async boundary, authored code or event dispatch may intervene. Validate
   handles/world before this operation, not halfway through it.
4. Only after successful activation copy HP/alive/transition/publication, switch
   the host's root-owner reference and clear actor.motor. The old disabled motor
   is a retired resource, not a second active body. Dispose it in the next
   pre-physics phase, or on scope disposal if Retry happens before another tick.
   There is no double collision or first-frame physics impulse. CombatPipeline
   queues the usual damage/death receipts once, after applyFinalDamage returns.

Do not call CharacterMotor.dispose inside a supposedly copy-only commit; it
removes two native resources. The explicit disabled-retirement step makes that
lifetime auditable and avoids reconstructing a destroyed motor after refusal.
If rollback cannot restore a valid live world/handle, surface that resource
failure and close the owner; never report successful atomic continuation. The
supported failure tests below must establish the normal rollback path.

**Capacity is already secured:** all remaining shared slots may fill after
admission without preventing this actor's otherwise valid lethal transaction.
Do not silently substitute keyframes/captured pose or make damage conditional
on current free capacity. Numeric/resource failures remain explicit atomic
transaction refusals, distinct from capacity and from geometry acceptance.

Abort cleanup proves no live resource/cap leak and unchanged actor/publication/
event state. It does not claim byte-identical Rapier allocator internals after
an allocation followed by removal, and grants no borrowed-world rewind API.

## Fixed phases and endpoint semantics

- **Alive:** keep current scheduling and motor recipe unchanged. One native
  actor/control step and pose evaluation in fixed.post; view/query reads quiet.
- **Death in update or fixed.post:** publish the prepared lethal endpoint
  immediately with elapsed zero and no positive-dt evaluation. The physical body
  starts at that exact root; it cannot move until the next existing physics step.
- **Next fixed.pre:** dispose retired motor; prepare one detached scalar/local
  death step at `host.clock.now + FIXED_STEP`; validate every hull transform
  before applying any. Update the existing compound's local collider transforms,
  waking it while the local fold is incomplete. Do not tick the native clock
  here. Use the current native event entry and scalar death law, not a second
  clock copied from RigidCorpsePose. Store the prepared tick identity.
- **fixed.step:** the arena steps its one Physics instance once.
- **Native fixed.post:** the existing clock/control step runs once. Capture
  physical root position/quaternion, finish the matching prepared pose and
  publish all FK/endpoints once. Never call ordinary native advance again for
  this dead actor, run AnimalSim ground-follow over the physical root, or let
  legacy Ragdoll write a visual root. Actor.position follows the physical root;
  root orientation belongs to the physical publication, not actor yaw steering.
- **Late or duplicate calls:** distinguish a corpse created after this tick's
  pre phase from one with a prepared tick. The former retains the zero-time
  lethal endpoint until the next pre phase. Reject duplicate advancement and
  mismatched tick identities. Catch-up frames execute the same pair per actual
  physics step. Zero-fixed/render/query frames never advance local pose or age.
- **Freeze:** reuse quiet speed .12, quiet duration .5, spin lever .05, max age
  5 seconds and existing completion semantics (deathT reaches 1). Publish the
  final root/local endpoint before releasing bodies/cap. A frozen owner holds
  that endpoint; it does not resume terrain smoothing or run a render-time fold.
- **Faults:** detached numeric/hull refusal must leave the previous accepted
  local endpoint and hull transforms intact and propagate to Game. Actual
  subsequent physics may still move the root under Game's existing fault policy;
  post must publish that physical root, not pretend the failed local step ran.
  Such a run fails candidate admission, not a silent captured-death success.
- **Loot/lifecycle:** death's one receipt drops local loot at the lethal actor
  position, as today; do not respawn/move rewards on later corpse ticks. Native
  actor.position follows the physical root for subsequent reads. Dead hitboxes
  remain disabled. Retry/reselection/exit remove live or provisional resources,
  pending retired motors, cap leases, owner registrations and local events.

Detached prospective scalar preparation may need a small internal AnimalPoseLaw
copy/prepare operation. It must be used only for the next owning step, perform
one scalar advance, and commit validated fields without replaying an evaluator.
Do not use historical snapshot restoration to undo a failed hit/pose operation,
and do not expose a new restore entry point to practice or shards.

The physical mode also needs bounded previous/current quaternion tuples and
resource state/tick identity in its diagnostic pose envelope. Existing version-1
and version-2 bytes remain unchanged without this opt-in. Do not route the new
physical diagnostic through ordinary pose-only restore: explicitly refuse that
operation while a physical owner is bound, just as embedded whole-world restore
is refused. Diagnostic capture is not a capability to rewind a live body.

## Selected Conch is a separate representability gate

The lifecycle witness uses the older canonical15 fixture. It is not the retained
selected geometry: selected native-normal source has **6,570 vertices, 2,190
triangles, 15 parts/bones**, and **94 vertices with multiple positive weights**
(45 in legLeft, 49 in legRight), freshly counted from the existing exact source
JSON. Its SHA256 is
`3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929`.
The retained selected normal metadata SHA256 is
`8b5ee001154cf9d781214d97231af3b7ddaf9e97199e7b641fd684cbc754bd58`.
The pinned source declares a -Z facing basis, unlike old canonical +Z motion data.
The exact selected producer/rig must supply the next candidate; do not transpose
old clips, swap its mesh, or call the old 7,338-vertex fixture a selected-model
proof. Existing static/source and surface transport scores remain separate.

None of the selected-normal, selected-color or older canonical metadata supplies
a rigidCorpse recipe. Fifteen joints do **not** alone prove the eight-hull format
impossible: several non-contact structures could share a rigid parent or require
no support hull. Conversely, fifteen rigid skin parts and blended thigh vertices
cannot be presumed represented by eight bone-local convex hulls. A bone-attached
rigid hull does not reproduce blended skin deformation by declaration.

After generic ownership passes, derive at most one conservative candidate from
the unchanged selected source and explicit intended death motion. Use exact
source points in declared bone-local bind units, no padding or lifted support.
Record which geometry each hull is meant to support. Test every retained skin
weight under the actual native pose and physical root through lethal entry,
collapse and settled orientation, including left/right/off-axis hits and late
interruption. Convex-hull construction success is not contact acceptance. If
the bounded recipe cannot represent the required moving/supporting surfaces,
stop this consumer with those exact missed regions; do not raise budgets, add
bodies/joints, change skin weights or repeat solver/timing/CCD searches.

## Required focused tests before a build

1. Reuse rigid-corpse schema tests plus numeric/Three preparation parity at
   .5/1/2 scale, identity/non-identity ancestors, invalid/duplicate names, unit
   scales, non-volumetric points, maximum/over-budget counts and finite limits.
2. Real Rapier resource parity against the existing one-root rigid recipe:
   mass, COM, inertia, velocity/throw/spin, groups, damping and lifetime. Require
   one body, bounded hull count and zero joints. Default legacy trace tests stay
   exact, including rigid, upright and both quadruped tiers.
3. Real AnimalSim + CombatPipeline + NativeCreaturePose lethal and nonlethal
   refusal. Inject failure before body allocation, at each collider allocation
   and at activation. HP/alive/scalar/transition/publication/
   FIFO events, old motor identity and enabled state remain unchanged; no new
   live body/collider, and the same admission lease stays reserved with unchanged
   total occupancy. A subsequent valid hit consumes one ordinal
   and one death; same-time prior hits and queued receipts survive.
4. Real startPracticeDemo scheduler proof: lethal zero-fixed update and a hit
   inside fixed.post, pre/physics/post order, catch-up pairs, no second physics,
   clock, AI, numeric evaluator or view writer. Compare 0/1/100 quiet queries and
   30/60/120Hz frame deliveries for the same fixed endpoint tape. Verify actual
   physical root/FK/view agreement and immediate lethal interpolation endpoints.
5. Admission with a full shared cap refuses creation without a target or leaked
   scope/resource. Admission with one free slot reserves it; fill every remaining
   slot with real legacy corpses and require a later valid lethal hit to succeed
   without another capacity check, duplicate lease or overbooking. Confirm
   default-off cap/live behavior and the documented mixed-mode earlier legacy
   fallback. Exercise admission failure, recoverable hit refusal with reservation
   retained, terminal failure, living exit and repeated disposal for exactly-once
   release. Then test live-to-dead handoff,
   bounded freeze, Retry before the first post-lethal tick, Retry during collapse,
   Retry after freeze, reselection, exit and disposed-physics cleanup. Verify
   old handles at removal time, not after Rapier can reuse them. No motor returns
   when the frozen physical root is no longer on the ground plane.
6. Integrated death/loot once, real player defeat, fresh Retry/page construction
   with empty stores and unchanged unrelated world state. Re-run the current
   ten-file native/lifecycle regression and the existing rigid-corpse focused
   tests. Keep embedded-world snapshot refusal and old default-off selection.
7. Only after the selected geometry/one complete numeric pose passes source
   admission and weighted contact checks: freeze exact source/product/owner
   contract for root's separate app-build/capture decision. No test result is
   a geometry likeness, animation/readability, phone or public-admission score.

Historical mid-bout rewind remains unsupported throughout. Bellback's pending
multi-body architecture, Medusa core volume, all old negative studies and public
Arena selections remain untouched. The proposal introduces no new service
credentials, persistent saves, reward/quest authority, tuning study or app build.

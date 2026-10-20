# Native Conch candidate: physical death owner boundary

2026-10-20. Source-only continuation after the integrated lifecycle proof. The
next complete numeric pose pass is **blocked before authoring or app build** by
the missing native physical-corpse handoff below. This is not a claim that the
engine cannot support it, and historical mid-bout rewind is not the blocker.

## Exact supported owner map

- **Living body:** `PracticeNativeActor` creates one real `AnimalSim` through
  embedded `SimHost`, borrowing the arena's existing Physics and player. Its
  page-body mode retains `creatureBodyShape`, CharacterMotor filters and lifetime.
  `CreatureBodies` only maintains query hitboxes for the bound visual Animal.
- **Idle and locomotion pose:** one `NativeCreaturePose` runs its scalar law and
  admitted numeric programme after the native body step, then publishes. The
  actual root displacement, distance and wrapped heading delta are recorded,
  including stagger movement when requested speed is zero. Entry/retry placement
  resets the motion anchor. Those inputs support authoring; they do not by
  themselves prove planted feet, sliding intent or contact. Unchanged Conch AI's
  lack of sustained disengaged idle remains a separate coverage limitation.
- **Attack:** the existing admitted decision guest and strike control remain the
  authority. Numeric `strikeIds` reads provide the actual runner's phase,
  elapsed and index. A new pose must use these, not a behavior-memory clock as
  a substitute. No new attack clock, damage callback or range override is needed.
- **Hit and lethal entry:** `AnimalSim.applyFinalDamage` prepares prospective
  scalar state, detached transition entry, numeric local transforms and FK
  before committing. Each applied contact has its own ordinal, even at the same
  timestamp. Valid publication commits synchronously before receipts are queued;
  numeric refusal leaves damage, publication, history and events unchanged.
- **View:** `Animal.bindPublishedPose` and `renderPublishedPose` copy native
  endpoints. `Animal.update` returns through that branch before its scalar,
  custom animation, ragdoll or fade path. Queries consume native published FK,
  not interpolated render bones. This single-writer boundary must stay intact.
- **Death currently:** the same native numeric owner can advance dead local
  pose time, but its root still comes from `AnimalSim.position/yaw` and terrain
  tilt. `AnimalSim.died` is empty. On the next embedded step `SimHost.syncBodies`
  retires the now-dead living motor. There is no dynamic corpse body, physical
  root endpoint publication or native corpse freeze/retirement owner.

## Why the existing corpse cannot just be attached

`AnimalView.startRagdoll` belongs to the legacy Animal's `died` override, not the
native actor. Calling it from an event listener would be later than the applied
hit transaction and would still select a second pose writer.

`Ragdoll` already supplies real physics, DEBRIS/WORLD-only collision, bounded
tier counts, sleep/quiet/age freeze and disposal. But its interface requires an
Object3D root and Three bones, reads their world matrices when spawning, and its
`write` method writes the physical root/bones back into that visual tree. The
existing numeric native root is renderer-free and has no physical-root input or
corpse-body owner. Its next `advance/publish` would overwrite such a visual-only
root change.

The optional `RigidCorpsePose` is not the missing adapter. It owns another
numeric evaluator and previous/current transforms over the Three bones. Its
captured policy avoids later evaluation but freezes all lethal local transforms,
sacrificing the requested death fold. `Ragdoll.fixedPre/fixedPost` service this
optional owner; the ordinary rigid fallback captures/interpolates and freezes in
the render-driven `pose` method. `startPracticeDemo` already installs the real
corpse pre/post phases around its one physics step. A missing scheduler clock is
therefore not the problem: no native corpse is registered with those phases.

The retained `runtime-admission/arena-candidate1`, selected native-normal and
selected native-color metadata each have 15 bones and no `dims.rigidCorpse`
recipe. This does not mean they cannot use the legacy rigid fallback: that path
uses its existing dimensions-derived cuboid. It means no accepted fitted corpse
hull or native physical ownership can be inferred from the geometry. No source,
mesh, dimensions, collider padding or earlier negative study is changed here.

## Smallest missing contract, not an implementation grant

A coherent next engine slice would need an explicit native physical-root owner
and lifecycle handoff, not more authored pose coefficients:

1. Prepare the real corpse body/shape and lethal local pose from the authoritative
   native publication, without reading interpolated view bones. Reserve existing
   shared corpse capacity at opt-in actor admission, refusing creation if full;
   never refuse an admitted actor's lethal hit solely because the cap later fills.
   Preserve failure atomicity before damage/publication commits.
2. Hand off the living motor to one physical corpse owner exactly once. Retain
   the existing physics world, filtering and bounded lifetime. Do not run a
   second physics step, lift the root or script a ballistic/floor trajectory.
3. Keep one numeric local-pose evaluator. If animated corpse hulls are supported,
   update them through that same owner in the existing pre-physics boundary and
   publish the actual physical root after physics. Carry a defined immediate
   lethal endpoint, fixed endpoints and interpolation without advancing on reads.
4. Publish freeze and final root back through native FK and the copy-only view.
   Native actor position follows that physical root, but existing death/coin
   timing and drop position remain unchanged; later corpse motion does not move
   or repeat loot. Retire queries and dispose the body on Retry, reselection and
   exit. Release the admission slot once on owner failure/disposal or corpse
   freeze. Shared-cap reservation is not contact acceptance.

The concrete bounded reuse/extraction is specified in
[NATIVE-RIGID-CORPSE-PROPOSAL.md](NATIVE-RIGID-CORPSE-PROPOSAL.md). Adding a callback, driving the old view's
ragdoll while continuing native pose ticks, or treating captured lethal pose as
a complete animated death would not close it. No such change is attempted.

## Executable evidence and admission status

The added scenario in `test/practice-demo-native.test.ts` uses the same real
`startPracticeDemo`, Game scheduler, PracticeCreature, canonical15 fixture,
admitted decision guest, Sword sweep, native actor and CombatPipeline as the
prior lifecycle proof. Only GPU output and frame delivery use its existing
headless boundary; the pose remains the test-only transition witness.

After an actual lethal weapon contact it observes the immediate dead publication,
then runs 120 real scheduled fixed ticks. The living CharacterMotor is disposed
once, native motor becomes null, no Ragdolls.spawn call occurs, no DEBRIS collider
appears, and the actor/view root stays at its lethal endpoint while numeric
deathT reaches 1. Local death remains once, there are no Game faults, and the
unrelated world/storage checks still pass. This exposes the missing physical
owner; it is deliberately **not** physical-death or animation acceptance.

The existing fixture still goes through strict SDK product preparation and
numeric admission. No complete candidate programme, fitted corpse recipe or new
candidate admission receipt exists yet, so none is claimed. The current witness
must not be relabeled as a complete idle/walk/attack/hit/death pass.

Fresh isolated Retry/reselection/page construction reset the owner and stores,
as previously tested. Historical mid-bout restore stays unsupported and is not
required for a later private build. Public Arena pins, production, old captures
and clips remain unchanged. App build/capture requires root's next source-boundary
review; complete-cycle portrait and all-weight geometry/contact proof remain open.

## Focused gates

- Integrated lifecycle file: 6/6 passed, including the missing-corpse scenario.
- Combined regression: 10 files / 48 tests passed in 40.61 seconds, using the
  same explicit ten-file command as INTEGRATED-LIFECYCLE-PROOF.md.
- Strict focused TypeScript passed using that note's entrypoints and repository
  compiler settings. The temporary config was removed.
- Type-aware oxlint on the changed test and `git diff --check` passed.

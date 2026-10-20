# Opt-in native practice ownership prototype

2026-10-20. Source-only, default off. Root approved this bounded implementation
slice after PROPOSAL.md and IMPLEMENTATION-BOUNDARY.md. No app build, browser
capture, complete-animation acceptance or public-host promotion is claimed.

## Implemented ownership path

- An exact, composition-only kind:variant selection names a verified product JSON
  file. The selection accepts exactly one admitted opponent. No URL switch and
  no default caller selects it. Existing public Mantis7, Conch4, Colossus2 and
  Puffer70 compositions remain unselected.
- `PracticeNativeActor` creates one real AnimalSim through embedded SimHost,
  borrowing the arena physics/player and the bout's local CombatPipeline/Events.
  The already admitted single-actor decision guest binds once to that actor,
  with its real strike runner. No additional creature runner is installed.
- The opt-in embedded `creatureBodies: 'page'` mode reuses creatureBodyShape,
  CREATURE/WORLD/PLAYER filters and the existing near/far body lifetime. Its
  single CharacterMotor belongs to SimHost. The bound Animal view's
  CreatureBodies creates query hitboxes only, not another movement motor.
- The demo's existing fixed.post phase calls the native owner after player.step.
  It advances its local elapsed clock once, then the admitted control, actual
  body movement and NativeCreaturePose once. It never steps borrowed physics,
  the player motor or player health through SimHost. PracticePlayer keeps its
  existing local health/death authority and now updates once on that fixed path.
- AnimalView's explicit published-pose binding only copies/interpolates native
  endpoints. Its old scalar/custom/corpse evaluator is skipped. Combat queries
  delegate to native published FK, never the interpolated display skeleton.
  The ordinary bindSimulation/legacy update path is unchanged when unselected.
- `practiceTransition` is a strict numeric-only declaration of at most 32 joints.
  It lends detached entry position/rotation/scale, event ordinal/kind/elapsed,
  measured root displacement/heading and the existing real strike observations.
  Unknown fields/joints, arbitrary callbacks, actor-memory paths, private DAG
  locals and read.joint recurrence refuse. No authored callback can opt in.
- Applied damage first prepares detached prospective HP/death/flinch state and
  an endpoint using the prior native publication as entry. The already-admitted
  numeric evaluator runs once on scratch joints/history at elapsed zero. Only
  after it succeeds do the actor and the copy-only publication commit, before
  CombatPipeline queues receipts. Multiple same-time hits therefore form an
  ordered chain; refused hits consume neither HP nor an ordinal. Death reads
  the prospective actor death state. No body/physics/AI/terrain/RNG/scalar-law
  tick occurs here.
- A final update publication slot after demo.weapon copies any late endpoint to
  the view and refreshes query hitboxes. It does not evaluate another pose or
  apply damage again. Existing local loot and death handlers are reused.
- Placement explicitly resets measured root history, rather than classifying a
  large displacement as a teleport or hiding the unchanged minimum stagger.

## Continuation boundary: deliberately not widened

The opt-in NativeCreaturePose envelope is version 2 and preserves entry transforms,
ordinal/kind/elapsed, previous/current root and joint endpoints, measured motion
and anchor history. It validates the bounded fields before restoring. Ordinary
poses retain version 1 and their previous property order and behavior.

The synchronous prepared-hit operation is a trusted, bounded native port, not
an authored callback or a save/restore API. Its commit only copies the validated
joint/context/history endpoint and swaps the prepared collision FK. Authored
JSON receives exactly its previous declared numeric observations and no new
capability.

`PracticeNativeActor.snapshot()` is a **diagnostic read**, combining the existing
regional logical observation with pose and real control continuations. It is not
a restorable whole-bout save. Disposed owners explicitly reject this diagnostic
instead of reading a freed Rapier controller.

The embedded SimHost full-snapshot refusal remains intact: borrowed simulation
snapshots belong to the client world owner. This prototype does not restore,
replace or clone the arena's physics/player, and adds no local logical restore
API. There is no atomic mid-bout actor + control + motor + queued events + health
+ rewards restore contract in this slice. Separately restoring those objects
would not establish one, especially with a shared physical world.

Fresh Retry/re-entry/reload instead discards the scoped bout and constructs fresh
actors, controls, motors, local events/health and transition history from the
same verified data. Tests establish deterministic fresh native-owner reset and
no retained decision/collider. They do **not** establish rewind/resume of a
historical mid-bout checkpoint, browser reload persistence, or whole-arena save
compatibility. A separate source-boundary review is required before any app
build or public admission, including a decision on that missing continuation
contract. Root explicitly deferred widening that authority in this slice.

## Focused evidence

`test/practice-native-fixture.ts` builds one tiny admitted Conch guest from the
real source catalogue, re-reads the verified SDK product and loads the retained
canonical15 packed rig/geometry. Its extra numeric pose is an authority witness,
not a complete Conch animation or accepted contact solution. No old clip or
canonical geometry is rewritten.

`test/practice-native-actor.test.ts` exercises:

1. Actual native actor/control, exact page motor options, query-only view bodies,
   far/near motor retirement/recreation and no borrowed physics step.
2. Nonlethal, repeated same-timestamp and lethal CombatPipeline hits, exact prior
   entry witnesses, immediate dead endpoint, unchanged scalar/control/clock and
   no repeated receipt/death on another flush or hit.
3. Zero/one/100 collision, transition and interpolated view reads with identical
   actor/control/queued-event/RNG/pose diagnostic snapshots.
4. The same real fixed ticks with half-rate, normal, double-rate and irregular
   display reads, identical fixed endpoints and actual strike/player damage.
   This is scheduler/read-cadence evidence, not a phone frame-rate capture.
5. Unchanged real stagger motion measured at speed zero and explicit placement
   reset without hidden ticks.
6. Scoped control/motor disposal and deterministic fresh retry/reload materialization.
7. Strict declaration failures for callbacks, missing joints and mutable recurrence.
8. In-place version-2 pose round trips at hit/death boundaries and atomic refusal
   of invalid version, ordinal or entry length. These are pose-envelope tests,
   not a full historical owner rewind.

The focused regression additionally retains the existing native pose, numeric
clips, original ownership/event characterizations, local combat routing,
player/loot, demo entry and default recoil tests. Legacy version-1/native rows
and the four public compositions are not switched to the new owner.

## Independent P1 repair: hit refusal atomicity

The independent review reproduced an admitted `transition.kind * 1e12` row
that initializes successfully but refuses the lethal kind-2 observation.
The original prototype mutated HP/death and history before that refusal, so
CombatPipeline never queued the corresponding receipts.

`test/native-creature-pose.test.ts` now retains that exact expression through
real AnimalSim, NativeCreaturePose, numericCreaturePose, CombatPipeline and
Events. A companion `kind * (2 - kind) * 1e12 * 2` row refuses only a nonlethal
kind-1 hit. Both refusals leave the complete actor snapshot, pose envelope,
transition observation, published collision endpoints, frame and event queue
identical. Subsequent valid hits consume ordinal 1 and queue exactly one
receipt; the lethal case also preserves an already queued valid receipt across
another failed lethal attempt, then accepts another valid hit as ordinal 2.
There is no catch-and-ignore path, rollback, extra evaluation or broadened
historical continuation authority.

These are two-joint source-boundary regressions, not integrated bout/browser
acceptance. The existing real admitted Conch actor/control tests remain part
of the focused regression. After the repair, all nine focused files pass
(42 tests), including the eight native Conch owner tests; the focused TypeScript
check also passes. This does not change the integration or admission limits below.

## Not claimed

- No complete new Conch clips, planted-support/skid contract, all-weight contact
  acceptance, shield/rapier visual acceptance or native corpse contact solution.
  The native view intentionally does not start a second legacy ragdoll/pose owner.
- No whole PracticeCreature browser start/retry run, phone capture, performance
  result, runtime pin change, persistent save/reward/quest write or publication.
- No Bellback architecture or Medusa core-volume change, collider padding, root
  lift, solver/timing/CCD study or package installation.

## Commands

The installed direct binaries were used, not a package-manager installation:

- `vitest run` on the nine focused files listed above and in the worker report.
- `oxlint` on the ten changed TypeScript source files and two new test files.
- `tsc -p tsconfig.practice-check.json --pretty false`, using a temporary config
  that selects the relevant entrypoints/tests plus required ambient declarations;
  that temporary config is not part of the deliverable.

Final result counts are recorded in the root handoff after the last focused run.
No full test suite or app build was run.

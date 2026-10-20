# Native practice ownership: first executable boundary

2026-10-20. Source-stage checkpoint; no app build or browser run. No runtime
implementation, native-practice integration, new animation, visual acceptance,
platform-host credit or public-host promotion is claimed here. The source-only
characterizations below exercise the existing AnimalSim, NativeCreaturePose,
CombatPipeline and Events. Their two-joint fixture is a test fixture, not a Conch
consumer or an admitted playable native creature.

## Result and natural boundary

A binding-only adapter is insufficient. The smallest complete implementation needs
an actual body/motor lifetime, one pose writer and a synchronous late-contact
publication boundary together. None exists as one attachable practice adapter.
This checkpoint preserves executable evidence before making that cross-owner
change. It does not claim the implementation is impossible or needs an entire
world/save installation. In particular, embedded SimHost can borrow the arena's
physics, local combat/events and player without persistent saves.

## Actual current call graph

1. `PracticeCreature.enter` constructs `Animal` with local CombatPipeline ports,
   registers its combat actor, constructs `CreatureBodies`, and calls
   `animal.update(0, 0, true)`. `CreatureBodies.sync` creates and retains the
   CharacterMotor using `creatureBodyShape` when simulationBound is false.
2. `PracticeCreature.update` flushes local damage events, refreshes decision
   observations, runs the borrowed decision callbacks at 1/60, then calls
   `animal.update(dt, elapsed, true)` once per render. That call owns body motion
   and pose advancement, followed by mesh and hitbox publication. Its accumulator
   currently makes only the decision loop fixed-step.
3. `startPracticeDemo` registers `demo.weapon` in update after `training-arena`.
   Damage therefore really can arrive after that frame's pose publication.
4. `CombatPipeline.hit` applies admission/guard/modifiers and calls
   `target.applyDamage` synchronously; AnimalSim.applyFinalDamage updates HP,
   flinch and death state. The pipeline then queues `damage.dealt` and optionally
   `actor.died`. FIFO order and cloned point/direction survive, but the target in
   each queued payload is a live reference, not a hit-entry state snapshot.
5. `Animal.bindSimulation` forwards body/combat identity but Animal.update still
   evaluates its own AnimalPoseLaw and custom animation. Also,
   `CreatureBodies.sync` explicitly skips motor creation for simulationBound
   views. Using bindSimulation alone both leaves a second pose writer and removes
   practice's current source of its movement motor.
6. The real shardfile client (`src/game/shardfile/client.ts`) creates
   `createShardfileSim`, then binds views to `sim.host.entities`. SimHost's
   `createActor` already allocated those actors and motors. This is the real
   ownership order to reuse, rather than inventing an actor-shaped mock.
7. SimHost.stepEmbedded calls stepSystems without stepping borrowed physics,
   clock, player or event phases. stepSystems runs callbacks and its strike
   runners, then per-body before hook → AnimalSim.step → after hook, followed by
   afterBodies callbacks. Existing `installNativeLimbPoses` demonstrates the real
   `useBodyStep` → NativeCreaturePose.advance → explicit publication pattern.
8. Embedded SimHost's ordinary actor motor currently uses bodyRadius*scale,
   bodyY*scale*2, step=.3 and snap=.2. Practice's CreatureBodies uses
   creatureBodyShape: bounded radius, max(radius*2+.05, (bodyY+bodyRadius)*scale),
   scaled step and snap=.3. `useBodyBands`, whose owned-host path uses the latter
   recipe, refuses an embedded host. Reusing embedded SimHost unchanged would
   therefore alter collision behavior; this is not allowed to pass as pose-only.

## Exact tests and what they prove

`test/practice-pose-ownership-boundary.test.ts`:

- 0/1/100 published query reads leave actor and pose continuation identical.
- The same 120 fixed ticks have identical endpoints under half-rate, normal,
  double-rate and irregular query reads. This is read-cadence evidence only,
  not an integrated 30/60/120Hz practice/browser scheduling claim.
- Two real damage applications at one timestamp remain two pipeline receipts,
  while lastHitT has the same value. It cannot be an event ordinal.
- A late lethal hit leaves context.alive and the published native pose living
  until an explicit pose operation occurs: the mixed-state gap is reproduced.
- `pose.advance(0)` leaves the tested actor snapshot unchanged but changes the
  pose law continuation (including gait targets/normalization). It is not a quiet
  publication API; this checkpoint does not recommend it as a clock-neutral fix.
- A minimum stagger moves the actual AnimalSim root exactly 0.6m while speed=0
  and gait phase holds. A displacement consumer must use actual root deltas.
  This unobstructed test does not certify motor/wall/contact behavior.
- Restored actor plus native pose continue identically for 30 steps; invalid
  pose version refuses without changing its prior snapshot. This tests the
  existing format, not a yet-unimplemented transition continuation.

`test/practice-pose-event-boundary.test.ts`:

- Nonlethal then lethal hits before one flush retain FIFO killed flags and cloned
  contact points, but both listeners read the now-dead live actor. Thus delayed
  dispatch alone cannot reconstruct the earlier entry state.
- The one lethal receipt emits death once; a second flush does not repeat it;
  disposing the real scope removes its listeners and answerers.

No RNG, decision-runner, reward, retry/reload or whole-host snapshot coverage is
claimed by these tests. The two fixtures use a fixed random port and no AI.

## Minimum coherent closure for the next implementation

- Admit an explicit practice-only data selection. Obtain the real pose recipe
  and numeric programme from the loaded product/model; no alternate authored
  callback or guessed rig may stand in for these. Leave old rows absent/off.
- Create the native actor through the existing native owner with the actual
  arena physics/player/local combat. Resolve the embedded motor recipe parity
  above explicitly, preserving the former shape, filters and lifetime. Do not
  silently replace it with the host's other capsule or remove collision.
- Attach the existing borrowed decision control to that native actor once, and
  choose its registration phase against the real body step. Do not leave the
  former render-driven callbacks or a second StrikeRunner advancing alongside it.
- Extend NativeCreaturePose with bounded transition entry/local transforms,
  monotonic event ordinal, elapsed and root history; numeric rows only receive
  detached declared fields. Strictly preflight names and finite bounds before
  writes. Existing row continuation must retain its bytes when not opted in.
- Capture the previously published pose at the synchronous applied-hit boundary,
  preserving multiple contacts in order; queued combat events already preserve
  order but not entry poses. Publish the zero-time hit/death endpoint before the
  weapon phase returns to drawing, without advancing AI/body/pose clocks or
  reapplying the scalar law. If leveraging events, their flush ordering and live
  target semantics must be accounted for rather than inferred away.
- Add a view path that copies/interpolates those published endpoints only.
  Animal.update cannot remain its animation path; collision queries must still
  use authoritative endpoints, not interpolated visual joints.
- Version and atomically validate the complete owner continuation, including
  native actor/control/event entry/root history and endpoint state. Retry/reload
  and scoped disposal must detach each exact owner and reset teleport history.
- Then prove actual integrated guard/strike/damage/reward/defeat/retry scheduling,
  late death and same-time repeated hits before any app build. Authored contact
  and complete-animation work remains a later separate stage.

This closure spans native owner attachment, legacy view consumption, combat
publication and practice scheduling. Stopping at the executable boundary avoids
presenting an incomplete pose helper as the requested actual native practice
prototype. No runtime source, old clips, four public hosts or production assets
were changed for this checkpoint.

## Commands and preservation

- `./node_modules/.bin/vitest run test/practice-pose-ownership-boundary.test.ts test/practice-pose-event-boundary.test.ts`
- `GOMAXPROCS=1 GOMEMLIMIT=768MiB ./node_modules/.bin/oxlint test/practice-pose-ownership-boundary.test.ts test/practice-pose-event-boundary.test.ts`

The direct installed binaries are used. The initial `pnpm exec` attempted an
installation and failed to create its package-manager home; it did not establish
a test result. That failed invocation and the successful focused runs remain
separate diagnostic logs. No full suite, app build, browser, Git publication or
Site publication was performed by this worker.

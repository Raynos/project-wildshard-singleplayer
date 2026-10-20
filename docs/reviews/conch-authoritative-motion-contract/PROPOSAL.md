# Conch complete motion: bounded ownership proposal

2026-10-20. Source inspection only. No candidate implementation, build, capture,
visual score, public host change, or universal infeasibility claim. Root review
precedes implementation. Motion4 PCF remains the public baseline; motion5 and
all negative evidence remain untouched.

## Findings that change the next attempt

- Motion5 already completed an actual diagnostic run: 13,012 encoded frames,
  1,654 observations, 17 ordinary and one counter uninterrupted cycles. Its
  independent review rejects animation/readability at 2/5. Repeating this source
  unchanged would not be a new improvement pass.
- `src/game/plugin/channelPrograms.ts` already supports strict `strikeIds` and
  detached `strike.phase`, `strike.elapsed`, `strike.index`. Conch can use this
  existing authority, instead of behavior-clock estimates or a new attack clock.
- `conchDuelist.as` resets stage2 clock every stunned tick and holds stage4 clock
  zero. Different incoming poses collapse to the same stage/clock/flinch tuple.
  A new authored recoil target cannot reconstruct the lost entry pose.
- `AnimalSim.stagger/stepMotion` intentionally produces shove translation while
  speed is zero. The current custom gait phase does not encode that displacement.
  Removing this shove or translating the mesh oppositely is expressly excluded.
- `PracticeCreature.enter` constructs legacy `Animal`; `update` advances its body
  and pose once per render delta. Its internal 60Hz loop runs decisions only.
  `startPracticeDemo.ts` schedules demo.weapon after training-arena. Actor death
  after the posed frame is therefore a real ordering boundary, not proof that
  changing one clip's death keys will make that frame coherent.
- `NativeCreaturePose` in `src/game/plugin/animation.ts` already owns bounded
  renderer-free joints, scalar law, local versus published transforms, and exact
  continuation. Reuse this machinery rather than invent a second pose evaluator.

## Smallest coherent implementation boundary

This is a proposed opt-in isolated practice path, not a change to every creature.
The existing native actor/body-step and native pose owner must be the sole writer;
the visual Animal must consume published endpoints, never advance a second pose.
A source-only adapter that still renders through Animal.update would not satisfy it.

1. Producer: existing native actor damage application and body-step boundaries.
   Record a monotonically ordered hit/death identity at the actual damage boundary,
   and latch the already published native local pose before changing its presentation.
   If multiple contacts occur before the next body step, retain bounded order and
   define whether each entry starts from the same published pose or a separately
   evaluated authoritative event pose. Do not silently coalesce via lastHitT, whose
   millisecond value can repeat. Damage/stagger/guard/reward retain their real order.
2. Native pose owner: hold one bounded entry transform set, event identity/kind,
   fixed-step elapsed and previous/current root endpoints. Advance once per owner
   tick. Repeated reads and renderer interpolation do not advance anything. Local
   translation plus rotation are required; storing angles alone loses stepping
   feet. Preserve scale semantics; no scale-based collision exception.
3. Consumer: an opt-in data-only pose-row transition declaration selects admitted
   hit/death entry reads. Expose detached named numeric entry transforms, elapsed,
   and measured displacement/heading from the existing native owner. Exact strike
   reads remain the current strikeIds adapter. Reject missing ownership/unknown
   joints before any joint writes. No callback, reflected actor write, private DAG
   locals, read.joint integration or second clock.
4. Movement semantics: measured root displacement includes intentional stagger,
   steering and real body movement. A diagnostic teleport/retry/reentry resets the
   anchor history explicitly; it must not become a giant authored step. Authored
   locomotion uses fixed displacement, with support/release declarations distinguishing
   deliberate skidding during a shove from planted stance. A bare displacement
   number does not itself create a valid contact solution.
5. Render: consume/interpolate published native endpoints only. Existing collision
   publication remains explicit. Hit/death application after the final pose tick must
   either publish a zero-time transition endpoint before drawing or be queued to a
   documented next simulation boundary before actor-state publication. Do not reorder
   the whole weapon loop casually or call an extra dt-bearing pose update after hits.
6. Lifetime: version and validate the new bounded continuation in native snapshot/
   restore; include event ordering, entry pose, elapsed and root endpoints. Fresh
   spawn/Retry/reload reset it; disposal cannot leave a control attached. Legacy rows
   without opt-in retain byte-equivalent behavior and continuation compatibility.

## Exact proposed source families

- `src/game/plugin/animation.ts`: extend existing NativeCreaturePose ownership and
  continuation; prefer this over a new service. A small helper may be extracted if
  it remains private to this owner and testable without a renderer.
- `src/game/plugin/channelPrograms.ts`: strict optional data admission and detached
  transition reads; retain existing strikeIds validation.
- `src/engine/entities/animalRig.ts`: narrowly typed optional read-only pose-context
  record, only if required to pass owned data into the existing evaluator.
- `src/engine/entities/AnimalSim.ts`: an event ordinal/typed handoff point may be
  necessary for exact same-timestamp hits. Inspect existing combat event identity
  first; do not change movement, knockback, HP or existing damage calculations.
- `src/game/practice/PracticeCreature.ts` and
  `src/game/practiceDemo/startPracticeDemo.ts`: isolated native attachment, fixed
  ownership and render consumption/order. A facade that merely relabels the
  current render-driven Animal as fixed is not acceptable.
- New `art/driftwood-isle/approved-conch/authoritative-motion/` candidate factory,
  complete clips, strict source freeze and pose tests. Reuse canonical geometry,
  bind rig and existing exact native admission; do not mutate prior freezes.
- New focused tests beside existing `test/native-creature-pose.test.ts`,
  `test/creature-numeric-clips.test.ts` and practice tests. Exact final file list is
  an implementation review output; this is not permission for unrelated refactors.

## Concrete phase order to prove in a bounded arena adapter

A) Queue or apply weapon contact using the existing combat boundary, retaining exact
ordinal ordering; latch the previously published source pose before transition.
B) Run borrowed decision/strike ownership, body movement and native pose once per
fixed tick in their established dependency order, with actual actor elapsed.
C) Publish native collision/pose endpoints once after their actual owning work.
D) Render only interpolation of those endpoints. Late update-phase contact requires
a zero-time transition publication, or an explicitly queued next-tick damage request;
choose and prove one before implementation, since the latter changes contact timing.
The recommended first investigation is zero-time transition publication, which can
retain the existing weapon timing. It must not advance body/AI/pose clocks or evaluate
a second physical movement. This recommendation is not yet a proven implementation.

Animal.bindSimulation currently still runs AnimalView.update animation, so binding
an actor alone does not implement D. Add an explicit opt-in published-pose consumer
in AnimalView.ts or an isolated practice rendering adapter. Never run both pose owners.

## Mandatory tests before any motion capture

- Same authoritative tick read 0, 1 and 100 times gives bit-identical actor, RNG,
  runner, event/reward and continuation snapshots and identical pose endpoints.
- Render at 30/60/120Hz and irregular/paused frames over the same fixed inputs:
  identical fixed endpoints and events; interpolation reads never affect next tick.
- Two hits at identical timestamp remain distinct; repeated hits mid-transition,
  guarded early/late windup, counter preparation, active/recovery and lethal hits
  retain exact entry transform witnesses. Entry is compared to the prior published
  native pose, not the last interpolated render skeleton.
- Death after weapon phase: the chosen publication contract has no mixed dead
  actor/living pose receipt; no extra damage, duplicated death/reward or post-death
  strike. Assert both actor and first-dead-pose boundaries explicitly.
- Snapshot/restore in every transition gives bit-identical subsequent endpoints;
  invalid snapshots refuse atomically. Retry, reload, disposal/rebind and legacy
  no-opt-in paths retain their respective contracts.
- Measured displacement equals actual roots including the unchanged 0.6m minimum
  stagger trajectory. Stop/turn/resume, scale and teleport resets are exercised.
  No speed-zero substitution hides root travel; no threshold labels all shove feet
  as exempt contact. Report intended support and intended skidding separately.
- Strict joint/node/input bounds, finite outputs and real all-four-weight geometry
  contact apply across living, interruption and death. No collider padding, root
  lifts or death-contact exception. A failed authored pose stops before app build.
- All native weapon/AI/guard/damage/reward-once/defeat/Retry/reload/persistence checks
  remain mandatory in the later isolated real cycle. Preserve actual input and
  transform traces plus true encoded frame counts/PTS and engine cadence.

## Six-test host bar, candid applicability

1. Existing creature.pose has real cross-shard use: Pine Hollow imports THRALL_CLIPS
   in generators/output.ts; thrallClips.ts consumes numeric reads and joint overlays.
   This is evidence for the existing host, not for the new transition fields.
   Two real shard users are NOT established for those new fields.
   Conch and Mantis are both Driftwood, so adopting both is not two shards. Existing
   NativeCreaturePose users do not automatically prove use of a new capability.
   Keep the initial adapter an explicitly bounded practice/legacy subset, or obtain
   a genuine admitted second shard/pending-user exception before calling it platform.
2. No shard nouns: achievable in the generic pose record; Conch keys stay candidate data.
3. Data-driven: achievable with bounded row declarations and joint IDs.
4. Server-safe: native producer/evaluator is renderer-free; interpolation is explicitly
   client-only. Tests must enforce no DOM/Three scene dependency in the owner.
5. Deletion: plausible for interruption-capable native animation, not yet evidenced
   by a second actual consumer. Do not mark this passed on aspiration alone.
6. Data-only API: achievable with typed snapshots/rows; no shard callbacks or ports.

## Recommendation and stop

Review the native practice ownership migration first. It is a consequential bounded
implementation, larger than a clip edit, and must not be concealed as a three-file
clock patch. If it is outside this iteration, rotate Conch without rebuilding old
motion5 or claiming the existing schema makes future improvement impossible.
If accepted for implementation, freeze editable source early, pass source/native
admission, then capture one complete isolated real cycle and review independently.

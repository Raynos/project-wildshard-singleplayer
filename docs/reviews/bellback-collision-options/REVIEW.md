# Bellback collision scope decision

2026-10-19. Independent source review. No product/code edits, Git operations,
simulation, browser, installs, or child agents. Only this report is new.

## Verdict and one recommended next step

**Keep candidate4 unaccepted. Recommend one isolated, opted-in “lethal-pose
hold” prototype: capture the actual local bone pose at ragdoll creation, hold it,
and let the existing one-body throw and tumble supply the visible death.**
No backend change, delayed collision, final-pose snap, root correction or extra
body is needed to express this behavior. It is a deliberate alternative death
animation, not a repaired animated-fold candidate4. Evaluate it under the owner's
existing death-animation authority; do not silently promote it or claim the fold
is preserved. If an explicit owner instruction requires that fold, this option
needs that requirement changed first. The supplied mission does not establish
such a requirement, but preserving living motion and AI remains mandatory.

This is the smallest justified next experiment because source already supplies
the initial hull transforms, local-pose snapshots and dynamic root response.
The held local geometry removes the particular missing surface-motion term.
It does not prove a collision pass, good final pose or acceptable appearance.
Stop after this bounded prototype if it fails; do not compensate with padding,
root lift, changed solver defaults or a pose/parameter sweep.

## Verified evidence

All 13 entries in attached-shape-api-manifest.json independently match both their
recorded byte counts and SHA256. Direct inspection confirms the API report:

- Installed Rapier package.json:7 is 0.21.0. Collider JS:404–407, 428–430 and
  raw declarations:205,227 forward only parent-relative pose components. There
  is no local translation/angular velocity or timestep parameter.
- PhysicsHooks declarations:3–39 contain pair/intersection filters only;
  physics_pipeline.js:13–19 and raw stepWithEvents:870 expose the same bridge.
  Filters can select contacts, not prescribe their normal target velocity.
- narrow_phase.js:201–210 and raw declarations:365–369 expose reads, including
  tangent velocity. The optional object is an output buffer, not a setter.
- rigid_body.d.ts:270–292 supplies next poses for a whole kinematic body, whose
  artificial velocity affects dynamic counterparts. It is not eight independent
  collider velocities. Lines22–38 explicitly state that contact cannot change
  a kinematic body's trajectory.
- ragdoll.ts:365–377 advances local animation and changes the eight attached
  shapes before the world step (Physics.ts:113–116). The parent retains one
  rigid velocity field. A moving local shape needs that field plus its relative
  translation and angular contribution at each contact point. Choosing one
  body velocity cannot in general encode all eight independent motions.

The source establishes that the supported JS surface lacks the needed control;
it does not independently expose or prove every internal Wasm solver operation.
Do not claim that a hypothetical native contact hook or a newer package will fix
this until its actual source, normal-velocity semantics, and bindings are checked.

## What the completed experiments rule out

The independent contact-study audit reports exact baseline trajectory equality
including rotation. Native 0/2/4 additional iterations all failed the 5 mm gate:
front minima 13.218 / 12.265 / 9.405 mm below floor; angled minima 22.033 /
21.804 / 21.809 mm. More iterations do not add a missing velocity input.

The single fold-aligned body descent counterfactual also failed: front fixed
penetration worsened to 31.085 mm and interpolated penetration to 35.893 mm.
The angled improvement does not justify another timing variant. Settled minima
near 0.1 mm do not erase transient failures. These are earlier experiment
results, not simulations independently rerun for this report.

## Why lethal-pose hold is a concrete, bounded route

`prepareRigidCorpse` (rigidCorpse.ts:55–80) samples each actual bone's root-relative
pose before allocating the hull/body. `RigidCorpsePose` (rigidCorpsePose.ts:19–29)
already snapshots every joint's local position and quaternion. The rigid branch
(ragdoll.ts:225–250) allocates exactly one dynamic root and eight zero-mass hulls
with explicit root mass/inertia. Holding those same bone snapshots and attached
shape transforms produces an ordinary fixed compound on that existing root.
The root still receives its existing immediate throw/spin (ragdoll.ts:208–219)
and interpolated physical motion (ragdoll.ts:435–459). No authored final-pose
jump or noncolliding waiting phase is required.

This is not available as recipe data alone today: `RigidCorpseRecipe` contains
only `parts`, and `validateRigidCorpse` rejects extra keys (rigidCorpse.ts:7–17).
`RigidCorpsePose.step` currently invokes its numeric evaluator unconditionally
(line48). A bounded implementation needs an explicit data-only captured-pose
policy admitted through the same validation/transport path, defaulting to the
existing animated behavior. Its engine-owned pose owner holds snapshots instead
of evaluating death channels. No species branch, arbitrary callback, permission
exemption or new generic contact host is justified. Any native/Wasm mirror of
that recipe must be found and updated consistently before runtime testing.

Preserve existing clocks/lifecycle deliberately: stopping bone animation must
not stop deathT progression or break `complete`, sleeping, freeze, fade, loot or
cleanup. Do not call `ragdoll.freeze()` at death: it removes physics bodies.
Hold every joint, including secondary head/bell/clapper motion, not only legs.
Do not allow render updates or fresh live memory to change the held geometry.
Capture the exact spawn-boundary pose, not a recomputed deathT=0 or final pose;
verify continuity against the previous visible/fixed state rather than assume it.

Tradeoff: Bellback becomes rigid in its struck pose. The torso genuinely falls
and rolls, but limbs no longer tuck and the bell/clapper do not finish their
collapse. Extended limbs may prop it up, look stiff, or leave more exposed space.
Stopping articulation also changes its local-motion history; this is not a claim
of preserving articulated momentum. Keep original root mass/inertia/throw and
label the variant “lethal-pose hold / no authored fold.” An initially overlapping
spawn can still fail; do not move it upward to hide that failure.

## Authored collapse, then frozen-shape rigid motion

A constant local shape configuration removes the particular missing articulated
velocity term during its subsequent dynamic phase. The current code can create
one dynamic body with several zero-mass convex colliders and explicit root mass
and inertia (ragdoll.ts:225–250). Thus a frozen compound is technically meaningful;
its ordinary rigid-body contacts still require testing. This is different from
ragdoll.freeze(), which removes bodies altogether (ragdoll.ts:462–468).

The difficult part is the preceding phase and the handoff:

1. AnimalView.ts:329–344,396–398 starts the ragdoll on the killing blow;
   ragdoll.ts:208–219 supplies its immediate throw and spin. Deferring that
   response until collapse completion changes the visible hit reaction and
   inertia history. Replaying the original hit impulse 0.8 s later is a new kick,
   not velocity continuity.
2. rigidCorpsePose.ts:31–47 advances death over 0.8 s. Tucked clips:27,41–64
   lower the body, rotate head/bell/clapper, and move/fold legs. Their inputs
   contain no terrain collision feedback. There is no demonstrated guarantee
   that this path is clear beside an obstacle, on a slope, or near a ledge.
3. A fixed or kinematic parent does not solve that clearance problem. Keeping
   the parent dynamic while its children animate recreates the reviewed problem.
   Disabling collision until the final pose hides contact; lifting or relocating
   the root to admit that pose violates the current restrictions.
4. Freezing bones immediately in the death-entry pose avoids subsequent local
   animation but discards the intended tuck/collapse. Switching instantly to
   the final pose is a visible snap. Neither is an equivalent implementation.
5. A truthful authored-first design would need a separately justified collision-
   safe path from the actual pose, position and surrounding geometry, continuous
   root/bone poses at handoff, and an explicit velocity/momentum policy. A whole
   body type setter exists (rigid_body.d.ts:434), but it does not supply those
   guarantees. The existing sweepBall helper (query.ts:89–108) is a translating
   ball query, not a proven sweep/admission system for rotating animated convex
   parts. Do not infer that such a system already exists.

Consequently this alternative trades away immediate freely responding collapse
for an authored phase with new terrain handling and transition semantics. It
could be proposed as a separate owner-approved behavior design, but it is not a
smaller established fix under “unchanged throw / one existing dynamic body.”
An articulated-body design would instead give parts their own velocity fields,
but changes body count, joints, mass distribution and budgets. Existing quadruped
code is not evidence that a Bellback port is correct or in scope.

## Required tests for the recommended bounded prototype

- Pin the current candidate and both exact captured failing initial states/inputs;
  reproduce baseline trajectories before comparing. Keep all negative evidence.
- Prove held bone positions/quaternions and collider parent-relative transforms
  are constant after creation. Check all 13,374 original mesh vertices and hulls,
  exact spawn-boundary pose continuity, one body/eight shapes, unchanged mass/COM/
  inertia and initial root velocities. No first-frame animation evaluation jump.
- Enforce the unchanged 5 mm transient gate at every fixed step and rendered
  30/60/120 Hz interpolation sample, then actual low-rate catch-up. Frozen contact
  must pass no-hover review. All initial overlap counts; no excluded warm-up.
- Replay both known hit directions, then test death from different live gait and
  attack poses, sloped/uneven/wall/ledge support. Constant shape geometry removes
  one failure cause, not discrete collision or tunneling risk.
- Verify death clock/completion, quiet/sleep/max lifetime, stop/resume, fade, loot,
  retirement/world disposal and cleanup. Root interpolation must continue while
  all local joints stay held. Check default-absent and existing animated-policy
  parity, unchanged living dimensions/clips, combat and AI.
- Only a passing native fixture justifies actual full-combat and complete motion
  review, defeat/Retry/reload and corpse/player walk clearance. Specifically score
  stiffness, extended-leg propping, floating appearance, silhouette and hit
  response; a mathematically contact-correct corpse can still be a poor death.
  Cloud data is not phone performance or human visual acceptance.

If the no-fold behavior is rejected or the bounded fixture fails, return one
owner decision on expanded contact-API work. That subsequent investigation must
identify a concrete backend/binding path for per-contact normal relative surface
motion, coordinate frames, rotation and fixed ordering. A tangent-only hook is
insufficient; a hypothetical native hook or newer package is not proof. Backend
replacement or articulated-body implementation is a separate architecture scope,
not silently covered by the optional single-body recipe. No such changes are
recommended before evaluating the smaller captured-pose tradeoff.

## Sources

Paths are repository-relative; line numbers refer to this review's inspected
bytes. Installed dependency paths are evidence, not proposed committed files.

- docs/plans/driftwood-enemies/STATE.md (07:35 snapshot; its “next study” text
  predates the completed negative studies below).
- docs/reviews/bellback-runtimecandidate4-source/attached-shape-api-review.md
- docs/reviews/bellback-runtimecandidate4-source/attached-shape-api-manifest.json
- docs/reviews/bellback-runtimecandidate4-source/solver-experiment-design.md
- docs/reviews/bellback-runtimecandidate4-source/fold-aligned-study-review.md
- docs/reviews/bellback-contact-study-audit/REVIEW.md
- src/engine/physics/{Physics,ragdoll,rigidCorpse,query}.ts
- src/engine/entities/{AnimalView,rigidCorpsePose}.ts
- src/shards/driftwood-isle/generators/bellbackTuckedClips.ts
- node_modules/@dimforge/rapier3d-simd/package.json
- node_modules/@dimforge/rapier3d-simd/geometry/{collider,narrow_phase}.{js,d.ts}
- node_modules/@dimforge/rapier3d-simd/pipeline/{physics_hooks.d.ts,physics_pipeline.js}
- node_modules/@dimforge/rapier3d-simd/dynamics/rigid_body.d.ts
- node_modules/@dimforge/rapier3d-simd/rapier_wasm3d.d.ts

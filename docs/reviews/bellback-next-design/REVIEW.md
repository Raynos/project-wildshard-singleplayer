# Bellback next design: articulated support, not another rigid-body knob

2026-10-19. Read-only design review, apart from this document. No simulation,
browser, build, dependency, engine, product, Git, STATE, Mac or deployment changes.
All four static likeness milestones remain done. Candidate4 and candidate5 remain
unaccepted runtime evidence; no art pass or quality-score inflation is proposed.

## Decision

**Recommend review and authorization of one bounded, data-only articulated-corpse
prototype within the existing Ragdolls service: one carrier body plus four physical
legs, retaining all eight exact native convex shapes.** This changes the one-body
restriction and death-response model. It is not implementable by today's recipe
alone, and this report does not authorize its implementation.

The precise owner choice is: permit this isolated five-body/four-joint prototype,
including the existing quadruped-style launch response in place of the rigid-crab
launch, under unchanged contact and budget gates; or retain the single-body
restriction and return to a separately reviewed authored-death/physics-separation
design. Recommend the former. The latter is a behavior redesign with unsolved
terrain/handoff requirements, not an already working fallback. Keep the current
public host and all preserved negative evidence unchanged while that choice is made.

## Evidence that changes the decision

- Candidate4's animated eight-shape compound gives a readable but limited collapse
  (death 3/5). Independent render minimum is −22.028 mm; actual fixed-post shape
  minimum is −24.265 mm. Both frozen rests are near the floor, but transient
  penetration fails the unchanged 5 mm gate.
- Candidate5's captured compound eliminates local shape animation. Death falls
  to 1.5/5: both actual corpses return almost perfectly upright on four extended
  feet. First native step penetrates 10.302 mm; rendered minimum is −5.834 mm.
  These are real compound contacts, not mismatched render timestamps.
- Candidate4's 0/2/4 additional-iteration and fold-timing studies failed. The
  similarly named **captured solver study's 0/2/4 script was not run**. Do not
  report an invented negative solver experiment for candidate5.
- Captured whole-lifecycle replay matches the first 57 steps and diverges at
  zero-based step 57. Its full-lifecycle CCD=true arm remains unrun. The separately
  approved 0–56-step experiment exactly matches both arms except the CCD flag:
  −10.302 mm fixed, −10.317 mm interpolated. This rejects CCD alone for that
  initial-impact window, not every CCD configuration or later trajectory.
- Initial rear-foot downward velocity is 7.4515 m/s despite root upward velocity
  2.6 m/s. Root spin is physically relevant. It does not prove a numerical cause
  for the unchanged CCD result.
- The captured terrain fixture passes only 13/28 combined contact/rest cases.
  Five have transient penetration failures, worst 47.052 mm at 2× scale. Ten
  other cases fail moving MAX_T rest. This is fixture evidence, not terrain-host
  gameplay acceptance.

Sources: [candidate4 review](../bellback-following-independent/REVIEW.md),
[candidate5 review](../bellback-captured-independent/REVIEW.md),
[captured solver record](../bellback-captured-solver-study/README.md),
[initial-impact CCD record](../bellback-captured-impact-ccd/README.md),
[terrain fixture](../captured-corpse-terrain/README.md).
The inspected driftwood-enemies STATE is dated 07:56 and still proposes captured
hold; the subsequent completed reviews supersede that next-step premise.

## What Rapier actually supplies

Installed package is `@dimforge/rapier3d-simd` 0.21.0. Read installed JS and type
bindings, rather than assuming current website examples all exist in this build:

1. Collider parent-relative setters pass only position/quaternion to WASM. They
   accept neither a local velocity nor a time interval. PhysicsHooks exports only
   contact/intersection filters. Solver tangent velocity is a getter, including
   its optional output buffer. No exposed normal contact-target-velocity setter
   or modifySolverContacts hook was found. A translating/rotating bone-following
   collider cannot generally be represented by its single parent's velocity field.
2. `setAdditionalSolverIterations` applies to the interacting contact/joint
   component, not just the selected body. `setAdditionalPgsIterations` requests
   extra PGS work per substep for that component, taking the largest request.
   These are distinct controls. Current official documentation describes solver
   iterations as substeps and distinguishes internal PGS iterations. Calling all
   of these “extra contact passes” would be misleading. Neither supplies missing
   independently animated collider velocity. [Integration parameters](https://rapier.rs/docs/user_guides/javascript/integration_parameters/)
3. `enableCcd`, `setCcdEnabled`, `setSoftCcdPrediction`, and global
   `maxCcdSubsteps` exist. Current official docs describe motion clamping with
   velocity correction left to the solver, automatic fast dynamic-versus-fixed
   sweeps, and the body flag extending sweeps to moving counterparts. This makes
   identical flag arms against a fixed floor plausible, **not a verified explanation
   of these exact installed WASM bytes**. Installed wrappers do not expose the
   internal sweep activation/TOI decisions. Do not assert “CCD ignores rotation,”
   “CCD was entirely off,” or “CCD guarantees 5 mm” from this experiment.
   [Rigid-body CCD](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/#continuous-collision-detection)
4. Current integration documentation and installed comments differ on default
   allowed error (website 0.005 versus installed comment 0.001). Recorded native
   values, not either generic default statement, govern replay. A backend slop
   setting is not permission to relax the project's measured 5 mm acceptance.
5. Native spherical/revolute impulse joints exist. A spherical joint constrains
   its two anchors while allowing relative rotation; fixed-connected parts are
   more efficiently one compound. Existing game quadrupeds already create native
   bodies, joints, limits, interpolation and cleanup. This supplies reusable
   mechanics, not proof of Bellback admission or visual quality.
   [Rapier joints](https://rapier.rs/docs/user_guides/javascript/joints/)

Installed references: `geometry/collider.js` setters; `pipeline/physics_hooks.d.ts`
and `physics_pipeline.js`; `geometry/narrow_phase.js`; `dynamics/rigid_body.d.ts`
and `integration_parameters.{js,d.ts}`; `dynamics/impulse_joint.{js,d.ts}`.
The current website is semantic context, not a pinned implementation audit of
opaque compiled WASM. No invented contact API, binding upgrade or Rust fork is
part of the recommendation.

## Why there is no justified remaining one-body recipe fix

Captured compound plus a stronger roll/COM bias might tip the rigid silhouette,
but cannot buckle its legs; another launch/damping/friction search would reopen
the stopped knobs. Bone-following animation restores the fold but restores the
unsupported local surface-motion problem. A larger swept hull blocks empty space
and props the mesh up; a smaller proxy no longer protects original vertices.
Neither qualifies as exact visible contact. Locking rotations removes useful
collapse freedom. Kinematic motion is prescribed rather than contact-responsive.

An authored-collapse-then-dynamic-corpse sequence is legitimate only as an
explicit alternative behavior. It needs a collision-safe path for every visible
part from the actual lethal pose on slopes, near walls and over ledges; continuous
root/bone handoff; and an explicit velocity policy. Existing `sweepBall` is not a
rotating articulated hull sweep. Turning collision off, snapping to the tucked
pose, replaying the killing impulse later, or raising the root is not that design.
Reverting to the old one-box/keyframed separation cannot be called a strict mesh
contact pass. Single-body limitations are not a mathematical impossibility proof;
they are the absence of a justified next implementation within the reviewed API
and scope after the bounded failures.

## Smallest meaningful articulated prototype

Use the existing client-only Ragdolls lifecycle and the admitted native geometry:

- Five bodies: carrier holding body/head/bell/clapper in their exact lethal relative
  poses; four legs, each with its existing exact hull. Eight hulls total. Four
  native spherical joints at captured leg attachment anchors, with reviewed
  numeric limits. No extra knee bones, new art, bell pendulum, motors, self-collision
  system or fixed-joint chain. Independent gravity/contact can let the supports
  fold; this targets the upright-propping failure while each moving collider now
  has a real body's velocity. That is a hypothesis, not a promised pass.
- A bounded validated data recipe declares body ownership, hull references, joint
  anchors/frames/limits and positive finite masses. Reject cycles, missing/duplicate
  ownership, invalid frames, excess counts, unsupported scale and nonfinite inputs
  before allocation. Freeze all local hull transforms. No shard callbacks, reflection,
  species branches or new physics service. Omitted recipe retains exact default
  behavior. Admission/copy paths include format rigid-corpse/nativePhysics schemas,
  packed geometry, model dimensions and AnimalView ownership; this is new schema
  work, not permission to force new keys through the current strict schema.
- Capture the real lethal poses without first evaluating deathT=0. Joints start
  with coincident anchors and limits containing that pose. Reuse the existing raw
  angular-limit route only after verifying its frames for this rig; do not assume
  an Euler range automatically means an anatomical cone. Existing quadruped
  `write()` publishes limb rotation only: copying it unchanged can hide joint
  translation error. Publish/reconstruct actual full part transforms and measure
  native-to-mesh agreement, joint drift and visible seams.
- Explicitly replace the rigid-crab launch preset with the existing jointed launch
  model (damage-scaled throw, lower vertical and angular response, jointed damping).
  The present rigid preset intentionally tosses a small flat creature; it launches
  this broad stone quadruped upward while driving a foot down. This is an approved
  behavioral change to a collapsing quadruped, **not** an unchanged-throw comparison
  or a tunable spin sweep. Record exact initialization and resulting momentum.
  Do not claim articulated momentum conservation from the legacy launch code.
- Before implementation, fix one documented mass allocation preserving total
  mass 5, with positive per-body mass/inertia derived from the retained hulls and
  agreed material grouping. The old box-derived root inertia cannot simply be
  copied onto every part. Aggregate COM/inertia will change and must be reported.
  No mass/launch/limit grid, corrective impulses or copied righting torque in this
  first prototype. Passive joints either produce useful collapse or fail the test.
### Initialization and momentum contract to approve

The above quadruped-style launch is an intentional replacement of the old rigid
launch, not evidence of a contact-only repair. Pin its numerical prescription
before implementation. Retain the actual lethal root and all part world poses;
this gives position/orientation continuity, not automatically velocity continuity
with procedural living animation. No pre-collapse snap or initial joint correction
may be hidden. Per-leg surface velocity must be computed from its native COM
linear velocity plus native angular velocity crossed with its COM-to-point lever;
record this at the formerly failing hind-foot vertex before the first step.

For a coherent initial rigid velocity field across the new bodies, choose the
reviewed quadruped-style aggregate COM velocity V and angular velocity omega,
then initialize part i with V + omega cross (COM_i − aggregate_COM) and omega.
This gives total linear momentum M times V; angular momentum about the aggregate
COM is aggregate_I times omega. It does not impose the same rigid motion after
contacts/joints act. This is a deliberate refinement of the existing quadruped
initialization, whose source assigns the same linear velocity to all bodies and
spin only to the torso, then applies an off-centre torso impulse. Do not silently
combine both prescriptions or double-apply that impulse. The proposed first
prototype uses the coherent field and no additional off-centre impulse.

Keep total mass 5. With unchanged hulls and positive part masses, the physically
computed aggregate COM/inertia generally differs from the old explicit box-derived
root inertia. Matching all old mass, COM, inertia, angular velocity and angular
momentum may be impossible under those constraints. This recommendation chooses
physical part inertia and the explicitly changed launch, reports the aggregate
values and resulting momentum, and does not force an unphysical negative inertia
or claim exact old momentum. A requirement to preserve old angular momentum would
instead require solving for a different omega where the aggregate inertia is
invertible; that is a different launch choice requiring review, not an automatic
adjustment. Likewise matching living per-bone velocities needs valid prior fixed
pose samples and an explicit handoff rule; it is not obtained merely by capturing
one lethal pose. No assertion of living articulated momentum conservation is made.

### Collision policy and cost

Preserve current DEBRIS-to-WORLD groups. Parts do not collide with one another
or the player, so limits must prevent unacceptable self-intersection. This is an
existing limitation, not a new exemption to world-contact checks. Corpses remain
nonblocking; verify the walk gate rather than claim collision with the player.

This is materially more costly: four extra dynamic bodies and four joints per
corpse; at existing phone cap two, ten bodies/eight joints instead of two/zero.
Eight hulls remain eight. The existing six-body lite and eleven-body full quadrupeds are precedent;
this proposed five-body variant is not already implemented. Neither is
a benchmark for eight detailed convex hulls. Ragdolls directly allocate bodies
and have their own cap; do not assume Bodies' 40-awake budget automatically counts
these. Census actual combined native bodies and solver cost, preserve both caps,
and test cap-exhaustion fallback. It cannot silently fall back to an unaccepted
keyframed contact path and claim universal acceptance.

Host review is required under `docs/HOST-BAR.md`: existing quadrupeds demonstrate
reuse potential, but a new generalized data surface still needs real-user evidence
or a legitimate narrowly scoped pending-user/platform approval. No broad lint
exemption or new “generic” host justified solely by this one creature.

## MAX_T is a separate inherited defect

Both ordinary `pose()` and opted-in `fixedPost()` freeze at MAX_T=5 regardless of
support or motion. Freeze removes native bodies and holds the last pose. In the
terrain fixture eleven cases hit the deadline, ten still exceed the quiet-speed
criterion, and one freezes 205.046 mm above the plane at 3.9799 m/s. It is not a
captured-only regression. Candidate5's two actual flat-floor rests are quiet,
so this timer does not explain their upright silhouettes.

Do not change the global timer/defaults in this prototype, extend it to disguise
failures, or count timeout removal as settled rest. Mark any airborne/moving
MAX_T result a failed lifecycle case. Before broad terrain promotion, a separate
review must choose supported-rest freezing versus an explicit timeout retirement
policy for opted-in corpses; neither is implicitly authorized here. A continuously
sliding slope or a ledge fall may have no physically valid static rest by five
seconds. Tests must report that honestly.

## Bounded proof and stopping condition

1. Review recipe, initialization, joint frames, host eligibility and budgets first.
   No architecture implementation before that review/owner scope choice.
2. One isolated five-body passive configuration, using the two exact captured
   lethal states. Retain the 57-step baseline as a provenance sanity check; do not
   require a different physical model to reproduce candidate5's later trajectory.
   Use complete native snapshots when exact continuation is claimed, rather than
   mislabeling a reconstructed scene as a whole-world replay.
3. Measure all 13,374 original vertices and actual eight native hulls from creation
   through every fixed endpoint, interpolated 30/60/120 Hz samples and low-rate
   catch-up. Record joint errors, contact/manifold data, body velocities, mass and
   inertia, freeze reason, support and cleanup. Initial overlap counts. Require
   unchanged 5 mm transient gate and supported rest within 5 mm; no root lift,
   padding, new sensors, excluded appendages or warm-up exemptions.
4. If both core cases pass, run the already defined 28 terrain/orientation/scale
   cases, plus wall/ledge and representative live gait/attack lethal poses. Verify
   missing-recipe parity, cap exhaustion, stop/resume, freeze/fade, loot, Retry,
   world retirement, allocation-failure cleanup and player walk clearance.
5. Only after numerical/lifecycle success, capture real full combat and independent
   complete-frame motion review. Death must improve on candidate4's 3/5 rather
   than merely beat candidate5's 1.5/5; no upright living silhouette, gross flail,
   seams or hover. This is a necessary improvement gate, not a quality-complete
   grade. Static scores stay unchanged. Cloud performance is not phone acceptance.

**Stop at the first reproducible structural/contact/lifecycle failure or failure
to improve death readability.** Preserve the evidence and return the design
verdict; do not add motors, alternate masses, more iterations, a new launch,
CCD variants or extra bodies in the same experiment. A pass authorizes reporting
an isolated prototype result, not promotion, production deployment or a default
change. A failure returns the owner to the authored-separation decision with its
terrain/continuity requirements still explicit.

## Project source anchors

- `src/engine/physics/ragdoll.ts`: `quadParts` (six lite / eleven full), constructor
  launch/mass/body/joint creation, `fixedPre`, `fixedPost`, `write`, `freeze`,
  `removeBodies`, and `Ragdolls.spawn` cap/fallback ownership.
- `src/engine/physics/rigidCorpse.ts`: strict eight-part recipe, captured policy,
  uniform scale/ancestry validation and native convex construction.
- `src/engine/entities/rigidCorpsePose.ts`: captured snapshots and fixed publication;
  `AnimalView.ts`: killing-hit ragdoll handoff.
- `src/engine/physics/groups.ts`: DEBRIS meets WORLD only;
  `bodies.ts`: separate 40/150 awake-body service caps;
  `Physics.ts`: native stepping, scope ownership, snapshots and disposal.
- `src/format/rigidCorpse.ts`, `src/format/nativePhysics.ts`,
  `src/game/plugin/geometry.ts`: strict data admission/transport surfaces.
- `docs/reviews/bellback-runtimecandidate4-source/attached-shape-api-review.md`;
  `docs/reviews/bellback-collision-options/REVIEW.md`: earlier API review and
  now-completed captured-hold recommendation, retained as historical evidence.

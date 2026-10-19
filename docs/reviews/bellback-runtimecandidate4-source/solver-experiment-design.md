# Proposed opt-in solver experiment, not implementation

2026-10-19. No settings or code changes and no new simulation authorized here.
Keep the 5 mm dynamic penetration gate and the stricter settled/no-hover review.
The current failed baseline stays immutable.

## API finding

Installed Rapier0.21 exposes `RigidBodyDesc.setAdditionalSolverIterations(n)`
and `RigidBody.setAdditionalSolverIterations(n)`; defaults are zero. Documentation
states the increase applies to the body and bodies contacting/jointed to it,
not just the one body in isolation. It does not mutate global integration
parameters. `additionalPgsIterations` is a different independent knob; do not
change both at once. The existing corpse remains one dynamic body/eight massless
colliders with unchanged additional mass5, COM and inertia. A static floor is
not a reason to describe this as a global solver change.

Parent-relative collider setters accept only the new pose, with no timestep or
velocity argument. Kinematic-body next-position APIs are a different facility;
they do not automatically supply separate velocities for eight colliders attached
to one dynamic root. Therefore more iterations can test convergence of existing
constraints but cannot be assumed to supply missing articulated-shape velocity.
No wrapper-level evidence establishes that Rapier internally reconstructs such
velocity for these local setters. Do not claim a velocity-aware correction exists.

## Before a deterministic replay

Capture a fresh actual native defeat using the already-approved app, if root
separately authorizes that recording. Do not inject a state into the live arena.
At the exact creation boundary record:
- Complete root pose, scale, exact body linvel/angvel, sleep and damping, mass/COM/
  principal inertia, additional iteration flags and CCD state.
- All eight original bone transforms and owned pose inputs: clocks, deathT,
  flinch, phase, seed, state/yaw and every memory key read by the numeric program.
- Actual `world.integrationParameters` readbacks, timestep, floor shape pose and
  surface/groups, plus installed Wasm and source SHA/byte pins.
- At every pre/post step, collider parent-relative and world transforms, exact
  body velocities and active contact manifolds/normal distances/impulses. Record
  the same render endpoints and interpolation alpha without modifying them.

The existing full-combat2 capture lacks exact initial velocities and all these
inputs, so it cannot honestly supply a bit-exact freely simulated trajectory.
Its fixed-post bone stream can supply a recorded articulation regression fixture,
but must be labeled endpoint replay, not exact reproduction of its physical root.

## Bounded test matrix, if approved

1. Build a focused installed-Rapier fixture with the exact unchanged packed
   Frame2 payload, candidate4 recipe and original Tucked clips. Reuse the real
   Physics/Ragdoll/RigidCorpsePose classes and fixed ordering. No box proxies,
   mesh edits, alternate animation or forced root positions during stepping.
2. Reproduce each captured initial state/input stream at60Hz with zero additional
   iterations. Require the same contact trajectory within explicitly recorded
   float tolerance before comparing settings. A replay that does not reproduce
   the failure is insufficient evidence to choose a fix.
3. Compare only body-local additional iterations0,2,4; same initial state, recipe,
   input sequence, solver/world parameters, mass/inertia and floor. This is a
   bounded convergence probe, not an unbounded search for a flattering frame.
4. At all fixed steps and rendered30/60/120Hz endpoints (plus captured low-rate
   catch-up), calculate every original vertex's floor distance, actual hull
   minimum, manifold depth, interpolated render mismatch, root velocity, sleep/
   freeze time and body/collider cleanup. Keep both different hit directions.
5. Explicitly retain per-step support changes from animation and compare them
   with the measured contact residual. If more iterations do not substantially
   reduce that residual while maintaining contact/no-hover, report the negative
   result and stop. Do not change ERP, allowed error, prediction distance, shape
   padding, root lift, CCD, PGS, scale or global timestep opportunistically.
6. Default-absent rigid, upright and quadruped traces must remain byte-identical;
   opt-in no-contact throw/mass/inertia and living dimensions/AI/combat remain
   identical. Measure bounded CPU cost honestly; cloud data is not phone proof.
7. A successful fixture is still not arena acceptance: only then propose a fresh
   actual full-combat/collapse/frozen-contact capture, walking gate and slope/
   uneven-ground cases with exact source pins and independent review.

Recommendation: authorize the read-only missing-state instrumentation first,
then a focused0/2/4 body-local convergence experiment. It is the smallest existing
API probe, but no correct final setting is justified by current evidence. If
kinematic shape-motion velocity is the remaining cause, bring that separate
physics design back for review rather than turning these colliders into extra
bodies or adding an unrelated contact host.

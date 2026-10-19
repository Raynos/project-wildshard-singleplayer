# Single fold-aligned body descent counterfactual: rejected

2026-10-19. Isolated native study; no product source, physics setting, build or
published preview changed. Original candidate4 and all negative proof retained.

One change only: body.position.y uses the existing smooth deathT*5 fold rather
than smooth deathT, finishing the same 0.3 m descent at 0.16 s. The original
bodyY expression used by leg channels stays unchanged. Every other channel is
byte-identical in the copied fixture. Initial/final poses and living deathT=0
outputs therefore remain exact. No mass/inertia, throw, geometry, recipe,
world-default, root correction, combat timing or secondary-motion change.

Both baseline native trajectories reproduce the captured position, quaternion,
linear and angular velocities exactly over 125/98 steps. Bone endpoint error
is at most 1.11e-16. Counterfactual differences from captured trajectories are
expected and are not baseline equality errors.

Results (meters):
- Front baseline minimum -0.0132180, candidate -0.0310849, at step2/time0.05s.
  Candidate has four fixed samples below -0.005; early descent worsens overlap.
  Interpolated worst -0.0358931 at time0.058333s, alpha0.5 (60Hz half-phase).
  Candidate freezes at step130, minimum -0.00008935.
- Angled baseline minimum -0.0220328, candidate -0.00108454, no fixed samples
  below -0.005. Rendered worst -0.00110870. Candidate freezes at step97,
  minimum -0.00008199.

All 13,374 original vertices and exact hull points are evaluated at every
fixed endpoint and at actual engine render interpolation at 30/60/120Hz,
zero and half-frame phases. Same-pose mesh/hull support gap stays zero.
These deterministic cadence samples are not a browser/catch-up or visual
acceptance test. Terminal captured inputs repeat if the counterfactual outlives
the original capture; front required five additional settled steps.

Decision: FAIL, stop. No second timing variant or duration sweep. Angled success
does not outweigh the worse front transient. No visual acceptance is claimed.
No browser/build is justified for this rejected fixture.

Next recommendation, only: a velocity-aware attached-shape contact design
needs translational and rotational relative surface velocity at contact points,
consistent pre-solve timing and arbitrary terrain normals. The installed JS
Collider parent-relative setters carry poses, not shape velocities. Available
PhysicsHooks expose filtering, not a normal contact-target-velocity modification
hook; tangent-velocity getters do not supply that missing normal response.
Thus this needs an explicitly reviewed API/architecture design, not another
solver-iteration knob, padding, root bias or a claimed CCD shortcut. Do not
implement it under this study authorization.

Validation: node syntax check and isolated oxlint correctness lint pass for the
two new study sources. Repository oxlint excludes docs, so this is not a claim
of repository typed lint. Original baseline exact equality is the runtime guard.
The freeze script verifies the copied source delta exactly and pins results,
original full source/build freezes and explicit loader/Rapier JS dependencies.

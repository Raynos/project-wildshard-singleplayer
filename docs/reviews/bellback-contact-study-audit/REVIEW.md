# Bellback contact study: independent audit

2026-10-19. Read-only product/engine audit; no simulation, build, browser,
physics setting or product edit. New files are confined to this review folder.

## Verdict

The bounded 0/2/4 additional-solver-iterations study is a valid negative result.
Do not promote any of its settings. It reproduces two new diagnostic native
falls, not the earlier full-combat2 trajectories. Candidate4 remains unaccepted.

All 28 source/input/evidence entries in solver-study1/manifest.json match their
byte counts and SHA256. Manifest SHA256:
5c8f38bb0f966f83bf1a4b653c62244048c161c99c3f9ceb1bcb46b95a471e0c.
The working script is replay-solver-study2.mjs; version1 failed its object-key
order guard before simulation. Independent comparison of the saved baseline
rows and captures confirms zero difference in position, **rotation**, linear
velocity and angular velocity at every one of 125/98 recorded endpoints.
The producer's bone error is at most 1.11e-16. The native baseline reproduction
is persuasive; this audit did not independently rerun the native solver.

0/2/4 minima in millimeters:
- Front: -13.2180 / -12.2649 / -9.4048; threshold crossings 9 / 13 / 11.
- Angle: -22.0328 / -21.8041 / -21.8094; crossings 28 / 27 / 25.
- Frozen minima stay near -0.08 to -0.16 mm. Settled success does not remove
  transient failure. Front depth improves without monotonic crossing counts;
  angle depth barely changes. No further iteration escalation is justified.

The actual allowed-linear-error readback is 0.005 m, not the earlier inferred
0.001 m documentation default. That does not explain or excuse 22 mm overlap.

## Contact cause: what is established

Same-pose support gap zero means the hull and original mesh have the same floor
support at that pose. It does not mean their positions are collision-free or
that contact sees the shape's full velocity. fixedPre advances animation and
sets each collider's parent-relative translation/rotation. The root body has
one linear/angular velocity; these setters supply no independent articulated
shape velocity argument. More iterations solve those existing constraints;
they do not establish a motion-aware correction.

Independent arithmetic in audit.py reproduces the producer's surface estimates:
- Front step32, leg2: local articulation vertical velocity -0.362298 m/s;
  rigid-root surface +0.210387 m/s; sum -0.151911 m/s. Selected manifold
  separation -18.087 mm and normal impulse0.
- Angle step28, leg0: articulation -0.458862 m/s; rigid-root surface
  +0.000634 m/s; sum -0.458229 m/s. Selected manifold separation -29.512 mm,
  normal impulse0.200034. Root response can be almost stationary at the point
  while the shape continues downward.
- Angle step28, leg2: articulation -0.458862 m/s; rigid-root -0.480773 m/s;
  sum -0.939635 m/s. Selected contact separation is positive17.873 mm.

Contact points correctly select local2 when the manifold is flipped. Articulation
is a finite difference of the same local contact point through consecutive
parent-relative transforms, rotated by the captured before-step root. Rigid
surface velocity uses captured before-step linvel + angvel cross the lever from
rotated local COM. These are mixed-time diagnostic estimates, **not instantaneous
solver-internal target velocities**. Manifold distances can describe pre-solve
geometry; do not label -29.512 mm the measured final mesh minimum. Zero impulse
at one manifold point does not establish that the body receives no contact force.

The critical timing detail is in the authored clip: leg folding finishes at
0.16 s, but bodyY continues its 0.3 m descent over0.8 s. All legs inherit that
body transform. At angle step28/deathT0.604167, their relative folds are already
finished; body localY falls another9.044 mm this step. At front step32/deathT
0.6875 it falls8.198 mm. The shared body descent alone accounts for the listed
late leg articulation velocity. This is stronger evidence than a generic claim
that the feet need larger hulls.

## Smallest justified next experiment

One isolated, death-only authoring counterfactual before an engine redesign:
retime the existing body's0.3 m descent to finish with the existing0.16 s fold,
retaining its exact initial/final values, original mesh, final anatomy, leg fold
channels and all living channels. Keep root/mass/inertia, solver defaults,
colliders, throw and AI/combat unchanged. Use the same two captured initial
states/owned inputs in a separate fixture; label the altered animation honestly.
Do not run a sweep of durations or change head/bell channels at the same time.

Why: it removes the specifically identified late inherited downward motion,
using the existing authored death phase rather than adding a physical root lift.
Risk: a faster early descent can create larger early overlap or an abrupt snap;
it is not a promised correction. Score every step, including the early fold,
and require visual judgment before accepting altered motion.

Stop after this one counterfactual. If it fails5mm or creates bad early motion,
return to a narrowly opted-in velocity-aware contact design. That design needs
explicit contact-point relative motion for rotating/translating attached shapes,
consistent fixed/render ordering and arbitrary terrain normals. Root velocity
bias, collision padding, solver-default changes, CCD assumptions, and a flat-floor
root correction are not substitutes. No such design is implemented or proved here.

Any passing endpoint fixture still requires rendered interpolation/catch-up
checks, default-absent parity, actual full combat, settled/no-hover review,
walk clearance and non-flat support evidence before runtime acceptance. Do not
change living animation/AI/combat as part of this contact correction.

## Scope and evidence caveats

- Replay driver compares only position/linvel/angvel, not rotation; this audit
  independently closes that baseline rotation check using saved rows.
- Comparison runs may last beyond the captured input stream; they repeat its
  final inputs. Here death is already complete and terminal inputs are stable,
  but retain this disclosure rather than calling every extra step captured.
- The manifest is a useful study pin set, not a complete standalone transitive
  source lock: driver imports such as the admission helper, native JSON and
  Rapier loader/glue are not individually listed. Preserve the existing complete
  candidate source/build freeze when reproducing; add explicit pins if packaging
  this study alone. This does not invalidate observed baseline equality.
- No new visual review, terrain acceptance, or phone-performance claim here.
- Earlier contact-diagnosis.md says28 gameplay checks; the authoritative complete
  independent review says27. Keep27 until the original check list is reconciled.

Evidence: ../bellback-runtimecandidate4-source/replay-solver-study2.mjs;
../../../art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/solver-study1/;
../bellback-following-independent/REVIEW.md. Local verification: audit.py and
verification.json in this folder.

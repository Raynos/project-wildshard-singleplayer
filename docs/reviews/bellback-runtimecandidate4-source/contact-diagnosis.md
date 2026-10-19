# Candidate4 actual contact: bounded diagnosis, no tuning

2026-10-19. Runtime-unaccepted. The unchanged product
`72899786be0fa353ed1d6197d1ea7586db46f12983f4607936a0ac34a0866bef`
passes all 28 actual combat/isolation checks in full-combat2. Both deaths reach
frozen poses and remain stable for 56 observations each. Frozen mesh minima are
-0.1364 mm and -0.0884 mm. These do not erase 13 dynamic frames below -5 mm.

## What the captured geometry establishes

- All 1,223 renders retain original mesh root matrices and all eight bone poses;
  all 13,374 original vertices are reconstructed at each render.
- Same-pose exact hull versus original mesh support gap is zero at every render.
- First rendered worst: frame 517, carrier/body -15.7336 mm; latest Rapier shape
  -13.6498 mm. Interpolated render is a further 2.0838 mm lower.
- Second rendered worst: frame 799, forefoot -22.0283 mm; latest Rapier shape
  -22.0409 mm. Render is 0.0127 mm higher. This failure is already in physics.
- 218 recorded fixed-post endpoints reveal a deeper first impact: frame 516,
  deathT .708333, body hull -24.2654 mm. A cloud render did not directly display
  that endpoint. The varied-angle worst fixed endpoint is -22.0409 mm.
- Recovering the rigid root from its body collider and current body-bone transform,
  then predicting every other collider from the same current hierarchy, gives a
  maximum vertex mismatch of 0.05952 mm. This is consistent with float32 world
  coordinates near Y900; it is not a centimeter-scale stale-pose defect.
- Animation alone lowers the support minimum 5.675 mm and 7.581 mm in the two
  worst fixed steps, measured while holding the previous physical root fixed.
  The second transient grows through repeated 7–8 mm downward pose changes per
  step and diminishes as collapse motion slows.

The endpoint-derived root velocity estimates at those two steps are respectively
[-.404,-1.540,-.248] and [-.734,-.670,.821] m/s; angular-speed estimates 1.282 and
.825 rad/s. They are finite differences over nominal 1/60 s, NOT recorded Rapier
linvel/angvel, instantaneous contact-point velocities, or contact impulses. The
capture did not record those exact quantities or manifold separation. Do not
invent them from an endpoint estimate.

Fixed-pre world-space collider queries can retain the prior cached world pose
until physics.step, despite setting a new parent-relative pose. The first such
record visibly pairs new bones with old collider world orientations. Therefore
this analysis excludes fixed-pre world getters from same-time alignment claims;
future instrumentation should also record parent-relative collider transforms.

## Existing settings and interpretation

`Physics.ts` sets only gravity and the 1/60 s timestep. The opted-in ragdoll keeps
legacy mass5/COM/inertia, friction .9, restitution .05, damping .1/.3. It does not
set extra solver iterations or CCD. No code or settings were changed here.

Installed Rapier0.21 integration-parameter documentation describes normalized
allowed linear error .001, prediction distance .02, solver iterations4, internal
PGS iterations1 and max CCD substeps1. These are documentation defaults, not a
readback from this completed world's instance. Prediction distance is an outer
contact-generation distance, NOT an allowed penetration allowance. Even the
nominal1mm allowed error does not excuse the observed22–24mm dynamic overlap.

Evidence strongly favors transient response to moving parent-relative shapes,
combined with physical root impact, rather than an incomplete geometry envelope
or material render/fixed-pose skew. Continuous local collider motion is not a
rigid-body velocity; simply relocating its shape each fixed-pre can require the
solver to correct new overlap repeatedly. This remains a causal interpretation,
not a measured manifold/solver-internal proof.

## Smallest next investigation, pending review

First add read-only recording of actual integration parameters, parent-relative
shape transforms, root linvel/angvel, active contact manifold depths and contact
impulses to the next already-approved capture. Preserve this failed baseline.

If authorized to test a bounded correction, the narrowest existing API is extra
solver iterations on the opted-in rigid body only (`setAdditionalSolverIterations`),
with old branches, geometry, mass/inertia and global defaults unchanged. Treat a
small fixed increment as an experiment, not a promised fix: contact softness and
unmodeled articulated-shape velocity may dominate, and extra iterations may not
remove their steady residual. CCD alone does not prove it sweeps changes in local
bone-relative collider transforms. If the bounded experiment fails, stop and
review coherent shape-motion/contact-velocity handling; do not accumulate padding,
root lifts, changed anatomy, global tolerance changes or unrelated solver tuning.

No physics edit, setting change, new simulation, acceptance or public promotion
was performed for this diagnosis. Cloud rendering was roughly observed at a low
cadence and overlapped root checkpoint hooks07:25:14–07:26:16. No phone-performance
or slope/uneven-ground proof is present.

# Pitcher core-hit / seven-shape corpse source study

Status: **retain as rejected contact WIP; no product or app build**.

The earlier full-geometry living capsule enclosure was an overbroad hit-volume
requirement. Existing gameplay can use explicit torso/central-head hit regions
without enclosing decorative leaves, roots or secondary attack emitters. This
study chooses that conventional scope and keeps the actual model and bind
positions unchanged. Side mouths are not additional damage targets; actual
combat feedback and readability still need independent review.

The separate corpse uses the existing one-root Ragdolls service, seven following
convex shapes and 455 actual extremal points. All native vertices are exclusively
weighted to those seven bones. Each hull encloses its exact part without padding;
positions, colors, skin, native payload and numeric clips are unchanged. No extra
body/joint, engine branch, callback, clock, solver setting or root lift was added.

Three source tests pass: the real packed consumer and unchanged strict recipe
schema; independently copied nested data; registered numeric pose ownership and
explicit unaccepted status. These are structural checks, not contact acceptance.

One actual native Rapier/Physics/Ragdolls/RigidCorpsePose test measures four lethal
starting phases/directions for eight seconds each at 60 Hz. It checks every
rigid-weighted source vertex against the flat floor at fixed endpoints and
render interpolation alpha .5, retaining all 1,920 rows and world matrices.
The measurement test completed, but **all four trials fail the 5 mm contact gate**:

- Idle/rightward: fixed9.475 mm, interpolated9.454 mm penetration.
- Central attack/forward: fixed13.005 mm, interpolated11.467 mm.
- Left attack/leftward: fixed16.665 mm, interpolated16.629 mm.
- Right attack/backward: fixed15.320 mm, interpolated12.766 mm.

All four finish frozen. This is real controlled native simulation, not game
footage, an independently reviewed animation, terrain coverage or phone proof.
No numerical score is assigned. Do not promote or tune solver parameters around
this failure. Preserve the sources and diagnostics for a consequential future
contact/animation design, and continue the other complete enemy passes.

Reproduce source metadata with prepare.py using installed NumPy/SciPy. Run
brine-pitcher-core-runtime.test.ts and brine-pitcher-core-corpse.test.ts through
repository Vitest. Keep outputs from completed studies immutable when comparing
future candidates; use fresh paths for later work.

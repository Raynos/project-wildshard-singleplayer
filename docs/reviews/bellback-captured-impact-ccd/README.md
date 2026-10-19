# Candidate5 initial-impact CCD causal study

**Result: no improvement; stop.** One body-local CCD=false/true comparison ran
for captured case0, zero-based fixed steps 0–56 only (57 endpoints, 0.95 seconds).
Every saved observation is identical between arms except the CCD flag. No engine,
product, solver, geometry, mass/inertia, timestep, throw/spin, or global setting
was edited. No additional knob was tried.

- Original-vertex and actual native convex-hull minimum: −10.3021531 mm.
- Strict 5 mm fails at fixed steps 0, 1, 2 in both arms (57 measured).
- Interpolated original-vertex minimum: −10.3168561 mm.
- Strict 5 mm fails at 14 of 285 interpolation samples in both arms.
- Original-vertex/native-hull support gap: exactly zero at all 57 endpoints.
- Minimum native manifold distance: −10.3020668 mm in both arms. Manifolds retain
  a previous geometric endpoint; they do not replace current vertex support.
- Baseline and CCD=true have exactly the captured body trajectory in this window.

## Scope and exact gate

The older whole-lifecycle gate still **fails at step 57** and its CCD=true arm
remains **unrun**. All original sources, captures and refusal outputs are
preserved unchanged and pinned here. This is a separately authorized causal
window; it does not loosen, relabel or retroactively pass the old gate.

Before enabling CCD=true, the new baseline asserts exact numerical equality of
all captured initial body fields, native hull vertices/indices, all physical
collider properties and held bone translations/quaternions. At each of steps
0–56 it asserts every before/after body field (including mass, local COM,
principal inertia and inertia frame, damping, gravity, solver counts, CCD,
sleeping and full rotation), all bone transforms, pose context/memory,
local/world physical collider fields, every captured manifold normal/contact
point/impulse/solver point, and result state. Global integration settings are
also checked. Browser frame/wall-clock counters remain provenance; allocator
handles are mapped to their physical shapes instead of requiring identical
numeric handle identities in a new world.

The counterfactual starts with the same verified initial body and then calls
only enableCcd(true). All held bones, local shapes, context, mass/inertia,
damping, gravity, solver counts and global settings remain asserted. The saved
comparison separately proves equality of every output value except CCD.

## Measurements and limitations

Every one of the 13,374 canonical original vertices and 430 actual native hull
vertices (eight convex parts) is transformed against the captured flat floor
at y=900 for every endpoint. Actual native hull vertices are read from Rapier,
not substituted by the 435-point recipe. Native contact manifolds are recorded
in full. The real ragdoll render interpolation runs at alpha 0, .25, .5, .75, 1
for each interval and measures all original vertices. Equality at these samples
is not continuous-time proof. Samples at interval boundaries may duplicate an
endpoint; counts describe observations, not unique instants.

This diagnostic says nothing about final settle, freeze, whole lifecycle,
terrain, general contact acceptance, phone behavior or real gameplay. It does
not choose a fix. The initial downward rear-foot velocity from root spin is
still the earlier classification; CCD alone has no observed effect here.

## Reproduction and complete evidence

Run from repository root, with existing dependencies:

    node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/bellback-captured-impact-ccd/replay-impact-ccd.mjs docs/reviews/bellback-runtimecandidate5-actual <new-output-directory>
    node docs/reviews/bellback-captured-impact-ccd/verify-result.mjs

The first command rejects altered pinned sources and refuses a comparison if
any exact baseline assertion fails. The second verifies the preserved run1
results and source pins without re-running physics. run1/baseline.json and
run1/ccd-true.json are complete ordinary JSON; no data archive or chunks.
source-pins.json identifies the captured data, original study, candidate tuple,
relevant source and WASM bytes. manifest.json pins this deliverable. No build,
install, browser, Mac, Git, STATE or product action was performed by this study.

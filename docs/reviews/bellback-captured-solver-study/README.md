# Captured rigid-impact bounded diagnostic

Candidate5 actual strict contact failed at the first three 60Hz endpoints,
within 50ms of lethal throw. See impact-classification.json and its read-only
source for native initial CCD=false, root velocity and actual worst-vertex
point velocities. The foot begins moving downward at 7.4515m/s while root
velocity is upward 2.6m/s; this is a root-spin impact, not local shape animation
or a resting hover residual. Native manifolds retain a previous geometric
endpoint in this trace; both are separately preserved.

The prepared replay-solver-study.mjs is UNRUN. Its proposed body-local 0/2/4
iteration comparison was superseded before execution, not failed or completed.

The replacement replay-ccd-study.mjs compares exact baseline CCD=false with one
CCD=true counterfactual on that same single body. No product or gameplay changes.
Uses actual Physics, Ragdolls and captured RigidCorpsePose classes, original
initial throw/spin, complete eight-part native shape/pose recipe and captured
static environment. Solver iterations, PGS, mass/inertia, damping, global world
settings and fixed timestep remain unchanged. Requires exactly identical
baseline body/quaternion/bones and freeze step before a comparative run. Every
fixed endpoint and five render interpolation fractions are measured across all
13,374 original vertices, with manifold distance and body velocity. These
samples are not continuous-time proof, phone evidence, terrain acceptance or a
fresh actual arena capture. If strict 5mm fails, stop; no further parameter knobs.

## Result: exact-baseline gate refused, CCD=true unrun

The baseline using the normal bake-loader completed. Native initial state and
first 57 fixed endpoints match the actual captured case exactly, including all
three strict-contact failures. At zero-based step 57 the settling trajectory
first diverges. Maximum body/velocity discrepancy is 0.0856567, with the same
88-step freeze count but final contact minimum -0.5701mm instead of -0.0352mm.
Held bones remain exact. The baseline remains insufficient for a whole-lifecycle
exact counterfactual, so the script refused before enabling CCD=true. No
comparative CCD run, solver setting run, product edit or further knob occurred.

An initial sim-node-loader invocation refused an imported renderer tier module
before native setup. The existing general bake-loader supports the real engine
imports; no loader guard or production source was changed. Both attempt logs
are retained. Their displayed workspace prefixes are redacted only; native
results are unchanged.

`ccd-run1/baseline-refusal.json` and `case0-ccd-false.json` retain the refusal and
complete baseline fixed/render observations. Reproduction command:

    node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/bellback-captured-solver-study/replay-ccd-study.mjs docs/reviews/bellback-runtimecandidate5-actual <new-output-directory>

A full native world/contact-state difference or omitted runtime interaction may
explain late divergence; this has not been established. Do not present the
unrun CCD counterfactual as passed or failed. Exact initial failure reproduction
does support the recorded causal classification, without granting a modified
contact acceptance. Further action belongs to the coordinator.

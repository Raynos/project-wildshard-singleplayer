# Mantis periodic gait source study

One bounded source-only study following `../mantis-gait-audit/REVIEW.md`.
Candidate7's published fallback and every product source remain unchanged.

## Fixed problem

The one target retains the audit's 62% stance, doubled presentation phase,
0.493184 m stance return, 120 mm swing lift, inward 120 mm foot centers and
front/rear Z shifts of −200/+100 mm. The native rig, all binds, geometry and
bone lengths are fixed. Four Euler coordinates per foot are hip X, mirrored
hip Z, mirrored knee Z and mirrored hip Y; composition is native XYZ.

A constant plus eight sine/cosine harmonics directly parameterizes each joint
angle, globally across the normalized authored cycle. Consequently endpoint
values and every derivative agree analytically. This differs from joining
pointwise IK solutions with potentially different redundant-joint choices.
The implementation is offline numerical research only. It introduces no
runtime solver, table, state, joint-history feedback, clock or engine service.

A single least-squares solve per anatomical chain adjusts the coefficients,
using the audit's pointwise solutions only as initial seeds. The fixed fit
uses 128 phase samples, both stance/swing positional errors, five intermediate
speed blend floor penalties, mild high-frequency regularization and hip-bound
penalties. It compensates the existing 20 mm body bob, without changing it.
Breath is bounded by the existing ±8 mm amplitude. The optimizer has a fixed
100-function-evaluation budget per chain; a budget stop is not convergence.
There is no subsequent amplitude search or fit retry.

## Reproduction

Run from repository root with the already installed Python NumPy/SciPy:

    OPENBLAS_NUM_THREADS=1 python3 docs/reviews/mantis-periodic-gait-source/fit.py
    OPENBLAS_NUM_THREADS=1 python3 docs/reviews/mantis-periodic-gait-source/evaluate.py
    python3 -m unittest discover -s docs/reviews/mantis-periodic-gait-source -p test_fit.py -v

The fit writes every coefficient and solver status to `fit.json`. Evaluation
uses 512 samples per authored cycle for foot error, seam and 60 Hz quaternion
checks. Full weighted-geometry evaluation uses 512 existing-clock phases
(two authored cycles), every native vertex/influence, both breath extrema,
and sampled speed blend weights including requested low-speed cases. It
preserves neck/head/abdomen/wing idle rotations, fixed root and body bob.

Floor evaluation is on a flat, identity actor world, without combat/flinch.
Steady straight-motion slip is a coherent source fixture, not a claim about
an actual run, turns or collision/contact forces. A passing numeric study
would still require exact numeric-channel construction/DAG admission,
recorded-input replay, stop/resume ramps, attack/flinch/death transitions and
fresh normal-speed portrait motion review. Any failed mandatory source gate
stops this attempt before a runtime module or build.

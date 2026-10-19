# Periodic mantis gait: rejected source fit

2026-10-19. **Reject this single bounded attempt. Keep candidate7 exactly as published; no new runtime candidate, build or visual score.** The globally periodic representation fixes the audit's endpoint seam, but fails several mandatory source gates. This is a failed fit under the selected representation, objective and budget, not proof that the native rig cannot support an authored gait.

## What completed

- Four native hip/knee chains fitted offline with eight Fourier harmonics per Euler coordinate. All coefficients and solver termination messages remain in `fit.json`.
- Left-rear converged after91 function evaluations. Both front chains and right-rear reached the fixed100-evaluation budget. None was retried with changed amplitudes or targets.
- Analytic Fourier endpoint equality verified numerically: worst angle seam1.905e−16 rad; derivative seam1.021e−15 rad per normalized cycle. There are no piecewise joint-angle boundaries.
- Five diagnostic integrity tests pass in `tests.txt`: periodic value/derivatives, independent SciPy native XYZ composition, rigid knee-weight ownership/bind pose, zero-speed exact leg rest, and fail-closed saved report. These tests are not clip, motion, contact or quality acceptance.

## Mandatory failures

1. **Target fit:** left-front stance11.120 mm/swing12.993 mm; right-front stance17.059 mm/swing18.440 mm. Limits are5/10 mm. Rear errors stay below0.842 mm, but a partial-leg success cannot admit the animal.
2. **Stop/resume geometry:** every native weighted vertex was evaluated across512 original-clock phases (two authored cycles), sampled speed blend weights and both existing breath extrema.930 of24,576 evaluated poses penetrate; worst−3.620 mm on right-front knee geometry, original phase.572265625, blend.35, breath−.008. These are sampled flat identity-world results, not a continuous-time bound. The sweep includes a few nearly duplicate floating-point blend values from merging the requested speeds with the uniform grid; counts are evaluated poses, not independent trials. The minimum and rejection do not rely on their multiplicity.
3. **60 Hz local rotation:** left-front hip reaches.151699 rad and knee.111364 rad; left-rear hip.119321 rad; right-front knee.118648 rad. Limit is.10 rad. These are smooth but excessive per-frame rotations, not endpoint seam jumps.
4. **Stance height:** front maxima including breath are33.032 and38.302 mm, exceeding30 mm. Lowest full-speed stance height is6.191 mm. Swing peaks are approximately135 mm; sufficient swing lift does not cancel the other failures.

The optimizer uses a soft .65 rad penalty on hip X/Z, not a hard joint-bound constraint; fitted mirrored hip Z peaks at.653897 rad. Knee and hip-yaw coordinates were not separately hard-bounded in this solve, although sampled ranges remained within the audit's earlier ±1.2/±.65 ranges. Preserve this distinction rather than calling the result a bounded anatomical proof.

## What improved in the mathematical fixture only

At constant1.15 m/s on the coherent straight-motion source fixture, interior-stance foot/root travel ratios are.01036–.02084 and median foot speeds.00969–.01608 m/s. This is relative-motion cancellation in the fitted source, not a replay of the recorded game, a normal-speed motion review or contact acceptance. It must not replace candidate7's measured actual-run ratio1.010056 or its2/5 animation judgment.

At exactly zero blend, all fitted leg angles are exactly zero and native bind-leg geometry is recovered. Nevertheless the intermediate blend penetrates, so this does not establish acceptable stop/resume. No new clips, clocks, geometry, root translations, collider changes, AI, damage or rewards were introduced. Candidate7 rest, attacks, death and fallback stay unchanged because no product source was edited.

## Stopping decision and limits

The failed source gates stop this attempt. Exact numeric-channel DAG admission/evaluator, all1,306 recorded-input replay, actual-world turning/ramps, attack/flinch/death-transition clearance and fresh visual/anatomical review were not advanced. There is no reason to spend a build or browser capture on this rejected fit, and no4/5 claim. Root should rotate to the next enemy under the owner's current direction rather than extend this into parameter chasing.

`README.md` describes the fixed problem and reproduction commands; `evaluation.json` retains per-foot measures and the complete minimum witness; `fit-run.txt` and `evaluate-run.txt` retain command output. Native geometry SHA256 is recorded in `fit.json`. No Mac, paid service, remote write, child agent, full-root typecheck or app build was used.

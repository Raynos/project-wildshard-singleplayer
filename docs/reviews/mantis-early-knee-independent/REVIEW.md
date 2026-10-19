# Candidate6 independent source review

2026-10-19. **GO for one bounded actual diagnostic capture. HOLD promotion.** Public candidate4 stays. This is permission to obtain missing evidence only; all visual, collider, physical-phone and runtime acceptance remains false. No build, browser, gameplay changes or remote writes were performed by this reviewer.

## Frozen scope and provenance

Reviewed producer source closure `3c61ef62e165f6651256f792b5a8d5d0b80d884b8f7637d2f8c3c57157d31c1d`, and frozen producer results `af45e34f9f010879bd8924eaf289ca07146adad9607d2f24de88d67b5acbcfce`. Closure verification is retained separately. All 85 historical candidate4/5 source and capture entries rehash correctly (18+16+23+28). Their old failures remain authoritative.

Direct source comparison changes precisely the four walking-knee rotation-Z death expressions from D=smoothstep(deathT) to K=smoothstep(2.5×deathT), plus identifiers/comments. The living knee gait still uses D. The preview is isolated, and its exact-hash admission pins the native bytes, candidate metadata, four-knee source, existing decisions and their behavior. No production entry or host exemption changed. The body, hips, raptors, active-onset semantics, live channels, dimensions, geometry, AI and clocks retain candidate5 behavior.

The existing envelope .38K+2K(1−K) keeps its endpoint angles and .70805rad maximum. Its tuck and subsequent return both happen 2.5× sooner. At deathT .4 (0.32 seconds under the existing 0.8-second normalization) the death term is already .38rad and stays there, while the original body/hip collapse continues. This earlier return is part of the proposal, not a monotonic extra tuck or an enlarged fold. Smoothstep gives C1 endpoint joins, not perceptual smoothness. At nonzero speed the unchanged live gait term can still contribute until its original D envelope ends; actual ragdolled updates set speed to zero.

## Exact inputs and independent geometry

The production update path advances PracticeCreature.elapsed, passes it to AnimalView, updates deathT/flinch, and invokes numericCreaturePose. Correct time is boutTime15.917499999999974 at HUD390, not gameTime34.19939999999118. At this sample deathT .1103749999962747, flinch .6152971236343303, speed0, gait .9117436717979435 and stage5 reproduce all 22 local transforms. Candidate4 and candidate5 are identical here. The risk is unchanged anatomy under the captured root trajectory, not demonstrated onset causation or a host bug.

HUD389 is a separate lifecycle boundary: captured scalar flinch has become1 after the animation; prior flinch reproduces its pre-hit pose. The current HUD390 inputs are exact. Candidate4 omitted boutTime, so full candidate4 scalar replay is not claimed. Candidate5's other full-replay mismatches remain in the raw producer report rather than being generalized away.

Independent `crosscheck.py` evaluates the knee formula separately in Python, then reconstructs the native rigid-weighted vertices with NumPy: local xyz/xyzw poses, every parent transform, absolute bind subtraction and the complete column-major meshWorld. Candidate4's omitted floor is the practice host's900m floor; candidate5 records900. Actor position/yaw are never substituted for meshWorld.

All 469 candidate4 and 1,355 candidate5 captured baseline knee inputs match the independent formula to ≤3.47e−18 quaternion component error. Substituting only candidate knee quaternions into each full captured skeleton yields positive all-part floor clearance in all1,824 rows. Independent versus producer minima differ by at most1.14e−13m. HUD390 reproduces **−102.229490739mm**,98 below-floor vertices, before the substitution and **+59.176055740mm**,zero below-floor vertices, afterward. Global candidate minima are only +.672828108mm and +.671694238mm, in living samples; these are not robustness margins.

These are captured-pose substitutions, not new simulated deaths. Exact knee inputs do not make the remaining captured pose a full scalar replay. The body root was held fixed; no physics future was run.

## Retained adverse evidence and screening limits

The synthetic interval HUD389→390 reaches **−10.032655001mm** at alpha .35/deathT .03863125, versus baseline −33.040978946mm. It linearly interpolates root translation/scale and local positions, slerps rotations, and evaluates only the knee curve with interpolated scalar inputs. The minimum has12 below-floor vertices. This invented path crosses the lethal state/animation boundary, and is not a measured simulation path. Nevertheless it prevents any inference of between-sample clearance and makes the first0.1seconds a priority in actual capture. Candidate4's corresponding synthetic neighborhood minimum is +21.246430566mm. Neither result certifies continuous contact.

Adjacent recorded early-death knee changes rise to .395484rad on candidate4 and .374148rad on candidate5. Candidate5 then changes .332220rad and returns by .268861rad. An earlier faster tuck can read as a snap even with a continuous formula; source checks cannot accept motion.

The triangle test uses real native triangles, AABB rejection and separating axes. It screens different walking legs only, excludes the two segments of the same leg, and detects surface crossing rather than solid containment. No new crossing pair appears in captured substitutions or synthetic intervals; the101 retained dense poses also have none. It does not certify body/wing/raptor intersections, same-leg overlap, contained geometry or swept collision. All-part floor measurements are a separate calculation. No collider verdict follows either screen.

## Why a bounded capture is warranted

The isolated edit clears the exact known failure without changing amplitude/endpoints or unrelated channels. Its strongest remaining risk is timing/contact between observed poses, and source analysis cannot resolve that. One actual diagnostic therefore has concrete value even though the synthetic path is negative. A positive diagnostic would still require independent full-frame review and would not automatically permit promotion.

Capture requirements:

- Freeze source, admission, product and host identities before recording; keep all evidence and failed assertions. Public candidate4 remains unchanged.
- Record several genuine lethal hits after independent retries, with varied approach/headings and hit directions/positions, using ordinary host behavior. Include both stationary and recently moving deaths. Record enough full root trajectories to distinguish one favorable fall from reliable articulation; do not replace failures with a favorable take.
- Keep exact per-render scalar inputs (especially boutTime), full22-bone local transforms, complete meshWorld, floor and actual hit/death lifecycle markers. Resolve the post-animation lethal boundary honestly. Inspect all recorded early-death poses through at least the0.32-second return,0.8-second body completion and settled tail. Reconstruct every native part, retaining all negative vertices and local transitions.
- Review every encoded frame in chronological coverage and full-frame detail around every death; judge tuck, peak, early return, snapping, interpenetration, plantedness and settled stability. Distinguish encoded duplicates, render samples and unsampled simulation intervals. Do not call a contact-sheet sequence normal-speed smoothness proof.
- Preserve living approach/stop/resume, the two attack cycles, genuine flinch/hit behavior, retries and unchanged candidate5 abrupt onset. Missing interruption or cadence cases remain missing; terminal regenerated health must not erase actual damage history or rewrite old harness failures.

Physical-phone performance, broad contact robustness, collider quality, fair continuous attacks and human fun remain unaccepted. No score increase is justified by source or counterfactual clearance.

## Independent reruns

After root checkpoint-lane release, unchanged focused Vitest passed7/7 (six study tests plus one preview test); candidate4/5/6 strict admission checks passed8/8. The producer authorized the exact deterministic proof rewrite. Frozen producer results were preserved before execution and compare byte-for-byte afterward; all24 source/proof closure entries still match. Logs and rerun-check.json are retained; only the absolute local repository path in the test log was replaced with <repository> for public screening. This is focused proof only, not a full suite or build. No implementation tuning occurred.

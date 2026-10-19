# Mantis gait audit: authored planting, not amplitude tuning

2026-10-19. **Recommend one source-only globally periodic authored gait fit. No clip or visual acceptance.** Preserve candidate7's exact public host, combat, accelerated-knee death and completed static 3.6025 gate. This audit changed no product files and ran no build, browser, Mac, remote write or publication.

## Finding from actual candidate7 poses

The existing gait does not counter root travel during stance. In 198 strictly classified locomotion rows, the four fixed material foot patches move almost exactly with the root:

- 310 straight nominal-stance intervals: feet travel 23.464715 m, corresponding root travel summed over feet 23.231108 m; ratio **1.010056**. Median horizontal foot speed **1.055462 m/s**.
- 310 straight near-floor intervals (patch minimum ≤30 mm at both ends): ratio **1.028186**, median foot speed **1.098422 m/s**.
- Local material foot fore/aft excursion is only **0.204369–0.221611 m**. Recorded stalk speed is usually 1.15 m/s. Existing phase progresses at ~0.722854 Hz: **1.590916 m of root travel per phase cycle**.
- Foot minimum clearances over locomotion range from 0.674 mm to 118.110 mm. That can provide apparent lift, but it is not useful stance anchoring. The near-floor foot continues moving at approximately the root's speed.

These are full native skin-weighted point measurements, not joint-origin proxies. `measure.py` fixes each foot patch once from the lowest 30 mm of its bind knee-part geometry (36 left/42 right vertices; duplicated mesh vertices retained consistently). It reconstructs the parent hierarchy and actual full column-major mesh world, then measures the same material centroid throughout. Nominal stance means the existing unflexed-knee sine half, not a claim of real contact. Near-floor is a separate geometric proxy. Neither proves contact forces, triangle collision or continuous-time support.

Input trace SHA256 `8e48ee230fe7bf739b0303ba3c0463c087bea9778828f8d19b42c2f5d1558826`; native JSON SHA256 `6c47dd59acdc01993b84f70adf39a1c3f050088e6bbd781409514f85fda75bb0`. The authoritative prior review is `../mantis-precontact-independent/capture2/REVIEW.md`. This audit does not rerate its 2/5 animation judgment or reclassify its failed early/late-hit checks.

Two independent diagnostic tests pass. Using the separately captured per-joint world matrices, the maximum material-centroid difference is **1.023182e−12 m** over all 1,306 poses; per-part minimum heights also match. Tests check bout, hit-count and sample-time exclusions.

### Translation categories stay separate

Classification uses pose-owned inputs first; outer strike state is also required to be idle for clean locomotion. Living phase-0/stage-0, speed>0.2, no flinch rows qualify. Attack stages1/3, observed attack/boundaries, hit/flinch, stationary/recovery and death are separate buckets. Pair measurements reject changed category/bout/hit count, nonpositive or >150 ms time steps and >0.5 m root moves. Straight metrics require ≤5° adjacent yaw change. `metrics.json` holds every category; `pairs.json` and `trajectories.json` preserve the real row-level evidence.

Counts: locomotion198; attack/boundary557; hit/flinch260; stationary/recovery119; pose-input-dead172. The earlier review's 173 outer-state-dead samples are not contradicted: this classification deliberately uses pose-owned alive, which differs at an onset boundary. No attack charge or knockback displacement is scored as walking slip. Stationary/recovery pairs have zero root and foot horizontal travel. Complete approach phase wraps exist in runs645–696,1115–1166 and1260–1309; these are actual source rows, not another capture.

## Contract and prior experiments

Actual22 is body, neck, head, abdomen; two leaf joints per side; two hip/knee chains per side; and raptor/elbow/hook per side. Four walking feet are knee-weighted; there is **no ankle/tarsus joint**. Therefore a flat independently oriented sole cannot be promised. Hip translations are fixed native bone lengths; geometry and binds remain unchanged.

- Native candidate1 authored hipX .16 and kneeZ .18 sine motions; its floor/death and combat evidence failed.
- Grounded candidate2 altered death/body grounding but retained the same sine gait. Its phase clock was not reliable for long active strikes; sampled corpse penetration remained. No true stance-return trajectory was authored.
- Phase candidate3 added authoritative observed strike phase, flinch support and reduced gait to hipX .08/kneeZ .09; body gait bob .04→.02. This repaired other floor problems by shrinking the motion, not by planting feet.
- Folded candidate4 changed death-only anatomy. Living gait stayed candidate3-exact.
- Onset candidate5, early-knee candidate6 and precontact candidate7 targeted attack onset, accelerated death tuck and precontact sweep respectively; they did not replace the gait.
- Historical native/grounded/phase/folded envelope tests enumerate sampled vertices but explicitly do not assert contact acceptance. Repeating those reports or raising the old amplitude is not a new gait solution.

Current `mantisPrecontactClips.ts` uses diagonal half-cycle offsets; `moving=clamp(speed)*(1-first-second)`. The latter intentionally suppresses walking in attack stages even if gameplay translates the actor. Preserve that boundary. `animalPose.ts` selects the ordinary walk phase law: stride=2×legLen×sin(.36), stance=.62, frequency=max(.6,speed×stance/stride) at this stalk speed, legLen≈1.4. Presentation can use **two integer-periodic steps per existing phase** without modifying that clock. At the measured speed this gives1.445708 steps/s and0.795458 m root travel per authored cycle. Do not retune engine gait dimensions or tactical speed to make a clip pass.

## One proposed authored cycle and bounded reach preflights

Use a62% stance,38% swing cycle, opposite diagonal pairs half a new cycle apart. Desired foot travel relative to the actor is linear rearward through stance; swing returns on a quintic fore/aft arc matching stance velocity and acceleration at both boundaries, with a120 mm sin² vertical lift. Plant near15 mm vertex clearance, not an invented contact force. With doubled presentation phase, stance travel is0.493184 m. Current phase/body timing is unchanged; compensate the existing breath/bob in the leg fit rather than introducing body/root translations. Optional small rotational body/neck counter-motion must be fitted jointly and separately floor-tested, not added after contact tests pass.

All three preflights and complete targets/angles/errors are retained:

1. `rejected-wide-reach.json`: same wide bind-foot centers, hipX/Z and positive mirrored kneeZ only. Maximum target miss177.367 mm; knee minimum−87.585 mm. This restricted target is infeasible under those chosen bounds; it does **not** prove the complete rig cannot reach.
2. `rejected-positive-knee-reach.json`: added hipY and authored stance centers120 mm inward, front200 mm rearward/rear100 mm forward, but retained positive knee fold. Miss249.319 mm; minimum−144.392 mm. Rejected. No more positive-amplitude tweaking.
3. `reach.json`: the **same** centered path with signed knee fold is pointwise reachable: worst target residual1.22e−11 m; knee-part minimum15 mm. Hip yaw is within approximately−.219…+.344 rad; mirrored knee fold−.784…−.126 rad. Negative fold is materially different from the old positive sine. It needs anatomical/silhouette review, not merely a numeric sign change.

The third result still **fails clip readiness**: the redundant pointwise solve chooses different angles at the identical cycle endpoint. Worst joint-angle-vector seam is0.217323 rad (left front); others0.060978,0.141931 and0.006009 rad. Identical endpoint feet are insufficient. These are offline reach seeds, not a globally periodic trajectory, not runtime IK, and not accepted animation. No further variants were attempted.

`reach-study.py [wide|positive-knee|signed-knee]` reproduces these bounded variants. The four-variable vectors are hipX, mirrored hipZ, mirrored kneeZ, mirrored hipY. The wide failure has only the first three variables. Solvers use prior guesses only during offline analysis; no history or solver is proposed at runtime. `blend-preflight.py` additionally measures all actual weighted vertices through sampled rest-to-walk blend weights, with both existing idle-breath extremes. **This also fails:**1,150/5,376 sampled poses penetrate. Worst−20.408 mm at phase.125, blend.45, breath−.008, right-front knee geometry. Thus a zero-speed angle blend cannot simply be layered onto a pointwise planted endpoint. The fit must include intermediate speed/blend contact constraints. This preflight uses identity actor world and does not certify real terrain/root rotations, attack/death transitions or anatomical intersections.

## Next source-only implementation gate

A builder should fit one globally periodic, continuously differentiable set of authored hipX/Y/Z and kneeZ curves to the reachable target, with exact angle/value/derivative seam constraints and fixed lengths. Favor a low-knot periodic polynomial fit expressible with the existing numeric channel arithmetic/select/sine contract and ≤128 DAG nodes per output. Check the actual evaluator; do not introduce tables, opcodes, runtime IK, extra state or engine services merely to fit this study.

1. **Continuity:** evaluate every joint over two cycles at≥240 samples/cycle plus analytic seam checks. Position/angle endpoint error≤1e−6; derivative seam≤1e−4 rad per normalized cycle. Declare and test every piecewise boundary. Limit adjacent local quaternion change to0.10 rad at60Hz in steady stalk, with no wrap spikes. Foot target fit≤5 mm in stance,≤10 mm swing; no accepting feet while joint angles jump.
2. **Contact and support:** all native weighted vertices, actual bind hierarchy and actual world transforms. Dense phase/speed/breath sweeps must have minimum≥0 (numerical tolerance1e−6 m only). Stance foot minimum stays0–30 mm; swing clearance rises by≥100 mm. At least one diagonal pair is in the declared stance windows throughout; this is a kinematic support proxy, not a physics/support-polygon claim. Measure actual contact patches and anatomical intersections visually, especially reversed knee folds.
3. **World slip:** unchanged real stalk traces and coherent straight-motion source fixtures. For stable interior stance at speed1.15, total foot/root travel ratio≤0.20 and median foot speed≤0.20 m/s, both a substantial improvement over the current≈1.01/1.055. Report transition/turning and attack/knockback separately, never drop them silently. Require at least two full new authored cycles in each clean trial.
4. **Stop/resume:** zero-speed is candidate7 rest exactly at every phase. Test speed0,.05,.15,.3,.7,1.15 and smooth ramps in both directions, including the existing minimum phase frequency and freezing phase on rest. No phase resets/new clock. Contact tests include every blend weight, not just endpoint poses; quantify stopping slip separately. Blend to preserved attack/hit channels without a joint pop; do not create runtime previous-pose feedback.
5. **Combat/death invariance:** actual candidate7 attack, flinch and all dead-input rows must match original output to1e−12 where new gait is suppressed. Replay all1,306 recorded inputs, not reconstructed clocks. New gait entry into death requires fresh onset/weighted-floor checks across phases/speeds; exact old dead rows alone cannot prove the new last-living pose transitions cleanly. Preserve both strikes, precontact endpoint continuity, reward/defeat/Retry and persistent-store isolation.
6. **Bounded decision:** if the single periodic fit fails reach, blend contact, seams or DAG limits, retain this audit and report the exact limit. Do not lift roots, pad colliders, scale limbs, slow gameplay, or manufacture contact acceptance. A passing source study can proceed to a labelled diagnostic build only after review; existing public host remains intact until then. Fresh full phone-portrait motion review and actual contact traces are required before any visual-quality claim.

No phone, browser, gameplay or normal-speed video was newly tested in this audit. Prior static likeness and all candidate7 limitations remain unchanged.

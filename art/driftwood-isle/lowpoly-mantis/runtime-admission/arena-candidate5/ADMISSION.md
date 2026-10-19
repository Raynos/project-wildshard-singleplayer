# Mantis candidate5 active-onset study

UNACCEPTED WIP. Root build/review decision required. No build, browser, Site, production, static-art, collider or phone acceptance.

Only active contributions change: observed active supplies tell=0 and cut=1 at clock zero and epsilon. Windup, recovery, gait, flinch, valid death-stage poses, anatomy, geometry, measured dimensions, AI, strike clocks, damage and the 10 Hz observer remain unchanged. The active pose intentionally holds for distance-driven strikes. No offset or cadence increase.

## Measured tradeoff

Candidate4 first cut moves from trace79 (actual active .183333s) to78 (.083333s). Trace77 remains actual active .05s with observed windup. Second cut moves106 (.183333s) to105 (.1s); trace104 is still observed windup. One observer tick of latency remains.

First onset78 shoulder jump rises0→1.1rad; maximum world vertex travel .0214739→1.2242915m (cutting blade .0214663→1.2242915m). Next frame79 world travel falls1.1585571→.1521939m. Second onset105 shoulder jump .0333333→1.0666667rad; world/cutting-blade travel .1314360→1.1405823m. These are sampled inter-frame travel including unchanged root motion, not velocity or continuous trajectories. Both blades move via the changed body/neck posture, even though only the stage-selected sickle articulates. This explicitly exposes snapping, not a smoothness improvement.

469 sampled poses retain positive minimum clearance +.0006728281m; all corpse samples retain +.0136223861m. Changed first onset floor clearance drops .0475836701→.0351159213m. No continuous-time floor/collider guarantee follows.

## Replay boundaries and failures

The 62 frames69–130 reconstruct both complete attacks from recorded scalars with maximum local component error1.1102230246251565e-16. The full trace's post-hit scalars, fresh-bout idle-phase time base and interpolated corpse samples are not always the evaluator's inputs: naïve regeneration differs by up to .0990313475m at hit205 (body Y), and .0214988423 quaternion-component difference among changed active samples. Changed frames78/105 have no residual;399/427 differ in body Y and neck/head/abdomen/wing quaternion channels, consistent with an unmatched idle phase. The active-only Euler delta assertions are independent of idle/flinch: each changed frame explicitly verifies the analytical delta on all22 joints, unchanged translations and living deathT. These deltas preserve the captured idle contribution instead of replacing it with the mismatched recomputation. That failed assertion and the signed-zero test failure are preserved in initial-test-failure.txt. The final test does not hide these discrepancies: it reports them and requires exact agreement only for the verified attack windows. Across all469 frames it retains captured local transforms and world matrices, adding only the algebraic active Euler deltas to eligible living poses. This is a counterfactual pose study, not fresh gameplay. Frozen corpse poses are preserved exactly.

## Admission and preservation

The admission module pins the exact admission.json byte hash, which pins every required tuple member. Missing, added, modified and self-rehashed receipt edits fail; no shared-engine exemptions. Geometry and source AI/observer hashes remain candidate4's exact hashes. The complete candidate4 folder, original candidate4 build/config/source files and public evidence inventory are recorded in preserved-baseline.json and verified unchanged. The deployed host is not written or rebuilt. Old tested product8ffdee515e3426653e8ebc74f8ccefc229f35ceb00c869e743615e27b792b89c and source closure0b9a31b042ecceddbe55b10bab620ae05a478bf09f16a7f9b0ac37dc407372d0 remain historical evidence only; this candidate has no built product hash.

## Recommended next decision

Independent review before build GO. The narrow latency hypothesis is supported numerically, but snap persists and is moved earlier. If a fresh actual-engine capture is authorized, use only the isolated onset build/config and new empty output directories, with the standard heavy-lane lock. Keep candidate4 deployed and all acceptance flags false. Reject or preserve the study if independent review finds the abrupt first-active cut unsuitable; do not compensate with cadence, duration offsets, AI, geometry or engine changes.

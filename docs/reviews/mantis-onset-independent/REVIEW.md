# Mantis candidate5: independent source/evidence review

2026-10-19. **GO for one bounded isolated diagnostic capture only, subject to root's source checkpoint and build decision. HOLD promotion, public replacement and all visual/collider/runtime/phone acceptance.** Candidate4 remains the public WIP. No new static score.

The narrow experiment is justified: it removes a demonstrable extra sampled active hold without changing tactics. It does not make the cut smoother; it transfers the existing large angular jump to the first observed-active pose. Actual motion evidence must decide whether earlier presentation is worth the resulting snap. This review ran no build, browser or gameplay and edited no gameplay source.

## Frozen scope and independent checks

- Reviewed final normalized freeze `arena-candidate5/source-closure.json`, SHA256 `471c590760e63d74f10a4601568fb36938901e1e1ce84b91a60a9843d01fb890`: all 23 source/proof files and all 14 admitted inputs match.
- Independently checked candidate4 source closure (18 files), capture closure (16), admission (14), and candidate5 preserved-baseline inventory (39): zero mismatches. Candidate4 product remains `8ffdee515e3426653e8ebc74f8ccefc229f35ceb00c869e743615e27b792b89c`.
- Native payload, 22-joint geometry/binds, metadata/dimensions, original tactics, phase observer and combat declarations are identical to candidate4. Preview/config/build differences are candidate names, paths, pose selection and labels. No production routing or engine exemption is introduced.
- Exact admission bytes are pinned independently of the receipt's own hashes; tuple-file tampering and changed/missing/additional/self-authorizing receipt edits are rejected. This is local source integrity, not a claim that arbitrary host outputs are already admitted.
- Candidate4's independent motion review was read in full. Its 137-file captured host predates the PracticeCreature event-drain change; it cannot validate a newly built host. A fresh host inventory and capture closure are required.

Original producer closure `1bda96f1c5c73314e27dd15b6d3560150e2113120676792df185bc8743b9ae94` was verified before normalization. Independently compared the retained originals: only one trailing source space and blank EOF log lines were removed; gameplay and admission tuple bytes are unchanged.

Independent rerun: 16 focused Vitest tests passed, plus 3 admission/tamper tests. The first pnpm wrapper attempt failed before running tests because its home store was absent; that failure is preserved. Direct installed Vitest then passed without installing anything. These are focused checks, not a full repository gate.

## Actual initial-active semantics

The only functional clip edits replace `active * (1 - smooth(clock/.10))` tell with zero, and `active * smooth(clock/.10)` cut with one. These alter the first .10 seconds of *observed* active; clock zero and epsilon now produce the complete cut. Windup, recovery and distance-driven active holding retain their existing formulas. Root/body translation is unchanged. All other authored terms are unchanged.

At first observed active, the selected shoulder is +.65 radians instead of −.45, elbow −.65 instead of +.35, and hook is at the full stage-selected cut. Body/neck/wing and both shoulder-Z contributions also change; this is not exclusively a blade rotation. Authored corpse formulas remain unchanged; valid death stage5 suppresses attack contributions. This is not a claim of equivalence for impossible stale attack-stage inputs during partial death.

The existing 10 Hz observer still resets its clock on the next observed phase transition. In the historical trace, actual-active77/104 still display observed windup. The new cut starts78/105 rather than79/106; it does not become frame-exact with authoritative combat. No cadence, AI timing, hit timing or combat advantage claim is established.

## Replay validity and retained failures

Both complete attack windows69–130 (62 samples) reconstruct old local poses from recorded scalars to maximum component error `1.1102230246251565e-16`. That is a real exact-input boundary check.

Full-trace scalar reconstruction is not exact: maximum body-Y discrepancy is .0990313475m at hit205. Changed samples399/427 also have body translation and idle-driven quaternion differences, up to .0214988423 in a quaternion component. Those components are dimensionless; .0214988423 must not be described as meters. Initial/refinement failing assertions are preserved in the producer evidence. Merely lowering the failed tolerance would be false acceptance.

The revised method is defensible as a conditional counterfactual: retain captured local poses and world matrices, add only the analytically derived active Euler contributions. The deltas cancel unchanged idle/flinch terms. Tests assert every joint/axis, unchanged translations and negative deathT for all four changed samples. Independent NumPy code in `crosscheck.py` derives these terms separately and reproduces all four changed sampled world results to approximately 1e-13m. No Euler singularity occurs in these samples. This does not recover unrecorded runtime inputs or prove how a fresh engine run interpolates them.

All 469 sampled counterfactual poses keep global/living minimum +.0006728281m and dead minimum +.0136223861m. The changed onset78 minimum falls from +.0475836701m to +.0351159213m. Clearances remain positive but do not prove planted support, force contact, collider correctness or continuous-time clearance.

## The observed numerical tradeoff

- Frame78: maximum world vertex travel .0214739m → 1.2242915m; selected shoulder jump 0 → 1.1rad.
- Frame79: world travel 1.1585571m → .1521939m. The snap is moved earlier rather than removed.
- Frame105: travel .1314360m → 1.1405823m; shoulder jump .0333333rad → 1.0666667rad.
- Fresh-bout onsets399/427 counterfactual travel become 1.1985818m and 1.1651032m.

These are distances between recorded samples including unchanged root motion, not velocities or continuous swept trajectories. Positive floor values cannot decide motion quality.

## Required bounded capture and decision

1. Root must finish checkpoint/hooks, verify this frozen tuple, build into new empty isolated outputs under the normal lane lock, and retain exact product/source/host manifests. Candidate4 and its public media stay unchanged.
2. Capture actual engine combat at portrait dimensions with labeled diagnostic observation, continuous original video and synchronized render traces. Cover both full windup→active→recovery windows and initial-active neighboring poses. Log authoritative phase, observed phase/clock, local bones and world matrix. Record cadence and account for every encoded frame; never equate encoded repeats with simulation frames.
3. Review onset at normal speed and framewise. Decide whether the removed extra hold improves tactical readability or simply produces an earlier teleport-like cut. Check both sickles, body pitch, depth crossing, recovery continuity and whether hit/damage still reads honestly. Missing an onset in video means insufficient evidence, not a pass.
4. Include ordinary approach/turning, actual player/enemy damage, hit interruptions, death/settle, corpse hold and Retry to detect collateral runtime/host changes. Recompute world geometry on fresh captured poses. Preserve complete failures and original streams.
5. If the cut is less readable, retain candidate4 and archive candidate5 as a negative timing study. Do not compensate with unauthorized cadence increases, clock offsets, geometry or shared engine edits. A smoother anticipation-to-contact redesign would be a different scope needing a new review, not an inference from this experiment.

No broad redesign is necessary to answer this narrow hypothesis. No claim of visual improvement or promotion is supportable before actual capture and independent motion review.

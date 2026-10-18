# Preview-only gait continuity adapter proposal

Status: gait4 stop pop independently confirmed at encoded frames 562–564. Gait5 source candidate implemented; 15 focused tests and typed lint pass. Cross-frame weighted audit and actual recording remain required. Normal motion3 remains the tested live fallback. Actual gait4 telemetry measures front-fin local-position steps of 75.1mm and 56.5mm at speed 0.151→0 on attack entry.

## Scope

Add a separate preview-only pose wrapper selected exclusively by the isolated gait candidate's Vite configuration. Reuse the actual numericCreaturePose for all authored pose evaluation; do not change its schema, admit forbidden locals, alter the engine file, or write AI/combat/persistent state.

The exact `src/practiceContent.ts` importer and `./game/plugin/channelPrograms` specifier redirect to `src/pufferGaitContinuityPreview.ts` only in explicit gait5 builds. The wrapper defines its own function and imports the original evaluator directly; it does not re-export the module or create a barrel. Its own import resolves normally because its importer differs. Other modes and importers resolve unchanged. A receipt hash pins the visual adapter, and existing candidate guards pin the rig1 native input and calibrated leg length.

## State and behavior

Use a WeakMap keyed by each actor's existing bones object. Store only copied previous foot local transforms, previous observed speed/stage, transient blend source transforms and elapsed existing pose time. No actor memory, player state, simulation clock or phase is written. Different actors cannot share smoothing history; discarded rigs are collectible.

1. Evaluate the existing numeric gait target normally.
2. On an observed moving→stopped or gait→attack transition, start a bounded0.22s foot-to-authored-target blend from the previous actually displayed transforms. This avoids guessing prior phase or speed.
3. On resumed movement, blend from the settled displayed pose into the actual newly evaluated gait over0.12s. It remains approximate stance during this blend, not planted contact.
4. Use the existing pose dt; it is not claimed to be an independent real-wall presentation clock. No simulation-speed adjustment. Bound/reset history on first frame, actor replacement, death, invalid dt or large discontinuities.
5. Preserve motion3 body/tail/face and actual attack timings. Do not increase swell or move the actor root/collider. Do not smooth combat/physics responses.

Local interpolation alone is not automatically floor-safe: changing body bob, pitch and belly inflation can alter the weighted toes' world height. Before capture, sweep the actual rig1 weighted vertices across these transition blends and real body poses. If compensation is needed, keep it visual and explicitly measured; do not clamp or teleport actor state. Preserve the failed unblended gait4 source/receipt.

## Required checks

- Two independent rigs, deterministic resets and no cross-actor state leakage.
- Stopped settled pose reaches bind, resumed target converges, and actual displayed foot deltas are bounded across the measured speed0.151→0 transition.
- Existing AI memory, position, speed, phase, health and attack clock remain byte/value unchanged by wrapper invocation.
- Candidate build installs wrapper; normal motion3 does not. Actual old pose and public practice paths stay untouched.
- Re-run weighted geometry floor/cap/triangle checks over attack/death overlap before any capture.
- Record complete real-input walk→stop→attack and stop→resume cycles, including read-only foot-world/camera telemetry. Use full-foot view; front-facing AI footage cannot prove side/tail attachment. Review every frame in selected complete cycles.

This scope does not solve terrain adaptation, turn-in-place foot locking, exact displacement planting, or a true side camera. Those remain separate evidence gaps.

## Current trial geometry guard

The wrapper stores copied displayed foot transforms and body Y/Euler context. During the smoothstep interpolation it adds a body-Y rebase and a conservative rotation-radius lift, weighted by the outgoing blend contribution. The exact implementation is in `src/pufferGaitContinuityPreview.ts`; the 2m radius is a provisional bound, not visual approval. The builder is auditing actual weighted cross-frame vertices, including renewed transitions, attack inflation and death resets. Death, invalid/large pose dt, first frame and time rewind discard presentation history and return to the admitted numeric pose. Larger conservative lifts can look artificial even if numerically floor-safe, so the recording must check that too.

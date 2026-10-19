# Conch motion4 hit handoff audit

2026-10-19. Read-only source audit; no candidate built or accepted. Published motion4 is retained. Source conchReadableClips.ts SHA2565258300c0de5b0e2504aca3dcca5b05179c00abb88615a2e28eb42309acc8f00 matches the frozen product source.

The alignment plateau suppresses rapier flinch and cancellation restores it immediately. At counter clock .485, stage2 cancellation with full flinch changes forearm Y from −.40 to +.12 radians (.52), shoulder Y from −.80 to −.36 (.44). These are authored joint discontinuities, separate from physical root displacement. Existing revised-source/audit.json and test/conch-readable-contact.test.ts retain the counterexamples.

A bounded future study could remove only the outward Y hit coefficients (+.12 forearm, +.04 shoulder), retaining X recoil, all other recoil and attack alignment. Predicted full-flinch maximum falls .52→.40 radians; half-flinch .46→.40. Zero-flinch remains .48 because shoulder X dominates. This does not establish continuous cancellation or improved visual quality. Do not promote a coefficient change without real captures and independent review.

Stage2 clock resets every stunned tick; stage4 clock also remains zero while stunned. A clock-driven recovery envelope there would stall. Actual frame.flinch decays exponentially and is an available presentation input; do not invent private elapsed-hit history.

The observed38.4cm/100ms slide matches intentional AnimalSim stagger push: .6m minimum times ease-out [1−(1−.1/.25)^2]=.384m. Do not suppress physics, offset the rendered actor or call this a pose-clock bug.

Required future gates: dense ordinary/counter interruption cases with equal-flinch and actual prehit→flinch1; guarded early/late windup→counter; active/recovery→stage2; repeated hits and full next cycles; all720 runner/first-hit and483 plateau cases; lower-body/death bytecode parity; weighted world contact; strict128-node/input admission; fresh full-cycle actual video with pose-owned inputs and root/joint evidence. Unguarded ordinary windup is unreachable and must not become a false test gate.

No change to geometry, AI, strike clocks, guard multiplier, damage, rewards, physical push or public host is authorized by this diagnostic alone. Existing project scope permits a separately tested animation candidate; this small study is deferred while the consequential Mantis continuous-sweep work proceeds.

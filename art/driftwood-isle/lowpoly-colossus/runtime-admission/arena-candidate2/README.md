# Colossus native22 motion2: bounded death flexion

Source candidate only; actual new host capture pending. No art acceptance or final gameplay claim.

Motion1's worst corpse frame has upright rigid root Y 899.771973 against floor 900: a 228mm downward settled displacement, while its unchanged legs keep local sole minimum27mm. Only the leg meshes penetrate (478 vertices at the worst build2 frame). The host trajectory includes a launch and landing; it is not a body-axis mismatch.

Motion2 adds six death-only sagittal channels: bilateral hip −0.4rad, knee +0.65rad, ankle −0.25rad, multiplied by clamped deathT. This modest articulated fold shortens the lower chains and keeps the net sole pitch unchanged. No root lift, collider, geometry, bind, scale, AI, combat, timing or engine edits. Living pose is unchanged (new channels are zero). Original payload and all 22 bones / 4,384 multiweight vertices of 15,600 are retained.

Validation: six tests across three focused files pass, plus two strict-admission tests. The dense local sweep has 1,001 death poses plus 305 living poses. Full four-influence captured-world replay passes both preserved baselines:
- Original build1: 155 dead frames, minimum −.201035m→+.012358m.
- Lifecycle-fixed build2: 142 dead frames, minimum −.201039m→+.026025m.
- No replay frame penetrates. Independent matrix-summed skin weights agree with Three.js within 26.9 µm; local oracle agreement is exact.

Replay applies the six actual compiled numeric channels to captured lower-chain rotations while retaining every other recorded bone value and mesh-world matrix. It demonstrates trajectory compatibility, not a new live execution. Fresh build, live combat/death/Retry/persistence proof and independent review remain necessary. All acceptance flags remain false. Original failure evidence stays in arena-candidate1/evidence and docs/reviews/colossus-native-lifecycle-build2.

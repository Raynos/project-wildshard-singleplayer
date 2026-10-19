# Bellback candidate4: gameplay coverage passes, strict contact and motion quality remain WIP

Independent review, 2026-10-19. No new likeness score. No product, engine, STATE, Git or production changes by this reviewer.

## Verdict

The optional bone-following hull experiment is a substantial improvement over the previously observed 85.6 cm rolled-core penetration. That failure does not recur in these two falls. It is **not a strict contact pass**: 13 rendered observations cross the existing −5 mm diagnostic threshold. Both actual deaths now reach stable frozen rest near the floor. Gameplay runner checks all pass (27/27), including the formerly missing unhit approach/stop/resume. Functional coverage is not arena-ready animation acceptance.

Product `72899786be0fa353ed1d6197d1ea7586db46f12983f4607936a0ac34a0866bef`.
Capture manifest: `art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/full-combat2/manifest.json`, SHA256 `e2db5999f55ff36c47907d35c875bcf95abcb63b1dd65b8e8cf8bf402e63f9fa`.
Independent read-only verification matched all 19 source-freeze files and all 137 built-host files against their SHA256 and byte pins. Original geometry SHA256 `32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44`.

## Visual coverage and time interpretation

All **3886 encoded frames, zero-based 0–3885**, decoded chronologically and inspected through 61 full-frame contact sheets. Seventeen exact consecutive pixel duplicates map to the inspected preceding frame; no time selection skips. The ordinary `encoded-frame-map.json` records every frame's sheet/tile. Native-resolution closeups additionally inspected 16 frames spanning attacks, interruption and both deaths; `detail-board.jpg` is a labelled, reduced-quality evidence board. Thumbnail review is suited to gross continuity; it does not establish subpixel contact. Original movie is preserved by the capture manifest and must remain outside Git.

Explicit broad encoded review ranges: 0–259 boot/entry/initial approach; 260–609 full uninterrupted pulse/echo/stomp and post-cycle idle; 610–1184 unhit approach/stop/resume; 1185–1332 single interruption and renewed tell; 1333–1901 repeated sword hits; 1902–2140 first collapse/settle/freeze; 2141–2755 Retry and second bout; 2756–2966 second collapse/settle/freeze; 2967–3759 player-defeat sequence and blocked attack; 3760–3885 final Retry/reload. Boundaries are visual regions, not exact state-transition timestamps; the exact live frame ranges below are authoritative. Inspection covers every boundary and surrounding encoded frame.

Movie: 402×874, 25 encoded fps, 155.44 s, CSS-resolution deviceScaleFactor1. **1223 actual render observations span 146.6151 wall seconds: 8.33475 observed renders/s**, interval median103.15 ms, p95251.025 ms, max680 ms. Game time advances only106.7265 s across this interval. Encoded repeats do not create extra animation samples, and game clocks must not be inferred from movie time. This is cloud Chromium/SwiftShader, with reported overlapping root hooks07:25:14–07:26:16. No physical iPhone, Safari, thermal, frame-floor or smoothness claim.

The camera is an enemy-following diagnostic observer, restored after rendering; viewmodel hidden. Player repositioning and aim are diagnostic and logged. It is actual AI/combat, not ordinary first-person play or a camera-independent gait test.

## Complete live cycles and interactions

- Pulse: windup live48–59, active60–61, recovery62–63, phase idle64; echo immediately follows.
- Echo: windup65–72, active73, recovery74–80, phase idle81; AI idle82–95.
- Stomp: windup96–103, active104–105, recovery106–113, phase idle114; AI idle115–128. Enemy remains180 HP throughout these complete cycles. Player100→70 by the defense report.
- These clocks are captured: pulse starts0, active1.1, recovery1.3; echo windup0.1, active0.9, recovery1.0; stomp starts0, active0.8, recovery1.0. There are coarse render gaps; the active windows are not inferred from a single key pose.
- Unhit approach: live144–216 moving,217–264 stopped for pulse/echo/cooldown,265–270 moving again. No enemy or clock injection. Legs genuinely change local transforms (front lift range≈17.25 cm, rear≈8.05 cm); this is not a totally unanimated slide. Nevertheless the small step/rotation and rigid carrier give limited weight transfer.
- Single normal sword input interrupts the pulse tell at278, HP180→168; stagger278–294, idle295–306, renewed pulse tell307 onward. The following repeated hits truncate that renewed attack, so it is not a separate complete post-interruption attack cycle.
- First enemy death begins504, frozen547–602 (56 observations); next Retry is603. Second death789, frozen823–878 (56 observations); Retry879. Both earn actual practice-local defeat behavior; first receipt12 coins. No post-death strike in the checked first corpse interval.
- Actual enemy attacks defeat the player; input after defeat leaves enemy HP unchanged. Retry and reload checks restore180 enemy/100 player/zero rewards. Local/session storage and state-store remain empty and unchanged. No persistent rewards or campaign-state mutation demonstrated.

## Independent contact reconstruction

`recompute.py` validates original skin weights, unit quaternions, bone hierarchy, inverse bind translations and captured mesh world matrices. It calculates weighted skinning for all **13374 original vertices** for every render observation, rather than checking only feet or a bounding box. Weights are independently verified rigid/unit, but the calculation still applies their weighted transform. Floor Y900, crossing threshold−0.005 m.

- First death: four penetrating render observations; worst live517/game48.0051s, **core/body −0.015733556 m**, four original body vertices below−5 mm at that pose. Head, bell, clapper and feet are above the threshold there. This is a residual carrier/core contact issue, not an appendage-only exception.
- Second death: nine penetrating render observations; worst live799/game72.2917s, **left fore stone foot vertex864 −0.022028277 m**, world[-9.804365654,899.977971723,-3.051430825]. Rear-left leg also reaches−0.015497554 m during this fall. Core minimum in that whole second scenario is−0.000069137 m.
- First frozen minimum−0.000136377 m; second−0.000088414 m. Both world matrices and all bone poses are identical throughout each56-observation frozen range: settle/freeze really is observed, not assumed from a reward toast.
- No living render observation crosses−5 mm.

`fixed-shapes.py` independently transforms original bind-local vertices by the **actual recorded collider world poses**, and verifies their support against the admitted recipe hull points: maximum original/hull support difference0. All eight shapes are present and non-sensor. Among **218 recorded fixedPost observations**, first fall has14 threshold crossings, minimum **−0.024265489 m core**; second has28, minimum **−0.022040947 m forefoot**. These are advanced collider poses, stronger evidence than same-pose static containment alone.

The438 total fixed records include220 fixedPre records. Those world getters can retain prior cached world poses after local-transform updates; do not label them the newly set pre-solver target. Likewise the bone/root reconstruction in weighted-contact.json's `fixed` section is a mixed captured-pose diagnostic, **not** synchronous physics geometry. Use fixed-contact.json fixedPost for the actual advanced shapes. Render geometry is interpolated and should not be directly compared to latest physics geometry as if timestamps were identical.

Initial fixed steps before the first rendered ragdoll are unobserved; terminal transition can be omitted because the wrapper records only while live. Actual manifolds, impulses and per-body linear/angular velocities were not captured. No claim of all fixed contacts, slope/step support, player walk clearance, or causal solver diagnosis. Both falls occurred on one flat floor and do not reproduce every possible prior orientation.

## Five-point animation/readability scores

These are this capture's applicable qualitative scores, not the existing static likeness rubric and not an averaged acceptance grade:

- Idle presence **2.5/5**: bell/clapper and head movement present, but rigid carrier dominates and changes read small at portrait scale.
- Locomotion/weight **2.5/5**: real leg lift and approach/stop/resume, limited mass shift and stride authority; tracking camera reduces visible travel cues.
- Pulse/echo telegraph differentiation **2/5**: internal phases and damage work, but adjacent cycles keep nearly the same silhouette. Bell/clapper is a subtle tell for a large damaging creature.
- Stomp impact/readability **1.5/5**: damage exists, but silhouette and ground contact look too similar to idle; no persuasive whole-body stomp accent in the inspected cycle.
- Hit reaction/recovery **2.5/5**: immediate white flash and stagger are readable, but flash carries much of the feedback and body reaction stays restrained.
- Death/corpse performance **3/5**: visible fold/tip, directional variation and settled distinct low pose; feet splay and the first fall rocks back toward a crouch. More convincing than the prior buried core, still not polished weight transfer.
- Grounding/contact **3/5**: settled rest is near exact and gross roll failure is absent, but measured transient core/foot crossings fail the strict5mm diagnostic bar. Dark, weakly marked floor visually obscures small clearance errors.

## Recommended next step

Keep this as isolated unaccepted WIP. Preserve candidate4 and both falls as evidence. Investigate residual transient core/foot penetration using a bounded fully instrumented fixed-step capture before claiming contact acceptance; do not silently hide it with changed anatomy or root offsets. Once contact is resolved, strengthen distinct whole-body attack accents and locomotion weight while preserving approved appearance. No additional art-score chasing is indicated by this review.

# Mantis attack continuity: bounded next source study

2026-10-19. Recommendation: implement one **precontact windup sweep** using the existing pose-owned `frame.attack`, behind a new UNACCEPTED WIP candidate. Preserve candidate6 death folding and geometry. Do not call this a continuous active/recovery solution: held active poses and 10 Hz recovery steps remain. No product, behavior, engine, browser, build, publication or Mac changes were made by this audit.

## Measured baseline

The exact native evaluator passes four diagnostic assertions; the test-only proposed envelope passes four further assertions. `native-baseline.json` records both sides: shoulder x changes −0.45→+0.65 rad (63.025°), elbow +0.35→−0.65 (57.296°), hook y 0→±0.32 (18.335°), body x −0.04→+.06 and neck x −.10→+.12. Raptor z also loses its ±.08 tell rotation, explaining the larger quaternion angle. At identical frame/root and no flinch, the maximum displacement of a left-raptor native vertex is **1.2360363233376488 m**. This is geometric source discontinuity, not measured continuous physical travel.

Complete retained traces were scanned: main3361 + supplement807 + moving303 =4471 poses. This is numerical inspection, not a fresh visual review of the13775 encoded frames; the existing full-frame review remains authoritative for visual limitations.

- Main frames74→75: observed windup clock.6→active clock0 while actual strike is already active on both frames. Shoulder quaternion jump1.102606549rad, elbow1rad, hook.32rad; root moves.139999993m. Actual active elapsed at the latter sample is.15s.
- Main frames94→95: observed recovery clock0→.1; shoulder/elbow jump.601851852rad (34.484°), hook.296296296rad. The actual runner is already idle on the latter frame. This is the.12s first recovery sampled on a.1s observer clock.
- Supplement frames293→294: blade rotations remain identical within quaternion precision as root moves.700000013m; actual active elapsed1.216666667s. Thus the declared active.5s is not the actual motion-strike endpoint.
- Same-stage active adjacent samples with held blade rotations and >1mm translation: main358, supplement182, moving23. These counts are scoped adjacent observations, not duration or coverage percentages.
- Actual-active/observed-windup mismatch appears in19/11/7 trace rows respectively, up to sampled actual elapsed.05s. First observed-active samples can occur later (.10/.15s examples); these are sparse captures, not proof of a universal latency bound.
- **Zero retained rows record pose-owned `attack`.** The proposed clock is available in source but cannot be reconstructed exactly from these captures. Do not substitute strike.elapsed, gameTime, observerClock or guessed interpolation for missing evaluator inputs.

Full rows and input SHA256 hashes are in `trace-audit.json`. Main's original complete trace remains at its existing repository-relative temporary evidence location; it was not duplicated or deleted. Original failed candidate5 and candidate6 evidence are untouched.

## Actual clocks and control flow

`generators/mantisEarlyKneeClips.ts:20–45` reads observed phaseClock/strikePhase/stage, derives tell only during observed windup, and makes cut exactly1 throughout observed active. Its30 admitted programs have maximum100 nodes, below128. The clock does not advance inside the pose DAG. `game/plugin/channelPrograms.ts:75–80` rejects private program locals; there is no hidden interpolation.

`generators/driftwoodRegularCombat.ts:19–20` declares first windup.75s/recovery.12s and second windup.45s/recovery1.1s. Both have nominal active.5s, motion speed7, lane length3.5/width.70, range.9, damage10 and cooldown0. Species HP55 and reward3 remain unchanged. Decision tick10Hz is declared at line43.

`behaviour/splinterMantisPhase.as:31–40` samples runner phase before tactics, resets poseClock to0 when phase differs, and otherwise accumulates decision dt. Stage changes and onStrikeDone reset the tactical clock, not immediately the observer phase. Consequently new first windup may have observed idle; new second windup can retain observed first recovery. Prioritizing observed phase over live attack would mispose both starts.

`engine/ai/strikes.ts:103–147`: start calls `actor.startAttack(spec.windup)`; the authoritative windup→active boundary calls `cancelAttack`. Contact is attempted during active, once until hit. Motion strikes end at lane completion or timeout length/speed+1.2, not nominal active.5; recovery uses skid. No proposed animation edit may touch these semantics.

`engine/entities/AnimalSim.ts:178–180,284` exposes attackPhase0..1 from attackT/attackDur,−1 after cancellation. `AnimalView.ts:158–160,417` supplies this through the already-existing `frame.attack` pose field. It follows the simulation clock and may still be discretely sampled; it is not a promise of arbitrarily dense rendered motion.

## Concrete authored curve and boundary rules

The executable **design only**, `proposed-envelope.ts`, defines normalized attack progress a:

1. Raise: smoothstep(a/.30). Hold the full tell from a=.30 through.45.
2. Sweep: s=smoothstep((a−.45)/.50). tell=raise×(1−s), cut=s.
3. Reach the original active endpoint at a=.95; retain it through cancellation. Body attack lift should remain raise, equivalently tell+cut for this curve, so the upper body does not drop while the arm crosses.
4. First strike: raise0–.225s, full tell.225–.3375, sweep.3375–.7125, endpoint.7125–.75. Second: raise0–.135s, full tell.135–.2025, sweep.2025–.4275, endpoint.4275–.45.

Apply the existing shoulder/elbow/hook/body/neck/wing coefficients to these envelopes. No new amplitude, geometry, body offset or death envelope is needed. Active and recovery values retain candidate6 coefficients/endpoints. This deliberate precontact motion spends the final half of the existing windup; it does not add a delayed sweep after active observation, and it does not repeat candidate5's immediate-cut experiment.

Priority is important:

- Stage outside1/3: zero attack envelope, including stunned stage2 and death stage5.
- Stage1/3 with frame.attack>=0: **live windup wins over every observed phase**, including old idle/recovery. a=0 produces rest, never an early cut. New second strike therefore cannot reuse the first strike's old recovery clock.
- Stage1/3 with frame.attack<0 and observed phase1 or2: full cut. This bridges authoritative cancellation while observer still says windup; there must be no one-frame rest or fresh ramp at the eventual observer phase reset.
- With observed recovery and attack<0, use the unchanged recovery curve. Idle gives zero. These are intentionally still observer-clock steps.
- onHit is empty in the Mantis decision. Stun changes stage2; death changes stage5. The proposal must preserve exact existing death pose even if a synthetic context contains stale attack>=0; never let live sweep leak into the corpse. Do not add previous-joint feedback, smoothing state, a new engine API or a different decision cadence.

## Acceptance gates for the subsequent source candidate

1. On the actual numericCreaturePose DAG, test both strikes at attack0/.30/.45/.95/1 and cancellation−1 with every observed phase0–3. Exact endpoint continuity at the observed windup→active reset; fresh stage3/attack0 with stale phase3 must be rest. Test missing-memory defaults, Retry, stun and death.
2. Keep all graphs<=128 nodes. No private state or external writes. Byte/hash-preserve geometry/materials, AI source/module, strike declarations, move, HP/damage/reward declarations, colliders and root physics. Freeze exact product after checks; no candidate6 acceptance is inherited.
3. Across all stages/phase clocks/flinch/speed, compare every candidate6 death transform and every non-attack living channel. Death fold, knee clock, endpoints, gait and root must be exact. Any broadened difference needs explicit diagnosis. Re-run retained early-death contact/evaluator tests against exact full-world poses; no invented-input claim.
4. Sample continuous authored windup at60/30Hz and variable frame offsets plus low-cadence gaps. The design's30Hz shoulder adjacent step is<.25rad in100 phase offsets per strike, compared with baseline1.1rad. This is a proposed engineering limit, not a visual rating. On the real DAG measure full quaternion and native vertex paths, floor contact and arm/body intersection at all keyframes and between them.
5. Preserve exact StrikeRunner command/state/contact/damage clocks in deterministic combat tests. Cover close-range earliest possible damage, normal approach, obstruction and distance-driven long active. A visually early blade crossing is a possible readability tradeoff, so reject if the new sweep misleadingly passes through the player's contact region materially before damage. Do not move damage to fit the animation.
6. Any subsequent capture must record `poseInputs.attack` inside the actual animator wrapper before/with the exact pose; keep boutTime and complete world matrix. Include both windups and real damage, first→second transition, stun/death during sweep, Retry and moving early death. Review complete video at normal speed with source/capture cadence disclosed. Existing missing samples/failures remain preserved.

Strongest next action: implement and test this bounded precontact curve. Keep animation2/5, readability2/5 and quality acceptance false until new evidence justifies a scoped change. Held active upper body, first recovery step and corpse overlap remain open; this study does not solve them.

## Reproduction and retained failures

Run from repository root:

- python3 docs/reviews/mantis-attack-continuity/audit.py
- node node_modules/vitest/vitest.mjs run --config docs/reviews/mantis-attack-continuity/vitest.config.ts

The final focused run passes8 tests in2 files. Earlier pnpm invocation failed while its automatic dependency-status step attempted to create a package-store directory; no dependency install was needed. Its failure is retained in `focused-tests.txt`. Direct installed Vitest succeeded; its intermediate and final logs are retained. Public-path screening replaces environment-specific filesystem prefixes in logs with neutral markers only. No validation failure is hidden. This audit does not run an application build or browser.

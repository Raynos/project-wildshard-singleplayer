# Motion4 revision2, exact build2: independent recorded review

## Decision

**Reachability correction, 09:27 UTC:** The initial unguarded-ordinary-windup requirement below is withdrawn. Independent inspection of `conchDuelist.as` confirms guard1 begins with ordinary strike and remains until regular-clock >= .6; `onHit` before .6 enters stage4. `borrowedGuard.ts` applies the .25 multiplier by actor identity and numeric field, with no facing test. An ordinary early-windup unguarded cancellation is therefore not a normal reachable transition, and must not become an impossible promotion gate. The supplemental criterion is true legal early (runner elapsed <= .20) and late (>= .45, < .60) windup hits, with actual guard/clock/damage recorded, followed through counter/recovery. Late guarded examples already exist; genuinely early is the useful missing boundary. Public remains unchanged pending the authorized narrow supplement. The original recommendation is retained below as a corrected review witness.

**HOLD public replacement pending a narrow interruption supplement.** Build2 improves tell presentation enough to be a plausible labeled WIP successor, but the attempted early/late windup cancellation trials did not actually hit those phases. Keep published motion3 unchanged until those transitions are recorded and reviewed. This is not a rejection of the visible improvement, and does not require repeating completed cycles. No art rescore: static Conch remains 3.57/5. Arbitrary interruption continuity, collider tuning, physical-phone performance and human fun remain unaccepted.

Minimum additional evidence: on these unchanged game bytes, deliver an unguarded damaging hit during early ordinary windup and another during late ordinary windup, prove the runner phase/elapsed at enemy-damage-before-presentation, and record each cancellation through rest and a subsequent complete attack. Guarded chip hits are already covered and cannot substitute for this.

## Identity and method

Selected sourceHash `e41d1e7600a94074384a00fca22b58f634c060f5eb0458c5d34ec2bf44db6cb8`, revision2 freeze `fb27b7ed8f16d3fe7455195c9b7d3f35067570be2cf0d3fb9c481a4cee820f0a`. See capture executed-provenance.json for the distinction between the embedded attempt2 pin and later capture-tool pin. No build3 was reviewed. Prior source rejection and revised-source audit remain separate immutable witnesses.

Run2 video SHA256 `376f44194a5181d04af6fd0d4bad8305295af69b3a1d934c4dbee8d7217b6327`. Independently verified all 12 run2 receipt entries. Inspected every encoded frame E0–3335, including duplicates, using 70 sequential contact sheets. No temporal resampling: 25 encoded frames/second, 133.44 seconds. Also inspected every supplemental stop/resume encoded frame E0–326 in seven sheets. All large sheets/full-HUD outlier strip remain beside temporary capture evidence, not in Git.

Encoded cadence is not rendered cadence. Run2 trace has 1,158 consecutive renders R4–1161 over 119.3546 wall seconds and 98.4344 game seconds. Median render interval 93.5 ms, maximum 433.3 ms. Supplement has 86 consecutive renders R4–89, median 93.6 ms, maximum 361.5 ms. Cloud contention and instrumented capture limit timing-quality claims. Used authoritative runner state, game clocks, pose clocks and actual bone/mesh world transforms, not label names or inferred 25 Hz pose updates.

Independent NumPy reconstruction verified all 7,338 runtime vertices against native payload position/index/four-weight arrays, including 94 blended vertices, then replayed every recorded weighted pose. Scripts and ordinary JSON results are beside this report. Damage analysis separately reconstructs tip vertex 5761 from callback and next-render matrices.

## Scoped five-point presentation scores

These compare living presentation against the motion3 independent review, not static art or user testing.

| Scope | Motion3 | Motion4 build2 | Finding |
|---|---:|---:|---|
| Character readability | 3.5 | 3.5 | Shell, shield and weapon silhouette remain recognizable; large shell still dominates the body action. |
| Guard/windup/thrust/counter tells | 2.5 | 3.0 | Raised shield and wider weapon preparation distinguish counter and ordinary attack better. Extension is readable but held mechanically. |
| Hit reaction and recovery | 2.5 | 2.5 | Flash and root displacement still dominate body recoil; interruption snaps and extended recovery hold remain. No general continuity pass. |
| Death and settled corpse | 3.0 | 3.0 | Visible fold/roll and stable corpse remain WIP. Rigid pose, weapon onset pop and delayed death onset are retained limits. |
| Grounding/contact presentation | 3.0 | 3.0 | No visible floor break in reviewed frames; feet/root slide under knockback. Near-floor geometry is not planted stance. |

No aggregate score is used to conceal unchanged weak areas.

## Complete-cycle observations

Ordinary first cycle R120–137, followed through stage2 and rest R156: E437 shield rise, E447 weapon preparation, E453–468 extension, E473–479 withdrawal. Counter sequence R279–324 includes guarded chip, stage4, full counter windup R292–297, active R298, recovery R299–307 and return. E911–918 guard flash, E937–945 wider preparation, E951 damaged-frame extension, E967–990 withdrawal. This reads more distinctly than motion3, though the shell remains largely rigid.

Second full counter R373–399 corroborates it. The source's long aligned plateau makes early recovery look like a held thrust rather than prompt release. Ordinary player-defeat cycles R818–837, R856–877, R896–917, R936–954, R973–993, R1010–1031 and R1049–1069 repeat consistently. Final lethal player strike R1092–1093 leaves a held living pose during defeat; Retry restores neutral presentation. It is not a corpse animation.

Repeated incoming hits visibly flash and displace the root, with limited upper-body recoil. Recovery cancellation is genuinely present at R454/R495 and counter recovery R603. Lethal enemy hit R658 is followed by delayed death pose: E1948 flash, E1951 weapon stance change, E1953 onward fold/roll, E1974 settled. Corpse remains stable through E2280; Retry E2281 restores living pose. These are not claims of physically simulated collapse.

## Actual hit phases, not harness labels

`damage-verification.json` preserves the exact snapshots. enemy-damage-before-presentation events:

- Guard-counter attempts R187/R237: active, 12 damage, failed guard trials. Keep failures.
- R285: windup elapsed .566667, 3 chip damage, successful guard/counter.
- Label interruption-idle, R377: windup .35, 3 chip damage, successful guard/counter.
- Label interruption-early-windup, R414: active elapsed 0, 3 damage. Cancellation appears R415; it does not prove early windup cancellation.
- Label interruption-late-windup, R454: recover .30, 12 damage.
- Label interruption-active, R495: recover .433333, 12 damage.
- Label interruption-recovery, R550: idle, 12 damage.
- Sword-death R589: windup .50, 3 chip damage; counter recovery R603: recover .083333, 12 damage.

Thus there are actual guarded windup hits, active/recovery/idle hits and counter cancellation. Missing unguarded early/late windup transitions prevent claiming the requested targeted interruption coverage complete.

## Damage geometry and displayed frame distinction

Twenty actual hurt requests were reconstructed independently. Nineteen callback tip poses are approximately 9.44 mm off the locked lane center. One callback uses stale prior render R387/pose384 at clock .3 while the runner has entered active and behavior clock is .4: tip lateral +.926042 m, along 1.987116 m, target along 2.1162 m. This is a real callback-matrix mismatch; preserve it. Source tests limited to one-step skew did not establish arbitrary host/render timing alignment.

However, all twenty following rendered damaged poses have absolute lateral offset at most .009436543 m against the corresponding actual damage lane. Full-HUD strip E1217–1221 proves the outlier distinction: E1217–1218 show R387/HP100/windup .383/pose384; E1219 first HP84 frame shows R388/active .017/pose385/clock .4 and aligned weapon. Therefore the .926 m callback observation is not evidence of a displayed off-lane damage frame. Alignment is still not exact visible point contact with a player mesh or proof the full blade swept the target: combat uses the existing analytic lane and radius.

## Contact and isolated functionality

All 1,158 run2 weighted poses: minimum 2.98045 mm, largest per-frame minimum 4.97770 mm; zero vertices below floor and no frame lacking a vertex within 2 cm. Living 1,006 samples and settled 142 samples retain expected proximity; settled minima are exactly 3 mm. Same near-floor vertex horizontal movement reaches .384 m in 100 ms during knockback. This refutes no-slide/planted-foot acceptance and matches the old caveat.

Supplement all 86 weighted poses: minima 3–4.97770 mm, zero below floor, none without near-floor geometry. Actual near-target stop reaches speed0 (R5–32); far-target resume includes speed .85 (R33–80); final stop R81–89 remains0. Whole encoded supplement shows stable contact without new visible transition failure. Original run2 stop-at14m failure is a bad diagnostic assumption, remains preserved, and is not relabeled as a pass.

Capture reports and trace corroborate guard/counter, active damage, cancellation, three local coins on death, player defeat, blocked attacks during defeat, Retry reset and empty isolated persistence. Run2 has zero page errors and 25/26 checks, its only failed check the invalid stop/resume trial; supplement passes4/4. Reload/reentry is supported by captured report/state evidence, not post-reload matrix trace: the run2 recording ends while reentry loads. No production persistence or physical handset was exercised.

## Remaining acceptance limits

Stateless admitted channels cannot guarantee arbitrary interruption continuity. Source revision2 retains up to .52 rad counter-to-rest forearm jump under full recoil; same-flinch guard-to-counter entry is improved, not all interruption edges. Death intentionally reuses old motion and can expose a living/death stance discontinuity. Strict admission and old gameplay semantics are preserved; presentation improvement does not authorize changing strike windows, damage, rewards or AI. Fill the two narrow missing cancellation cases, then append an evidence-based WIP decision without rewriting this record.

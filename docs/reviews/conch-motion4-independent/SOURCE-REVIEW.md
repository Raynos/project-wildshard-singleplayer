# Conch motion4 independent source review

## Verdict

**Unaccepted source study; do not promote yet.** The frozen candidate provides a credible larger ordinary/counter pose distinction and retains the original gameplay catalogue. It does not establish visual improvement, interrupted-transition continuity, rendered contact, or damage-frame weapon alignment. Keep the existing published motion3 host unchanged. The final pre-build decision below is NO-BUILD pending a narrow timing revision; the freeze itself explicitly grants no build acceptance.

No static likeness rescore: Conch remains 3.57/5. No five-point motion score can honestly be assigned before reviewing actual encoded frames. No physical-phone performance or human-fun claim.

## Scope and freeze

Read AGENTS.md, docs/process/GIT.md, docs/process/STORAGE.md, docs/plans/driftwood-enemies/STATE.md at 08:39 UTC and the motion3 independent review. Inspected candidate generators, tests, admission checker, canonical-frame transform, strict numeric consumer/schema, original AI and actual strike implementation.

Independently verified all 31 files of freeze SHA256 `3e4b3f77dd7597ac0d9ae40d3377b00c149a7cdca708ca3ad71ab8f5262eebd3`. Ran the existing lightweight Node source-freeze admission test: 1/1 pass. Independently authored and ran `audit-source.py`; output is `source-audit.json`. This script verifies freeze hashes, classifies the supplied weighted tip samples and directly evaluates authored smoothstep equations for nominal endpoints and interruption counterexamples. It does **not** independently regenerate all 4,815 weighted poses or replace the SDK consumer test.

No browser, build, engine/product/STATE edit, previous candidate edit, Git operation, Mac action or publication performed. Only this new review directory is authored here.

## Curves, axes and admission

- Native canonical transform is T(0,0,.05) Ry(pi), a proper rigid rotation, with +Z forward and Y up. Negative shoulder X raises the forward/downward weapon; local Y turns it laterally. Three-dimensional hierarchies matter: an Euler angle alone is not a measured world weapon trajectory.
- Stage1 preparation reaches its hold at .39s; stage3 at .2925s. Their local keys meet extension at windup+.035s, 90% extension at +.10, brace at +.30, 35% brace at +.68, and rest at +1. Smoothstep is continuous with zero slope at each authored knot. Complete nominal cycles meet rest exactly at clock0 and windup+1, with fixed flinch.
- The actual AI starts ordinary thrust with guard=1, clears guard at .6s, sends a guarded hit to stage4/clock0, then starts stage3 after stun. Unguarded stun sends the actor to stage2; strike completion sends it to stage2. These are real discontinuous stage/clock changes, not continuous traversal of one curve.
- All eleven replacement living channels use stage/clock and flinch, not guard. Previous living shell/head idle oscillation is removed from those axes. Eye idle remains. This is an intentional shape study but an unmeasured idle/breathing regression risk, and guard field observation alone no longer establishes a matching shield pose. At exact ordinary start the shield is at rest despite guard already being active.
- Root/lower-body bytecode equality is tested, and all death joints are tested against motion3 including new zeroed axes. Original gameplay/lighting/body/pickup platform inputs are compared exactly. The strict consumer rejects private locals and unexpected programme structures; numeric schema still limits nodes to128. The preserved attempt1 overflow was fixed in candidate source, not by relaxing the consumer.
- Source freeze is a hash closure over listed files, not a signed immutable build. `admitConchReadable` reads a locally supplied manifest and only requires three named source entries. Root must retain the independently pinned manifest SHA and freeze actual host/build inputs separately. The manifest pins the pose consumer and SDK emitter but not the entire transitive schema/evaluator/host dependency graph.

## Preserved counterexamples and timing concerns

1. **Interrupted continuity fails by construction.** At ordinary .4s and equal zero flinch, stage1→4 changes shieldArm.x from−.48 to0 immediately. Even at equal full flinch, the change is .168rad. At counter .485s and equal zero flinch, switching to rest removes−.80rad rapierForearm.y. At counter recovery .8s with flinch=.5, the largest axis discontinuity is .20935rad. These are exact local-channel counterexamples, not a prediction of screen-space displacement; actual events can change flinch too. Death preserves the old death pose rather than the interrupted living pose, so unchanged death is not proof of continuity into death.
2. **Weapon alignment is narrower than the source check.** The check asserts only the +35ms tip key is within nominal lane half-width .325m, plus maximum forward reach occurs during the nominal active window. In each attack, six of21 sampled active-window endpoints (0–25ms inclusive) are outside that nominal lane. First sampled in-lane point is +30ms. At active start the ordinary tip is x1.928/z.927m; counter x2.219/z.589m. The +35ms point is x.140/z1.925m. Maximum +Z occurs +25ms at x.567/.683m. These are canonical local points, not world collision evidence.
3. **Actual strike geometry has an additional .4m target tolerance.** `StrikeRunner.containsShape` uses nominal width/2+.4=.725m, segment projection and a strict range<2.4m check. Five of21 tip samples (0–20ms) exceed even that lateral tolerance, although weapon-tip containment itself is not how target damage is decided. The strike is a lane overlap, not a swept sword collider. A player can validly receive mechanical damage beyond the visible tip's forward reach.
4. **Behavior clock is not the runner phase clock.** `StrikeRunner.update` resets elapsed on each phase transition and returns immediately when windup becomes active; contact is attempted on a later active update. Numeric pose uses `regular-clock`. Overshoot, fixed-step order and sparse rendering can change which authored key is visible when contact occurs. Source knots at +35ms do not prove damage and blade alignment. Motion3 capture had median render intervals90.95ms, long enough to skip most of this 100ms active animation; that old cadence is a warning, not a prediction or new device benchmark.

## What the producer checks do and do not establish

- 4,815 living floor poses are five stages × three flinch values ×321 clock samples. All use t=.4, speed=.8, phase=.21 and identity actor transform. This is correctly sampled weighted geometry, including four weights and94 blended vertices; it is not arbitrary gait phase, orientation, scale, displacement, terrain, collision or all-render coverage. The 3mm minima are consistent with preserved lower-body channels and do not prove planted feet.
- 485 death comparisons sample five stale stages and97 death times with a repeating flinch sequence. Combined with living comparisons this explains5,300 parity checks. They establish the tested values; they are not all possible interruption combinations or contact between samples.
- 1,215 clearance samples use a conservative axis-aligned transformed torso box and mapped blade indices300–467. Every tested blade edge/vertex misses that box. This supports the literal sampled edge/vertex separation claim. It does not test every triangle interior, shield, shell, head, arm, all body parts, death or arbitrary world poses. A conservative box and edge test are not a full triangle/mesh collision proof.
- Floor and parity tests reset bind transforms before every pose. They establish stateless snapshots, deliberately not temporal continuity or history-sensitive runtime behavior.
- The nominal boundary test holds flinch=0, t/speed/phase fixed; changing flinch or resetting stages has no continuity assertion. The tip test has no recoil-bearing world-space weapon/strike alignment assertion.

## Required actual-capture review

Record exact immutable source/product/host closure, true engine render cadence, encoded video timestamps, actual poseInput, behavior stage/clock, strike phase/elapsed/locked lane, actor/player transforms, health/rewards and all weighted world transforms. Keep failed guard trials, not just successful sequences.

Review every encoded frame of complete ordinary and guarded-counter cycles, plus hits early/late in tells, hits in active and recovery, pending-stage4→counter, approach/footsteps, idle, death interruption, corpse hold, player defeat, Retry and isolated reentry/persistence. Compare with motion3 without presenting skipped animation frames as continuous motion. Explicitly distinguish encoded-frame time, render time and game/strike clocks.

Scoped five-point ratings remain pending: character readability in motion; guard/thrust/counter telegraphs; hit reaction/recovery; death presentation; grounding/weight/contact. Recommend promotion only as labeled WIP if the exact new build visibly improves presentation and passes applicable functionality/contact checks. A successful source test alone cannot earn that recommendation.

## Final pre-build decision and smallest revision

**NO-BUILD for the present frozen candidate as the proposed improvement build.** Preserve it as rejected source evidence and revise the offensive timing first. A separately authorized diagnostic experiment is possible, but spending the build/capture lane to certify this known early-hit mismatch is not recommended. This is not a claim of a live-host failure: the reproducible counterexample below concerns the real runner with explicitly synchronized input clocks.

### Actual strike emission diagnostic

`strike-timing.test.ts` runs the real unchanged StrikeRunner at5ms with a structural actor, a target at(0,0,2), the exact Conch strike constants, and behavior clock synchronized to accumulated step time. On windup→active it verifies no hit and attackPhase−1; on the next step it verifies one hit. It then looks up the exact time in the frozen weighted tip evidence:

- Ordinary: active entry .600s, first hit .605s; tip(x1.877807,y.545423,z1.041586)m.
- Counter: active entry .450s, first hit .455s; tip(x2.182616,y1.040724,z.730166)m.
- Both first hits occur with frame.attack−1 and the tip far outside both nominal and effective lateral lane bounds. This concretely falsifies the proposition that placing the authored apex35ms into active aligns it with actual first damage.

The focused diagnostic passes1/1 because it explicitly asserts and preserves the known bad behavior. It must not be presented as an animation acceptance test. `strike-timing.json` records observations. The first invocation omitted the exact test path and the lane guard correctly refused it; the corrected invocation named the one test file and passed. No full suite or heavy lease was used.

Reproduce: `node node_modules/vitest/vitest.mjs run --config docs/reviews/conch-motion4-independent/vitest.config.ts docs/reviews/conch-motion4-independent/strike-timing.test.ts`.

### Can admitted frame.attack supply the missing timing?

No complete runner clock is exposed. `AnimalView` assigns `c.attack=this.attackPhase`. `AnimalSim.startAttack(windup)` sets attackT0 and attackDur; `attackPhase` is−1 when attackT<0, otherwise min(1,attackT/attackDur). AnimalSim.step advances attackT. StrikeRunner calls cancelAttack on entering active, and stagger also cancels it. Thus this admitted observation is normalized windup progress, followed by−1 throughout active/recovery/rest/stagger. It cannot distinguish those phases, identify the damage tick, or give elapsed active time. The existing scalars allow designated frame fields and mem/dims values; there is no authorized runner-phase binding to discover here. Do not rename attack as an authoritative strike clock or add undeclared engine fields.

### Quantified lost behavior and handoff

- Motion3 living shell idle X was .008sin(1.7t)rad; head idle X was−.015sin(1.7t)rad. Their peak-to-peak amplitudes .016/.030rad disappear entirely from replaced living outputs. Eye idle survives. Preserve these small original idle terms in rest, rather than silently replacing all upper-body rest with a rigid zero.
- Motion3 guard=1 at zero flinch supplied shieldArm.x−.24 and shieldForearm.y−.22rad immediately, independent of clock. Current motion4 returns0 on both axes at clock0 even while mechanically guarded. It reaches stronger−.48/−.38rad at .39s. A real initial guard need not be visually strong enough merely because its eventual windup is.
- The harmful guard-to-counter discontinuity is principally **stage1→stage4** at the guarded hit, not necessarily stage4→stage3. At equal flinch, stage4 and stage3 clock0 have identical new living values, so that latter boundary has no attack-term jump. Subsequent counter windup diverges smoothly. Actual flinch may change at either sampled frame; record it rather than attributing every jump to the stage label.

### Recommended narrowly scoped source revision

1. Move the aligned offensive pose to windup completion or slightly before it, rather than35ms afterward. Keep the blade in the intended lane throughout the earliest possible active-hit period; preserve the exact strike clocks, geometry and damage. Retain the new stronger early anticipation, but use its final windup portion to bring the blade onto the lane. A hold through nominal active end provides tolerance; quantify actual host clock skew before asserting enough hold time.
2. Restore original rest shell/head breathing and a baseline guard-driven shield contribution, blending the new tell shape on top without double-counting its desired final angle. This preserves guard readability at clock0. Enforce the original128-node limit; split only valid existing one-joint channel outputs if necessary, never relax schema.
3. Make stage4 an explicit coherent recoil/guard bridge driven by admitted flinch, and reduce attack contribution fully at full flinch if it yields a smaller discontinuity. Preserve old death/lower-body transforms. This can improve visible interruption behavior but cannot mathematically guarantee every arbitrary incoming pose without history; retain that limitation and review actual hits.
4. Add a regression using the actual runner at several fixed steps (5ms,1/60s,1/30s, and the host's actual step), including phase overshoot and reversed actor/runner update ordering. At every actual damage emission, evaluate fresh candidate geometry and world tip/locked-lane relation. Check new guard clock0 and full winding paths, flinch variants, complete endpoints and actual interrupted sequences. The present supplied-evidence test is a negative witness, not the final regression implementation.

These are source-only changes; no engine, AI, strike, physics, lower-body, death or published host change is needed. If exact arbitrary continuity remains a hard prerequisite, the source-only route cannot meet it and must remain unaccepted rather than quietly adding history or broadening architecture.

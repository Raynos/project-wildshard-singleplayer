# Independent review: bounded shared-Arena foot contact

2026-10-20. Read-only code/design review on the cloud checkout. The only write is this review. No source or asset edits, tests, model execution, physics, build, Git operations or public writes. Read AGENTS.md, relevant process guidance, DRIFTWOOD-ENEMIES state, the foot-contact proposal, articulated-native proposal and selected-complete-motion rejection. Code references below describe the inspected working files, not a verified remote commit.

## Verdict

**The proposed bounded architecture is implementable in principle and is an appropriate next design direction. It is not implemented, source-admitted or gameplay-ready.** No general-terrain service is required to establish a truthful finite static shared-Arena subset. Exactly two owner-held foot states, a pure bounded solver, staged authoritative root and a quiet constraint-preserving presentation sampler can fit the current native owner without another clock, physics step, arbitrary authored callback, root lift, collider padding or raised caps.

There are still concrete implementation/admission obligations. Most are correctly named in REPORT.md, not contradictions that require abandoning the design. The main unresolved facts are the actual new source geometry and the full reachable motion/recovery envelope. Do not describe an unproved recovery as safe merely because its status is `released`.

## Verified code fit

- `PracticeNativeActor.ts:91–132` constructs the existing scoped actor, decision control and NativeCreaturePose; its body-step after hook advances and publishes once. `preFixed`/`fixed` preserve the arena-owned physics step. This is the correct bounded integration point, not a reason to introduce another actor, callback host or world.
- `animation.ts:714–744` records actual XYZ displacement/heading, advances the scalar law and runs numeric evaluation **before** `applyAnimalRoot`. The proposal correctly requires root staging after the scalar law but before contact solving. Include YXZ tilt, root-flinch policy and scale, not only actor position/yaw.
- `channelPrograms.ts:69–99` strictly rejects unknown practice reads and nonjoint outputs. Its evaluator snapshots inputs before output writes. Contact ports therefore need explicit compiler/schema registration and detached values; a later leg lane cannot read an earlier lane's new result. An internal pure IK result supplied before evaluation avoids that hazard without DAG cap changes.
- `animation.ts:767–828` prepares hits on detached joints and commits validated state; nonlethal root is the current publication, not a speculative next-tick root. Preserve this event boundary. Lethal contacts must release only in the successful staged corpse transaction. `copyPublished` currently interpolates locals/root independently; it cannot certify planted contact at intermediate alpha.
- `AnimalSim.ts:313–408` combines steering, strafe, stagger and accumulated impulse, applies motor correction, then ground-follow Y. Use that actual result. `motion.total` is unsigned 3D travel, not a gait/contact clock.
- The arena is concretely finite: `TrainingArena.ts:30–31,215–227,271–277,325–327` defines a 100 m square at Y=900, a floor slab whose top is Y, walls, and an active-only finite floor function. The decorative floor mesh sits 0.03 m below the collision/support plane. Report this existing distinction honestly; do not move the root/sole to the decoration or call its visual offset numerical contact error.

## Must fix or establish before admitting a candidate

### 1. Connect the declaration to the actual trusted arena surface

The current adapter uses `spawn.at.y` as an unbounded constant and creates its host with `ground:false`; it receives neither the room bounds nor active/revision identity. A successful ray or equality to spawn Y cannot validate the proposed contract.

Pass a trusted, bounded immutable surface description from the existing arena owner through the existing practice adapter. Bind identity/revision, horizontal plane coefficients, finite footprint and active lifetime to the actual room/slab, not a second authored approximation. Do not expose its implementation as a new source callback. The first mode can explicitly accept only the current horizontal slab; slopes remain unsupported. Preserve disappearance and out-of-region as absence, not fallback to the shard underneath.

Validate the **entire transformed sole footprint** inside the region, including wall clearance. Floor support is not wall/player/other-obstacle clearance. Either admit a bounded obstacle-free reachable region using actual room/obstacle geometry, or establish the required obstacle checks through existing trusted machinery. Do not infer safety from the character motor's torso capsule alone: toes, the broad shield union and weapon can extend beyond it.

### 2. Freeze the new source and its complete transform contract

The rejected 135-channel source cannot be re-admitted by adding IK. It still has blended hinges, locked-knee ownership and the documented 43.462600 mm toe witness. Create the separate six-leg-part source with actual closed seams/collars and sole geometry; no dominant-weight reassignment or deleted inconvenient vertices. Recompute lengths, limits, pole frames, sole-to-ankle direction/convention, living dimensions and exact hull support from the new freeze.

Verify B=Ry(pi) on positions, normals, pivots, sockets, local rotation frames and directional semantics with skin/FK commutation at nonzero yaw/scale. The statement that actor-left is +X is a semantic check, not proof that simply retaining old left/right labels after conversion is correct. Check weapon lane and named side mapping explicitly.

The eight-owner upper-body concession needs actual independent anatomy/readability acceptance, not hull-count inference. Bind-constant hip ancestors must be proven from admitted living programs including hit/attack branches. Use the declared joint Euler orders consistently; “Euler XYZ” observations must not accidentally impose XYZ on a differently ordered bone. Limits, twist and bend-frame orientation need a deterministic definition, not just solved knee position. Keep source-wide nonpenetration and hull 8/128/512 gates unchanged.

### 3. Make transition and failure semantics executable

Specify per-tick ordering for release, swing progression, landing, tie-break updates and any next release. If an endpoint lands during a tick, define its exact boundary and retained segment metadata; avoid a second transition/elapsed advance caused by publication or render sampling. The fixed-step owner should assert its supported tick cadence, rather than accepting arbitrary positive dt as current `advance` does.

Reach/turn guards need a conservative forward feasibility argument over the **whole** fixed-duration swing and its interpolation, including the stance leg. Merely choosing a reachable landing from the current root can leave that latched target unreachable when the body continues moving. Both feet near release, stop/start, blocked movement, yaw reversal and simultaneous hit/shove must have specified deterministic outcomes. No clamp of unreachable IK into success; strict interior reach and a conditioned pole are appropriate.

Distinguish kinematic `stance`/support-valid, `swing`/not loaded, and `released`/unsupported. A flag alone cannot decide the finite published joint pose. For every reachable admitted input, provide an admitted finite nonpenetrating endpoint and full interpolation, or fail that source's gameplay admission in advance. If an unexpected out-of-domain runtime input occurs after the real body move, report support failure without pretending the old plant remains valid, freezing the actor root, rolling back damage, or publishing NaNs. Do not promise visual recovery for that event without a proof.

### 4. Derive the envelope from actual gameplay, not a convenient test shove

`AnimalSim.ts:65,294–305` gives stagger distance 0.6–1.5 m divided by max(1,scale), over 0.25 s, with stun and cancelled attack. That is **not** the entire shove envelope. `impulse` at lines 183–187 adds velocity; motion combines it with other motion and decays it by exp(-3.5 dt). `PracticeCreature.ts:236` routes ordinary weapon impulse to this native actor. `contactWeapon.ts:55–73` can apply reactions before damage or on survival, with health predicates, and repeated hits can accumulate impulse. Actual equipped weapon moves, reaction timing, supported scale range, yaw/speed bounds and repeated-contact sequences must define the reachable domain.

The low-level impulse API itself has no finite magnitude cap beyond finite inputs. Do not claim arbitrary API input is admitted; identify the bounded reachable gameplay inputs and preserve all of them. No isolated single-stagger proof substitutes for additive/repeated impulses. Do not remove weapons, lower damage/push, reset accumulated impulse or cap the motor to make this candidate pass. If the unchanged actual shared-Arena gameplay domain cannot be covered by source plus admitted recovery, refuse the candidate. This is a source/admission blocker, not a demand for arbitrary terrain.

### 5. Certify the render path, including release and landing boundaries

Use the same pure solve on detached sampled root/contact data. Copy authoritative alpha 0/1 endpoints exactly; never advance contact time or query ground from the reader. Define a canonical interval representation that retains the correct plant identity and swing segment when modes differ across endpoints. It must not interpolate two unrelated plant frames, extrapolate a completed swing, or depend on read order.

Root interpolation can have unreachable intermediate hip/ankle geometry even if both endpoints solve. Whole-foot lift formulas alone do not prove rotating toe clearance, nor does leg IK prove shield/rapier clearance. Establish conservative continuum bounds or a justified certified adaptive bound over the admitted root/contact trajectories. Dense samples are useful witnesses, not universal proof. Keep current native collision/FK queries on the authoritative endpoint; document that the renderer derives intermediate presentation only. No sampler may overwrite owner joints/FK/history.

### 6. Keep initialization, hits and continuation genuinely atomic

Preflight fallible source/plane/plant initialization before attachment or actor/motor placement. Current `place` mutates the actor and motor before resetting pose anchors; REPORT.md correctly identifies the transaction change needed. Restore must validate the new full contact envelope and compatible active plane identity from trusted detached metadata before any owner copies; do not query/re-solve to reconstruct a missing midstride state. Reject contactless old continuation for exact contact restore.

Zero-time nonlethal hit preparation must retain solved legs and current root while allowing the allowed upper-body response, and reset previous/current **contact publication** consistently with the existing immediate event publication. Preserve existing plants/swing elapsed and tick ordinal. Next-tick engine root flinch, if enabled, belongs in the actual admitted root/recovery domain; silently opting it away is not a substitute for explicit source policy. Lethal success releases once; abort leaves contacts, HP and all existing publication untouched. Physical pose-only restore remains explicitly unsupported, not a new promised success.

## What is future optional scope, not a reason to reject the flat design

General uneven terrain, ramps, partial/rocker sole support, moving platforms, balancing/force-bearing leg dynamics and a general multi-limb animation host are unnecessary for a valid first horizontal shared-Arena admission. Reject unsupported modes explicitly. Physical continuation can retain its current refusal rather than expand this work. A gameplay-ready claim still separately needs actual AI/weapons/damage, loss/Retry/reload, rewards, persistence isolation, independent visual review and performance evidence; none are provided by this design review.

## Recommended next boundary

Accept the three bounded architecture changes for implementation planning, subject to the concrete contracts above. Freeze one new articulated source and prove its horizontal-plane/recovery envelope against unchanged actual Arena gameplay before native physical sweeps or an app build. Preserve the failed source and witness. Stop that candidate if source geometry, upper-body anatomy, obstacle clearance or the actual shove domain cannot be admitted. No parameter search or widened exemptions follows from this review.

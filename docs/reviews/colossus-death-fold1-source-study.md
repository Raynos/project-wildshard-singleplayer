# Colossus death-fold1: rejected source-only motion study

2026-10-19. **Do not build or promote this candidate.** This is one complete editable performance experiment, not animation acceptance. Public motion2 and its existing evidence remain unchanged. No visual rating is assigned.

## Evidence read before editing

- `docs/plans/driftwood-enemies/STATE.md`: all five require separately at least 4/5 likeness and 4/5 animation/readability. No averaging.
- `docs/reviews/colossus-motion2-independent-cycles/README.md`: motion2 death performance 1.5/5; nearly upright rigid corpse, not a completed fall. The complete-cycle review distinguishes sampled geometry clearance from collider acceptance and reports no phone result.
- `src/shards/driftwood-isle/generators/colossusNativeClips.ts`: existing motion2 has six modest lower-chain death rotations, linear death weighting and no torso collapse. Exact SHA-256 `d08b8c09adfd8148d6562ac26c8a830d2e9d737e0b4af36e484ab481c8d7ec45`.
- `docs/reviews/colossus-native-motion2-build3/render-trace.json`: SHA-256 `7669564e64059676d86ac95bf7ec83e8e6719e2478d2b0a2d3259abd3e57815e`. Contains actual 22-joint local TRS and mesh-world transforms, including launch, tilt and settled corpse. Replayed all 141 dead samples.
- Native source `runtime-admission/v4-skin1/colossus-v4-native.json`: SHA-256 `32c4f9b55c5303e75877c8abae7765947a3814c39bb15d3c7a0046e61cb93641`. Existing consumer tests independently verify source/payload identity, all four weights, rest and joint motion. Rerun: 4/4 pass.

## Candidate and boundaries

Complete authoring source and emitted numeric clips are under `art/driftwood-isle/lowpoly-colossus/motion-studies/death-fold1/`:

- `colossusDeathFoldClips.ts`: complete editable numeric-channel source, isolated from the runtime generator.
- `clips.json`: all 33 numeric programs compiled by the existing SDK.
- `motion2-baseline.ts`: exact pinned comparison source.
- `death-fold.test.ts`, `vitest.config.ts`: focused reproducible checks.
- `source-checks.json`, `world-replay.json`, `onset-failure.json`: machine-readable results; `closure.json` pins source and evidence.

One authored sequence uses the existing 0.8-second death clock: initial knee buckle/arm brace, delayed torso fold with asymmetric arm release, then a fixed prone-intent rest. Smoothstep windows replace linear death targets. The body joint descends 1.38 m and pitches 1.35 radians; this is an unaccepted authored transform, not a mesh-root lift, physics force, new collider, solver correction or alternative death architecture. The failure below shows why this transform is not a usable substitute for physical support.

The candidate does not change geometry, weights, bind translations, living dimensions, species data, AI, strike timing, damage, loot, current death handler, engine files, shared scripts or public motion2. All work is source-only, with no build, browser, capture, renderer, new model or publication.

## Results: retain the failures

Focused candidate suite: **1 passed, 2 failed**, with failures intentionally left as ordinary red promotion assertions. They are not inverted into expected-failure passes.

1. **Living parity and curve/hold pass.** 644 living samples across idle and all attacks reproduce exact motion2 position/quaternion/scale values. 1,001 death samples are finite; maximum adjacent transform-component change is 0.002875 at normalized steps of 0.001. The final pose remains bit-identical when time, flinch, stage and clock subsequently vary. This tests curve continuity, not interrupted lethal-pose continuity.
2. **Actual-world weighted replay fails.** The exact captured mesh-world trajectory is applied to all 15,600 native vertices, including 4,384 multiweighted vertices and every one of four skin influences. Baseline captured transforms reproduce +0.018563022 m minimum clearance. Full candidate evaluation gives **−2.353892661 m** minimum, with **135/141 dead frames** below −5 mm. The last sampled candidate frame has 5,125 vertices below threshold, worst semantic batch `arm1`. Three.js `SkinnedMesh` and independent four-weight matrix summation agree within 0.000026885 m; the residual includes Float32 skeleton matrix precision. This is a replay, not a new runtime simulation, and it does not establish changed contact forces or terrain behavior.
3. **Interrupted lethal onset fails.** The existing handler calls `pose(6)`, publishing `tg-state=6` and `tg-clock=0`. At the exact same time and deathT=0, the living-to-dead transform jump reaches 0.522687 quaternion-component units for an interrupted slam; this number is neither radians nor a geometric distance. Four tested interrupted poses have **zero same-time jump if their existing stage/clock inputs are retained**. The candidate cannot reconstruct erased pose inputs from the normalized death clock.

A package-runner attempt failed before tests because pnpm tried to create its unavailable home directory. The already installed Vitest runner then ran successfully and produced the results above. Both logs are retained. Oxlint reported no files found because art studies are excluded by repository ignore patterns; **this is not a lint pass**. No standalone TypeScript or aggregate build gate was run.

## Exact present physics boundary

The admitted body dimensions have no `rigidCorpse` recipe. Its existing `rigid` path in `src/engine/physics/ragdoll.ts` creates one fixed box with half extents approximately `[1.439629, 1.14, 2.273838]`, translated to `[0, 1.368, 0]` relative to the mesh root. Bone animation does not update this box. A settled root near y899.771973 against floor900 is therefore consistent with that unchanged box supporting the root while the visual skeleton is separately folded.

The existing trace itself is sufficient to reject this candidate. It is **not** a mathematical proof that no possible data-only pose could ever stay clear, nor permission to expand architecture. Raising the root, padding colliders or tuning a trajectory-specific compensation would conceal the issue rather than establish a credible weighted fall. No such workaround or search was attempted.

## Smallest consequential follow-on for root review

Fix the independent onset ownership problem before another render slot:

- Separate the dying actor's behavior state from the two last-live pose inputs. The current numeric evaluator already accepts data scalars; the current fixed-step corpse owner already consumes them. No new callback, solver or engine exemption is needed.
- The fewest-line possibility is to stop resetting the public pose/clock fields in `onDeath`, while still stopping movement, clearing exposed/awake and setting internal behavior state to dead. However, `tg-state` is also the species `actions.stateKey`, so retaining it could preserve an attack action classification. That coupling must be reviewed, not silently altered.
- The safer scoped option is a dedicated last-live pose-step/pose-clock pair in the existing shared-field catalogue, written once from the pre-reset values at death; retain ordinary state6/clock0 for behavior and diagnostics. Select the retained pair only for numeric death evaluation. Guard duplicate `onHit(hp<=0)` / `onDeath` calls so the saved pose cannot be overwritten by 6/0. Verify command ordering and use the latest published pose clock rather than assuming a private timer matches the rendered frame.
- Required proof: lethal interruptions at left/right/slam windup, active and recovery; idle lethal and repeated death events; fixed-step first endpoint and render interpolation; exact living parity, clocks, damage/rewards and Retry cleanup. The existing same-time retained-input check establishes the narrowly relevant prerequisite, not the whole fix.

That data/state correction addresses onset only. A credible supported collapse remains unresolved. Do not promote this pose or request an engine/rigid-body expansion from this study. Preserve motion2 until a root-reviewed, bounded follow-on can demonstrate both a continuous onset and actual weighted world behavior.

## Reproduction

From repository root:

`node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-colossus/motion-studies/death-fold1/vitest.config.ts art/driftwood-isle/lowpoly-colossus/motion-studies/death-fold1/death-fold.test.ts`

Expected current exit is nonzero, with the two failures above. Native source parity was separately rerun using `runtime-admission/vitest.config.ts` and `runtime-admission/native-consumer.test.ts` (4/4 pass). All generated study evidence stays in the owned study directory. New footprint is under 0.3 MiB. No Git index, branch, commit or publication action was taken.

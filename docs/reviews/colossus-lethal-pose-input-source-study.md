# Colossus lethal-pose input: blocked source candidate

2026-10-19. **Do not promote or build this candidate.** The separated pose ownership fixes the tested mathematical onset when the guest transition commits, but the required paired lethal dispatch fails the existing host fuel gate. Public motion2, living gameplay, body geometry and physics are untouched. No animation or likeness rating is assigned.

## Candidate source

Owned files: `art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/`.

- `candidateFactory.ts`: separate isolated source/output factory. Existing supported numeric shared-field rows add `tg-death-step` (0–6), `tg-death-clock` (0–600), and `tg-death-valid` (0–1). IDs115–117 are local to this isolated candidate catalogue. Existing five fields and `actions.stateKey: tg-state` remain unchanged. One bounded binding-state latch is appended. No format, engine or schema extension.
- `behaviour/tide-root-colossus.as`: complete separate guest. Before resetting state, capture **published** pose/clock through existing `Read.field`, rather than the private elapsed timer. First lethal hit or death calls the same transition; the immediate binding latch prevents recapture. It then performs the original stop, pose6/clock0/exposed0, sequence0 and awake0 actions. Duplicate lethal transitions return. Living AI/strike routines and unrelated stop/tick/strike-done handlers are unchanged. Start clears all retained fields and latch.
- `colossusLethalPoseClips.ts` / `clips.json`: complete numeric death-fold1 candidate, selecting the retained pair only at deathT>=0 with a valid capture. Living evaluation uses original pose fields even if stale retained data exists. Missing legacy fields default to zero; erased historical pose cannot be reconstructed.
- `rig.ts`, `lethal-pose.test.ts`, `vitest.config.ts`, `tsconfig.json`: focused native22 numeric and real Wasm-host regressions.

Use this study directory as the candidate project source root if a later authorized build is approved; do not compile the original guest against the candidate catalogue. No build was performed here.

## Observed results and blocker

Final focused suite: **74 passed, 69 failed (143 total)**. All 136 phase/order cases ran: 68 separate-event cases passed; 68 paired-order cases failed fuel; the independent paired baseline comparison also failed. Red gates are retained, not marked expected-failure.

1. **Source/schema admission passes.** Candidate source parses through the existing strict shard parser; output sections through their normal parsers; the actual guest compiles and admits through existing AssemblyScript/ABI checks. Numeric clips pass the real native numeric admission and reject unknown keys/prototype paths and nonfinite observations. Targeted strict TypeScript checks are recorded in `types.log`. This is not an aggregate application build or lint result.
2. **102 same-time interruptions have zero numeric transform difference** across idle, stages4/5, all three attacks' windup/active/recovery boundaries and three flinch levels. Each runs49 fixed steps with five render interpolation fractions against the unchanged death-fold1 evaluator supplied the retained pre-reset inputs. All are finite. This is a numerical rig/owner check, not a rendered or mounted combat capture.
3. **606 living poses match public motion2 numerically**, including stale retained fields. Comparisons treat +0 and −0 as the same numeric value; this is not a bit-identical signed-zero claim. Living command sequences, original binding state and public action fields match the original compiled guest over three health phases. Non-script platform sections, loot rows and runtime identities are unchanged.
4. **Single-event and separate-step repeated lethal transitions preserve the first pair.** Real host save/restore into a fresh scenario preserves the latch. Start clears it for reuse. Other stop/tick/strike-done dispatch still executes; the guest emits no grant/reward command. These checks are guest/scenario evidence only. **Actual mounted host capture, reward dispatch and UI Retry/reload proof remain pending.** No external death or reward event owner was modified.
5. **Same-batch hit+death fails the unchanged fuel limit.** Existing combat pipeline emits damage.dealt before actor.died (`src/engine/combat/pipeline.ts`); the decision bridge queues hit then death (`src/game/shardfile/decisions.ts`). The source supports paired queuing: `PracticeDecisions.ts:8,30` uses the borrowed authority; `borrowedDecisions.ts:181–188` constructs ShardDecisions and invokes its registered callbacks once per fixed step. `decisions.ts:428–434` only enqueues events, explicitly without synchronous Wasm execution; `decisions.ts:176` steps the host once. `engine/script/decision.ts:278–289` drains up to16 events into one ws_handle call and fuel budget. This is a code audit plus direct-host reproduction, **not an observed mounted lifecycle failure**; actual retained-actor dispatch composition must still be captured before declaring a live regression. Original baseline guest refuses at414,736 measured fuel; candidate refuses at440,072 under the existing400,000 limit. Host rollback means no capture or reset commits on that refused call. `paired-dispatch-failure.json` retains exact baseline/candidate traces, state and metrics. Reversed paired order is also tested. No fuel increase or exemption was made. Required promotion assertions remain ordinary red tests.

An intermediate implementation guarded capture but still repeated reset commands; it also failed at440,100. `observed-fuel-failure.json` is explicitly a transcription of observed tool output, not the overwritten original raw log. `test.log` and `test-final.log` retain raw subsequent failures with whole-transition idempotence. The comparison and full matrix have separate logs. The full matrix emits `ordering-results.json`, so a first failing phase cannot hide later phases.

The measured fuel failure also exists in the unmodified baseline. This does not excuse the candidate's failure. Resolving the existing guest dispatch/metering constraint is a separate review decision; this bounded pass did not change the host, its transport, compiler, budgets or event scheduling.

## Contact and acceptance stay failed

The original death-fold1 world replay is unchanged and remains **FAILED:135/141 dead frames below−5mm, minimum−2.353892661m**. That is the pinned earlier candidate's replay, not a new weighted-world replay of this ownership correction. No new support/terrain/contact claim follows from onset continuity. The rigid box, mesh root, collider dimensions, geometry, skin weights and all runtime assets remain unchanged. There is no physical acceptance, visual rating, phone result or runtime promotion.

## Reproduce

From repository root:

`node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/vitest.config.ts art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/lethal-pose.test.ts`

Expected exit is nonzero because paired-event ordering is a required gate.

`node node_modules/typescript/bin/tsc -p art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-input/tsconfig.json`

The focused TypeScript project includes candidate code/tests and the existing ambient declarations they require; it does not check the repository's Vitest configuration. No broad suite, browser, capture, renderer, application build, publication or Git mutation was run. Footprint is under1MiB, below the3MiB bound.

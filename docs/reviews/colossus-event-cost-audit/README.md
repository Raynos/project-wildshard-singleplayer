# Colossus event-cost audit

2026-10-19. Read-only source diagnosis with virtual guest variants. No source promotion, app build, browser, mounted lifecycle, Git mutation, host/schema change, changed budget, or omitted event. All new files stay in this directory. Original candidate proofs remain untouched.

## Finding and proposed boundary

The existing candidate already returns on `State.poseCaptured != 0` before any death reads or commands. Moving that check earlier inside `onDeath` cannot help. The ordinary paired lethal batch is dominated by structural guest call costs, not repeated capture commands.

A bounded candidate-only change is plausible: add `@inline` to BOTH exported `onHit` and `onDeath` in the isolated candidate guest. No handler body, parameter, conditional, read, state write, command or event changes. Do not change the public guest, factory, compiler, generated bindings, host, fuel limits, reward owner or scheduling. This is normal pre-instrumentation AssemblyScript inlining through the existing compiler, not an instrumentation exemption. Every remaining guest function/loop still receives existing metering and admission checks.

The virtual two-annotation candidate admits hit/death in both orders at **350,927**, leaving **49,073** under the unchanged 400,000 call limit. The original candidate refuses at 440,072. This is a measured narrow fix, not universal admission for every legal 16-event queue or mounted acceptance.

## Exact real-host measurements

`measurements.json` retains complete real DecisionHost call/read traces, resulting fields/state, compiled module hashes and meter constants for five independently compiled variants. Table values are the first call at tick12 after start committed at tick7. The existing 10Hz script automatically appends a tick to each tested event batch; `advance(.2)` also produces a later tick-only call at tick18, recorded separately. A refusal value is the charge at the trap, not an estimate of how much completing the call would cost.

| Variant | Structural charge | lethal hit + tick | death + tick | hit/death + tick | death/hit + tick |
|---|---:|---:|---:|---:|---:|
| Baseline | 51,800 | 311,105 | 311,102 | 414,736 refused | 414,736 refused |
| Original candidate | 54,904 | 330,260 | 330,257 | 440,072 refused | 440,072 refused |
| Inline hit only | 54,904 | 330,260 | 330,257 | 440,072 refused | 440,072 refused |
| Inline death only | 58,696 | 353,012 | 294,312 | 411,711 refused | 411,711 refused |
| Inline both | 58,348 | 292,575 | 292,572 | 350,927 admitted | 350,927 admitted |

Inline-hit alone compiles byte-identically to the original candidate. Inline-death alone increases module size and still fails. Both annotations increase metered module size from14,404 to15,375 bytes but remove sufficient per-entry structural charges. This is not a search for a magic budget value: each control tests a specific call-boundary hypothesis.

For the two-annotation variant: duplicate hit/death plus tick costs350,369; a subsequent tick-only call233,662; nonlethal hit plus dead tick292,016; two dead ticks350,626; dead strike.done plus tick350,627; stop plus dead tick292,023. Original candidate duplicate pair still refuses at439,514 despite doing no second capture/reset.

## Code cause

- `src/sdk/bake/compileScript.ts:60` sets each function/loop charge to pre-instrumentation module bytes ×4 +128 × original function count +1024. Lines62–67 charge every loop/entry; compilation uses pinned AssemblyScript `-O3`, and there is no post-instrumentation optimization.
- `src/sdk/decisionScriptBindings.ts:95–97` generates a single `ws_handle` loop and handler dispatch over the full inbox.
- `src/engine/script/decision.ts:257–262` appends the scheduled tick. Lines278–289 drain up to16 events into one call under one limit. Failure discards staged output; the queue is consumed in the finally block.
- `src/engine/script/decisionModule.ts:89–99,114–123` charge1 for function entry/finite checks and256 per scalar/list read, in addition to structural charges. Refusal occurs immediately when remaining fuel becomes negative.
- Candidate `onHit` calls `onDeath`, which still has a full metered function-entry boundary even on its immediate duplicate return. Function inlining avoids that boundary while retaining the actual latch checks, capture, death reset and scheduled tick work.

The candidate paired trap is8 ×54,904 +840 =440,072. The successful two-annotation pair is6 ×58,348 +839 =350,927. Those totals include read/finite/entry overhead. No extra allowance is inferred from the fact that the unchanged baseline also fails.

## Verification and limits

The copied original143-test suite compiles the two annotations virtually and writes all evidence here. Its combined baseline/candidate admission test deliberately remains an ordinary red assertion: baseline still fails. The first audit run recorded142 passed,1 failed. Together with the separate measurement test, the log says143 passed,1 failed of144. All136 phase/order cases,102 onset/interpolation cases,606 living numeric poses, living command/state comparisons, save/restore/start-clear and unrelated stop/tick/strike.done checks pass. The second run also records142 passed,1 failed and adds explicit zero-refusal living checks, which pass for both candidate and baseline across90 living iterations at three health phases. Matching empty command streams therefore do not hide common failure. See `regression-confirmed.log` and `living-metrics.json`.

`types.log` is an empty successful focused strict TypeScript check. `test.log` preserves the initial launch refusal when a focused test filename was omitted; the corrected explicit-file runs are `measurement-run.log`, `regression-run.log`, and `regression-confirmed.log`. No full suite or production build was run.

The fixture verifies guest/scenario semantics, not actual native reward dispatch, UI Retry/reload or mounted combat composition. Public runtime assets remain untouched. The old death-fold1 contact result is still FAILED135/141 below−5mm, minimum−2.353892661m; these annotations do not address it.

## Reproduce

From repository root:

```
node node_modules/vitest/vitest.mjs run --config docs/reviews/colossus-event-cost-audit/vitest.config.ts docs/reviews/colossus-event-cost-audit/cost.test.ts docs/reviews/colossus-event-cost-audit/inline-regression.test.ts
node node_modules/typescript/bin/tsc -p docs/reviews/colossus-event-cost-audit/tsconfig.json
```

Expect nonzero Vitest exit from the retained baseline comparison assertion. A measurement test passing means measurements were collected; it does not turn refused cases green.

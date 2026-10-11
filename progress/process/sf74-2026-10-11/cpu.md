# Local CPU pressure receipt — 11 October 2026

All three controls are landed separately: local six-worker default/positive `WS_VITEST_MAX_WORKERS` override
`bd976e899` (strict access corrected by `55fc839e9`), heavy owned commands under `nice -n 10` `33a0457e0`,
and at most three gate background jobs with an exclusive Vitest phase `fae4d85fa`. CI keeps its original worker
default. Sixteen focused lease, priority, cancellation, inventory and worker-parser fixtures pass.

| Actual full gate | Vitest | Whole gate | Result |
|---|---:|---:|---|
| Before, `465000da2` | 417 s | 427 s | One stale Nine input, later repaired by `937bef8f8` |
| After, `27d583885` | 444 s | 589 s | All gates green; 1,447 files / 7,470 tests pass |

The same 20 existing skips remain; none was added. Vitest takes 6.5% longer, while the bounded whole gate takes
38% longer. The two-minute push target remains red. Different commits and concurrent machine work prevent a
controlled causal claim. The live process sample and 15-second gate samples show at most six Vitest workers;
all gate descendants have priority at least 10. Observed active-gate load averages 15.7 and peaks at 25.3, versus
the pre-change point reading 57.8. `27d583885` reached origin and started push CI `38169189318`; no CI-green
claim is inferred from the local result. The next real cached gate, `2fa93fa60`, also passes: 34 s of related
Vitest and 129 s total. This is one measured cached attempt, still above the two-minute whole-push target.

## JSON reporter's ten slowest files

Measured file test time, including its hooks, rather than import/transform or queue time. Individual test names
and durations are retained in [cpu-receipt.json](cpu-receipt.json).

| File | Seconds |
|---|---:|
| test/proof/compatibility/determinism.test.ts | 53.701 |
| test/shards/driftwood-isle/headless-runtime.test.ts | 34.85 |
| test/shards/nalati-grasslands/headless-taming.test.ts | 29.219 |
| test/generated-workflow.test.ts | 26.94 |
| test/shards/pine-hollow/headless-runtime.test.ts | 26.581 |
| test/shards/far-reach/headless-runtime.test.ts | 26.129 |
| test/proof/pine-hollow/headless.test.ts | 20.36 |
| test/grid-render-rings.test.ts | 18.128 |
| test/lint-ratchet.test.ts | 16.47 |
| test/arch-guards.test.ts | 15.729 |

The native suites repeatedly construct and restore real worlds; reuse immutable prepared plans/assets where
fixtures retain independent hosts. Determinism must keep two independent processes and every native outcome.
The workflow/ratchet/architecture fixtures repeatedly start compilers and immutable archives; retain all refusal
cases while sharing immutable fixture setup. Render rings checks every frame and tile; reduce temporary allocation
and matcher overhead while preserving every per-frame condition and its first-failure diagnostic. These are
inspection candidates, not completed test optimizations or permission to shorten a journey.

## Export churn

`b37ead49e` retains only the newest passing exact-SHA selector probe inside one attempt. A whole-export fingerprint
refuses added, deleted, renamed or changed inputs before reuse; a SHA mismatch also refuses. The attempt cleans
its retained export in `finally`, and the complete push gate still exports freshly. Five focused fixtures pass.
The actual exact `c318474ff` CSS/Nine probe plus all ten remaining witness/map/native freshness files takes
31.0 s with two fresh exports versus 20.6 s with one byte-verified export. All checks pass. The final SHA fence
was re-proved separately after the first 22.7 s measurement; the unchanged 31.0 s baseline is reused.

No gate, test, assertion, deadline, debt ceiling or source boundary was removed.

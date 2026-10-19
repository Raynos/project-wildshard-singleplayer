# Colossus lethal-pose inline source candidate

2026-10-19. **Source admission passed; not mounted, promoted, built, or playable acceptance.** The independent [event-cost audit](colossus-event-cost-audit/README.md) proposed exactly two export annotations. This candidate materializes them as ordinary source in [lethal-pose-inline](../../art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/).

## Boundary and source proof

The new directory contains the complete factory, numeric clip generator, rig fixture, guest, focused tests and strict TypeScript configuration. Factory, clip generator and rig are byte-identical to `lethal-pose-input`. The guest differs only by `@inline` immediately before exported `onHit` and `onDeath`; reversing those two additions reproduces every original byte. The existing factory's source identity/title is intentionally unchanged. No handler body, command, event, state declaration, schema, host, compiler, metering, or budget was changed.

`source-equivalence.json` records original guest SHA-256 `af4f2b5ed29f5415ff9991dfa5edbbdbce12d6cd9135435304478967f9cd8d4f` and candidate `9dd24b8a26ca8bc0ca7cb65f7dd044f24886025dfcf5d11e061468078f4f79b3`. Actual directory intake through `buildDecisionScripts` admits 55 authored lines under the unchanged standalone 300-line ceiling and emits the 15,375-byte metered module `9106cc1b0816ccf15446a81f5bfa9466457e915da0a4e0db98247b95a21400c8`.

`compilation-inputs.json` contains exact decisions, registries, generated bindings/glue/core, options, admitted rows and module hash. `protected-inputs.json` pins the shared native/schema/compiler/host inputs and all original failed-study files; `verify-inputs.mjs` checks those pins and the original closure's source/protected hashes. Native inputs are referenced in place rather than duplicated. The 2.4 MB native source and original packed bytes remain untouched.

## Verified result

- **145 candidate/admission tests passed**, with only the baseline comparison deselected for its separate red run. This includes all **136 phase/order cases**: separate hit/death in either order and paired hit/death in either order. Every case has zero refusals and one capture, even after repeated events.
- **102 onset/interpolation samples**: exact same-time transforms, 49 fixed steps per sample, five render alphas, finite numeric output.
- **606 living pose samples** match the previous live clip. Living commands/state/fields match across 90 iterations at three health phases, with explicit zero-refusal assertions on both guests.
- Start initialization clears retained fields; real DecisionHost scenario save/restore and a fresh scenario restored from that save preserve the latch. Zero refusals checked. Unrelated stop/tick/strike.done dispatch stays intact; guest reward commands remain absent.
- Strict numeric/schema rejection checks pass. The existing strict packed native parser admits the exact metadata and original payload: **22 joints, 12 parts, 15,600 vertices**, decoded on CPU without creating a renderer. Unknown metadata keys refuse.
- Focused **strict TypeScript passed** (exit 0; `types.log` is empty). Protected original source/closure checks passed.

The actual ordinary paired call costs **350,927 / 400,000**, with zero candidate refusals. Across the full recorded scenario calls the maximum is **351,202** (the start call), leaving 48,798. These are different observations, not contradictory cost estimates. This does not establish admission for every possible 16-event queue.

## Red comparison remains red

The original comparison assertion is retained unchanged: both baseline and candidate must have zero refusals. Its dedicated run exits **1**, with **1 failed / 142 deselected**. Baseline paired dispatch still refuses at **414,736**; the actual candidate pair passes at 350,927. `baseline-comparison-red.log` and `paired-dispatch-failure.json` preserve this result. No expected-failure wrapper, weakened assertion, changed budget, or false overall green claim is used. The original failed study and independent audit evidence are untouched. Running every test without selection therefore remains red.

## Acceptance limits

The previous death-fold1 world-contact result remains **REJECTED: 135/141 frames below −5 mm, minimum −2.353892661 m**. This source patch does not repair contact. Actual mounted combat, native reward dispatch, UI Retry, reload and full lifecycle remain **UNTESTED**. Scenario initialization/save/restore is not a mounted Retry proof. No app/product build, browser, renderer, Site update, publication, promotion, or score was produced. No Git operation was performed.

## Reproduce from repository root

Candidate/admission tests (expected exit 0):

```sh
node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/vitest.config.ts art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/lethal-pose.test.ts art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/admission.test.ts -t '^(?!baseline comparison)'
```

Preserved comparison (expected actual failure, exit 1):

```sh
node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/vitest.config.ts art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/lethal-pose.test.ts -t '^baseline comparison'
```

```sh
node node_modules/typescript/bin/tsc -p art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/tsconfig.json
node art/driftwood-isle/lowpoly-colossus/motion-studies/lethal-pose-inline/verify-inputs.mjs
```

The repository's existing Vite extension warnings are retained in the logs; they did not fail these runs. No full suite was run.

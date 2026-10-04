# SF6b: generated outputs at the serialized push

Verified 2026-10-04, E435, sp-x3. The coordinator owns the plan and the serialized push.

The source-only hooks and runner integration are `8e199dfc7`. Builders document APIs in source and commit their
source files; the pusher renders clean committed input into a private index before its gate. It preserves unrelated
staged and working edits, retries a moved source tip and legitimate index locks, and checks the full docs before
Vercel filtering. Hard rules, shard reach, cycles, historical allowances and zero-debt promotion remain fatal.

The first regeneration, `328229bf5`, changed four outputs from `aab75ab1e`. Its exact coordinator-approved
trailers record game → engine 499 → 502 and Driftwood → game 48 → 50. It preserved independent working edits in
`docs/api/ENGINE.md` and `lint/layer-edges.json`. A subsequent source-only JSON fix needed no regeneration.
Later source changes produced `eba4e5640` from `2aa2cb56a`: three outputs, with no increases. This commit passed
all 20 clean-export gate stages and was pushed to `origin/main`; `8e199dfc7` is its ancestor.

Ratchet policy inputs (allow lists, budgets and Debug-row caps) never regenerate. Debt falls automatically;
graph or debt increases require the exact receipt and `Generated-Approver: wildshard-new` trailers. SF2's
`lint/shard-coupling.json` and historical allowance lists stay outside automatic regeneration.

## Validation

`pnpm exec vitest run test/generated-policy.test.ts test/generated-workflow.test.ts test/arch-guards.test.ts
test/graph-generated.test.ts test/engine-docs.test.ts` passed 134/134 before unrelated shared-tree WIP appeared.
The final focused run passed 132 tests, with the two real-tree checks excluded by the command's test selection;
they remained enabled in source and passed in the clean full gate. Scoped oxlint and shell syntax checks passed.

The actual Git workflow fixture commits one export change and a second builder's import change within 60 seconds,
while the pusher is computing its first committed export. It asserts one regeneration commit, the latest source
parent, no unpublished source captured, no hand merge, preservation of a foreign staged API table and working
source/graph edits, unchanged policy, successful committed-output checking and a second regeneration as a no-op.
Other fixtures reject manual generated changes, stale outputs and unapproved increases; source-only graph rises
warn while shard reach and cycles still fail.

The first two full push attempts found unrelated director JSON import and hybrid-entry fixture failures, fixed by
their owners in `ae8d32ccd` and `7bf04efa5`. No gate, timeout, baseline or test was weakened.

The existing `scripts/push-main.sh` lock remains the sole push lane. No browser, Simulator or performance change
was needed for this row. Nothing remains in the SF6b runner implementation.

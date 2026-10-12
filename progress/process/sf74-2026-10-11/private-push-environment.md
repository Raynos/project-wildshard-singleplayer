# W14: isolate the detached pusher from a landing index

The c05198c46 local gate failed 19 assertions in arch-guards and
generated-workflow. Fixture commits tried to use a main-checkout blob
for .agents/skills/prepare-to-exit/agents/openai.yaml that did not exist
in those fixture object stores. The prefix probe inherited the same
fault; attributing this to road-deck runtime code would be incorrect.

Owner sp-x6 confirmed that its 0ef56c2b9 landing helper passed its private
GIT_INDEX_FILE to post-commit, whose detached pusher inherited it. The
same Git fixtures under an ordinary clean environment passed 129 tests;
the sole other failure was a stale shared-root generated SHARDS table.
It was not an invalid-object failure or the committed gate result.

The auto-pusher now clears exactly the Git-local environment names
returned by git rev-parse --local-env-vars before identifying its
checkout or starting its snapshots. The committing process and its
private index keep their context. Gate commands, proofs, retry limits,
feature-worktree refusal and approvals retain their existing rules.

Two actual disposable-repository regressions inject a private index
and repository/worktree overrides into the real auto-pusher. Before
the fix they fail: a child commit reports the exact invalid-object
error, or writes into the wrong repository. Afterward the child tree
contains only its own file, the owned bare remote receives the intended
parent SHA, and the original private index is byte-identical. Both
regressions plus all 14 existing green-prefix tests pass in 5.91 seconds
wall. Focused test strict, touched typed lint and Bash syntax pass.
Actual private-index hooks passed in 0.58 seconds. The normal complete
gate on 39c838c177 passed in 172.00 seconds and pushed all four commits;
the total automatic push took 211 seconds. Its JSON report has zero
failures and 1,208 passed tests. The root shared index is empty.

The same leaked context left two regenerated shared-index entries on
the source parent while their disk bytes already matched c05198c46.
Only those exact parent-index/current-HEAD-byte entries were aligned;
no working content, foreign hunk, allowance or payload was restored.

The new standalone startup fixture also exposed two BSD-only mktemp
calls. Actual GNU mktemp refuses the old suffix-free -t auto-push form
with "too few X's"; the explicit directory/auto-push.XXXXXX form works.
Both automatic-pusher snapshots now use that portable form. The test
requires an explicit template, creates its own startup snapshot and
clears inherited AUTO_PUSH_SNAP so its exit trap cannot remove a live
parent's snapshot. Both cases fail before the portable fix, then pass
with all 14 prefix cases in 7.15 seconds wall. Typed lint, focused test
strict and Bash syntax pass again. This follow-up retains the original
snapshot, queue, gate and retry behavior.

Exact Linux push CI 38197310268 exposed that startup failure at
39c838c177. Portable fix 92c179a167 passed its complete local gate in
147.02 seconds, reached origin, then passed exact Linux push CI
38197826454 at 2026-10-12T03:03:57Z. All eight Vitest shards, strict,
typed lint and build passed. Owner sp-x7 supplied the generic boundary
and portability fixes; sp-x6 supplied the original handoff diagnosis
and corrected its scratch helpers.

The following cadence-triggered full gate on c73fe79e9 also passed:
7,628 tests, zero failures, six workers, 334.77 seconds of Vitest and
490.60 seconds for the complete gate. Every local commit reached
origin. This qualifies the full suite without claiming the still-open
two-minute push target. The exact-SHA boot smoke is a separate proof.

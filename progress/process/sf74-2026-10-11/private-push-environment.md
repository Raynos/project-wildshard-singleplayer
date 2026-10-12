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
Actual private-index hooks run at landing; the next normal complete
gate remains the queue qualification.

The same leaked context left two regenerated shared-index entries on
the source parent while their disk bytes already matched c05198c46.
Only those exact parent-index/current-HEAD-byte entries were aligned;
no working content, foreign hunk, allowance or payload was restored.

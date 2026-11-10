# Keep a sparse pin commit sparse

Train run 42805463032 selected the reviewed engine source, then spent
275 seconds outside the commit lock. It published pin commit 50179df017
just before the unchanged five-minute job limit prevented its deploy
dispatch. That exact deploy was resumed normally as 42811514392. Its
WebKit proof passed; Chromium crossed the road and entered Ember, then
refused the real durable-save acknowledgement. Solo was not promoted.

A real filtered Git fixture identified the controller cost: clearing
skip-worktree on every private-index entry makes write-tree fetch the
excluded legacy assets. The private index has already reset those
unselected entries to HEAD. For an exact engine.pin.json-only commit
in an authoritative sparse checkout, preserve their metadata and clear
every flag on the named pin. Ordinary and multi-file commits keep the
existing full flag clearing. Hooks, object validation, declared-path
checks, peer stages and all time limits remain intact.

The manual scripts/commit-sparse-proof.py runs outside hooks. Six real
Git controls passed in 7.84 seconds: original behavior fetched 12/12
excluded blobs, the optimized pin fetched none, a real hook refusal
remained exit 17, and multi-file and non-sparse fallbacks kept their
full clearing. Named hidden pin bytes were committed; unselected peer
stages and loose bytes survived. A separately staged, hidden peer with
different loose bytes is refused by Git before hooks; the proof keeps
that existing safety refusal and verifies its data is untouched.

J206 review found no MUST. Its fallback and hidden-peer suggestions
are covered by those controls without teaching the wrapper to override
Git's refusal. The non-sparse control changes the effective worktree
configuration, rather than a common value shadowed by config.worktree.
The next changed-pin hosted controller still needs to prove the complete
five-minute path; no green controller or whole RT3 row is claimed here.

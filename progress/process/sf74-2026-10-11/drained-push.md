# W14: release a drained push before exporting

The pusher now checks origin/main..main before each clean export. Once
origin contains every local commit, it exits and releases its push lock.
A descendant arriving during a gate still enters the next round, with
its own regeneration and complete gate. The six-round limit and the
single latest-repair retry budget are unchanged.

Two real isolated Git fixtures reproduce the old redundant work: an
already-delivered tree regenerates once; two gated uploads regenerate
three times. Before the fix both assertions failed (2.86 seconds wall).
Afterward all 14 focused green-prefix tests pass (9.27 seconds wall),
including the existing exact red/retry cases and both new fixtures.
Idle regeneration is zero; the two arriving commits regenerate and gate
exactly twice and reach the owned bare remote. These fixture times do
not measure production bake cost or prove the two-minute push target.

Root strict, touched typed lint, Bash syntax and whitespace checks pass.
Landing uses the actual private-index hooks. The next normal pusher run
supplies the shared-machine wall-time receipt; no gate is skipped for
any unpushed commit.

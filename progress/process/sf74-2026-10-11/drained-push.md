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
Landing uses the actual private-index hooks. The normal pusher on
2026-10-12 ran from 02:26:31 to 02:30:45 UTC (254 seconds): it regenerated
fc3eab08b as 81640d17c, gated that exact SHA in 199.55 seconds, and pushed
all seven pending commits. Its next round printed "origin/main has every
local commit" and exited without another export. The queue was drained,
with no gate skipped for an unpushed commit. This measured complete push
still exceeds the two-minute target; no historical before/after wall
comparison is claimed.

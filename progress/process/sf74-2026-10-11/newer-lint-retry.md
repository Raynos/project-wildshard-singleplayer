# W25: retry a committed lint repair during prefix search

Exact 7226d4e07 failed only lint at 23:07:46 UTC. Its defining commit
was dd61a915c; repair 321a8043f landed at 23:08:32 UTC during the
historical prefix search. The pusher spent another 642 seconds probing,
checking freshness and gating a historical prefix before releasing the
lock at 23:18:28 UTC. The repair passed the next complete gate on
441bb32b8. This is an observed delay, not a measured future saving.

A single lint-only red may now earn the same one fresh-main retry as a
named Vitest failure. Every lint diagnostic must use the gate's exact
plain file/line/column error format. Unknown output, mixed failures,
working edits, unrelated changes, added/deleted paths, unsafe paths and
unrelated histories refuse. The reader checks both before prefix search
and after probing, before spending a historical gate. Both points share
one retry budget and compare against the original failed tip.

The retry still regenerates the exact newest committed tree and runs
its complete gate. No edit supplies a green proof. A second red follows
the ordinary prefix/refusal path; the six-round bound is unchanged.

Twelve focused fixtures passed in 11.99 seconds, including six actual
push loops against owned temporary bare remotes. These prove early and
late lint repairs, successful gated pushes and refusal of a second
retry. Root strict, scoped JavaScript strict, touched typed lint and
Bash syntax passed. No production speed or one-day target is claimed.

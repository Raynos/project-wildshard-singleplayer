# W25: retry a committed test repair before prefix search

The old map-red push spent 809 seconds on regeneration, the complete
492-second gate and historical-prefix probes. The owner's test repairs
had landed while that old tip ran; three historical regeneration checks
then refused stale outputs instead of delivering the repair.

The pusher now permits one fresh-main retry before prefix search when
only Vitest failed and a committed descendant modifies a named failing
test. It regenerates latest main and runs the complete gate again. The
test edit supplies no passing proof. Working edits, unrelated commits,
added/deleted tests, mixed failures and divergent histories refuse this
retry; a second red follows the ordinary prefix/refusal path. The
existing six-round bound, exact regenerated pin and every gate remain.

Eight focused fixtures pass in 3.32 seconds. Two run the actual push
loop with the real candidate reader and an owned temporary bare remote:
a fresh green pushes only after regeneration and the second gate; a
second red stops without pushing, even when another repair lands.
Candidate fixtures inspect real committed bytes and refuse working
edits, deletion, mixed failures, missing refs and divergent history.
Root strict, scoped JavaScript strict, touched typed lint and Bash
syntax pass. This is orchestration proof, not a production speed claim.

Mixed bake/source-freshness reds still use the existing owner-rebake and
prefix path. Stale historical regeneration remains an open W25 tail.

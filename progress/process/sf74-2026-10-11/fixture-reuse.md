# W12/W24 upkeep: isolated regeneration fixtures

The measured generated-workflow file is one of the Linux top ten
(66.308 seconds on exact 82b919f09). Its common fixture repeatedly
copies tooling, computes the same initial counts and creates two
baseline commits. The candidate computes that baseline once, then
uses independent complete Git clones without hard-linked objects.
Dependencies are linked anew to each clone's own workspace sources.
Each clone is removed in its existing finally block; the common seed
is removed in afterAll. No application export is retained.

A new real-process isolation probe fails before the repair with
GIT_CONFIG_GLOBAL=/dev/null: fourteen dependency symlinks are tracked.
The original fixture relies on the personal Mac ignore file, which
Linux lacks. An explicit committed fixture .gitignore now excludes
node_modules at every depth. The probe also stages source and a new
document in one clone, then proves the next clone has original source,
no foreign document, an empty index, two original baseline commits and
workspace links resolving its own sources.

| Measurement | Before | After |
|---|---:|---:|
| Complete focused wall seconds | 17.59 | 15.67 |
| Passing tests | 13 | 14 |
| Retained thirteen cases, summed test seconds | 16.256 | 13.290 |
| New isolation check, seconds | absent | 0.889 |

Both runs use nice -n 10 and the existing six-worker local cap, with no
active push or foreign quiet. Before retains personal Git config;
after disables it. Host/cache state and the additional case differ,
so this is not a controlled causal speed claim. The existing thirteen
cases and all assertions are retained. Real generation, re-recording,
changed-payload refusal, exact outcome verification, stale-source
refusal, policy refusal, staged isolation and attribution checks still
execute in each scenario; their outputs are not shared or cached.

The new Linux-like probe passes along with all thirteen retained cases.
Scoped strict checking, touched type-aware lint and whitespace checks
pass. No timeout, witness, baseline acceptance, source policy, worker
setting or gate is changed. Exact Linux CI remains the backstop.
Compact per-case observations are in [fixture-reuse.json](fixture-reuse.json).

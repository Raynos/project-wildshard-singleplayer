# W16/W23: retain Linux per-file durations

Each Vitest CI shard uploads its existing results.json timing cache,
including the hidden .vite directory, as an exact workflow-SHA and
matrix-shard artifact for three days. The existing Vitest command
produces this cache; no extra test invocation is introduced.

The prior 441bb32b8 Linux job spread is 161–347 seconds including
preparation (2.16×). The committed 64f25a011 duration map predates
several W12 changes. Collect these new artifacts before refreshing
weights with scripts/vitest-durations.mjs; preserve each test once.

Workflow YAML and whitespace checks pass; actual private-index hooks ran.
Exact push CI 38193988948 on 8891780f1 passed all eight shard jobs and
uploaded all eight timing artifacts. Every artifact was downloaded;
the 1,489 unique project/file records contain no failing files. No
additional test invocation supplied this evidence. The measured weights
and phase-aware limitations are in linux-packing-889.md. Qualification
of that later weight change and the one-day targets remain open.

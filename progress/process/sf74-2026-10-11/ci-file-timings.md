# W16/W23: retain Linux per-file durations

Each Vitest CI shard uploads its existing results.json timing cache,
including the hidden .vite directory, as an exact workflow-SHA and
matrix-shard artifact for three days. The existing Vitest command
produces this cache; no extra test invocation is introduced.

The prior 441bb32b8 Linux job spread is 161–347 seconds including
preparation (2.16×). The committed 64f25a011 duration map predates
several W12 changes. Collect these new artifacts before refreshing
weights with scripts/vitest-durations.mjs; preserve each test once.

Workflow YAML parses and whitespace checks pass. Landing runs the actual
private-index pre-commit and commit-msg hooks. The next push CI supplies
the first artifact qualification; balance and one-day targets stay open.

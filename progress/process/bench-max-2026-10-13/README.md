# Bench-max: pre-commit timing, 2026-10-13 (sp-o68)

Jake's budget: **pre-commit ≤ 10 s, pre-push ≤ 2 min**. This receipt measures `.githooks/pre-commit` step by step
before and after the cut that landed with it. Each number is the median of 3 runs on the shared Mac (load average
8–15 of 18 cores from other lanes). Each run used a private index built from HEAD plus one edit, in a throwaway worktree:

- **docs**: `docs/README.md`
- **shard**: `src/shards/pine-hollow/plugin.ts`
- **shared**: `src/game/plugin/geometry.ts` (a physics input of several shards)
- **generator**: `src/shards/far-reach/generators/bake-sky-world.mjs`

## Before (97bd944c2): each step run alone, then the whole hook

| step | docs | shard | shared | generator |
|---|---|---|---|---|
| check-commit-index | 0.20 | 0.18 | 0.20 | 0.22 |
| precommit-inputs (serial) | 0.06 | 15.10 | 15.36 | 16.99 |
| precommit-generated | 0.08 | 0.09 | 0.08 | 0.09 |
| generation-removals | 0.21 | 0.23 | 0.22 | 0.24 |
| check-graph | 0.30 | 0.40 | 0.33 | 0.31 |
| asks check | 0.06 | 0.08 | 0.06 | 0.07 |
| precommit-guards | 0.16 | 8.82 | 7.25 | 6.45 |
| **whole hook** | **0.69** | **22.00** | **26.34** | **25.33** |

Where the time went, for a src commit:

- **precommit-inputs**: a `git archive` + `tar` of 0.9 GB took 3–6 s, then `gen.mjs` took 9–12 s:
  `genPortShares` 5–6 s, `writeApiDocs` 1.6 s, `generateBootTables` 0.9 s and `prepareGeneration` 0.7 s.
- **precommit-guards**: `shard-coupling --check` (a full TypeScript program) took 4 s. It started only after
  about 2.5 s of exports (the guard snapshot 1.5 s, the HEAD snapshot 0.7 s), and every guard waited for inputs.

## After: the whole hook, as the hook prints it

| step | docs | shard | shared | generator |
|---|---|---|---|---|
| check-commit-index | 0.25 | 0.25 | 0.23 | 0.21 |
| inputs (export / gen / save) | 0.05 | 7.57 (0.4 / 6.8 / 0.3) | 7.72 | 7.86 |
| guards (runs alongside inputs) | 0.16 | 8.73 | 8.99 | 8.71 |
| generated, removals, graph, asks (parallel, after inputs) | 0.34 | 0.45 | 0.44 | 0.40 |
| **whole hook** | **0.83** | **9.15** | **9.41** | **9.30** |

The worst single run was 11.3 s (shared, at load 15). On these four commits the hook went from **22–26 s to 9.2–9.4 s**.

## What changed (no check changed its meaning)

1. **A persistent staged export** (`<git-common-dir>/commit-export`). Git updates it in place with `read-tree -m -u`.
   Before each run, tracked files are refreshed and restored and untracked outputs are removed (`clean -fdx`), so the
   folder is exactly the staged tree minus art / progress / sources / ios / android / .claude. Any error triggers a
   full rebuild. A concurrent commit that finds it leased falls back to the old fresh archive. Export time went from
   3–6 s to 0.4 s.
2. **`gen.mjs --build-inputs`** skips `writeApiDocs`. Commit inputs keep only src/public outputs, and docs/api plus
   lint/api-surface.json were never saved, so this saves 1.6 s.
3. **`shardLines` memoizes** file probes, package targets and resolved edges within one measurement, and reuses each
   file's parse for the raw-shader count. The output is byte-identical (checked against the old version on the same
   tree), and the time fell from 7.0 s to 3.0 s.
4. **The guards start alongside inputs.** shard-coupling gets its own export of the pre-table tree and starts first,
   and HEAD's lint runs early. Then the guards wait for inputs' status file (G367) and overlay the only paths inputs
   may stage (`lint/ask-ids.json`, `lint/shard-words.generated.json`). Only after that do the staged lint and the list
   checks run. Any other difference reruns the whole guard on the final tree.
5. **The hook prints every step's time and its total.**

Same verdicts as the old hook, old and new run side by side: a commit that also changes the tables (overlay path)
passed; a cross-shard import failed; a failing generator failed; a `ctx.app` addition under the ceiling passed.
Tests `commit-inputs`, `shard-platform`, `arch-guards` and `precommit-archive` pass.

## Next cuts (handoff)

- The critical path is now inputs (gen ≈ 6.8 s under load) plus about 1 s of staged lint after the wait. In gen:
  `genPortShares` (≈ 3 s, almost all of it oxc parsing) could get a per-file parse cache keyed by blob hash;
  `generateBootTables` 0.9 s; `prepareGeneration` 0.7 s.
- The guards alone take about 6 s; shard-coupling is 4 s of `ts.createProgram` plus the checker.
- Not yet integrated: sp-x7's `scripts/precommit-bakes.mjs` (native / maps), which goes after inputs and before the
  index-reading checks, cached by input hash.
- Pre-push was not measured in this pass.

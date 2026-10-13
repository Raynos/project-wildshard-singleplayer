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

## Codex cache and bounded generation cut

Syntax facts cache by source, path, parser lock and analysis recipe; import resolution and
attribution still run fresh. Cold, warm, edited-source and corrupted-cache fixtures agree.
Independent producers overlap (four maximum), retaining catalogue order for every declared
read/write conflict. Every pinned output is still checked. Generation stages/jobs now print
timings; the hook reports its total on success and early refusal with fractional timestamps.

Metric work: 3.21 s uncached versus 1.05 s warm, with identical full output. Scratch-worktree
hooks: generator edit 7.67 s; shared edits 10.026 / 9.998 s at load 9.2; first cold controller
run 13.761 s. The 10 s cap remains OPEN; these are improvements, not full qualification.
36 focused tests, root strict and touched lint passed. Native/map producer integration and
the 120 s pre-push verdict remain open. No full suite or gameplay behavior changed.


## Staged native and continuation producers

Official native/map producers now run in the immutable staged export, followed by
King/witness freshness laws. Dependent generation runs again after native output
changes. Only declared output bytes enter the index; the complete tree and parent
bind their receipt. An idempotent retry retains the original receipt. Existing
build-input caches are reused only after every stored blob verifies.

Scratch hook: full native recovery 27.01 s before cuts, 16.17 s after warm producer
caches; exact-tree retry 7.35 s (load 8.3-9.4). Four native outputs and four witness
manifests refreshed; all gameplay payloads and recorded outcomes stayed exact.
The cold recovery remains over 10 s. Four focused tests, root strict, scoped JS
strict and touched lint pass, including staged/foreign isolation and failures.
The observed push gate was 18.35 s/120 s, refused by then-stale Template/Ink maps;
the official map repair is separate. No green timing credit is claimed for it.


## Final boot-table cache cut (sp-x5)

Commit-only boot generation now traces its defining modules and filesystem
reads before imports. A receipt binds source/resolution, Node/host/environment,
output inventory and every output byte. A miss invokes the same producer in
process; corruption, edits or failure cannot earn a hit. Ordinary builds keep
running the producer directly. No guard or native/witness law is skipped.

On the scratch worktree: one original boot-table run took 1.089 s; a traced
cold miss took 1.279 s; exact reuse took 0.539 s. One miss plus reuse is
1.818 s versus 2.177 s for two original runs. All 155 generated files and
packs remained byte-identical. Eleven focused tests, root strict, scoped JS
strict and touched lint passed; fixtures include untraced calls, source/input
changes, output/inventory corruption, damaged receipts and repeated failure.

CALL: keep this cache commit-only and reuse only verified bytes; do not bypass
real cold native or continuation proofs to meet the stopwatch. Warm complete
hooks are below 10 s (sp-x7: 2.177 s); the complete cold-hook cap remains OPEN.
No new pre-push timing credit is claimed. sp-x5 parks after this cut.


## Final-table guard overlap (G384)

A fresh test-edit hook measured 11.61 s: inputs 11.047 s, generation
4.174 s, producers 5.992 s (scoped ratchet 4.822 s), at f17105083.
A generated ratchet reduction previously restarted the complete source guard.
The guard can now overlay final reduced counters and script liveness, retaining
its source analysis. Final lint/list checks still read the final bytes. Policy
changes, count increases, malformed data and native/source changes retain the
full final-tree path. An actual-index fixture proves the overlay and continued
hard-rule refusal; narrowed gate types and touched lint are green.

CALL: reuse only source-independent final tables with identical policy and
shrinking integer counts. Never overlay native geometry or source. The 10 s
cold cap remains open pending the producer census cut owned by sp-x7.


## Parallel guard data publication

A cold source hook refused before generation because a new staged JSON pin was
not yet present in the working tree. Guards now read exact hash-verified commit
blobs; a first-use missing pin waits for successful producer publication and
then verifies again. Corrupt, missing or invalid JSON still refuses. Neither
working source nor unpinned executable code can supplement the staged export.
Seven focused checks, including a real asynchronous producer/guard fixture,
narrowed gate types and touched lint pass. The refused 19.77 s source run earns
no timing credit; the test-input cold run passes in 6.22 s on 713cad033.
CALL: verified content-addressed outputs are authoritative; absent evidence
waits for the writer, never falls back to guessed data.

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


## Per-file Debug facts (G384, sp-x7 ownership release)

Each completed file inventory caches by source bytes/path, parser/helper/lock
and Node/V8/host metadata. Files are enumerated fresh; additions, deletions,
corruption and opaque AST remain checked. Undefined metadata fields survive
exactly. The complete-census receipt and current ceiling checks remain intact;
full CI still parses uncached. No failed file publishes facts.

Complete 18-row inventory: 5.663 s uncached, 5.993 s first fill, 0.213 s
verified reuse, with exact object equality. A changed source parsed one file
and reused 3,731. 114 focused checks, narrowed gate types and lint pass.
The source hook remains OPEN at 17.56 s: generation 8.348 s, measurements
3.682 s, final guards 17.37 s including their wait. Pine cabins, Nalati bodies,
Sky rigs and Signal sand still declare whole engine/game/SDK trees, so an
engine UI edit rebuilds all four under the existing input contract.
CALL: keep every declared generation input and every fresh policy check;
reuse only parsed facts, never treat cached counts as permission.


## Concurrent staged source lint (sp-x5)

Staged lint now starts beside generation. A final vocabulary change settles
the old reader and runs lint again; source/native/policy changes still rerun
the complete guard. Counter reductions retain the exact source diagnostics.
Three real-index fixtures pass, including a newly forbidden word introduced
only after the first lint completed. Narrowed types and touched lint pass.

Source lint took 3.57 s inside the producer wait instead of after it. The
scratch source-edit hook took 22.91 s: export 4.99, gen 8.79, bakes 6.71,
save 0.46 s. The persistent export was occupied, so this run used the full
archive fallback. Previous source hooks were 17.56 s with a free export;
these totals are not a matched speedup. The 10 s cold cap remains OPEN.
A speculative census warmer was tested privately and discarded.


## Isolated producer environment (sp-x5)

Official producer children no longer inherit the caller's Git index, Git
checkout or hook intent/status transport. The caller retains those values
for exact staged publication. Preview/provenance and all ordinary producer
environment variables remain. The all-environment boot cache key is unchanged.
An isolated-process fixture supplies a private index and foreign Git prefix;
the producer refuses any leaked transport and still emits the staged bytes.
The caller's default index and foreign working bytes remain untouched.

Two distinct test edits/private indexes passed in 6.62 and 6.39 s. Their
boot-table steps still took 1.62 and 1.86 s; this is no cache-hit or cold
10 s qualification. The shared boot receipt is currently a single file,
so unrelated producer contexts can replace each other's reusable evidence.


## Restorable boot receipts (sp-x5)

Receipts are partitioned by the complete actual producer environment and
host. Shell transport is absent from the child environment. Missing
untracked outputs restore from the existing verified SHA-256 blob pool,
then every recorded input and inventory must match. Existing modified
outputs run the producer. Failed verification removes only restored files
and newly created empty directories before the actual producer runs.
No source file or present output is overwritten by cache restoration.

Four focused fixtures, narrowed types and touched lint pass. They cover
independent contexts, missing output directories, corrupt blobs, corrupt
receipts/outputs, changed sources/inventories and repeated failure.
The real scratch hook restored all 111 boot outputs exactly: boot work
2.397 -> 1.315 s; whole hook 8.85 -> 6.96 s (cold fill vs verified reuse).
A source-edit cold run remains 13.83 s: export0.412/gen7.710/bakes3.984/
save0.554. Its scoped measurement alone takes3.732 s. The 10 s cold cap
and a green 120 s push qualification remain OPEN. No full suite was run.


## Scoped HTML type checking (sp-x5)

A CPU profile attributes3.23 s of scoped measurement to the linter child,
which constructs the HTML guard's TypeScript program. Scoped hooks now
name their actual source roots. Discovery retains the original candidate
graph's globals, merge files and module augmentations, including those
imported only by an unselected candidate. Only the selected/imported
modules need the final checker. Full CI keeps its original root set.
Every sink, alias, data-flow and policy decision is unchanged.

40 HTML tests pass, with exact full/scoped diagnostics and transitive
augmentation/import/global fixtures; 112 ratchet checks and the staged
source/vocabulary fixtures pass. Narrowed types and touched lint pass.
Actual linter ABBA: full3.112/2.937 s, scoped2.565/2.572 s; all three
existing diagnostics agree field-for-field. Median3.024 ->2.568 s.
The cold-source hook remains above10 s; this is a bounded0.456 s cut,
not qualification. Four broad generation jobs still recapture for an
unrelated engine source edit. Their declared input contracts stay intact.

## Required final guard (sp-x5, 2026-10-13)

CALL: coordinator approved skipping duplicate hard rules only during
commit-scoped measurement, with an actual mandatory final architecture
guard, extension-complete coverage, refusal fixtures and unchanged full CI.
The guard publishes its live PID, original tree/parent, staged source hashes
and exact runner/config/guard definitions. Measurement validates those bytes.
The hook waits for the actual guard and verifies its success receipt against
the final index tree and parent. Missing, failed, stale or skipped guards
refuse credit. `SKIP_ARCH_GUARDS` retains the original full measurement.
The full/standalone ratchet CLI continues checking every configured rule.

The indexed guard now covers JS, JSX, MJS, CJS, TS, TSX, MTS and CTS. The
aggregate negative fixture requires all 25 current hard-rule refusals,
including files the old extension filter omitted. It also proves full
measurement still refuses with the guard skipped. A script-only initial
scope waits for production and checks newly produced source before success.
Corrupt receipts, changed source/config/scope/parent, missing success and
later index edits refuse. Existing 13 staged-isolation fixtures pass.

| Actual source hook | Total | Export | Generation | Producers | Save |
|---|---:|---:|---:|---:|---:|
| Full measurement, generation miss | 15.22 s | 0.428 s | 8.371 s | 4.578 s | 0.448 s |
| Required guard, generation hit | 10.24 s | 0.321 s | 0.562 s | 0.975 s | 0.470 s |
| Required guard, unique cold source, busy export fallback | 21.39 s | 5.130 s | 8.066 s | 4.351 s | 0.664 s |

These totals have different cache/lease states, so they are **not a matched
cold-path speedup**. The serial scoped measurement itself fell from 4.234 s
to 0.600 s. Every hook passed, including final-tree guard verification.
**Cold pre-commit <=10 s remains OPEN; green pre-push <=120 s unqualified.**
No full suite, build, browser, Simulator, cap or policy change accompanied
this cut. All hook runs used an isolated worktree and private index.

## Bounded concurrent export reuse (sp-x5, 2026-10-13)

CALL: use at most two independently leased persistent exports. The second
uses the original full tracked-file verification, untracked cleanup and
exact-tree check; a live lease is never read or modified. Both occupied
still use an isolated fresh archive, with no waiting or check exemption.
The fixture proves live-owner isolation, dirty tracked/untracked repair,
exact staged generation and the both-held fallback. Producer failure and
foreign-working-byte tests remain unchanged and pass.

The actual hook ran in a separate Git store on source `8eb9200c0`, with
its primary lease held by the benchmark only. Each measured input was a
new source edit; generation missed in both runs. No shared lease or source
file was touched. After filling the reusable slots:

| Primary occupied | Total | Export | Generation | Producers | Save |
|---|---:|---:|---:|---:|---:|
| One slot: fresh archive | 13.98 s | 4.389 s | 5.851 s | 1.132 s | 0.364 s |
| Two slots: verified reuse | 8.23 s | 0.314 s | 5.289 s | 0.871 s | 0.448 s |

**This cold-source path passes 10 s.** First use of the second slot was
11.84 s (export 2.787 s); an entirely empty isolated cache was 28.69 s.
Those first-fill cases and both-held fallback remain **OPEN**, so this is
not an unconditional pre-commit or pre-push qualification. No numerical
limit, guard, producer or receipt was weakened.

## Single Debug syntax walk (sp-x5)

CALL: collect syntax once, then evaluate declarations in the original order.
Every eligible file still parses; opaque arrays, unresolved rows and syntax
errors still refuse. Import aliases and late definitions resolve over the
whole program. No producer sequencing, API or policy changes.

The same full corpus (3,741 files, 16 rows) took **5.760 -> 2.919 s** without
fact-cache hits. Its ordered JSON SHA-256 was identical:
`ff974a3b1d5e3a76ad4af32f39817853f5cd5c82487ff5d37fa9eb7d720c809e`.
Eight focused checks, narrowed types and touched lint passed, including
late aliases/definitions, original row order and first-error precedence.

Fresh private-cache hooks on `2ff13ce6f` remained **38.94 / 38.37 s**.
Measured debt producer fell **12.671 -> 4.763 s**, while export/gen costs
rose (2.142/11.619 -> 5.445/15.150 s) under concurrent machine work.
These are observations, not an end-to-end qualification. Cold <=10 s stays
OPEN; generation, first export and the final source guard remain targets.

# Lint and typecheck speed: mini plan (TOOLING-PERF)

**State:** `in flight` (2026-10-28) — checked source landed; measured misses remain open. LS7: sp-x6; LS9: sp-x9. Owner: Codex (non-visual tooling). Follows the archived
[oxlint](../../../project/archive/2026-10-27-oxlint.md) and [TypeScript](../../../project/archive/2026-10-27-typescript-speed.md)
speed plans; nothing here re-opens their rows.

## Summary

1. Fast lint's 7.8 s is **~7 s of one JS thread** (our `wildshard/*` plugin plus oxlint handing it each AST). The 397
   native rules take **0.66 s**, so threads 2 → 8 save only 2 s. Running 4 oxlint processes gives 3.8 s.
2. The expensive rules are `wildshard/no-authored-html` (2.0 s, re-parses other files) and the guard `layer` (1.3 s,
   0.9 s of it import-closure walks). Both get cheaper with caches, and neither is switched off.
3. Typed lint: `typescript/no-unsafe-assignment` costs 2.3 s wall and 8 s CPU. The other four `no-unsafe-*` rules
   already flag every use of an `any`. Nothing else typed is worth dropping (11 style rules off = 0 s).
4. TypeScript is already lean: layers 4.8 s uncached, root 2.9 s, warm 0.26 s. The wins are one `tsc -b` for
   everything, and declaration companions for the multi-MB committed JSON files that tsc types in full.
5. CI: replace the 7 `typecheck-lint` jobs (691 runner-s, of which only 141 s is work; checkout takes 40–98 s
   per job) with **one job**: typecheck and full typed lint, and no fast-lint step, because typed lint already
   covers it.

## Measured (Mac, 18 cores, load 8–17, ±20 %; HEAD f43f3adba3 + peers' live edits)

| What | Today | Expected after |
|---|---|---|
| Fast lint, whole repo (7,451 files) | 7.8 s @8 · 8.6 @4 · 9.8 @2 threads; 16 s CPU, 3.9 GB | **≤ 2.5 s** (LS2–LS4) |
| · same, no JS plugin | 0.66 s / 4 s CPU / 0.75 GB | — |
| · 4 processes × 2 threads / 8 × 1 | 3.8 s / 3.75 s | — |
| Typed lint, no JS plugin (GOMAXPROCS 4) | 12.6 s / 49 s CPU / 5.1 GB; program floor 3.8 s | ~10 s (LS5) |
| Typed lint, full (`lint-all --type-aware`) | 19.8 s / 62 s CPU / 5.5 GB | **~14 s** |
| `tsc -b` layers `--force` (builders 1/4/8 alike) | 4.7–4.9 s / 25 s CPU; warm 0.26 s | ~4 s (LS7) |
| Root `--noEmit` | 2.9 s, 6,255 files, 2.8 GB | ~2.3 s (LS7) |
| Whole typecheck, 8 commands | 11.1 s uncached / 4.6 s warm | **≤ 8 s / ≤ 1 s**, 1 command (LS6) |
| CI `typecheck-lint` | 7 jobs, slowest 136 s, 691 runner-s | **1 job ≤ 120 s, ~120 runner-s** (LS8) |

## Where the time goes

- **JS thread profile (9.3 s):** oxlint AST transfer/walk 3.1 s, `node:path` (`pathOf`/`modulePath` per node) 1.05 s,
  `syntax-values` cross-file graph 1.1 s, `oxc-parser` re-parses 0.86 s, `commons-closure` 0.9 s.
- **Native rules** 3.0 s CPU in total: `import/no-cycle` 0.69 s (23 %), `no-warning-comments` 0.10 s, the rest below
  0.06 s each. None is worth dropping for speed. The `import` plugin's module graph costs 2.5 GB RSS.
- **Typed rule times overlap:** the first rule to ask for a type pays for it. `no-misused-promises` shows 10.3 s, but
  switching it off saves 0.4 s, so only toggles count.
- **TS root program:** 2,246 layer `.d.ts`, 1,411 tests (`test/` only, so no checking twice), 391 fixtures, 1,400 lib
  files (537 `@types/three`, 491 `happy-dom`), 428 JSON (14.4 MB; three nalati fixtures alone are 3.7 MB).
  `skipLibCheck` is on everywhere. It resolves `zod` from `/Users/raynos/node_modules`, outside the repo (a leak).
- **TS shards project** is the slowest layer (1.6 s, 4,435 files): it types 12.9 MB of JSON, including 5.4 MB of
  legacy `runtime/physics.baked.json`. Engine 0.94 s, format 0.86, game 0.82, the other projects ≤ 0.4.

## The expensive rules (top 10)

| # | Rule | Cost (measured) | Catches | Verdict |
|---|---|---|---|---|
| 1 | `typescript/no-unsafe-assignment` | −2.3 s wall, −8 s CPU off | `any` stored into a variable | **dumb here**: argument/call/member-access/return catch every use; `.mjs` has it off already |
| 2 | `wildshard/no-authored-html` | 2.0 s JS; −1.2 s wall off | shardfile text reaching innerHTML (SF58) | keep, **make cheap**: build the graph only when the AST saw an HTML sink; cache parsed modules |
| 3 | `wildshard/layer` (guard) | 1.26 s JS | layer direction (E405) | keep; memoise `runtimeCommonsClosure` per target (0.93 s) |
| 4 | `typescript/no-misused-promises` | 10.3 s shown, −0.4 s off | async callbacks where void is expected | essential |
| 5 | `typescript/no-floating-promises` | 5.4 s shown | unawaited promises | essential |
| 6 | `typescript/no-unsafe-return` / `-argument` / `-member-access` | 2.0 / 0.9 / 0.9 s shown; family −0.2 s more | `any` leaking out | keep (cheap once #1 is gone) |
| 7 | `wildshard/runtime-performance` | 0.39 s JS | runtime frame budget (SF62) | keep; cache the frozen-legacy index per digest |
| 8 | `wildshard/sim-no-render` | 0.34 s JS | sim closure reaching render (SF3a) | keep; memoise the closure per module |
| 9 | `import/no-cycle` | 0.69 s CPU, ~0.1 s wall, 2.5 GB | runtime import cycles | keep |
| 10 | `typescript/no-deprecated` | 1.1 s shown, ~0 off | deprecated APIs | keep |

The guards (`layer`, `public-index`, `engine-words`, `shard-names`, `shard-sandbox`, `no-level-identity`,
`no-shard-branch`, `no-raw-*`, `no-reexport`, `no-url-switch`) all stay on; `no-url-switch` 0.16 s, `no-shard-branch`
0.16 s, `engine-words` 0.05 s and `shard-names` 0.09 s are already cheap. A per-file `pathOf` cache helps every one of them.

## Rows

| Row | What | Owner (Codex: non-visual tooling) | Size | Done when |
|---|---|---|---|---|
| LS1 | `fastLint` and the staged ratchet in `scripts/precommit-checks.mjs`: `--threads=2` → `min(8, cores)` | **done** (sp-x10): native workers bounded at 8; full fast lint 9.442 → 7.361 s; 5 controls, scripts/root types and typed lint pass | S | full `lint-fast` ≤ 7.8 s (from 9.8) |
| LS2 | `lint-fast.mjs` with no paths (whole repo, the `.push-tracked.json` snapshot): 4 oxlint processes × 2 threads on file partitions, diagnostics merged; same diagnostics as one process on HEAD | **open** (sp-x10): four bounded workers landed; ordinary full run 7.361 → 5.013 s green (still over 4 s); exact single/partitioned native diagnostics match, refusal/drain controls pass | S | whole-repo fast lint ≤ 4 s |
| LS3 | Plugin: one `pathOf`/`modulePath` cache per filename; memoise `runtimeCommonsClosure`, `simClosure` and the frozen runtime-performance index across files (module-level `Map`s); no rule off | **open** (sp-x10): cached paths, observed closure verdicts and frozen digest indexes landed; visitor total 5.130 → 4.681 s, fast lint 5.013 → 4.598 s; 8 cache/mutation/original controls pass, timing bars still miss | M | JS-thread visitor total ≤ 3.5 s (from 6.1) with the timing wrapper; fast lint ≤ 3 s |
| LS4 | `no-authored-html`: build `authoredHtmlSites` only when the visitors saw a sink (`html` flag) and share the `syntax-values` parse cache across files; fixture tests unchanged | **open** (sp-x10): AST sink prefilter and shared current-byte parse cache landed; HTML visitor 1.732 → 1.079 s, full fast 4.598 → 4.378 s (foreign test reds); 41 original/parity controls pass; timing bars miss | M | rule ≤ 0.4 s JS; fast lint ≤ 2.5 s |
| LS5 | Drop `typescript/no-unsafe-assignment` (0 violations on HEAD, so nothing to burn down); add a one-line reason to the off list | **open** (sp-x10): approved redundant assignment rule off; native typed 12.341 → 11.311 s, full typed 23.812 → 18.679 s, both green; 6 original strictness/type controls pass, timing bars still miss | S | typed lint without the plugin ≤ 10.5 s; full typed ≤ 17 s |
| LS6 | One TypeScript solution: the root becomes `test/tsconfig.json` (composite, incremental) and it plus the 6 tool projects join `tsconfig.layers.json`; `pnpm typecheck` and CI run one `tsc -b`; pin `zod` in the repo | **landed, partial** (sp-x10; `34f3cebd2c`): one strict incremental solution, repo-local Zod and all 34 scenario tool roots share one owner; **9.28 s cold / 0.23 s warm** versus **8 s / 1 s**. Warm and one-process bars pass; cold misses. After the tree became clean, one/four builders measured 8.63/8.52 s, two/eight 10.70/14.23 s; single-threaded 23.88 s versus default 8.71 s. All green; keep one builder, no scheduler gain claimed. Full forced/warm types, 11 focused controls, typed lint and scoped ratchet pass | M | uncached ≤ 8 s (from 11.1), warm ≤ 1 s, 1 process |
| LS7 | `.d.json.ts` companions (allowArbitraryExtensions is already on) for committed (non-generated) JSON > 256 KB: 3 legacy `physics.baked.json`, `physicsRows.json`, the nalati fixtures, `signAtlas.json` | **landed, partial** (`aee6ed002e`, sp-x6): 14 exact mutable compiler-derived companions; 8 raw inputs stay original: `public/assets/nine-dragon/authored/sign-atlas/signAtlas.json`; `src/shards/driftwood-isle-legacy/runtime/physics.baked.json`; `src/shards/far-reach-legacy/runtime/physics.baked.json`; `src/shards/nalati-grasslands-legacy/runtime/physics.baked.json`; `src/shards/pine-hollow-legacy/runtime/physics.baked.json`; `src/shards/nine-dragon-stack/data/lookGraphs.json`; `src/shards/pine-hollow/data/physicsRows.json`; `test/fixtures/nalati-places-original.json`. Current shared-tree shards **1.921 s**, root **3.151 s**; both bars still miss | M | shards project ≤ 1.1 s, root ≤ 2.3 s |
| LS8 | CI: one `typecheck-lint` job, no matrix: LS6's `tsc -b` alongside unsharded `lint:typed` (`--threads=4` on the 4-vCPU runner), joined with `wait`; delete the `fast` shard and `--shard` support in `lint-all.mjs` | **landed, partial** (sp-x10; `8d0c752b02`): one complete concurrent job; actual green CI `40820763810` / job `123274744653` on `a3bc0e338f` took **128 s wall / 128 runner-s**, including 33 s checkout and 73 s type/lint step. Runner use falls from 7 jobs / 543 runner-s (max 88 s, `40801902717`) to one job / 128 runner-s; **≤130 runner-s passes, ≤120 s wall misses by 8 s**. Local serial 30.509 → combined 23.614 s; 10 focused +18 CI-wrapper controls pass | S | job ≤ 120 s wall (slowest today 136 s), ≤ 130 runner-s per push (from 691) |
| LS9 | Optional, after LS8: checkout is 40–98 s of every job. Time `fetch-depth: 1` without `filter: blob:none` | **done (measurement closed, no gain; settings kept, 2026-10-29, sp-x9).** Existing35 real checkout steps15–67s, median31s/sum1100s (run40813616234; post-cleanups excluded). Actual unfiltered depth-one trials on40819153233: checkout **81/82/119s**, with unchanged sparse restoration **86.442/86.243/121.853s**, median86.442s. All3 jobs pass exact same SHA/index digest,14139 present/15161 skipped paths, clean index/worktree and no promisor/filter settings. Every sample misses≤20s; retain current `blob:none`/sparse policy. checkoutv4 auto-enables filtering with sparse input, so removing only `filter` is a no-op. Temporary manual workflow9f9829765f is removed in the verdict commit; LS8 untouched. | S | checkout ≤ 20 s |

## One job for all three?

Yes. CI's fast lint checks a subset of typed lint: the same `.oxlintrc.json`, its native rules and the JS plugin,
minus types and directive checks. So the merged job runs only typecheck and typed lint, in parallel. That is ~60 s of
setup + max(25 s tsc, ~40 s typed lint on 4 vCPU, est.) ≈ 105–120 s on one runner instead of 7. Fast lint stays local,
for pre-commit and the push gate (~1.3 s on changed files).

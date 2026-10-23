# TypeScript speed: mini plan (TOOLING-PERF, G634/G643/G644/G645)

**State:** `open` 2026-10-23 — **to the builder (G647)**; D1–D3 build on the recommended option until Jake picks. Benchmark by a plan-agent subagent. Its own plan, separate
from [TOOLING-PERF](../TOOLING-PERF.md) and the [oxlint plan](oxlint-mini-plan.md) (Jake, 2026-10-23: *"three different mini
plans. Don't merge them"*). Five-minute rows went to the builder as [typescript-quick-wins-mini-plan.md](typescript-quick-wins-mini-plan.md) (G646).

Goal (Jake): a full TypeScript check of the whole repo before push, warm in seconds (*"a warm full-type check taking seconds is fantastic"*).

## What runs today

- `tsc` is **TS 7.0.2 (Go)**; typed lint is `oxlint-tsgolint` 7.0.2002 (Go, no cache). `tsc6` (6.0.2) exists only for the lint
  scripts' JS API. Switching compilers is not the fix.
- CI `typecheck-lint`: `tsc --noEmit` on the root `tsconfig.json` (src + test, no incremental), then `tsc -b tsconfig.layers.json`
  (six composite layer projects, which check all of src **a second time**), then six small projects (api, scripts, drafts,
  drafts/tools, admin, admin/tools).
- Push gate: no full typecheck, only `oxlint --type-check` on files pre-commit deferred. Pre-commit: oxlint on staged files, soft 5 s cap.
- `scripts/lint-all.mjs` starts a new oxlint per 256 files (~29 per full run), each rebuilding the program (unmeasured).

## Benchmarks (4356c6f8f0, mirror slot, load ~30, ±30 %; wall s / peak GB)

| Run | Cold | Warm, no change | Engine API edit | Shard edit |
|---|---|---|---|---|
| Root `--noEmit` | 62.6 / 10.2 | 75.7 (no cache) | – | – |
| Root `--incremental` | 107.7 / 8.5 | **7.5 / 3.3** | 64.5 / 10.1 | 48.9 / 10.2 |
| `tsc -b` layers | 58.8 / 8.0, exits 2 | 9.1 / 3.5 | 59.6 | 33.5 |

- A comment-only engine edit under `--incremental` still took 68.8 s; reverting an edit ~3 s.
- Checkers: 1 → 83.9 s / 6.25 GB; 8 → 25.0 s / 13.6 GB (default 4).
- Parse-only (no check): 3.5 s / 3.4 GB. scripts project 7 s, admin/tools 10 s, the rest < 1 s. `pnpm gen` 134 s (775 s cold slot).

| Variant (root program) | Wall s | Peak GB |
|---|---|---|
| Today | 62.6 | 10.2 |
| No tests | 45 | 7.4 |
| No JSON at all (2,887 errors, a floor) | 28 | 5.7 |
| Summarised `.d.json.ts` for the 249 generated JSON | 50 | 6.6 |
| Same, incremental warm | 5.2 | 2.0 |
| Same, incremental after an engine API edit | 78.6 | 6.8 |

## Why it is slow and heavy

1. **JSON as source.** 275 MB of the 331 MB program is JSON; 250 MB is 249 generated files. Files importing JSON take 57 % of
   check time; the 434 importing generated JSON take 49 %. Worst file: `test/pine-floor-product.test.ts`, 8.4 s on an 11 MB JSON.
2. **Four checkers, four copies.** Each TS 7 checker builds its own types (11.8 M types with 4 vs 4.8 M with 1), so big JSON
   types are paid four times.
3. **Tests:** 1,231 files, ~2.8 GB.
4. **src checked twice** in CI (root + layers).
5. **Inferred valibot types:** 761 `Infer` sites; the format layer emits 14 MB of `.d.ts` from 1.6 MB of source
   (`clientPlan.ts` 12 KB → 1.09 MB). Causes the 7 TS2589 errors (in `-b` only, every run, at HEAD).
6. **Incremental doesn't help edits:** a hub-file edit re-checks nearly everything; it only wins when nothing changed.

## Generated JSON out of the program (G643)

- **Blocker:** with `resolveJsonModule` on, TS 7 reads the real file and ignores a `declare module '*.generated.json'` wildcard.
- With it off the wildcard works (generated imports become `unknown`), but all 1,202 checked-in JSON imports (900 files) then
  fail with TS2732 unless a `*.json` wildcard makes them `unknown` too.
- Sites to parse: 445 static generated-JSON imports in 195 src files (~189 in `src/shards/*/generators/`; 0 in legacy, 1 in
  Nalati runtime), 378 in 240 test files, 14 dynamic imports. Generators read JSON at run time (`readFileSync` + valibot).
- Expected: ~6 GB and 30–45 s cold.

## Rows

| Row | What | Expected | Size | Done when |
|---|---|---|---|---|
| T1 | Generated JSON out of the program: `resolveJsonModule` off, `*.json` → `unknown`, valibot parse at each site (generators read at run time) | −4 GB, −15–30 s | M | root program ≤ 6 GB, green |
| T2 | Check src once: layers `-b` is the only src check; the root re-check goes | −60 s CI | S–M | CI Typecheck step < 1 min |
| T3 | **Tests next to their source (G645):** unit and integration tests move into their layer's workspace (next to the file or in the layer), checked by that layer's project; only regression, end-to-end and scenario tests stay in a separate test project referencing the layers | warm per-layer checks; tests stop being one 2.8 GB lump | M–L | no unit test under `test/`; every layer project includes its tests |
| T4 | Explicit types on exported valibot schemas, format first, then `isolatedDeclarations` per layer (G644; engine 786 sites) | fixes TS2589, format `.d.ts` 14 MB → < 2 MB, cheaper `-b` edits | L | no TS2589; `isolatedDeclarations` on in engine, then the others |
| T5 | Pre-push full check: `tsc -b` with a persistent tsbuildinfo (fixed slot, or the cache copied into the push tree; paths are relative) | 1–5 s no change, ~15 s shard edit after T1–T3 | M | the gate runs the full check within 45 s; over-budget (engine API edit) falls back to CI (D2) |
| T6 | Mac only, after T1: `--checkers 8` | 62 → 25 s, +3.4 GB | S | measured after T1 |

## Decisions for Jake

1. **D1 Checked-in JSON:** `resolveJsonModule` off and **all** JSON `unknown`, parsed with valibot at the boundary (recommended) /
   rename generated outputs so TS never resolves them.
2. **D2 Engine-API edit over 45 s:** the push gate skips the full check and leaves it to CI (recommended) / block the push.
3. **D3 Explicit schema types as a lint rule** in the format layer (recommended) / convention only.

Not measured: incremental with declaration output; the oxlint rows (see the oxlint plan).

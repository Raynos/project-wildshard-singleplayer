# TypeScript speed: mini plan (TOOLING-PERF, G634/G643/G644/G645)

**State:** `open` 2026-10-23 — **to the builder (G647)**; D1–D3 build on the recommended option until Jake picks. Benchmark by a plan-agent subagent. Its own plan, separate
from [TOOLING-PERF](../TOOLING-PERF.md) and the [oxlint plan](oxlint-mini-plan.md) (Jake, 2026-10-23: *"three different mini
plans. Don't merge them"*). Five-minute rows went to the builder as [typescript-quick-wins-mini-plan.md](typescript-quick-wins-mini-plan.md) (G646).

Goal (Jake): a full TypeScript check of the whole repo before push, warm in seconds (*"a warm full-type check taking seconds is fantastic"*).

## What runs today

- `tsc` is **TS 7.0.2 (Go)**; typed lint is `oxlint-tsgolint` 7.0.2002 (Go, no cache). `tsc6` (6.0.2) exists only for the lint
  scripts' JS API. Switching compilers is not the fix.
- CI `typecheck-lint`: `tsc -b tsconfig.layers.json` checks seven source projects including the app composition root,
  then root `tsc --noEmit` checks tests against their declarations. All six small projects remain (api, scripts, drafts,
  drafts/tools, admin, admin/tools); API/scripts reuse platform declarations. Scripts retain strict/checkJs and match
  root/layer skipLibCheck, with a real JS-body refusal regression. Generated inputs still come from the exact CI run.
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
4. **src checked twice** in the original CI baseline (root + layers); T2 removes the duplicate implementation check.
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
| T1 | Generated JSON out of the program (G655): no generated file is imported (GR0 ban + the generator redesign G654); authored JSON stays typed | −4 GB, −15–30 s | M | root program ≤ 6 GB, green |
| T2 | done (2026-10-24, sp-x8): `96fe07d0eb` declaration compatibility + `5025374ca2` seven source projects, declaration-consuming tests/API/scripts, exact old-root coverage and app TS6307 contracts; all six tool/site checks retained | Old combined root cold 11.115 s; final cold tests 4.608 s; full forced-source + cold-test + six-project sequence 24.968 s locally | S–M | Local complete check and compiler refusal regressions pass. CI 40136681403 (`42a4961500`) Typecheck succeeded in 56 s (< 1 min); its whole job was later peer-cancelled. Cold typed lint keeps default source redirects without another tsc source pass; missing-declaration and unsafe-assignment regressions remain strict |
| T3 | in flight (2026-10-24, sp-x8). **Tests next to their source (G645):** unit and integration tests move into their layer's workspace (next to the file or in the layer), checked by that layer's project; only regression, end-to-end and scenario tests stay in a separate test project referencing the layers | warm per-layer checks; tests stop being one 2.8 GB lump | M–L | no unit test under `test/`; every layer project includes its tests |
| T4 | Explicit types on exported valibot schemas, format first, then `isolatedDeclarations` per layer (G644; engine 786 sites) | fixes TS2589, format `.d.ts` 14 MB → < 2 MB, cheaper `-b` edits | L | no TS2589; `isolatedDeclarations` on in engine, then the others |
| T5 | Pre-push full check: `tsc -b` with a persistent tsbuildinfo (fixed slot, or the cache copied into the push tree; paths are relative) | 1–5 s no change, ~15 s shard edit after T1–T3 | M | the gate runs the full check within 45 s; over-budget (engine API edit) falls back to CI (D2) |
| T6 | Mac only, after T1: `--checkers 8` | 62 → 25 s, +3.4 GB | S | measured after T1 |

T2 covered the 13 previously unowned top-level app roots and SDK `.d.mts`, preserving every old root input through
source ownership or tests/ambient contracts. The root test program contains zero source TS implementations. Compiler
fixtures refuse missing declarations, source errors, test errors and JavaScript-body errors. Ready related checks ran
737 tests / 133 suites green (seven absent-product suites explicitly deferred); the final config hook's discovery
deferred on an unrelated coherent D3 grapple host move, with no executed test red. The complete cold check passed all
eight stages. The CI Typecheck hunk was coordinated with sp-x7; cohort, generation and proof wiring did not change.

T4 debt observed while making script consumers reuse declarations: checking the emitted declarations themselves with
skipLibCheck disabled triggers TS2589 in `audioProfiles.d.ts` (`AudioMixRecipe`, then `AudioNodeSchema`) and
`voicePatches.d.ts`. Two output-alias prototypes only moved the depth error and were discarded; no audio schema or
validator changed. Script bodies stay strictly typed while their already-built layer declarations follow the same
skipLibCheck policy as root and layers.

## Decisions (decided G655: D1 keep authored JSON typed, generated never imported via GR0; D2 leave to CI; D3 lint rule)

1. **D1 Checked-in JSON:** `resolveJsonModule` off and **all** JSON `unknown`, parsed with valibot at the boundary (recommended) /
   rename generated outputs so TS never resolves them.
2. **D2 Engine-API edit over 45 s:** the push gate skips the full check and leaves it to CI (recommended) / block the push.
3. **D3 Explicit schema types as a lint rule** in the format layer (recommended) / convention only.

Not measured: incremental with declaration output; the oxlint rows (see the oxlint plan).

T3 first landing: `87d0c656a1` defines the test lint domain while preserving layer direction, no-module-mock and a hard production-to-test import refusal. `76f403b023` and `0029745f33` partition all six workspaces into production and Node-capable test projects; the layer solution builds both and root regression suites consume declarations. CF1 selects workspace test membership from candidate bytes, retains strict TS6307 checks and uses safe warm cache names. Real compiler/typed-lint fixtures prove cold resolution, declaration-only consumption, test-body errors and production Node-global refusal. Engine batches `ca3f537ba3`, `8706fca606`, `3f0f4de82b`, `08a0b19d51`, `8fef38b9d4` move 90 suites / 303 unchanged tests; named typed lint, ready related and layer/root checks pass. Format batch `c93b78b324` moves five suites / 22 unchanged tests after `0a21388bed` proves external fixture builders stay test-only and upward imports still refuse. Remaining unit/integration suites and shared fixture ownership are still in flight; this is not T3 completion.

T3 next batch: `745372e048` moves 20 game suites / 58 unchanged tests (115 suites / 383 tests moved in total). `1efae56dc8` assigns private `src/engine/test/` fixtures only to the test project and hard-refuses production imports; `129779573f` keeps workspace configs in exact staged guard snapshots. `0e0be7706c` checks isolated ownership and batches the strict real-CLI policy negatives without increasing timeouts. `da866150b0` resolves every source diagnostic reported by the five typed-lint shards on CI 40140464501; named typed lint, layers/root/scripts and 21 equipment/cache tests pass locally. These commits are on origin with the push gate green; no claim that a later full CI has finished. The approved next fixture step is an atomic move of `test/fake/FakeGame.ts` and all its callers into the private engine test workspace, with no forwarding shim; baseline/current test identities must stay equal. That move and the remaining unit/integration batches are still open within T3.

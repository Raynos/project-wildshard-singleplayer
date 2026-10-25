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
| T2 | done (2026-10-24, sp-x8): `96fe07d0eb` declaration compatibility + `5025374ca2` seven source projects, declaration-consuming tests/API/scripts, exact old-root coverage and app TS6307 contracts; all six tool/site checks retained | Old combined root cold 11.115 s; final cold tests 4.608 s; full forced-source + cold-test + six-project sequence 24.968 s locally | S–M | Local complete check and compiler refusal regressions pass. Full green CI 40146594652 (`da94ec4da3`) completed Typecheck in 50 s (< 1 min). Cold typed lint keeps default source redirects without another tsc source pass; missing-declaration and unsafe-assignment regressions remain strict |
| T3 | in flight (2026-10-24, sp-x8). **Tests next to their source (G645):** unit and integration tests move into their layer's workspace (next to the file or in the layer), checked by that layer's project; only regression, end-to-end and scenario tests stay in a separate test project referencing the layers | warm per-layer checks; tests stop being one 2.8 GB lump | M–L | no unit test under `test/`; every layer project includes its tests |
| T4 | **in flight (2026-10-24, sp-x2):** explicit types on exported valibot schemas, format first, then `isolatedDeclarations` per layer (G644; engine 786 sites) | fixes TS2589, format `.d.ts` 14 MB → < 2 MB, cheaper `-b` edits | L | no TS2589; `isolatedDeclarations` on in engine, then the others |
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

T4 first format slices are on origin: schema expressions and emitted runtime JavaScript are unchanged.
Independent named data types replace exported validator implementation types; original/candidate input and output
contracts remain mutually assignable (174 contracts). No compiler option or admission fence changed.

| Declaration | Before bytes | After bytes | Commit |
|---|---:|---:|---|
| audioProfiles | 259,252 | 28,949 | `bf10517256` |
| voicePatches | 12,481 | 2,368 | `bf10517256` |
| clientPlan | 1,289,272 | 20,066 | `b28dcc33ec` |
| sceneDressing | 516,289 | 12,604 | `7b745a7a01` |
| worldAssembly | 294,929 | 10,127 | `9d03402c65` |
| worldScenes | 305,851 | 12,875 | `0379ab78a4` |
| speciesBookRows | 508,433 | 11,191 | `bfc9a2b448` |
| nativeRuntimePlan | 292,727 | 5,782 | `91e960a36c` |
| ambientLife | 379,519 | 14,643 | `b96b292d41` |
| questSteps | 307,393 | 15,987 | `82ff5a5b4c` |
| worldSceneModels | 243,730 | 5,948 | `0f8d5932dd` |
| questPageComposition | 240,388 | 6,836 | `0f8d5932dd` |
| heldEquipment | 295,243 | 34,014 | `4c24dd5655` |
| speciesPrograms | 469,653 | 11,819 | `cec79db9fd` |
| arenaScriptRows | 361,835 | 15,375 | `62384533cf` |
| specimenCatalogue | 192,406 | 15,522 | `7561b87a10` |
| creatures | 353,724 | 15,751 | `44d7fc16d0` |

These seventeen files save **6,083,268 bytes (96.2%)** (6,323,125 → 239,857 bytes). The same 285 live format modules
emit **14,010,239 → 7,444,713 bytes**. This whole-layer number also includes dependent declaration shrinkage and
peer changes; only the seventeen-file saving is attributed directly above. The <2 MB target remains open. The audio regression reproduces the original two TS2589 errors and
checks isolated emission plus a strict emitted-declaration consumer with skipLibCheck disabled. Client-plan and
dressing regressions pin isolated emission, bounded sizes and defining imported data contracts; existing admission,
default, corruption and decoded-cost tests pass. One broad related run passed 3,217 tests and hit one peer sealed
Sunscar discovery dependency failure; that exact case passed after its owner's reader-isolation repair. Forty-one
missing-product suites explicitly defer to CI; this is not a full-suite pass.

World declarations retain the original arena variants, checkpoints, scene defaults and imported contracts. The
exported ParsedWorldScenes interface keeps downstream shard declarations nameable: a real virtual consumer reproduces
TS4023 with the private interface and emits with the public contract. Species presentation retains an explicitly typed
ObjectSchema with four entries for the existing pick/omit readers; its compiler regression covers both operations.
All three latest slices have focused admission/runtime tests and typed lint green; the current full layers/root chain
passes, including peer source changes. The final normal compiler emission is the size authority (worldScenes is
12,875 bytes; its commit body used the isolated-emitter estimate of 12,886).

Later slices preserve the native plan's owner normalization and extra properties; ambient snapshots retain the
object-type-alias dictionary compatibility required by SimValue. Quest rows retain the live guards.item schema path.
Held equipment retains every root entry and the nested firearm.rows.view path. Species programs preserve the root
pick/spread API, nested variant entries and exact optional keys. Real virtual-consumer compiler tests cover these
structural APIs. Arena rows retain omit/program composition and loose-file properties. Specimen model entries retain
the three live pick/spread consumers and optional fields. Creature strike tags retain their exact pipe/item path;
the authored creature input remains an object type alias because Valibot's readonly default inference loses the
implicit dictionary compatibility with an interface. A virtual consumer reproduces TS2322 with that interface and
passes with the alias. Focused runtime/admission cases, declaration regressions, named typed lint and format emission
pass. The arena packet has normal layers/root green. The subsequent full build stopped solely on a peer SDK fixture,
which its owner repaired; the current root has three Nine callback callers undergoing that owner's migration, and is
not reported green. CF1 explicitly defers source-wide related selections above twenty suites; these are not full
related passes. No schema expression, runtime JavaScript, producer bytes or admission check changed.

A per-file isolated-declaration audit finds **81/285 ready**, with 592 diagnostics remaining in 204 modules
(550 missing variable annotations, 34 non-inferable expressions, one parameter, one spread object and six arrays).
Global isolatedDeclarations remains off until the layer actually meets its contract. T4 is still in flight.

## Decisions (decided G655: D1 keep authored JSON typed, generated never imported via GR0; D2 leave to CI; D3 lint rule)

1. **D1 Checked-in JSON:** `resolveJsonModule` off and **all** JSON `unknown`, parsed with valibot at the boundary (recommended) /
   rename generated outputs so TS never resolves them.
2. **D2 Engine-API edit over 45 s:** the push gate skips the full check and leaves it to CI (recommended) / block the push.
3. **D3 Explicit schema types as a lint rule** in the format layer (recommended) / convention only.

Not measured: incremental with declaration output; the oxlint rows (see the oxlint plan).

T3 first landing: `87d0c656a1` defines the test lint domain while preserving layer direction, no-module-mock and a hard production-to-test import refusal. `76f403b023` and `0029745f33` partition all six workspaces into production and Node-capable test projects; the layer solution builds both and root regression suites consume declarations. CF1 selects workspace test membership from candidate bytes, retains strict TS6307 checks and uses safe warm cache names. Real compiler/typed-lint fixtures prove cold resolution, declaration-only consumption, test-body errors and production Node-global refusal. Engine batches `ca3f537ba3`, `8706fca606`, `3f0f4de82b`, `08a0b19d51`, `8fef38b9d4` move 90 suites / 303 unchanged tests; named typed lint, ready related and layer/root checks pass. Format batch `c93b78b324` moves five suites / 22 unchanged tests after `0a21388bed` proves external fixture builders stay test-only and upward imports still refuse. Remaining unit/integration suites and shared fixture ownership are still in flight; this is not T3 completion.

T3 next batch: `745372e048` moves 20 game suites / 58 unchanged tests (115 suites / 383 tests moved in total). `1efae56dc8` assigns private `src/engine/test/` fixtures only to the test project and hard-refuses production imports; `129779573f` keeps workspace configs in exact staged guard snapshots. `0e0be7706c` checks isolated ownership and batches the strict real-CLI policy negatives without increasing timeouts. `da866150b0` resolves every source diagnostic reported by the five typed-lint shards on CI 40140464501; named typed lint, layers/root/scripts and 21 equipment/cache tests pass locally. These commits are on origin with the push gate green; no claim that a later full CI has finished. The shared-fixture step open at this boundary is completed below; the remaining unit/integration migration stays open within T3.

T3 shared fixture: `31818ac1cb` keeps disjoint production/test declarations in the same layer output directory with separate build metadata; eight focused compiler/policy cases prove private helper types still resolve, wrong assignments refuse and production cannot use Node globals. `a59677a09f` atomically moves the defining FakeGame into `src/engine/test/FakeGame.ts` and rewrites all 146 imports through its test-only package export, without a shim. Before: 157 ready suites / 875 tests. After: all 875 retain identical identities/results, plus two newly verified Driftwood product tests; two other product suites still explicitly defer. Named typed lint, deleted-path checks and the stable layer/root boundary pass. `a940c7cbb6` removes unrelated rule scans from the real-CLI policy negatives without raising the 10-second subprocess deadline or dropping assertions. `6a464e7270` fixes the remaining CI timeout cause: the real HTML rule was building its typed census from the inherited game cwd. The child now owns a tiny fixture cwd/tsconfig and resolves diagnostic filenames there; the same CLI/refusals pass in 705 ms under CF1, with the deadline unchanged.

T3 further batches: `a241303f37` moves one engine suite / nine tests, `913b0ee387` moves 13 game suites / 27 tests, `f8b60d7f15` moves ten SDK suites / 39 tests, and `aa05c5f15d` moves five Driftwood generator suites / nine tests. Each has identical before/after test identities, ready related, named typed lint and workspace compiler checks. The SDK fixtures keep no-base64 strict through exact embedded bytes and the real cache serializer, with corruption/hash assertions retained. `354b59f266` admits external test tools only in author `.test.ts` files; real CLI negatives retain production, cross-shard, game, absolute and computed-import refusals. The 21 runtime exemptions remain unchanged. Total colocated: **144 suites / 467 tests**. T3 is still in flight: remaining root suites need classification and further fixture/unit/integration moves; no completion claim.

T3 lifecycle and downward-import batches: `471dc52e86` moves five suites / 11 tests and the unchanged real-GC helper into their owning workspaces, with all six helper imports retargeted atomically. Game tests explicitly reference the engine test project; the staged guard regression refuses a missing reference while production imports remain forbidden. The root Pine score scenario retains both tests. `9b1079e088` moves 19 graph-compiler suites / 32 tests; `2f32a4c96b` moves 18 game suites / 37 tests; `441768bc59` moves ten engine suites / 28 tests. Every moved test retains its identity, assertions and deadline; downward imports use existing public defining exports. Named typed lint and workspace compilers pass, with the stable full layers/root boundary also green. The last batch's initial related discovery refused a foreign missing Nine input; final CF1 candidate discovery and all ten suites / 28 tests passed after that source boundary recovered. Total colocated: **196 suites / 575 tests** (engine 123 / 379, format 5 / 22, game 53 / 126, SDK 10 / 39, shards 5 / 9). Remaining root unit/integration suites still need classification and relocation; T3 stays in flight.

T3 further game/SDK batches: `f1e0c35051` moves 19 grid/tile suites / 91 tests; `d06c064637` moves 15 scene/resource/memory-UI suites / 72 tests; `db901466a1` moves nine SDK suites / 40 tests; `4e732ebb5a` moves 14 entry/lifecycle suites / 51 tests. Every existing test identity, assertion and deadline remains. The native-prelude fixture supplies the same raw geometry through the existing file reader instead of encoding base64; additional checks pin exact positions/indices and defer the one named byte read until construction. Named typed lint, ready related checks and test-project typechecks pass; the final normal layers/root boundary is green.

`7d649eadb4` atomically relocates the three defining engine-only world/creature/manager helpers and retargets all 16 importers through private test exports, without shims. Their 20 ready related suites retain all 122 exact test identities/results. Explicit readonly field spelling replaces the constructor parameter property to satisfy source lint. `001e8b9ba2` repairs the historical normalization touched-path receipt; the real deleted-reference guard reports no stale references for all three old helper paths. Later batches must run that guard after renaming and before committing; `4e732ebb5a` does so. Production test imports and Node globals remain refused, with no new lint exemptions. Total at that checkpoint: **253 suites / 829 tests** (engine 123 / 379, format 5 / 22, game 101 / 340, SDK 19 / 79, shards 5 / 9). T3 remains in flight; remaining root units and shared fixture ownership still need work.


T3 native-fixture and cross-layer batches: `3be8615cf2` atomically moves the defining native-byte helper into the engine test project and retargets all 20 callers through its test-only package export. Its 20 ready related suites retain all 129 test identities/results, without a forwarding shim. The two physics suites move with it. `e62655af00`, `fcffe14d33` and `51e23dbc8c` move two format suites, one physics-query suite and three game suites. These batches total **eight suites / 30 unchanged tests**; the mandatory shipped-site real-GC child and every ledger/page-lifetime assertion remain intact. Existing public defining exports carry downward imports.

Named typed lint, ready related checks and the owning layer test projects pass. A fresh normal layers/root boundary covers the format moves; the final shards/root refresh also passes after the parallel Nine fixture packet stabilizes. The real deleted-reference guard runs after each rename and before every commit, including all three removed paths in the native-helper batch. The one new per-line lint annotation documents intentional Node fs access in the private Node test helper; no test-domain exemption or production rule changes. Total at that checkpoint: **261 suites / 859 tests** (engine 126 / 388, format 7 / 36, game 104 / 347, SDK 19 / 79, shards 5 / 9).


T3 terrain/parity fixture ownership: `f183aa8d76` moves the two defining engine-only helpers and retargets all 31 caller files atomically, without shims. All 195 tests across 30 ready related suites retain exact identities/results; the existing collections-display product suite explicitly defers. Shipped-shard scenarios remain at root. `74dfcccd1f` moves guarded pickup, `53cede3c49` moves the page-combat and creature-residency units, and `8639b17aa9` moves the real compiler/runtime view-program suite: **four suites / 21 unchanged tests**. Named typed lint, ready related checks, owning test-project checks and post-rename deleted-reference checks pass.

The SDK test project now references the existing engine test project. The actual file census switches its terrain helper from source implementation to emitted declaration; plain TypeScript accepts the package import before that reference, so compiler success alone does not prove declaration-only consumption. The staged guard retains a missing-reference TS6307 refusal. Isolated real-compiler negatives also refuse the missing relative reference and a wrong SDK test type; production helper imports and production Node globals still refuse. The SDK commit's three selected CF1 suites pass all 13 cases. Its later warm-type attempt explicitly deferred on a foreign untracked bake fixture, whose owner fixed the typing; no type or rule waiver was added. Current total: **265 suites / 880 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 20 / 87, shards 5 / 9). T3 remains in flight: remaining root units, integration ownership and shared fixtures still need classification and relocation.

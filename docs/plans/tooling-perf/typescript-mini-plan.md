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
| T3 | done (2026-10-25, sp-x8). **Tests next to their source (G645):** 462 source suites have one test-project owner and zero production membership; 994 root tooling, regression and scenario suites retain their separate declaration-consuming project | warm per-layer checks; tests stop being one 2.8 GB lump | M–L | all 1,460 tracked suites discovered; layer builds, ownership/Node/lint refusals, CF1 and CI cohort coverage pass |
| T4 | **in flight (2026-10-24, sp-x8; G708 handoff):** explicit types on exported valibot schemas, format first, then `isolatedDeclarations` per layer (G644; engine 786 sites) | fixes TS2589, format `.d.ts` 14 MB → < 2 MB, cheaper `-b` edits | L | no TS2589; `isolatedDeclarations` on in engine, then the others |
| T5 | Pre-push full check: `tsc -b` with a persistent tsbuildinfo (fixed slot, or the cache copied into the push tree; paths are relative) | 1–5 s no change, ~15 s shard edit after T1–T3 | M | the gate runs the full check within 45 s; over-budget (engine API edit) falls back to CI (D2) |
| T6 | Mac only, after T1: `--checkers 8` | 62 → 25 s, +3.4 GB | S | measured after T1 |

### T3 remaining slices (G704/G711)

Each slice is at most one hour; a relocation commit touches at most about twenty
source/test paths. Later inventory findings get their own bounded slices before
implementation. Existing test identities, assertions and deadlines stay fixed.

| Slice | Scope | Budget | Status |
|---|---|---|---|
| T3-F1 | Eight format declaration suites: arena, audio, boss, channels, creatures, equipment, materials and roaming combat | 45 min | done (2026-10-24, sp-x8) |
| T3-F2 | Eight format declaration suites: client plan, items, native plan, painted look, rows, dressing and species metadata | 45 min | done (2026-10-24, sp-x8) |
| T3-F3 | Four format declaration suites: specimen, assembly, world models/page and scenes | 30 min | done (2026-10-24, sp-x8) |
| T3-G1 | Binary-source, entered-elite and seated-figure units; keep byte fixtures, public lower-layer imports and host-bar contracts | 60 min | done (2026-10-24, sp-x8) |
| T3-E1 | Engine simulation consumer: ambient continuation declaration and value contracts | 30 min | done (2026-10-24, sp-x8) |
| T3-G2 | Live travel-state and near-grain units; keep private lower-layer and legacy-encoding integrations at root | 45 min | done (2026-10-25, sp-x8) |
| T3-S1 | Six Pine/Nine generator suites: cabin, bounds, encoding, profiles and spill inputs; keep credited artifact regressions at root | 60 min | done (2026-10-25, sp-x8) |
| T3-S2 | Six shard generator suites: sand metadata, LOD rows, map input, spill preparation, plot output and Template generation; keep native/artifact assertions | 60 min | done (2026-10-25, sp-x8) |
| T3-H1 | Three SDK geometry suites and game tile-content units; inline each sole-consumer fixture without changing its statements or test bodies | 60 min | done (2026-10-25, sp-x8) |
| T3-H2 | Baked hunt-ground and Script V2 grid units with sole-use fixtures; shared creature-stride oracle goes in the engine test subtree | 60 min | done (2026-10-25, sp-x8) |
| T3-H3a | SDK private test-fixture project boundary and strict production-import, layer and module-mock regressions; retain the same named test-domain rules | 45 min | done (2026-10-25, sp-x8) |
| T3-H3b | Move the shared ABI2 sim compiler fixture and its fourteen consumers atomically; root consumes SDK test declarations, no re-export shim or production compiler API | 60 min | done (2026-10-25, sp-x8) |
| T3-V1 | Eight ABI2 sim, query, input and RNG suites into the SDK test project using its private compiler fixture; no new runtime exports | 60 min | done (2026-10-25, sp-x8) |
| T3-H4 | Shared dual-ABI compiler fixture and its SDK unit suite; preserve root real-shard port inventory and its transitive fixture types | 45 min | done (2026-10-25, sp-x8) |
| T3-H5 | Shared ABI source fixture plus SDK admission/reset suites; retain frozen compiler-hash and tooling producer regressions at root | 45 min | done (2026-10-25, sp-x8) |
| T3-U1 | Map-scene baking and weak shader-map lifetime units; retain the mandatory real-GC child proof and its exact self-discovery | 30 min | done (2026-10-25, sp-x8) |
| T3-H6a | Private game fixture project boundary; strict production imports, layer direction, Node isolation and declaration-only root consumption | 45 min | done (2026-10-25, sp-x8) |
| T3-H6b | Extract the shared creature recipe once, preserving full simulation-level data, then relocate its two game units without moving scenario callers | 45 min | done (2026-10-25, sp-x8) |
| T3-A1 | Direct-import and immediate-fixture ownership census; enumerate concrete batches while preserving accepted cross-layer integrations | 60 min | done (2026-10-25, sp-x8) |
| T3-A2 | Audit transitive shared-fixture and source-string consumers; classify remaining root regressions and further bounded relocation batches | 60 min | done (2026-10-25, sp-x8) |
| T3-C1 | Reconcile the final root inventory, workspace membership and CF1/CI selection; retain only classified root suites | 45 min | done (2026-10-25, sp-x8) |
| T3-C1a | Give application-root units a separate Node test project; preserve production exclusion, static TS6307, warm CF1 jobs and candidate config inputs | 45 min | done (2026-10-25, sp-x8) |

T3's remaining root suites are tooling/policy/CLI regressions, real product/native or multi-shard scenarios,
historical hash/encoding/save/transaction oracles, and cross-layer contracts that need private implementations
(including the nine GroupStep suites kept at root by G645's ruling). The transitive fixture audit extracted
SDK compiler fixtures and the game creature recipe instead of introducing public runtime exports or shims.
The apparent direct-import candidates retained at root are `client-script-transactions-regression`,
`nalati-place-binary`, `native-floor-shards`, `pickup-catalogue`, `pine-contract-offers-product`,
`scalar-lattice`, `script-checkpoint-regression`, and `sunscar-config-boundary`: each is a retained
transaction, real-product, encoded-wire, frozen-answer, save or author-bundle regression. The real-AS
port inventory and historical creature-swing oracle also remain root scenarios, with their defining fixtures.

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

T4 handoff (G708): sp-x2's 24 defining modules are landed through `da9626ef21` (clientChannels), `ea5e5b732c`
(rows) and `b48c11a3d8` (paintedLook): direct declarations 8,136,960 → 381,476 B, same 285-module layer
14,010,239 → 5,144,644 B, 286 input/output contracts preserved. Target <2 MB and isolated declarations remain open;
88/285 modules pass the isolated audit (543 diagnostics remain). Sp-x8 owns continuation; no unlanded schema candidate.

### T4 continuation slices (G711)

Each source slice is at most one hour. Input/output contracts and runtime JavaScript stay identical;
normal layer emission is the declaration-size authority. Continuation starts at 5,150,849 B / 294 live modules.

| Slice | Scope | Budget | Status |
|---|---|---|---|
| T4-F1 | Named weld, forest-page and elite-entry data contracts; retain weld material entries/omit and admitted defaults | 60 min | done (2026-10-25, sp-x8) |
| T4-F2 | Remaining largest format validators, in bounded packets, until normal declarations are below 2 MB | 60 min per packet | done (2026-10-25, sp-x8) |
| T4-F2a | Weapon and Explorer data contracts; preserve family variants, held entries and contact-tag metadata | 60 min | done (2026-10-25, sp-x8) |
| T4-F2b | Encounter contracts, preserving schedule omit and nested cloud-puff metadata | 60 min | done (2026-10-25, sp-x8) |
| T4-F2c | Figure, brain and mover contracts with authored/admitted default refusals | 60 min | done (2026-10-25, sp-x8) |
| T4-F2d | Practice, quest and traversal contracts with exact optional/default laws | 60 min | done (2026-10-25, sp-x8) |
| T4-F2e | Collection, NPC and loot contracts with card projection and nested grant metadata | 60 min | done (2026-10-25, sp-x8) |
| T4-F2f | Authored manifest and capture-pose contracts; preserve sky pick and capture-probe items | 60 min | done (2026-10-25, sp-x8) |
| T4-F2g | Group, riding and finish contracts; preserve variants, exact optional descriptions and literal columns | 60 min | done (2026-10-25, sp-x8) |
| T4-F2h | Native bindings, quest interactions, held data, toon looks and module contracts; preserve object metadata and literal revisions | 60 min | done (2026-10-25, sp-x8) |
| T4-F2i | Decision, world, quest, runtime and motion contracts; retain legacy intake, nested schema identities and exact constants | 60 min | done (2026-10-25, sp-x8) |
| T4-F2j | Restore implicit record inference for earlier named contracts; preserve closed keys and reject any-valued iteration | 60 min | done (2026-10-25, sp-x8) |
| T4-F2k | Weather, checkpoint, encounter and world-entry contracts; preserve record inference, readonly tuples and schema checks | 60 min | done (2026-10-25, sp-x8) |
| T4-F2l | Population, audio, placement and light contracts; preserve schema entries, clip arity and authored defaults | 60 min | done (2026-10-25, sp-x8) |
| T4-F2m | Wire, brain, water, terrain and material contracts; preserve schema composition, transforms and authored defaults | 60 min | done (2026-10-25, sp-x8) |
| T4-F2n | Scene buffers, population, journals and material rows; preserve variants, defaults and typed record laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I1 | Format isolated declarations, then engine and remaining layers, one bounded diagnostic family per slice | 60 min per family | in flight (2026-10-25, sp-x8) |
| T4-I1a | Continuation, rig, catalogue and authored-page schemas; retain nested metadata and default laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I1b | Native riding, state, skin and scene schemas; retain transform metadata, tuples and default laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I1c | Ground, traversal, script and world-reference schemas; retain literals, records and default laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I1d | Grazer, elite, edge, panel and post-stack schemas; retain structural entries and bounded transforms | 60 min | done (2026-10-25, sp-x8) |
| T4-I1e | Runtime, skin, crowd and quest schemas; retain nested composition and literal revisions | 60 min | done (2026-10-25, sp-x8) |
| T4-I1f | ABI constants, limits, contact and lineage contracts; retain readonly tuples and literal registries | 60 min | done (2026-10-25, sp-x8) |
| T4-I1g | Input, product and native disk contracts; retain legacy transport, field registries and authored defaults | 60 min | done (2026-10-25, sp-x8) |
| T4-I1h | Require isolated format output and strict emitted-consumer refusals | 60 min | done (2026-10-25, sp-x8) |
| T4-I2a | Application and script constants; retain readonly registries and function identities | 60 min | done (2026-10-25, sp-x8) |
| T4-I2b | AI tuning, saved data and platform constants; retain private class identities | 60 min | done (2026-10-25, sp-x8) |
| T4-I2c | UI owner fields; retain existing scopes and unchanged DOM behaviour | 60 min | done (2026-10-25, sp-x8) |
| T4-I2d | Scene and physics resource fields; retain mutable resources and readonly owners | 60 min | done (2026-10-25, sp-x8) |
| T4-I2e | Default parameter types; retain omissions, callbacks and original values | 60 min | done (2026-10-25, sp-x8) |
| T4-I2f | Shared values, slots and action constants; retain imported function identity | 60 min | done (2026-10-25, sp-x8) |
| T4-I2g | UI and combat lifetime fields; retain private action types and mutable state | 60 min | done (2026-10-25, sp-x8) |
| T4-I2h | Resource ownership and default ports; retain buffer, DOM and cancellation laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I2i | Native geometry, dialogue and weather saves; retain complete data contracts | 60 min | done (2026-10-25, sp-x8) |
| T4-I2j | Native channels, shadow filters and body constants; retain literals and aliases | 60 min | done (2026-10-25, sp-x8) |
| T4-I2k | Motion and audio defaults; retain mutable arrays, resource owners and optional arguments | 60 min | done (2026-10-25, sp-x8) |
| T4-I2l | Simulation and application resource fields; retain mutable storage and scoped owners | 60 min | done (2026-10-25, sp-x8) |
| T4-I2m | World uniforms, imported constants and palettes; retain borrowed mutable values | 60 min | done (2026-10-25, sp-x8) |
| T4-I2n | Music method returns, swim constants and wire layouts; retain existing signatures | 60 min | done (2026-10-25, sp-x8) |
| T4-I2o | Elite, pack and cable saves; retain original state, tuples and schema checks | 60 min | done (2026-10-25, sp-x8) |
| T4-I2p | Cache command and reply contracts; retain pin entries and exact operation keys | 60 min | done (2026-10-25, sp-x8) |
| T4-I2q | Boot trace exports; retain single capture order, receiver and function identity | 60 min | done (2026-10-25, sp-x8) |
| T4-I2r | Require isolated engine output; retain browser-only production and separate Node test owners | 60 min | done (2026-10-25, sp-x8) |
| T4-I3a | Game resource-owner fields; retain borrowed scopes, groups and mutable contents | 60 min | done (2026-10-25, sp-x8) |
| T4-I3b | Game defaults; retain omitted arguments, callback ports and original values | 60 min | done (2026-10-25, sp-x8) |
| T4-I3c | Game saves; retain complete admitted state, literal revisions and fixed poses | 60 min | done (2026-10-25, sp-x8) |
| T4-I3d | Game registries and constants; retain literals, mutable palettes and constructor identity | 60 min | done (2026-10-25, sp-x8) |
| T4-I3e | Game presentation-owner fields; retain mutable resources and readonly handles | 60 min | done (2026-10-25, sp-x8) |
| T4-I3f | Game look and recovery contracts; retain tier keys, bounded tuples and custom ids | 60 min | done (2026-10-25, sp-x8) |
| T4-I3g | Game save slots and context aliases; retain exact read/write types and singleton identity | 60 min | done (2026-10-25, sp-x8) |
| T4-I3h | Arena and riding continuation data; retain native program, action and save contracts | 60 min | done (2026-10-25, sp-x8) |
| T4-I3i | Game rig fields and diagnostic defaults; retain mutable tuple palettes and resource owners | 60 min | done (2026-10-25, sp-x8) |
| T4-I3j | Game expression owners; retain save schemas, readonly ring limits and live uniform identities | 60 min | done (2026-10-25, sp-x8) |
| T4-I3k | Game look expressions and factories; retain literal blends, mutable scales and returned resources | 60 min | done (2026-10-25, sp-x8) |
| T4-I3l | Game metadata and dialogue; retain grid identities, overloads and defining schema aliases | 60 min | done (2026-10-25, sp-x8) |
| T4-I3m | Game runtime factories and ports; retain native contacts, combat owners and generic entry results | 60 min | done (2026-10-25, sp-x8) |
| T4-I3n | Game session stages; retain the complete asynchronous data, world, loadout and play composition | 60 min | done (2026-10-25, sp-x8) |
| T4-I3o | Optional presentation owner; retain constructor omission and explicit undefined laws | 60 min | done (2026-10-25, sp-x8) |
| T4-I3p | Require isolated game output; retain browser-only production and separate Node test owners | 60 min | done (2026-10-25, sp-x8) |
| T4-I4a | SDK schema aliases and build bindings; retain defining validator metadata and public identities | 60 min | done (2026-10-25, sp-x8) |
| T4-I4b | SDK author resources and defaults; retain node kinds, endpoint owners and numeric arguments | 60 min | done (2026-10-26, sp-x8) |
| T4-I4c | SDK worker and world wire contracts; retain variants, normalized defaults and complete proofs | 60 min | done (2026-10-26, sp-x8) |
| T4-I4d | Require isolated SDK output; retain existing production and separate test owners | 60 min | done (2026-10-26, sp-x8) |
| T4-I4e | Match CF1 declaration ownership for all module suffixes; retain implementation membership refusals | 60 min | done (2026-10-26, sp-x8) |
| T4-I5a | Require isolated commons output; retain portable math identities and Node authoring owners | 60 min | done (2026-10-26, sp-x8) |
| T4-I6a | Template and Driftwood author declarations; retain generated project overlays, readonly inputs and mutable resources | 60 min | done (2026-10-26, sp-x8) |
| T4-I6b | Discovery and composition declaration producers; retain generated runtime bytes and frozen legacy entries | 60 min | done (2026-10-26, sp-x8) |
| T4-I6c | Driftwood catalogue, pose and native author contracts; retain exact parameters, defaults and admission | 60 min | in flight (2026-10-26, sp-x8) |
| T4-I6legacy | Frozen legacy declaration annotations: exact inventory bytes stay unchanged until G606/LD is lifted; modern slices continue | 60 min | waits-Jake (2026-10-26; G606, sp-x8) |

T4 first format slices are on origin: schema expressions and emitted runtime JavaScript are unchanged.
Independent named data types replace exported validator implementation types; original/candidate input and output
contracts remain mutually assignable (242 contracts, including the private item bridge nodes). No compiler option or admission fence changed.

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
| roamingCombat | 125,190 | 1,687 | `16da600fd3` |
| materialFamilies | 181,494 | 36,063 | `3c6189b3d2` |
| items | 589,831 | 25,726 | `e7691fcaa7` |
| bossProfiles | 312,502 | 25,102 | `a956756bee` |

These twenty-one files save **7,203,707 bytes (95.6%)** (7,532,142 → 328,435 bytes). The same 285 live format modules
emit **14,010,239 → 6,067,501 bytes**. This whole-layer number also includes dependent declaration shrinkage and
peer changes; only the twenty-one-file saving is attributed directly above. The <2 MB target remains open. The audio regression reproduces the original two TS2589 errors and
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
passes with the alias. Roaming combat references its defining session/projection/presentation contracts. Material
families retain structural discriminator entries and readonly defaults; their four output contracts remain object
aliases for graph admission's record compatibility, with a failing-interface/passing-alias compiler regression.
Focused runtime/admission cases, declaration regressions, named typed lint and format emission pass. The final normal
full layers/root chain passes, including the repaired peer SDK fixture, Nine callback callers, Sunscar adoption and
SDK test membership. CF1 explicitly defers source-wide related selections above twenty suites; these are not full
related passes. No schema expression, runtime JavaScript, producer bytes or admission check changed.

The item packet preserves the JSON Schema bridge's complete pipe/array/variant/entry and nullable-wrapper paths,
including exact namespaced weapon/tool identifiers, slots, tags, effects and actions. Its 22 contracts cover the
private raw, weapon, tool, attack, equipment, admission-pipe and swept-policy nodes as well as public schemas. Boss
profiles retain all five variant options and the spawned/held subset; four pipeline output aliases keep Valibot's
required dictionary compatibility. Virtual consumers prove both variant sets and refuse a namespace-free effect.
The final item/boss packet passes 20 focused cases in seven suites, four related declaration cases, named typed lint,
format emission and a fresh full layers/root check. Empty strict-object data uses the equivalent Record<never, never>
spelling; no admission check changes.

A per-file isolated-declaration audit finds **85/285 ready**, with 561 diagnostics remaining in 200 modules
(519 missing variable annotations, 34 non-inferable expressions, one parameter, one spread object and six arrays).
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

The SDK test project now references the existing engine test project. The actual file census switches its terrain helper from source implementation to emitted declaration; plain TypeScript accepts the package import before that reference, so compiler success alone does not prove declaration-only consumption. The staged guard retains a missing-reference TS6307 refusal. Isolated real-compiler negatives also refuse the missing relative reference and a wrong SDK test type; production helper imports and production Node globals still refuse. The SDK commit's three selected CF1 suites pass all 13 cases. Its later warm-type attempt explicitly deferred on a foreign untracked bake fixture, whose owner fixed the typing; no type or rule waiver was added. Total at that checkpoint: **265 suites / 880 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 20 / 87, shards 5 / 9).


T3 Script V2 compiler/runtime conformance: `4eddaf8edb` moves the largest clear public-API group, **11 suites / 61 unchanged tests**, into SDK/bake. It covers admission, external stages, fuel, group steps/guest loops, continuation, point queries, versions and grouped return compilation. Static and dynamic downward imports name existing defining public exports; no API or allowance is added. Direct before/after identities and ready related checks pass all 61 cases. The touched admission suite passes all seven cases after its dynamic-import path is corrected. Named typed lint, zero-diagnostic scoped ratchet, SDK test-project check and the post-rename deleted-reference guard pass. The final full layers/root chain is also green. CF1 keeps its existing selection policy and explicitly defers this 22-staged-test-file batch before execution, while the direct related proof remains complete.

Nine adjacent GroupStep suites still couple the SDK compiler to the private game custom-schema validator; their test ownership remains open within T3 rather than expanding production exports for a move. Shipped-shard scenarios remain at root. Total at that checkpoint: **276 suites / 941 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 31 / 148, shards 5 / 9). T3 remains in flight; remaining root units, integration ownership and shared fixtures still need classification and relocation.


T3 decision/compiler integration: `7b6d1065e9` moves five SDK suites / 43 unchanged tests into SDK/bake. Every test identity, input, original assertion and deadline remains; static/dynamic downward imports use defining public exports. The return fixture lends the same real compiled bytes through the existing scoped raw-module API instead of encoding base64; both result assertions and the stateful-inbox refusal remain, with an additional module-identity check. Before/after, direct related and actual CF1 all pass 43 cases. SDK test-project types, named typed lint, zero-diagnostic scoped ratchet and the post-rename deleted-reference guard pass. No production export or exemption changes.

`17099d8ca5` repairs the T3 draw census: it excludes only the canonical `*.test.ts` and `src/engine/test/` domains. The regression fails before the fix and proves identical draw code in production lookalike paths is still counted. All three guarded production draws and their graphLook assertions remain; four focused/related cases, engine test-project types and named typed lint/ratchet pass. Its actual CF1 four cases and 39 guards pass.

Total at that checkpoint: **281 suites / 984 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 36 / 191, shards 5 / 9). The added census regression is new coverage, separate from unchanged moved-test counts. T3 stays in flight; the nine mixed GroupStep suites also depend upward on the SDK compiler, so moving them into game would break layer direction. Their ownership remains open without widening production exports.


T3 geometry/decoding integration: `1bb7b355bd` moves the largest remaining clear generic SDK group, **12 suites / 55 unchanged tests**, into SDK/bake. It covers GLB/meshopt admission and transport lifetime, owned geometry, bounded parser work, whole-geometry pacing, packed looks, cloud/native poses, post-graph presentation, instanced view arrays and mover lifecycle. All 55 before/after identities and ready related cases pass. Canonicalizing only import specifiers and moved self-path strings makes every source byte-identical; the mandatory isolated real-GC child still runs, with its runner path updated. No assertion, deadline or production export changes.

SDK test-project types, named typed lint, zero-diagnostic scoped ratchet and the real post-rename deleted-reference guard pass. The stable normal source layers/root boundary is green. Duration/product keys and the host manual's test link move atomically; an exact shared patch preserves the manual's unrelated working edits. CF1 explicitly defers this 24-staged-test-file batch before selection/execution under the unchanged 20-suite ceiling; the independent direct and related proofs remain complete. Initial baseline collection refused a missing Nine discovery artifact before any tests ran, then all 55 pass after its owner restores the defining current receipt.

Total at that checkpoint: **293 suites / 1,039 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 48 / 246, shards 5 / 9). The nine mixed GroupStep suites still import SDK compilation/schema tools and private game validators (`customSchema` and `crowdRuntime`); game ownership would violate upward-import refusal, while SDK ownership needs new exports. They remain open within T3 without a policy waiver or API widening. Other root units, shared fixture ownership and integration classification remain open.


T3 SDK admission/API batch: `4cfc966c45` moves **nine suites / 41 unchanged tests** into SDK/bake: channel constants, content cache, disk/headless product admission, generated discovery, quest/mover schema admission, scenario-world API and product reads. Every input, assertion, test identity and deadline remains. Static/dynamic imports use existing defining exports. Direct before/after and ready related checks pass all 41; the local product-selection fixture retains its 17 cases after one moved test-path update. Named typed lint, zero-diagnostic scoped ratchet, SDK test-project types and post-rename deleted-reference checks pass. Actual CF1 selects ten suites and passes all 58 cases; no size deferral in this batch. No production API, policy exemption or compiler option changes.

Current total: **302 suites / 1,080 tests** (engine 127 / 389, format 7 / 36, game 106 / 359, SDK 57 / 287, shards 5 / 9). The coordinator accepts the nine mixed GroupStep suites as intentional root cross-layer integrations: they stay at root, without new exports or a layer violation. This resolves their classification; other root unit/integration and fixture ownership work remains. T3 stays in flight. At the next boundary G703 takes SW11 ahead of further test moves, removing size-based commit-test skipping; later mechanical batches follow G704's roughly 20-file limit and single-move lane.

# Round 2, seat B (Claude): evidence

Verified: fuel formula and sites (`compileScript.ts:56,30,40,63,72`); Pine `life` constant `i32.const 32064`; rewind
`decisionModule.ts:132-135`; v0 slice `host.ts:125-129,318`; projection rewind `returnProgram.ts:90`; `decisions.ts:184`
afterBodies; `store.ts:16,148-150` migrate hook; `src/calibrate.ts`, `api/telemetry.ts` exist; AS 2,791 lines with
matching per-shard figures; v0 line counts; v1 quotas and three strikes (`decision.ts:290,307,314`); HOST-BAR.md:17;
SCRIPT-ABI.md:332-333; G475/G515.

| # | Severity | Location | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | should-fix | Design; H6b | "48 call sites in 16 files" is ~2× low: ~109 `.project(` calls in 35 files, many dependent chains. | 45 files import returnProgram; `encounterPatrol.ts` 18 (chain at :81-106), `nativePopulation.ts` 11, `pageGroups.ts` 8, `arenaField.ts` 7, `taming.ts` 7, `pastureController.ts` 7 | Recount; list dependent-chain owners needing staged continuations; re-estimate H6b. |
| 2 | should-fix | H13 v0 inventory | Missing v0 users: item hooks (`engine/combat/items.ts:33`, `game/plugin/simulation.ts:18,709,722-727`), lane wiring (`game/shardfile/scripts.ts:39`, `simulation.ts:40,491,502`), client-lane consumer (`game/shardfile/clientScripts.ts:22`), memory lease (`game/shardfile/pagePreparation.ts:19`, `driftwood-isle/runtime/index.ts:71`). | as listed | Add them; say whether item hooks become a sim binding or a projection, and what replaces the memory lease. |
| 3 | should-fix | H13 saves | Script state lives inside an opaque SimSnapshot string with exact version + level fingerprint, not a store key; the repo already has a logical ClientCheckpoint fallback. | `game/grid/durability.ts:15-20,86-107,137`; `engine/sim/snapshot.ts:22,249` | Migrate through SimSnapshot adapters (bump `SIM_API_VERSION`, per-adapter decoders for DecisionHost/ScriptHost); the logical mode is the restart-on-load policy; store.ts only for the `platform.region` envelope. |
| 4 | should-fix | H0; battery 8 | `api/telemetry.ts:42` accepts only session/analytics/crossroads; calibration posts via `sendNote` (perf) to `/api/inbox`, read by `pnpm inbox:pull`; page is `calibration/index.html`. | as cited | Post like today or add a `wasm` kind; name the URL `/calibration/`. |
| 5 | should-fix | W13; H17 | A headless Node runtime with snapshot restore already exists. | `src/sdk/headlessRuntime.ts:1-30`, `sdk/headlessWorker.ts`, `scripts/check-headless-assemblies.mjs`; DecisionHost/ReturnProgram under vitest | Extend `sdk/headlessRuntime.ts` and its test with v2 lanes and a browser-made `platform.region` fixture; say exact or logical mode. |
| 6 | should-fix | W13; H6b; H17 | Some ReturnProgram families are client/presentation; projection inputs are caller observations, so a reads check can't see client sources; `ReturnProgram.page` reads a process-global terrain port. | `returnProgram.ts:41-44,80`; `sdk/looks/pageLife.ts:71-74`; `game/boss/encounterView.ts:136,340`; `game/ambient/crowdPage.ts:116`; `game/riding/client.ts`; `engine/world/terrainHeight.ts:2-4` | Tag each family sim or view; H17 checks callers of sim projections; sim projections take terrain from their owner host. |
| 7 | should-add | H0b; H4 (W13) | The observation block assumes one player; an MMO server would need ABI v3. v1 already models players. | `scriptAbiV1.ts:4,9-13` | Per-player observations and input edges keyed by player handle, bounded count; single-player client fills one row. |
| 8 | nit | Order | H17 not placed. | Plan order line | "→ H13 → H17 → H14". |
| 9 | nit | H12 | Superseded list misses G454 (7) and G457 (6)-(8). | decisions.md:170,173 | Add them. |
| 10 | nit | Why | 8,370 B / 21 functions is the shipped instrumented module; 32,064 comes from the uninstrumented input. | `life.generated.json`; `compileScript.ts:56` | Say so. |
| 11 | nit | H13; Why | 56 files, not 57; full path `src/game/population/returnProgram.ts`. | `find src -name '*.as'` | Fix. |

Battery: 1 pass; 2 pass; 3 pass; 4 pass; 5 pass; 6 gap (#1-#3); 7 pass; 8 gap (#4); 9 gap (#5-#7; cross-device needs the
future server, rightly deferred).

Verdict: round-1 fixes mostly landed and their references check out; five should-fix count/path errors and one W13 gap
remain, all small edits.

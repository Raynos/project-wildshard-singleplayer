# Actor host boundary correction (G482)

Pine's wave iteration, placement, schema and native/page adapters return to
`src/shards/pine-hollow/quest/{waves,waveRows,nativeWaves,pageWaves}.ts` as
counted custom TS. `behaviour/night.as` and its module bytes are unchanged.
The six former platform/SDK modules are deleted. No rendering changes.

The coordinator chose this immediate charge-back on 2026-10-17. The live
queue's **Pine night: Script ABI spawn / retire** row owns the full AS command
adapter and legacy-save migration; it deletes all seven crossings below.

## Six-test scores

Scores follow `docs/HOST-BAR.md`, in test order. The approved actor-spawn
feature (G474/G475/G477) supplies test 1's explicit platform exception for
the return queue; the salt-marsh fixture is evidence, not a second shard.

| Module | 1 | 2 | 3 | 4 | 5 | 6 | Verdict / evidence |
|---|---|---|---|---|---|---|---|
| `game/population/actors` | 1 | 1 | 1 | 1 | 1 | 1 | 6/6. Shared `homeKeeper.ts:317` constructs identities for DW keeper and Pine roster. Generic ownership/auxiliary rows; no DOM/RNG. `actors.ts:108` restores using its reinstalled table, without a resolver callback. |
| `game/population/respawn` + SDK | 1 | 1 | 1 | 1 | 1 | 1 | 6/6 (approved test-1 exception). `respawn.ts:8` takes rows; `:16` lets the owner check a returning kind; `:19` accepts a draw value. `:29` extraction is private; `:37` takes by declared traversal. The same generic queue remains useful without DW. No subclass/port/callback input. |
| `game/population/roster` + SDK | 1 | 1 | 1 | 1 | 1 | 0 | 5/6, **charged back**, no pending platform credit. Test 6 fails at `roster.ts:18-27` (ground/wander/pose ports), `:73`, `:106`, `:124`. Salt-marsh rows exercise independent reservation/adoption/save. Native body/pose registration order is unchanged. |
| `game/population/shelter` + SDK | 1 | 1 | 1 | 1 | 1 | 0 | 5/6, **charged back**, no pending platform credit. The pure shelter class reads herd/tree/tuning data; native installation still takes herd/rain callbacks at `shelter.ts:119`. Renderer-free; generic wet/dry home behavior survives removal of Pine. |
| Former wave modules | — | — | — | — | — | — | Removed from platform, fully counted as Pine custom TS; no host claim. |

The live **Population roster / shelter: data-only ownership** row owns the
remaining test-6 fixes. A registry or event hiding a shard TS hook would
still fail. Pose/RNG/save parity takes precedence over disguising that debt.

## Reviewed callback reclassification

Coordinator approved caps 3/1/4 for native/director/page, shrink-only. The
raw typed scan finds only three page crossings: its cap shrinks to 3 now,
for seven actual crossings total. No unused eighth allowance is retained.
No callback body or order changes. These are exposed by moving their source
out of the platform, not newly introduced callbacks.

| HEAD platform source → Pine source | Crossing |
|---|---|
| `game/population/nativeWaves.ts:36` → `quest/nativeWaves.ts:36` | `SimHost.onStep` step callback |
| `game/population/nativeWaves.ts:37` → `quest/nativeWaves.ts:37` | `SimHost.onStep` snapshot |
| `game/population/nativeWaves.ts:38` → `quest/nativeWaves.ts:38` | `SimHost.onStep` restore |
| `game/population/waves.ts:53` → `quest/waves.ts:53` | `DirectorScriptStageLane.observe` |
| `game/population/pageWaves.ts:36` → `quest/pageWaves.ts:36` | `EncounterRegistry.spawn` create |
| `game/population/pageWaves.ts:37` → `quest/pageWaves.ts:37` | `EncounterRegistry.spawn` retire |
| `game/population/pageWaves.ts:44` → `quest/pageWaves.ts:44` | `Spawner.spawn` fixed-table entropy-refusal callback |

The typed guard reports pageWaves **three** crossings: create, retire and
the fixed-table RNG refusal.
The exact diagnostic identities and measured ruler/proof results accompany
the landing commit. No rule is disabled or broadened.

## Ruler and verification

Official `sourceProgressInventory` from `scripts/shard-platform.mjs`, in
the build mirror, compares 49ac0b23a with its isolated correction tree using
the same ruler and complete ten-product inventories. Other lanes' changes
do not supply a cut.

| Source-basis custom lines | Before | After | Change |
|---|---|---|---|
| Pine Hollow | 9,164 | 9,767 | +603 charged back |
| Driftwood | 6,123 | 6,115 | −8 |
| All other shards | unchanged | unchanged | 0 |
| Net | | | **+595 custom shard lines** |

Physical platform TS decreases 343 lines, or 351 lines including removed
package exports. This is an accounting correction, not a shard-line cut.

Root and layer types, typed lint and all ten product builds pass. The six
focused test files pass 31 tests, including all 17 shard-headless cases and
the salt-marsh fixture. Native old-checkpoint continuation passes:

- DW: 1,000 replay ticks, 1,000 worker ticks, workerExact true; matching
  digest `5ac20ce6da0d12b8ee015703d848da2b0d786364b416af613f05b89c660141a7`.
- Pine: 1,200 replay ticks from the saved King fight, zero restored emits;
  matching digest `9c4767f57fb5f76630d4946ec3f2a4d96d7d75f95327134b5126ff3db53a7732`.

The DW strict mode checks its worker snapshot at the requested final tick;
the existing default remains a 60-tick worker prefix.

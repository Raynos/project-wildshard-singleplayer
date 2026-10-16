# W2 sim lever: Pine + Driftwood creature hosts against G454 (2026-10-16, sp-o267)

Scope: the shared creature hosts that Pine Hollow (C4 3,724 lines) and Driftwood Isle (C4 1,664) call, graded against
Jake's G454 bar, and the sim code both shards can express as data rows. Measured at `cb9e3057d` in the check3 mirror
(`pnpm gen` + `node scripts/shard-platform.mjs --json`, spans by file).

The five tests (G454 (1)): **U** two real users · **N** no shard nouns · **D** shards differ only in data (no shard
TS callbacks, G454 (5)) · **S** a headless server can run it · **K** you'd keep it if its first shard vanished.

## 1. Where Pine's and Driftwood's C4 lines are

| Pine C4 (top) | lines | | Driftwood C4 (top) | lines |
|---|---:|---|---|---:|
| `game/systems/life/ambientLife.ts` (G294, Pine only) | 583 | | `runtime/keeper.ts` (native roster) | 299 |
| `data/journal.ts` `JOURNAL_ANIMALS` | 386 | | `runtime/looks/gullFlock.ts` (client) | 298 |
| `combat/eliteScripts.ts` | 225 | | `creatures/Enemies.ts` (page roster) | 146 |
| `runtime/species/limbRig.ts` (client) | 190 | | `species/captainPolicy.ts` | 100 |
| `combat/install.ts` | 169 | | `species/*Pose.ts` (client) | 201 |
| `runtime/nightDirector.ts`, `antlerKing.ts`, `king.ts` | 432 | | `combat/captain.ts` | 69 |
| `runtime/roster.ts` (native roster) | 148 | | `runtime/placement.ts` | 61 |
| `runtime/elites.ts`, `combat/elites.ts`, `eliteRoster.ts` | 216 | | `species/{crab,monkey,sailor}.ts` | 86 |
| `combat/strikes.ts` (TS strike builders) | 22 | | `combat/strikes.ts` (already data rows) | 0 C4 |

The one sim shape both shards really share is the **native creature roster**: Pine's `runtime/roster.ts` and
Driftwood's `runtime/keeper.ts` both roll a bake-checked load-time list on one creature stream, adopt bodies into the
hunting brain, run `bindRoster` cadence plus a charge loop on the fixed step, take live spawns under the manager's next
entity id, and save / restore a versioned continuation. The second shared shape is **creature strike rows**: Driftwood's
are data (`strike()` → `strikeFromData`), Pine's are TS builders carrying a `weight: () => 1` callback per row.

## 2. The creature hosts, graded

| Host (file) | Real users | U | N | D | S | K | Verdict |
|---|---|---|---|---|---|---|---|
| `createNativeHunt` + `huntRosterContinuation` (`game/plugin/brain.ts`) | Pine roster, DW keeper | ✓ | ✓ | ✗ `species` lookup fn; `wanderGoal` / `present` (Pine only) | ✓ | ✓ | **pass with callback debt** |
| `strikeFromData` / `StrikeData` (`engine/ai/strikeRows.ts`) | DW, Nalati (Pine after slice 1) | ✓ | ✓ | ✓ | ✓ | ✓ | **pass** |
| `admitSpeciesProgram` / declared brains (`format/brains`) | Sky, Signal, DW (`driftwoodSpeciesBrains`), boss rows | ✓ | ✓ | ✓ (presets are data) | ✓ | ✓ | **pass** |
| `nativeCreatureRecipes`, `creatureFloor` (`game/shardfile/homeKeeper.ts`) | Pine roster (+ Nalati `creatureFloor`) | ✓ (floor) / ✗ (recipes: Pine only) | ✓ | ✓ | ✓ | ✓ | floor **pass**; recipes **fail U** |
| `createNativeCreatureRoster` (`homeKeeper.ts`) | DW keeper only (Pine reimplements it) | ✗ | ✓ | ✗ `attach`, `joined`, `ground`, `retired`, `preflight` | ✓ | ? | **fail** (twin = Pine roster, §4 row R1) |
| `createMemoryActionBrain` (`brain.ts`) | DW crab, sailor, monkey, captain | ✗ | ✓ | ✗ `decide`, `effects` map, `beforeAct`, `threshold` | ✓ | ? | **fail** |
| `createNativeSpeciesContext` (`brain.ts`) | DW `enemyBrains` only | ✗ | ✓ | ✗ (`world` bag) | ✓ | ? | **fail** |
| `createCreatureSpawner` (`brain.ts`) | DW `Enemies.ts` only | ✗ | ✓ | ✗ `joined`, `grouped` | ✓ | ? | **fail** |
| `sampleCreatureGroup` (`brain.ts`) | DW `placement.ts` only (Pine uses engine `placeHerds`) | ✗ | ✓ | ✗ `accept`, `joined` | ✓ | ? | **fail** |
| `selectCreatureSites` (`brain.ts`) | DW `placement.ts`, `monkeyPolicy.ts` | ✗ | ✓ | ✗ `score` | ✓ | ? | **fail** |
| `sampleCreatureSwing`, `poseCreatureStride`, `stepCreatureLift` (`animation.ts`) | DW sailor / captain poses (+ `captainPolicy` lift) | ✗ | ✓ | ✓ | client pose (lift is sim) | ? | **fail U** |
| `NativeCreaturePose` / `createNativeCreaturePoses` (`animation.ts`) | Pine `kingPoseKeeper`, DW keeper | ✓ | ✓ | ✗ per-kind `animate` fns (`POSE_CALLBACKS`) | ✓ | ✓ | **pass with callback debt** |
| `EliteCore` (`game/Elite.ts`, `eliteSystem.ts`) | Pine elites, Nalati | ✓ | ✓ | ✗ per-elite `EliteCoreScript` TS | ✓ | ✓ | **pass with callback debt** (Pine's lanes already Wasm) |
| `stepEliteScript` / `EliteScriptLane` (`brain.ts`) | Pine only (ruler already counts it back, G294) | ✗ | ✓ | ✗ ports | ✓ | ? | **fail U** (already counted) |
| `phasedBossFight` (`sdk/phasedBoss.ts`, `bossPhase.ts`) | Pine King, Nalati Golden King | ✓ | ✓ | ✗ ports bag | ✓ | ✓ | **pass with callback debt** |
| `createAmbientLife` (`game/systems/life`) | Pine only (583 lines counted back, G294) | ✗ | ✗ (ravens, hares, carcass) | ✗ | client only | ✗ | **fail** (client; DW gulls are not a twin) |

Failing hosts for the planner's G454 audit: `createMemoryActionBrain`, `createNativeSpeciesContext`,
`createCreatureSpawner`, `sampleCreatureGroup`, `selectCreatureSites`, `createNativeCreatureRoster`,
`nativeCreatureRecipes`, `sampleCreatureSwing` / `poseCreatureStride` / `stepCreatureLift`, `stepEliteScript`,
`createAmbientLife`. All but the last are Driftwood-only W2 hosts with no Pine twin today.

## 3. Callback → data conversions (honest ones)

| # | Callback | Data instead | Users | Est. cut |
|---|---|---|---|---|
| C1 | Pine `PINE_LANES` / `PINE_STRIKES`: `weight: () => 1` per row, TS builders | `data/strikes.ts` rows through `strike()` (the CreatureStrike schema already has lane, arc + `yawOffset`, ring, exclusive point, `alternatives`, `motion`, `eligibility`, `units`) bound by `strikeFromData`; ready for the `actors/strikes` platform section | Pine + DW + Nalati | G454 fix; ~0 lines (rows move, builders go) |
| C2 | `createMemoryActionBrain` `effects` map for plain contacts (crab snap, sailor swing) | an action row's `contact: { strike, radius, scaleRadius?, damage?, sound }`; the host runs the strike-runner contact on the context's `player` / `reach` / `hurt` / `sound` | DW only (still fails U) | −10 DW |
| C3 | `createNativeHunt` `species: (kind) => row` | a kind-keyed table of species rows | Pine + DW | ~−4 |
| C4 | `NativeCreaturePose` `animate` per kind | needs the clip-row player (`playClips`) to cover DW's pose maths; not honest today | — | later (Wasm or clip rows) |

## 4. The big row (not landable in this lane's 90 min)

**R1 — one native creature roster host, Pine + DW.** Lift `createNativeCreatureRoster` so Pine's `installPineRoster`
runs on it: bake-checked boot rolls, `materialize` on the creature floor, live spawns under `EntityIds('creature')`,
the charge loop, and the continuation codec with each shard's saved wire kept as data (`version`, field names) so old
saves resume. Shard differences become rows: the boot order (herds → elite swap → parked prewarm → lair elites for Pine;
fauna → placed enemies → practice crab for DW), the per-kind ground rule (`sailor` → hold floor), the parked list.
Estimated cut **Pine −110, DW −180** (roster 148 → ~40, keeper 299 → ~120), and `createNativeCreatureRoster` and
`nativeCreatureRecipes` then pass U. Needs: an old-save resume per shard, the 17 headless checks, and a differential test
of id / kind / variant / seed / scale order against both bakes. One Opus row, ~3 h.

## 5. What this lane lands

Slice 1 = C1 (Pine strike rows as data). Slice 2 = C2 if it measures clean. Deltas and SHAs are in the commits and the
lane report.

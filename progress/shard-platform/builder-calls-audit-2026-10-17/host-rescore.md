# Independent host-bar re-score (G496 (3), 2026-10-18 ~00:00 Cancun)

Read-only Opus side agent of the plan agent; method of `progress/shard-platform/host-bar-scores-2026-10-17/`. Window: platform commits 10-17 15:37Z → `8950b5523`, plus feature commits the 10:37 pass missed. Test 1 exceptions = G473–G478 and pending-user entries. Lines = added (`git log --numstat`). Report only; fixes go to NEXT N4.

| Host | Lines | SHAs | Self | Independent | Verdict | Users | Cheapest fix (N4) |
|---|---|---|---|---|---|---|---|
| Held equipment catalogue (`format/heldEquipment.ts`, `game/plugin/heldEquipment.ts`, `models/heldGear.ts`) | +343 | 2d0e3fcb7, 74ca18dcf, 0d3bac6b0 | 5,6,5 | 2/6 (T2 :36,58-59 crossbow/lever, walnut/brushed-steel; T3 :57-71 required crossbow+lever+knife; heldGear.ts:27 lever→rifle; T5; T6 :10 `{input, owner, path}`) | Silly | Pine | One optional row per weapon family by item id; channel ids |
| Loadout (`format/loadout.ts`, `loadout/held.ts`, `nativeAmmunition.ts`, `persistence.ts`) | +377 | c7bd8fe24, 74ca18dcf | 5→6 | 2/6 (T2 held.ts:30,32 grantLongbow/hasRifle; T3 loadout.ts:14-17, held.ts:60-62 instanceof; T5; T6 held.ts:24-35 closures, :138-143 `later` callback) | Silly | Pine | Weapon rows {item, ammo, stack, save field}; `pouch.ts` 6/6 keep |
| Held tool (`plugin/heldTool.ts`) | +164 | 74ca18dcf | 6 | 5/6 (T3 :47, :20 kneelIn) | Borderline | Pine | Own `held/tool` row; out of plugin/ |
| Held finishes | +98 | 74ca18dcf | 6 | 5/6 (T2 heldFinishes.ts:11 icon picklist) | Borderline | Pine | Free icon id |
| Sword claims + held arms | +276 | 94a7eae0b | 6 | 5/6 (T3 heldArms.ts:40-41 wood/iron; claims.ts:150,155) | Borderline | DW | Blade + rig per weapon row |
| Item effects | +46 | 67d5565a2 | 6 | 6/6 | Real | DW, Pine | — |
| Boss encounter host (`format/bossEncounter.ts`, `game/boss/*`) | +506 | c023b2350 | 6 | 3/6 (T2 :10 sealK/darkK/rings/hazards, native.ts:31 ribs; T3 :28 strike+burst+summon+lanes, roaming/wake one-user shapes; T6 roaming.ts:19-28 ports, lane.ts:26,57 callbacks) | Borderline | Pine (roaming), DW (wake) | Phase/attack row list, optional kinds; free alias map; delete roaming ports |
| Collections display | +628 | d78cef781 | 5 | 3/6 (T2 collectionDisplay.ts:11 DW places, :46 hat/cape, collectionWall.ts:216 cabins; T3 keepsakes.ts:146-157; T6 keepsakes.ts:161, collectionWall.ts:212) | Borderline | keepsakes DW, wall Pine | Owners from context + ids; free slot/place ids |
| Spawn-group decisions | +352 −164 | 9c6361f6b, 74c87e851 | 6 | 6/6 | Real | Signal, Pine | — |
| Z2 world scenes | +1,177 | b133765b9, e4666bfd5, b90201ec9, 75aa5c92f, eeb9da351, 7671a2d04, bd3df46b1 | 5–6 | 6/6 (watch worldScenes.ts:311) | Real | DW, Pine | — |
| Z11 scene handles | +117 | 8e830e0be | 6 | 6/6 | Real | DW, Pine | — |
| Contracts | +259 | 00688a2f0 | 5 | 5/6 (T2 contracts.ts:8 `bolts`) | Borderline | Pine (G473) | Bolts as items/ammo grant |
| Spawn director (AS) | +644 −56 | f4e0c85ae, 17ef0c2e8 | 6 | 6/6 | Real | Pine | — |
| Elites | +475 | 17ef0c2e8 | 5 | 5/6 (T6 elitePage.ts:47-49 closures driven by pine combat/install.ts:160) | Borderline | Pine (G473) | Install from client plan |
| Living buildings | +273 | 56f8b161f | 6 | 6/6 | Real | DW, Pine | — |
| Baked building assembly | +479 | 56f8b161f | 6 | 4/6 (T2 buildings.ts:94 firePit/lantern; T3 :59-81 one cabin kit) | Borderline | Pine | Kit as named part rows |
| Z1 client plan | +156 | 6dfc334fc | 6 | 6/6 | Real | DW, Pine | — |
| declaredEntry.ts | +29 | 6dfc334fc | 5 | 4/6 (T5 scaffolding; T6 :7,11 class args + subclass) | Borderline | DW, Pine | Delete with runtimes (N5) |
| ViewFieldHost | +47 | 6dfc334fc | 6 | 5/6 (zero users) | Dead | — | G486 (6) deletes |
| Ambient flock | +374 | 5f63be75d | 6 | 6/6 | Real | DW, Pine | — |
| Quadruped limb rig | +751 | caa8ef651 | 5 | 5/6 (T1 by G474) | Real | Pine | — |
| Keyed sky | +493 | ae5134b93 | 5 | 5/6 (T1 by G474) | Real | Pine | — |
| Streamed cover + appearance | +483 | d9b1c450d, 7ddae8a5a | 6 | 6/6 | Real | DW, Pine | — |
| Toon look host | +205 | d9b1c450d | 6 | 5/6 (T1 by G475/G478) | Real | DW | — |
| Quest effects | +165 | db21e0e02 | 6 | 5/6 (T2 questSteps.ts:9 chunk/dawn) | Borderline | DW, Pine | Free cue id |
| Quest chapter services | +100 −86 | 11c99f5f2 | 6 | 5/6 (T2 chapter.ts:33,93 sting('chunk')) | Borderline | DW, Pine | Sting from story row |
| Quest step evaluator | −2 | 974e725c4 | 6 | 6/6 | Real | DW, Pine | — |
| Body slots | +133 | 4bf64d2e3 | 6 | 6/6 | Real | DW, Pine | — |
| Z3 declared input/quality | +176 | 231c16e4f | 6 | 6/6 (watch inputDeclarations.ts:6 bolt.cycle) | Real | all | — |
| NPC figures | +511 | 4e3060376 | 6 | 6/6 (watch figures.ts:11,20) | Real | DW, Pine | — |
| Return lifetimes | +253 | 62d4d3f96 | 5 | 5/6 (T1 only) | Real | DW | — |
| Engine/data infrastructure | +466 | 9bf3084da, 64265f932, 180f4d4e1, 2267c3066, 93053fc24, 8950b5523 | 6 | not hosts | — | all | — |
| Cable traversal (missed) | +110 | fadcc1761, 834bcd516 | — | 5/6 (T3 cableTraversal.ts:11,23 hard-coded numbers) | Borderline | DW, Pine (generators/zipline.ts:4) | Numbers into CableProfile row |
| Held launcher (missed) | +537 | 68e5031e5, 0d1882d3e, 62d6529a2, d85c07a95 | — | 5/6 (T6 pine combat/install.ts:107, runtime/index.ts:189; in plugin/) | Borderline | Pine, Nalati | Rows + game-layer install |
| Held firearm (missed) | +421 | ea8b57a58, 68e5031e5 | — | 5/6 (T6 nalati runtime/index.ts:128 `new HeldFirearm`) | Borderline | Pine, Nalati | Same |
| Word lists questStory / trader / compendiumRows / lootEconomy (missed) | +82/+116/+52/+93 | fa1e9031c, fe9e9906b, b64241e06, 7243fb059 | — | 4/4/4/5 (T2 all; T6 questStory.ts:19,41 `{owner,path}`, trader.ts:14 bindBorrowedMethod; T1 compendiumRows Pine-only untagged) | Borderline | various | Shard-declared strings; drop borrowed owners |

## Summary

- Self-scores: 17 of 31 held; all 14 misses were scored too high, none too low.
- E487 confirmed with one correction: `cableTraversal.ts` has two users (Pine declares a zipline row); its fault is the hard-coded numbers.
- Under 5/6 in window: 2,362 lines (held equipment 343, loadout 377, boss 506, collections 628, building assembly 479, declaredEntry 29) + 250 pre-window word lists. Borderline 5/6: 1,584 in window + 1,161 pre-window. Real: ~6,250.
- Worst: loadout held.ts 2/6 and held equipment catalogue 2/6 (Silly); boss host and collections 3/6; building assembly 4/6.
- Patterns: fixed word lists in src/format; page installers driven by shard TS with live objects; borrowed owner bundles.

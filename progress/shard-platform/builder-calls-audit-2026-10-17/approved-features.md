# approvedFeature module lists (G496 (2), 2026-10-17 ~23:50 Cancun)

Read-only Opus side agent of the plan agent. Lines = the ruler's `codeLines` on the working tree (75 whole modules 8,558; audit said 8,544, gap = uncommitted edits). Users = real value imports from `src/shards/<slug>/**`, direct or transitive (all runtime; none reached only through generators). "If struck" = lines the ruler spares today, from `progress/shard-platform/maps-batch-2026-10-17-7/all10-source-ruler.json` (with data-section host reach): Pine 4,109, DW 2,140 spared at HEAD. Multi-user modules charge only the declarations one shard alone reaches. PH Pine, DW Driftwood, NG Nalati, ND Nine, T templates, all = every shard + templates.

## Per feature (lines exempted vs Jake's estimate)

| Feature (G-row, estimate) | Exempted | Ratio | Recommended strikes |
|---|---|---|---|
| Contracts + elites (G473, ~550–700) | PH 547 | in range | none |
| Quest step runner (G474, ~700) | 178 (PH 83, DW 95) | under | none |
| Spawn director "actor-spawn" (G474 ~400, G475 shared) | 1,077 (PH 558, DW 519) | 2.7× | brain.ts `createNativeSpeciesContext` DW 42; geometry.ts `packedCreatureBodies` DW 66; animation.ts `stepCreatureLift` DW 26; sdk/headlessRuntime.ts `NativeBakeReader` PH 47; engine/ai/huntPattern.ts `bakedHuntGround` PH 17 |
| Boss fight host (G474, ~350) | 351 (PH 257, DW 94) | on | none |
| Living buildings (G474, ~400) | PH 231 | under | none |
| Loadout / ammo / skins (G474, ~250) | 802 (PH 638, DW 164) | 3.2× | plugin/heldTool.ts PH 112 (knife/brush/trowel viewmodel); claims.ts re-tag to held arms (G475), charges 0 |
| Quadruped rig + foot IK (G474, ~450) | PH 804 | 1.8× | limbQueryPose.ts PH 69, limbQueryView.ts PH 45 (antler king cage/lantern clocks) |
| Weather reactions + keyed sky (G474, ~350) | PH 346 | on | none |
| Bolt flight (Jake named 255) | PH 255 + 87 (`ProjectilePresentation`) | 1.3× | none |
| Water ripples (102), colour-ramp fog (23), low-poly binder (12), resident world (39), ambient flock (~450) | 102 / 23 / 12 / 39 / 0 | on | none |
| DW streamed cover (~240) | 352 | 1.5× | none |
| DW held arms (~150) | 317 | 2.1× | none |
| DW toon look (~100) | 134 | 1.3× | none |
| Collections (~220) | 592 (DW 391, PH 201) | 2.7× | engine+sdk models/geometrySources.ts PH 26 (generic bake decoder) |
| G483 Z1/Z2 (not in HOST-BAR list) | 0 (every shard uses them; ViewFieldHost unused) | — | none; tags do nothing today |

## Effect

- Recommended strikes: Pine +316 → 5,447 (target ≤4,261, 1,186 over); DW +134 → 3,843 (≤3,433, 410 over).
- Strike everything: Pine ~9,240, DW ~5,849.
- Capping loadout, spawn director and quadruped rig at their estimates would charge Pine ~1,300 more than the strikes.
- Accurate to ±10 %: contracts, boss, weather/keyed sky, ripples, fog, binder, resident world.

## Data problems

- The working-tree `lint/platform-pending-users.json` lists `worldSceneSurface.ts` twice; the ruler stops with "Duplicate pending platform user" (someone's uncommitted edit).
- Working tree charges less than HEAD for heldLauncher (10 vs 255), heldEquipment (8 vs 145), heldTool (22 vs 112), returnProgram (0 vs DW 76), from uncommitted held / DW work; recheck after it lands.

# sunscar-dunes: remaining custom code

Measured from source revision `aa0007f30cb89b7abcc1f766184625187dd8a266` on 2026-10-13.
Produced by `scripts/shard-custom-inventory.mjs`, using the exact source spans
from G294/G390. No builder, renderer or gameplay owner executes to make this report.

| Measure | Lines |
|---|---:|
| Shard runtime TS | 1741 |
| Additional raw GLSL | 6 |
| Sole-user platform | 113 |
| **Custom total** | **1860** |
| Frozen legacy | 4122 |
| Custom / legacy | 45.1 % |
| 20 % bar | 824 |

## Parts

| Part | Lines |
|---|---:|
| Additional raw GLSL | 6 |
| boot | 9 |
| combat | 31 |
| explore | 5 |
| Installers | 7 |
| look | 51 |
| models | 46 |
| quest | 48 |
| quests | 4 |
| runtime | 1013 |
| Shard declarations | 166 |
| Sole-user platform (G294) | 113 |
| species | 17 |
| thumbs | 4 |
| weapons | 39 |
| world | 301 |

## Source checklist

| Source | Contribution | Lines | File bytes | Longest line |
|---|---|---:|---:|---:|
| src/shards/sunscar-dunes/data/lightLook.ts | additional-glsl | 6 | 972 | 134 |
| src/shards/sunscar-dunes/boot/files.ts | runtime-ts | 9 | 1372 | 382 |
| src/shards/sunscar-dunes/combat/creatures.ts | runtime-ts | 11 | 1276 | 170 |
| src/shards/sunscar-dunes/combat/matriarch.ts | runtime-ts | 20 | 2460 | 204 |
| src/shards/sunscar-dunes/explore/art.ts | runtime-ts | 5 | 633 | 125 |
| src/shards/sunscar-dunes/runtime/headless.ts | runtime-ts | 5 | 717 | 112 |
| src/shards/sunscar-dunes/runtime/index.ts | runtime-ts | 2 | 324 | 125 |
| src/shards/sunscar-dunes/look/dusk.ts | runtime-ts | 11 | 1234 | 121 |
| src/shards/sunscar-dunes/look/light.ts | runtime-ts | 16 | 1285 | 157 |
| src/shards/sunscar-dunes/look/render.ts | runtime-ts | 16 | 1867 | 179 |
| src/shards/sunscar-dunes/look/sandEntry.ts | runtime-ts | 8 | 545 | 119 |
| src/shards/sunscar-dunes/models/gear.ts | runtime-ts | 46 | 4885 | 184 |
| src/shards/sunscar-dunes/quest/install.ts | runtime-ts | 48 | 5284 | 231 |
| src/shards/sunscar-dunes/quests/scout.ts | runtime-ts | 4 | 408 | 102 |
| src/shards/sunscar-dunes/runtime/audio/cues.ts | runtime-ts | 19 | 1350 | 150 |
| src/shards/sunscar-dunes/runtime/items.ts | runtime-ts | 20 | 1386 | 128 |
| src/shards/sunscar-dunes/runtime/items/lash.ts | runtime-ts | 74 | 8808 | 216 |
| src/shards/sunscar-dunes/runtime/items/lashHold.ts | runtime-ts | 41 | 4310 | 238 |
| src/shards/sunscar-dunes/runtime/items/lashHost.ts | runtime-ts | 79 | 6869 | 192 |
| src/shards/sunscar-dunes/runtime/items/lashView.ts | runtime-ts | 37 | 3563 | 171 |
| src/shards/sunscar-dunes/runtime/items/lashWeapon.ts | runtime-ts | 86 | 8254 | 210 |
| src/shards/sunscar-dunes/runtime/lashInput.ts | runtime-ts | 31 | 2739 | 134 |
| src/shards/sunscar-dunes/runtime/looks/bakedGround.ts | runtime-ts | 73 | 7666 | 184 |
| src/shards/sunscar-dunes/runtime/looks/duskFamilies.ts | runtime-ts | 21 | 2021 | 145 |
| src/shards/sunscar-dunes/runtime/looks/duskLook.ts | runtime-ts | 78 | 6702 | 197 |
| src/shards/sunscar-dunes/runtime/looks/fireFx.ts | runtime-ts | 262 | 18793 | 297 |
| src/shards/sunscar-dunes/runtime/looks/paintedStrips.ts | runtime-ts | 10 | 1479 | 178 |
| src/shards/sunscar-dunes/runtime/looks/stormShell.ts | runtime-ts | 40 | 2876 | 131 |
| src/shards/sunscar-dunes/runtime/persistence.ts | runtime-ts | 7 | 588 | 147 |
| src/shards/sunscar-dunes/runtime/shardfile/markedBoss.ts | runtime-ts | 43 | 3328 | 189 |
| src/shards/sunscar-dunes/runtime/signalPlan.ts | runtime-ts | 83 | 7209 | 182 |
| src/shards/sunscar-dunes/runtime/source.ts | runtime-ts | 3 | 290 | 114 |
| src/shards/sunscar-dunes/runtime/species/skitterer.ts | runtime-ts | 2 | 317 | 140 |
| src/shards/sunscar-dunes/runtime/standalone.ts | runtime-ts | 4 | 461 | 111 |
| src/shards/sunscar-dunes/manifest.ts | runtime-ts | 48 | 4400 | 213 |
| src/shards/sunscar-dunes/plugin.ts | runtime-ts | 110 | 10412 | 222 |
| src/shards/sunscar-dunes/roster.ts | runtime-ts | 8 | 965 | 196 |
| src/engine/render/families/ground.ts#GroundPool | sole-export | 1 | 20241 | 243 |
| src/engine/render/families/ground.ts#setGroundPools | sole-export | 11 | 20241 | 243 |
| src/engine/render/materialPreparation.ts#registerMaterialPreparation | sole-export | 8 | 1311 | 120 |
| src/engine/world/Atmosphere.ts#weatherFog | sole-export | 8 | 13593 | 232 |
| src/engine/world/Atmosphere.ts#WeatherFog | sole-export | 1 | 13593 | 232 |
| src/engine/world/Atmosphere.ts#WeatherFogSpec | sole-export | 5 | 13593 | 232 |
| src/engine/world/bakedTerrainField.ts#BakedTerrainMetadata | sole-export | 1 | 4247 | 166 |
| src/engine/world/bakedTerrainField.ts#createBakedTerrainField | sole-export | 21 | 4247 | 166 |
| src/game/plugin/geometry.ts#facetMaterial | sole-export | 1 | 94226 | 610 |
| src/game/plugin/geometry.ts#installPivotNpc | sole-export | 8 | 94226 | 610 |
| src/game/plugin/geometry.ts#NpcSurface | sole-export | 1 | 94226 | 610 |
| src/game/plugin/geometry.ts#PivotNpcLevel | sole-export | 6 | 94226 | 610 |
| src/game/plugin/geometry.ts#PivotNpcPorts | sole-export | 9 | 94226 | 610 |
| src/game/plugin/geometry.ts#withoutTriangles | sole-export | 9 | 94226 | 610 |
| src/game/plugin/headless.ts#bindRuntimeItemContexts | sole-export | 8 | 31785 | 271 |
| src/game/plugin/simulation.ts#admittedTerrain | sole-export | 6 | 56699 | 304 |
| src/game/saves.ts#shardSave | sole-export | 3 | 2156 | 215 |
| src/sdk/looks/modelLibrary.ts#facetMaterial | sole-export | 1 | 2334 | 491 |
| src/sdk/looks/modelLibrary.ts#HdLookRow | sole-export | 1 | 2334 | 491 |
| src/sdk/looks/modelLibrary.ts#ModelLibraryRows | sole-export | 1 | 2334 | 491 |
| src/sdk/looks/modelLibrary.ts#undrawnRig | sole-export | 1 | 2334 | 491 |
| src/sdk/looks/modelLibrary.ts#withoutTriangles | sole-export | 1 | 2334 | 491 |
| src/sdk/speciesBrains.ts#SpeciesBrain | sole-export | 1 | 1490 | 214 |
| src/shards/sunscar-dunes/species/duneRay.ts | runtime-ts | 3 | 314 | 138 |
| src/shards/sunscar-dunes/species/matriarch.ts | runtime-ts | 8 | 998 | 138 |
| src/shards/sunscar-dunes/species/skitterer.ts | runtime-ts | 3 | 335 | 121 |
| src/shards/sunscar-dunes/species/strider.ts | runtime-ts | 3 | 344 | 144 |
| src/shards/sunscar-dunes/thumbs/card.ts | runtime-ts | 4 | 459 | 118 |
| src/shards/sunscar-dunes/weapons/Bullwhip.ts | runtime-ts | 15 | 1580 | 224 |
| src/shards/sunscar-dunes/weapons/rows.ts | runtime-ts | 11 | 1042 | 194 |
| src/shards/sunscar-dunes/weapons/whipModel.ts | runtime-ts | 13 | 1647 | 250 |
| src/shards/sunscar-dunes/world/baked.ts | runtime-ts | 29 | 3463 | 222 |
| src/shards/sunscar-dunes/world/build.ts | runtime-ts | 112 | 10834 | 251 |
| src/shards/sunscar-dunes/world/drapeGround.ts | runtime-ts | 17 | 1552 | 209 |
| src/shards/sunscar-dunes/world/fireFx.ts | runtime-ts | 7 | 1162 | 165 |
| src/shards/sunscar-dunes/world/meshes.ts | runtime-ts | 24 | 3452 | 203 |
| src/shards/sunscar-dunes/world/places.ts | runtime-ts | 78 | 10135 | 231 |
| src/shards/sunscar-dunes/world/resources.ts | runtime-ts | 10 | 536 | 111 |
| src/shards/sunscar-dunes/world/tower.ts | runtime-ts | 24 | 2915 | 250 |

Runtime TS includes its embedded shaders once; only excluded data/generator GLSL
is added separately. A sole-user platform export counts only its measured span,
while bytes and longest line describe the containing source. Pure config entries,
declared generated outputs, comments and frozen copies follow the canonical rules.

Rows and shared owners can retire glue, quest wiring and creature scheduling.
Raw shader looks and geometry adoption belong to Opus; a moved function is not a cut.
Gameplay traces and refusal contracts remain exact unless a re-record is approved.

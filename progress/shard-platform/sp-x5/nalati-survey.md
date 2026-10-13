# Nalati explorer generator survey

Committed source pin: `a629653cdf92acbcfc76542856dc6af14cf08518`. Source census, not a new browser capture.

Model checklist: 91 Nalati definitions in 32 defining files (34 model files including two NPC rig/motion helpers). The boot roster also supplies shared swim hands, training dummy and hoverboard: retain their shared authoring identity, do not clone them into Nalati. Set and World checklists each have the same 17 named places. Empty sets are currently omitted at runtime; qualification must retain that rule and exact ordered membership.

## Models

| Defining source | Lines | Explorer models | Needed generator output |
|---|---:|---|---|
| models/ambientLife.ts | 119 | butterfly, raptor | rig, skinned geometry, rest/bones, clips, material/variant rows |
| models/balbal.ts | 187 | balbal | named Mesh/Group geometry, material slots, variants and collision rows |
| models/campGenerated.ts | 95 | kazan, chest, firewood, kumis-churn, ground-saddle, perched-eagle | retained GLB intake, fitted geometry and material rows |
| models/campProps.ts | 117 | ribbon-pole, eagle-perch, stove, camp-bench, rug-rack, felt-rug, cart, barrel, hitching-rail, water-trough, saddle-rack, corral, hay-pile, feed-trough, rug-line, chopping-block, milk-cans, tether-line, kurt-board, ribbon-post | named Mesh/Group geometry, material slots, variants and collision rows |
| models/cragLedge.ts | 41 | crag-ledge | named Mesh/Group geometry, material slots, variants and collision rows |
| models/cragRock.ts | 173 | crag-rock | named Mesh/Group geometry, material slots, variants and collision rows |
| models/creatures.ts | 135 | horse, argymaq, wolf, sheepdog, aqbars, kokbori, qyran, ghost-rider, balbal-warrior, golden-king, sheep, marmot, storm-titan | rig, skinned geometry, rest/bones, clips, material/variant rows |
| models/dressing.ts | 154 | boulder, slab, stone, juniper, wild-rose, dwarf-willow, lupin, daisy, reed | named Mesh/Group geometry, material slots, variants and collision rows |
| models/dressingProps.ts | 292 | fallen-log, stump, ovoo, viewpoint-pole, sky-gateway, camp-clutter | named Mesh/Group geometry, material slots, variants and collision rows |
| models/eagleRock.ts | 133 | eagle-rock | named Mesh/Group geometry, material slots, variants and collision rows |
| models/fence.ts | 85 | fence | named Mesh/Group geometry, material slots, variants and collision rows |
| models/fieldstone.ts | 48 | fieldstone | named Mesh/Group geometry, material slots, variants and collision rows |
| models/gear.ts | 154 | bow, arrow, sabre, spear, javelin, golden-bow, naizagai, ar-15 | named Mesh/Group geometry, material slots, variants and collision rows |
| models/glacierSnout.ts | 72 | glacier-snout | named Mesh/Group geometry, material slots, variants and collision rows |
| models/herdHorse.ts | 15 | herd-horse | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kokparGoal.ts | 27 | kokpar-goal | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kokparPost.ts | 22 | kokpar-post | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kokparRider.ts | 15 | kokpar-rider | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kunesBridge.ts | 30 | kunes-bridge | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kurganEntrance.ts | 149 | kurgan-entrance | named Mesh/Group geometry, material slots, variants and collision rows |
| models/kurganKerb.ts | 37 | kurgan-kerb | named Mesh/Group geometry, material slots, variants and collision rows |
| models/leopardCave.ts | 103 | leopard-cave | named Mesh/Group geometry, material slots, variants and collision rows |
| models/outcrop.ts | 116 | granite-outcrop, rounded-boulder | named Mesh/Group geometry, material slots, variants and collision rows |
| models/people.ts | 88 | camp-people, shepherd | rig, skinned geometry, rest/bones, clips, material/variant rows |
| models/reins.ts | 42 | reins | named Mesh/Group geometry, material slots, variants and collision rows |
| models/saddledHorse.ts | 15 | saddled-horse | named Mesh/Group geometry, material slots, variants and collision rows |
| models/signpost.ts | 148 | signpost | named Mesh/Group geometry, material slots, variants and collision rows |
| models/snowLotus.ts | 15 | snow-lotus | named Mesh/Group geometry, material slots, variants and collision rows |
| models/stoneStep.ts | 36 | stone-step | named Mesh/Group geometry, material slots, variants and collision rows |
| models/watchtower.ts | 25 | watchtower | named Mesh/Group geometry, material slots, variants and collision rows |
| models/windCairn.ts | 122 | wind-cairn | named Mesh/Group geometry, material slots, variants and collision rows |
| models/yurt.ts | 51 | yurt | named Mesh/Group geometry, material slots, variants and collision rows |

## Sets and World

| Named World place | Set | Defining builder | Lines | Needed generator output |
|---|---|---|---:|---|
| Nomad Camp | spring-camp | world/NomadCamp.ts | 42 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Sheep Pasture | sheep-pasture | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Bridge | bridge | world/Bridge.ts | 19 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Kunes River | kunes-river | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Sky Road | sky-road | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Eagle Rock | eagle-rock-knoll | world/EagleRock.ts | 22 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Horse Plains | horse-plains | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Kokpar Field | kokpar-field | world/Bowl.ts | 326 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Kurgan Field | kurgan-field | world/KurganField.ts | 98 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Great Kurgan | great-kurgan | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Summer Camp | summer-camp | world/SummerCamp.ts | 28 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Watchtower | watchtower-hill | world/Bowl.ts | 326 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Wind Cairn | wind-cairn-rise | world/Cairn.ts | 25 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| Glacier | glacier | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Snow Leopard Cave | crags | world/Crags.ts | 65 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |
| The Crags | the-crags | world/places.ts | 106 | ordered model memberships, exact box-centre/radius slicing over authored placements |
| Snow Lotus | snow-lotus-meadow | world/Bowl.ts | 326 | named scene, ordered placements, ground/colliders and set membership; effect spawn rows |

## Builder and helper closure

| Source | Lines | Current lower-layer imports |
|---|---:|---|
| generators/bake-nalati-bodies.d.mts | 5 | local/three.js |
| generators/bake-nalati-places.d.mts | 9 | local/three.js |
| generators/balbalBody.ts | 115 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/bodies.ts | 99 | @wildshard/engine/core/rng, @wildshard/engine/entities/species/registry |
| generators/campProps.ts | 458 | @wildshard/engine/models/model, @wildshard/engine/physics/box, @wildshard/engine/world/geometryKit |
| generators/canidBody.ts | 276 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/dressingGeos.ts | 374 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/world/geometryKit |
| generators/eagleBody.ts | 101 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/goldenKingBody.ts | 251 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/horseBody.ts | 396 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/kunesBridge.ts | 144 | @wildshard/engine/models/model, @wildshard/engine/world/registry, @wildshard/engine/world/geometryKit |
| generators/leopardBody.ts | 175 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/entities/species/loft, @wildshard/engine/entities/species/registry |
| generators/nalati-world-inventory.d.mts | 16 | local/three.js |
| generators/nalatiCaptureInventory.ts | 151 | @wildshard/engine/models/model, @wildshard/engine/models/colliders |
| generators/nalatiGroundSource.ts | 106 | @wildshard/sdk/bake/nativeLattice, @wildshard/sdk/bake/glb, @wildshard/sdk/assets, @wildshard/sdk/bake/worldLod, @wildshard/engine/world/BakedTerrain |
| generators/nalatiMeshAssignments.ts | 118 | local/three.js |
| generators/nalatiWorldRows.ts | 40 | @wildshard/sdk/bake/worldRows, @wildshard/sdk/bake/staticMaterials, @wildshard/format/nativeGround |
| generators/navigation.ts | 7 | @wildshard/sdk/bake |
| generators/physics.ts | 9 | local/three.js |
| generators/physicsCapture.d.mts | 2 | local/three.js |
| generators/places.ts | 374 | @wildshard/engine/models/model, @wildshard/engine/world/terrainHeight, @wildshard/engine/world/BakedTerrain |
| generators/qara.ts | 8 | @wildshard/sdk/compileScript |
| generators/terrain.ts | 12 | @wildshard/sdk/bake/terrain |
| generators/weaponHooks.ts | 11 | @wildshard/sdk/buildBehaviour, @wildshard/format/weaponHooks |
| generators/yard.ts | 65 | @wildshard/engine/core/noise |
| generators/yurt.ts | 274 | @wildshard/engine/models/model, @wildshard/engine/world/registry, @wildshard/engine/world/geometryKit |
| world/Balbals.ts | 100 | @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/physics/box, @wildshard/engine/world/registry |
| world/Bowl.ts | 326 | @wildshard/engine/core/rng, @wildshard/engine/core/tier, @wildshard/engine/models/place, @wildshard/engine/render/shaderPatches, @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/sdk/looks/shaderFamily, @wildshard/game/plugin/ui |
| world/Bridge.ts | 19 | local/three.js |
| world/Cairn.ts | 25 | local/three.js |
| world/Crags.ts | 65 | local/three.js |
| world/EagleRock.ts | 22 | local/three.js |
| world/Flutter.ts | 176 | @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig |
| world/KurganDungeon.ts | 922 | @wildshard/engine/app/runtime, @wildshard/engine/core/clock, @wildshard/engine/core/rng, @wildshard/engine/fx/groundFx, @wildshard/engine/physics/box, @wildshard/engine/physics/surface, @wildshard/engine/world/registry, @wildshard/engine/world/geometryKit |
| world/KurganField.ts | 98 | local/three.js |
| world/NomadCamp.ts | 42 | local/three.js |
| world/RoadFurniture.ts | 75 | local/three.js |
| world/Smoke.ts | 78 | @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/sdk/looks/shaderFamily |
| world/Spruce.ts | 270 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/render/look, @wildshard/engine/world/forest/treeSpec, @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/engine/world/TreeFactory |
| world/Stair.ts | 73 | local/three.js |
| world/SummerCamp.ts | 28 | local/three.js |
| world/Weather.ts | 317 | @wildshard/engine/core/rng, @wildshard/engine/world/weather |
| world/WeatherFX.ts | 446 | @wildshard/game/systems/looks/rainCurtain, @wildshard/engine/core/rng, @wildshard/engine/world/Atmosphere, @wildshard/engine/world/Heightfield, @wildshard/engine/world/terrainHeight, @wildshard/sdk/looks/shaderFamily |
| world/Yard.ts | 23 | @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig |
| world/clearings.ts | 44 | local/three.js |
| world/dressing/index.ts | 284 | @wildshard/engine/core/clock, @wildshard/engine/boot/plan, @wildshard/engine/core/tier, @wildshard/engine/world/frameCamera, @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/physics/box, @wildshard/engine/render/renderer, @wildshard/engine/world/forest/Forest, @wildshard/engine/world/painterly, @wildshard/engine/world/registry, @wildshard/engine/world/skyRig |
| world/dressing/layer.ts | 163 | @wildshard/engine/core/noise |
| world/dressing/life.ts | 225 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/core/tier, @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/engine/world/steppeWind, @wildshard/engine/world/terrainHeight, @wildshard/game/systems/looks/grassField, @wildshard/sdk/looks/shaderFamily |
| world/dressing/place.ts | 740 | @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/world/forest/Forest, @wildshard/engine/world/Heightfield, @wildshard/engine/world/terrainHeight, @wildshard/game/systems/looks/grassField |
| world/dressing/statics.ts | 178 | @wildshard/engine/core/rng, @wildshard/engine/physics/box, @wildshard/engine/world/registry, @wildshard/engine/world/skyRig, @wildshard/engine/world/terrainHeight |
| world/glbPaint.ts | 365 | @wildshard/engine/app/cachedAssets, @wildshard/engine/core/tier, @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/engine/world/voxelAO |
| world/granite.ts | 33 | @wildshard/engine/world/geometryKit, @wildshard/engine/core/noise, @wildshard/engine/world/geometryBake |
| world/index.ts | 185 | @wildshard/engine/core/clock, @wildshard/engine/app/runtime, @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/world/registry, @wildshard/engine/world/skyRig, @wildshard/engine/world/terrainHeight |
| world/installWeather.ts | 282 | @wildshard/engine/audio/Audio, @wildshard/engine/core/Game, @wildshard/engine/core/tier, @wildshard/engine/physics/box, @wildshard/engine/player/Player, @wildshard/engine/ui/HUD, @wildshard/engine/world/dayCycle, @wildshard/engine/world/forest/Forest, @wildshard/engine/world/skyRig, @wildshard/engine/world/steppeWind, @wildshard/engine/world/terrainHeight, @wildshard/game/shard/context, @wildshard/game/shard/manifest, @wildshard/engine/core/noise |
| world/layout.ts | 62 | local/three.js |
| world/paint.ts | 352 | @wildshard/engine/app/cachedAssets, @wildshard/engine/core/noise, @wildshard/engine/core/rng, @wildshard/engine/world/geometryKit, @wildshard/engine/world/geometryBounds, @wildshard/engine/world/painterly, @wildshard/engine/world/skyRig, @wildshard/engine/world/voxelAO |
| world/painted.ts | 355 | @wildshard/engine/core/rng, @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/world/registry, @wildshard/engine/world/skyRig, @wildshard/engine/world/terrainHeight |
| world/placeBake.ts | 303 | @wildshard/engine/world/geometryBounds, @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/physics/surface, @wildshard/engine/world/registry, @wildshard/sdk/kit/bakedGeometry |
| world/places.ts | 106 | @wildshard/engine/models/place, @wildshard/engine/models/sets, @wildshard/engine/world/registry |
| world/props.ts | 73 | local/three.js |
| world/rainProgram.ts | 10 | @wildshard/sdk/looks/shaderFamily |
| world/solid.ts | 119 | @wildshard/engine/physics/box, @wildshard/engine/physics/surface, @wildshard/engine/world/registry |
| world/terrain.ts | 552 | @wildshard/engine/core/config, @wildshard/engine/core/noise, @wildshard/engine/world/terrainField, @wildshard/game/shard/manifest |
| world/types.ts | 49 | @wildshard/engine/models/model, @wildshard/engine/models/place, @wildshard/engine/physics/surface, @wildshard/engine/world/registry, @wildshard/engine/world/skyRig |
| world/weatherProfile.ts | 66 | @wildshard/engine/world/weather |
| world/weatherStep.ts | 88 | local/three.js |

## Port order and exactness

Local TS census: {'generators': [26, 3596], 'models': [34, 3145], 'world': [40, 7739]}; total 100 files / 14480 physical lines. This is not the dynamically loaded ~22k bridge closure.

1. Nine dressing Model entries: remove engine noise/RNG/geometry-bake imports; retained author-only three.js recipes, SDK random, exact native dressing rows and all vertex/index bytes. Existing explorers already read the dressing bake; they continue to read that exact output.
2. Camp/yurt/bridge/20 props: split pure paint/UV/AO geometry and effect declarations from renderer materials and registry services; compose real three.js author Scenes and named outputs.
3. Remaining placed structures, outcrops/crags, roads/fences, kurgans/glacier and terrain-dependent set placement: authored native terrain sampler, explicit authored layout, exact ordered placement/collider/query rows.
4. People/fauna/gear: pure rig/skin/clip/variant recipes and retained model byte intake, delete production imports of species brains, page materials and live ModelContext.
5. Assemble all 17 Set/World explorer outputs from those generators; remove runtime world capture as production input only after every current output is accounted for.

CALL: preserve native people/herd/cloth/smoke motion as runtime owners while rest geometry, rig/clip and effect spawn declarations become author output. No gameplay rewrite is included.
CALL: no guessed input-root exclusions. Each author job must qualify its complete imports, explicit file reads and generated prerequisites; byte-exact rows and compressed artifacts, Linux pins, then normal hook physics/nav/map fences.
Graphical change is not intended. Any necessary changed look needs coordinator-staffed Opus parity and an explicit re-record; no tolerance comparator substitutes for byte equality.

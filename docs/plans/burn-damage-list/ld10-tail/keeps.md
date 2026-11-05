> QD7 LD10 census (read-only, 2026-11-04, sp-o5's subagent), copied from scratch for the BURN-DAMAGE-LIST 'LD10 tail' row.
> Census of the working tree at the time: LD9a landed, NF18 then uncommitted (it landed as 13253e2609). LD10 slice 1
> (SDK audio wrappers, seven whole-module orphans, NF18 dead arms/exports, stale ENGINE.md passages) is done; the rest
> is the tail. The `tmp/qd7-ld10/work/` scripts mentioned below were scratch and are gone.

# LD10 census: keeps (working tree, 2026-11-04)

Every candidate that must stay, with its actual reader (file:line). Readers are code lines (comments excluded).

## Modules that look orphaned or tool-only to an app-only graph

| Module | Actual reader | Why it stays |
|---|---|---|
| `src/engine/client/world/blenderArea.ts` | `scripts/blender/lib/export-scene.mjs:62` (`imp('src/engine/client/world/blenderArea.ts')`), `test/driftwood-ground-bounds.test.ts:3`, `scripts/decide/layer-purity-pilot.mjs` (string) | Blender string load (plan names it) |
| `src/format/groupBrains.ts` | `src/format/shardSchema.ts`, `src/format/creatures.ts`, `src/engine/server/ai/grazer.ts`, `src/engine/server/ai/stalker.ts`, `src/engine/shared/script/groupStepV2.ts` | modern schema, app-reached |
| `src/engine/client/pwa/sw.js`, `src/engine/client/app/workerScope.js` | `scripts/app-build/serviceWorker.ts:45-46` (read and inlined as the service worker), `test/pwa-worker-lifecycle.test.ts` | service-worker source |
| `src/engine/client/boot/sw.ts` | `index.html:371` | page SW registration |
| `src/engine/client/boot/imageDecode.worker.ts` | `src/engine/client/boot/imageDecode.ts:46` (`new URL`) | worker entry |
| `src/engine/client/boot/liveJsonParser.worker.ts` | `src/engine/client/boot/liveJsonParser.ts:28` | worker entry |
| `src/engine/client/core/ktx2Zstd.worker.ts` | `src/engine/client/core/ktx2Zstd.ts:50` | worker entry |
| `src/engine/client/player/viewmodelTextures.worker.ts` | `src/engine/client/combat/view/ranged.ts:116` (`?worker&inline`) | worker entry |
| `src/sdk/bin/wildshard.mjs` → `src/sdk/cli.ts` | `src/sdk/package.json` `bin`; `scripts/build-sdk.mjs`, `scripts/bake-check.mjs` (string) | SDK CLI root |
| `src/sdk/bake/source-loader.mjs` | `src/sdk/bake/native-scalar.test.ts:48` (`--import ./src/sdk/bake/source-loader.mjs`); CLI usage `src/shards/pine-hollow/generators/bake-pine-trophies.mjs:6`, `scripts/bake-captain-coat.mjs:4` | Node author loader |
| `src/sdk/bake/{json,navigation-json}.mjs` | `src/sdk/bake/source-loader.mjs:18` (string dispatch), `test/json-output-guard.test.ts` (`new URL`) | drivers of the loader |
| `src/sdk/bake/headlessWorker.ts` | `scripts/build-sdk.mjs` (string entry), `src/sdk/headlessCodec.test.ts` | built worker entry |
| `src/game/client/boot/{audio,bytes,packs,versions}.generated.ts`, `src/game/server/shard/portShares.generated.ts`, `src/game/client/systems/effects/starter.generated.ts` | generators `scripts/app-build/gen.ts`, `scripts/source-generators.mjs`, `scripts/gen-starter-effects.mjs` (string); app via dynamic imports | generated outputs |
| 17 `*.d.ts` / `*.merge.d.ts` (orphans.md §1) | tsconfig `include` of each layer project | declaration roots (AGENTS.md E434) |
| 23 `src/sdk/**` modules read only by `src/shards/*/generators/**` (e.g. `bake/compactGlb` 16 generators, `bake/groundMap` 15, `speciesBrains` 9, `bootInventory` 9) | shard generators (author roots) | author/bake API |
| `src/sdk/outputRuntime.ts`, `src/sdk/executeBundle.ts`, `src/sdk/runtimePerformance.ts` | `src/sdk/project.ts`, `src/sdk/cli.ts` (type), `scripts/bake-template-shardfile.mjs`, `src/sdk/synth.ts` | **LD9b** decides (copied-runtime arm), not LD10 |
| `src/game/client/shardfile/hybrid.ts` (`prepareHybridShard`) | `src/game/client/shard/declaredEntry.ts:2,15`, `src/game/client/grid/liveSession.ts`, `src/game/client/grid/regionalRuntime.ts`, `src/game/client/shardfile/clientWorldAssembly.ts` | live entry composite; its runtime-TS arm is LD9b |
| `src/game/shared/quest/legacyRecords.ts`, `test/fixtures/quest-step-legacy-saves.*`, `test/fake/legacy{Actor,Hurt,Source}.ts`, `test/fixtures/legacy-oracles/**` | modern save migration and native oracles (plan text) | historical fixtures, not loading paths |
| `scripts/g571-hosts.mjs`, `scripts/listed-view-code.mjs` | `scripts/shard-platform.mjs:13,17` (G294 attribution and listed-view register), `scripts/platform-chargebacks.mjs`, `scripts/precommit-jobs.mjs:72` | not copied-runtime paths (orphans.md §7) |

`lint/ratchet.json` `wildshard/sdk-no-facade` rows that stay after the audio wrappers go (each still has a real
author/tool caller): `src/sdk/kit/bakedGeometry.ts` 7, `src/sdk/phasedBoss.ts` 9, `src/sdk/species/clips.ts` 11,
`src/sdk/speciesBrains.ts` 3, `src/sdk/weapons/bowProfile.ts` 4, `src/sdk/weapons/meleeProfile.ts` 2.

## ShardContext / ShardPlugin / LevelContext members that stay

| Member | Reader |
|---|---|
| `ShardContext.bag.tab` | `src/game/client/shard/declaredUi.ts:19`, `src/game/client/shard/retainedHooks.ts:168` |
| `ShardContext.bag.fragment` | `src/game/client/shardfile/clientFinds.ts:18`, `src/game/client/shard/declaredUi.ts:20` |
| `rows.item` | `src/game/client/shardfile/clientCatalogue.ts:41`, `src/game/client/session/session.ts:155` |
| `rows.lootTable` | `src/game/client/shardfile/client.ts:331`, `src/game/client/population/productCreatures.ts:43` |
| `rows.shop` | `src/game/client/shardfile/clientCatalogue.ts:32` |
| `rows.feat` | `src/game/client/shardfile/clientCatalogue.ts:42` |
| `rows.compendium` | `src/game/client/shardfile/client.ts:330`, `src/game/client/shardfile/clientCatalogue.ts:27` |
| `rows.skin` | `src/game/client/shardfile/clientCatalogue.ts:33` |
| `cube` | `src/game/client/audio/sceneDirector.ts:223` |
| `manifest`, `product`, `game.{residency,runtime,declaredAudio,shard,rows,bag}` | many (e.g. `src/game/client/shardfile/client.ts`, `src/game/client/plugin/audio.ts`) |
| `LevelContext.playground` | `src/game/client/practice/registration.ts:10` |
| `LevelContext.tiers.knobs` | `src/game/client/shardfile/client.ts:243`, port at `:569` |
| `LevelContext.debugRow` | port `src/game/client/shardfile/client.ts:569` → `src/game/client/shard/declaredPlumbing.ts:66` |
| `LevelContext.strings` | `src/game/client/shardfile/clientPlan.ts:273` |
| `LevelContext.inputContext` | `src/game/client/riding/client.ts:256`, `src/game/server/shardfile/pageItems.ts:55`, `src/game/client/stealth/controller.ts:47` |
| `EngineRows.{weapon,tool,ammo,species,speciesLook,effect,encounter,spawnTable}` | e.g. `src/game/client/loadout/claims.ts:495-496`, `src/game/client/shardfile/clientCatalogue.ts:28,30`, `src/game/client/models/socketRigCreature.ts:43` |
| `ShardPlugin` (`world`/`kit`/`play`) | `src/game/client/grid/pageShell.ts:61`, `src/game/client/shard/declaredEntry.ts:29` |
| `GridHomeHandoff.expect` | `src/game/client/shardfile/hybrid.ts:325` |
| `buildProgress` | `src/game/client/shardfile/clientWorldAssembly.ts:8,47` |

## Exports from the review set and the NF18 / LD9a importer lists that keep a reader (53)

Registry-only rows (`scripts/shard-components.mjs`, `scripts/platform-chargebacks.mjs`) are accounting, not use:
see orphans.md §3 for the retirement rule if LD10 chooses to drop them.

| Export | Reader(s) | Source of the check |
|---|---|---|
| `engine/client/combat/effects/types.ts#SourceMulDef` | scripts/platform-chargebacks.mjs:31 | review set |
| `engine/client/combat/effects/types.ts#sourceMultiplier` | scripts/platform-chargebacks.mjs:31 | review set |
| `engine/client/combat/view/ranged.ts#edgeWear` | scripts/shard-components.mjs:99 | review set |
| `engine/client/core/assets.ts#loadGLTF` | scripts/shard-components.mjs:128 | review set |
| `engine/client/models/model.ts#withModelPlacementVisitor` | scripts/bake/worldHost.mjs:24 | review set |
| `engine/shared/physics/terrain.ts#terrainGrid` | scripts/bake/worldHost.mjs:21 | review set |
| `engine/shared/physics/terrain.ts#EDGE_WALL_INSET` | scripts/shard-components.mjs:55 | review set |
| `game/client/shard/retainedHooks.ts#installEnteredRuntimeUpdate` | scripts/shard-components.mjs:137 | review set |
| `game/client/shardfile/bakedKinds.ts#loadBakedKinds` | scripts/shard-components.mjs:75 | review set |
| `sdk/crowds.ts#FlockData` | src/shards/nalati-grasslands/data/ecologyTypes.d.ts:8 | review set |
| `engine/client/render/fogPatches.ts#NodeFogPanorama` | src/engine/client/world/Atmosphere.ts:6 | NF18 importer gone |
| `engine/client/world/Atmosphere.ts#fogUniforms` | src/engine/client/core/Volumetrics.ts:7, src/engine/client/entities/AnimalFactory.ts:10 (+9 more) | NF18 importer gone |
| `engine/client/world/Atmosphere.ts#weatherFogUniforms` | src/game/client/grid/regionLight.ts:18 | NF18 importer gone |
| `engine/client/world/Atmosphere.ts#weatherUniforms` | src/game/client/grid/regionLight.ts:18, src/game/client/weather/forest.ts:13 | NF18 importer gone |
| `engine/shared/app/scope.ts#Scope` | scripts/family-props-board/board.js:14, scripts/graph-mesh-map/proof.ts:3 (+410 more) | NF18 importer gone |
| `engine/shared/core/clock.ts#diagnosticNow` | src/engine/client/app/app.ts:22, src/engine/shared/app/scope.ts:5 (+42 more) | NF18 importer gone |
| `engine/shared/core/time.ts#worldTime` | src/engine/client/combat/view/SweptMelee.ts:9, src/engine/client/core/Game.ts:39 (+6 more) | NF18 importer gone |
| `engine/client/render/renderer.ts#Renderer` | scripts/build-sdk.mjs:46, src/engine/client/boot/gpuTrace.ts:5 (+50 more) | NF18 importer gone |
| `engine/client/render/drawHooks.ts#drawHooks` | scripts/perf/draw-hook-component-build.mjs:10, scripts/perf/draw-hook-components.mjs:23 (+6 more) | NF18 importer gone |
| `engine/client/boot/perflog.ts#ProgramLike` | src/engine/client/render/precompile.ts:7 | NF18 importer gone |
| `engine/client/render/shadowDepthVariants.ts#registerShadowDepthResolver` | src/engine/client/render/graphBackend.ts:19 | NF18 importer gone |
| `engine/shared/app/identity.ts#harnessPins` | src/engine/client/boot/gpuFiles.ts:42, src/engine/client/core/bootstrap.ts:1 (+7 more) | NF18 importer gone |
| `engine/client/render/drawNeutral.ts#drawNeutral` | src/engine/client/entities/AnimalFactory.ts:20, src/engine/client/render/graph/glslMaterial.ts:21 (+2 more) | NF18 importer gone |
| `engine/client/render/releasedArrays.ts#arrayReleased` | src/engine/client/render/gpuLabels.ts:3, src/engine/client/render/graph/glslCodec.ts:9 (+2 more) | NF18 importer gone |
| `engine/client/world/wind.ts#FRONT_LEN` | src/engine/client/render/graph/glsl.ts:34 | NF18 importer gone |
| `engine/client/world/wind.ts#WIND_DIR` | src/engine/client/render/graph/glsl.ts:34, src/game/client/weapons/heldLauncher.ts:22 (+1 more) | NF18 importer gone |
| `engine/client/world/wind.ts#windUniforms` | src/engine/client/render/graph/glslProgram.ts:26, src/engine/client/world/TreeFactory.ts:5 (+1 more) | NF18 importer gone |
| `engine/shared/world/windField.ts#sampleWindField` | src/engine/client/render/graph/glsl.ts:35 | NF18 importer gone |
| `engine/shared/world/windField.ts#WindFieldMath` | src/engine/client/render/graph/glsl.ts:35 | NF18 importer gone |
| `engine/shared/world/waves.ts#GERSTNER_TERMS` | scripts/shard-components.mjs:182, src/engine/client/render/graph/glsl.ts:36 | NF18 importer gone |
| `engine/client/render/families/toon.ts#ToonLook` | scripts/family-props-board/board.js:20, scripts/skin-playback/page.js:17 (+9 more) | NF18 importer gone |
| `engine/client/render/graph/presets.ts#toonGraph` | src/engine/client/render/graph/glslProgram.ts:24 | NF18 importer gone |
| `format/materialFamilies.ts#parseFamilyMaterial` | scripts/tone-parity/proof.ts:14, src/engine/client/render/families/registry.ts:15 (+5 more) | NF18 importer gone |
| `engine/shared/core/rng.ts#fnv1a32` | src/engine/client/audio/AmbienceBeds.ts:11, src/engine/shared/sim/bands.ts:2 (+6 more) | NF18 importer gone |
| `format/materialGraph.ts#GRAPH_OPS` | src/engine/client/render/graph/glsl.ts:31 | NF18 importer gone |
| `format/materialGraph.ts#SUN_OPS` | src/engine/client/render/graph/glsl.ts:31 | NF18 importer gone |
| `format/materialGraph.ts#validateGraph` | src/engine/client/render/graph/colourFunction.ts:2, src/engine/client/render/graph/glsl.ts:31 (+9 more) | NF18 importer gone |
| `format/materialGraph.ts#graphUsesMeshMap` | src/engine/client/render/graph/glslMaterial.ts:17, src/format/propMaterials.ts:1 (+1 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphArrayParam` | src/sdk/bake/materialGraph.ts:1 | NF18 importer gone |
| `format/materialGraph.ts#GraphBinding` | src/engine/client/render/graph/glsl.ts:32, src/engine/client/render/graph/glslMaterial.ts:17 (+2 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphCost` | src/engine/client/render/graph/glsl.ts:31, src/engine/client/render/graph/glslMaterial.ts:17 | NF18 importer gone |
| `format/materialGraph.ts#GraphIr` | src/engine/client/render/dataLook.ts:20, src/engine/client/render/graph/glsl.ts:31 (+12 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphLiteral` | src/engine/client/render/graph/colourFunction.ts:2, src/engine/client/render/graph/glsl.ts:31 (+10 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphNode` | src/engine/client/render/graph/glsl.ts:31, src/engine/client/render/graph/glslMaterial.ts:17 (+4 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphRef` | src/engine/client/render/graph/colourFunction.ts:2, src/engine/client/render/graph/glsl.ts:31 (+4 more) | NF18 importer gone |
| `format/materialGraph.ts#GraphValidation` | src/engine/client/render/graph/glsl.ts:31, src/engine/client/render/graphBackend.ts:10 | NF18 importer gone |
| `format/materialGraph.ts#GraphValidationOptions` | src/engine/client/render/graph/glsl.ts:32, src/engine/client/render/graphBackend.ts:10 | NF18 importer gone |
| `format/materialGraph.ts#GraphValueType` | src/engine/client/render/graph/glsl.ts:32, src/sdk/materials.ts:8 | NF18 importer gone |
| `game/client/shardfile/hybrid.ts#prepareHybridShard` | src/game/client/shard/declaredEntry.ts:2 | LD9a importer gone |
| `game/client/plugin/context.ts#ShardContext` | lint/wildshard-plugin.js:811, scripts/gen-api.mjs:24 (+129 more) | LD9a importer gone |
| `game/client/plugin/context.ts#ShardPlugin` | src/game/client/grid/pageShell.ts:3, src/game/client/shard/declaredEntry.ts:1 (+2 more) | LD9a importer gone |
| `game/shared/grid/pageMode.ts#currentPageMode` | src/game/client/plugin/context.ts:4, src/game/client/session/data.ts:27 (+3 more) | LD9a importer gone |
| `engine/shared/core/workSlice.ts#buildYield` | src/engine/client/anim/rigParser.ts:7, src/game/server/boss/arenaRoom.ts:43 (+19 more) | LD9a importer gone |

> QD7 LD10 census (read-only, 2026-11-04, sp-o5's subagent), copied from scratch for the BURN-DAMAGE-LIST 'LD10 tail' row.
> Census of the working tree at the time: LD9a landed, NF18 then uncommitted (it landed as 13253e2609). LD10 slice 1
> (SDK audio wrappers, seven whole-module orphans, NF18 dead arms/exports, stale ENGINE.md passages) is done; the rest
> is the tail. The `tmp/qd7-ld10/work/` scripts mentioned below were scratch and are gone.

# LD10 census: orphans (working tree, 2026-11-04, HEAD 6fc6f28ca3 + uncommitted NF18)

Read-only census of the working tree as it stands (NF18 applied but uncommitted; LD9a 66c036d0a8 landed; LD9b not
started). Method: one oxc parse of 9,029 tracked/untracked files (src, scripts, test, lint, art, admin, api, site,
vite, html entries, ignored `src/shards/*/discovery*.generated.ts`, plus `.sh`/`.yml`/`.py`/root `package.json`/
tsconfig text and `test/fixtures/**/*.json`); edges = static, re-export, dynamic `import()`, `new URL(…, import.meta.url)`
workers, `import.meta.glob`, `?worker`, every `@wildshard/<layer>/<key>` through the real `src/*/package.json` maps,
and string loads (`'src/engine/…'`, `./src/sdk/…`, and the short `src('engine/…ts')` / `imp('src/…')` helpers used by
`scripts/bake/worldHost.mjs` and `scripts/blender/lib/export-scene.mjs`). Comments are blanked before string matching.
Root classes: app (index.html, native.html, calibration/index.html → identity, sw, RotateGate, entry, Update, native,
calibrate), tools (scripts, lint, art, admin, api, site, vite, configs, `src/sdk/bin`, `src/sdk/cli.ts`, shell/yml text),
shard author code (`src/shards/**`), tests (`test/**`, `*.test.ts`, `src/*/test/**`), weak (`progress/`, `drafts/`;
none of the results below depends on a weak root). 1,836 of 2,028 layer modules are reached from the app.
Scripts: `tmp/qd7-ld10/work/{graph,analyze,exports}.mjs`; raw data `graph.json`, `analysis.json`, `exports.json`.

## 1. Modules in src/{engine,game,sdk,format} with no reader at all

| Module | Lines | Orphaned by | Disposition |
|---|---|---|---|
| `src/game/shardfile/tileOverlay.ts` | 40 | `792fa39d79 fix(hud): remove tile diagnostics from minimap` (its only importer); not an LD/NF18 orphan | delete (not in any package `exports`) |
| `src/engine/test/creature.ts` (+ `src/engine/package.json` key `./test/creature`) | – | test helper; no importer of the file or the key anywhere (its sibling `test/creatureStride` is used) | delete with its key |

Not candidates (listed so nobody deletes them):
- `src/format/{forestNativeInputs,heldJianDocument,heldWeaponDocuments,placementData,waterWorld}.ts`: **untracked**
  files, another lane's work in progress (no importer yet, no package key yet). Leave alone.
- 17 declaration files with no importer are tsconfig-included roots, not orphans: `src/engine/{build.d.ts,
  audio/codecs.merge.d.ts,boot/swGlobal.d.ts,physics/rapier-bg.d.ts,types/meshopt-simplifier.d.ts,types/n8ao.d.ts}`,
  `src/game/{equipmentTypes,icons,items,nativeItems,population,rng}.merge.d.ts`,
  `src/game/{audio/sceneEvents,plugin/moverEvents,weather/weatherEvents}.merge.d.ts`, `src/game/client/debug/browser.d.ts`,
  `src/game/client/grid/mapAtlas.build.d.ts`, `src/sdk/assemblyscriptCompiler.d.mts`.
- **Dangling export key (working tree only):** `src/game/package.json` in the working tree re-adds
  `"./shard/entryMode": "./shard/entryMode.ts"` (line 311) although the file was deleted in `4a92df75a4`; HEAD's
  package.json does not have it. It is a peer's stale whole-file hunk (the same diff also moves
  `./plugin/clientChannelView`); it must not be committed. Same pattern in `src/sdk/package.json` (`./bake/compactGlb`
  moved, harmless).

## 2. Modules whose only readers are tests

| Module | Test readers | Last production reader dropped by | Suggested disposition |
|---|---|---|---|
| `src/engine/render/shadowDepthKinds.ts` | `src/engine/render/shadow-depth-kinds.test.ts` | **NF18**: `render/nodes/engineNodesHandler.ts` (deleted) was its only reader (`e42267e32f` wired it there) | delete module + test |
| `src/sdk/runtime/audio/combatCues.ts` | `src/entry-spawn.test.ts:139` (module-name string) | working-tree `src/entry.ts:217` (uncommitted peer edit); **at HEAD `src/entry.ts:217` still imports it** | LD10 retarget, see §5 |
| `src/sdk/runtime/audio/weaponVoices.ts` | same | same | LD10 retarget, see §5 |
| `src/engine/boot/stall.ts` | `src/engine/boot/stall.test.ts` | `30584ca91a fix(loading): share waits from the first byte` (Loading.ts dropped `LoadingStall`) | delete module + test |
| `src/engine/models/placementBatch.ts` | `src/engine/models/model-placement-batch.test.ts` | `98e432ab8c refactor(models): isolate pure pose composition` (encounterView/worldScenePlacement moved to `modelPose`) | delete module + test + engine key `./models/placementBatch` (never imported by spec) |
| `src/game/shardfile/cachedTransport.ts` | `test/cached-transport.test.ts` | `66ddf99cdf refactor(cache): use the worker URL store` (runtimeProduct.ts) | delete module + test |
| `src/game/server/quest/nativeBodyScripts.ts` | `test/driftwood-barrel-saves.test.ts`, `test/fixtures/headless-plan.ts` | `7c73ab50dd refactor(sdk): remove trusted module loading` | move reference to the fixture or delete with its two tests (game key never imported by spec) |
| `src/game/server/population/nativeBake.ts` | ~20 tests/fixtures (`test/native-bake-*.test.ts`, `test/population-bake.test.ts`, `test/fixtures/driftwood-headless.ts`, …) | `892e75d553` / `fa5801434a` (headless scaffold retirements) | native oracle: keep or move to `test/fixtures` (ambiguous, see report) |
| `src/game/boss/arenaPoseView.ts` | `test/titan-continuation.test.ts`, `test/fixtures/nalati-titan-native.ts` | never had one: created test-only in `e48975bf7c` (10-30, Titan continuation) | ambiguous: new Titan view awaiting wiring, or move to fixtures |
| `src/game/boss/cloudRig.ts` | `test/cloud-rig.test.ts`, `test/fixtures/nalati-titan-views.ts`, `test/proof/nalati-grasslands/titanCombat.ts` | never had one: created test-only in `3c5c0d7baa` (10-30) | same as above |
| `src/sdk/scriptScenario.ts` (+ `src/sdk/diskScriptScenario.ts`, dynamic-only from it) | 10 tests (`src/sdk/bake/{decision-host,decision-script-build,disk-script-scenario,script-scenario}.test.ts`, `test/scripts/*.test.ts`) | never had one (test harness exported as SDK key `./scriptScenario`, not in publishConfig) | move to `src/sdk/test/` or keep as an author test API (owner call) |
| `src/sdk/bake/typedDataBank.ts` → `src/format/typedDataBank.ts` | `test/typed-data-bank.test.ts` | never had one: `4f7bbe5b10` added both with only the test | delete both + keys, or wire a generator (owner call) |
| `src/sdk/bake/export.ts` | `test/fixtures/sim-level/skins/build.ts` | not traced (SF9c `0a05f0bbc7`) | SDK key + publish key `./bake/export`; move to the fixture or keep as published author API |

Kept although test/tool-only at the module level (real non-graph roots): `src/sdk/bake/source-loader.mjs` (the
`node --import ./src/sdk/bake/source-loader.mjs` CLI loader: `src/sdk/bake/native-scalar.test.ts:48`, documented usage in
`src/shards/pine-hollow/generators/bake-pine-trophies.mjs:6`, `scripts/bake-captain-coat.mjs:4`), and the two drivers it
string-dispatches, `src/sdk/bake/{json,navigation-json}.mjs` (`source-loader.mjs:18`).

Also: 23 `src/sdk/**` modules are read only by shard author generators and 127 layer modules only by tools; those are
real readers (author/bake roots) and are not orphans. `src/sdk/outputRuntime.ts` and `src/sdk/executeBundle.ts` are
tool-only and exist for the copied-runtime arm: **LD9b**, not LD10.

## 3. Exported symbols with no reader outside their module

Review set = the legacy-deletion plan's table (80 modules, 174 names) + every name the NF18-deleted files (HEAD
contents of `render/nodes/**`, `nodeLayerFrame`, `nodeCoarseMask`, `nodeMaterialCopy`, `graph/compile.ts`) and the
LD9a-deleted files (`shard/runtimeVariant.ts`, `shard/plugin.ts` at `66c036d0a8^`) imported: 238 checks. A reader =
a file that imports the module and names the symbol in its import clause (or `ns.name` on a namespace import), or a
dynamic/string loader whose comment-free code names it. Totals: 35 delete (no reader, no use inside its module),
103 unexport (used only inside its module), 37 test-only, 53 kept (see keeps.md), 10 already gone.

Already gone in this tree (nothing to do): `engine/world/water/view.ts#surfaceReflect` (module deleted);
`game/server/loot/tables.ts#{LootContext,LootTableRow}` (no longer exported); NF18 already removed
`engine/client/render/fogPatches.ts#{NodeFogColourRamp,NodeFogContext,NodeFogPatch,materialNodeFogOf,ownMaterialNodeFog}` and
unexported `engine/client/world/wind.ts#{FRONT_SPEED,FRONT2_LEN}`.

### 3a. Delete: no reader and no use inside the module (35)

NF18 orphaned seven of these (marked); they are dead code now, nothing reads them:
- `engine/client/audio/AmbienceBeds.ts`: `AmbienceBeds`
- `engine/shared/audio/audioProfiles.ts`: `requireAudioZone`
- `engine/client/audio/gen.ts`: `synthKit`
- `engine/client/combat/view/firearmFx.ts`: `HitLine`
- `engine/client/combat/view/ranged.ts`: `CrossbowWorld`, `CrossbowOptions`, `cyl`, `remapUV`, `stripExtra`
- `engine/client/combat/view/rangedFeel.ts`: `installRangedFeel`
- `engine/client/entities/species/loft.ts`: `setShapeFn`
- `engine/client/models/place.ts`: `copiesNear`, `copiesAt`
- `engine/client/models/weld.ts`: `flatPositions`
- `engine/client/world/TreeFactory.ts`: `patchFade`, `patchWind`
- `engine/client/world/lowpolyKit.ts`: `hibiscusBush`, `lilyPad`, `grassTuft`, `vineStrand`
- `engine/shared/world/water/body.ts`: `swellBody`
- `engine/shared/world/waves.ts`: `WAVES_GLSL`, `WAVES_NORMAL_GLSL`
- `game/client/Progress.ts`: `ProgressSink`
- `game/shared/saves.ts`: `shardSave`
- `game/shared/systems/looks/grassField.ts`: `flowerPatchAt`, `groundColorAt`
- `game/client/systems/looks/rainCurtain.ts`: `rainCurtain`
- `engine/client/world/cascadeLights.ts`: `cascadeOf` (NF18), `ghostOf` (NF18), `isCascadeGhost` (NF18)
- `engine/client/world/Atmosphere.ts`: `atmosphereTerms` (NF18)
- `engine/client/render/fogPatches.ts`: `fogPatches` (NF18)
- `engine/client/world/shadowFilter.ts`: `planeBiasShadowFilterOn` (NF18), `tentShadowFilterOn` (NF18)
Notes: `engine/client/world/lowpolyKit.ts#hibiscusBush` is the only caller of `hibiscus` (listed under 3b), so both bodies
go; deleting kit functions that are never called moves no rng draw (the LowPolyKit jitter rule only bites when a called
`add()` changes). `engine/client/audio/AmbienceBeds.ts#AmbienceBeds` is the class itself: the module's `SampledAmbience` /
`PositionalLoops` stay (`src/game/client/audio/sceneDirector.ts:16`). `game/client/systems/looks/rainCurtain.ts#rainCurtain` goes;
`rainCurtainGeometry` stays (`src/game/client/weather/forest.ts:30`, `src/game/client/weather/rainPresentation.ts:15`).
Same-named functions in shards (`remapUV`/`stripExtra` in `src/shards/pine-hollow/generators/crossbowPool.ts:17,40`,
`setShapeFn` in `src/sdk/bake/species.ts:174`, `lilyPad`/`grassTuft`/`vineStrand` in Driftwood generators) are local
copies, not readers.

### 3b. Unexport: used only inside the defining module (103)

Drop the `export` keyword, keep the body. Includes the review-set types that are only used as parameter/field types
in their own module. `engine/client/combat/view/ranged.ts#box` belongs here (its apparent reader `scripts/shard-components.mjs`
only contains the word, not a `#box` row).

- `engine/server/ai/challengeGrazer.ts`: `ChallengeGrazerSpec`
- `engine/server/ai/hunt.ts`: `HuntMemory`
- `engine/server/ai/inspect.ts`: `pinBrain`
- `engine/server/ai/patrolDiver.ts`: `PatrolDiverSpec`
- `engine/client/app/cachedAssets.ts`: `cacheUntilDisposed`
- `engine/client/audio/AmbienceBeds.ts`: `BedDef`, `ZoneWeights`
- `engine/client/audio/ambience.ts`: `ZoneVoice`
- `engine/shared/combat/Equipment.ts`: `RangedFeelProfile`
- `engine/shared/combat/ammo.ts`: `ProjectileModification`
- `engine/client/combat/view/brass.ts`: `brassFloor`
- `engine/client/combat/view/ranged.ts`: `dataTexture`
- `engine/client/core/ktx2.ts`: `readTexturePixels`
- `engine/server/entities/AnimalManager.ts`: `AnimalSound`, `Herd`
- `engine/client/entities/species/loft.ts`: `Station`
- `engine/client/models/creature.ts`: `CREATURE_CLIPS`
- `engine/client/models/cull.ts`: `CullView`
- `engine/client/models/model.ts`: `ModelPlacementVisit`, `ModelRendererHost`, `ModelLod`, `ModelInfo`, `GeometryModelPart`, `GeometryModelRow`, `GeometryModelSource`, `SceneModelPort`
- `engine/client/models/place.ts`: `InstancedCuller`, `HandedBatch`, `weld`, `finishWeld`
- `engine/client/models/slots.ts`: `SlotRecorder`
- `engine/client/models/weld.ts`: `twoSidedPositions`
- `engine/shared/physics/bodies.ts`: `overlapBox`
- `engine/shared/physics/terrain.ts`: `TerrainCut`
- `engine/client/player/WeaponPickup.ts`: `PickupTier`, `TIER_COLOUR`, `ItemPickupOptions`
- `engine/client/quest/view.ts`: `ChipSource`
- `engine/client/render/look.ts`: `LookComposeContext`
- `engine/client/render/shaderPatches.ts`: `ownUniforms`
- `engine/client/ui/Minimap.ts`: `MapPoi`, `MapOverlay`
- `engine/client/world/Grass.ts`: `TrampleField`, `GrassTrampleField`
- `engine/client/world/HorizonMatte.ts`: `HORIZON_RADIUS`
- `engine/client/world/TreeFactory.ts`: `TreeVariant`, `FadeBand`
- `engine/shared/world/dayCycle.ts`: `DayPhase`, `DayKeys`
- `engine/client/world/geometryKit.ts`: `pole`, `mergeVerticesByPos`, `lathe`, `revolve`, `revolveUV`
- `engine/shared/world/interact/types.ts`: `PickupDef`
- `engine/client/world/lowpolyKit.ts`: `Part`, `PLANT`, `fern`, `broadClump`, `hibiscus`, `lotus`, `BakedLight`, `bakeLight`
- `engine/shared/world/steppeWind.ts`: `WIND_GLSL`
- `engine/client/world/wind.ts`: `swayDepthMaterial`
- `game/server/Boss.ts`: `BossDef`
- `game/server/Elite.ts`: `ElitePersistence`, `GroundTellWedgeStyle`
- `game/client/bag/bag.ts`: `CosmeticSlot`
- `game/cook/bake/entryways.ts`: `proveSocketLift`
- `game/shared/compendium/types.ts`: `CompendiumSkin`
- `game/server/inventoryLaw.ts`: `InventoryState`
- `game/server/plugin/context.ts`: `ShardCube`
- `game/server/plugin/mover.ts`: `moverQueries`
- `game/server/shard/manifest.ts`: `Vec2`, `RGB`, `OceanDef`
- `game/client/shardfile/bakedKinds.ts`: `BakedKindRow`, `BakedColliderRow`, `bakedColliders`, `bakedKindsGroup`
- `game/server/shardfile/homeKeeper.ts`: `KeptBossRow`
- `game/shared/shardfile/movers.ts`: `MoverData`
- `game/shared/systems/looks/grassField.ts`: `TALL_GRASS`, `GrassFieldLayout`, `trailGrass`, `grassToneAt`, `grassBloomAt`, `flowerSpeciesAt`
- `game/client/systems/looks/particles.ts`: `makeMistTexture`
- `game/client/systems/looks/trample.ts`: `MAX_MOVERS`
- `game/client/systems/npc/npcRig.ts`: `NpcRigProfile`, `NpcRow`, `NpcRig`, `rigLegs`, `legRigOf`
- `game/client/systems/species/boar.ts`: `BOAR_TUNING`
- `game/client/systems/species/view/bear.ts`: `BEAR_PALETTE`
- `game/client/systems/viewmodel/armRig.ts`: `JointAngles`
- `sdk/weapons/bowProfile.ts`: `BowProfile`, `BowView`, `GripPose`
- `engine/client/combat/view/ranged.ts`: `box`

### 3c. Test-only exports (37)

Only tests/fixtures import them. Per the plan: move a genuine reference implementation to its fixture owner with all
assertions, or delete export + test. `test/fixtures/legacy-oracles/nalati-runtime-debt.json` is a frozen source
string (legacy oracle), not a live import; where it is the only "reader" the symbol is effectively unread.

- `engine/server/ai/species.ts#SpeciesVariant` (also used inside its module): test/driftwood-monkey-author-variants.test.ts
- `engine/server/ai/species.ts#deriveSpecies` (no internal use): sdk/bake/species-rows.test.ts, test/isolated-shard-driftwood-author-values.test.ts
- `engine/client/core/assets.ts#PBRSet` (also used inside its module): test/world-scene-baked-model.test.ts
- `engine/shared/entities/species/rigs.ts#smooth01` (also used inside its module): test/fixtures/animal-pose/captainPoseShipping.ts, test/fixtures/animal-pose/customShipping.ts, test/fixtures/animal-pose/monkeyPoseShipping.ts +4
- `engine/shared/entities/species/rigs.ts#bump` (also used inside its module): test/fixtures/animal-pose/captainPoseShipping.ts, test/fixtures/animal-pose/customShipping.ts, test/fixtures/animal-pose/monkeyPoseShipping.ts +3
- `engine/client/models/place.ts#Draw` (also used inside its module): test/author-placement-parity.test.ts
- `engine/shared/world/dayCycle.ts#ScheduleSeg` (also used inside its module): test/fixtures/nalati-day-keys.ts
- `engine/client/world/geometryBake.ts#withGeometryBake` (also used inside its module): test/fixtures/legacy-oracles/nalati-runtime-debt.json
- `engine/client/world/geometryKit.ts#sagLine` (no internal use): sdk/bake/primitives.test.ts
- `engine/client/world/geometryKit.ts#blob` (also used inside its module): engine/client/world/geometry-bake-producer.test.ts, test/fixtures/kurgan-oracle/source.json
- `engine/shared/world/interact/types.ts#PoiId` (also used inside its module): test/quest-live-frames.test.ts
- `engine/client/world/lowpolyKit.ts#lowPolyMaterial` (also used inside its module): engine/client/render/world-look-ports.test.ts
- `engine/client/world/voxelAO.ts#withVoxelAOBake` (no internal use): test/fixtures/legacy-oracles/nalati-runtime-debt.json
- `game/server/Boss.ts#BossPersistence` (also used inside its module): test/boss-encounter.test.ts
- `game/server/Elite.ts#EliteDef` (also used inside its module): test/keeper-elite-page.test.ts
- `game/server/shard/manifest.ts#ChunkTerrain` (also used inside its module): test/fixtures/nalati-terrain.ts, test/nalati-terrain-source-contract.test.ts
- `game/server/shard/manifest.ts#ChunkHorizon` (also used inside its module): test/scene-author-ports.test.ts
- `game/server/shardfile/bossRow.ts#installBossRow` (also used inside its module): test/fixtures/boss-owner/signal.ts, test/fixtures/native-hosts/boss/native.ts
- `game/shared/systems/looks/grassField.ts#configureGrassField` (also used inside its module): test/fixtures/legacy-oracles/nalati-runtime-debt.json
- `game/client/systems/looks/trample.ts#RECOVER` (also used inside its module): game/client/systems/looks/trample-upload.test.ts
- `game/client/systems/looks/trample.ts#TrampleState` (also used inside its module): game/client/systems/looks/trample-upload.test.ts
- `game/client/systems/looks/trample.ts#installTrampleTrail` (no internal use): test/fixtures/nalati-headless.ts
- `game/client/systems/looks/trample.ts#GrassTrample` (also used inside its module): game/client/systems/looks/trample-upload.test.ts, test/fixtures/legacy-oracles/nalati-runtime-debt.json
- `game/server/weapons/starterBowProfile.ts#BOW` (no internal use): sdk/weapons/bow-file.test.ts, test/nalati-recurve-source-inputs.test.ts
- `game/shared/weapons/starterMoves.ts#key` (also used inside its module): sdk/weapons/melee-authoring.test.ts
- `sdk/headlessRuntime.ts#HeadlessRuntimePreparation` (also used inside its module): test/fixtures/headless-native.ts, test/fixtures/headless-plan.ts, test/fixtures/pine-headless.ts +2
- `sdk/headlessRuntime.ts#HeadlessRuntimeInstallation` (also used inside its module): test/fixtures/headless-native.ts, test/fixtures/headless-plan.ts, test/fixtures/nalati-chapter-native.ts +8
- `sdk/headlessRuntime.ts#HeadlessRuntimePlan` (also used inside its module): test/driftwood-barrel-saves.test.ts, test/driftwood-physics-binary.test.ts, test/fixtures/headless-native.ts +12
- `sdk/headlessRuntime.ts#PrepareHeadlessRuntime` (no internal use): test/fixtures/driftwood-headless.ts, test/fixtures/driftwood-trade-native.ts, test/fixtures/headless-native.ts +26
- `sdk/weapons/thrownProfile.ts#ThrownProfile` (no internal use): test/fixtures/weapon-oracle/thrown.ts
- `engine/client/render/shaderPatches.ts#shaderPatchProgramKey` (also used inside its module): engine/client/render/shader-patch-set.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/client/render/shaderPatches.ts#shaderPatchSet` (no internal use): engine/client/render/shader-patch-set.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/client/render/shaderPatches.ts#shaderPatchSceneShape` (no internal use): engine/client/render/shader-patch-set.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/client/render/compileLights.ts#compileLightSource` (no internal use): engine/client/render/compile-lights.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/client/render/compileLights.ts#compileSceneSource` (no internal use): engine/client/render/compile-lights.test.ts, engine/client/render/scene-root-preparation.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/client/app/cachedAssets.ts#rebindGeometry` (no internal use): engine/client/app/cachedAssets-memo.test.ts, engine/client/app/scope-forget-disposed.test.ts, engine/client/render/graph/graph-geometry-rebind.test.ts +2 — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
- `engine/render/shadowDepthKinds.ts#depthForKind` (also used inside its module): engine/render/shadow-depth-kinds.test.ts — NF18 removed its last production reader (nodes/engineNodesHandler.ts)
Registry-only readers (counted as keeps, but they are accounting rows, not use): `scripts/shard-components.mjs`
names `engine/client/combat/view/ranged.ts#edgeWear` (:99), `engine/client/core/assets.ts#loadGLTF` (:128),
`engine/shared/physics/terrain.ts#EDGE_WALL_INSET` (:55), `game/client/shard/retainedHooks.ts#installEnteredRuntimeUpdate` (:137),
`game/client/shardfile/bakedKinds.ts#loadBakedKinds` (:75); `scripts/platform-chargebacks.mjs:31` names
`engine/client/combat/effects/types.ts#{SourceMulDef,sourceMultiplier}`. No code calls any of them. If LD10 retires one,
retire its row in that registry and in `test/platform-chargebacks.test.ts` / the component tests in the same commit.

## 4. ShardContext / ShardPlugin / LevelContext members with no caller

Checked every member of `ShardContext` (`src/game/server/plugin/context.ts:80`), `GameServices` (:66), `BagVerbs`,
`GameRowMap`/`GameRows`, the `ShardPlugin` hooks (:190) and the inherited `LevelContext` / `EngineRows`
(`src/engine/server/level/context.ts:19-90`), counting direct calls, ports passed by reference (`debugRow: ctx.debugRow`,
`knobs: ctx.tiers.knobs`), and string-keyed row dispatch (`game.rows.get(kind)`, `levelRegistrations.get/list(kind)`).

No caller:
- `ShardContext.rows.places` (`GameRowMap.places`, context.ts:62): no `rows.places(` call, no `game.rows.get('places')`
  reader, no test fake defines it. Remove `places` from `GameRowMap` (ENGINE.md:777 lists it).
- `EngineRows.damageRule` (`src/engine/server/level/context.ts:21`, implemented `src/engine/client/level/installation.ts:60`): no call,
  no `get/list('damageRule')` reader.
- `EngineRows.creatureLook` (context.ts:25, installation.ts:66) and its sink `LevelRegistrations.creatureLook/look`
  (`src/engine/client/level/registrations.ts:38-42`): no caller of the verb and no caller of `look(name)`.

Have callers (keep): `manifest`, `game` (`residency`, `runtime`, `declaredAudio`, `shard`, `rows`, `bag`), `bag.tab`
(`src/game/client/shard/declaredUi.ts:19`), `bag.fragment` (`src/game/client/shardfile/clientFinds.ts:18`), `rows.item`
(`src/game/client/shardfile/clientCatalogue.ts:41`), `rows.lootTable` (`src/game/client/shardfile/client.ts:331`), `rows.skin`,
`rows.feat` (`clientCatalogue.ts:42`), `rows.shop` (`clientCatalogue.ts:32`), `rows.compendium` (`client.ts:330`),
`cube` (`src/game/client/audio/sceneDirector.ts:223`), `product` (many). LevelContext: `playground`
(`src/game/client/practice/registration.ts:10`), `tiers.knobs` (`client.ts:243`), `strings` (`src/game/client/shardfile/clientPlan.ts:273`),
`debugRow` (port at `client.ts:569`), `inputContext` (`src/game/client/riding/client.ts:256`), `piece`, `system`, `on`, `answer`,
`hud`, `debug.expose`. `ShardPlugin` stays: `src/game/client/grid/pageShell.ts:61` and `src/game/server/shard/declaredEntry.ts:29`
extend it; `GridHomeHandoff.expect` has one caller (`src/game/client/shardfile/hybrid.ts:325`, LD9b area). Other context.ts
exports all have readers (`buildProgress`: `src/game/client/shardfile/clientWorldAssembly.ts:47`; `compiledPageBoot`,
`pageGridInstance`, `gridHomeSim`, `sourceManifest`). Export-level only: `ShardCube` is used only inside context.ts (3b).

## 5. The two SDK audio wrappers

`src/sdk/runtime/audio/combatCues.ts` re-exports `sharedCombatCues` from `@wildshard/game/plugin/audio`;
`src/sdk/runtime/audio/weaponVoices.ts` re-exports `sharedWeaponVoices`, `declaredWeaponVoices` and type `WeaponSynth`
from `@wildshard/game/systems/audio/weaponVoices`, which is only an **alias key**: `src/game/package.json:206`
`"./systems/audio/weaponVoices": "./plugin/audio.ts"`. So both wrappers bind the very functions defined in
`src/game/client/plugin/audio.ts`: `sharedCombatCues` (:52), `sharedWeaponVoices` (:82), `declaredWeaponVoices` (:99),
`WeaponSynth` (:74), plus `installDeclaredCombatCues` (:112). Function identity is preserved by retargeting.

Exact readers, working tree:
- `src/entry-spawn.test.ts:139`: module-name strings `'@wildshard/sdk/runtime/audio/weaponVoices'`,
  `'@wildshard/sdk/runtime/audio/combatCues'` in the fake-module table (both already alongside `'@wildshard/game/plugin/audio'`); :106 fake exports.
- `src/sdk/package.json:40` and `:103` (exports), `:279-281` and `:511-513` (publishConfig).
- `lint/ratchet.json:274-275` (`wildshard/sdk-no-facade` rows 1 and 3; the other six rows stay).
- `docs/ENGINE.md:6-11, 96-99`; `docs/SDK-DEV.md:3, 15`.
- `src/sdk/dist/runtime/audio/*` are ignored build outputs (rebuilt by `scripts/build-sdk.mjs`).
- Not readers: `lint/legacy-line-basis.json:102,313` (frozen legacy shard baselines, keep);
  `lint/runtime-performance.json:1165,1169` name `src/shards/pine-hollow/runtime/audio/combatCues.ts`, a file that no
  longer exists (stale rows, separate cleanup).

`src/entry.ts`: at **HEAD** line 217 dynamically imports `@wildshard/sdk/runtime/audio/weaponVoices` and
`.../combatCues` (destructured at :240 `{ sharedWeaponVoices, declaredWeaponVoices }` and :281 `{ sharedCombatCues }`).
The **working tree** (an uncommitted peer edit) already replaces both with `import('@wildshard/game/plugin/audio')`
twice; behaviour is identical (same module promise, same functions), but LD10 should land one import feeding both
destructures and keep the `voicesModule`/`combatModule` slots so the barrier order is unchanged. Retire with the
wrappers: the alias key `src/game/package.json:206` (its only importer is the weaponVoices wrapper) and ENGINE.md:6.

## 6. NF18 instance-level leftovers

- `Game.nodeBuilds` (`src/engine/client/core/Game.ts:958-961`, getter always `null`). Readers:
  `src/game/client/session/settlePrograms.ts:13` (`game.nodeBuilds?.builds ?? 0`: the "no new node builds" quiet-draw count is
  now always 0, so the loop reduces to three draws); its test `src/game/client/session/entryReadiness.test.ts:56-59` (fake
  `nodeBuilds`, reads settlePrograms.ts source from `const QUIET_DRAWS`); scripts `scripts/frame-floor.mjs:481,689,691,700`
  (+ `nodeBuildsByHook` :826, sliced by `test/frame-floor-worst.test.ts:84`), `scripts/loading-benchmark/accuracy.mjs:107`,
  `scripts/loading-benchmark/accuracy-safari.mjs:159`, `scripts/tile-retirement-chromium.mjs:107`,
  `scripts/tile-retirement-proof.mjs:106` (+ `test/tile-retirement-proof.test.ts:170,182`). All script reads use
  `?.`/`?? null`, so deleting the getter breaks nothing at runtime; it breaks the two source-slicing tests only if
  their sliced text changes. `game.nodeBuildKeys` is read by `frame-floor.mjs:691` and `tile-retirement-proof.mjs:106`
  but no longer defined anywhere in src (already dead).
- `graphLook` (`src/engine/client/models/instancedBatch.ts:22`, `isNodeMaterial`): now false for every material. Callers
  `src/engine/client/models/place.ts:24,834` (`graphLook(m) || isGraphShaderMaterial` → reduces to the second test) and
  `src/engine/client/world/interact/Interactables.ts:41,195` (the instanced branch is now unreachable: a lent
  `GraphShaderMaterial` falls through to `ChangedBatchedMesh`). Test `src/engine/client/models/no-graph-batches.test.ts:13-96`
  fakes `isNodeMaterial`. **Ambiguous:** E271/E272 say a graph look never draws on a multi-draw batch; whether the
  Interactables branch should become `isGraphShaderMaterial` (keep behaviour for classic graph looks) or go is a
  graphical call for Opus (G848), not a deletion.
- `isMeshStandardNodeMaterial`: `src/game/client/population/productCreatures.ts:54` (`isLitGraph`) first arm is dead;
  second arm (`isGraphShaderMaterial && lights`) stays.
- `NodeFogPanorama` (`src/engine/client/render/fogPatches.ts:17`, used `src/engine/client/world/Atmosphere.ts:6,47,262,268,272`):
  name only; rename to `FogPanorama`.
- NF18-dead exports with no reader (3a): `fogPatches()`, `atmosphereTerms`, `cascadeOf`/`ghostOf`/`isCascadeGhost`,
  `tentShadowFilterOn`, `planeBiasShadowFilterOn`. NF18 test-only (3c): `shaderPatchSet`/`shaderPatchProgramKey`/
  `shaderPatchSceneShape`, `compileLightSource`/`compileSceneSource`, `rebindGeometry`, `depthForKind`.
- Stale node comments in src: `src/engine/shared/core/time.ts:4`, `src/engine/client/render/frameCounter.ts:6`,
  `src/engine/client/world/cascadeLights.ts:5-7`, `src/engine/client/world/shadowFilter.ts:65,106`, `src/engine/client/world/csmLightBlock.ts:7`,
  `src/engine/client/world/lowpolyKit.ts:416`, `src/engine/client/world/declaredProps.ts:19`, `src/engine/client/app/sceneOwnership.ts:8`,
  `src/engine/client/render/compileShadows.ts:3`, `src/engine/client/render/precompile.ts:1550`, `src/engine/client/render/shaderPatches.ts:184`,
  `src/format/materialGraph.ts:4` (names `graph/compile.ts`), `src/game/client/shardfile/clientViews.ts:27` (same),
  `src/game/client/shardfile/clientPropMaterials.ts:11`. The "as a node material does" parity comments in
  `src/engine/client/render/graph/{glslMaterial,glslProgram}.ts` and their tests describe the parity target and can stay.
  Build-time TSL in `src/sdk/materials.ts` and shard `generators/materials.ts` is the kept graph DSL.

## 7. Measurement paths over copied runtime TypeScript (always empty now)

- `scripts/shard-platform-output.mjs` `outputRuntime()` / `createOutputReader().runtime` (:22-50, :54-75): verifies
  `index.runtime.files` against `out/<slug>/runtime/` and `src/shards/<slug>/runtime/`. Readers:
  `scripts/shard-platform.mjs:773` (`reader.runtime(slug)` in built-output mode; it also uses the returned
  `sections/customSections/customSectionBytes`), `scripts/shard-output-content.mjs:9` (uses only `.index` and
  `.indexPath`), `scripts/shard-output-report.mjs:38` (makes the reader), d.mts `scripts/shard-platform-output.d.mts:5,13`,
  `test/output-runtime.test.ts`, `test/platform-output-reader.test.ts:99`. Both callers can switch to
  `reader.sections(slug)`, which returns `{index, sections, customSections, customSectionBytes}` (:80-117); only
  `indexPath` would need adding. This is the **LD9b** copied-runtime arm (output index `runtime` field), so it should
  go with LD9b, not before it.
- Ruler runtime-line counting, `scripts/shard-platform.mjs:932-961` (`runtimeLines`, `trustedRuntimeLines`,
  `shardRuntimeLines`): in built-output mode `shardFiles` (:775) is always `[]`, so these columns are 0; in
  `sourceProgress` mode it still counts authored shard TS outside build-only generators, so the loop is not dead. G294
  attribution (`modules`, `exports`, `customRuntimeLines`) still runs from the section-host roots (:776-781) and does
  not depend on copied runtime.
- `scripts/g571-hosts.mjs`: reads `docs/HOST-BAR.md` approvals (119 hosts, all present; no "Missing G571 host").
  Readers: `scripts/shard-platform.mjs:13,684,813,890,895,912`, `scripts/platform-chargebacks.mjs`,
  `scripts/precommit-jobs.mjs:72`, `test/{g571-hosts,fixed-draws-approval,platform-chargebacks}.test.ts`. Not a copied-
  runtime path: it filters G294 attribution of platform modules. Keep.
- `scripts/listed-view-code.mjs` + `lint/listed-view-code.json` (one row: Pine `src/game/server/quest/chapterDirector.ts#
  installChapterLead`, still exported and called at `src/game/client/quest/questPageViews.ts:62`). Readers:
  `scripts/shard-platform.mjs:17,932,936,992,996`, `scripts/shard-platform-cli.mjs:52`, `scripts/shard-output-report.mjs:72`,
  `test/listed-view-code.test.ts` (also asserts `docs/HOST-BAR.md` mentions the register). It consumes
  `sole-module`/`sole-export` attribution sources, not only runtime TS, so it stays live. Keep.
- Nothing else breaks if `outputRuntime` goes with LD9b, provided `shard-output-content.mjs` and
  `shard-platform.mjs:773` move to `sections()` in the same commit.

## Package keys never imported through `@wildshard/…`

208 of 1,296 export keys are never named by any spec in code/scripts/tests (only relative imports inside their layer):
engine 31, game 155, sdk 18, format 3, commons 1 (list in `tmp/qd7-ld10/work/analysis.json` recomputation; the
largest is game). `src/*/isolated-*-declarations.test.ts` still name many of them as string module lists, so they are
test readers. The plan says no broad public-export purge: drop a key only with its module. Keys whose module is a
candidate above: engine `./test/creature`, `./models/placementBatch`; game `./quest/nativeBodyScripts`,
`./boss/cloudRig`, `./boss/arenaPoseView`. SDK keys in
`exports` but not in `publishConfig.exports` (20, e.g. `./scriptScenario`, `./bake/typedDataBank`, `./as/groupBankV2`)
are workspace-only; no publish key lacks an export.

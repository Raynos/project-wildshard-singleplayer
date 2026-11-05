import { SpeciesActorsFileSchema } from './speciesActorsFile.ts';
import { QuestRuntimeDocumentSchema } from './questRuntime.ts';
import { QuestStoryBindingsSchema } from './questStoryBindings.ts';
import { PerchBodyFileSchema } from './mixedPopulation.ts';
import { QuestInteractionSourceSchema } from './questInteractionSource.ts';
import { EnemyPlacementsSchema, PopulationProjectionSchema } from './populationProjection.ts';
import { HeldJianDocumentSchema } from './heldJianDocument.ts';
import { BladeDocumentSchema, PolearmDocumentSchema, HeldSlotsDocumentSchema } from './heldWeaponDocuments.ts';
import { HeldBowFileSchema, HeldFirearmPageSchema } from './weaponProfiles.ts';
import { WaterWorldSchema } from './waterWorld.ts';
import { ForestNativeInputsSchema } from './forestNativeInputs.ts';
import { CaveFileSchema, CaveInteriorSchema } from './caveInterior.ts';
import { ForestGroundLayoutSchema, ForestPageSchema, LivingPageSitesSchema } from './forestPage.ts';
import { SceneScatterPageSchema, SceneDressingSchema } from './sceneDressing.ts';
import { PopulationHabitatSchema, PopulationFieldSchema } from './populationEnvironment.ts';
import { FindsCatalogueSchema } from './findsCatalogue.ts';
import { ContractCatalogueSchema } from './contracts.ts';
import { NativeQuestServiceSpotsSchema } from './nativeQuestComposition.ts';
import { WildlifePopulationSchema } from './wildlifePopulation.ts';
import { PopulationShelterSchema } from './herdShelter.ts';
import { EliteFeatureSchema } from './eliteFeature.ts';
import { NativePopulationRowsSchema, TamingPoseFileSchema } from './populationRoster.ts';
import { ClientRidingSessionSchema } from './riding.ts';
import { MountedSpecimenSeatSchema } from './mountedSpecimenRows.ts';
import { ArenaScriptFightFileSchema, ArenaScriptGeometrySchema } from './arenaScriptRows.ts';
import { TimedEncountersSchema, CloudSpecimenSchema } from './encounterRows.ts';
import { ArenaRoomDocumentSchema } from './arenaRoomDocument.ts';
import { RoamingCombatSchema } from './roamingCombat.ts';
import { FixedPracticeFileSchema } from './practiceCourseRows.ts';
import { FixedGeometryGroupsSchema } from './islandLibrary.ts';
import { CoverAppearanceSchema } from './coverAppearance.ts';
import { HeldGraphCardsSchema } from './heldArms.ts';
import { SpecimenBookSchema } from './specimenCatalogue.ts';
import { BakedPlacementPlanSchema } from './bakedTiles.ts';
import { CoverCompositionSchema } from './streamedCover.ts';
import { KitFigureCardsSchema } from './questFigures.ts';
import { BuildingLifeDocumentSchema } from './buildings.ts';
import { WeatherDocumentSchema } from './weatherBundle.ts';
import { AudioSceneSchema } from './audioScene.ts';
import { PostGraphLookSchema } from './postGraphLook.ts';
import { WorldScenePageSchema } from './worldScenePages.ts';
import { FixedDrawRowsSchema } from './fixedDraws.ts';
import * as v from 'valibot';
import { SceneModelSourceSchema, SceneBakeSourceSchema } from './sceneSources.ts';
import { WorldScenePlacementPageSchema } from './worldScenePlacement.ts';
import { WorldSceneWeldSchema } from './worldSceneWeld.ts';
import { WorldSceneSchema } from './clientChannels.ts';
import { SceneBuffersSchema } from './sceneBuffers.ts';
import { WorldSceneModelsSchema } from './worldSceneModels.ts';
import { AchievementCounterDataSchema } from './achievementCounters.ts';
import { FigureCatalogueSchema } from './figures.ts';
import { QuestPageCompositionSchema, ChapterViewSchema } from './questPageComposition.ts';
import { AdventurePersistenceSchema, PosedLibrarySchema, QuestTraderSchema, PageReturnRowsSchema } from './namedJsonContracts.ts';
import { PackedCreatureLooksSchema, CreatureInstallSchema } from './speciesLooks.ts';
import { QuestStorySchema, ChapterStoryPresentationSchema, AdventureContentSchema } from './questStory.ts';
import { PageLifeSchema } from './pageLife.ts';
import { ChapterDirectorSchema, ChapterWakeSchema } from './chapterDirector.ts';
import { QuestPageInteractionsSchema } from './questInteractions.ts';
import { QuestServiceActionsSchema, QuestHintRowsSchema, CarriedQuestSchema } from './questSteps.ts';
import { DirectorProductSchema } from './directorProduct.ts';
import { NativeAssemblySchema, NativeAssemblyDataSchema, NATIVE_ASSEMBLY_SCHEMA, NATIVE_ASSEMBLY_DATA_SCHEMA } from './nativeAssembly.ts';
import { QuestPanelCatalogueSchema } from './panelTemplate.ts';
import { ForestWeatherSchema } from './forestWeather.ts';
import { WeatherEffectsSchema } from './weatherEffects.ts';
import { RainPresentationSchema } from './rainPresentation.ts';
import { ForestWeatherObservationSchema, RangedPageSchema } from './rangedPage.ts';
import { validateRegisteredJson } from './registeredJson.ts';

/** A streamed platform document has one defining schema and an existing reader.
 * Registration requires two real shard users and a six-test HOST-BAR reading,
 * or Jake's explicit approval. Schema provenance is checked independently by
 * the build/census; a matching name alone never grants platform credit. */
export interface PlatformFileFamily {
  readonly pattern: RegExp;
  readonly schema: v.GenericSchema;
  readonly source: string;
  readonly reader: string;
}

/** G988 Z1: the nineteen already shared grammars (98 files at the baseline).
 * Names stay streamed and payloads stay verbatim. Private placement, cabin,
 * ground and encounter grammars remain outside this registry unless separately
 * admitted by Jake, as G1004 admits the two exact baked placement plans. */
export const PLATFORM_FILE_FAMILIES: readonly PlatformFileFamily[] = [
  // P1-E3.1b (J90, Jake's approval): the three native shards' server inputs. Server class only (J91).
  { pattern: /^server\/native-assembly\.json$/u, schema: NativeAssemblySchema, source: NATIVE_ASSEMBLY_SCHEMA, reader: 'src/game/shardfile/nativeAssembly.ts' },
  { pattern: /^server\/[a-z0-9][a-z0-9.-]*\.json$/u, schema: NativeAssemblyDataSchema, source: NATIVE_ASSEMBLY_DATA_SCHEMA, reader: 'src/game/shardfile/nativeAssembly.ts' },
  { pattern: /^quests\/runtime\.json$/u, schema: QuestRuntimeDocumentSchema,
    source: '@wildshard/format/questRuntime#QuestRuntimeDocumentSchema', reader: 'src/game/quest/chapterDirector.ts' },
  { pattern: /^quests\/forest-story\.json$/u, schema: QuestStoryBindingsSchema,
    source: '@wildshard/format/questStoryBindings#QuestStoryBindingsSchema', reader: 'src/game/quest/questPageViews.ts' },
  { pattern: /^quests\/content\.json$/u, schema: ChapterViewSchema,
    source: '@wildshard/format/questPageComposition#ChapterViewSchema', reader: 'src/game/quest/pageComposition.ts' },

  { pattern: /^actors\/projection\.json$/u, schema: PopulationProjectionSchema,
    source: '@wildshard/format/populationProjection#PopulationProjectionSchema', reader: 'src/game/population/projection.ts' },
  { pattern: /^poses\/monkey\.json$/u, schema: PerchBodyFileSchema,
    source: '@wildshard/format/mixedPopulation#PerchBodyFileSchema', reader: 'src/game/population/productCreatures.ts' },
  { pattern: /^quests\/interaction-source\.json$/u, schema: QuestInteractionSourceSchema,
    source: '@wildshard/format/questInteractionSource#QuestInteractionSourceSchema', reader: 'src/game/quest/pageComposition.ts' },
  { pattern: /^sim\/enemy-placement\.json$/u, schema: EnemyPlacementsSchema,
    source: '@wildshard/format/populationProjection#EnemyPlacementsSchema', reader: 'src/game/shardfile/nativeAssembly.ts' },
  { pattern: /^sim\/population-metadata\.json$/u, schema: PopulationHabitatSchema,
    source: '@wildshard/format/populationEnvironment#PopulationHabitatSchema', reader: 'src/game/shardfile/nativeAssemblyHosts.ts' },
  { pattern: /^sim\/taming-poses\.json$/u, schema: TamingPoseFileSchema,
    source: '@wildshard/format/populationRoster#TamingPoseFileSchema', reader: 'src/game/shardfile/nativeAssemblyHosts.ts' },
  { pattern: /^quests\/native-spots\.json$/u, schema: NativeQuestServiceSpotsSchema,
    source: '@wildshard/format/nativeQuestComposition#NativeQuestServiceSpotsSchema', reader: 'src/game/shardfile/nativeAssembly.ts' },
  { pattern: /^quests\/contracts\.json$/u, schema: ContractCatalogueSchema,
    source: '@wildshard/format/contracts#ContractCatalogueSchema', reader: 'src/game/quest/contracts.ts' },
  { pattern: /^quests\/discovery\.json$/u, schema: AdventureContentSchema,
    source: '@wildshard/format/questStory#AdventureContentSchema', reader: 'src/game/quest/pageReads.ts' },
  { pattern: /^quests\/hints\.json$/u, schema: QuestHintRowsSchema,
    source: '@wildshard/format/questSteps#QuestHintRowsSchema', reader: 'src/game/quest/hints.ts' },
  { pattern: /^quests\/wake-boss\.json$/u, schema: ChapterWakeSchema,
    source: '@wildshard/format/chapterDirector#ChapterWakeSchema', reader: 'src/game/quest/chapterDirector.ts' },
  { pattern: /^quests\/carried\.json$/u, schema: CarriedQuestSchema,
    source: '@wildshard/format/questSteps#CarriedQuestSchema', reader: 'src/game/quest/carriedProp.ts' },
  { pattern: /^quests\/finds\.json$/u, schema: FindsCatalogueSchema,
    source: '@wildshard/format/findsCatalogue#FindsCatalogueSchema', reader: 'src/game/shardfile/clientFinds.ts' },
  { pattern: /^actors\/creature-install\.json$/u, schema: CreatureInstallSchema,
    source: '@wildshard/format/speciesLooks#CreatureInstallSchema', reader: 'src/game/population/productCreatures.ts' },
  { pattern: /^sim\/returns\.json$/u, schema: PageReturnRowsSchema,
    source: '@wildshard/format/namedJsonContracts#PageReturnRowsSchema', reader: 'src/game/population/pageReturns.ts' },
  { pattern: /^actors\/roster\.json$/u, schema: NativePopulationRowsSchema,
    source: '@wildshard/format/populationRoster#NativePopulationRowsSchema', reader: 'src/game/population/roster.ts' },
  { pattern: /^actors\/elites\.json$/u, schema: EliteFeatureSchema,
    source: '@wildshard/format/eliteFeature#EliteFeatureSchema', reader: 'src/game/quest/eliteFeature.ts' },
  { pattern: /^actors\/shelter\.json$/u, schema: PopulationShelterSchema,
    source: '@wildshard/format/herdShelter#PopulationShelterSchema', reader: 'src/game/population/shelter.ts' },
  { pattern: /^actors\/sheep\.json$/u, schema: SpeciesActorsFileSchema,
    source: '@wildshard/format/speciesActorsFile#SpeciesActorsFileSchema', reader: 'src/game/population/wildlife.ts' },
  { pattern: /^actors\/wildlife\.json$/u, schema: WildlifePopulationSchema,
    source: '@wildshard/format/wildlifePopulation#WildlifePopulationSchema', reader: 'src/game/population/wildlife.ts' },
  // G1004: complete encounter/riding roots; original native owners stay authoritative.
  { pattern: /^combat\/roaming\.json$/u, schema: RoamingCombatSchema,
    source: '@wildshard/format/roamingCombat#RoamingCombatSchema', reader: 'src/game/combat/roamingSession.ts' },
  { pattern: /^client\/ranged-page\.json$/u, schema: RangedPageSchema,
    source: '@wildshard/format/rangedPage#RangedPageSchema', reader: 'src/game/loadout/rangedPage.ts' },
  { pattern: /^combat\/room-entry\.json$/u, schema: ArenaRoomDocumentSchema,
    source: '@wildshard/format/arenaRoomDocument#ArenaRoomDocumentSchema', reader: 'src/game/shardfile/worldAssembly.ts' },
  { pattern: /^combat\/timed-encounters\.json$/u, schema: TimedEncountersSchema,
    source: '@wildshard/format/encounterRows#TimedEncountersSchema', reader: 'src/game/boss/timedEncounters.ts' },
  { pattern: /^combat\/titan-fight\.json$/u, schema: ArenaScriptFightFileSchema,
    source: '@wildshard/format/arenaScriptRows#ArenaScriptFightFileSchema', reader: 'src/game/boss/openArenaFight.ts' },
  { pattern: /^combat\/titan-geometry\.json$/u, schema: ArenaScriptGeometrySchema,
    source: '@wildshard/format/arenaScriptRows#ArenaScriptGeometrySchema', reader: 'src/game/boss/openArenaFight.ts' },
  { pattern: /^models\/cloud-specimen\.json$/u, schema: CloudSpecimenSchema,
    source: '@wildshard/format/encounterRows#CloudSpecimenSchema', reader: 'src/game/boss/encounterView.ts' },
  { pattern: /^riding\/mounted-figure\.json$/u, schema: MountedSpecimenSeatSchema,
    source: '@wildshard/format/mountedSpecimenRows#MountedSpecimenSeatSchema', reader: 'src/game/riding/seatedFigure.ts' },
  { pattern: /^riding\/session\.json$/u, schema: ClientRidingSessionSchema,
    source: '@wildshard/format/riding#ClientRidingSessionSchema', reader: 'src/game/riding/client.ts' },

  { pattern: /^geometry\/fixed-kits\.json$/u, schema: FixedPracticeFileSchema,
    source: '@wildshard/format/practiceCourseRows#FixedPracticeFileSchema', reader: 'src/game/practice/course.ts' },
  { pattern: /^models\/fixed-geometry\.json$/u, schema: FixedGeometryGroupsSchema,
    source: '@wildshard/format/islandLibrary#FixedGeometryGroupsSchema', reader: 'src/game/models/islandLibrary.ts' },
  { pattern: /^models\/cover-phone\.json$/u, schema: SpecimenBookSchema,
    source: '@wildshard/format/specimenCatalogue#SpecimenBookSchema', reader: 'src/game/models/explorerCatalogue.ts' },
  { pattern: /^models\/cover-desktop\.json$/u, schema: SpecimenBookSchema,
    source: '@wildshard/format/specimenCatalogue#SpecimenBookSchema', reader: 'src/game/models/explorerCatalogue.ts' },
  { pattern: /^models\/gear-book\.json$/u, schema: SpecimenBookSchema,
    source: '@wildshard/format/specimenCatalogue#SpecimenBookSchema', reader: 'src/game/loadout/claims.ts' },
  { pattern: /^models\/held-cards\.json$/u, schema: HeldGraphCardsSchema,
    source: '@wildshard/format/heldArms#HeldGraphCardsSchema', reader: 'src/game/models/explorerCatalogue.ts' },
  { pattern: /^look\/cover-appearance\.json$/u, schema: CoverAppearanceSchema,
    source: '@wildshard/format/coverAppearance#CoverAppearanceSchema', reader: 'src/game/looks/coverAppearance.ts' },
  // G1004: Jake approved these exact complete single-user documents.
  { pattern: /^world\/island\/plan-(?:phone|desktop)\.json$/u, schema: BakedPlacementPlanSchema,
    source: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema', reader: 'src/game/shardfile/bakedTiles.ts' },
  // G1004: exact single-user documents approved with their existing native owners.
  { pattern: /^people\/cards\.json$/u, schema: KitFigureCardsSchema,
    source: '@wildshard/format/questFigures#KitFigureCardsSchema', reader: 'src/game/models/kitFigureCard.ts' },
  { pattern: /^world\/building-life\.json$/u, schema: BuildingLifeDocumentSchema,
    source: '@wildshard/format/buildings#BuildingLifeDocumentSchema', reader: 'src/game/shardfile/worldAssembly.ts' },
  { pattern: /^world\/cover-composition\.json$/u, schema: CoverCompositionSchema,
    source: '@wildshard/format/streamedCover#CoverCompositionSchema', reader: 'src/game/shardfile/worldAssembly.ts' },
  { pattern: /^models\/shape-book\.json$/u, schema: FixedDrawRowsSchema,
    source: '@wildshard/format/fixedDraws#FixedDrawRowsSchema', reader: 'src/game/models/fixedDraws.ts' },
  { pattern: /^quests\/chapters\.json$/u, schema: ChapterStoryPresentationSchema,
    source: '@wildshard/format/questStory#ChapterStoryPresentationSchema', reader: 'src/game/quest/story.ts' },
  { pattern: /^world\/weather\.json$/u, schema: WeatherDocumentSchema,
    source: '@wildshard/format/weatherBundle#WeatherDocumentSchema', reader: 'src/game/weather/forest.ts' },
  { pattern: /^audio\/scene\.json$/u, schema: AudioSceneSchema,
    source: '@wildshard/format/audioScene#AudioSceneSchema', reader: 'src/game/audio/sceneDirector.ts' },
  { pattern: /^look\/post\.json$/u, schema: PostGraphLookSchema,
    source: '@wildshard/format/postGraphLook#PostGraphLookSchema', reader: 'src/game/looks/postGraphLook.ts' },
  { pattern: /^world\/scene-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u, schema: WorldScenePageSchema,
    source: '@wildshard/format/worldScenePages#WorldScenePageSchema', reader: 'src/game/shardfile/worldSceneWeld.ts' },
  { pattern: /^world\/sources\/bakes\.json$/u, schema: SceneBakeSourceSchema,
    source: '@wildshard/format/sceneSources#SceneBakeSourceSchema', reader: 'src/game/shardfile/sceneSources.ts' },
  { pattern: /^world\/sources\/(?:models|heroes|sky)\.json$/u, schema: SceneModelSourceSchema,
    source: '@wildshard/format/sceneSources#SceneModelSourceSchema', reader: 'src/game/shardfile/sceneSources.ts' },
  { pattern: /^world\/(?:casts|fabric)\.json$/u, schema: WorldSceneWeldSchema,
    source: '@wildshard/format/worldSceneWeld#WorldSceneWeldSchema', reader: 'src/game/shardfile/worldSceneWeld.ts' },
  { pattern: /^world\/placement-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u, schema: WorldScenePlacementPageSchema,
    source: '@wildshard/format/worldScenePlacement#WorldScenePlacementPageSchema', reader: 'src/game/shardfile/worldScenePlacementPages.ts' },
  { pattern: /^(?:scenes\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}|world\/scenes\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}|world\/portals\/scene)\.json$/u, schema: WorldSceneSchema,
    source: '@wildshard/format/clientChannels#WorldSceneSchema', reader: 'src/game/shardfile/worldScenes.ts' },
  { pattern: /^world\/(?:fields\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}|cards\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}|portals\/sparks)\.json$/u, schema: SceneBuffersSchema,
    source: '@wildshard/format/sceneBuffers#SceneBuffersSchema', reader: 'src/game/shardfile/sceneDraws.ts' },
  { pattern: /^models\/world-scenes\.json$/u, schema: WorldSceneModelsSchema,
    source: '@wildshard/format/worldSceneModels#WorldSceneModelsSchema', reader: 'src/game/shardfile/worldScenes.ts' },
  { pattern: /^quests\/achievements\.json$/u, schema: AchievementCounterDataSchema,
    source: '@wildshard/format/achievementCounters#AchievementCounterDataSchema', reader: 'src/game/quest/story.ts' },
  { pattern: /^people\/catalogue\.json$/u, schema: FigureCatalogueSchema,
    source: '@wildshard/format/figures#FigureCatalogueSchema', reader: 'src/game/models/figureCatalogue.ts' },
  { pattern: /^quests\/page-composition\.json$/u, schema: QuestPageCompositionSchema,
    source: '@wildshard/format/questPageComposition#QuestPageCompositionSchema', reader: 'src/game/quest/pageComposition.ts' },
  { pattern: /^quests\/stall\.json$/u, schema: QuestTraderSchema,
    source: '@wildshard/format/namedJsonContracts#QuestTraderSchema', reader: 'src/game/quest/trader.ts' },
  { pattern: /^(?:look\/creature-looks|actors\/species-looks)\.json$/u, schema: PackedCreatureLooksSchema,
    source: '@wildshard/format/speciesLooks#PackedCreatureLooksSchema', reader: 'src/game/looks/speciesBook.ts' },
  { pattern: /^look\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,173}-draw\.json$/u, schema: PosedLibrarySchema,
    source: '@wildshard/format/namedJsonContracts#PosedLibrarySchema', reader: 'src/game/looks/posedInstances.ts' },
  { pattern: /^quests\/story\.json$/u, schema: QuestStorySchema,
    source: '@wildshard/format/questStory#QuestStorySchema', reader: 'src/game/quest/chapter.ts' },
  { pattern: /^actors\/page-life\.json$/u, schema: PageLifeSchema,
    source: '@wildshard/format/pageLife#PageLifeSchema', reader: 'src/game/population/pageLife.ts' },
  { pattern: /^quests\/chapter-director\.json$/u, schema: ChapterDirectorSchema,
    source: '@wildshard/format/chapterDirector#ChapterDirectorSchema', reader: 'src/game/quest/chapterDirector.ts' },
  { pattern: /^quests\/(?:trader|mill-door|lanterns)\.json$/u, schema: QuestPageInteractionsSchema,
    source: '@wildshard/format/questInteractions#QuestPageInteractionsSchema', reader: 'src/game/quest/pageComposition.ts' },
  { pattern: /^quests\/services\.json$/u, schema: QuestServiceActionsSchema,
    source: '@wildshard/format/questSteps#QuestServiceActionsSchema', reader: 'src/game/quest/effects.ts' },
  { pattern: /^directors\/main\.json$/u, schema: DirectorProductSchema,
    source: '@wildshard/format/directorProduct#DirectorProductSchema', reader: 'src/game/plugin/director.ts' },
  { pattern: /^quests\/panels\.json$/u, schema: QuestPanelCatalogueSchema,
    source: '@wildshard/format/panelTemplate#QuestPanelCatalogueSchema', reader: 'src/game/ui/dataPanels.ts' },
  { pattern: /^world\/forest-weather\.json$/u, schema: ForestWeatherSchema,
    source: '@wildshard/format/forestWeather#ForestWeatherSchema', reader: 'src/game/weather/forest.ts' },
  { pattern: /^quests\/persistence\.json$/u, schema: AdventurePersistenceSchema,
    source: '@wildshard/format/namedJsonContracts#AdventurePersistenceSchema', reader: 'src/game/quest/persistence.ts' },
  // G1004: Jake approved these exact complete one-user documents; not a prefix waiver.
  { pattern: /^world\/weather-fx\.json$/u, schema: WeatherEffectsSchema,
    source: '@wildshard/format/weatherEffects#WeatherEffectsSchema', reader: 'src/game/weather/forest.ts' },
  { pattern: /^world\/rain\.json$/u, schema: RainPresentationSchema,
    source: '@wildshard/format/rainPresentation#RainPresentationSchema', reader: 'src/game/weather/rainPresentation.ts' },
  { pattern: /^world\/weather-observations\.json$/u, schema: ForestWeatherObservationSchema,
    source: '@wildshard/format/rangedPage#ForestWeatherObservationSchema', reader: 'src/game/looks/forestWeather.ts' },
  // G1004: exact approved one-user documents; native owners and bytes stay original.
  { pattern: /^world\/dressing-pages\/0\.json$/u, schema: SceneScatterPageSchema,
    source: '@wildshard/format/sceneDressing#SceneScatterPageSchema', reader: 'src/game/shardfile/sceneScatterPages.ts' },
  { pattern: /^world\/dressing-pages\/1\.json$/u, schema: SceneScatterPageSchema,
    source: '@wildshard/format/sceneDressing#SceneScatterPageSchema', reader: 'src/game/shardfile/sceneScatterPages.ts' },
  { pattern: /^world\/dressing-phone\.json$/u, schema: SceneDressingSchema,
    source: '@wildshard/format/sceneDressing#SceneDressingSchema', reader: 'src/game/shardfile/sceneDressing.ts' },
  { pattern: /^world\/dressing-desktop\.json$/u, schema: SceneDressingSchema,
    source: '@wildshard/format/sceneDressing#SceneDressingSchema', reader: 'src/game/shardfile/sceneDressing.ts' },
  // G1004: exact approved one-user documents; native owners and bytes stay original.
  { pattern: /^world\/floor\.json$/u, schema: ForestGroundLayoutSchema,
    source: '@wildshard/format/forestPage#ForestGroundLayoutSchema', reader: 'src/game/looks/forestGroundInputs.ts' },
  { pattern: /^world\/crag-cave\.json$/u, schema: CaveFileSchema,
    source: '@wildshard/format/caveInterior#CaveFileSchema', reader: 'src/game/shardfile/caveInterior.ts' },
  { pattern: /^world\/cave-interior\.json$/u, schema: CaveInteriorSchema,
    source: '@wildshard/format/caveInterior#CaveInteriorSchema', reader: 'src/game/shardfile/caveInterior.ts' },
  { pattern: /^world\/forest-page\.json$/u, schema: ForestPageSchema,
    source: '@wildshard/format/forestPage#ForestPageSchema', reader: 'src/game/shardfile/clientForestPage.ts' },
  { pattern: /^world\/building-sites\.json$/u, schema: LivingPageSitesSchema,
    source: '@wildshard/format/forestPage#LivingPageSitesSchema', reader: 'src/game/shardfile/clientForestPage.ts' },
  { pattern: /^data\/physics\.generated\.json$/u, schema: ForestNativeInputsSchema,
    source: '@wildshard/format/forestNativeInputs#ForestNativeInputsSchema', reader: 'src/game/shardfile/nativeAssembly.ts' },
  { pattern: /^world\/meadow\.json$/u, schema: PopulationFieldSchema,
    source: '@wildshard/format/populationEnvironment#PopulationFieldSchema', reader: 'src/game/shardfile/clientMeadow.ts' },
  { pattern: /^world\/water\.json$/u, schema: WaterWorldSchema,
    source: '@wildshard/format/waterWorld#WaterWorldSchema', reader: 'src/game/practice/registration.ts' },
  { pattern: /^weapons\/bow-page\.json$/u, schema: HeldBowFileSchema,
    source: '@wildshard/format/weaponProfiles#HeldBowFileSchema', reader: 'src/game/loadout/claims.ts' },
  { pattern: /^weapons\/rifle-page\.json$/u, schema: HeldFirearmPageSchema,
    source: '@wildshard/format/weaponProfiles#HeldFirearmPageSchema', reader: 'src/game/loadout/claims.ts' },
  { pattern: /^weapons\/sabre\.json$/u, schema: BladeDocumentSchema,
    source: '@wildshard/format/heldWeaponDocuments#BladeDocumentSchema', reader: 'src/game/weapons/mountedBlade.ts' },
  { pattern: /^weapons\/spear\.json$/u, schema: PolearmDocumentSchema,
    source: '@wildshard/format/heldWeaponDocuments#PolearmDocumentSchema', reader: 'src/game/weapons/heldPolearm.ts' },
  { pattern: /^held\/slots\.json$/u, schema: HeldSlotsDocumentSchema,
    source: '@wildshard/format/heldWeaponDocuments#HeldSlotsDocumentSchema', reader: 'src/game/loadout/claims.ts' },
  { pattern: /^weapons\/jian-row\.json$/u, schema: HeldJianDocumentSchema,
    source: '@wildshard/format/heldJianDocument#HeldJianDocumentSchema', reader: 'src/game/loadout/claims.ts' },
];

/** Match both logical name and defining schema identity. An unregistered or
 * differently typed named JSON remains custom, even under a shared prefix. */
export function platformFileFamily(name: string, schemaSource: string | undefined): PlatformFileFamily | undefined {
  const matches = PLATFORM_FILE_FAMILIES.filter(family => family.source === schemaSource && family.pattern.test(name));
  if (matches.length > 1) throw new Error(`Ambiguous platform file family: ${name}`);
  return matches[0];
}

/** Native admission runs without replacing the caller's value: parser defaults
 * and key ordering must never change emitted bytes during reclassification. */
export function validatePlatformFile(name: string, schemaSource: string | undefined, value: unknown): PlatformFileFamily | undefined {
  const family = platformFileFamily(name, schemaSource);
  if (family !== undefined) {
    v.parse(family.schema, value);
    validateRegisteredJson(name, value);
  }
  return family;
}

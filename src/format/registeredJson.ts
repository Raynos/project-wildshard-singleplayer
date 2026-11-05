import { SpeciesActorsFileSchema } from './speciesActorsFile.ts';
import { QuestRuntimeDocumentSchema } from './questRuntime.ts';
import { QuestStoryBindingsSchema } from './questStoryBindings.ts';
import { PerchBodyFileSchema } from './mixedPopulation.ts';
import { QuestInteractionSourceSchema } from './questInteractionSource.ts';
import { HeldJianDocumentSchema } from './heldJianDocument.ts';
import { BladeDocumentSchema, PolearmDocumentSchema, HeldSlotsDocumentSchema } from './heldWeaponDocuments.ts';
import { HeldBowFileSchema, HeldFirearmPageSchema } from './weaponProfiles.ts';
import { WaterWorldSchema } from './waterWorld.ts';
import { ForestNativeInputsSchema } from './forestNativeInputs.ts';
import { FindsCatalogueSchema } from './findsCatalogue.ts';
import { WildlifePopulationSchema } from './wildlifePopulation.ts';
import { ClientRidingSessionSchema } from './riding.ts';
import { MountedSpecimenSeatSchema } from './mountedSpecimenRows.ts';
import { ArenaScriptFightFileSchema, ArenaScriptGeometrySchema } from './arenaScriptRows.ts';
import { TimedEncountersSchema, CloudSpecimenSchema } from './encounterRows.ts';
import { ArenaRoomDocumentSchema } from './arenaRoomDocument.ts';
import { RoamingCombatSchema } from './roamingCombat.ts';
import { FixedPracticeFileSchema } from './practiceCourseRows.ts';
import { FixedGeometryGroupsSchema } from './islandLibrary.ts';
import { CoverAppearanceSchema } from './coverAppearance.ts';
import { HeldGraphCardsSchema, parseHeldSlots } from './heldArms.ts';
import { SpecimenBookSchema } from './specimenCatalogue.ts';
import { WeatherDocumentSchema, parseWeatherDocument } from './weatherBundle.ts';
import { WeatherEffectsSchema, parseWeatherEffects } from './weatherEffects.ts';
import { RainPresentationSchema } from './rainPresentation.ts';
import { ForestWeatherObservationSchema, RangedPageSchema } from './rangedPage.ts';
import { PostGraphLookSchema } from './postGraphLook.ts';
import { parsePostGraphDocument } from './postGraphDocument.ts';
import { WorldScenePageSchema } from './worldScenePages.ts';
import {NativeQuestCompositionSchema,parseNativeQuestComposition,NativeQuestServiceSpotsSchema,parseNativeQuestServiceSpots} from './nativeQuestComposition.ts';
import {ContractCatalogueSchema,parseContractCatalogue} from './contracts.ts';
import { BuildingLifeDocumentSchema } from './buildings.ts';
import { BakedPlacementPlanSchema } from './bakedTiles.ts';
import { SceneModelSourceSchema, SceneBakeSourceSchema } from './sceneSources.ts';
import { WorldSceneWeldSchema, parseWorldSceneWeld } from './worldSceneWeld.ts';

import {QuestPanelCatalogueSchema,parseQuestPanelCatalogue} from './panelTemplate.ts';
import {PopulationKeeperRowsSchema} from './populationKeeper.ts';
import { CoverCompositionSchema } from './streamedCover.ts';
import { PopulationFieldSchema, PopulationHabitatSchema } from './populationEnvironment.ts';
import { SceneDressingSchema, SceneScatterPageSchema } from './sceneDressing.ts';
import { FixedDrawRowsSchema } from './fixedDraws.ts';
import { ForestGroundLayoutSchema, ForestPageSchema, LivingPageSitesSchema } from './forestPage.ts';
import { CaveFileSchema, CaveInteriorSchema } from './caveInterior.ts';
import * as v from 'valibot';
import { NativePopulationRowsSchema, parseNativePopulationRows, TamingPoseFileSchema } from './populationRoster.ts';
import { EliteFeatureSchema, parseEliteFeature } from './eliteFeature.ts';
import { DirectorProductSchema } from './directorProduct.ts';
import { AudioSceneSchema } from './audioScene.ts';
import { KitFigureCardsSchema } from './questFigures.ts';
import {SceneBuffersSchema,parseSceneBuffers} from './sceneBuffers.ts';
import {WorldSceneSchema,parseWorldScene} from './clientChannels.ts';
import {ForestWeatherSchema} from './forestWeather.ts';
import {WorldSceneModelsSchema,parseWorldSceneModels} from './worldSceneModels.ts';
import { AchievementCounterDataSchema,parseAchievementCounterData } from './achievementCounters.ts';
import { QuestPageCompositionSchema, ChapterViewSchema } from './questPageComposition.ts';
import {QuestServiceActionsSchema,parseQuestServiceActions,QuestStepRowsSchema,parseQuestStepRows,QuestHintRowsSchema,parseQuestHintRows,CarriedQuestSchema,parseCarriedQuest} from './questSteps.ts';
import { QuestStorySchema,parseQuestStory,ChapterStoryPresentationSchema,parseChapterStoryPresentation, AdventureContentSchema } from './questStory.ts';
import { ChapterDirectorSchema,parseChapterDirector,ChapterWakeSchema,parseChapterWake } from './chapterDirector.ts';
import { FigureCatalogueSchema } from './figures.ts';
import { AdventurePersistenceSchema,PageReturnRowsSchema,PosedLibrarySchema,QuestTraderSchema } from './namedJsonContracts.ts';
import { WorldScenePlacementSchema,parseWorldScenePlacement,WorldScenePlacementPageSchema,parseWorldScenePlacementPage } from './worldScenePlacement.ts';
import { QuestPageInteractionsSchema,parseQuestPageInteractions } from './questInteractions.ts';
import { PageLifeSchema,parsePageLife } from './pageLife.ts';
import { PopulationProjectionSchema, EnemyPlacementsSchema } from './populationProjection.ts';
import { PopulationShelterSchema,parsePopulationShelter } from './herdShelter.ts';
import { CreatureInstallSchema,PackedCreatureLooksSchema } from './speciesLooks.ts';

/** Shared logical documents keep their existing names and defining parsers.
 * The private named-JSON bridge is separate until its remaining exit rows land. */
export interface RegisteredJsonContracts {
  readonly 'actors/sheep.json':{readonly schema:typeof SpeciesActorsFileSchema;readonly source:'@wildshard/format/speciesActorsFile#SpeciesActorsFileSchema'};
  readonly 'poses/monkey.json':{readonly schema:typeof PerchBodyFileSchema;readonly source:'@wildshard/format/mixedPopulation#PerchBodyFileSchema'};
  readonly 'sim/enemy-placement.json':{readonly schema:typeof EnemyPlacementsSchema;readonly source:'@wildshard/format/populationProjection#EnemyPlacementsSchema'};
  readonly 'data/physics.generated.json':{readonly schema:typeof ForestNativeInputsSchema;readonly source:'@wildshard/format/forestNativeInputs#ForestNativeInputsSchema'};
  readonly 'world/water.json':{readonly schema:typeof WaterWorldSchema;readonly source:'@wildshard/format/waterWorld#WaterWorldSchema'};
  readonly 'weapons/bow-page.json':{readonly schema:typeof HeldBowFileSchema;readonly source:'@wildshard/format/weaponProfiles#HeldBowFileSchema'};
  readonly 'weapons/rifle-page.json':{readonly schema:typeof HeldFirearmPageSchema;readonly source:'@wildshard/format/weaponProfiles#HeldFirearmPageSchema'};
  readonly 'weapons/sabre.json':{readonly schema:typeof BladeDocumentSchema;readonly source:'@wildshard/format/heldWeaponDocuments#BladeDocumentSchema'};
  readonly 'weapons/spear.json':{readonly schema:typeof PolearmDocumentSchema;readonly source:'@wildshard/format/heldWeaponDocuments#PolearmDocumentSchema'};
  readonly 'held/slots.json':{readonly schema:typeof HeldSlotsDocumentSchema;readonly source:'@wildshard/format/heldWeaponDocuments#HeldSlotsDocumentSchema'};
  readonly 'weapons/jian-row.json':{readonly schema:typeof HeldJianDocumentSchema;readonly source:'@wildshard/format/heldJianDocument#HeldJianDocumentSchema'};
  readonly 'world/dressing-pages/0.json':{readonly schema:typeof SceneScatterPageSchema;readonly source:'@wildshard/format/sceneDressing#SceneScatterPageSchema'};
  readonly 'world/dressing-pages/1.json':{readonly schema:typeof SceneScatterPageSchema;readonly source:'@wildshard/format/sceneDressing#SceneScatterPageSchema'};
  readonly 'sim/population-metadata.json':{readonly schema:typeof PopulationHabitatSchema;readonly source:'@wildshard/format/populationEnvironment#PopulationHabitatSchema'};
  readonly 'sim/taming-poses.json':{readonly schema:typeof TamingPoseFileSchema;readonly source:'@wildshard/format/populationRoster#TamingPoseFileSchema'};
  readonly 'quests/discovery.json':{readonly schema:typeof AdventureContentSchema;readonly source:'@wildshard/format/questStory#AdventureContentSchema'};
  readonly 'quests/finds.json':{readonly schema:typeof FindsCatalogueSchema;readonly source:'@wildshard/format/findsCatalogue#FindsCatalogueSchema'};
  readonly 'actors/wildlife.json':{readonly schema:typeof WildlifePopulationSchema;readonly source:'@wildshard/format/wildlifePopulation#WildlifePopulationSchema'};
  readonly 'combat/roaming.json':{readonly schema:typeof RoamingCombatSchema;readonly source:'@wildshard/format/roamingCombat#RoamingCombatSchema'};
  readonly 'client/ranged-page.json':{readonly schema:typeof RangedPageSchema;readonly source:'@wildshard/format/rangedPage#RangedPageSchema'};
  readonly 'combat/room-entry.json':{readonly schema:typeof ArenaRoomDocumentSchema;readonly source:'@wildshard/format/arenaRoomDocument#ArenaRoomDocumentSchema'};
  readonly 'combat/timed-encounters.json':{readonly schema:typeof TimedEncountersSchema;readonly source:'@wildshard/format/encounterRows#TimedEncountersSchema'};
  readonly 'combat/titan-fight.json':{readonly schema:typeof ArenaScriptFightFileSchema;readonly source:'@wildshard/format/arenaScriptRows#ArenaScriptFightFileSchema'};
  readonly 'combat/titan-geometry.json':{readonly schema:typeof ArenaScriptGeometrySchema;readonly source:'@wildshard/format/arenaScriptRows#ArenaScriptGeometrySchema'};
  readonly 'models/cloud-specimen.json':{readonly schema:typeof CloudSpecimenSchema;readonly source:'@wildshard/format/encounterRows#CloudSpecimenSchema'};
  readonly 'riding/mounted-figure.json':{readonly schema:typeof MountedSpecimenSeatSchema;readonly source:'@wildshard/format/mountedSpecimenRows#MountedSpecimenSeatSchema'};
  readonly 'riding/session.json':{readonly schema:typeof ClientRidingSessionSchema;readonly source:'@wildshard/format/riding#ClientRidingSessionSchema'};

  readonly 'geometry/fixed-kits.json':{readonly schema:typeof FixedPracticeFileSchema;readonly source:'@wildshard/format/practiceCourseRows#FixedPracticeFileSchema'};
  readonly 'models/fixed-geometry.json':{readonly schema:typeof FixedGeometryGroupsSchema;readonly source:'@wildshard/format/islandLibrary#FixedGeometryGroupsSchema'};
  readonly 'models/cover-phone.json':{readonly schema:typeof SpecimenBookSchema;readonly source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'};
  readonly 'models/cover-desktop.json':{readonly schema:typeof SpecimenBookSchema;readonly source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'};
  readonly 'models/gear-book.json':{readonly schema:typeof SpecimenBookSchema;readonly source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'};
  readonly 'models/held-cards.json':{readonly schema:typeof HeldGraphCardsSchema;readonly source:'@wildshard/format/heldArms#HeldGraphCardsSchema'};
  readonly 'look/cover-appearance.json':{readonly schema:typeof CoverAppearanceSchema;readonly source:'@wildshard/format/coverAppearance#CoverAppearanceSchema'};
  readonly 'quests/interaction-source.json':{readonly schema:typeof QuestInteractionSourceSchema;readonly source:'@wildshard/format/questInteractionSource#QuestInteractionSourceSchema'};
  readonly 'quests/runtime.json':{readonly schema:typeof QuestRuntimeDocumentSchema;readonly source:'@wildshard/format/questRuntime#QuestRuntimeDocumentSchema'};
  readonly 'quests/forest-story.json':{readonly schema:typeof QuestStoryBindingsSchema;readonly source:'@wildshard/format/questStoryBindings#QuestStoryBindingsSchema'};
  readonly 'quests/content.json':{readonly schema:typeof ChapterViewSchema;readonly source:'@wildshard/format/questPageComposition#ChapterViewSchema'};
  readonly 'quests/chapters.json':{readonly schema:typeof ChapterStoryPresentationSchema;readonly source:'@wildshard/format/questStory#ChapterStoryPresentationSchema'};
  readonly 'quests/native-story.json':{readonly schema:typeof NativeQuestCompositionSchema;readonly source:'@wildshard/format/nativeQuestComposition#NativeQuestCompositionSchema'};
  readonly 'quests/native-spots.json':{readonly schema:typeof NativeQuestServiceSpotsSchema;readonly source:'@wildshard/format/nativeQuestComposition#NativeQuestServiceSpotsSchema'};
  readonly 'quests/contracts.json':{readonly schema:typeof ContractCatalogueSchema;readonly source:'@wildshard/format/contracts#ContractCatalogueSchema'};
  readonly 'quests/carried.json':{readonly schema:typeof CarriedQuestSchema;readonly source:'@wildshard/format/questSteps#CarriedQuestSchema'};
  readonly 'quests/panels.json':{readonly schema:typeof QuestPanelCatalogueSchema;readonly source:'@wildshard/format/panelTemplate#QuestPanelCatalogueSchema'};
  readonly 'actors/roster.json':{readonly schema:typeof NativePopulationRowsSchema;readonly source:'@wildshard/format/populationRoster#NativePopulationRowsSchema'};
  readonly 'actors/elites.json':{readonly schema:typeof EliteFeatureSchema;readonly source:'@wildshard/format/eliteFeature#EliteFeatureSchema'};
  readonly 'sim/keeper.json':{readonly schema:typeof PopulationKeeperRowsSchema;readonly source:'@wildshard/format/populationKeeper#PopulationKeeperRowsSchema'};
  readonly 'sim/returns.json':{readonly schema:typeof PageReturnRowsSchema;readonly source:'@wildshard/format/namedJsonContracts#PageReturnRowsSchema'};
  readonly 'quests/steps.json':{readonly schema:typeof QuestStepRowsSchema;readonly source:'@wildshard/format/questSteps#QuestStepRowsSchema'};
  readonly 'quests/hints.json':{readonly schema:typeof QuestHintRowsSchema;readonly source:'@wildshard/format/questSteps#QuestHintRowsSchema'};
  readonly 'quests/wake-boss.json':{readonly schema:typeof ChapterWakeSchema;readonly source:'@wildshard/format/chapterDirector#ChapterWakeSchema'};
  readonly 'world/cover-composition.json':{readonly schema:typeof CoverCompositionSchema;readonly source:'@wildshard/format/streamedCover#CoverCompositionSchema'};
  readonly 'world/meadow.json':{readonly schema:typeof PopulationFieldSchema;readonly source:'@wildshard/format/populationEnvironment#PopulationFieldSchema'};
  readonly 'world/dressing-desktop.json':{readonly schema:typeof SceneDressingSchema;readonly source:'@wildshard/format/sceneDressing#SceneDressingSchema'};
  readonly 'world/dressing-phone.json':{readonly schema:typeof SceneDressingSchema;readonly source:'@wildshard/format/sceneDressing#SceneDressingSchema'};
  readonly 'world/building-sites.json':{readonly schema:typeof LivingPageSitesSchema;readonly source:'@wildshard/format/forestPage#LivingPageSitesSchema'};
  readonly 'models/shape-book.json':{readonly schema:typeof FixedDrawRowsSchema;readonly source:'@wildshard/format/fixedDraws#FixedDrawRowsSchema'};
  readonly 'directors/main.json':{readonly schema:typeof DirectorProductSchema;readonly source:'@wildshard/format/directorProduct#DirectorProductSchema'};
  readonly 'scenes/cascade.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/cove.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/hibiscus.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/logs.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/moorings.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/palms.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/pool.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/quest-rides.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/reef.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/rocks.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/streams.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/trail.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/wreck.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'scenes/zipline.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'world/portals/scene.json':{readonly schema:typeof WorldSceneSchema;readonly source:'@wildshard/format/clientChannels#WorldSceneSchema'};
  readonly 'world/cards/capped-halos.json':{readonly schema:typeof SceneBuffersSchema;readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
  readonly 'world/cards/open-halos.json':{readonly schema:typeof SceneBuffersSchema;readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
  readonly 'world/cards/open-streaks.json':{readonly schema:typeof SceneBuffersSchema;readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
  readonly 'world/portals/sparks.json':{readonly schema:typeof SceneBuffersSchema;readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
  readonly 'look/fish-draw.json':{readonly schema:typeof PosedLibrarySchema;readonly source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'};
  readonly 'look/gull-draw.json':{readonly schema:typeof PosedLibrarySchema;readonly source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'};
  readonly 'look/wildlife-draw.json':{readonly schema:typeof PosedLibrarySchema;readonly source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'};
  readonly 'audio/scene.json':{readonly schema:typeof AudioSceneSchema;readonly source:'@wildshard/format/audioScene#AudioSceneSchema'};
  readonly 'world/weather.json':{readonly schema:typeof WeatherDocumentSchema;readonly source:'@wildshard/format/weatherBundle#WeatherDocumentSchema'};
  readonly 'world/weather-fx.json':{readonly schema:typeof WeatherEffectsSchema;readonly source:'@wildshard/format/weatherEffects#WeatherEffectsSchema'};
  readonly 'world/rain.json':{readonly schema:typeof RainPresentationSchema;readonly source:'@wildshard/format/rainPresentation#RainPresentationSchema'};
  readonly 'world/weather-observations.json':{readonly schema:typeof ForestWeatherObservationSchema;readonly source:'@wildshard/format/rangedPage#ForestWeatherObservationSchema'};
  readonly 'look/post.json':{readonly schema:typeof PostGraphLookSchema;readonly source:'@wildshard/format/postGraphLook#PostGraphLookSchema'};
  readonly 'people/cards.json':{readonly schema:typeof KitFigureCardsSchema;readonly source:'@wildshard/format/questFigures#KitFigureCardsSchema'};
  readonly 'quests/persistence.json':{readonly schema:typeof AdventurePersistenceSchema;readonly source:'@wildshard/format/namedJsonContracts#AdventurePersistenceSchema'};
  readonly 'world/forest-page.json':{readonly schema:typeof ForestPageSchema;readonly source:'@wildshard/format/forestPage#ForestPageSchema'};
  readonly 'world/floor.json':{readonly schema:typeof ForestGroundLayoutSchema;readonly source:'@wildshard/format/forestPage#ForestGroundLayoutSchema'};
  readonly 'world/crag-cave.json':{readonly schema:typeof CaveFileSchema;readonly source:'@wildshard/format/caveInterior#CaveFileSchema'};
  readonly 'world/cave-interior.json':{readonly schema:typeof CaveInteriorSchema;readonly source:'@wildshard/format/caveInterior#CaveInteriorSchema'};
  readonly 'actors/creature-install.json':{readonly schema:typeof CreatureInstallSchema;readonly source:'@wildshard/format/speciesLooks#CreatureInstallSchema'};
  readonly 'actors/projection.json':{readonly schema:typeof PopulationProjectionSchema;readonly source:'@wildshard/format/populationProjection#PopulationProjectionSchema'};
  readonly 'actors/shelter.json':{readonly schema:typeof PopulationShelterSchema;readonly source:'@wildshard/format/herdShelter#PopulationShelterSchema'};
  readonly 'world/forest-weather.json':{readonly schema:typeof ForestWeatherSchema;readonly source:'@wildshard/format/forestWeather#ForestWeatherSchema'};
  readonly 'models/world-scenes.json':{readonly schema:typeof WorldSceneModelsSchema;readonly source:'@wildshard/format/worldSceneModels#WorldSceneModelsSchema'};
  readonly 'actors/page-life.json':{readonly schema:typeof PageLifeSchema;readonly source:'@wildshard/format/pageLife#PageLifeSchema'};
  readonly 'look/creature-looks.json':{readonly schema:typeof PackedCreatureLooksSchema;readonly source:'@wildshard/format/speciesLooks#PackedCreatureLooksSchema'};
  readonly 'actors/species-looks.json':{readonly schema:typeof PackedCreatureLooksSchema;readonly source:'@wildshard/format/speciesLooks#PackedCreatureLooksSchema'};
  readonly 'people/catalogue.json':{readonly schema:typeof FigureCatalogueSchema;readonly source:'@wildshard/format/figures#FigureCatalogueSchema'};
  readonly 'quests/chapter-director.json':{readonly schema:typeof ChapterDirectorSchema;readonly source:'@wildshard/format/chapterDirector#ChapterDirectorSchema'};
  readonly 'quests/story.json':{readonly schema:typeof QuestStorySchema;readonly source:'@wildshard/format/questStory#QuestStorySchema'};
  readonly 'quests/stall.json':{readonly schema:typeof QuestTraderSchema;readonly source:'@wildshard/format/namedJsonContracts#QuestTraderSchema'};
  readonly 'quests/achievements.json':{readonly schema:typeof AchievementCounterDataSchema;readonly source:'@wildshard/format/achievementCounters#AchievementCounterDataSchema'};
  readonly 'quests/page-composition.json':{readonly schema:typeof QuestPageCompositionSchema;readonly source:'@wildshard/format/questPageComposition#QuestPageCompositionSchema'};
  readonly 'quests/services.json':{readonly schema:typeof QuestServiceActionsSchema;readonly source:'@wildshard/format/questSteps#QuestServiceActionsSchema'};
  readonly 'quests/trader.json':{readonly schema:typeof QuestPageInteractionsSchema;readonly source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'};
  readonly 'quests/mill-door.json':{readonly schema:typeof QuestPageInteractionsSchema;readonly source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'};
  readonly 'quests/lanterns.json':{readonly schema:typeof QuestPageInteractionsSchema;readonly source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'};
  readonly 'world/building-life.json': { readonly schema: typeof BuildingLifeDocumentSchema; readonly source: '@wildshard/format/buildings#BuildingLifeDocumentSchema' };
  readonly 'world/island/plan-phone.json': { readonly schema: typeof BakedPlacementPlanSchema; readonly source: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema' };
  readonly 'world/island/plan-desktop.json': { readonly schema: typeof BakedPlacementPlanSchema; readonly source: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema' };
  readonly 'world/casts.json': { readonly schema: typeof WorldSceneWeldSchema; readonly source: '@wildshard/format/worldSceneWeld#WorldSceneWeldSchema' };
  readonly 'world/fabric.json': { readonly schema: typeof WorldSceneWeldSchema; readonly source: '@wildshard/format/worldSceneWeld#WorldSceneWeldSchema' };
  readonly 'world/sources/bakes.json': { readonly schema: typeof SceneBakeSourceSchema; readonly source: '@wildshard/format/sceneSources#SceneBakeSourceSchema' };
  readonly 'world/sources/models.json': { readonly schema: typeof SceneModelSourceSchema; readonly source: '@wildshard/format/sceneSources#SceneModelSourceSchema' };
  readonly 'world/sources/heroes.json': { readonly schema: typeof SceneModelSourceSchema; readonly source: '@wildshard/format/sceneSources#SceneModelSourceSchema' };
  readonly 'world/sources/sky.json': { readonly schema: typeof SceneModelSourceSchema; readonly source: '@wildshard/format/sceneSources#SceneModelSourceSchema' };
}
export const REGISTERED_JSON:RegisteredJsonContracts = {
  'poses/monkey.json':{schema:PerchBodyFileSchema,source:'@wildshard/format/mixedPopulation#PerchBodyFileSchema'},
  'sim/enemy-placement.json':{schema:EnemyPlacementsSchema,source:'@wildshard/format/populationProjection#EnemyPlacementsSchema'},
  'data/physics.generated.json':{schema:ForestNativeInputsSchema,source:'@wildshard/format/forestNativeInputs#ForestNativeInputsSchema'},
  'world/water.json':{schema:WaterWorldSchema,source:'@wildshard/format/waterWorld#WaterWorldSchema'},
  'weapons/bow-page.json':{schema:HeldBowFileSchema,source:'@wildshard/format/weaponProfiles#HeldBowFileSchema'},
  'weapons/rifle-page.json':{schema:HeldFirearmPageSchema,source:'@wildshard/format/weaponProfiles#HeldFirearmPageSchema'},
  'weapons/sabre.json':{schema:BladeDocumentSchema,source:'@wildshard/format/heldWeaponDocuments#BladeDocumentSchema'},
  'weapons/spear.json':{schema:PolearmDocumentSchema,source:'@wildshard/format/heldWeaponDocuments#PolearmDocumentSchema'},
  'held/slots.json':{schema:HeldSlotsDocumentSchema,source:'@wildshard/format/heldWeaponDocuments#HeldSlotsDocumentSchema'},
  'weapons/jian-row.json':{schema:HeldJianDocumentSchema,source:'@wildshard/format/heldJianDocument#HeldJianDocumentSchema'},
  'world/dressing-pages/0.json':{schema:SceneScatterPageSchema,source:'@wildshard/format/sceneDressing#SceneScatterPageSchema'},
  'world/dressing-pages/1.json':{schema:SceneScatterPageSchema,source:'@wildshard/format/sceneDressing#SceneScatterPageSchema'},
  'sim/population-metadata.json':{schema:PopulationHabitatSchema,source:'@wildshard/format/populationEnvironment#PopulationHabitatSchema'},
  'sim/taming-poses.json':{schema:TamingPoseFileSchema,source:'@wildshard/format/populationRoster#TamingPoseFileSchema'},
  'quests/discovery.json':{schema:AdventureContentSchema,source:'@wildshard/format/questStory#AdventureContentSchema'},
  'quests/finds.json':{schema:FindsCatalogueSchema,source:'@wildshard/format/findsCatalogue#FindsCatalogueSchema'},
  'actors/sheep.json':{schema:SpeciesActorsFileSchema,source:'@wildshard/format/speciesActorsFile#SpeciesActorsFileSchema'},
  'actors/wildlife.json':{schema:WildlifePopulationSchema,source:'@wildshard/format/wildlifePopulation#WildlifePopulationSchema'},
  'combat/roaming.json':{schema:RoamingCombatSchema,source:'@wildshard/format/roamingCombat#RoamingCombatSchema'},
  'client/ranged-page.json':{schema:RangedPageSchema,source:'@wildshard/format/rangedPage#RangedPageSchema'},
  'combat/room-entry.json':{schema:ArenaRoomDocumentSchema,source:'@wildshard/format/arenaRoomDocument#ArenaRoomDocumentSchema'},
  'combat/timed-encounters.json':{schema:TimedEncountersSchema,source:'@wildshard/format/encounterRows#TimedEncountersSchema'},
  'combat/titan-fight.json':{schema:ArenaScriptFightFileSchema,source:'@wildshard/format/arenaScriptRows#ArenaScriptFightFileSchema'},
  'combat/titan-geometry.json':{schema:ArenaScriptGeometrySchema,source:'@wildshard/format/arenaScriptRows#ArenaScriptGeometrySchema'},
  'models/cloud-specimen.json':{schema:CloudSpecimenSchema,source:'@wildshard/format/encounterRows#CloudSpecimenSchema'},
  'riding/mounted-figure.json':{schema:MountedSpecimenSeatSchema,source:'@wildshard/format/mountedSpecimenRows#MountedSpecimenSeatSchema'},
  'riding/session.json':{schema:ClientRidingSessionSchema,source:'@wildshard/format/riding#ClientRidingSessionSchema'},

  'geometry/fixed-kits.json':{schema:FixedPracticeFileSchema,source:'@wildshard/format/practiceCourseRows#FixedPracticeFileSchema'},
  'models/fixed-geometry.json':{schema:FixedGeometryGroupsSchema,source:'@wildshard/format/islandLibrary#FixedGeometryGroupsSchema'},
  'models/cover-phone.json':{schema:SpecimenBookSchema,source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'},
  'models/cover-desktop.json':{schema:SpecimenBookSchema,source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'},
  'models/gear-book.json':{schema:SpecimenBookSchema,source:'@wildshard/format/specimenCatalogue#SpecimenBookSchema'},
  'models/held-cards.json':{schema:HeldGraphCardsSchema,source:'@wildshard/format/heldArms#HeldGraphCardsSchema'},
  'look/cover-appearance.json':{schema:CoverAppearanceSchema,source:'@wildshard/format/coverAppearance#CoverAppearanceSchema'},
  'quests/interaction-source.json':{schema:QuestInteractionSourceSchema,source:'@wildshard/format/questInteractionSource#QuestInteractionSourceSchema'},
  'quests/runtime.json':{schema:QuestRuntimeDocumentSchema,source:'@wildshard/format/questRuntime#QuestRuntimeDocumentSchema'},
  'quests/forest-story.json':{schema:QuestStoryBindingsSchema,source:'@wildshard/format/questStoryBindings#QuestStoryBindingsSchema'},
  'quests/content.json':{schema:ChapterViewSchema,source:'@wildshard/format/questPageComposition#ChapterViewSchema'},
  'quests/chapters.json':{schema:ChapterStoryPresentationSchema,source:'@wildshard/format/questStory#ChapterStoryPresentationSchema'},
  'quests/native-story.json':{schema:NativeQuestCompositionSchema,source:'@wildshard/format/nativeQuestComposition#NativeQuestCompositionSchema'},
  'quests/native-spots.json':{schema:NativeQuestServiceSpotsSchema,source:'@wildshard/format/nativeQuestComposition#NativeQuestServiceSpotsSchema'},
  'quests/contracts.json':{schema:ContractCatalogueSchema,source:'@wildshard/format/contracts#ContractCatalogueSchema'},
  'quests/carried.json':{schema:CarriedQuestSchema,source:'@wildshard/format/questSteps#CarriedQuestSchema'},
  'quests/panels.json':{schema:QuestPanelCatalogueSchema,source:'@wildshard/format/panelTemplate#QuestPanelCatalogueSchema'},
  'actors/roster.json':{schema:NativePopulationRowsSchema,source:'@wildshard/format/populationRoster#NativePopulationRowsSchema'},
  'actors/elites.json':{schema:EliteFeatureSchema,source:'@wildshard/format/eliteFeature#EliteFeatureSchema'},
  'sim/keeper.json':{schema:PopulationKeeperRowsSchema,source:'@wildshard/format/populationKeeper#PopulationKeeperRowsSchema'},
  'sim/returns.json':{schema:PageReturnRowsSchema,source:'@wildshard/format/namedJsonContracts#PageReturnRowsSchema'},
  'quests/steps.json':{schema:QuestStepRowsSchema,source:'@wildshard/format/questSteps#QuestStepRowsSchema'},
  'quests/hints.json':{schema:QuestHintRowsSchema,source:'@wildshard/format/questSteps#QuestHintRowsSchema'},
  'quests/wake-boss.json':{schema:ChapterWakeSchema,source:'@wildshard/format/chapterDirector#ChapterWakeSchema'},
  'world/cover-composition.json':{schema:CoverCompositionSchema,source:'@wildshard/format/streamedCover#CoverCompositionSchema'},
  'world/meadow.json':{schema:PopulationFieldSchema,source:'@wildshard/format/populationEnvironment#PopulationFieldSchema'},
  'world/dressing-desktop.json':{schema:SceneDressingSchema,source:'@wildshard/format/sceneDressing#SceneDressingSchema'},
  'world/dressing-phone.json':{schema:SceneDressingSchema,source:'@wildshard/format/sceneDressing#SceneDressingSchema'},
  'world/building-sites.json':{schema:LivingPageSitesSchema,source:'@wildshard/format/forestPage#LivingPageSitesSchema'},
  'models/shape-book.json':{schema:FixedDrawRowsSchema,source:'@wildshard/format/fixedDraws#FixedDrawRowsSchema'},
  'directors/main.json':{schema:DirectorProductSchema,source:'@wildshard/format/directorProduct#DirectorProductSchema'},
  'scenes/cascade.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/cove.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/hibiscus.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/logs.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/moorings.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/palms.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/pool.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/quest-rides.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/reef.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/rocks.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/streams.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/trail.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/wreck.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'scenes/zipline.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'world/portals/scene.json':{schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'},
  'world/cards/capped-halos.json':{schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'},
  'world/cards/open-halos.json':{schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'},
  'world/cards/open-streaks.json':{schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'},
  'world/portals/sparks.json':{schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'},
  'look/fish-draw.json':{schema:PosedLibrarySchema,source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'},
  'look/gull-draw.json':{schema:PosedLibrarySchema,source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'},
  'look/wildlife-draw.json':{schema:PosedLibrarySchema,source:'@wildshard/format/namedJsonContracts#PosedLibrarySchema'},
  'audio/scene.json':{schema:AudioSceneSchema,source:'@wildshard/format/audioScene#AudioSceneSchema'},
  'world/weather.json':{schema:WeatherDocumentSchema,source:'@wildshard/format/weatherBundle#WeatherDocumentSchema'},
  'world/weather-fx.json':{schema:WeatherEffectsSchema,source:'@wildshard/format/weatherEffects#WeatherEffectsSchema'},
  'world/rain.json':{schema:RainPresentationSchema,source:'@wildshard/format/rainPresentation#RainPresentationSchema'},
  'world/weather-observations.json':{schema:ForestWeatherObservationSchema,source:'@wildshard/format/rangedPage#ForestWeatherObservationSchema'},
  'look/post.json':{schema:PostGraphLookSchema,source:'@wildshard/format/postGraphLook#PostGraphLookSchema'},
  'people/cards.json':{schema:KitFigureCardsSchema,source:'@wildshard/format/questFigures#KitFigureCardsSchema'},
  'quests/persistence.json':{schema:AdventurePersistenceSchema,source:'@wildshard/format/namedJsonContracts#AdventurePersistenceSchema'},
  'world/forest-page.json':{schema:ForestPageSchema,source:'@wildshard/format/forestPage#ForestPageSchema'},
  'world/floor.json':{schema:ForestGroundLayoutSchema,source:'@wildshard/format/forestPage#ForestGroundLayoutSchema'},
  'world/crag-cave.json':{schema:CaveFileSchema,source:'@wildshard/format/caveInterior#CaveFileSchema'},
  'world/cave-interior.json':{schema:CaveInteriorSchema,source:'@wildshard/format/caveInterior#CaveInteriorSchema'},
  'actors/creature-install.json': {schema:CreatureInstallSchema,source:'@wildshard/format/speciesLooks#CreatureInstallSchema'},
  'actors/projection.json': {schema:PopulationProjectionSchema,source:'@wildshard/format/populationProjection#PopulationProjectionSchema'},
  'actors/shelter.json': {schema:PopulationShelterSchema,source:'@wildshard/format/herdShelter#PopulationShelterSchema'},
  'world/forest-weather.json':{schema:ForestWeatherSchema,source:'@wildshard/format/forestWeather#ForestWeatherSchema'},
  'models/world-scenes.json':{schema:WorldSceneModelsSchema,source:'@wildshard/format/worldSceneModels#WorldSceneModelsSchema'},
  'actors/page-life.json': {schema:PageLifeSchema,source:'@wildshard/format/pageLife#PageLifeSchema'},
  'look/creature-looks.json': {schema:PackedCreatureLooksSchema,source:'@wildshard/format/speciesLooks#PackedCreatureLooksSchema'},
  'actors/species-looks.json': {schema:PackedCreatureLooksSchema,source:'@wildshard/format/speciesLooks#PackedCreatureLooksSchema'},
  'people/catalogue.json': {schema:FigureCatalogueSchema,source:'@wildshard/format/figures#FigureCatalogueSchema'},
  'quests/chapter-director.json': {schema:ChapterDirectorSchema,source:'@wildshard/format/chapterDirector#ChapterDirectorSchema'},
  'quests/story.json': {schema:QuestStorySchema,source:'@wildshard/format/questStory#QuestStorySchema'},
  'quests/stall.json': {schema:QuestTraderSchema,source:'@wildshard/format/namedJsonContracts#QuestTraderSchema'},
  'quests/achievements.json': {schema:AchievementCounterDataSchema,source:'@wildshard/format/achievementCounters#AchievementCounterDataSchema'},
  'quests/page-composition.json': {schema:QuestPageCompositionSchema,source:'@wildshard/format/questPageComposition#QuestPageCompositionSchema'},
  'quests/services.json': {schema:QuestServiceActionsSchema,source:'@wildshard/format/questSteps#QuestServiceActionsSchema'},
  'quests/trader.json': {schema:QuestPageInteractionsSchema,source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'},
  'quests/mill-door.json': {schema:QuestPageInteractionsSchema,source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'},
  'quests/lanterns.json': {schema:QuestPageInteractionsSchema,source:'@wildshard/format/questInteractions#QuestPageInteractionsSchema'},
  'world/building-life.json': { schema: BuildingLifeDocumentSchema, source: '@wildshard/format/buildings#BuildingLifeDocumentSchema' },
  'world/island/plan-phone.json': { schema: BakedPlacementPlanSchema, source: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema' },
  'world/island/plan-desktop.json': { schema: BakedPlacementPlanSchema, source: '@wildshard/format/bakedTiles#BakedPlacementPlanSchema' },
  'world/casts.json': { schema: WorldSceneWeldSchema, source: '@wildshard/format/worldSceneWeld#WorldSceneWeldSchema' },
  'world/fabric.json': { schema: WorldSceneWeldSchema, source: '@wildshard/format/worldSceneWeld#WorldSceneWeldSchema' },
  'world/sources/bakes.json': { schema: SceneBakeSourceSchema, source: '@wildshard/format/sceneSources#SceneBakeSourceSchema' },
  'world/sources/models.json': { schema: SceneModelSourceSchema, source: '@wildshard/format/sceneSources#SceneModelSourceSchema' },
  'world/sources/heroes.json': { schema: SceneModelSourceSchema, source: '@wildshard/format/sceneSources#SceneModelSourceSchema' },
  'world/sources/sky.json': { schema: SceneModelSourceSchema, source: '@wildshard/format/sceneSources#SceneModelSourceSchema' },
};
export type RegisteredJsonName=keyof typeof REGISTERED_JSON;
/** JSON decoding preserves the wire input; defaults belong to its consumer. */
export type RegisteredJsonValues={readonly[Name in RegisteredJsonName]:v.InferInput<(typeof REGISTERED_JSON)[Name]['schema']>};

/** Existing streamed placement names; no shard identity or draw policy. */
export type RegisteredPlacementJsonName = `world/placements/${string}.json`|`scenes/placements/${string}.json`
  |`world/foliage/${string}.json`|`world/piers/${string}.json`;
export type RegisteredScenePageJsonName=`world/scene-pages/${string}.json`;
export type RegisteredPlacementPageJsonName=`world/placement-pages/${string}.json`;
export type RegisteredFieldJsonName=`world/fields/${string}.json`;
export type RegisteredWorldSceneJsonName=`world/scenes/${string}.json`;
export type RegisteredSchemaJsonName=RegisteredJsonName|RegisteredScenePageJsonName|RegisteredPlacementJsonName|RegisteredPlacementPageJsonName|RegisteredFieldJsonName|RegisteredWorldSceneJsonName;
export interface RegisteredPlacementContract {
  readonly schema:typeof WorldScenePlacementSchema;
  readonly source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema';
}
export interface RegisteredScenePageContract {
  readonly schema:typeof WorldScenePageSchema;
  readonly source:'@wildshard/format/worldScenePages#WorldScenePageSchema';
}
export interface RegisteredPlacementPageContract {
  readonly schema:typeof WorldScenePlacementPageSchema;
  readonly source:'@wildshard/format/worldScenePlacement#WorldScenePlacementPageSchema';
}
export interface RegisteredFieldContract {
  readonly schema:typeof SceneBuffersSchema;
  readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema';
}
export interface RegisteredWorldSceneContract {
  readonly schema:typeof WorldSceneSchema;
  readonly source:'@wildshard/format/clientChannels#WorldSceneSchema';
}
export type RegisteredJsonContract=RegisteredJsonContracts[RegisteredJsonName]|RegisteredScenePageContract|RegisteredPlacementContract|RegisteredPlacementPageContract|RegisteredFieldContract|RegisteredWorldSceneContract;
const scenePageContract:RegisteredScenePageContract={schema:WorldScenePageSchema,source:'@wildshard/format/worldScenePages#WorldScenePageSchema'};
const worldSceneContract:RegisteredWorldSceneContract={schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'};
const fieldContract:RegisteredFieldContract={schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
const placementContract:RegisteredPlacementContract={schema:WorldScenePlacementSchema,source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema'};
const placementPageContract:RegisteredPlacementPageContract={schema:WorldScenePlacementPageSchema,source:'@wildshard/format/worldScenePlacement#WorldScenePlacementPageSchema'};
const placementPrefixes=['world/placements/','scenes/placements/','world/foliage/','world/piers/'];
/** Shared families use the existing defining parser, not an inferred schema.
 * Binary members keep their original independent admission. */
export function registeredJsonContract(name:RegisteredSchemaJsonName):RegisteredJsonContract;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined{
  if(isRegisteredJsonName(name))return REGISTERED_JSON[name];
  if(name.endsWith('.json')&&name.startsWith('world/scene-pages/')){
    if(!/^world\/scene-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u.test(name))
      throw new Error('Scene page JSON requires one bounded platform id');
    return scenePageContract;
  }
  if(name.endsWith('.json')&&name.startsWith('world/placement-pages/')){
    if(!/^world\/placement-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u.test(name))
      throw new Error('Placement page JSON requires one bounded platform id');
    return placementPageContract;
  }
  if(name.endsWith('.json')&&name.startsWith('world/scenes/')){
    if(!/^world\/scenes\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u.test(name))
      throw new Error('World scene JSON requires one bounded platform id');
    return worldSceneContract;
  }
  if(name.endsWith('.json')&&name.startsWith('world/fields/')){
    if(!/^world\/fields\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u.test(name))
      throw new Error('Field JSON requires one bounded platform id');
    return fieldContract;
  }
  if(name.endsWith('.json')&&placementPrefixes.some(prefix=>name.startsWith(prefix))){
    if(!/^(?:world\/placements|scenes\/placements|world\/foliage|world\/piers)\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$/u.test(name))
      throw new Error('Placement JSON requires one bounded platform id');
    return placementContract;
  }
  return undefined;
}

/** Exact registered names, with no suffix, shard or inferred alias policy. */
export function isRegisteredJsonName(name:string):name is RegisteredJsonName {return Object.hasOwn(REGISTERED_JSON,name);}

/** Verify the original consumer contracts without replacing or rewriting the
 * caller's decoded document. Existing semantic checks remain authoritative. */
export function validateRegisteredJson(name:string,value:unknown):void {
  switch(name){
    case 'poses/monkey.json':v.parse(PerchBodyFileSchema,value);break;
    case 'sim/enemy-placement.json':v.parse(EnemyPlacementsSchema,value);break;
    case 'data/physics.generated.json':v.parse(ForestNativeInputsSchema,value);break;
    case 'world/water.json':v.parse(WaterWorldSchema,value);break;
    case 'weapons/bow-page.json':v.parse(HeldBowFileSchema,value);break;
    case 'weapons/rifle-page.json':v.parse(HeldFirearmPageSchema,value);break;
    case 'weapons/sabre.json':v.parse(BladeDocumentSchema,value);break;
    case 'weapons/spear.json':v.parse(PolearmDocumentSchema,value);break;
    case 'held/slots.json':v.parse(HeldSlotsDocumentSchema,value);parseHeldSlots(value);break;
    case 'weapons/jian-row.json':parsePostGraphDocument(v.parse(HeldJianDocumentSchema,value).look.post);break;
    case 'world/dressing-pages/0.json':v.parse(SceneScatterPageSchema,value);break;
    case 'world/dressing-pages/1.json':v.parse(SceneScatterPageSchema,value);break;
    case 'sim/population-metadata.json':v.parse(PopulationHabitatSchema,value);break;
    case 'sim/taming-poses.json':v.parse(TamingPoseFileSchema,value);break;
    case 'quests/discovery.json':v.parse(AdventureContentSchema,value);break;
    case 'quests/finds.json':v.parse(FindsCatalogueSchema,value);break;
    case 'actors/sheep.json':v.parse(SpeciesActorsFileSchema,value);break;
    case 'actors/wildlife.json':v.parse(WildlifePopulationSchema,value);break;
    case 'combat/roaming.json':v.parse(RoamingCombatSchema,value);break;
    case 'client/ranged-page.json':v.parse(RangedPageSchema,value);break;
    case 'combat/room-entry.json':v.parse(ArenaRoomDocumentSchema,value);break;
    case 'combat/timed-encounters.json':v.parse(TimedEncountersSchema,value);break;
    case 'combat/titan-fight.json':v.parse(ArenaScriptFightFileSchema,value);break;
    case 'combat/titan-geometry.json':v.parse(ArenaScriptGeometrySchema,value);break;
    case 'models/cloud-specimen.json':v.parse(CloudSpecimenSchema,value);break;
    case 'riding/mounted-figure.json':v.parse(MountedSpecimenSeatSchema,value);break;
    case 'riding/session.json':v.parse(ClientRidingSessionSchema,value);break;

    case 'geometry/fixed-kits.json':v.parse(FixedPracticeFileSchema,value);break;
    case 'models/fixed-geometry.json':v.parse(FixedGeometryGroupsSchema,value);break;
    case 'models/cover-phone.json':v.parse(SpecimenBookSchema,value);break;
    case 'models/cover-desktop.json':v.parse(SpecimenBookSchema,value);break;
    case 'models/gear-book.json':v.parse(SpecimenBookSchema,value);break;
    case 'models/held-cards.json':v.parse(HeldGraphCardsSchema,value);break;
    case 'look/cover-appearance.json':v.parse(CoverAppearanceSchema,value);break;
    case 'world/sources/bakes.json':v.parse(SceneBakeSourceSchema,value);break;
    case 'world/sources/models.json':
    case 'world/sources/heroes.json':
    case 'world/sources/sky.json':v.parse(SceneModelSourceSchema,value);break;
    case 'world/island/plan-phone.json':
    case 'world/island/plan-desktop.json':v.parse(BakedPlacementPlanSchema,value);break;
    case 'world/casts.json':
    case 'world/fabric.json':parseWorldSceneWeld(value);break;
    case 'world/building-life.json':v.parse(BuildingLifeDocumentSchema,value);break;
    case 'quests/native-story.json':parseNativeQuestComposition(value);break;
    case 'quests/native-spots.json':parseNativeQuestServiceSpots(value);break;
    case 'quests/contracts.json':parseContractCatalogue(value);break;
    case 'quests/carried.json':parseCarriedQuest(value);break;
    case 'quests/panels.json':parseQuestPanelCatalogue(value);break;
    case 'quests/steps.json':parseQuestStepRows(value);break;
    case 'quests/hints.json':parseQuestHintRows(value);break;
    case 'quests/wake-boss.json':parseChapterWake(value);break;
    case 'world/dressing-desktop.json':
    case 'world/dressing-phone.json':v.parse(SceneDressingSchema,value);break;
    case 'scenes/cascade.json':
    case 'scenes/cove.json':
    case 'scenes/hibiscus.json':
    case 'scenes/logs.json':
    case 'scenes/moorings.json':
    case 'scenes/palms.json':
    case 'scenes/pool.json':
    case 'scenes/quest-rides.json':
    case 'scenes/reef.json':
    case 'scenes/rocks.json':
    case 'scenes/streams.json':
    case 'scenes/trail.json':
    case 'scenes/wreck.json':
    case 'scenes/zipline.json':
    case 'world/portals/scene.json':parseWorldScene(value);break;
    case 'world/cards/capped-halos.json':
    case 'world/cards/open-halos.json':
    case 'world/cards/open-streaks.json':
    case 'world/portals/sparks.json':parseSceneBuffers(value);break;
    case 'look/fish-draw.json':
    case 'look/gull-draw.json':
    case 'look/wildlife-draw.json':v.parse(PosedLibrarySchema,value);break;
    case 'audio/scene.json':v.parse(AudioSceneSchema,value);break;
    case 'world/weather.json':parseWeatherDocument(value);break;
    case 'world/weather-fx.json':parseWeatherEffects(value);break;
    case 'world/rain.json':v.parse(RainPresentationSchema,value);break;
    case 'world/weather-observations.json':v.parse(ForestWeatherObservationSchema,value);break;
    case 'look/post.json':parsePostGraphDocument(value);break;
    case 'people/cards.json':v.parse(KitFigureCardsSchema,value);break;
    case 'directors/main.json':v.parse(DirectorProductSchema,value);break;
    case 'actors/roster.json':parseNativePopulationRows(value);break;
    case 'actors/elites.json':parseEliteFeature(value);break;
    case 'sim/keeper.json':v.parse(PopulationKeeperRowsSchema,value);break;
    case 'sim/returns.json':v.parse(PageReturnRowsSchema,value);break;
    case 'quests/persistence.json':v.parse(AdventurePersistenceSchema,value);break;
    case 'world/building-sites.json':v.parse(LivingPageSitesSchema,value);break;
    case 'models/shape-book.json':v.parse(FixedDrawRowsSchema,value);break;
    case 'world/cover-composition.json':v.parse(CoverCompositionSchema,value);break;
    case 'world/meadow.json':v.parse(PopulationFieldSchema,value);break;
    case 'world/forest-page.json':v.parse(ForestPageSchema,value);break;
    case 'world/floor.json':v.parse(ForestGroundLayoutSchema,value);break;
    case 'world/crag-cave.json':v.parse(CaveFileSchema,value);break;
    case 'world/cave-interior.json':v.parse(CaveInteriorSchema,value);break;
    case 'actors/creature-install.json':v.parse(CreatureInstallSchema,value);break;
    case 'actors/projection.json':v.parse(PopulationProjectionSchema,value);break;
    case 'actors/shelter.json':parsePopulationShelter(value);break;
    case 'world/forest-weather.json':v.parse(ForestWeatherSchema,value);break;
    case 'models/world-scenes.json':parseWorldSceneModels(value);break;
    case 'actors/page-life.json':parsePageLife(value);break;
    case 'look/creature-looks.json':
    case 'actors/species-looks.json':v.parse(PackedCreatureLooksSchema,value);break;
    case 'people/catalogue.json':v.parse(FigureCatalogueSchema,value);break;
    case 'quests/chapter-director.json':parseChapterDirector(value);break;
    case 'quests/story.json':parseQuestStory(value);break;
    case 'quests/interaction-source.json':v.parse(QuestInteractionSourceSchema,value);break;
    case 'quests/runtime.json':v.parse(QuestRuntimeDocumentSchema,value);break;
    case 'quests/forest-story.json':v.parse(QuestStoryBindingsSchema,value);break;
    case 'quests/content.json':v.parse(ChapterViewSchema,value);break;
    case 'quests/chapters.json':parseChapterStoryPresentation(value);break;
    case 'quests/stall.json':v.parse(QuestTraderSchema,value);break;
    case 'quests/achievements.json':parseAchievementCounterData(value);break;
    case 'quests/page-composition.json':v.parse(QuestPageCompositionSchema,value);break;
    case 'quests/services.json':parseQuestServiceActions(value);break;
    case 'quests/trader.json':
    case 'quests/mill-door.json':
    case 'quests/lanterns.json':parseQuestPageInteractions(value);break;
    default:
      if(name.startsWith('world/scene-pages/')) {
        const contract=registeredJsonContract(name);
        if(contract===undefined)throw new Error(`Unregistered JSON name: ${name}`);
        v.parse(WorldScenePageSchema,value);return;
      }
      if(registeredJsonContract(name)===worldSceneContract){parseWorldScene(value);break;}
      if(registeredJsonContract(name)===fieldContract){parseSceneBuffers(value);break;}
      if(registeredJsonContract(name)===placementPageContract){parseWorldScenePlacementPage(value);break;}
      if(registeredJsonContract(name)===placementContract){parseWorldScenePlacement(value);break;}
      // J91: a server-class file's own platform family admits it; no client contract names it.
      if(name.startsWith('server/'))break;
      throw new Error(`Unregistered JSON name: ${name}`);
  }
}

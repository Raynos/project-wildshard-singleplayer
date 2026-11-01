import {PopulationKeeperRowsSchema} from './populationKeeper';
import { CoverCompositionSchema } from './streamedCover';
import { PopulationFieldSchema } from './populationEnvironment';
import { SceneDressingSchema } from './sceneDressing';
import { FixedDrawRowsSchema } from './fixedDraws';
import { ForestGroundLayoutSchema, ForestPageSchema, LivingPageSitesSchema } from './forestPage';
import { CaveFileSchema, CaveInteriorSchema } from './caveInterior';
import * as v from 'valibot';
import { NativePopulationRowsSchema, parseNativePopulationRows } from './populationRoster';
import { EliteFeatureSchema, parseEliteFeature } from './eliteFeature';
import { DirectorProductSchema } from './directorProduct';
import { AudioSceneSchema } from './audioScene';
import { KitFigureCardsSchema } from './questFigures';
import {SceneBuffersSchema,parseSceneBuffers} from './sceneBuffers';
import {WorldSceneSchema,parseWorldScene} from './clientChannels';
import {ForestWeatherSchema} from './forestWeather';
import {WorldSceneModelsSchema,parseWorldSceneModels} from './worldSceneModels';
import { AchievementCounterDataSchema,parseAchievementCounterData } from './achievementCounters';
import { QuestPageCompositionSchema } from './questPageComposition';
import { QuestServiceActionsSchema,parseQuestServiceActions,QuestStepRowsSchema,parseQuestStepRows,QuestHintRowsSchema,parseQuestHintRows } from './questSteps';
import { QuestStorySchema,parseQuestStory } from './questStory';
import { ChapterDirectorSchema,parseChapterDirector,ChapterWakeSchema,parseChapterWake } from './chapterDirector';
import { FigureCatalogueSchema } from './figures';
import { AdventurePersistenceSchema,PageReturnRowsSchema,PosedLibrarySchema,QuestTraderSchema } from './namedJsonContracts';
import { WorldScenePlacementSchema,parseWorldScenePlacement,WorldScenePlacementPageSchema,parseWorldScenePlacementPage } from './worldScenePlacement';
import { QuestPageInteractionsSchema,parseQuestPageInteractions } from './questInteractions';
import { PageLifeSchema,parsePageLife } from './pageLife';
import { PopulationProjectionSchema } from './populationProjection';
import { PopulationShelterSchema,parsePopulationShelter } from './herdShelter';
import { CreatureInstallSchema,PackedCreatureLooksSchema } from './speciesLooks';

/** Shared logical documents keep their existing names and defining parsers.
 * The private named-JSON bridge is separate until its remaining exit rows land. */
export interface RegisteredJsonContracts {
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
}
export const REGISTERED_JSON:RegisteredJsonContracts = {
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
};
export type RegisteredJsonName=keyof typeof REGISTERED_JSON;
/** JSON decoding preserves the wire input; defaults belong to its consumer. */
export type RegisteredJsonValues={readonly[Name in RegisteredJsonName]:v.InferInput<(typeof REGISTERED_JSON)[Name]['schema']>};

/** Existing streamed placement names; no shard identity or draw policy. */
export type RegisteredPlacementJsonName = `world/placements/${string}.json`|`scenes/placements/${string}.json`
  |`world/foliage/${string}.json`|`world/piers/${string}.json`;
export type RegisteredPlacementPageJsonName=`world/placement-pages/${string}.json`;
export type RegisteredFieldJsonName=`world/fields/${string}.json`;
export type RegisteredWorldSceneJsonName=`world/scenes/${string}.json`;
export type RegisteredSchemaJsonName=RegisteredJsonName|RegisteredPlacementJsonName|RegisteredPlacementPageJsonName|RegisteredFieldJsonName|RegisteredWorldSceneJsonName;
export interface RegisteredPlacementContract {
  readonly schema:typeof WorldScenePlacementSchema;
  readonly source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema';
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
export type RegisteredJsonContract=RegisteredJsonContracts[RegisteredJsonName]|RegisteredPlacementContract|RegisteredPlacementPageContract|RegisteredFieldContract|RegisteredWorldSceneContract;
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
    case 'quests/stall.json':v.parse(QuestTraderSchema,value);break;
    case 'quests/achievements.json':parseAchievementCounterData(value);break;
    case 'quests/page-composition.json':v.parse(QuestPageCompositionSchema,value);break;
    case 'quests/services.json':parseQuestServiceActions(value);break;
    case 'quests/trader.json':
    case 'quests/mill-door.json':
    case 'quests/lanterns.json':parseQuestPageInteractions(value);break;
    default:
      if(registeredJsonContract(name)===worldSceneContract){parseWorldScene(value);break;}
      if(registeredJsonContract(name)===fieldContract){parseSceneBuffers(value);break;}
      if(registeredJsonContract(name)===placementPageContract){parseWorldScenePlacementPage(value);break;}
      if(registeredJsonContract(name)===placementContract){parseWorldScenePlacement(value);break;}
      throw new Error(`Unregistered JSON name: ${name}`);
  }
}

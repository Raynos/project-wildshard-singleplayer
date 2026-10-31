import { ForestGroundLayoutSchema } from './forestPage';
import { CaveFileSchema, CaveInteriorSchema } from './caveInterior';
import * as v from 'valibot';
import {SceneBuffersSchema,parseSceneBuffers} from './sceneBuffers';
import {WorldSceneSchema,parseWorldScene} from './clientChannels';
import {ForestWeatherSchema} from './forestWeather';
import {WorldSceneModelsSchema,parseWorldSceneModels} from './worldSceneModels';
import { AchievementCounterDataSchema,parseAchievementCounterData } from './achievementCounters';
import { QuestPageCompositionSchema } from './questPageComposition';
import { QuestServiceActionsSchema,parseQuestServiceActions } from './questSteps';
import { QuestStorySchema,parseQuestStory } from './questStory';
import { ChapterDirectorSchema,parseChapterDirector } from './chapterDirector';
import { FigureCatalogueSchema } from './figures';
import { AdventurePersistenceSchema,QuestTraderSchema } from './namedJsonContracts';
import { WorldScenePlacementSchema,parseWorldScenePlacement } from './worldScenePlacement';
import { QuestPageInteractionsSchema,parseQuestPageInteractions } from './questInteractions';
import { PageLifeSchema,parsePageLife } from './pageLife';
import { PopulationProjectionSchema } from './populationProjection';
import { PopulationShelterSchema,parsePopulationShelter } from './herdShelter';
import { CreatureInstallSchema,PackedCreatureLooksSchema } from './speciesLooks';

/** Shared logical documents keep their existing names and defining parsers.
 * The private named-JSON bridge is separate until its remaining exit rows land. */
export interface RegisteredJsonContracts {
  readonly 'quests/persistence.json':{readonly schema:typeof AdventurePersistenceSchema;readonly source:'@wildshard/format/namedJsonContracts#AdventurePersistenceSchema'};
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
  'quests/persistence.json':{schema:AdventurePersistenceSchema,source:'@wildshard/format/namedJsonContracts#AdventurePersistenceSchema'},
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
export type RegisteredFieldJsonName=`world/fields/${string}.json`;
export type RegisteredWorldSceneJsonName=`world/scenes/${string}.json`;
export type RegisteredSchemaJsonName=RegisteredJsonName|RegisteredPlacementJsonName|RegisteredFieldJsonName|RegisteredWorldSceneJsonName;
export interface RegisteredPlacementContract {
  readonly schema:typeof WorldScenePlacementSchema;
  readonly source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema';
}
export interface RegisteredFieldContract {
  readonly schema:typeof SceneBuffersSchema;
  readonly source:'@wildshard/format/sceneBuffers#SceneBuffersSchema';
}
export interface RegisteredWorldSceneContract {
  readonly schema:typeof WorldSceneSchema;
  readonly source:'@wildshard/format/clientChannels#WorldSceneSchema';
}
export type RegisteredJsonContract=RegisteredJsonContracts[RegisteredJsonName]|RegisteredPlacementContract|RegisteredFieldContract|RegisteredWorldSceneContract;
const worldSceneContract:RegisteredWorldSceneContract={schema:WorldSceneSchema,source:'@wildshard/format/clientChannels#WorldSceneSchema'};
const fieldContract:RegisteredFieldContract={schema:SceneBuffersSchema,source:'@wildshard/format/sceneBuffers#SceneBuffersSchema'};
const placementContract:RegisteredPlacementContract={schema:WorldScenePlacementSchema,source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema'};
const placementPrefixes=['world/placements/','scenes/placements/','world/foliage/','world/piers/'];
/** Shared families use the existing defining parser, not an inferred schema.
 * Binary members keep their original independent admission. */
export function registeredJsonContract(name:RegisteredSchemaJsonName):RegisteredJsonContract;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined{
  if(isRegisteredJsonName(name))return REGISTERED_JSON[name];
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
    case 'quests/persistence.json':v.parse(AdventurePersistenceSchema,value);break;
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
      if(registeredJsonContract(name)===placementContract){parseWorldScenePlacement(value);break;}
      throw new Error(`Unregistered JSON name: ${name}`);
  }
}

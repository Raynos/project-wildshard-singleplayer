import * as v from 'valibot';
import { AchievementCounterDataSchema,parseAchievementCounterData } from './achievementCounters';
import { QuestPageCompositionSchema } from './questPageComposition';
import { QuestServiceActionsSchema,parseQuestServiceActions } from './questSteps';
import { QuestStorySchema,parseQuestStory } from './questStory';
import { ChapterDirectorSchema,parseChapterDirector } from './chapterDirector';
import { FigureCatalogueSchema } from './figures';
import { QuestTraderSchema } from './namedJsonContracts';
import { WorldScenePlacementSchema,parseWorldScenePlacement } from './worldScenePlacement';
import { QuestPageInteractionsSchema,parseQuestPageInteractions } from './questInteractions';
import { PackedCreatureLooksSchema } from './speciesLooks';

/** Shared logical documents keep their existing names and defining parsers.
 * The private named-JSON bridge is separate until its remaining exit rows land. */
export interface RegisteredJsonContracts {
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
export type RegisteredSchemaJsonName=RegisteredJsonName|RegisteredPlacementJsonName;
export interface RegisteredPlacementContract {
  readonly schema:typeof WorldScenePlacementSchema;
  readonly source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema';
}
export type RegisteredJsonContract=RegisteredJsonContracts[RegisteredJsonName]|RegisteredPlacementContract;
const placementContract:RegisteredPlacementContract={schema:WorldScenePlacementSchema,source:'@wildshard/format/worldScenePlacement#WorldScenePlacementSchema'};
const placementPrefixes=['world/placements/','scenes/placements/','world/foliage/','world/piers/'];
/** Shared families use the existing defining parser, not an inferred schema.
 * Binary members keep their original independent admission. */
export function registeredJsonContract(name:RegisteredSchemaJsonName):RegisteredJsonContract;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined;
export function registeredJsonContract(name:string):RegisteredJsonContract|undefined{
  if(isRegisteredJsonName(name))return REGISTERED_JSON[name];
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
      if(registeredJsonContract(name)===placementContract){parseWorldScenePlacement(value);break;}
      throw new Error(`Unregistered JSON name: ${name}`);
  }
}

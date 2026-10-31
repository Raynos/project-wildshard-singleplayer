import * as v from 'valibot';
import { AchievementCounterDataSchema,parseAchievementCounterData } from './achievementCounters';
import { QuestPageCompositionSchema } from './questPageComposition';
import { QuestServiceActionsSchema,parseQuestServiceActions } from './questSteps';
import { QuestStorySchema,parseQuestStory } from './questStory';
import { ChapterDirectorSchema,parseChapterDirector } from './chapterDirector';
import { FigureCatalogueSchema } from './figures';
import { QuestTraderSchema } from './namedJsonContracts';

/** Shared logical documents keep their existing names and defining parsers.
 * The private named-JSON bridge is separate until its remaining exit rows land. */
export interface RegisteredJsonContracts {
  readonly 'people/catalogue.json':{readonly schema:typeof FigureCatalogueSchema;readonly source:'@wildshard/format/figures#FigureCatalogueSchema'};
  readonly 'quests/chapter-director.json':{readonly schema:typeof ChapterDirectorSchema;readonly source:'@wildshard/format/chapterDirector#ChapterDirectorSchema'};
  readonly 'quests/story.json':{readonly schema:typeof QuestStorySchema;readonly source:'@wildshard/format/questStory#QuestStorySchema'};
  readonly 'quests/stall.json':{readonly schema:typeof QuestTraderSchema;readonly source:'@wildshard/format/namedJsonContracts#QuestTraderSchema'};
  readonly 'quests/achievements.json':{readonly schema:typeof AchievementCounterDataSchema;readonly source:'@wildshard/format/achievementCounters#AchievementCounterDataSchema'};
  readonly 'quests/page-composition.json':{readonly schema:typeof QuestPageCompositionSchema;readonly source:'@wildshard/format/questPageComposition#QuestPageCompositionSchema'};
  readonly 'quests/services.json':{readonly schema:typeof QuestServiceActionsSchema;readonly source:'@wildshard/format/questSteps#QuestServiceActionsSchema'};
}
export const REGISTERED_JSON:RegisteredJsonContracts = {
  'people/catalogue.json': {schema:FigureCatalogueSchema,source:'@wildshard/format/figures#FigureCatalogueSchema'},
  'quests/chapter-director.json': {schema:ChapterDirectorSchema,source:'@wildshard/format/chapterDirector#ChapterDirectorSchema'},
  'quests/story.json': {schema:QuestStorySchema,source:'@wildshard/format/questStory#QuestStorySchema'},
  'quests/stall.json': {schema:QuestTraderSchema,source:'@wildshard/format/namedJsonContracts#QuestTraderSchema'},
  'quests/achievements.json': {schema:AchievementCounterDataSchema,source:'@wildshard/format/achievementCounters#AchievementCounterDataSchema'},
  'quests/page-composition.json': {schema:QuestPageCompositionSchema,source:'@wildshard/format/questPageComposition#QuestPageCompositionSchema'},
  'quests/services.json': {schema:QuestServiceActionsSchema,source:'@wildshard/format/questSteps#QuestServiceActionsSchema'},
};
export type RegisteredJsonName=keyof typeof REGISTERED_JSON;
export type RegisteredJsonValues={readonly[Name in RegisteredJsonName]:v.InferOutput<(typeof REGISTERED_JSON)[Name]['schema']>};

/** Exact registered names, with no suffix, shard or inferred alias policy. */
export function isRegisteredJsonName(name:string):name is RegisteredJsonName {return Object.hasOwn(REGISTERED_JSON,name);}

/** Verify the original consumer contracts without replacing or rewriting the
 * caller's decoded document. Existing semantic checks remain authoritative. */
export function validateRegisteredJson(name:RegisteredJsonName,value:unknown):void {
  switch(name){
    case 'people/catalogue.json':v.parse(FigureCatalogueSchema,value);break;
    case 'quests/chapter-director.json':parseChapterDirector(value);break;
    case 'quests/story.json':parseQuestStory(value);break;
    case 'quests/stall.json':v.parse(QuestTraderSchema,value);break;
    case 'quests/achievements.json':parseAchievementCounterData(value);break;
    case 'quests/page-composition.json':v.parse(QuestPageCompositionSchema,value);break;
    case 'quests/services.json':parseQuestServiceActions(value);break;
    default:throw new Error(`Unregistered JSON name: ${String(name)}`);
  }
}

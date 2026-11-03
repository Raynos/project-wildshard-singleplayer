import { WeatherDocumentSchema } from './weatherBundle';
import { AudioSceneSchema } from './audioScene';
import { PostGraphLookSchema } from './postGraphLook';
import { WorldScenePageSchema } from './worldScenePages';
import * as v from 'valibot';
import { SceneModelSourceSchema, SceneBakeSourceSchema } from './sceneSources';
import { WorldScenePlacementPageSchema } from './worldScenePlacement';
import { WorldSceneWeldSchema } from './worldSceneWeld';
import { WorldSceneSchema } from './clientChannels';
import { SceneBuffersSchema } from './sceneBuffers';
import { WorldSceneModelsSchema } from './worldSceneModels';
import { AchievementCounterDataSchema } from './achievementCounters';
import { FigureCatalogueSchema } from './figures';
import { QuestPageCompositionSchema } from './questPageComposition';
import { AdventurePersistenceSchema, PosedLibrarySchema, QuestTraderSchema } from './namedJsonContracts';
import { PackedCreatureLooksSchema } from './speciesLooks';
import { QuestStorySchema, ChapterStoryPresentationSchema } from './questStory';
import { PageLifeSchema } from './pageLife';
import { ChapterDirectorSchema } from './chapterDirector';
import { QuestPageInteractionsSchema } from './questInteractions';
import { QuestServiceActionsSchema } from './questSteps';
import { DirectorProductSchema } from './directorProduct';
import { QuestPanelCatalogueSchema } from './panelTemplate';
import { ForestWeatherSchema } from './forestWeather';
import { validateRegisteredJson } from './registeredJson';

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
 * ground and encounter grammars remain outside this registry. */
export const PLATFORM_FILE_FAMILIES: readonly PlatformFileFamily[] = [
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

import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '@wildshard/sdk/headlessAssembly';
import { WorldSceneSchema } from '@wildshard/format/clientChannels';
import { WorldScenePlacementSchema } from '@wildshard/format/worldScenePlacement';
import { WorldSceneModelsSchema } from '@wildshard/format/worldSceneModels';
import { PageLifeSchema } from '@wildshard/format/pageLife';
import { BuildingLifeRowsSchema, BuildingLifeLookSchema } from '@wildshard/format/buildings';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import { ChapterDirectorSchema } from '@wildshard/format/chapterDirector';
import { DirectorSchema } from '@wildshard/format/director';
import { DirectorStagesSchema } from '@wildshard/format/directorStages';
import { QuestStepRowsSchema, QuestHintRowsSchema, QuestServiceActionsSchema } from '@wildshard/format/questSteps';
import { QuestPageInteractionsSchema } from '@wildshard/format/questInteractions';
import { QuestStorySchema } from '@wildshard/format/questStory';
import { AchievementCounterDataSchema } from '@wildshard/format/achievementCounters';
import { NumericPoseSchema } from '@wildshard/game/plugin/channelPrograms';
import { DirectorBindingsSchema } from '@wildshard/game/plugin/director';
import { ReturnProgramSchema } from '@wildshard/game/population/returnProgram';
import { PageReturnRowsSchema } from '@wildshard/game/population/pageReturns';
import { QuestTraderSchema } from '@wildshard/game/quest/trader';
import { EnemyPlacementsSchema, FixedGeometryGroupsSchema, PlaceSetsSchema, CoverCompositionSchema, EntryLandingsSchema } from './sections';
import { KeeperRowsSchema } from '../sim/baked';

const text = v.string(), number = v.number();
const schemas: Readonly<Record<string, v.GenericSchema>> = {
  'world/place-sets.json': PlaceSetsSchema,
  'actors/page-life.json': PageLifeSchema,
  'world/cover-composition.json': CoverCompositionSchema,
  'world/entry-landings.json': EntryLandingsSchema,
  'people/catalogue.json': FigureCatalogueSchema,
  'sim/returns.json': PageReturnRowsSchema,
  'models/world-scenes.json': WorldSceneModelsSchema,
  'world/building-life.json': v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema, initialDusk: number }),
  'models/fixed-geometry.json': FixedGeometryGroupsSchema,
  'quests/chapter-director.json': ChapterDirectorSchema,
  'directors/main.json': v.strictObject({ declaration: DirectorSchema, module: v.strictObject({ module: text, bytes: text }), stages: DirectorStagesSchema, bindings: DirectorBindingsSchema, seed: number }),
  'poses/monkey.json': v.strictObject({ clips: v.tuple([NumericPoseSchema, NumericPoseSchema]), program: ReturnProgramSchema }),
  'quests/stall.json': QuestTraderSchema,
  'quests/trader.json': QuestPageInteractionsSchema,
  'quests/steps.json': QuestStepRowsSchema,
  'quests/hints.json': QuestHintRowsSchema,
  'quests/services.json': QuestServiceActionsSchema,
  'quests/story.json': QuestStorySchema,
  'quests/achievements.json': AchievementCounterDataSchema,
  'quests/discovery.json': v.strictObject({ places: v.array(v.strictObject({ id: text, label: text, completeLabel: text,
    at: v.strictObject({ poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']), x: number, z: number, anchor: v.exactOptional(text) }), r: number })),
    guide: v.strictObject({ wander: number, idle: number, idleSpeed: number, cooldown: number, retry: number }), glassCount: number, shardFlags: v.array(text) }),
  'sim/enemy-placement.json': EnemyPlacementsSchema,
  'sim/keeper.json': KeeperRowsSchema,
};

/** Every scene, placement and document names its actual defining consumer. */
export function driftwoodJsonBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
  try {
  const schema = name.startsWith('scenes/') ? WorldSceneSchema
    : name.startsWith('world/piers/') || name.startsWith('world/foliage/') ? WorldScenePlacementSchema : schemas[name];
  const jsonSchema = name === 'sim/headless-assembly.json' ? HEADLESS_ASSEMBLY_JSON_SCHEMA : schema === undefined ? undefined : namedJsonSchema(schema);
  if (jsonSchema === undefined) throw new Error(`Missing Driftwood named JSON schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema });
  } catch (error) { throw new Error(`Driftwood named JSON ${name}: ${String(error)}`, { cause: error }); }
}

import { PackedCreatureLooksSchema } from '@wildshard/format/speciesLooks';
import { MixedPopulationSchema } from '@wildshard/format/mixedPopulation';
import { QuestPageCompositionSchema } from '@wildshard/format/questPageComposition';
import { PopulationProjectionSchema } from '@wildshard/format/populationProjection';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA, ReturnProgramSchema, PageReturnRowsSchema, QuestTraderSchema } from '@wildshard/format/namedJsonContracts';
import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { WorldSceneSchema, NumericPoseSchema } from '@wildshard/format/clientChannels';
import { WorldScenePlacementSchema } from '@wildshard/format/worldScenePlacement';
import { WorldSceneModelsSchema } from '@wildshard/format/worldSceneModels';
import { PageLifeSchema } from '@wildshard/format/pageLife';
import { BuildingLifeRowsSchema, BuildingLifeLookSchema } from '@wildshard/format/buildings';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import { ChapterDirectorSchema, ChapterWakeSchema } from '@wildshard/format/chapterDirector';
import { DirectorSchema } from '@wildshard/format/director';
import { DirectorStagesSchema } from '@wildshard/format/directorStages';
import { QuestStepRowsSchema, QuestHintRowsSchema, QuestServiceActionsSchema } from '@wildshard/format/questSteps';
import { QuestPageInteractionsSchema } from '@wildshard/format/questInteractions';
import { QuestStorySchema } from '@wildshard/format/questStory';
import { AchievementCounterDataSchema } from '@wildshard/format/achievementCounters';
import { EnemyPlacementsSchema, FixedGeometryGroupsSchema, PlaceSetsSchema, CoverCompositionSchema, EntryLandingsSchema } from './sections';
import { PopulationKeeperRowsSchema as KeeperRowsSchema } from '@wildshard/format/populationKeeper';

const text = v.string(), number = v.number();
const schemas: Readonly<Record<string, v.GenericSchema>> = {
  'quests/page-composition.json': QuestPageCompositionSchema,
  'actors/projection.json': PopulationProjectionSchema,
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
  'quests/wake-boss.json': ChapterWakeSchema,
  'directors/main.json': v.strictObject({ declaration: DirectorSchema, module: v.strictObject({ module: text, bytes: text }), stages: DirectorStagesSchema, bindings: v.null(), seed: number }),
  'look/creature-looks.json': PackedCreatureLooksSchema,
  'poses/monkey.json': v.strictObject({ clips: v.tuple([NumericPoseSchema, NumericPoseSchema]), program: ReturnProgramSchema, perch: MixedPopulationSchema.entries.perch }),
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
    : name.startsWith('world/piers/') || name.startsWith('world/foliage/') || name.startsWith('world/trail/') ? WorldScenePlacementSchema : schemas[name];
  const jsonSchema = name === 'sim/headless-assembly.json' ? HEADLESS_ASSEMBLY_JSON_SCHEMA : schema === undefined ? undefined : namedJsonSchema(schema);
  if (jsonSchema === undefined) throw new Error(`Missing Driftwood named JSON schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema });
  } catch (error) { throw new Error(`Driftwood named JSON ${name}: ${String(error)}`, { cause: error }); }
}

import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '@wildshard/sdk/headlessAssembly';
import { PosedLibrarySchema } from '@wildshard/sdk/looks/posedInstances';
import { DirectorBindingsSchema } from '@wildshard/game/plugin/director';
import { AdventurePersistenceSchema } from '@wildshard/game/quest/persistence';
import { PageLifeSchema } from '@wildshard/format/pageLife';
import { CoverAppearanceSchema } from '@wildshard/format/coverAppearance';
import { EliteFeatureSchema } from '@wildshard/format/eliteFeature';
import { ChapterDirectorSchema } from '@wildshard/format/chapterDirector';
import { DirectorSchema } from '@wildshard/format/director';
import { DirectorStagesSchema } from '@wildshard/format/directorStages';
import { PopulationShelterSchema } from '@wildshard/format/herdShelter';
import { NativePopulationRowsSchema } from '@wildshard/format/populationRoster';
import { PanelDefinitionSchema } from '@wildshard/format/panelTemplate';
import { WeatherProgramSchema } from '@wildshard/format/weatherProgram';
import { QuestServiceActionsSchema } from '@wildshard/format/questSteps';
import { QuestStorySchema } from '@wildshard/format/questStory';
import { AchievementCounterDataSchema } from '@wildshard/format/achievementCounters';
import { ExchangeSchema } from '@wildshard/format/exchange';
import { ContractCatalogueSchema } from '@wildshard/format/contracts';
import { QuestPageInteractionsSchema } from '@wildshard/format/questInteractions';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import { HeldFinishesSchema } from '@wildshard/format/heldFinishes';
import { CabinAmbienceSchema, NativeViewSchema, FloorRowsSchema } from './sections';

const number = v.number(), text = v.string();
const shape = v.strictObject({ name: text, hull: v.array(number), sphere: v.tuple([number, number, number, number]) });
const pose = v.tuple([number, number, number, number, number, number, number, number]);
const schemas: Readonly<Record<string, v.GenericSchema>> = {
  'actors/page-life.json': PageLifeSchema,
  'look/cover-appearance.json': CoverAppearanceSchema,
  'actors/elites.json': EliteFeatureSchema,
  'quests/persistence.json': AdventurePersistenceSchema,
  'look/wildlife-draw.json': PosedLibrarySchema,
  'look/native-view.json': NativeViewSchema,
  'quests/chapter-director.json': ChapterDirectorSchema,
  'directors/main.json': v.strictObject({ declaration: DirectorSchema, module: v.strictObject({ module: text, bytes: text }), stages: DirectorStagesSchema, bindings: DirectorBindingsSchema, seed: number }),
  'actors/shelter.json': PopulationShelterSchema,
  'actors/roster.json': NativePopulationRowsSchema,
  'world/ambience.json': CabinAmbienceSchema,
  'quests/panels.json': v.strictObject({ board: PanelDefinitionSchema, count: PanelDefinitionSchema }),
  'quests/stall.json': v.strictObject({ name: text, reopen: v.boolean() }),
  'world/weather.json': WeatherProgramSchema,
  'quests/services.json': QuestServiceActionsSchema,
  'quests/story.json': QuestStorySchema,
  'quests/achievements.json': AchievementCounterDataSchema,
  'quests/exchange.json': ExchangeSchema,
  'quests/contracts.json': ContractCatalogueSchema,
  'quests/mill-door.json': QuestPageInteractionsSchema,
  'quests/consequences.json': QuestPageInteractionsSchema,
  'quests/transactions.json': QuestPageInteractionsSchema,
  'quests/lanterns.json': QuestPageInteractionsSchema,
  'people/catalogue.json': FigureCatalogueSchema,
  'world/floor.json': FloorRowsSchema,
  'world/prop-shapes.json': v.strictObject({ rocks: v.array(shape), stumps: v.array(shape), log: v.strictObject({ parts: v.array(shape), capsule: v.strictObject({ kind: v.literal('capsule'), x: number, y: number, z: number, halfHeight: number, radius: number, rot: v.strictObject({ x: number, y: number, z: number, w: number }) }) }) }),
  'world/props.json': v.strictObject({ rocks: v.array(v.tuple([number, number, ...pose.items])), stumps: v.array(pose), logs: v.array(pose) }),
  'loadout/finishes.json': HeldFinishesSchema.entries.rows,
};

/** Final assembly emits each named document against its defining consumer contract. */
export function pineJsonBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
  const schema = schemas[name];
  try {
  const jsonSchema = name === 'sim/headless-assembly.json' ? HEADLESS_ASSEMBLY_JSON_SCHEMA : schema === undefined ? undefined : namedJsonSchema(schema);
  if (jsonSchema === undefined) throw new Error(`Missing Pine named JSON schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema });
  } catch (error) { throw new Error(`Pine named JSON ${name}: ${String(error)}`, { cause: error }); }
}

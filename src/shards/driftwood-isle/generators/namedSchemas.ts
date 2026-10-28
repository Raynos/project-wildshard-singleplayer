import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { authorFormatSchema, namedFormatJsonSchema, namedJsonSchema, composeNamedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { EnemyPlacementsSchema, FixedGeometryGroupsSchema } from './sections';
import type { DriftwoodFixedLayouts } from './fixedLayouts';

const MixedPopulationSchema = authorFormatSchema('mixedPopulation.MixedPopulationSchema');
const NativeQuestCompositionSchema = authorFormatSchema('nativeQuestComposition.NativeQuestCompositionSchema');
const HEADLESS_ASSEMBLY_JSON_SCHEMA = authorFormatSchema('namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA');
const ReturnProgramSchema = authorFormatSchema('namedJsonContracts.ReturnProgramSchema');
const PageReturnRowsSchema = authorFormatSchema('namedJsonContracts.PageReturnRowsSchema');
const QuestTraderSchema = authorFormatSchema('namedJsonContracts.QuestTraderSchema');
const PosedLibrarySchema = authorFormatSchema('namedJsonContracts.PosedLibrarySchema');

const text = v.string(), number = v.number();
const layoutNumber = v.pipe(v.number(), v.finite());
const layoutBox = v.strictObject({ x: layoutNumber, z: layoutNumber, hw: layoutNumber, hd: layoutNumber, rot: layoutNumber, yTop: layoutNumber, yBottom: layoutNumber });
const layoutAnchor = v.strictObject({ x: layoutNumber, y: layoutNumber, z: layoutNumber, yaw: layoutNumber });
const layoutSpot = v.looseObject({ x: layoutNumber, y: layoutNumber, z: layoutNumber, yaw: v.exactOptional(layoutNumber),
  variant: v.exactOptional(v.string()), params: v.exactOptional(v.unknown()) });
const layoutCopies = v.looseObject({ placements: v.array(layoutSpot), boxes: v.array(layoutNumber) });
const rockLayoutParams = v.strictObject({ r: layoutNumber, squash: layoutNumber, moss: layoutNumber });
const logLayoutParams = v.strictObject({ len: layoutNumber, r0: layoutNumber, r1: layoutNumber, tone: layoutNumber });
const rockLayoutCopies = v.looseObject({ placements: v.array(v.looseObject({ ...layoutSpot.entries, params: rockLayoutParams })), boxes: v.array(layoutNumber) });
const logLayoutCopies = v.looseObject({ placements: v.array(v.looseObject({ ...layoutSpot.entries, params: logLayoutParams })), boxes: v.array(layoutNumber) });
const siteLayout = v.looseObject({ site: v.unknown(), origin: v.strictObject({ x: layoutNumber, y: layoutNumber, z: layoutNumber }),
  colliders: v.array(layoutBox), descs: v.array(v.unknown()), anchors: v.record(v.string(), layoutAnchor), floors: v.array(v.unknown()) });
const shrineLayout = v.looseObject({ ...siteLayout.entries, baseY: layoutNumber, terrace: layoutNumber });
const FixedLayoutsSchema: v.GenericSchema<unknown, DriftwoodFixedLayouts> = v.strictObject({
  hut: siteLayout, lookout: siteLayout, shrine: v.strictObject({ world: shrineLayout, specimen: shrineLayout }),
  wreck: v.looseObject({ spec: v.strictObject({ x: layoutNumber, z: layoutNumber, heading: layoutNumber, roll: v.exactOptional(layoutNumber), pitch: v.exactOptional(layoutNumber), floorY: v.exactOptional(layoutNumber) }),
    floorY: layoutNumber, colliders: v.array(layoutBox), descs: v.array(v.unknown()), anchors: v.record(v.string(), layoutAnchor),
    holdBounds: v.strictObject({ x: layoutNumber, z: layoutNumber, r: layoutNumber, yMin: layoutNumber, yMax: layoutNumber }), floors: v.array(v.unknown()), shipBox: v.array(layoutNumber),
    catalogue: v.strictObject({ barrels: layoutCopies,
      crates: v.looseObject({ placements: v.array(v.looseObject({ ...layoutSpot.entries, params: v.strictObject({ size: layoutNumber, broken: v.boolean() }) })), boxes: v.array(layoutNumber) }),
      coils: v.looseObject({ placements: v.array(v.looseObject({ ...layoutSpot.entries, params: v.strictObject({ r: layoutNumber }) })), boxes: v.array(layoutNumber) }),
      logs: logLayoutCopies, rocks: rockLayoutCopies }) }),
  cove: v.looseObject({ spec: v.unknown(), floors: v.array(v.unknown()), native: v.looseObject({ colliders: v.array(layoutBox), anchors: v.record(v.string(), layoutAnchor), descs: v.array(v.unknown()), cuts: v.array(v.unknown()) }), catalogue: rockLayoutCopies }),
  logs: logLayoutCopies,
});

/** Typed source-bank metadata intake; original fields survive before each complete consumer's normal admission. */
export function parseDriftwoodFixedLayouts(input: unknown): DriftwoodFixedLayouts { return v.parse(FixedLayoutsSchema, input); }

const sharedContracts: Readonly<Record<string, string>> = {
  'sim/keeper.json': 'populationKeeper.PopulationKeeperRows',
  'quests/page-composition.json': 'questPageComposition.QuestPageComposition',
  'world/cover-composition.json': 'streamedCover.CoverComposition',
  'look/creature-looks.json': 'speciesLooks.PackedCreatureLooks',
  'actors/creature-install.json': 'speciesLooks.CreatureInstall',
  'quests/wake-boss.json': 'chapterDirector.ChapterWake',
  'actors/projection.json': 'populationProjection.PopulationProjection',
  'actors/page-life.json': 'pageLife.PageLife',
  'people/catalogue.json': 'figures.FigureCatalogue',
  'people/cards.json': 'questFigures.KitFigureCards',
  'models/world-scenes.json': 'worldSceneModels.WorldSceneModels',
  'quests/chapter-director.json': 'chapterDirector.ChapterDirector',
  'quests/trader.json': 'questInteractions.QuestPageInteractions',
  'quests/steps.json': 'questSteps.QuestStepRows',
  'quests/hints.json': 'questSteps.QuestHintRows',
  'quests/services.json': 'questSteps.QuestServiceActions',
  'quests/story.json': 'questStory.QuestStory',
  'quests/achievements.json': 'achievementCounters.AchievementCounterData',
};

const schemas: Readonly<Record<string, v.GenericSchema>> = {
  'sim/returns.json': PageReturnRowsSchema,
  'models/fixed-geometry.json': FixedGeometryGroupsSchema,
  'look/gull-draw.json': PosedLibrarySchema,
  'look/fish-draw.json': PosedLibrarySchema,
  'quests/stall.json': QuestTraderSchema,
  'quests/discovery.json': v.strictObject({ places: v.array(v.strictObject({ id: text, label: text, completeLabel: text,
    at: v.strictObject({ poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']), x: number, z: number, anchor: v.exactOptional(text) }), r: number })),
    guide: v.strictObject({ wander: number, idle: number, idleSpeed: number, cooldown: number, retry: number }), glassCount: number, shardFlags: v.array(text) }),
  'sim/enemy-placement.json': EnemyPlacementsSchema,
};

const composedSchemas: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'world/building-life.json': composeNamedJsonSchema({ kind: 'object', entries: {
    look: 'buildings.BuildingLifeLook', life: 'buildings.BuildingLifeRows', initialDusk: number,
  } }),
  'directors/main.json': composeNamedJsonSchema({ kind: 'object', entries: {
    declaration: 'director.Director', module: v.strictObject({ module: text, bytes: text,
      file: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(240))) }),
    stages: 'directorStages.DirectorStages', bindings: v.null(), seed: number,
  } }),
  'poses/monkey.json': composeNamedJsonSchema({ kind: 'object', entries: {
    clips: { kind: 'tuple', items: ['clientChannels.NumericPose', 'clientChannels.NumericPose'] },
    program: ReturnProgramSchema, perch: MixedPopulationSchema.entries.perch,
  } }),
};

const nativeAssemblySchema = { ...HEADLESS_ASSEMBLY_JSON_SCHEMA,
  allOf: [namedJsonSchema(v.object({ constants: v.object({ nativeQuest: NativeQuestCompositionSchema }) }))],
};

/** Every scene, placement and document names its actual defining consumer. */
export function driftwoodJsonBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
  try {
  const contract = name.startsWith('scenes/') ? 'clientChannels.WorldScene'
    : name.startsWith('world/piers/') || name.startsWith('world/foliage/') ? 'worldScenePlacement.WorldScenePlacement' : sharedContracts[name];
  const schema = schemas[name];
  const jsonSchema = name === 'sim/headless-assembly.json' ? nativeAssemblySchema
    : contract !== undefined ? namedFormatJsonSchema(contract) : composedSchemas[name] ?? (schema === undefined ? undefined : namedJsonSchema(schema));
  if (jsonSchema === undefined) throw new Error(`Missing Driftwood named JSON schema: ${name}`);
  return nameBlob(name, kind, bytes, { jsonSchema });
  } catch (error) { throw new Error(`Driftwood named JSON ${name}: ${String(error)}`, { cause: error }); }
}

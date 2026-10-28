import { defineNamedRows, type NamedJsonComposition, authorFormatSchema, namedFormatJsonSchema, composeNamedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { EnemyPlacementsSchema, FixedGeometryGroupsSchema } from './sections';
import type { DriftwoodFixedLayouts } from './fixedLayouts';

const MixedPopulationSchema: ReturnType<typeof authorFormatSchema<'mixedPopulation.MixedPopulationSchema'>> = authorFormatSchema('mixedPopulation.MixedPopulationSchema');
const NativeQuestCompositionSchema: ReturnType<typeof authorFormatSchema<'nativeQuestComposition.NativeQuestCompositionSchema'>> = authorFormatSchema('nativeQuestComposition.NativeQuestCompositionSchema');
const HEADLESS_ASSEMBLY_JSON_SCHEMA: ReturnType<typeof authorFormatSchema<'namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA'>> = authorFormatSchema('namedJsonContracts.HEADLESS_ASSEMBLY_JSON_SCHEMA');
const ReturnProgramSchema: ReturnType<typeof authorFormatSchema<'namedJsonContracts.ReturnProgramSchema'>> = authorFormatSchema('namedJsonContracts.ReturnProgramSchema');
const PageReturnRowsSchema: ReturnType<typeof authorFormatSchema<'namedJsonContracts.PageReturnRowsSchema'>> = authorFormatSchema('namedJsonContracts.PageReturnRowsSchema');
const QuestTraderSchema: ReturnType<typeof authorFormatSchema<'namedJsonContracts.QuestTraderSchema'>> = authorFormatSchema('namedJsonContracts.QuestTraderSchema');
const PosedLibrarySchema: ReturnType<typeof authorFormatSchema<'namedJsonContracts.PosedLibrarySchema'>> = authorFormatSchema('namedJsonContracts.PosedLibrarySchema');
const text = ({ kind: "string" } as const), number = ({ kind: "number" } as const);
const layoutNumber = ({ ...({ kind: "number" } as const), finite: true } as const);
const layoutBox = ({ kind: "object", mode: "strict", entries: { x: layoutNumber, z: layoutNumber, hw: layoutNumber, hd: layoutNumber, rot: layoutNumber, yTop: layoutNumber, yBottom: layoutNumber } } as const);
const layoutAnchor = ({ kind: "object", mode: "strict", entries: { x: layoutNumber, y: layoutNumber, z: layoutNumber, yaw: layoutNumber } } as const);
const layoutSpot = ({ kind: "object", mode: "loose", entries: { x: layoutNumber, y: layoutNumber, z: layoutNumber, yaw: ({ kind: "exact-optional", item: layoutNumber } as const),
        variant: ({ kind: "exact-optional", item: ({ kind: "string" } as const) } as const), params: ({ kind: "exact-optional", item: ({ kind: "unknown" } as const) } as const) } } as const);
const layoutCopies = ({ kind: "object", mode: "loose", entries: { placements: ({ kind: "array", item: layoutSpot } as const), boxes: ({ kind: "array", item: layoutNumber } as const) } } as const);
const rockLayoutParams = ({ kind: "object", mode: "strict", entries: { r: layoutNumber, squash: layoutNumber, moss: layoutNumber } } as const);
const logLayoutParams = ({ kind: "object", mode: "strict", entries: { len: layoutNumber, r0: layoutNumber, r1: layoutNumber, tone: layoutNumber } } as const);
const rockLayoutCopies = ({ kind: "object", mode: "loose", entries: { placements: ({ kind: "array", item: ({ kind: "object", mode: "loose", entries: { ...layoutSpot.entries, params: rockLayoutParams } } as const) } as const), boxes: ({ kind: "array", item: layoutNumber } as const) } } as const);
const logLayoutCopies = ({ kind: "object", mode: "loose", entries: { placements: ({ kind: "array", item: ({ kind: "object", mode: "loose", entries: { ...layoutSpot.entries, params: logLayoutParams } } as const) } as const), boxes: ({ kind: "array", item: layoutNumber } as const) } } as const);
const siteLayout = ({ kind: "object", mode: "loose", entries: { site: ({ kind: "unknown" } as const), origin: ({ kind: "object", mode: "strict", entries: { x: layoutNumber, y: layoutNumber, z: layoutNumber } } as const),
        colliders: ({ kind: "array", item: layoutBox } as const), descs: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const), anchors: ({ kind: "record", key: ({ kind: "string" } as const), value: layoutAnchor } as const), floors: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const) } } as const);
const shrineLayout = ({ kind: "object", mode: "loose", entries: { ...siteLayout.entries, baseY: layoutNumber, terrace: layoutNumber } } as const);
const FixedLayoutsSchema = defineNamedRows(({ kind: "object", mode: "strict", entries: {
        hut: siteLayout, lookout: siteLayout, shrine: ({ kind: "object", mode: "strict", entries: { world: shrineLayout, specimen: shrineLayout } } as const),
        wreck: ({ kind: "object", mode: "loose", entries: { spec: ({ kind: "object", mode: "strict", entries: { x: layoutNumber, z: layoutNumber, heading: layoutNumber, roll: ({ kind: "exact-optional", item: layoutNumber } as const), pitch: ({ kind: "exact-optional", item: layoutNumber } as const), floorY: ({ kind: "exact-optional", item: layoutNumber } as const) } } as const),
                floorY: layoutNumber, colliders: ({ kind: "array", item: layoutBox } as const), descs: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const), anchors: ({ kind: "record", key: ({ kind: "string" } as const), value: layoutAnchor } as const),
                holdBounds: ({ kind: "object", mode: "strict", entries: { x: layoutNumber, z: layoutNumber, r: layoutNumber, yMin: layoutNumber, yMax: layoutNumber } } as const), floors: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const), shipBox: ({ kind: "array", item: layoutNumber } as const),
                catalogue: ({ kind: "object", mode: "strict", entries: { barrels: layoutCopies,
                        crates: ({ kind: "object", mode: "loose", entries: { placements: ({ kind: "array", item: ({ kind: "object", mode: "loose", entries: { ...layoutSpot.entries, params: ({ kind: "object", mode: "strict", entries: { size: layoutNumber, broken: ({ kind: "boolean" } as const) } } as const) } } as const) } as const), boxes: ({ kind: "array", item: layoutNumber } as const) } } as const),
                        coils: ({ kind: "object", mode: "loose", entries: { placements: ({ kind: "array", item: ({ kind: "object", mode: "loose", entries: { ...layoutSpot.entries, params: ({ kind: "object", mode: "strict", entries: { r: layoutNumber } } as const) } } as const) } as const), boxes: ({ kind: "array", item: layoutNumber } as const) } } as const),
                        logs: logLayoutCopies, rocks: rockLayoutCopies } } as const) } } as const),
        cove: ({ kind: "object", mode: "loose", entries: { spec: ({ kind: "unknown" } as const), floors: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const), native: ({ kind: "object", mode: "loose", entries: { colliders: ({ kind: "array", item: layoutBox } as const), anchors: ({ kind: "record", key: ({ kind: "string" } as const), value: layoutAnchor } as const), descs: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const), cuts: ({ kind: "array", item: ({ kind: "unknown" } as const) } as const) } } as const), catalogue: rockLayoutCopies } } as const),
        logs: logLayoutCopies,
    } } as const)).schema;
/** Typed source-bank metadata intake; original fields survive before each complete consumer's normal admission. */
export function parseDriftwoodFixedLayouts(input: unknown): DriftwoodFixedLayouts { return defineNamedRows(FixedLayoutsSchema).parse(input); }
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
const schemas: Readonly<Record<string, NamedJsonComposition>> = {
    'sim/returns.json': PageReturnRowsSchema,
    'models/fixed-geometry.json': FixedGeometryGroupsSchema,
    'look/gull-draw.json': PosedLibrarySchema,
    'look/fish-draw.json': PosedLibrarySchema,
    'quests/stall.json': QuestTraderSchema,
    'quests/discovery.json': ({ kind: "object", mode: "strict", entries: { places: ({ kind: "array", item: ({ kind: "object", mode: "strict", entries: { id: text, label: text, completeLabel: text,
                        at: ({ kind: "object", mode: "strict", entries: { poi: ({ kind: "picklist", values: ['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier'] } as const), x: number, z: number, anchor: ({ kind: "exact-optional", item: text } as const) } } as const), r: number } } as const) } as const),
            guide: ({ kind: "object", mode: "strict", entries: { wander: number, idle: number, idleSpeed: number, cooldown: number, retry: number } } as const), glassCount: number, shardFlags: ({ kind: "array", item: text } as const) } } as const),
    'sim/enemy-placement.json': EnemyPlacementsSchema,
};
const composedSchemas: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    'world/building-life.json': composeNamedJsonSchema({ kind: 'object', entries: {
            look: 'buildings.BuildingLifeLook', life: 'buildings.BuildingLifeRows', initialDusk: number,
        } }),
    'directors/main.json': composeNamedJsonSchema({ kind: 'object', entries: {
            declaration: 'director.Director', module: ({ kind: "object", mode: "strict", entries: { module: text, bytes: text,
                    file: ({ kind: "exact-optional", item: ({ ...({ kind: "string" } as const), min: 1, max: 240 } as const) } as const) } } as const),
            stages: 'directorStages.DirectorStages', bindings: ({ kind: "null" } as const), seed: number,
        } }),
    'poses/monkey.json': composeNamedJsonSchema({ kind: 'object', entries: {
            clips: { kind: 'tuple', items: ['clientChannels.NumericPose', 'clientChannels.NumericPose'] },
            program: ReturnProgramSchema, perch: MixedPopulationSchema.entries.perch,
        } }),
};
const nativeAssemblySchema = { ...HEADLESS_ASSEMBLY_JSON_SCHEMA,
    allOf: [defineNamedRows(({ kind: "object", mode: "strip", entries: { constants: ({ kind: "object", mode: "strip", entries: { nativeQuest: NativeQuestCompositionSchema } } as const) } } as const)).jsonSchema],
};
/** Every scene, placement and document names its actual defining consumer. */
export function driftwoodJsonBlob(name: string, kind: 'json', bytes: Uint8Array): NamedBlob {
    try {
        const contract = name.startsWith('scenes/') ? 'clientChannels.WorldScene'
            : name.startsWith('world/piers/') || name.startsWith('world/foliage/') ? 'worldScenePlacement.WorldScenePlacement' : sharedContracts[name];
        const schema = schemas[name];
        const jsonSchema = name === 'sim/headless-assembly.json' ? nativeAssemblySchema
            : contract !== undefined ? namedFormatJsonSchema(contract) : composedSchemas[name] ?? (schema === undefined ? undefined : defineNamedRows(schema).jsonSchema);
        if (jsonSchema === undefined)
            throw new Error(`Missing Driftwood named JSON schema: ${name}`);
        return nameBlob(name, kind, bytes, { jsonSchema });
    }
    catch (error) {
        throw new Error(`Driftwood named JSON ${name}: ${String(error)}`, { cause: error });
    }
}

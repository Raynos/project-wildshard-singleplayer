import { defineNamedRows, type NamedRowValue, authorFormatSchema , type NamedRows } from '@wildshard/sdk/formatJsonSchema';

const CollectionDisplaysSchema: ReturnType<typeof authorFormatSchema<'collectionDisplay.CollectionDisplaysSchema'>> = authorFormatSchema('collectionDisplay.CollectionDisplaysSchema');
const AmbientFlockSchema: ReturnType<typeof authorFormatSchema<'ambientLife.AmbientFlockSchema'>> = authorFormatSchema('ambientLife.AmbientFlockSchema');
const BodySlotsSchema: ReturnType<typeof authorFormatSchema<'bodySlots.BodySlotsSchema'>> = authorFormatSchema('bodySlots.BodySlotsSchema');
const ResolvedIslandLibrarySchema: ReturnType<typeof authorFormatSchema<'islandLibrary.ResolvedIslandLibrarySchema'>> = authorFormatSchema('islandLibrary.ResolvedIslandLibrarySchema');
const text = ({ ...({ kind: "string" } as const), max: 512 } as const);
const number = ({ kind: "number" } as const);
const natural = ({ ...({ kind: "number" } as const), integer: true, min: 0 } as const);
const placement = ({ kind: "object", mode: "strict", entries: {
        enemies: ({ ...({ kind: "array", item: ({ kind: "object", mode: "strict", entries: { kind: ({ kind: "picklist", values: ['crab', 'monkey', 'sailor'] } as const), variant: ({ kind: "nullable", item: text } as const),
                        x: number, z: number, yaw: number, herd: number, practice: ({ kind: "exact-optional", item: ({ kind: "literal", value: true } as const) } as const) } } as const) } as const), max: 64 } as const),
        herds: natural, centres: ({ ...({ kind: "array", item: ({ kind: "object", mode: "strict", entries: { x: number, z: number } } as const) } as const), max: 16 } as const),
        kinds: ({ ...({ kind: "array", item: ({ kind: "picklist", values: ['crab', 'monkey'] } as const) } as const), max: 16 } as const),
        stream: ({ kind: "object", mode: "strict", entries: { version: ({ kind: "literal", value: 1 } as const), state: natural, initial: natural, scrambledFork: ({ kind: "boolean" } as const) } } as const),
    } } as const);
/** Named offline spawn rows; all sampling runs only in the author compiler. */
export const EnemyPlacementsSchema: NamedRows<{ seed: number; practice: { x: number; z: number; }; hold: { x: number; z: number; }; volley: NamedRowValue<typeof BodySlotsSchema>; page: { phone: { herds: number; enemies: { variant: string | null; x: number; z: number; yaw: number; kind: "crab" | "monkey" | "sailor"; herd: number; practice?: true; }[]; centres: { x: number; z: number; }[]; kinds: ("crab" | "monkey")[]; stream: { version: 1; state: number; initial: number; scrambledFork: boolean; }; }; desktop: { herds: number; enemies: { variant: string | null; x: number; z: number; yaw: number; kind: "crab" | "monkey" | "sailor"; herd: number; practice?: true; }[]; centres: { x: number; z: number; }[]; kinds: ("crab" | "monkey")[]; stream: { version: 1; state: number; initial: number; scrambledFork: boolean; }; }; }; native: { herds: number; enemies: { variant: string | null; x: number; z: number; yaw: number; kind: "crab" | "monkey" | "sailor"; herd: number; practice?: true; }[]; centres: { x: number; z: number; }[]; kinds: ("crab" | "monkey")[]; stream: { version: 1; state: number; initial: number; scrambledFork: boolean; }; }; }>['schema'] = defineNamedRows(({ kind: "object", mode: "strict", entries: { seed: natural, volley: BodySlotsSchema,
        practice: ({ kind: "object", mode: "strict", entries: { x: number, z: number } } as const), hold: ({ kind: "object", mode: "strict", entries: { x: number, z: number } } as const),
        page: ({ kind: "object", mode: "strict", entries: { phone: placement, desktop: placement } } as const), native: placement } } as const)).schema;
export type EnemyPlacements = NamedRowValue<typeof EnemyPlacementsSchema>;
/** Named geometry bootstrap data; no private section or executable mirror is added. */
export const FixedGeometryGroupsSchema: NamedRows<{ cargo: { barrel: string; lying: string; crate: string; broken: string; coil: string; }; driftLogs: { long: string; short: string; pale: string; }; npc: { trader: { body: string; head: string; upper: string; fore: string; }; castaway: { body: string; head: string; camp: string; arm: string; flames: string; }; }; entryDecks: { world: string; deep: string; shallow: string; }; cover: Record<string, string>; piers: Record<string, { deck: string; cloth: string | null; }>; }>['schema'] = defineNamedRows(({ kind: "object", mode: "strict", entries: {
        cargo: ({ kind: "object", mode: "strict", entries: { barrel: text, lying: text, crate: text, broken: text, coil: text } } as const),
        driftLogs: ({ kind: "object", mode: "strict", entries: { long: text, short: text, pale: text } } as const),
        npc: ({ kind: "object", mode: "strict", entries: { trader: ({ kind: "object", mode: "strict", entries: { body: text, head: text, upper: text, fore: text } } as const), castaway: ({ kind: "object", mode: "strict", entries: { body: text, camp: text, head: text, arm: text, flames: text } } as const) } } as const),
        entryDecks: ({ kind: "object", mode: "strict", entries: { world: text, deep: text, shallow: text } } as const),
        cover: ({ kind: "record", key: text, value: text } as const), piers: ({ kind: "record", key: text, value: ({ kind: "object", mode: "strict", entries: { deck: text, cloth: ({ kind: "nullable", item: text } as const) } } as const) } as const),
    } } as const)).schema;
export const SECTIONS: {
  'custom/enemyPlacements': typeof EnemyPlacementsSchema;
  'custom/collections': typeof CollectionDisplaysSchema;
  'custom/cumulusPuffs': NamedRows<number[][]>['schema'];
  'custom/fixedLayouts': typeof ResolvedIslandLibrarySchema;
  'custom/gullFlock': typeof AmbientFlockSchema;
} = { 'custom/enemyPlacements': defineNamedRows(EnemyPlacementsSchema).schema, 'custom/collections': defineNamedRows(CollectionDisplaysSchema).schema, 'custom/cumulusPuffs': defineNamedRows(({ ...({ kind: "array", item: ({ ...({ kind: "array", item: number } as const), length: 7 } as const) } as const), max: 1024 } as const)).schema, 'custom/fixedLayouts': defineNamedRows(ResolvedIslandLibrarySchema).schema, 'custom/gullFlock': defineNamedRows(AmbientFlockSchema).schema } as const;
const bridgeSpan = ({ kind: "object", mode: "strict", entries: { a: ({ kind: "tuple", items: [number, number] } as const), b: ({ kind: "tuple", items: [number, number] } as const), sag: number } } as const);
export const FILE_SCHEMAS: { 'data/bridgeRows.json': NamedRows<{ world: { a: [number, number]; b: [number, number]; sag: number }; specimen: { a: [number, number]; b: [number, number]; sag: number } }>['schema'] } = { 'data/bridgeRows.json': defineNamedRows(({ kind: "object", mode: "strict", entries: { world: bridgeSpan, specimen: bridgeSpan } } as const)).schema };
/** Admit authored bridge endpoints through their defining grammar without an erased JSON shim. */
export function readBridgeSpans(input: unknown): NamedRowValue<typeof FILE_SCHEMAS['data/bridgeRows.json']> {
    return defineNamedRows(FILE_SCHEMAS['data/bridgeRows.json']).parse(input);
}

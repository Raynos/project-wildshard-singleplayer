import { defineNamedRows, type NamedRowValue, authorFormatSchema } from '@wildshard/sharddev/formatJsonSchema';

const number = ({ kind: 'number' } as const);
const EnemyPlacementsRows=defineNamedRows(authorFormatSchema('populationProjection.EnemyPlacementsSchema'));
export const EnemyPlacementsSchema:ReturnType<typeof authorFormatSchema<'populationProjection.EnemyPlacementsSchema'>>=EnemyPlacementsRows.schema;
export type EnemyPlacements=NamedRowValue<typeof EnemyPlacementsSchema>;
/** Named geometry bootstrap data; no private section or executable mirror is added. */
const FixedGeometryGroupsRows=defineNamedRows(authorFormatSchema('islandLibrary.FixedGeometryGroupsSchema'));
export const FixedGeometryGroupsSchema:ReturnType<typeof authorFormatSchema<'islandLibrary.FixedGeometryGroupsSchema'>>=FixedGeometryGroupsRows.schema;
const bridgeSpan = ({ kind: "object", mode: "strict", entries: { a: ({ kind: "tuple", items: [number, number] } as const), b: ({ kind: "tuple", items: [number, number] } as const), sag: number } } as const);
const BridgeRowsSchema = defineNamedRows(({ kind: "object", mode: "strict", entries: { world: bridgeSpan, specimen: bridgeSpan } } as const)).schema;
/** Admit authored bridge endpoints through their defining grammar without an erased JSON shim. */
export function readBridgeSpans(input: unknown): { world: { a: [number, number]; b: [number, number]; sag: number }; specimen: { a: [number, number]; b: [number, number]; sag: number } } {
    return defineNamedRows(BridgeRowsSchema).parse(input);
}

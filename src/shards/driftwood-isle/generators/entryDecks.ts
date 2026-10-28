import { defineNamedRows , type NamedRows } from '@wildshard/sdk/formatJsonSchema';
import { driftwoodEntryDeckRows } from './entryDeck';
import { ENTRY_ROWS as authoredEntryRows } from './entryRows';

const { DRY_ENTRIES } = authoredEntryRows;
const finite = { kind: 'number', finite: true } as const;
const positive = { ...finite, min: 0.005, max: 500 } as const;
const rect = defineNamedRows({ kind: 'object', mode: 'strict', entries: {
  minX: finite, minZ: finite, maxX: finite, maxZ: finite,
} }, row => row.minX < row.maxX && row.minZ < row.maxZ, 'positive footprint').schema;
const slab = { kind: 'object', mode: 'strict', entries: { x: finite, z: finite, hw: positive, hd: positive,
  rot: { kind: 'literal', value: 0 }, yTop: { kind: 'literal', value: 0 }, yBottom: { kind: 'literal', value: -0.55 } } } as const;
const placement = { kind: 'object', mode: 'strict', entries: { x: finite, y: { kind: 'literal', value: 0 }, z: finite, yaw: finite,
  params: { kind: 'object', mode: 'strict', entries: { run: { kind: 'literal', value: 16.5 }, bed: { ...finite, min: -14, max: -0.4 } } } } } as const;
const row = { kind: 'object', mode: 'strict', entries: { edge: { kind: 'picklist', values: DRY_ENTRIES }, rect, slab, placement } } as const;
const transport: NamedRows<{ notice: string; rows: { edge: "north" | "east" | "south" | "west"; rect: { minX: number; minZ: number; maxX: number; maxZ: number; }; slab: { x: number; z: number; hw: number; hd: number; rot: 0; yTop: 0; yBottom: -0.55; }; placement: { x: number; z: number; y: 0; yaw: number; params: { run: 16.5; bed: number; }; }; }[]; }> = defineNamedRows({ kind: 'object', mode: 'strict', entries: {
  notice: { kind: 'string', startsWith: 'DO NOT EDIT:' }, rows: { kind: 'array', item: row, length: 4 },
} }, value => value.rows.every((item, index) => item.edge === DRY_ENTRIES[index]), 'original entry order');

/** At build time, refuse invalid cached placements before canonical section publication. */
export function decodeEntryDecks(source: unknown): ReturnType<typeof transport.parse>['rows'] {
  return transport.parse(source).rows;
}
/** Original dry footprints, foam slabs and seabed-derived column placements. */
export const ENTRY_DECKS: readonly ReturnType<typeof transport.parse>['rows'][number][] = decodeEntryDecks(driftwoodEntryDeckRows());

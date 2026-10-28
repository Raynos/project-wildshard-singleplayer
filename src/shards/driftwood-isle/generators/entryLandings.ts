import { defineNamedRows } from '@wildshard/sdk/formatJsonSchema';
import { driftwoodEntryFloorRows } from './entryFloors';
import { ENTRY_ROWS as authoredEntryRows } from './entryRows';

const { DRY_ENTRIES } = authoredEntryRows;
const finite = { kind: 'number', finite: true } as const;
const extent = { ...finite, min: 0.005, max: 250 } as const;
const box = { kind: 'object', mode: 'strict', entries: { kind: { kind: 'literal', value: 'box' }, x: finite, y: finite, z: finite,
  hx: extent, hy: extent, hz: extent, surface: { kind: 'literal', value: 'stone' } } } as const;
const landing = { kind: 'object', mode: 'strict', entries: { edge: { kind: 'picklist', values: DRY_ENTRIES }, box } } as const;
const transport = defineNamedRows({ kind: 'object', mode: 'strict', entries: {
  notice: { kind: 'string', startsWith: 'DO NOT EDIT:' }, rows: { kind: 'array', item: landing, length: 4 },
} }, value => value.rows.every((row, index) => row.edge === DRY_ENTRIES[index]), 'original entry registration order');

/** One immutable landing: the native world and shardfile consume the same admitted row. */
export type EntryLanding = ReturnType<typeof transport.parse>['rows'][number];
/** Refuse malformed cached data before it reaches the native collider owner. */
function decodeEntryLandings(source: unknown): EntryLanding[] {
  return transport.parse(source).rows;
}
/** Native slabs compiled at build time; no runtime recipe or generator enters the client. */
export const ENTRY_LANDINGS: readonly EntryLanding[] = decodeEntryLandings(driftwoodEntryFloorRows());

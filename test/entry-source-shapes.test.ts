import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { decodeEntryDecks, ENTRY_DECKS } from '../src/shards/driftwood-isle/generators/entryDecks';
import { ENTRY_LANDINGS, type EntryLanding } from '../src/shards/driftwood-isle/generators/entryLandings';
import { driftwoodEntryDeckRows } from '../src/shards/driftwood-isle/generators/entryDeck';
import { driftwoodEntryFloorRows } from '../src/shards/driftwood-isle/generators/entryFloors';
import { ENTRY_ROWS } from '../src/shards/driftwood-isle/generators/entryRows';

const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.minValue(0.005), v.maxValue(500));
const rect = v.pipe(v.strictObject({ minX: finite, minZ: finite, maxX: finite, maxZ: finite }),
  v.check(row => row.minX < row.maxX && row.minZ < row.maxZ, 'positive footprint'));
const slab = v.strictObject({ x: finite, z: finite, hw: positive, hd: positive, rot: v.literal(0), yTop: v.literal(0), yBottom: v.literal(-0.55) });
const placement = v.strictObject({ x: finite, y: v.literal(0), z: finite, yaw: finite,
  params: v.strictObject({ run: v.literal(16.5), bed: v.pipe(finite, v.minValue(-14), v.maxValue(-0.4)) }) });
const row = v.strictObject({ edge: v.picklist(ENTRY_ROWS.DRY_ENTRIES), rect, slab, placement });
const original = v.pipe(v.strictObject({ notice: v.pipe(v.string(), v.startsWith('DO NOT EDIT:')), rows: v.pipe(v.array(row), v.length(4)) }),
  v.check(value => value.rows.every((item, index) => item.edge === ENTRY_ROWS.DRY_ENTRIES[index]), 'original entry order'));

function outcome(read: () => unknown): unknown {
  try { return { rows: read() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: JSON.stringify(error.issues) }; throw error; }
}

test('source-owned entry footprints retain full native values, types, bounds and ordered refusals', () => {
  expectTypeOf<ReturnType<typeof decodeEntryDecks>>().toEqualTypeOf<v.InferOutput<typeof original>['rows']>();
  expectTypeOf<v.InferOutput<typeof original>['rows']>().toEqualTypeOf<ReturnType<typeof decodeEntryDecks>>();
  const input = driftwoodEntryDeckRows();
  expect(JSON.stringify(ENTRY_DECKS)).toBe(JSON.stringify(v.parse(original, input).rows));
  const first = input.rows[0];
  if (first === undefined) throw new Error('Missing original entry');
  for (const bad of [null, {}, { ...input, notice: 'invalid' }, { ...input, rows: [...input.rows].reverse() },
    { ...input, rows: [{ ...first, slab: { ...first.slab, hw: 0 } }, ...input.rows.slice(1)] },
    { ...input, rows: [{ ...first, rect: { ...first.rect, maxX: first.rect.minX } }, ...input.rows.slice(1)] },
    { ...input, rows: [{ ...first, placement: { ...first.placement, params: { ...first.placement.params, bed: -15 } } }, ...input.rows.slice(1)] }]) {
    expect(outcome(() => decodeEntryDecks(bad))).toEqual(outcome(() => v.parse(original, bad).rows));
  }
  const extent = v.pipe(finite, v.minValue(0.005), v.maxValue(250));
  const landing = v.strictObject({ edge: v.picklist(ENTRY_ROWS.DRY_ENTRIES), box: v.strictObject({ kind: v.literal('box'),
    x: finite, y: finite, z: finite, hx: extent, hy: extent, hz: extent, surface: v.literal('stone') }) });
  expectTypeOf<EntryLanding>().toEqualTypeOf<v.InferOutput<typeof landing>>();
  expectTypeOf<v.InferOutput<typeof landing>>().toEqualTypeOf<EntryLanding>();
  expect(JSON.stringify(ENTRY_LANDINGS)).toBe(JSON.stringify(v.parse(v.array(landing), driftwoodEntryFloorRows().rows)));
});

import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as v from 'valibot';
import { decodeFloorRecords } from '../src/shards/pine-hollow/generators/floorRows.mjs';
import { output } from '../src/shards/pine-hollow/generators/output';
import { FloorRowsSchema } from '../src/shards/pine-hollow/runtime/world/timberSites';

test('the named floor preserves all 22,250 shipping placements and refuses malformed or oversized records', () => {
  const file = output.namedFiles.find(row => row.name === 'world/floor.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named floor');
  const rows = v.parse(FloorRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  // Recorded from the actual shipping loadUnderPlacements at 238bcf425,
  // before moving its decoder: hash every value, tint, normal and array order.
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(rows.layout)))).toBe('7c0b23e88b4c31727bed35d146ded1db0c13a6b049657365a0616c44b9704dfb');
  expect(rows.counts).toEqual([6000, 3750, 5000, 3000, 3000, 1500]);
  expect(() => v.parse(FloorRowsSchema, { ...rows, counts: [1, 1, 1, 1, 1, 1] })).toThrow();
  expect(() => v.parse(FloorRowsSchema, { ...rows, extra: true })).toThrow();
  const point = rows.layout.ferns[0];
  if (point === undefined) throw new Error('Missing shipping fern');
  expect(() => v.parse(FloorRowsSchema, { ...rows, layout: { ...rows.layout, ferns: [{ ...point, nx: Infinity }] } })).toThrow();
  expect(() => v.parse(FloorRowsSchema, { counts: [40001, 0, 0, 0, 0, 0], layout: { ferns: Array.from({ length: 40001 }, () => point), shrubs: [], litter: [], stones: [], moss: [], reeds: [] } })).toThrow();
  expect(() => decodeFloorRecords(new Uint8Array(32), rows.counts)).toThrow('invalid floor records');
  const invalidCounts = new Uint8Array(32), view = new DataView(invalidCounts.buffer);
  view.setUint32(0, 0x46555357, true); view.setUint32(4, 2, true);
  expect(() => decodeFloorRecords(invalidCounts, rows.counts)).toThrow('invalid floor counts');
});

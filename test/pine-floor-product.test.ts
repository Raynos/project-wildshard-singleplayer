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
  const facts = Object.fromEntries(Object.entries(rows.layout).map(([kind, items]) => [kind, items.map(({ x, y, z, nx, ny, nz, rot, scale, r, g, b }) => ({ x, y, z, nx, ny, nz, rot, scale, r, g, b }))]));
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(facts)))).toBe('7c0b23e88b4c31727bed35d146ded1db0c13a6b049657365a0616c44b9704dfb');
  // The original page composer d7dcfb102 uploads Float32 instance matrices.
  // Compare every uploaded value; native libm's extra float64 bits vary by CPU.
  const matrices = Object.values(rows.layout).map(items => items.map(it => it.matrix.map(Math.fround)));
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(matrices)))).toBe('1c16bc39f9384dbc3e7b6358245c42499f77f375eee04a038434f3da71cdd008');
  expect(rows.counts).toEqual([6000, 3750, 5000, 3000, 3000, 1500]);
  expect(() => v.parse(FloorRowsSchema, { ...rows, counts: [1, 1, 1, 1, 1, 1] })).toThrow();
  expect(() => v.parse(FloorRowsSchema, { ...rows, extra: true })).toThrow();
  const point = rows.layout.ferns[0];
  if (point === undefined) throw new Error('Missing shipping fern');
  expect(() => v.parse(FloorRowsSchema, { ...rows, layout: { ...rows.layout, ferns: [{ ...point, nx: Infinity }] } })).toThrow();
  expect(() => v.parse(FloorRowsSchema, { ...rows, layout: { ...rows.layout, ferns: [{ ...point, matrix: [1] }] } })).toThrow();
  expect(() => v.parse(FloorRowsSchema, { counts: [40001, 0, 0, 0, 0, 0], layout: { ferns: Array.from({ length: 40001 }, () => point), shrubs: [], litter: [], stones: [], moss: [], reeds: [] } })).toThrow();
  expect(() => decodeFloorRecords(new Uint8Array(32), rows.counts)).toThrow('invalid floor records');
  const invalidCounts = new Uint8Array(32), view = new DataView(invalidCounts.buffer);
  view.setUint32(0, 0x46555357, true); view.setUint32(4, 2, true);
  expect(() => decodeFloorRecords(invalidCounts, rows.counts)).toThrow('invalid floor counts');
});

import { expect, test } from 'vitest';
import { ValiError } from 'valibot';
import { describeNavigation, readNavigation, validateNavigationAssets, type Navigation } from './navigation';
import { decodeNavigation } from './navigationBytes';

/** WSNM v1: one voxel triangle with one external neighbour and an implicit detail fan. */
function triangle(): Uint8Array {
  const bytes = new Uint8Array(113), view = new DataView(bytes.buffer);
  let at = 0;
  const u32 = (...values: number[]): void => { for (const value of values) { view.setUint32(at, value, true); at += 4; } };
  const f32 = (...values: number[]): void => { for (const value of values) { view.setFloat32(at, value, true); at += 4; } };
  const u16 = (...values: number[]): void => { for (const value of values) { view.setUint16(at, value, true); at += 2; } };
  const u8 = (...values: number[]): void => { for (const value of values) view.setUint8(at++, value); };
  u32(0x4d4e5357, 1, 1);
  f32(.5, 2, .25, .25, .125, 0, 0, 0, 8);
  u32(1, 0, 0);
  f32(0, 0, 0, 2, 2, 2);
  u16(3, 1, 0);
  u8(0, 4, 0, 0, 0, 4);
  u16(0, 0, 0);
  u8(3, 1, 7, 0, 1, 2, 0, 248, 0, 0, 0);
  if (at !== bytes.length) throw new Error('Incomplete triangle fixture');
  return bytes;
}
const file = 'a'.repeat(64);

test('navigation admission returns exact detached polygons and detail fans without a result cache', () => {
  const bytes = triangle(), row = describeNavigation(file, bytes), expected = decodeNavigation(bytes);
  const first = readNavigation(row, bytes), second = readNavigation(row, bytes);
  expect(first).toEqual(expected); expect(second).toEqual(expected); expect(first).not.toBe(second);
  const firstTile = first[0]?.tiles[0], secondTile = second[0]?.tiles[0];
  if (firstTile === undefined || secondTile === undefined) throw new Error('Missing decoded triangle');
  expect(firstTile.vertices).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 1]);
  expect(firstTile.polys).toEqual([{ vertices: [0, 1, 2], neis: [0, 0x8000, 0], flags: 7, area: 1 }]);
  expect(firstTile.detailTriangles).toEqual([0, 1, 2, 21]);
  firstTile.vertices[0] = 123;
  expect(secondTile.vertices[0]).toBe(0);
  expect(readNavigation(row, bytes)).toEqual(expected);
  bytes[90] = 8;
  expect(secondTile.vertices[0]).toBe(0);
  expect(readNavigation(row, bytes)[0]?.tiles[0]?.vertices[0]).toBe(2);
});

const mutations: { name: string; change: (row: Navigation) => void }[] = [
  { name: 'bounds', change: row => { row.bounds[3] = 3; } },
  { name: 'radius', change: row => { for (const layer of row.layers) layer.radius = 1; } },
  { name: 'origin', change: row => { for (const layer of row.layers) layer.origin[0] = 1; } },
  { name: 'tile size', change: row => { for (const layer of row.layers) layer.tileSize = 9; } },
  { name: 'tile grid', change: row => { for (const layer of row.layers) layer.tiles = [[1, 0]]; } },
];
test.each(mutations)('navigation still refuses a mismatched declared $name', ({ change }) => {
  const bytes = triangle(), row = describeNavigation(file, bytes);
  change(row);
  expect(() => readNavigation(row, bytes)).toThrow('Navigation declaration differs from immutable bytes');
  expect(() => validateNavigationAssets({ navigation: row }, new Map([[file, bytes]]))).toThrow('Navigation declaration differs from immutable bytes');
});

test('every truncated stream and malformed polygon still refuses before publication', () => {
  const bytes = triangle(), row = describeNavigation(file, bytes);
  for (let end = 0; end < bytes.length; end++) expect(() => readNavigation(row, bytes.subarray(0, end))).toThrow(RangeError);
  for (const [offset, value] of [[102, 2], [105, 3], [108, 2]] as const) {
    const malformed = bytes.slice(); malformed[offset] = value;
    expect(() => readNavigation(row, malformed)).toThrow(RangeError);
  }
  const trailing = new Uint8Array(bytes.length + 1); trailing.set(bytes);
  expect(() => readNavigation(row, trailing)).toThrow('Navigation trailing bytes or empty mesh');
  expect(() => validateNavigationAssets({ navigation: row }, new Map())).toThrow('Missing navigation bytes');
});

test('declaration schema validation still precedes stream decoding', () => {
  const row = describeNavigation(file, triangle());
  Reflect.set(row, 'version', 2);
  expect(() => readNavigation(row, new Uint8Array())).toThrow(ValiError);
});

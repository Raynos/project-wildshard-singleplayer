import { expect, test } from 'vitest';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { completeL0Tiles } from './tileGrid';
import { WorldBakeRows } from './worldRows';

function occupied(lod: 0 | 1, x: number, z: number): Shardfile['tiles'][number] {
  const size = lod === 0 ? 62.5 : 125;
  return { lod, x, z, bounds: { min: [-250 + x * size, -3, -250 + z * size], max: [-250 + (x + 1) * size, 4, -250 + (z + 1) * size] },
    geometricError: 0.25, files: ['a'.repeat(64)], compressed: 100, decoded: 200, gpu: 300, triangles: 2, draws: 1 };
}

test('full-world completion preserves occupied and L1 metadata and adds only vacant L0 declarations', () => {
  const input = [occupied(1, 3, 2), occupied(0, 6, 4), occupied(0, 2, 5)], before = structuredClone(input);
  const complete = completeL0Tiles(input), fine = complete.filter(tile => tile.lod === 0);
  expect(fine).toHaveLength(64);
  expect(new Set(fine.map(tile => `${tile.x}/${tile.z}`)).size).toBe(64);
  expect(complete.slice(0, input.length)).toEqual(before);
  expect(input).toEqual(before);
  expect(complete.filter(tile => tile.lod === 1)).toEqual([before[0]]);
  for (const tile of complete.slice(input.length)) {
    expect(tile).toMatchObject({ files: [], compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, geometricError: 0 });
    expect(tile.bounds).toEqual({ min: [-250 + tile.x * 62.5, 0, -250 + tile.z * 62.5], max: [-250 + (tile.x + 1) * 62.5, 0, -250 + (tile.z + 1) * 62.5] });
  }
  expect(completeL0Tiles(complete)).toEqual(complete);
});

test('bad addresses, duplicate rows and invalid payload declarations refuse before completion', () => {
  const row = occupied(0, 0, 0);
  expect(() => completeL0Tiles([row, row])).toThrow('Invalid tile grid');
  expect(() => completeL0Tiles([{ ...row, x: 8 }])).toThrow('Invalid tile grid');
  expect(() => completeL0Tiles([{ ...row, x: 0.5 }])).toThrow();
  expect(() => completeL0Tiles([{ ...row, bounds: { min: row.bounds.min, max: [-180, 4, -187.5] } }])).toThrow('Invalid tile grid');
  expect(() => completeL0Tiles([{ ...row, files: ['not-a-content-hash'] }])).toThrow();
  expect(() => completeL0Tiles([{ ...row, decoded: -1 }])).toThrow();
});

test('library-only packing stays sparse and empty full worlds need no fake payload', () => {
  const library = new WorldBakeRows(); library.asset(new Uint8Array([1]), 'binary');
  const packed = library.finish('pbr');
  expect(packed.tiles).toEqual([]); expect(packed.props.tiles).toEqual([]); expect(packed.files).toHaveLength(1);
  const full = completeL0Tiles([]);
  expect(full).toHaveLength(64); expect(full.every(row => row.files.length === 0 && row.decoded + row.gpu + row.compressed === 0)).toBe(true);
});

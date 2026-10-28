import { expect, test } from 'vitest';
import { nearestEntryReads, parseEntryReadSet } from './entryReads';

const read = { url: 'blobs/body.bin', hash: 'a'.repeat(64), bytes: 17 };
const row = { region: 'west', tier: 'phone', at: [-250, 0], reads: [read] };

test('entry metadata keeps exact first-demand order and picks only the closest tier entry', () => {
  const west = { ...row, tier: 'phone' }, east = { ...row, region: 'east', at: [250, 0] };
  const rows = parseEntryReadSet([west, east, { ...west, tier: 'desktop' }]);
  expect(nearestEntryReads(rows, 'phone', { x: -100, z: 10 })).toBe(rows[0]);
  expect(nearestEntryReads(rows, 'phone', { x: 100, z: 10 })).toBe(rows[1]);
  expect(nearestEntryReads(rows, 'phone', { x: 0, z: 0 })).toBe(rows[0]);
  expect(nearestEntryReads(rows, 'desktop', { x: 200, z: 0 })).toBe(rows[2]);
  expect(nearestEntryReads([], 'phone', { x: 0, z: 0 })).toBeUndefined();
  expect(() => nearestEntryReads(rows, 'phone', { x: Number.NaN, z: 0 })).toThrow('Finite');
});

test('entry metadata refuses aliases, origins, duplicate reads and malformed byte identities', () => {
  for (const url of ['../body.bin', '/assets/a/../body.bin', 'blobs//body.bin', '/assets/x?cache=1', 'https://host/body.bin', 'blobs/%2fbody.bin', '/other/file']) {
    expect(() => parseEntryReadSet([{ ...row, reads: [{ ...read, url }] }])).toThrow();
  }
  for (const change of [{ bytes: -1 }, { bytes: .5 }, { bytes: 256000001 }, { hash: 'a'.repeat(63) }]) {
    expect(() => parseEntryReadSet([{ ...row, reads: [{ ...read, ...change }] }])).toThrow();
  }
  expect(() => parseEntryReadSet([row, row])).toThrow('unique');
  expect(() => parseEntryReadSet([{ ...row, reads: [read, read] }])).toThrow('unique');
  expect(() => parseEntryReadSet([{ ...row, at: [-251, 0] }])).toThrow();
});

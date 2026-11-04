import { expect, test } from 'vitest';
import { fenceReadHashes, fenceReadIdentities, readFenceReads } from './fenceReads';

// DL22: Pine's cold boot read 143 files before control that its spawn set lacked (late models by name, props tiles by
// tile); the recorded list keeps stable identities so a content edit (new hashes) still maps to the right files.
const h = (seed: string): string => seed.repeat(64).slice(0, 64);
const sections = (tileFile: string, extra: string): Map<string, unknown> => new Map([['world/props', { props: { tiles: [
  { lod: 0, x: 3, z: 5, file: tileFile, additionalFiles: [extra] }, { lod: 1, x: 1, z: 2, file: h('9') },
] } }]]);

test('identities: props tile files by tile and slot, named files by name; unnamed others are absent', () => {
  const files = [{ hash: h('a'), name: 'models/creatures/bear.glb' }, { hash: h('b') }, { hash: h('c') }, { hash: h('d') }];
  const ids = fenceReadIdentities(files, sections(h('c'), h('d')));
  expect(ids.get(h('a'))).toBe('name:models/creatures/bear.glb');
  expect(ids.get(h('c'))).toBe('props-tile:0/3/5:file'); expect(ids.get(h('d'))).toBe('props-tile:0/3/5:0');
  expect(ids.get(h('9'))).toBe('props-tile:1/1/2:file'); expect(ids.has(h('b'))).toBe(false);
});

test('a recorded list maps to the current product\'s hashes after an edit renames the content', () => {
  const reads = readFenceReads({ version: 1, files: ['props-tile:0/3/5:file', 'name:models/creatures/bear.glb', 'name:models/gone.glb'] });
  // The edit rewrote the bear and the tile: new hashes, same identities; a removed model is skipped.
  const after = fenceReadHashes(reads, [{ hash: h('e'), name: 'models/creatures/bear.glb' }, { hash: h('f') }], sections(h('f'), h('0')));
  expect([...after].sort()).toEqual([h('e'), h('f')].sort());
});

test('the committed list is checked and normalised', () => {
  expect(readFenceReads({ version: 1, files: ['name:b', 'name:a', 'name:a'] }).files).toEqual(['name:a', 'name:b']);
  expect(() => readFenceReads({ version: 1, files: ['blobs/glb/x.glb'] })).toThrow('Invalid fence reads');
  expect(() => readFenceReads({ version: 2, files: [] })).toThrow('Invalid fence reads');
});

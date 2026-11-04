import { expect, test } from 'vitest';
import { assetIdentities, assetStem, fenceReadAliases, fenceReadIdentities, fenceReadIdentity, packPartIdentities, readFenceReads, resolveFenceReads } from './fenceReads';

// DL22: Pine's cold boot read 143 files before control that its spawn set lacked (late models by name, props tiles by
// tile); the recorded list keeps stable identities so a content edit (new hashes) still maps to the right files.
const h = (seed: string): string => seed.repeat(64).slice(0, 64);
const sections = (tileFile: string, extra: string): Map<string, unknown> => new Map([['world/props', { props: { tiles: [
  { lod: 0, x: 3, z: 5, file: tileFile, additionalFiles: [extra] }, { lod: 1, x: 1, z: 2, file: h('9') },
] } }]]);

test('identities: props tile files by tile and slot, named files by name; unnamed others are absent', () => {
  const files = [{ hash: h('a'), name: 'models/creatures/bear.glb' }, { hash: h('b') }, { hash: h('c') }, { hash: h('d') }];
  const ids = fenceReadIdentities(files, sections(h('c'), h('d'))), first = (hash: string) => fenceReadIdentity(ids, hash);
  expect(first(h('a'))).toBe('name:models/creatures/bear.glb');
  expect(first(h('c'))).toBe('props-tile:0/3/5:file'); expect(first(h('d'))).toBe('props-tile:0/3/5:0');
  expect(first(h('9'))).toBe('props-tile:1/1/2:file'); expect(ids.has(h('b'))).toBe(false);
});

test('a recorded list maps to the current product\'s hashes after an edit renames the content', () => {
  const reads = readFenceReads({ version: 1, files: ['props-tile:0/3/5:file', 'name:models/creatures/bear.glb', 'name:models/gone.glb'] });
  // The edit rewrote the bear and the tile: new hashes, same identities; a removed model is reported.
  const after = resolveFenceReads(reads, [{ hash: h('e'), name: 'models/creatures/bear.glb' }, { hash: h('f') }], sections(h('f'), h('0')));
  expect([...after.hashes].sort()).toEqual([h('e'), h('f')].sort());
  // The removed model is reported, so the build refuses the stale list instead of skipping it (sp-x8's review).
  expect(after.unresolved).toEqual(['name:models/gone.glb']);
});

test('the committed list is checked and normalised', () => {
  expect(readFenceReads({ version: 1, files: ['name:b', 'name:a', 'name:a'] }).files).toEqual(['name:a', 'name:b']);
  expect(() => readFenceReads({ version: 1, files: ['blobs/glb/x.glb'] })).toThrow('Invalid fence reads');
  expect(() => readFenceReads({ version: 2, files: [] })).toThrow('Invalid fence reads');
});

test('a hashed name is recorded by its section reference, and two rows sharing a file both resolve (sp-x8\'s review)', () => {
  // The painted atlas's name carries its content hash; a section names it, so the recording keeps the section path.
  const atlas = { hash: h('1'), name: `models/painted/atlas-${h('1')}.ktx2` };
  const looks = new Map<string, unknown>([['look/materials', { painted: { atlas: atlas.name, alias: atlas.name } }]]);
  const ids = fenceReadIdentities([atlas], looks);
  expect(fenceReadIdentity(ids, h('1'))).toBe('ref:look/materials:/painted/atlas');
  // After an edit the atlas has new bytes and a new name; the section path still finds it, and so does its alias.
  const edited = { hash: h('2'), name: `models/painted/atlas-${h('2')}.ktx2` };
  const now = new Map<string, unknown>([['look/materials', { painted: { atlas: edited.name, alias: edited.name } }]]);
  const resolved = resolveFenceReads(readFenceReads({ version: 1, files: ['ref:look/materials:/painted/atlas', 'ref:look/materials:/painted/alias'] }), [edited], now);
  expect([...resolved.hashes]).toEqual([h('2')]); expect(resolved.unresolved).toEqual([]);
});

test('a section key with a dot and a nested path never share a ref identity (sp-x8\'s review)', () => {
  const ids = fenceReadIdentities([{ hash: h('3') }, { hash: h('4') }], new Map<string, unknown>([['look/materials', { 'a.b': h('3'), a: { b: h('4') }, 'c/d': h('3') }]]));
  expect(ids.get(h('3'))).toEqual(['ref:look/materials:/a.b', 'ref:look/materials:/c~1d']);
  expect(ids.get(h('4'))).toEqual(['ref:look/materials:/a/b']);
});

test('every alias of a shared file is recorded, so a later split leaves a stale entry the build refuses', () => {
  const shared = [{ hash: h('5'), name: 'models/a.glb' }, { hash: h('5'), name: 'models/b.glb' }];
  const recorded = fenceReadAliases(fenceReadIdentities(shared, new Map()), h('5'));
  expect([...recorded].sort()).toEqual(['name:models/a.glb', 'name:models/b.glb']);
  // b gets its own bytes: both names still resolve, to their own files, and nothing is silently dropped.
  const split = resolveFenceReads({ version: 1, files: recorded }, [{ hash: h('5'), name: 'models/a.glb' }, { hash: h('6'), name: 'models/b.glb' }], new Map());
  expect([...split.hashes].sort()).toEqual([h('5'), h('6')].sort()); expect(split.unresolved).toEqual([]);
});

test('/assets identities: stems without content hashes, pack parts by pack and part, and colliding stems refused', () => {
  expect(assetStem('/assets/gpu/x/rifle.phone-fd73a325.glb')).toBe('/assets/gpu/x/rifle.phone.glb');
  expect(assetStem('/assets/sfx/best/bed-forest-2-0cd11be5.m4a')).toBe('/assets/sfx/best/bed-forest-2.m4a');
  expect(assetStem('/assets/baked/p/navmesh.bin?v=93aaa10d')).toBe('/assets/baked/p/navmesh.bin');
  const parts = packPartIdentities({ 'pine-hollow': { phone: { parts: [{ url: '/assets/packs/pine.phone-11111111.bin' }, { url: '/assets/packs/pine.phone-22222222.bin' }] } } });
  const ids = assetIdentities(['/assets/packs/pine.phone-11111111.bin', '/assets/packs/pine.phone-22222222.bin', '/assets/sfx/a-0cd11be5.m4a',
    '/assets/x/b-aaaaaaaa.png', '/assets/x/b-bbbbbbbb.png'], parts);
  expect(ids.get('/assets/packs/pine.phone-22222222.bin')).toBe('asset-pack:pine-hollow:phone:1');
  expect(ids.get('/assets/sfx/a-0cd11be5.m4a')).toBe('asset:/assets/sfx/a.m4a');
  expect(ids.has('/assets/x/b-aaaaaaaa.png')).toBe(false); // two files share the stem: no stable identity
  expect(readFenceReads({ version: 1, files: ['asset:/assets/sfx/a.m4a', 'asset-pack:pine-hollow:phone:1'] }).files).toHaveLength(2);
});

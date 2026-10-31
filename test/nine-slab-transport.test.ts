import { expect, test } from 'vitest';
import { parseWorldScenes } from '../src/format/worldScenes';
import { nineSlabProps, nineSlabTransport, nineSlabSourceFiles } from '../src/shards/nine-dragon-stack/generators/refinementAdmission';

const fine = 'a'.repeat(64), shared = 'b'.repeat(64), baked = 'c'.repeat(64);
const libraries = parseWorldScenes({ version: 1, materials: [], steps: [], libraries: [
  { id: 'fine', kind: 'whole', load: 'refine', models: [{ id: 'fabric', part: 'fabric', files: [fine, shared] }] },
  { id: 'ordinary', kind: 'whole', models: [{ id: 'shared', part: 'shared', files: [shared] }] },
  { id: 'slabs', kind: 'slabs', of: 'fine', keys: [{ id: 'key', node: 'anchor', material: 'paint', sources: ['fabric'], castShadow: false,
    receiveShadow: true, renderOrder: 0, layers: 1, frustumCulled: false, visible: true }],
    tiles: [{ tile: 0, files: [{ file: baked, chunks: [{ key: 'key', bytes: 36, geometricError: 0,
      box: [0, 0, 0, 1, 1, 1], sphere: [0, 0, 0, 1] }] }] }] },
] }).libraries;
const files = [{ hash: fine, compressed: 10, decoded: 20, gpu: 30, triangles: 1, draws: 1 },
  { hash: shared, compressed: 40, decoded: 50, gpu: 60, triangles: 2, draws: 3 }];
const tile = { lod: 0, x: 0, z: 0, bounds: { min: [-250, -10, -250], max: [-187.5, 20, -187.5] }, geometricError: 0,
  files: [fine, shared], compressed: 50, decoded: 70, gpu: 90, triangles: 3, draws: 4 };

test('only slab-covered exclusive L0 bodies leave transport; source metadata and bounds remain exact', () => {
  const input = [tile, { ...tile, x: 1, files: [fine], compressed: 10, decoded: 20, gpu: 30, triangles: 1, draws: 1 }, { ...tile, lod: 1 }];
  const before = structuredClone({ input, libraries, files }), selected = nineSlabTransport(input, files, libraries);
  expect(selected[0]).toEqual({ ...tile, files: [shared], compressed: 40, decoded: 50, gpu: 60, triangles: 2, draws: 3 });
  expect(selected[1]).toEqual({ ...input[1], files: [], compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 });
  expect(selected[2]).toEqual(input[2]); expect({ input, libraries, files }).toEqual(before);
});

test('uncovered fine sources keep their original transport and missing source authority refuses', () => {
  const noSlabs = libraries.filter(row => row.kind !== 'slabs');
  expect(nineSlabTransport([tile], files, noSlabs)).toEqual([tile]);
  expect(() => nineSlabTransport([tile], [], libraries)).toThrow('Missing fine source metadata');
  expect(() => nineSlabTransport([{ ...tile, files: [fine, 'd'.repeat(64)] }], files, libraries)).toThrow('Missing tile source metadata');
  expect(() => nineSlabTransport([{ ...tile, geometricError: -1 }], files, libraries)).toThrow();
  const incomplete = structuredClone(libraries), source = incomplete.find(row => row.kind === 'whole' && row.load === 'refine');
  if (source?.kind !== 'whole') throw new Error('Missing fine source');
  source.models.push({ id: 'omitted', part: 'omitted', files: [fine] });
  expect(() => nineSlabTransport([tile], files, incomplete)).toThrow('Slabs omit a fine source model');
});

test('props bindings follow remaining tile files while coarse, cold and texture owners remain unchanged', () => {
  const props = { version: 1, family: 'original', tiles: [{ lod: 0, x: 0, z: 0, file: fine, additionalFiles: [shared] },
    { lod: 0, x: 1, z: 0, file: fine }, { lod: 1, x: 0, z: 0, file: shared }], panels: [], models: [], far: null,
    textures: [{ model: fine, colour: 'd'.repeat(64) }, { model: shared, colour: 'e'.repeat(64) }], colliders: [] };
  const before = structuredClone(props), selected = nineSlabProps(props, libraries);
  expect(selected).toEqual({ ...props, tiles: [{ lod: 0, x: 0, z: 0, file: shared }, { lod: 1, x: 0, z: 0, file: shared }], textures: props.textures.slice(1) });
  expect(props).toEqual(before);
  const cold = nineSlabProps({ ...props, models: [{ id: 'cold', file: fine }] }, libraries);
  expect(cold?.textures).toEqual(props.textures); expect(cold?.models).toEqual([{ id: 'cold', file: fine }]);
  expect(nineSlabProps(null, libraries)).toBeNull();
});


test('identity-only fine rows require the independent original source and retain real cold consumers', () => {
  const original = libraries.find(row => row.kind === 'whole' && row.load === 'refine');
  if (original?.kind !== 'whole' || 'storage' in original) throw new Error('Missing original fine fixture');
  const identities: typeof libraries = [];
  for (const row of libraries) {
    if (row.id === original.id) identities.push({ id: original.id, kind: 'whole', load: 'refine', storage: 'slabs', models: original.models.map(model => ({ id: model.id })) });
    else if (row.kind === 'slabs') {
      const banks: typeof row.tiles = [];
      for (const bank of row.tiles) banks.push({ ...bank, covers: [bank.tile] });
      identities.push({ ...row, tiles: banks });
    } else identities.push(row);
  }
  const rows = parseWorldScenes({ version: 1, libraries: identities, materials: [], steps: [] }).libraries;
  expect(() => nineSlabSourceFiles(rows)).toThrow('Missing original fine source authority');
  expect(nineSlabSourceFiles(rows, original)).toEqual(new Set([fine]));
  const cold = parseWorldScenes({ version: 1, libraries: [...identities,
    { id: 'cold', kind: 'whole', load: 'explorer', models: [{ id: 'original', part: 'original', files: [fine] }] }], materials: [], steps: [] }).libraries;
  expect(nineSlabSourceFiles(cold, original)).toEqual(new Set());
  const owned = parseWorldScenes({ version: 1, libraries: [...identities,
    { id: 'owned', kind: 'owned', models: [{ id: 'phone-copy', file: { phone: fine, desktop: shared } }] }], materials: [], steps: [] }).libraries;
  expect(nineSlabSourceFiles(owned, original)).toEqual(new Set());
});

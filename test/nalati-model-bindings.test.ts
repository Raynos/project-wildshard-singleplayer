import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SpecimenAssetSchema } from '../src/format/specimenCatalogue';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiPaintedAtlasFile, nalatiPaintedGeometryFile, nalatiPaintedBindings, nalatiPaintedModelNames, nalatiLatePaintedNames, nalatiLateCatalogueNames, nalatiDeferredCatalogueScene } from '../src/shards/nalati-grasslands/generators/modelBindings';

const prefix = '/assets/nalati/baked/painted-models/';
const material = { id: 'rock', family: 'painterly', rim: .3, bands: .8, floor: .2 } as const;

test('live phone annotation preserves every existing scene and catalogue field',()=>{
  const book={rows:[{key:'specimen',source:{file:'model.bin'}}],packed:{bin:{file:'bank.bin',bytes:7}}};
  const scene={name:'owned',geometry:{shape:{file:'world.bin'}},catalogues:[book],statics:[{name:'camp',pose:[1,2,3]}]},before=structuredClone(scene);
  expect(nalatiDeferredCatalogueScene(scene)).toEqual({...scene,catalogues:[{...book,load:'after-control'}]});
  expect(scene).toStrictEqual(before);
  const encounter={rows:[{model:{id:'encounter'},source:{file:'contact.bin'}}]};
  expect(nalatiDeferredCatalogueScene({...scene,catalogues:[book,encounter],sites:[{model:'encounter'}]}))
    .toEqual({...scene,catalogues:[{...book,load:'after-control'},encounter],sites:[{model:'encounter'}]});
  expect(()=>nalatiDeferredCatalogueScene({})).toThrow('Missing scene');
  expect(()=>nalatiDeferredCatalogueScene({catalogues:[null]})).toThrow('Invalid scene');
});

test('only exclusive after-control catalogue sources enter the late inventory',()=>{
  const input={catalogues:[{load:'after-control',rows:[{file:'only.bin'},{file:'shared.bin'},{file:'eager.bin'}]},
    {rows:[{file:'eager.bin'}]}],geometry:{shape:{file:'shared.bin'}},labels:['ignored.bin']};
  const before=structuredClone(input);
  expect(nalatiLateCatalogueNames(input)).toEqual(['only.bin']);expect(input).toStrictEqual(before);
  expect(nalatiLateCatalogueNames({catalogues:[{rows:[{file:'default.bin'}]}]})).toEqual([]);
  expect(nalatiLateCatalogueNames(null)).toEqual([]);
});

test('only unselected painted alternatives enter the late transport seam', () => {
  const file = (name: string) => ({ file: `models/painted/${name}`, bytes: 7 });
  const asset = { url: file('large.glb'), phoneUrl: file('small.glb'), atlas: file('large.ktx2'), phoneAtlas: file('small.ktx2') };
  const books = [asset, { again: asset }, { url: file('unchanged.glb') }], before = structuredClone(books);
  expect(nalatiLatePaintedNames(books)).toEqual(['models/painted/large.glb', 'models/painted/large.ktx2']);
  expect(books).toStrictEqual(before);
  expect(nalatiLatePaintedNames([asset, { shared: file('large.glb') }])).toEqual(['models/painted/large.ktx2']);
  expect(nalatiLatePaintedNames([asset, { url: file('large.glb'), atlas: file('large.ktx2') }])).toEqual([]);
  expect(nalatiLatePaintedNames({ url: file('same.glb'), phoneUrl: file('same.glb') })).toEqual([]);
  expect(nalatiLatePaintedNames({ url: file('needed.glb') })).toEqual([]);
  expect(nalatiLatePaintedNames({ url: { file: 'other/full.glb' }, phoneUrl: file('small.glb') })).toEqual([]);
});
const asset = { url: `${prefix}boulder-1.glb`, phoneUrl: `${prefix}boulder-1.phone.glb`, material, geometrySlot: 0, materialSlot: 0, retainedAttribute: '_paint_clone' };
const files = new Map([['boulder-1.glb', new Uint8Array(128)], ['boulder-1.phone.glb', new Uint8Array(64)], ['boulder-1.ktx2', new Uint8Array(180)], ['boulder-1.phone.ktx2', new Uint8Array(100)]]);

test('complete scenes select only declared model files and preserve every field outside asset locations and sampler declarations', () => {
  const before = { assets: { rock: asset }, repeated: [asset, { url: { file: 'models/painted/horse-wild.far.glb', bytes: 19940 }, material }],
    params: { scale: -0, appearance: 'same' }, placement: [1, 2, 3], field: { file: 'world/places.bin' } };
  expect(nalatiPaintedModelNames(before)).toEqual(['boulder-1.glb', 'boulder-1.phone.glb', 'horse-wild.far.glb']);
  const sampler = { wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729, anisotropy: 4, colourSpace: 'srgb' };
  const expected = { ...asset, url: { file: `models/painted/geometry-${hashImmutableBytes(new Uint8Array(128))}.glb`, bytes: 128 }, phoneUrl: { file: `models/painted/geometry-${hashImmutableBytes(new Uint8Array(64))}.glb`, bytes: 64 },
    atlas: { file: `models/painted/atlas-${hashImmutableBytes(new Uint8Array(180))}.ktx2`, bytes: 180, ...sampler }, phoneAtlas: { file: `models/painted/atlas-${hashImmutableBytes(new Uint8Array(100))}.ktx2`, bytes: 100, ...sampler } };
  const original = structuredClone(before);
  expect(nalatiPaintedBindings(before, files)).toStrictEqual({ ...before, assets: { rock: expected }, repeated: [expected, before.repeated[1]] });
  expect(before).toStrictEqual(original); expect(Object.is(before.params.scale, -0)).toBe(true);
  expect(v.parse(SpecimenAssetSchema, nalatiPaintedBindings(asset, files))).toStrictEqual(expected);
});

test('identical atlas payloads share one content-owned logical name', () => {
  const first = Uint8Array.from([1, 2, 3]), second = first.slice();
  expect(nalatiPaintedAtlasFile(first)).toBe(nalatiPaintedAtlasFile(second));
  second[0] = 4;
  expect(nalatiPaintedAtlasFile(first)).not.toBe(nalatiPaintedAtlasFile(second));
});

test('identical tier geometry shares one logical file while original far-model names remain stable', () => {
  const bytes = Uint8Array.from([1, 2, 3]);
  expect(nalatiPaintedGeometryFile('boulder-1.glb', bytes)).toBe(nalatiPaintedGeometryFile('boulder-1.phone.glb', bytes.slice()));
  expect(nalatiPaintedGeometryFile('horse-wild.far.glb', bytes)).toBe('models/painted/horse-wild.far.glb');
});

test('unknown, missing or conflicting model parts refuse without a legacy URL fallback', () => {
  expect(() => nalatiPaintedModelNames({ url: `${prefix}foreign.glb` })).toThrow('Unknown');
  expect(() => nalatiPaintedModelNames({ file: 'models/painted/foreign.glb' })).toThrow('Unknown');
  expect(() => nalatiPaintedBindings(asset, new Map())).toThrow('geometry');
  expect(() => nalatiPaintedBindings(asset, new Map([['boulder-1.glb', new Uint8Array(128)]]))).toThrow('atlas');
  expect(() => nalatiPaintedBindings({ ...asset, atlas: {} }, files)).toThrow('already declares');
  expect(nalatiPaintedBindings({ url: '/assets/other/source.glb', material }, new Map())).toEqual({ url: '/assets/other/source.glb', material });
  const far = { url: `${prefix}horse-wild.far.glb`, material };
  expect(nalatiPaintedBindings(far, new Map([['horse-wild.far.glb', new Uint8Array(19940)]]))).toStrictEqual({ url: { file: 'models/painted/horse-wild.far.glb', bytes: 19940 }, material });
});

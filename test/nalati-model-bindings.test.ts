import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SpecimenAssetSchema } from '../src/format/specimenCatalogue';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nalatiPaintedAtlasFile, nalatiPaintedGeometryFile, nalatiPaintedBindings, nalatiPaintedModelNames } from '../src/shards/nalati-grasslands/generators/modelBindings';

const prefix = '/assets/nalati/baked/painted-models/';
const material = { id: 'rock', family: 'painterly', rim: .3, bands: .8, floor: .2 } as const;
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

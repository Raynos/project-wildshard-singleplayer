import { expect,test } from 'vitest';
import { zlibSync,unzlibSync } from 'fflate';
import { readScalarChannel,readScalarLattice } from '../src/engine/world/scalarChannel';
import { ScalarChannelSchema } from '../src/format/scalarChannel';
import { ForestRowsSchema } from '../src/format/terrain';
import { declaredForestQueries } from '../src/game/shard/manifest';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import geography from '../src/shards/nalati-grasslands/boot/geography.generated.json' with { type: 'json' };
import { forestMask,groundColor,surfaceAt,NALATI_MINIMAP,GROUND } from '../src/shards/nalati-grasslands/world/geography';

const TERRAIN = GROUND.terrain,wetMask = readScalarLattice(geography.channels.wet);

function encode(values: Float32Array | Float64Array): string {
  return btoa(String.fromCodePoint(...zlibSync(new Uint8Array(values.buffer,values.byteOffset,values.byteLength))));
}
test('both numeric widths retain every bit, signed zero and independent storage without conversion or a cache', () => {
  for (const values of [new Float32Array([0,-0,Math.PI,Number.MIN_VALUE,-123.5]),new Float64Array([0,-0,Math.PI,Number.MIN_VALUE,-123.5])]) {
    const row = { type: values instanceof Float32Array ? 'f32' as const : 'f64' as const,count: values.length,data: encode(values) };
    const first = readScalarChannel(row), second = readScalarChannel(row);
    expect(first.constructor).toBe(values.constructor);expect(new Uint8Array(first.buffer,first.byteOffset,first.byteLength)).toEqual(new Uint8Array(values.buffer));
    for (const [i,value] of values.entries()) expect(Object.is(first[i],value)).toBe(true);
    first[0] = 17;expect(second[0]).toBe(0);
  }
});

test('length, overflow, non-finite, JSON accessors and undeclared fields refuse before decoding a usable channel', () => {
  const valid = { type: 'f64' as const,count: 1,data: encode(new Float64Array([Math.PI])) };
  for (const row of [{ ...valid,count: 2 },{ ...valid,count: 0 },{ ...valid,count: -1 },{ ...valid,count: 1.5 },{ ...valid,count: 4194305 },{ ...valid,type: 'f16' },{ ...valid,data: 'bad!' },{ ...valid,extra: true },{ ...valid,data: encode(new Float64Array([Infinity])) },{ ...valid,data: encode(new Float64Array([Number.NaN])) },{ ...valid,data: encode(new Float64Array([1,2,3])) }]) expect(() => readScalarChannel(row)).toThrow();
  let calls = 0;const accessor = { type: 'f64',count: 1,get data() { calls++;return valid.data; } };
  expect(() => readScalarChannel(accessor)).toThrow();expect(calls).toBe(0);
});

test('packed and legacy forest candidates keep exact lookup, duplicate-coordinate source order and f64 precision', () => {
  const forest = [{ x: -0,z: 0,density: Math.PI,scale: 1,species: { tree: 1 } },{ x: 0,z: 0,density: Number.MIN_VALUE,scale: 2,species: { tree: .5 } }];
  const packed = { forest: forest.map(({ density: _density,...row }) => row),density: { type: 'f64' as const,count: 2,data: encode(new Float64Array(forest.map(row => row.density))) } };
  const legacy = declaredForestQueries({ forest }), actual = declaredForestQueries(packed);
  expect(actual.density(0,0)).toBe(Number.MIN_VALUE);expect(actual.density(-0,0)).toBe(legacy.density(-0,0));
  expect(actual.scale(0,0)).toBe(legacy.scale(0,0));expect(actual.species(0,0)).toEqual(legacy.species(0,0));
  expect(() => actual.density(.1,0)).toThrow('candidate');
  expect(() => declaredForestQueries({ forest,density: packed.density })).toThrow();
  expect(() => declaredForestQueries({ ...packed,density: { ...packed.density,count: 1 } })).toThrow();
  expect(() => declaredForestQueries({ ...packed,density: { ...packed.density,type: 'f32' } })).toThrow();
});

test('actual Nalati channels and every existing sampler retain exact boundary, signed-zero, pigment and minimap answers', () => {
  const old = (data: string) => {
    const bytes = unzlibSync(Uint8Array.from(atob(data),value => value.codePointAt(0) ?? 0));
    return bakedSamplers({ res: geography.res,size: geography.size,seed: geography.seed,landscapeHash: 0,heights: new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),splat: new Uint8Array(0),undergrowth: null }).heightAt;
  };
  const channels = { ...geography.channels,red: geography.pigment[0],green: geography.pigment[1],blue: geography.pigment[2],gravel: geography.surface[0],rock: geography.surface[1],ice: geography.surface[2] };
  const samplers = Object.fromEntries(Object.entries(channels).map(([name,data]) => [name,old(data.values.data)]));
  for (const x of [-251,-250,-0,0,1,249.999,250,251]) for (const z of [-251,-250,-0,0,1,249.999,250,251]) {
    expect(Object.is(wetMask(x,z),samplers['wet']?.(x,z))).toBe(true);expect(Object.is(forestMask(x,z),samplers['forest']?.(x,z))).toBe(true);
    const out: [number,number,number] = [0,0,0];
    groundColor(x,z,0,0,TERRAIN,out);expect(out).toEqual(['red','green','blue'].map(name => samplers[name]?.(x,z)));
    expect(surfaceAt(x,z,0,0)).toEqual(['gravel','rock','ice'].map(name => samplers[name]?.(x,z)));
    NALATI_MINIMAP.ground(x,z,0,0,0,out);expect(out).toEqual(['mapRed','mapGreen','mapBlue'].map(name => samplers[name]?.(x,z)));
  }
  for (const name of ['red','green','blue'] as const) expect(readScalarChannel(channels[name].values)).toBeInstanceOf(Float32Array);
});

test('the defining scalar and forest schemas emit through their retained wire roots', () => {
  expect(formatJsonSchema(ScalarChannelSchema)).toBeDefined();expect(formatJsonSchema(ForestRowsSchema)).toBeDefined();
});

import { pineDensityBlob } from '../src/shards/pine-hollow/generators/forestRows';
import { pineGeographyRows } from '../src/shards/pine-hollow/generators/geographyRows';
import { forestDensity as pineForestDensity } from '../src/shards/pine-hollow/generators/forestGeography';
import pineManifest from '../src/shards/pine-hollow/manifest.json' with { type: 'json' };
import {scalarBlockBytes,readNalatiScalarBlocks} from './fixtures/nalati-scalar-blocks';
// oxlint-disable-next-line import/no-nodejs-modules -- validate numeric geography fixtures without inferring the full generated JSON type
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect,test } from 'vitest';
import { zlibSync,unzlibSync } from 'fflate';
import { readScalarChannel,readScalarLattice,ScalarLatticeBindings } from '../src/engine/world/scalarChannel';
import { ScalarChannelSchema, ScalarLatticeSchema, ScalarTripletSchema } from '../src/format/scalarChannel';
import { ForestRowsSchema } from '../src/format/terrain';
import { declaredForestQueries } from '../src/game/shard/manifest';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { forestMask,groundColor,surfaceAt,NALATI_MINIMAP,GROUND } from './fixtures/nalati-terrain';

const scalarBlocks=readNalatiScalarBlocks();
const finite=v.pipe(v.number(),v.finite());
const channelsSchema=v.object({wet:ScalarLatticeSchema,forest:ScalarLatticeSchema,mapRed:ScalarLatticeSchema,mapGreen:ScalarLatticeSchema,mapBlue:ScalarLatticeSchema});
const geography=v.parse(v.object({res:finite,size:finite,seed:finite,pigment:ScalarTripletSchema,surface:ScalarTripletSchema,channels:channelsSchema}),
  JSON.parse(readFileSync('test/fixtures/nalati-geography-original.json','utf8')));

const TERRAIN = GROUND.terrain,wetMask = readScalarLattice(geography.channels.wet,scalarBlocks);

const files=new Map<string,Uint8Array>();
function encode(values: Float32Array | Float64Array): {file:string} {
  const file=`test/scalar-${files.size}.bin`;
  files.set(file,zlibSync(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)));
  return {file};
}
test('both numeric widths retain every bit, signed zero and independent storage without conversion or a cache', () => {
  for (const values of [new Float32Array([0,-0,Math.PI,Number.MIN_VALUE,-123.5]),new Float64Array([0,-0,Math.PI,Number.MIN_VALUE,-123.5])]) {
    const row = { type: values instanceof Float32Array ? 'f32' as const : 'f64' as const,count: values.length,data: encode(values) };
    const first = readScalarChannel(row,files), second = readScalarChannel(row,files);
    expect(first.constructor).toBe(values.constructor);expect(new Uint8Array(first.buffer,first.byteOffset,first.byteLength)).toEqual(new Uint8Array(values.buffer));
    for (const [i,value] of values.entries()) expect(Object.is(first[i],value)).toBe(true);
    first[0] = 17;expect(second[0]).toBe(0);
  }
});

test('length, overflow, non-finite, JSON accessors and undeclared fields refuse before decoding a usable channel', () => {
  const valid = { type: 'f64' as const,count: 1,data: encode(new Float64Array([Math.PI])) };
  for (const row of [{ ...valid,count: 2 },{ ...valid,count: 0 },{ ...valid,count: -1 },{ ...valid,count: 1.5 },{ ...valid,count: 4194305 },{ ...valid,type: 'f16' },{ ...valid,data: 'bad!' },{ ...valid,extra: true },{ ...valid,data: encode(new Float64Array([Infinity])) },{ ...valid,data: encode(new Float64Array([Number.NaN])) },{ ...valid,data: encode(new Float64Array([1,2,3])) }]) expect(() => readScalarChannel(row,files)).toThrow();
  let calls = 0;const accessor = { type: 'f64',count: 1,get data() { calls++;return valid.data; } };
  expect(() => readScalarChannel(accessor,files)).toThrow();expect(calls).toBe(0);
});

test('packed and legacy forest candidates keep exact lookup, duplicate-coordinate source order and f64 precision', () => {
  const forest = [{ x: -0,z: 0,density: Math.PI,scale: 1,species: { tree: 1 } },{ x: 0,z: 0,density: Number.MIN_VALUE,scale: 2,species: { tree: .5 } }];
  const packed = { forest: forest.map(({ density: _density,...row }) => row),density: { type: 'f64' as const,count: 2,data: encode(new Float64Array(forest.map(row => row.density))) } };
  const intake=new ScalarLatticeBindings();
  const legacy = declaredForestQueries({ forest }), actual = declaredForestQueries(packed,intake);
  expect(()=>actual.density(0,0)).toThrow('not prepared');intake.prepare(files);
  expect(actual.density(0,0)).toBe(Number.MIN_VALUE);expect(actual.density(-0,0)).toBe(legacy.density(-0,0));
  expect(actual.scale(0,0)).toBe(legacy.scale(0,0));expect(actual.species(0,0)).toEqual(legacy.species(0,0));
  expect(() => actual.density(.1,0)).toThrow('candidate');
  expect(() => declaredForestQueries({ forest,density: packed.density },new ScalarLatticeBindings())).toThrow();
  expect(() => declaredForestQueries({ ...packed,density: { ...packed.density,count: 1 } },new ScalarLatticeBindings())).toThrow();
  expect(() => declaredForestQueries({ ...packed,density: { ...packed.density,type: 'f32' } },new ScalarLatticeBindings())).toThrow();
});

test('actual Nalati channels and every existing sampler retain exact boundary, signed-zero, pigment and minimap answers', () => {
  const old = (data: string|{file:string}) => {
    const bytes = unzlibSync(scalarBlockBytes(data));
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
  for (const name of ['red','green','blue'] as const) expect(readScalarChannel(channels[name].values,scalarBlocks)).toBeInstanceOf(Float32Array);
});

test('the defining scalar and forest schemas emit through their retained wire roots', () => {
  expect(formatJsonSchema(ScalarChannelSchema)).toBeDefined();expect(formatJsonSchema(ForestRowsSchema)).toBeDefined();
});

// Pine's retired geography writer no longer publishes a loose density file.
// The same defining channel intake must accept the owned program's bytes.
test('Pine owned density prepares every declared f64 candidate without a loose output', () => {
  const row = pineGeographyRows().forestQueries, intake = new ScalarLatticeBindings();
  const forest = declaredForestQueries(row, intake), density = pineDensityBlob(pineManifest);
  expect(intake.files).toEqual([density.name]);
  expect(() => intake.prepare(new Map())).toThrow();
  const first = row.forest[0];
  if (first === undefined) throw new Error('Missing Pine forest candidates');
  expect(() => forest.density(first.x, first.z)).toThrow('not prepared');
  intake.prepare(new Map([[density.name, density.bytes]]));
  expect(intake.prepared).toBe(true);
  for (const candidate of row.forest) {
    expect(forest.density(candidate.x, candidate.z)).toBe(pineForestDensity(candidate.x, candidate.z));
  }
});

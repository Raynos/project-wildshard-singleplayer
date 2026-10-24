import { expect,test,vi } from 'vitest';
import { prepareNalatiPopulation } from './fixtures/nalati-headless';
import * as population from '../src/game/population/environment';
import * as riding from '../src/game/riding/native';
import type { SimHost } from '../src/engine/sim';
import { legacyDouble } from './fake/FakeGame';
import { unzlibSync,zlibSync } from 'fflate';
import { NativePopulationField } from '../src/game/population/environment';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original compressed f32 terrain block without a JSON type edge.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { PopulationFieldSchema } from '../src/format/populationEnvironment';
import { sha256 } from '../src/game/plugin/moduleHash';

const shipped=v.parse(PopulationFieldSchema,JSON.parse(readFileSync('src/shards/nalati-grasslands/data/populationField.generated.json','utf8')));
const pondBlock={file:'data/geography-pond.bin',bytes:Uint8Array.from(readFileSync('src/shards/nalati-grasslands/data/geography-pond.bin'))};

const raster = (values: readonly number[]): string => btoa(String.fromCodePoint(...zlibSync(new Uint8Array(Float32Array.from(values).buffer))));
const grid: BakedGrid = { res: 2,size: 32,seed: 9,landscapeHash: 0,heights: new Float32Array(4),splat: Uint8Array.from([255,0,0,0,255,0,0,0,255,0,0,0,255,0,0,0]),undergrowth: null };
const fixture = { seed: 9,world: { res: 3,size: 32,water: -10,wet: raster([0,.5,1,.49999997,.50000006,.5,1,0,.5]),pond: raster([-0,0,1,-1,0,.000001,1,-1,0]) },
  trails: [],river: { from: -16,step: 32,values: [[8,1],[8,1]] },meadow: { short: [],tall: [],bare: [],valley: .5,plateau: .6 } };

/** Independent predecessor: the population owner inflated its own native f32 view. */
function original(encoded: string | Uint8Array,terrain: BakedGrid,world: { res: number; size: number }): (x: number,z: number) => number {
  const bytes = unzlibSync(typeof encoded === 'string' ? Uint8Array.from(atob(encoded),value => value.codePointAt(0) ?? 0) : encoded);
  return bakedSamplers({ ...terrain,res: world.res,size: world.size,heights: new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4) }).heightAt;
}

test('population raster observations retain the predecessor edges and strict thresholds',() => {
  const field = new NativePopulationField(grid,fixture,[],[]),pond = original(fixture.world.pond,grid,fixture.world),wet = original(fixture.world.wet,grid,fixture.world);
  const points = [-Infinity,-40,-16,-15.999,-8,-0,0,8,15.999,16,40,Infinity,Number.NaN];
  for (const x of points) for (const z of points) {
    expect(field.queries.surfaceAt(x,z)).toBe(pond(x,z) > 0 ? fixture.world.water : null);
    expect(field.hunt.wetAt(x,z)).toBe(wet(x,z) > .5);
  }
  expect(field.hunt.wetAt(0,-16)).toBe(false);
  expect(field.hunt.wetAt(0,0)).toBe(true);
  expect(field.queries.surfaceAt(-16,-16)).toBeNull();
  expect(field.queries.surfaceAt(16,0)).toBe(-10);
});

test('shipped population rasters retain native pond and wet decisions without terrain resampling',() => {
  const terrain = { ...grid,size: shipped.world.size,seed: shipped.seed },field = new NativePopulationField(terrain,shipped,[],[],pondBlock);
  const pond = original(pondBlock.bytes,terrain,shipped.world),wet = original(shipped.world.wet,terrain,shipped.world);
  expect(pondBlock.bytes.byteLength).toBe(5476);expect(sha256(pondBlock.bytes)).toBe('57919bb109a7fbe95afce2f9f49f576d4cc3d0c16af690937cac6f7a4d892f04');
  expect(sha256(unzlibSync(pondBlock.bytes))).toBe('ca2684a28b66fa7d6d247c51e134325c52fc2027c66aa529a0d6ed89f03198aa');
  expect(shipped.world.pond).toEqual({type:'f32',count:65536,data:{file:pondBlock.file}});
  const half = shipped.world.size/2,points = [-half-1,-half,-half+1,-0,0,half-1,half,half+1,Number.NaN];
  for (let i = 0; i <= 24; i++) points.push(-half+shipped.world.size*i/24);
  for (const x of points) for (const z of points) {
    expect(field.queries.surfaceAt(x,z)).toBe(pond(x,z) > 0 ? shipped.world.water : null);
    expect(field.hunt.wetAt(x,z)).toBe(wet(x,z) > .5);
  }
});

test('population raster admission still refuses short, oversized and nonfinite channels',() => {
  for (const data of [raster([0,0,0,0]),raster(Array.from({ length: 10 },() => 0)),raster([0,0,0,0,Number.NaN,0,0,0,0])]) {
    expect(() => new NativePopulationField(grid,{ ...fixture,world: { ...fixture.world,pond: data } },[],[])).toThrow();
    expect(() => new NativePopulationField(grid,{ ...fixture,world: { ...fixture.world,wet: data } },[],[])).toThrow();
  }
});

test('raw population pond admission refuses missing, malformed and wrongly shaped blocks',()=>{
  const terrain={...grid,size:shipped.world.size,seed:shipped.seed};
  expect(()=>new NativePopulationField(terrain,shipped,[],[])).toThrow('Missing scalar block');
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,file:'other.bin'})).toThrow('Missing scalar block');
  for(const bytes of [new Uint8Array(),zlibSync(new Uint8Array(16)),zlibSync(new Uint8Array(Float32Array.from([Number.NaN]).buffer))])
    expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes})).toThrow();
  const invalid=new Float32Array(65536);invalid[7]=Number.NaN;
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes:zlibSync(new Uint8Array(invalid.buffer))})).toThrow('Non-finite scalar channel');
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes:zlibSync(new Uint8Array(262148))})).toThrow('length mismatch');
  expect(()=>new NativePopulationField(terrain,{...shipped,world:{...shipped.world,pond:{type:'f64',count:65536,data:{file:pondBlock.file}}}},[],[],pondBlock)).toThrow();
});

test('native preparation lends the original named pond to both existing owners',async()=>{
  const order: string[] = [], OriginalField = population.NativePopulationField;
  const field = vi.spyOn(population,'NativePopulationField').mockImplementation(class extends OriginalField {
    constructor(...args: ConstructorParameters<typeof OriginalField>) { order.push('field');super(...args); }
  });
  const stop = new Error('mounted owner boundary');
  const mounted = vi.spyOn(riding,'installMountedPlayer').mockImplementation(()=>{order.push('mounted');throw stop;});
  try {
    const binding = await prepareNalatiPopulation({file: name=>{order.push(name);return Promise.resolve(pondBlock.bytes);}},
      {...grid,size:shipped.world.size,seed:shipped.seed},
      {get nativeField(){order.push('rows');return shipped;}},
      {get trees(){order.push('trees');return [];},get tops(){order.push('tops');return [];}});
    const host = legacyDouble<SimHost>({}), profile = {world:shipped.world};
    expect(()=>binding.installMounted(host,profile)).toThrow(stop);
    expect(order).toEqual([pondBlock.file,'rows','trees','tops','field','mounted']);
    const loan = field.mock.calls[0]?.[4];
    expect(loan?.file).toBe(pondBlock.file);expect(loan?.bytes).toBe(pondBlock.bytes);
    expect(binding.field).toBeInstanceOf(OriginalField);
    expect(mounted.mock.calls).toHaveLength(1);
    expect(mounted.mock.calls[0]?.[0]).toBe(host);expect(mounted.mock.calls[0]?.[1]).toBe(profile);
    expect(mounted.mock.calls[0]?.[2]).toBe(loan);
  } finally { field.mockRestore();mounted.mockRestore(); }
});

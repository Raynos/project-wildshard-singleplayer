import { expect,test } from 'vitest';
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

test('native preparation lends the original named pond to both existing owners',()=>{
  const entrySchema=v.object({name:v.string(),value:v.unknown()}),plan=v.parse(v.object({prepare:v.array(entrySchema),install:v.array(entrySchema)}),
    JSON.parse(readFileSync('src/shards/nalati-grasslands/data/headlessAssembly.json','utf8')));
  const read=plan.prepare.findIndex(row=>row.name==='populationPond'),field=plan.prepare.find(row=>row.name==='populationField'),mounted=plan.install.find(row=>row.name==='mounted');
  if(field===undefined||mounted===undefined)throw new Error('Missing native owners');
  expect(plan.prepare[read]?.value).toEqual({$call:[{$ref:['product','file']},pondBlock.file]});
  expect(read).toBeLessThan(plan.prepare.indexOf(field));expect(read).toBeGreaterThanOrEqual(0);
  const loan={file:pondBlock.file,bytes:{$ref:['populationPond']}};
  expect(v.parse(v.object({$new:v.array(v.unknown())}),field.value).$new.at(-1)).toEqual(loan);
  expect(v.parse(v.object({$call:v.array(v.unknown())}),mounted.value).$call.at(-1)).toEqual(loan);
});

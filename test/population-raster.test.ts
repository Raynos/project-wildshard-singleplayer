import {nalatiWetBlock,originalNalatiWet} from './fixtures/nalati-wet';
import { expect,test,vi } from 'vitest';
import { prepareNalatiPopulation } from './fixtures/nalati-headless';
import * as population from '../src/game/population/environment';
import * as riding from '../src/game/riding/native';
import type { SimHost } from '../src/engine/sim';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { unzlibSync,zlibSync } from 'fflate';
import { NativePopulationField } from '../src/game/population/environment';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original compressed f32 terrain block without a JSON type edge.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { PopulationFieldSchema } from '../src/format/populationEnvironment';
import { sha256 } from '../src/game/plugin/moduleHash';

const shipped=v.parse(PopulationFieldSchema,JSON.parse(readFileSync('test/fixtures/nalati-population-field-original.json','utf8')));
const shippedWet=originalNalatiWet;
const pondBlock={file:'data/geography-pond.bin',bytes:Uint8Array.from(readFileSync('src/shards/nalati-grasslands/data/geography-pond.bin'))};
const wetBlock=nalatiWetBlock;

const raster = (values: readonly number[]): Uint8Array => zlibSync(new Uint8Array(Float32Array.from(values).buffer));
const fixturePond={file:'test/population-pond.bin',bytes:raster([-0,0,1,-1,0,.000001,1,-1,0])};
const fixtureWet={file:'test/population-wet.bin',bytes:raster([0,.5,1,.49999997,.50000006,.5,1,0,.5])};
const channel=(file:string):{type:'f32';count:number;data:{file:string}}=>({type:'f32',count:9,data:{file}});
const grid: BakedGrid = { res: 2,size: 32,seed: 9,landscapeHash: 0,heights: new Float32Array(4),splat: Uint8Array.from([255,0,0,0,255,0,0,0,255,0,0,0,255,0,0,0]),undergrowth: null };
const fixture = { seed: 9,world: { res: 3,size: 32,water: -10,wet: channel(fixtureWet.file),pond: channel(fixturePond.file) },
  trails: [],river: { from: -16,step: 32,values: [[8,1],[8,1]] },meadow: { short: [],tall: [],bare: [],valley: .5,plateau: .6 } };

/** Independent predecessor: the population owner inflated its own native f32 view. */
function original(encoded: string | Uint8Array,terrain: BakedGrid,world: { res: number; size: number }): (x: number,z: number) => number {
  const bytes = unzlibSync(typeof encoded === 'string' ? Uint8Array.from(atob(encoded),value => value.codePointAt(0) ?? 0) : encoded);
  return bakedSamplers({ ...terrain,res: world.res,size: world.size,heights: new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4) }).heightAt;
}

test('population raster observations retain the predecessor edges and strict thresholds',() => {
  const field = new NativePopulationField(grid,fixture,[],[],fixturePond,fixtureWet),pond = original(fixturePond.bytes,grid,fixture.world),wet = original(fixtureWet.bytes,grid,fixture.world);
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

test.each([false,true])('shipped population rasters retain native pond and wet decisions without terrain resampling (offset wet %s)',offset => {
  const terrain = { ...grid,size: shipped.world.size,seed: shipped.seed };
  const storage=new Uint8Array(wetBlock.bytes.length+8);storage.set(wetBlock.bytes,4);
  const loan=offset?{file:wetBlock.file,bytes:storage.subarray(4,-4)}:wetBlock;
  if(offset)expect(loan.bytes.byteOffset).toBe(4);
  const field = new NativePopulationField(terrain,shipped,[],[],pondBlock,loan);
  expect(wetBlock.bytes.byteLength).toBe(622);expect(sha256(wetBlock.bytes)).toBe('262d9218a0f70b8dc314063ac367944083d8e7f57543c19759193b321e2302d7');
  expect(wetBlock.bytes).toEqual(Uint8Array.from(atob(shippedWet),value=>value.codePointAt(0)??0));
  const pond = original(pondBlock.bytes,terrain,shipped.world),wet = original(shippedWet,terrain,shipped.world);
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
    expect(() => new NativePopulationField(grid,fixture,[],[],{...fixturePond,bytes:data},fixtureWet)).toThrow();
    expect(() => new NativePopulationField(grid,fixture,[],[],fixturePond,{...fixtureWet,bytes:data})).toThrow();
  }
});

test('raw population pond admission refuses missing, malformed and wrongly shaped blocks',()=>{
  const terrain={...grid,size:shipped.world.size,seed:shipped.seed};
  expect(()=>new NativePopulationField(terrain,shipped,[],[])).toThrow('Missing scalar block');
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,file:'other.bin'})).toThrow('Missing scalar block');
  for(const bytes of [new Uint8Array(),zlibSync(new Uint8Array(16)),zlibSync(new Uint8Array(Float32Array.from([Number.NaN]).buffer))])
    expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes})).toThrow();
  const invalid=new Float32Array(65536);invalid[7]=Number.NaN;
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes:zlibSync(new Uint8Array(invalid.buffer))},wetBlock)).toThrow('Non-finite scalar channel');
  expect(()=>new NativePopulationField(terrain,shipped,[],[],{...pondBlock,bytes:zlibSync(new Uint8Array(262148))},wetBlock)).toThrow('length mismatch');
  expect(()=>new NativePopulationField(terrain,{...shipped,world:{...shipped.world,pond:{type:'f64',count:65536,data:{file:pondBlock.file}}}},[],[],pondBlock)).toThrow();
});

test('native preparation lends both original named rasters to the existing owners',async()=>{
  const order: string[] = [], OriginalField = population.NativePopulationField;
  const field = vi.spyOn(population,'NativePopulationField').mockImplementation(class extends OriginalField {
    constructor(...args: ConstructorParameters<typeof OriginalField>) { order.push('field');super(...args); }
  });
  const stop = new Error('mounted owner boundary');
  const mounted = vi.spyOn(riding,'installMountedPlayer').mockImplementation(()=>{order.push('mounted');throw stop;});
  try {
    const binding = await prepareNalatiPopulation({file: name=>{order.push(name);if(name===pondBlock.file)return Promise.resolve(pondBlock.bytes);if(name===wetBlock.file)return Promise.resolve(wetBlock.bytes);throw new Error(`Unexpected scalar ${name}`);}},
      {...grid,size:shipped.world.size,seed:shipped.seed},
      {get nativeField(){order.push('rows');return shipped;}},
      {get trees(){order.push('trees');return [];},get tops(){order.push('tops');return [];}});
    const host = legacyDouble<SimHost>({}), profile = {world:shipped.world};
    expect(()=>binding.installMounted(host,profile)).toThrow(stop);
    expect(order).toEqual([pondBlock.file,'rows',wetBlock.file,'trees','tops','field','mounted']);
    const loan = field.mock.calls[0]?.[4];
    expect(loan?.file).toBe(pondBlock.file);expect(loan?.bytes).toBe(pondBlock.bytes);
    expect(binding.field).toBeInstanceOf(OriginalField);
    expect(mounted.mock.calls).toHaveLength(1);
    expect(mounted.mock.calls[0]?.[0]).toBe(host);expect(mounted.mock.calls[0]?.[1]).toBe(profile);
    expect(mounted.mock.calls[0]?.[2]).toBe(loan);
    const wetLoan=field.mock.calls[0]?.[5];expect(wetLoan?.file).toBe(wetBlock.file);expect(wetLoan?.bytes).toBe(wetBlock.bytes);
    expect(mounted.mock.calls[0]?.[3]).toBe(wetLoan);
  } finally { field.mockRestore();mounted.mockRestore(); }
});

test('named wet raster retains every native threshold and detaches the compressed loan',()=>{
  const bytes=fixtureWet.bytes.slice(),file='world/wet.bin';
  const row={...fixture,world:{...fixture.world,wet:{type:'f32',count:9,data:{file}}}};
  const field=new NativePopulationField(grid,row,[],[],fixturePond,{file,bytes});
  const oldWet=original(fixtureWet.bytes,grid,fixture.world),oldPond=original(fixturePond.bytes,grid,fixture.world);
  bytes.fill(0);
  for(const x of [-Infinity,-40,-16,-15.999,-8,-0,0,8,15.999,16,40,Infinity,Number.NaN])
    for(const z of [-Infinity,-40,-16,-15.999,-8,-0,0,8,15.999,16,40,Infinity,Number.NaN]){
      expect(field.hunt.wetAt(x,z)).toBe(oldWet(x,z)>.5);
      expect(field.queries.surfaceAt(x,z)).toBe(oldPond(x,z)>0?fixture.world.water:null);
    }
});

test('named wet rasters refuse missing, malformed, nonfinite and duplicate loans',()=>{
  const file='world/wet.bin',wet={type:'f32',count:9,data:{file}},row={...fixture,world:{...fixture.world,wet}};
  const valid=fixtureWet.bytes.slice();
  for(const block of [undefined,{file:'other.bin',bytes:valid},{file,bytes:new Uint8Array()},
    {file,bytes:zlibSync(new Uint8Array(32))},{file,bytes:zlibSync(new Uint8Array(40))},
    {file,bytes:zlibSync(new Uint8Array(Float32Array.from([0,0,0,0,Number.NaN,0,0,0,0]).buffer))}])
    expect(()=>new NativePopulationField(grid,row,[],[],fixturePond,block)).toThrow();
  expect(()=>new NativePopulationField(grid,row,[],[],{file,bytes:valid},{file,bytes:valid})).toThrow('Duplicate');
  for(const bad of [{...wet,count:8},{...wet,data:{file:'../wet.bin'}},{...wet,data:{file},type:'f64'}])
    expect(()=>new NativePopulationField(grid,{...row,world:{...row.world,wet:bad}},[],[],fixturePond,{file,bytes:valid})).toThrow();
});


/** Frozen pre-bd671 river recipe: native Math may differ across hosts.
 * Check every host result exactly before using the historical river bytes in
 * the complete metadata oracle. No rounding or tolerance enters either check.
 */
function predecessorRiver(): {from:number;step:number;values:[number,number][]} {
  return {from:-250,step:1,values:Array.from({length:501},(_,i):[number,number]=>{
    const x=i-250,s=Math.min(1,Math.max(0,(Math.abs(x)-8)/52));
    return [168+4*Math.exp(-((x/70)**2))+5*Math.sin(x*.017)+3*Math.sin(x*.041+1.3)-3*Math.sin(1.3),
      (15+3*Math.sin(x*.009+2.1)+2*Math.sin(x*.031))*(.62+.38*s*s*(3-2*s))];
  })};
}

function assertPredecessorMetadata(input:unknown):void {
  const rows=v.parse(v.record(v.string(),v.unknown()),input),world=v.parse(v.record(v.string(),v.unknown()),rows['world']);
  expect(rows['river']).toEqual(predecessorRiver());
  const frozen:unknown=JSON.parse(readFileSync('test/fixtures/nalati-headless-original.json','utf8'));
  const root=v.parse(v.record(v.string(),v.unknown()),frozen),constants=v.parse(v.record(v.string(),v.unknown()),root['constants']);
  const historical=v.parse(PopulationFieldSchema,constants['nativeField']);
  const originalRows={...rows,world:{...world,wet:shippedWet},river:historical.river};
  const bytes=new TextEncoder().encode(`${JSON.stringify(originalRows)}\n`);
  expect(bytes.byteLength).toBe(22395);
  expect(sha256(bytes)).toBe('f1dfb3e8112839ba54538171edce6f113309fb0a32d6f57848b2be28287d58d3');
}

test('shipped wet publication is named and reconstructs the complete predecessor metadata',()=>{
  expect(shipped.world.wet).toEqual({type:'f32',count:65536,data:{file:wetBlock.file}});
  const input:unknown=JSON.parse(readFileSync('test/fixtures/nalati-population-field-original.json','utf8'));
  assertPredecessorMetadata(input);
});

test('metadata provenance refuses a changed river sample or any other field',()=>{
  const input:unknown=JSON.parse(readFileSync('test/fixtures/nalati-population-field-original.json','utf8'));
  const rows=v.parse(v.record(v.string(),v.unknown()),input),river=predecessorRiver();
  const first=river.values[0];
  if(!first)throw new Error('Missing predecessor river sample');
  first[1]+=Number.EPSILON*16;
  expect(()=>assertPredecessorMetadata({...rows,river})).toThrow();
  expect(()=>assertPredecessorMetadata({...rows,seed:0})).toThrow();
});

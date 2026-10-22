import { expect,test } from 'vitest';
import { unzlibSync,zlibSync } from 'fflate';
import { NativePopulationField } from '../src/game/population/environment';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
import shipped from '../src/shards/nalati-grasslands/data/populationField.generated.json' with { type: 'json' };

const raster = (values: readonly number[]): string => btoa(String.fromCodePoint(...zlibSync(new Uint8Array(Float32Array.from(values).buffer))));
const grid: BakedGrid = { res: 2,size: 32,seed: 9,landscapeHash: 0,heights: new Float32Array(4),splat: Uint8Array.from([255,0,0,0,255,0,0,0,255,0,0,0,255,0,0,0]),undergrowth: null };
const fixture = { seed: 9,world: { res: 3,size: 32,water: -10,wet: raster([0,.5,1,.49999997,.50000006,.5,1,0,.5]),pond: raster([-0,0,1,-1,0,.000001,1,-1,0]) },
  trails: [],river: { from: -16,step: 32,values: [[8,1],[8,1]] },meadow: { short: [],tall: [],bare: [],valley: .5,plateau: .6 } };

/** Independent predecessor: the population owner inflated its own native f32 view. */
function original(encoded: string,terrain: BakedGrid,world: { res: number; size: number }): (x: number,z: number) => number {
  const bytes = unzlibSync(Uint8Array.from(atob(encoded),value => value.codePointAt(0) ?? 0));
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
  const terrain = { ...grid,size: shipped.world.size,seed: shipped.seed },field = new NativePopulationField(terrain,shipped,[],[]);
  const pond = original(shipped.world.pond,terrain,shipped.world),wet = original(shipped.world.wet,terrain,shipped.world);
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

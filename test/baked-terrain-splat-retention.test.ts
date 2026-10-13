// oxlint-disable-next-line import/no-nodejs-modules -- Enable real GC in a fresh V8 process for the immutable lattice regression.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the focused worker's Node executable.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';
import { originalBakedSamplers } from './fixtures/baked-terrain-samplers';

it.each([{ components: [255, 0, 0, 0] }, { components: [17, 31, 89, 118] }, { components: [0, 0, 0, 0] }])('keeps uniform $components bilinear and fallback reads exact', ({ components }) => {
  const grid: BakedGrid = { res: 256, size: 500, seed: 1, landscapeHash: 0, undergrowth: null,
    heights: Float32Array.from({ length: 65536 }, (_, i) => Math.sin(i) * 4),
    splat: Uint8Array.from({ length: 262144 }, (_, i) => components[i % 4] ?? 0) };
  const actual = bakedSamplers(grid), original = originalBakedSamplers(grid);
  const points: [number, number][] = [[-Infinity, Infinity], [Infinity, -Infinity], [Number.NaN, 0], [0, Number.NaN], [-250, 250]];
  for (let i = 0; i < 1000; i++) points.push([((i * 137.031) % 620) - 310, ((i * 71.917) % 620) - 310]);
  for (const [x, z] of points) {
    expect(actual.heightAt(x, z)).toBe(original.heightAt(x, z));
    expect(actual.normalAt(x, z)).toEqual(original.normalAt(x, z));
    expect(actual.splatAt(x, z)).toEqual(original.splatAt(x, z));
  }
});

it('keeps partial and varying lattice reads under the original law', () => {
  for (const splat of [new Uint8Array(7), Uint8Array.from({ length: 16 }, (_, i) => i)]) {
    const grid: BakedGrid = { res: 2, size: 500, seed: 1, landscapeHash: 0, undergrowth: null, heights: Float32Array.of(1, 2, 3, 4), splat };
    const actual = bakedSamplers(grid), original = originalBakedSamplers(grid);
    for (const x of [-Infinity, -250, -3.5, 0, 249, Infinity, Number.NaN]) for (const z of [-250, 0, 250, Number.NaN]) {
      expect(actual.splatAt(x, z)).toEqual(original.splatAt(x, z));
    }
  }
});

const gcScript = String.raw`
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers';
import {bakedSamplers} from './src/format/bakedTerrainSampling.ts';
function fixture(){
  const splat=Uint8Array.from({length:262144},(_,i)=>i%4===0?255:0);
  if(MODE==='varying')splat[4]=254;
  const grid={res:256,size:500,seed:1,landscapeHash:0,undergrowth:null,heights:new Float32Array(65536).fill(4.5),splat};
  return {samplers:bakedSamplers(grid),raw:new WeakRef(splat),grid:new WeakRef(grid)};
}
const held=fixture();
if(typeof globalThis.gc!=='function')throw new Error('Missing real GC');
for(let i=0;i<8;i++){await new Promise(resolve=>setImmediate(resolve));globalThis.gc();}
assert(held.grid.deref()===undefined,'samplers retain the complete grid context');
if(MODE==='uniform')assert(held.raw.deref()===undefined,'uniform samplers retain the full splat lattice');
else assert(held.raw.deref()!==undefined,'varying sampler lost its original lattice');
assert.equal(held.samplers.heightAt(0,0),4.5);
assert.deepEqual(held.samplers.normalAt(0,0),[0,1,0]);
assert.deepEqual(held.samplers.splatAt(0,0),[1,0,0,0]);
`;

it.each(['uniform', 'varying'])('keeps live %s queries with exactly the backing they need', mode => {
  const result = spawnSync(execPath, ['--expose-gc', '--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', `const MODE=${JSON.stringify(mode)};\n${gcScript}`],
    { encoding: 'utf8', timeout: 15_000 });
  expect(result.error).toBeUndefined(); expect(result.status, result.stderr).toBe(0);
}, 20_000);

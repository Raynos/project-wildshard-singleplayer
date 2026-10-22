// oxlint-disable-next-line import/no-nodejs-modules -- Native environment tests use the shipped physics runtime.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { installPopulationEnvironment, populationEnvironment } from '../src/game/population/environment';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import { terrainTileHeight } from '../src/format/terrainTileBytes';
import { POPULATION_ENVIRONMENT } from '../src/shards/pine-hollow/generators/populationEnvironment';
import groundRows from '../src/shards/pine-hollow/data/ground.generated.json' with { type: 'json' };
import { declaredGround } from '../src/game/shard/manifest';
import { TreeGrid } from '../src/engine/world/forest/placement';
import type { HuntTree } from '../src/engine/ai/hunt';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { Rng } from '../src/engine/core/rng';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

test('Pine habitat rows retain exact metadata, creek surfaces, normals and trunk order', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const grid = { res: 256, size: 500, heights: Float32Array.from({ length: 256*256 }, (_, i) => Math.sin(i)*8) };
  const samplers = bakedSamplers({ ...grid, seed: 1337, landscapeHash: 0, splat: new Uint8Array(0), undergrowth: null });
  const expectedTrees = new TreeGrid<HuntTree>();
  for (const [x,z,r] of POPULATION_ENVIRONMENT.trees) expectedTrees.add({ x,z,r });
  try {
    installPopulationEnvironment(host, grid, POPULATION_ENVIRONMENT);
    const ground = populationEnvironment(host, POPULATION_ENVIRONMENT.id);
    expect(populationEnvironment(host, POPULATION_ENVIRONMENT.id)).toBe(ground);
    const rng = new Rng(41), points = Array.from({ length: 2000 }, () => [rng.range(-250,250),rng.range(-250,250)] as const);
    const stream = POPULATION_ENVIRONMENT.stream;
    if (stream === null) throw new Error('Missing authored water corridor');
    // the declared creek's segments, on the centre and just inside each bank
    for (let i = 1; i < stream.points.length; i++) {
      const a = stream.points[i-1], b = stream.points[i]; if (a === undefined || b === undefined) continue;
      const vx = b.x-a.x, vz = b.z-a.z, length = Math.hypot(vx,vz), half = stream.width/2*0.9;
      for (const fraction of [0,.3,1]) for (const side of [-1,0,1]) points.push([a.x+vx*fraction-vz/length*side*half,a.z+vz*fraction+vx/length*side*half]);
    }
    const declared = declaredGround(groundRows), terrain = declared.terrain, creek = declared.water?.find(body => body.id === 'creek');
    if (creek === undefined) throw new Error('Missing Pine creek');
    for (const [x,z] of points) {
      expect(ground.heightAt(x,z)).toBe(samplers.heightAt(x,z));
      expect(ground.normalY(x,z)).toBe(samplers.normalAt(x,z)[1]);
      expect(ground.trailDistance(x,z)).toBe(terrain.trailDistance(x,z));
      expect(ground.cabinMask(x,z)).toBe(terrain.cabinMask(x,z));
      expect(ground.streamAt(x,z)).toBe(creek.restAt(x,z));
      expect(ground.trees(x,z,1)).toEqual(expectedTrees.nearby(x,z,1));
    }
  } finally { host.dispose(); }
});

test('unrelated sea habitat retains column triangle sampling and refuses foreign ids and malformed data', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const grid = { res: 3, size: 500, heights: Float32Array.from([0,7,2,8,3,9,4,11,5]) };
  const rows = { id: 'reef.habitat', seed: 17, chunkHalf: 250, normalEpsilon: .6, sampling: 'column-triangles',
    water: -2, sea: true, trails: null, cabins: [], pond: null, trees: [], stream: null };
  try {
    installPopulationEnvironment(host,grid,rows);
    const ground = populationEnvironment(host,rows.id);
    for (const x of [-300,-250,-10,0,17,250,300]) for (const z of [-250,-4,2,250]) {
      expect(ground.heightAt(x,z)).toBe(terrainTileHeight({ resolution: 3, x: -250, z: -250, size: 500, heights: grid.heights },x,z,{ layout:'column-major',boundary:'clamp' }));
    }
    expect(ground.waterLevel()).toBe(-2); expect(ground.sea()).toBe(true); expect(ground.streamAt(0,0)).toBeNull();
    expect(() => ground.trailDistance(0,0)).toThrow('no trails');
    expect(() => populationEnvironment(host,'unknown')).toThrow('Missing');
    expect(() => installPopulationEnvironment(host,grid,rows)).toThrow('Duplicate');
    expect(() => installPopulationEnvironment(host,grid,{ ...rows,id:'bad',normalEpsilon:0 })).toThrow();
    expect(() => installPopulationEnvironment(host,{ ...grid,heights:new Float32Array(2) },{ ...rows,id:'bad' })).toThrow('lattice');
    expect(() => installPopulationEnvironment(host,grid,{ ...rows,id:'bad',stream:()=>0 })).toThrow();
  } finally { host.dispose(); }
});

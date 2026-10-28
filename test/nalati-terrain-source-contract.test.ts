// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the terrain under portable math in a fresh guarded Node realm.
import { execFileSync } from 'node:child_process';
import { expect, expectTypeOf, test } from 'vitest';
import { TERRAIN } from '../src/shards/nalati-grasslands/generators/terrainRecipe';
import type { ChunkTerrain } from '../src/game/shard/manifest';
import { CHUNK_HALF } from '../src/engine/core/config';
import bounds from '../src/shards/nalati-grasslands/data/terrainBounds.json' with { type: 'json' };
import original from './fixtures/nalati-terrain-source-original.json' with { type: 'json' };
import before from './fixtures/nalati-terrain-portable-before.json' with { type: 'json' };

test('the author field retains the complete mutable native terrain port and bounds', () => {
  expectTypeOf<typeof TERRAIN>().toEqualTypeOf<ChunkTerrain>();
  expect(bounds.half).toBe(CHUNK_HALF);
  expect(TERRAIN.trails).toEqual(original.trails);
  expect(TERRAIN.cabinSites).toEqual(original.cabinSites);
  expect(TERRAIN.pond).toEqual(original.pond);
  expect(TERRAIN.datum).toBeUndefined();
});

test('all terrain samples retain predecessor portable Float64 bits across the entire cell', () => {
  // c9's raw pin was measured with ARM64 native transcendentals. Keep it as
  // the explicit before-control; initialize the independent cross-host oracle
  // before terrain construction so graded shelves use portable math too.
  expect(before.nativeBefore).toEqual({ values: original.values, bytes: original.bytes, sha256: original.sha256 });
  const source = `import {installPortableMath} from './src/commons/bake/portableMath.ts';
    const {registerPortableTerrain}=await import('./test/fixtures/portable-terrain-loader.mjs');
    registerPortableTerrain();const restore=installPortableMath();
    try {
      const terrain=await import('./src/shards/nalati-grasslands/generators/terrainRecipe.ts');
      const {observeTerrain}=await import('./test/fixtures/nalati-terrain-observation.ts');
      const observed=observeTerrain(terrain);
      console.log(JSON.stringify({values:observed.values,bytes:observed.bytes.length,sha256:observed.sha256}));
    }finally{restore();}`;
  const output = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(output)).toEqual(before.portableBefore);
  expect(before.portableBefore.values).toBe(original.values);
  expect(before.portableBefore.bytes).toBe(original.bytes);
});

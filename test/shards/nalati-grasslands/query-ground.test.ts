// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads Nalati's retained WSTR lattice to compare samples.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { LevelFrameBinding } from '../../../src/engine/level/frame';
import { WaterBodies } from '../../../src/engine/world/water/body';
import { bakedSamplers, loadBakedTerrain, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import type { TerrainField } from '../../../src/engine/level/data';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { provideRuntimeProduct } from '../../../src/game/shardfile/runtimeProduct';
import { installProductSampling } from '../../../src/game/shardfile/productGround';
import { TEMPLATE } from '../../../src/shards/_template/manifest';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { nalatiDeclaredAssets } from '../../proof/nalati-grasslands/nativeAssets';

const restores: (() => void)[] = [];
afterEach(() => { for (const restore of restores.splice(0)) restore(); vi.restoreAllMocks(); });

const analytic: TerrainField = { heightAt: () => -999, normalAt: () => [0, 1, 0], splatAt: () => [0, 0, 0, 1], trailDistance: () => 9, cabinMask: () => 0,
  pondMask: () => 0, waterLevel: () => -1, trails: [], cabinSites: [], pond: null };

// G384: Nalati's optional bake is its admitted query terrain. The session's samples reader installs the product's sampling
// file into the frame (no terrain.bin fetch), sampling exactly as the retained WSTR lattice did: heights, normals at the
// native 0.6 m and caller epsilons, and splat, at every lattice vertex and between them.
it('installs the admitted sampling file as the WSTR lattice, without a fetch', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('terrain.bin must not be fetched'));
  restores.push(installProductSampling());
  const resident = new Scope('nalati-resident');
  restores.push(() => { resident.dispose(); });
  provideRuntimeProduct({ source, assets: nalatiDeclaredAssets(source), cached: false }, resident);
  const level = { ...toLevelSpec(TEMPLATE), id: 'nalati-grasslands', seed: source.identity.seed, ground: { terrain: analytic } };
  const frame = new LevelFrameBinding({ level, scope: resident, navmesh: null, water: new WaterBodies() });
  expect(await loadBakedTerrain(frame.terrain)).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  const bin = readFileSync(new URL('../../../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));
  const grid = parseBakedTerrain(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  if (grid === null) throw new Error('Nalati terrain.bin is unreadable');
  const native = bakedSamplers(grid), field = frame.terrain.field, step = grid.size / (grid.res - 1);
  const points: [number, number][] = [];
  for (let i = 0; i < grid.res; i += 5) for (let j = 0; j < grid.res; j += 7) points.push([-250 + i * step, -250 + j * step]);
  let seed = 7;
  const random = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 4000; k++) points.push([-260 + random() * 520, -260 + random() * 520]);
  for (const [x, z] of points) {
    expect(field.heightAt(x, z)).toBe(native.heightAt(x, z));
    expect(field.normalAt(x, z)).toEqual(native.normalAt(x, z));
    expect(field.normalAt(x, z, 1)).toEqual(native.normalAt(x, z, 1));
    expect(field.splatAt(x, z)).toEqual(native.splatAt(x, z));
  }
});

it('keeps the engine fetch for a key no admitted query terrain answers', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no bake served'));
  restores.push(installProductSampling());
  const scope = new Scope('other');
  restores.push(() => { scope.dispose(); });
  const level = { ...toLevelSpec(TEMPLATE), id: 'no-product-here', seed: 3, ground: { terrain: analytic } };
  const frame = new LevelFrameBinding({ level, scope, navmesh: null, water: new WaterBodies() });
  // no product and no public bake: the analytic field stays
  expect(await loadBakedTerrain(frame.terrain)).toBe(false);
  expect(frame.terrain.field.heightAt(0, 0)).toBe(-999);
});

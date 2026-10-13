import { expect, it, vi, afterEach } from 'vitest';
import { createBakedTerrainField, bakedTerrainSource, installRequiredGroundLoader, type RequiredGround } from '../../src/engine/world/bakedTerrainField';
import { HeightfieldBinding } from '../../src/engine/world/Heightfield';
import { installBoundGround, loadBakedTerrain } from '../../src/engine/world/BakedTerrain';
import { buildTerrain } from '../../src/engine/world/terrainField';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';

afterEach(() => { vi.restoreAllMocks(); });
const metadata = buildTerrain(1, { landscape: () => 0, trails: [[[0, 0], [10, 10]]], cabinSites: [] });
/** A synthetic required ground: a tilted plane, its own normal and a fixed splat. */
const ground = (seed: number): RequiredGround => ({ seed, heightAt: (x, z) => 0.01 * x - 0.02 * z + 3, normalAt: () => [0, 1, 0], splatAt: () => [0.25, 0.25, 0.5, 0] });
function declared(seed = 77, datum?: number) {
  const source = { key: 'synthetic-ground', seed };
  const field = createBakedTerrainField(source, datum === undefined ? metadata : { ...metadata, datum });
  const binding = new HeightfieldBinding({ ...toLevelSpec(TEMPLATE), id: 'synthetic-ground', seed, ground: { terrain: field } });
  return { source, field, binding };
}

it('loads a required ground once through the session loader with unchanged metadata', async () => {
  const { source, field, binding } = declared(), expected = ground(77);
  const loader = vi.fn((asked: typeof source) => Promise.resolve(ground(asked.seed)));
  const restore = installRequiredGroundLoader(loader);
  try {
    expect(() => field.heightAt(0, 0)).toThrow('not ready');
    expect(await loadBakedTerrain(binding)).toBe(true);
    expect(await loadBakedTerrain(binding)).toBe(true); expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith(source);
    expect(field.trailDistance).toBe(metadata.trailDistance);
    expect(field.trails).toBe(metadata.trails);
    for (const [x, z] of [[0, 0], [100, -40], [-249, 249]] as const) {
      expect(field.heightAt(x, z)).toBe(expected.heightAt(x, z));
      expect(field.splatAt(x, z)).toEqual(expected.splatAt(x, z));
      expect(binding.field.heightAt(x, z)).toBe(field.heightAt(x, z));
    }
  } finally { restore(); }
});

it('retains datum once', async () => {
  const { field, binding } = declared(77, -60), restore = installRequiredGroundLoader(() => Promise.resolve(ground(77)));
  try {
    await loadBakedTerrain(binding);
    const expected = ground(77).heightAt(1, 2) - 60;
    expect(field.heightAt(1, 2)).toBe(expected); expect(binding.field.heightAt(1, 2)).toBe(expected);
  } finally { restore(); }
});

it('refuses a missing product, a wrong seed and no loader without an analytic fallback', async () => {
  const none = declared();
  await expect(loadBakedTerrain(none.binding)).rejects.toThrow('No required ground loader');
  for (const loader of [() => Promise.reject(new Error('404')), () => Promise.resolve(ground(78))]) {
    const restore = installRequiredGroundLoader(loader), missing = declared();
    try {
      await expect(loadBakedTerrain(missing.binding)).rejects.toThrow();
      expect(() => missing.field.heightAt(0, 0)).toThrow('not ready');
    } finally { restore(); }
  }
  const good = declared();
  const wrong = new HeightfieldBinding({ ...good.binding.level, seed: 78, ground: { terrain: good.field } });
  await expect(loadBakedTerrain(wrong)).rejects.toThrow('seed differs');
});

it('counts a painter-bound ground as the required ground, its splat included', async () => {
  const { field, binding } = declared(), bound = ground(77);
  installBoundGround(binding, bound);
  expect(field.heightAt(5, 5)).toBe(bound.heightAt(5, 5)); expect(field.splatAt(0, 0)).toEqual([0.25, 0.25, 0.5, 0]);
  expect(await loadBakedTerrain(binding)).toBe(true); // no loader is consulted
});

it('refuses unsafe declarations and retains the existing analytic field identity', () => {
  expect(() => createBakedTerrainField({ key: '../terrain', seed: 1 }, metadata)).toThrow();
  expect(() => createBakedTerrainField({ key: 'ground', seed: -1 }, metadata)).toThrow();
  expect(bakedTerrainSource(metadata)).toBeNull();
});

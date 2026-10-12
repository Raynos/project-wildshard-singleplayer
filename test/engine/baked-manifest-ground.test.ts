// oxlint-disable-next-line import/no-nodejs-modules -- Verify the shipping native terrain byte corpus.
import { readFileSync } from 'node:fs';
import { expect, it, vi, afterEach } from 'vitest';
import { createBakedTerrainField, bakedTerrainSource } from '../../src/engine/world/bakedTerrainField';
import { HeightfieldBinding } from '../../src/engine/world/Heightfield';
import { installBakedGrid, loadBakedTerrain } from '../../src/engine/world/BakedTerrain';
import { parseBakedTerrain } from '../../src/format/bakedTerrainBytes';
import { bakedSamplers } from '../../src/format/bakedTerrainSampling';
import { buildTerrain } from '../../src/engine/world/terrainField';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';

afterEach(() => { vi.restoreAllMocks(); });
const metadata = buildTerrain(1, { landscape: () => 0, trails: [[[0, 0], [10, 10]]], cabinSites: [] });
function corpus(slug: string) {
  const bytes = Uint8Array.from(readFileSync(`public/assets/baked/${slug}/terrain.bin`));
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null) throw new Error('Missing native terrain corpus');
  const source = { url: `/assets/baked/${slug}/terrain.bin`, seed: grid.seed };
  const field = createBakedTerrainField(source, metadata);
  const binding = new HeightfieldBinding({ ...toLevelSpec(TEMPLATE), id: slug, seed: grid.seed, ground: { terrain: field } });
  return { bytes, grid, source, field, binding };
}

it.each(['_template', 'sunscar-dunes'])('%s installs the identical native height, normal and splat laws with unchanged metadata', slug => {
  const { grid, field, binding } = corpus(slug), expected = bakedSamplers(grid);
  expect(() => field.heightAt(0, 0)).toThrow('not ready');
  installBakedGrid(grid, binding);
  expect(field.trailDistance).toBe(metadata.trailDistance);
  expect(field.waterLevel).toBe(metadata.waterLevel);
  expect(field.trails).toBe(metadata.trails);
  for (let i = 0; i < 1000; i++) {
    const x = (i * 313 % 500) - 250, z = (i * 179 % 500) - 250;
    expect(field.heightAt(x, z)).toBe(expected.heightAt(x, z));
    expect(field.normalAt(x, z)).toEqual(expected.normalAt(x, z));
    expect(field.splatAt(x, z)).toEqual(expected.splatAt(x, z));
    expect(binding.field.heightAt(x, z)).toBe(field.heightAt(x, z));
  }
});

it('retains datum once and refuses malformed bytes before changing the installed field', () => {
  const { grid, source } = corpus('_template');
  const field = createBakedTerrainField(source, { ...metadata, datum: -60 });
  const binding = new HeightfieldBinding({ ...toLevelSpec(TEMPLATE), seed: grid.seed, ground: { terrain: field } });
  installBakedGrid(grid, binding);
  const expected = bakedSamplers(grid).heightAt(1, 2) - 60;
  expect(field.heightAt(1, 2)).toBe(expected); expect(binding.field.heightAt(1, 2)).toBe(expected);
  const heights = Float32Array.from(grid.heights); heights[0] = Number.NaN;
  expect(() => installBakedGrid({ ...grid, heights }, binding)).toThrow('Invalid');
  expect(field.heightAt(1, 2)).toBe(expected);
});

it('fetches a required declared source once and rejects missing, wrong-seed and malformed bytes without an analytic fallback', async () => {
  const good = corpus('sunscar-dunes');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(good.bytes));
  expect(await loadBakedTerrain(good.binding)).toBe(true);
  expect(await loadBakedTerrain(good.binding)).toBe(true); expect(fetch).toHaveBeenCalledOnce();
  expect(bakedTerrainSource(good.field)).toEqual(good.source);
  for (const response of [new Response('', { status: 404 }), new Response(new Uint8Array(24))]) {
    fetch.mockResolvedValue(response);
    const missing = corpus('sunscar-dunes');
    await expect(loadBakedTerrain(missing.binding)).rejects.toThrow();
    expect(() => missing.field.heightAt(0, 0)).toThrow('not ready');
  }
  const wrong = new HeightfieldBinding({ ...good.binding.level, seed: good.grid.seed + 1, ground: { terrain: corpus('sunscar-dunes').field } });
  await expect(loadBakedTerrain(wrong)).rejects.toThrow('seed differs');
});

it('refuses unsafe declarations and retains the existing analytic field identity', () => {
  expect(() => createBakedTerrainField({ url: '/assets/../terrain.bin', seed: 1 }, metadata)).toThrow();
  expect(() => createBakedTerrainField({ url: '/assets/terrain.bin', seed: -1 }, metadata)).toThrow();
  expect(bakedTerrainSource(metadata)).toBeNull();
});

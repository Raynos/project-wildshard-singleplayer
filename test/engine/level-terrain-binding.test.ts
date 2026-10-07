import { afterEach, expect, it, vi } from 'vitest';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import { configureLevel } from '../../src/engine/level/selection';
import { HeightfieldBinding, _installBakedTerrain, bindHeightfield, captureHeightfield, heightAt, normalAt, overrideTerrain, splatAt, waterLevel } from '../../src/engine/world/Heightfield';
import { loadBakedTerrain } from '../../src/engine/world/BakedTerrain';
import { terrainDatum, terrainHeight, terrainWaterLevel } from '../../src/engine/world/terrainHeight';
import { publicBytes } from '../../src/engine/boot/tables';
import type { TerrainField } from '../../src/engine/level/data';

const flat = (h: number, datum = 0): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => h - 1, trails: [], cabinSites: [], pond: null, datum });
const level = (id: string, h: number, datum = 0) => ({ ...toLevelSpec(TEMPLATE), id, seed: 435, ground: { terrain: flat(h, datum) } });
afterEach(() => { vi.restoreAllMocks(); });

it('routes both terrain ports and restores the exact home bake after nested/out-of-order frames', () => {
  const home = level('home', 1, -0.8); configureLevel(home);
  _installBakedTerrain({ heightAt: () => 10, normalAt: () => [0.6, 0.8, 0], splatAt: () => [0, 1, 0, 0] });
  const original = captureHeightfield();
  const a = new HeightfieldBinding(level('a', 20, 2));
  const b = new HeightfieldBinding(level('b', 30));
  const leaveA = bindHeightfield(a), leaveB = bindHeightfield(b);
  expect(terrainHeight(0, 0)).toBe(30); expect(terrainWaterLevel()).toBe(29);
  leaveA(); expect(heightAt(0, 0)).toBe(30);
  a.install({ heightAt: () => 40, normalAt: () => [0, 1, 0], splatAt: () => [0, 0, 1, 0] });
  expect(heightAt(0, 0)).toBe(30);
  leaveB(); leaveB();
  expect(captureHeightfield()).toBe(original);
  expect(heightAt(0, 0)).toBe(9.2); expect(terrainHeight(0, 0)).toBe(9.2);
  expect(normalAt(0, 0)).toEqual([0.6, 0.8, 0]); expect(splatAt(0, 0)).toEqual([0, 1, 0, 0]);
  expect(terrainDatum()).toBe(-0.8); expect(waterLevel()).toBe(0);
  const leaveAgain = bindHeightfield(a); expect(heightAt(0, 0)).toBe(42); leaveAgain();
});

it('keeps same-level baked reads and overrideTerrain reset behaviour unchanged', () => {
  const home = level('home', 1); configureLevel(home);
  _installBakedTerrain({ heightAt: () => 7, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0] });
  configureLevel(home); expect(heightAt(0, 0)).toBe(7);
  const restore = overrideTerrain({ heightAt: () => 3 }); expect(heightAt(0, 0)).toBe(3);
  configureLevel(level('next', 9)); expect(heightAt(0, 0)).toBe(3);
  restore(); expect(heightAt(0, 0)).toBe(9);
});

it('a late regional bake installs only into its captured frame and is retained for re-entry', async () => {
  configureLevel(level('home', 5));
  const id = Object.keys(publicBytes()).find((url) => url.endsWith('/terrain.bin'))?.split('/')[3];
  if (id === undefined) throw new Error('The real asset tables include a terrain bake');
  const region = new HeightfieldBinding(level(id, 20, 2));
  const buf = new ArrayBuffer(24 + 4 * 8), dv = new DataView(buf);
  new Uint8Array(buf, 0, 4).set([0x57, 0x53, 0x54, 0x52]);
  dv.setUint32(4, 1, true); dv.setUint32(8, 2, true); dv.setFloat32(12, 500, true); dv.setUint32(16, 435, true);
  new Float32Array(buf, 24, 4).fill(8); new Uint8Array(buf, 40, 16).fill(255);
  let deliver: ((response: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => { deliver = resolve; });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => response);
  const leave = bindHeightfield(region), pending = loadBakedTerrain(); leave();
  if (deliver === undefined) throw new Error('Missing pending response');
  deliver(new Response(buf)); expect(await pending).toBe(true);
  expect(heightAt(0, 0)).toBe(5); expect(region.field.heightAt(0, 0)).toBe(10);
  const reenter = bindHeightfield(region); expect(heightAt(0, 0)).toBe(10);
  expect(await loadBakedTerrain()).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1); reenter();
});

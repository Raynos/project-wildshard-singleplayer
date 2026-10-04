import { afterEach, expect, it, vi } from 'vitest';
import { DataTexture } from 'three';
import { App, type LevelDriver, needsTerrainCollider } from '#engine';
import { terrainFieldFor } from '#engine/data';
import { configureLevel } from '#engine-internal/level/selection';
import * as heightfield from '#engine-internal/world/Heightfield';
import { terrainHeight, terrainNormal, terrainWaterLevel } from '#engine-internal/world/terrainHeight';
import { Terrain } from '#engine-internal/world/Terrain';
import { toLevelSpec } from '#game/shard/spec';
import { terrainFor, type ShardManifest } from '#game/shard/manifest';
import { TEMPLATE } from '#shards/_template/manifest';

const FIXTURE: ShardManifest = { ...TEMPLATE, ground: { structures: true },
  spawn: { x: 0, y: 2, z: 0, yaw: 0 }, uses: [], spawns: [], treeCount: 0 };
const noop = (): void => undefined;
afterEach(() => { configureLevel(toLevelSpec(TEMPLATE)); });

it('loads a structures-only manifest with no authored terrain, terrain mesh or terrain collider', async () => {
  const app = new App(), level = toLevelSpec(FIXTURE), terrain = new Terrain();
  const painter = vi.fn(() => Promise.resolve());
  const driver: LevelDriver = {
    progress: () => ({ set: noop, detail: noop }),
    data: (spec) => { configureLevel(spec); },
    world: async (spec, ctx) => {
      await terrain.build(spec.ground, { build: painter }, ctx.scope);
      ctx.root.add(terrain.group);
      expect(needsTerrainCollider(spec)).toBe(false);
    },
    kit: noop, loadout: noop, play: noop, finish: noop,
  };
  app.levelDriver = driver;
  try {
    await app.loadLevel(level, { world: () => {
      expect(terrainFor(FIXTURE).heightAt(0, 0)).toBe(-1000);
      expect(heightfield.heightAt(100, -50)).toBe(-1000);
      expect(terrainHeight(-250, 250)).toBe(-1000);
    } });
    expect(level.ground.terrain).toBeUndefined();
    expect(level.spawn.y).toBe(2);
    expect(terrain.group.children).toHaveLength(0);
    expect(painter).not.toHaveBeenCalled();
    expect(() => terrain.mesh).toThrow('no terrain mesh');
    terrain.applyCanopy(new DataTexture());
    expect(terrain.punch(() => true)).toBe(0);
    expect(app.levelScope?.census.colliders).toBe(0);
  } finally { await app.unloadLevel(); }
});

it('rebinds all terrain readers from an authored/baked world to structures and back', () => {
  const authored = toLevelSpec(TEMPLATE), field = authored.ground.terrain;
  if (field === undefined) throw new Error('template terrain missing');
  configureLevel(authored);
  heightfield._installBakedTerrain({ heightAt: () => 42, normalAt: () => [1, 0, 0], splatAt: () => [0, 0, 0, 1] });
  expect(heightfield.heightAt(0, 0)).toBe(42);
  configureLevel(toLevelSpec(FIXTURE));
  const empty = terrainFor(FIXTURE);
  expect(heightfield.heightAt(0, 0)).toBe(-1000);
  expect(heightfield.normalAt(0, 0)).toEqual([0, 1, 0]);
  expect(terrainNormal(0, 0)).toEqual([0, 1, 0]);
  expect(heightfield.splatAt(0, 0)).toEqual([1, 0, 0, 0]);
  expect(heightfield.TRAILS).toEqual([]); expect(heightfield.CABIN_SITES).toEqual([]);
  expect(heightfield.hasPond()).toBe(false); expect(heightfield.POND.r).toBe(0);
  expect(empty.trailDistance(0, 0)).toBe(Number.POSITIVE_INFINITY);
  expect(empty.cabinMask(0, 0)).toBe(0); expect(empty.pondMask(0, 0)).toBe(0);
  expect(heightfield.streamAt(0, 0)).toBeNull();
  expect(terrainWaterLevel()).toBe(-1001);
  configureLevel(authored);
  expect(heightfield.heightAt(0, 0)).toBe(field.heightAt(0, 0));
  expect(heightfield.TRAILS).toBe(field.trails);
});

it('keeps authored terrain for mixed worlds and rejects missing ground policy', () => {
  const mixed: ShardManifest = { ...TEMPLATE, ground: { ...TEMPLATE.ground, structures: true } };
  expect(terrainFor(mixed)).toBe(TEMPLATE.ground.terrain);
  expect(() => terrainFieldFor({}, 'invalid')).toThrow('No terrain for invalid');
});

import { expect, it } from 'vitest';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { LevelFrameBinding } from '../../src/engine/level/frame';
import { configureLevel } from '../../src/engine/level/selection';
import { heightAt } from '../../src/engine/world/Heightfield';
import { Terrain } from '../../src/engine/world/Terrain';
import { WaterBodies } from '../../src/engine/world/water/body';
import type { TerrainPainter } from '../../src/engine/render/look';
import type { TerrainField } from '../../src/engine/level/data';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import { provideRuntimeProduct, runtimeProduct } from '../../src/game/shardfile/runtimeProduct';
import { emptyShardfile } from '../../src/sdk/author';
import { parseShardfile } from '../../src/game/shardfile/schema';

const flat = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 9, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => h - 1, trails: [], cabinSites: [], pond: null });
const level = (id: string, h: number, seed: number) => ({ ...toLevelSpec(TEMPLATE), id, seed, ground: { terrain: flat(h) } });

// M3 tiles-swap: a painter that binds its own sampled ground moves the frame's queries onto it and marks the terrain, so a
// collider built before it ran is resampled (the grid region builds its collider first).
it('binds a painter ground into its own frame only, keeping trails, and marks the terrain', async () => {
  const home = level('home', 1, 11); configureLevel(home);
  const host = new App(), scope = new Scope('region');
  const frame = new LevelFrameBinding({ level: level('region', 20, 22), scope, navmesh: null, water: new WaterBodies() });
  const painter: TerrainPainter = { build: (_terrain, field) => {
    field.bindGround?.({ heightAt: (x) => 30 + x, normalAt: () => [0, 1, 0] });
    return Promise.resolve();
  } };
  const terrain = new Terrain();
  expect(terrain.groundBound).toBe(false);
  await frame.run(host, () => terrain.build(frame.terrain.level.ground, painter, scope));
  expect(terrain.groundBound).toBe(true);
  expect(frame.terrain.field.heightAt(2, 0)).toBe(32);
  expect(frame.terrain.field.trailDistance(0, 0)).toBe(9);
  expect(heightAt(2, 0)).toBe(1); // the home frame is untouched
  expect(frame.run(host, () => heightAt(2, 0))).toBe(32);
  scope.dispose();
});

it('hands a resident runtime its admitted product and falls back to the standalone reader after it leaves', () => {
  const source = parseShardfile(emptyShardfile({ slug: 'reader-test', name: 'Reader', author: 'Wildshard', revision: 1, seed: 1 }));
  const standalone = runtimeProduct(source);
  expect(standalone.source).toBe(source);
  const resident = new Scope('resident'), admittedSource = parseShardfile(emptyShardfile({ slug: 'reader-test', name: 'Reader', author: 'Wildshard', revision: 2, seed: 1 }));
  provideRuntimeProduct({ source: admittedSource, assets: new Map(), cached: false }, resident);
  expect(runtimeProduct(source).source).toBe(admittedSource);
  resident.dispose();
  expect(runtimeProduct(source).source).toBe(source);
});

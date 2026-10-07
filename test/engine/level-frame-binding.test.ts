import { afterEach, expect, it, vi } from 'vitest';
import { createNavMesh } from 'navcat';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { currentOwner } from '../../src/engine/app/ownership';
import { _applyChunkConstants, SEED, TREE_COUNT, PAGE_LEVEL } from '../../src/engine/core/config';
import { LevelFrameBinding } from '../../src/engine/level/frame';
import { activeLevel, configureLevel, onLevelChange } from '../../src/engine/level/selection';
import { heightAt, _installBakedTerrain } from '../../src/engine/world/Heightfield';
import { Terrain } from '../../src/engine/world/Terrain';
import { WaterBodies, type WaterBody } from '../../src/engine/world/water/body';
import { Navmesh } from '../../src/engine/physics/navmesh';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import type { PainterField, TerrainPainter } from '../../src/engine/render/look';
import type { TerrainField } from '../../src/engine/level/data';
import type { LevelSpec } from '../../src/engine/level/spec';
import { placeForest } from '../../src/engine/world/forest/placement';

const flat = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => h - 1, trails: [], cabinSites: [], pond: null });
const level = (id: string, h: number, seed: number) => ({ ...toLevelSpec(TEMPLATE), id, seed, treeCount: seed, ground: { terrain: flat(h) } });
const sea = (h: number): WaterBody => ({ id: 'sea', level: h, surfaceAt: () => h, inside: () => true, restAt: () => h });
const nav = () => new Navmesh([{ radius: 0.3, height: 1.8, climb: 0.3, mesh: createNavMesh() }]);
afterEach(() => { vi.restoreAllMocks(); });

it('enters independent level/scope/navmesh/water and restores the exact home in either disposal order', () => {
  const home = level('home', 1, 11); configureLevel(home);
  _applyChunkConstants({ slug: home.id, label: 'home', seed: 11, treeCount: 11 });
  _installBakedTerrain({ heightAt: () => 7, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0] });
  const host = new App(), homeScope = new Scope('home'), residentA = new Scope('resident.a'), residentB = new Scope('resident.b');
  host.levelScope = homeScope; const homeNav = nav(); host.navmesh = homeNav; host.navmeshId = 'home';
  const homeWater = host.world.water; homeWater.add(sea(0), homeScope);
  const waterA = new WaterBodies(); waterA.add(sea(19), residentA);
  const waterB = new WaterBodies(); waterB.add(sea(29), residentB);
  const aLevel = level('a', 20, 22), bLevel = level('b', 30, 33), navA = nav();
  const a = new LevelFrameBinding({ level: aLevel, scope: residentA, navmesh: navA, water: waterA });
  const b = new LevelFrameBinding({ level: bLevel, scope: residentB, navmesh: null, water: waterB });
  const entryA = new Scope('entry.a'), entryB = new Scope('entry.b'), page = PAGE_LEVEL;
  const changed = vi.fn<(value: LevelSpec) => void>(), stop = onLevelChange(changed);
  a.enter(host, entryA);
  expect(activeLevel()).toBe(aLevel); expect(heightAt(0, 0)).toBe(20); expect(host.levelScope).toBe(residentA);
  expect(host.navmesh).toBe(navA); expect(host.navmeshId).toBe('a'); expect(host.world.water.sea?.level).toBe(19);
  expect(SEED).toBe(22); expect(TREE_COUNT).toBe(22); expect(PAGE_LEVEL).toBe(page);
  b.enter(host, entryB); residentA.dispose();
  expect(activeLevel()).toBe(bLevel); expect(heightAt(0, 0)).toBe(30); expect(host.levelScope).toBe(residentB);
  expect(host.navmesh).toBeNull(); expect(host.world.water.sea?.level).toBe(29);
  entryB.dispose(); entryA.dispose(); residentB.dispose();
  expect(activeLevel()).toBe(home); expect(heightAt(0, 0)).toBe(7); expect(host.levelScope).toBe(homeScope);
  expect(host.navmesh).toBe(homeNav); expect(host.navmeshId).toBe('home'); expect(host.world.water).toBe(homeWater);
  expect(host.world.water.sea?.level).toBe(0); expect(SEED).toBe(11); expect(TREE_COUNT).toBe(11);
  expect(changed).not.toHaveBeenCalled(); stop(); homeScope.dispose();
});

it('captures async terrain painters per frame and owns synchronous setup without holding globals over await', async () => {
  const home = level('home', 1, 11); configureLevel(home);
  const host = new App(), scope = new Scope('region'), entered = new Scope('entered');
  const frame = new LevelFrameBinding({ level: level('region', 20, 22), scope, navmesh: null, water: new WaterBodies() });
  let continueBuild: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { continueBuild = resolve; });
  let field: PainterField | undefined;
  const values: number[] = [];
  const painter: TerrainPainter = { build: async (_terrain, source) => { field = source; values.push(source.heightAt(0, 0)); await pending; values.push(source.heightAt(0, 0)); } };
  const terrain = new Terrain();
  const built = frame.run(host, () => {
    expect(currentOwner()).toBe(scope); expect(activeLevel().id).toBe('region');
    return terrain.build(frame.terrain.level.ground, painter, scope);
  });
  expect(activeLevel()).toBe(home); expect(heightAt(0, 0)).toBe(1);
  frame.terrain.install({ heightAt: () => 40, normalAt: () => [0, 1, 0], splatAt: () => [0, 1, 0, 0] });
  if (continueBuild === undefined || field === undefined) throw new Error('Painter must be waiting');
  continueBuild(); expect(await built).toBe(terrain); expect(values).toEqual([20, 40]);
  expect(field.normalAt(0, 0)).toEqual([0, 1, 0]); expect(activeLevel()).toBe(home); expect(heightAt(0, 0)).toBe(1);
  scope.dispose(); expect(() => frame.enter(host, entered)).toThrow('disposed'); entered.dispose();
});

it('plants each forest on its local field/seed and leaves home placement byte-identical', () => {
  const forest = { spacing: 20, densityFreq: 0.01, clearings: [-1, 1] as [number, number], maxSlope: 0.5, tintHue: 0.2, tintHueJitter: [0, 0] as [number, number], tintSat: [0.2, 0.3] as [number, number], tintLight: [0.7, 0.8] as [number, number], largeVariantChance: 0 };
  const home = { ...level('home', 3, 11), forest }; configureLevel(home);
  _applyChunkConstants({ slug: home.id, label: 'home', seed: 11, treeCount: 11 });
  const variants = Array.from({ length: 4 }, () => ({ trunkRadius: 0.3, height: 3 }));
  const original = placeForest(variants).trees;
  expect(original).toHaveLength(11); expect(original.every((tree) => tree.y === 2.75)).toBe(true);
  const host = new App(), scope = new Scope('forest.region');
  const frame = new LevelFrameBinding({ level: { ...level('region', 20, 22), forest }, scope, navmesh: null, water: new WaterBodies() });
  const regional = frame.run(host, () => placeForest(variants).trees);
  expect(regional).toHaveLength(22); expect(regional.every((tree) => tree.y === 19.75)).toBe(true);
  expect(regional[0]?.x).not.toBe(original[0]?.x);
  expect(placeForest(variants).trees).toEqual(original); scope.dispose();
});

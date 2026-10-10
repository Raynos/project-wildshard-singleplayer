import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { Mesh, PlaneGeometry, Vector3, type Material } from 'three';
import * as boot from '../src/game/grid/boot';
import { gridLevel } from '../src/game/grid/session';
import { shardContext, type GameServices } from '../src/game/shard/context';
import type { LevelContext } from '../src/engine/level/context';
import { Horizon } from '../src/engine/world/Horizon';
import { configureLevel } from '../src/engine/level/selection';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { Scope } from '../src/engine/app/scope';
import { toLevelSpec } from '../src/game/shard/spec';
import { SUNSCAR_DUNES } from '../src/shards/sunscar-dunes/manifest';
import { SKIRT } from '../src/shards/sunscar-dunes/look/render';

// G99: every shard is a 500 m cube; in a grid cell nothing it draws stands past 250 m (SHARD-PLATFORM SF50, E435)
const restoreTerrain = overrideTerrain({ heightAt: () => 0, waterLevel: () => 0, pondMask: () => 0, streamAt: () => null });
afterAll(restoreTerrain);
afterEach(() => { vi.restoreAllMocks(); });
const sky = (): { setupMaterial: (material: Material) => void; sunDir: Vector3; night: number } => ({ setupMaterial: vi.fn<(material: Material) => void>(), sunDir: new Vector3(0, 1, 0), night: 0 });

it('keeps a standalone level and its horizon rings untouched', () => {
  const spec = toLevelSpec(SUNSCAR_DUNES);
  expect(gridLevel(spec)).toBe(spec);
  expect(spec.horizon?.rings.length).toBe(4);
  configureLevel(spec);
  expect(new Horizon(sky()).build(spec).group.children).toHaveLength(4);
});

it('drops a level\'s own horizon rings and cloud sea in a grid cell, and builds the booted spec\'s horizon', () => {
  vi.spyOn(boot, 'pageMode').mockReturnValue('grid');
  const spec = toLevelSpec(SUNSCAR_DUNES), grid = gridLevel(spec);
  expect(grid.horizon).toEqual({ rings: [], cloudSea: false });
  expect(grid.boundary).toMatchObject({ visible: false, walls: false });
  expect(spec.horizon?.rings.length).toBe(4); // the shard's data is not mutated
  configureLevel(spec); // the selected level stays the shard's own; the world builds from the booted (grid) spec
  expect(new Horizon(sky()).build(grid).group.children).toHaveLength(0);
  const { horizon: _drop, ...noOwn } = spec;
  expect(gridLevel(noOwn).horizon).toBeUndefined(); // the engine's own horizon (painted strips, far ridges) stays
});

it('gives a shard its cube only in a grid cell', () => {
  const game: GameServices = { shard: SUNSCAR_DUNES, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } };
  expect(shardContext({} as LevelContext, SUNSCAR_DUNES, game).cube).toBeNull();
  vi.spyOn(boot, 'pageMode').mockReturnValue('grid');
  expect(shardContext({} as LevelContext, SUNSCAR_DUNES, game).cube).toEqual({ half: 250 });
});

it('cuts Signal Dunes\' skirt back to the cube once, and frees the standalone geometry', () => {
  const scope = new Scope('test'), standalone = new PlaneGeometry(1040, 1040, 4, 4), mesh = new Mesh(standalone);
  const disposed = vi.fn<() => void>(); standalone.addEventListener('dispose', disposed);
  const rebuild = vi.fn((half: number) => new PlaneGeometry(half * 2, half * 2, 2, 2));
  SKIRT.hold(mesh, rebuild, scope);
  expect(SKIRT.reach()).toBe(520);
  SKIRT.fit(250); SKIRT.fit(250);
  expect(rebuild).toHaveBeenCalledOnce();
  expect(SKIRT.reach()).toBe(250);
  expect(disposed).toHaveBeenCalledOnce();
  scope.dispose();
  expect(SKIRT.reach()).toBeNull();
});

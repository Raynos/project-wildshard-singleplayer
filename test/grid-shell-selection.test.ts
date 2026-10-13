import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { LevelFrameBinding } from '../src/engine/level/frame';
import { heightAt, normalAt } from '../src/engine/world/Heightfield';
import { createBakedTerrainField, installDeclaredBakedTerrain } from '../src/engine/world/bakedTerrainField';
import { WaterBodies } from '../src/engine/world/water/body';
import { game } from '../src/game/shard/registry';
import { toLevelSpec } from '../src/game/shard/spec';
import { gridPageShell, selectGridPageShell } from '../src/game/grid/pageShell';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';

it('selects a fauna-free neutral floor without satisfying its unadmitted home, and residents still override it', () => {
  const previous = activeLevel(), catalogue = game.shard;
  const metadata = PINE_HOLLOW.ground.terrain;
  if (metadata === undefined) throw new Error('Missing authored fixture metadata');
  const home = createBakedTerrainField({ key: 'pine-hollow', seed: PINE_HOLLOW.seed }, metadata);
  const manifest = { ...PINE_HOLLOW, ground: { terrain: home } };
  configureLevel(toLevelSpec(manifest));
  const scope = new Scope('shell-selection'), app = new App();
  const leave = selectGridPageShell(gridPageShell(manifest));
  try {
    expect(activeLevel().id).toBe('platform.grid');
    expect(activeLevel().spawns).toEqual([]);
    expect(heightAt(0, 0)).toBe(-1000); expect(normalAt(0, 0)).toEqual([0, 1, 0]);
    expect(game.shard).toBe(catalogue);
    expect(() => home.heightAt(0, 0)).toThrow('not ready');
    installDeclaredBakedTerrain(home, { seed: PINE_HOLLOW.seed, heightAt: () => 12, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0] });
    const region = toLevelSpec(manifest), frame = new LevelFrameBinding({ level: region, scope, navmesh: null, water: new WaterBodies() });
    frame.run(app, () => {
      expect(activeLevel()).toBe(region); expect(heightAt(0, 0)).toBe(12);
      expect(activeLevel().spawns).toBe(manifest.spawns); expect(game.shard).toBe(catalogue);
    });
    expect(activeLevel().id).toBe('platform.grid'); expect(heightAt(0, 0)).toBe(-1000); expect(activeLevel().spawns).toEqual([]);
  } finally { scope.dispose(); app.engineScope.dispose(); leave(); expect(activeLevel().id).toBe(manifest.slug); configureLevel(previous); }
});

import { describe, expect, it } from 'vitest';
import { WaterBodies, swellBody } from '../../src/engine/world/water/body';
import { Scope } from '../../src/engine/app/scope';
import { waveHeight } from '../../src/engine/world/waves';
import { App, type LevelDriver } from '#engine';
import { WorldRegistry } from '#engine/world/registry';
import { toLevelSpec } from '#game/shard/spec';
import manifest from '#shards/nine-dragon-stack/manifest';
import { FakeGame } from '../fake/FakeGame';

describe('app.world.water (E357 S4.1)', () => {
  it('has no sea until a level registers one, and loses it with the scope', () => {
    const water = new WaterBodies(), scope = new Scope('level');
    expect(water.sea).toBeNull();
    expect(water.level).toBeNull();
    expect(water.surfaceAt(0, 0)).toBeNull();
    water.add(swellBody('sea', 0.8), scope);
    expect(water.level).toBe(0.8);
    expect(water.size).toBe(1);
    scope.dispose();
    expect(water.sea).toBeNull();
    expect(water.size).toBe(0);
  });

  it('the swell body rides the Gerstner waves over its rest level', () => {
    const sea = swellBody('sea', 0.8);
    for (const [x, z] of [[0, -194], [12.5, 40], [-150, 3]] as const) {
      const s = 0.8 + waveHeight(x, z);
      expect(sea.surfaceAt(x, z)).toBe(s);
      expect(sea.inside(x, z, s - 0.01)).toBe(true);
      expect(sea.inside(x, z, s + 0.01)).toBe(false);
    }
  });

  it('refuses a second body with the same id and answers inside() with the covering body', () => {
    const water = new WaterBodies(), scope = new Scope('level');
    const sea = swellBody('sea', 0.8);
    water.add(sea, scope);
    expect(() => { water.add(swellBody('sea', 1), scope); }).toThrow(/already registered/);
    expect(water.inside(0, 0, -5)).toBe(sea);
    expect(water.inside(0, 0, 5)).toBeNull();
  });

  it('registers the level spec\'s ground.water at level.data, before the world step, and drops it on unload', async () => {
    const app = new App(), fake = new FakeGame(), sea = swellBody('sea', 0.8), seen: (number | null)[] = [];
    app.scene = fake.scene; app.render = fake.asGame(); app.registryValue = new WorldRegistry();
    const noop = (): void => { /* no engine steps in this fixture */ };
    const driver: LevelDriver = {
      progress: () => ({ set: noop, detail: noop }),
      data: (_spec, ctx) => { seen.push(ctx.app.world.water.level); }, world: (_spec, ctx) => { seen.push(ctx.app.world.water.level); },
      kit: noop, loadout: noop, play: noop, finish: noop,
    };
    app.levelDriver = driver;
    const spec = toLevelSpec({ ...manifest, ground: { ...manifest.ground, water: [sea] } });
    expect(spec.ground.water).toEqual([sea]);
    await app.loadLevel(spec, {});
    expect(seen).toEqual([0.8, 0.8]);
    expect(app.world.water.sea).toBe(sea);
    await app.unloadLevel();
    expect(app.world.water.sea).toBeNull();
  });
});

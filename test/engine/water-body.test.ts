import { describe, expect, it } from 'vitest';
import { WaterBodies, swellBody, basinBody } from '../../src/engine/world/water/body';
import { waterView } from '../../src/engine/world/water/view';
import pine from '../../src/shards/pine-hollow/manifest';
import nalati from '../../src/shards/nalati-grasslands/manifest';
import { Scope } from '../../src/engine/app/scope';
import { waveHeight } from '../../src/engine/world/waves';
import { App, type LevelDriver } from '@wildshard/engine';
import { WorldRegistry } from '../../src/engine/world/registry';
import { toLevelSpec } from '../../src/game/shard/spec';
import manifest from '../../src/shards/nine-dragon-stack/manifest';
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

  it('swims against the same surface as the terrain formula it replaced (X5: pond, creek, river)', () => {
    for (const m of [pine, nalati]) {
      const T = m.ground.terrain, water = new WaterBodies(), scope = new Scope('level');
      if (T === undefined) throw new Error(`${m.slug} has no terrain`);
      for (const body of m.ground.water ?? []) water.add(body, scope);
      let wet = 0;
      for (let x = -250; x <= 250; x += 2.5) for (let z = -250; z <= 250; z += 2.5) {
        const old = T.pondMask(x, z) > 0 ? T.waterLevel() : (T.streamAt?.(x, z) ?? null);
        expect(water.restAt(x, z)).toBe(old);
        if (old !== null) { wet++; expect(water.inside(x, z, old - 0.01)).not.toBeNull(); expect(water.inside(x, z, old + 0.01)).toBeNull(); }
      }
      expect(wet).toBeGreaterThan(100);
      scope.dispose();
    }
  });

  it('a basin answers only over its mask; the sea answers everywhere at its rest level; reflect reaches each hook', () => {
    const terrain = { pondMask: (x: number): number => x < 0 ? 1 : 0, waterLevel: (): number => 2 };
    const water = new WaterBodies(), scope = new Scope('level'), views: string[] = [];
    water.add(basinBody('pond', terrain, (v) => { views.push(v); }), scope);
    expect(water.restAt(-1, 0)).toBe(2);
    expect(water.restAt(1, 0)).toBeNull();
    water.add(swellBody('sea', 0.8), scope);
    expect(water.restAt(1, 0)).toBe(0.8);
    water.reflect('top-down'); water.reflect('eye');
    expect(views).toEqual(['top-down', 'eye']);
    const pineWater = new WaterBodies();
    for (const body of pine.ground.water ?? []) pineWater.add(body, scope);
    pineWater.reflect('top-down');
    expect(waterView.uTopDown.value).toBe(1);
    pineWater.reflect('eye');
    expect(waterView.uTopDown.value).toBe(0);
    scope.dispose();
  });
});

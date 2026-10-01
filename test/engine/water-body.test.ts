import { describe, expect, it } from 'vitest';
import { WaterBodies, swellBody } from '../../src/engine/world/water/body';
import { Scope } from '../../src/engine/app/scope';
import { waveHeight } from '../../src/engine/world/waves';

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
});

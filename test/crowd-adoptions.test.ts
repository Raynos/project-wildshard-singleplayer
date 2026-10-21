import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { ForagerPopulation } from '../src/engine/ai/ambientForager';
import { CrowdRoster, CrowdWeaponTarget, ForagerTargets } from '../src/game/shardfile/crowdRuntime';
import { PAGE_LIFE } from '../src/shards/pine-hollow/generators/pageLife';
import { headlessAssembly } from '../src/shards/nalati-grasslands/generators/nativeGroups';

test('shipped Pine hares enter the same crowd weapon projection as Nalati sheep', () => {
  const reset = overrideTerrain({ heightAt: () => 0, waterLevel: () => -100,
    normalAt: () => [0, 1, 0], cabinMask: () => 0, pondMask: () => 0, streamAt: () => null });
  try {
    const row = PAGE_LIFE.foragers[0];
    if (row?.combat === undefined) throw new Error('Pine must declare its live hare combat rows');
    expect(headlessAssembly.constants.pageWildlife.combat).toEqual({ kind: 'sheep', damage: 100 });
    const viewer = { x: 0, z: 0, fx: 0, fz: 1 }, population = new ForagerPopulation(row.row, PAGE_LIFE.seed).roam(viewer);
    population.update(1 / 60, viewer, false);
    const original = population.snapshot(), targets = new ForagerTargets(population, row.combat, row.scale);
    const roster = new CrowdRoster([], [targets]), weapon = new CrowdWeaponTarget(roster, row.combat.target);
    const point = targets.positions(0, new Vector3()), origin = point.clone().add(new Vector3(0, 0, -1)), direction = new Vector3(0, 0, 1);
    const hit = weapon.raycast(origin, direction, 2, null);
    if (hit === null) throw new Error('Visible native hare must be hittable');
    expect(hit.animal.kind).toBe('hare'); expect(hit.animal.damageFor(false, 1)).toBe(row.combat.target.damage);
    hit.animal.applyDamage(1, hit.point, direction);
    expect(population.isAlive(0)).toBe(false); expect(population.shown[0]).toBe(0);
    hit.animal.applyDamage(1, hit.point, direction);
    for (let frame = 0; frame < 120; frame++) population.update(1 / 60, viewer, false);
    expect(weapon.raycast(origin, direction, 2, null)).toBeNull();
    const saved = population.snapshot(), resumed = new ForagerPopulation(row.row, PAGE_LIFE.seed);
    expect(saved.retired).toEqual([0]); resumed.restore(saved); resumed.update(1 / 60, viewer, false);
    expect(resumed.isAlive(0)).toBe(false); expect(resumed.shown[0]).toBe(0);
    const beforeInvalid = resumed.snapshot();
    for (const retired of [[0, 0], [row.row.count]]) {
      expect(() => resumed.restore({ ...saved, retired })).toThrow(); expect(resumed.snapshot()).toEqual(beforeInvalid);
    }
    expect(original.retired).toBeUndefined(); resumed.restore(original); resumed.update(1 / 60, viewer, false);
    expect(resumed.isAlive(0)).toBe(true);
    expect(() => resumed.kill(-1)).toThrow('Unknown forager');
  } finally { reset(); }
});

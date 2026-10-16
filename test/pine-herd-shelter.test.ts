import { expect, test } from 'vitest';
import { HerdShelter } from '../src/shards/pine-hollow/runtime/species/herdShelter';
import { PINE_HERD_SHELTER as look } from '../src/shards/pine-hollow/data/weatherLook';

test('page and native herds share wet goals and atomically resume a v1 shelter save', () => {
  const herds = [{ kind: 'deer', cx: 10, cz: 0, members: [] }, { kind: 'boar', cx: 200, cz: 0, members: [] }, { kind: 'bear', cx: 0, cz: 0, members: [] }];
  const trees = [{ x: 0, z: 0, r: 1, height: 25, cover: 1 }];
  const shelter = new HerdShelter({ herds }, trees, (_x, _z, tree) => tree.cover, look);
  shelter.update(1, look.wet);
  expect(shelter.wanderGoal(0, 1)).toBeNull();
  shelter.update(1, 1);
  expect(shelter.wanderGoal(0, 1)).toEqual({ x: 3.2, z: 0, r: look.spotR });
  expect(shelter.wanderGoal(1, 1)).toBeNull();
  expect(shelter.wanderGoal(2, 1)).toBeNull();
  const legacy = { version: 1, shelters: [
    { home: { x: 10, z: 0 }, spot: { x: 3.2, z: 0 }, hold: 80 },
    { home: { x: 200, z: 0 }, spot: null, hold: 80 }, null
  ] };
  const resumed = new HerdShelter({ herds: herds.map(({ kind, cx, cz, members }) => ({ kind, cx, cz, members })) }, trees, () => 1, look);
  resumed.restore(legacy);
  expect(resumed.snapshot()).toEqual(legacy);
  expect(resumed.wanderGoal(0, 0)).toEqual({ x: 10, z: 0, r: look.homeR });
  expect(() => resumed.restore({ ...legacy, shelters: legacy.shelters.slice(1) })).toThrow();
  expect(() => resumed.restore({ ...legacy, shelters: [...legacy.shelters.slice(0, 2), legacy.shelters[0]] })).toThrow();
  expect(() => resumed.restore({ ...legacy, shelters: [{ ...legacy.shelters[0], hold: look.homeHold + 1 }, ...legacy.shelters.slice(1)] })).toThrow();
  expect(resumed.snapshot()).toEqual(legacy);
  const oldHome = legacy.shelters[0]?.home;
  if (oldHome !== undefined) oldHome.x = 99;
  expect(resumed.wanderGoal(0, 0)?.x).toBe(10);
  resumed.update(80, look.dry);
  expect(resumed.wanderGoal(0, 0)).not.toBeNull();
  resumed.update(80, 0);
  expect(resumed.wanderGoal(0, 0)).toBeNull();
});

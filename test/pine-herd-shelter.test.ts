import { ReturnProgram } from '../src/game/population/returnProgram';
import program from '../src/shards/pine-hollow/behaviour/shelter.generated.json' with { type: 'json' };
import { expect, test, vi } from 'vitest';
import { HerdShelter } from '../src/game/population/shelter';
import look from '../src/shards/pine-hollow/data/populationShelter.json' with { type: 'json' };

test('page and native herds share wet goals and atomically resume a v1 shelter save', () => {
  const herds = [{ kind: 'deer', cx: 10, cz: 0, members: [] }, { kind: 'boar', cx: 200, cz: 0, members: [] }, { kind: 'bear', cx: 0, cz: 0, members: [] }];
  const trees = [{ x: 0, z: 0, r: 1, height: 25, cover: 1 }];
  const shelter = new HerdShelter({ herds }, trees, look, ReturnProgram.page(program));
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
  const resumed = new HerdShelter({ herds: herds.map(({ kind, cx, cz, members }) => ({ kind, cx, cz, members })) }, trees, look, ReturnProgram.page(program));
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


test('shelter decisions borrow a ten-Hz sample and goal queries do not resample it', () => {
  const guest = ReturnProgram.page(program), project = vi.spyOn(guest, 'project');
  const herds = [{ kind: 'deer', cx: 10, cz: 0, members: [] }];
  const shelter = new HerdShelter({ herds }, [{ x: 0, z: 0, r: 1, height: 25, cover: 1 }], look, guest);
  for (let frame = 0; frame < 60; frame++) {
    shelter.update(1 / 60, 1);
    for (let actor = 0; actor < 20; actor++) shelter.wanderGoal(0, 1);
  }
  expect(project.mock.calls.filter(([signal]) => signal === 'shelterStep')).toHaveLength(10);
  expect(project.mock.calls.filter(([signal]) => signal === 'shelterGoal').length).toBeLessThanOrEqual(11);
  const goal = shelter.wanderGoal(0, 1);
  expect(goal).toEqual({ x: 3.2, z: 0, r: look.spotR });
  if (goal !== null) goal.x = 999;
  expect(shelter.wanderGoal(0, 1)?.x).toBe(3.2);
});

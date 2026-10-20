import { expect, test } from 'vitest';
import { ArenaField } from '../src/game/boss/arenaField';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import fight from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };

test('the arena field obeys ignition bounds and cannot rekindle spent cells', () => {
  const field = new ArenaField(fight.TITAN_FIRE_FIELD, ReturnProgram.page(program.fire), new Rng(513));
  const { x, z } = fight.TITAN_ARENA.center;
  field.ignite(x, z);
  const cell = field.cellAt(x, z), lifetime = field.remaining(cell);
  expect(field.activeAt(x, z)).toBe(true);
  field.ignite(x, z); expect(field.remaining(cell)).toBe(lifetime);
  field.ignite(field.rows.x, field.rows.z); expect(field.mode(0)).toBe(0);
  field.update(.05, { wx: 0, wz: 0 }); expect(field.remaining(cell)).toBe(lifetime);
  field.update(.05, { wx: 0, wz: 0 }); expect(field.remaining(cell)).toBeCloseTo(lifetime - .1, 5);
  expect(field.extinguish()).toContain(cell);
  field.ignite(x, z); expect(field.activeAt(x, z)).toBe(false);
  field.clear(); field.ignite(x, z); expect(field.activeAt(x, z)).toBe(true);
});

test('an unrelated orchard encounter uses a rectangular four-neighbour frost field', () => {
  const field = new ArenaField({ x: 10, z: 20, width: 3, depth: 2, cell: 2,
    observations: { cx: 13, cz: 22, radius: 50, burn: .2 },
    neighbours: [[0,-1],[-1,0],[1,0],[0,1]],
    signals: { ignite: 'fieldIgnite', step: 'fire', clock: 'fieldClock' },
  }, ReturnProgram.page(program.fire), new Rng(714));
  expect(field.cellAt(9, 20)).toBe(-1); expect(field.cellAt(16, 20)).toBe(-1);
  field.ignite(11, 21); field.ignite(15, 23);
  expect(field.x(5)).toBe(15); expect(field.z(5)).toBe(23);
  const changed = field.update(.4, { wx: 1, wz: 0 });
  expect(changed).toEqual([0, 5]); expect(field.mode(0)).toBe(2); expect(field.mode(5)).toBe(2);
  expect(field.extinguish()).toEqual([]);
});

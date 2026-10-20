import { expect, test } from 'vitest';
import { ArenaEncounter, ArenaField,installArenaBoundary,arenaBoundaryBlocked } from '../src/game/boss/arenaField';
import { Scope } from '../src/engine/app/scope';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import fight from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };
import { TITAN_CLOCKS, TITAN_FIRE_FIELD } from '../src/shards/nalati-grasslands/generators/stormTitanFight';

test('mounted refusal borrows only its entered scope and releases on disposal', () => {
  const owner = new Scope('orchard-arena'),other = new Scope('outside');
  const field = new ArenaField(TITAN_FIRE_FIELD,ReturnProgram.page(program.fire),new Rng(714));
  const at = fight.TITAN_ARENA.center,row = { field,boundary: { x: at.x,z: at.z,radius: 20 },mask: 0 };
  try {
    installArenaBoundary(owner,row); field.ignite(at.x,at.z);
    expect(arenaBoundaryBlocked(owner,at.x,at.z)).toBe(false);
    row.mask = 2; expect(arenaBoundaryBlocked(owner,at.x,at.z)).toBe(true);
    expect(arenaBoundaryBlocked(other,at.x,at.z)).toBe(false);
    row.mask = 1; expect(arenaBoundaryBlocked(owner,at.x+25,at.z)).toBe(true);
    expect(() => installArenaBoundary(owner,row)).toThrow('Duplicate');
    owner.dispose(); expect(arenaBoundaryBlocked(owner,at.x+25,at.z)).toBe(false);
    expect(() => installArenaBoundary(owner,row)).toThrow('Invalid');
  } finally { owner.dispose(); other.dispose(); }
});

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

test('arena clocks own delayed tells once, pause RNG and reset pending strikes', () => {
  const rng = new Rng(513), host = new ArenaEncounter(TITAN_CLOCKS, ReturnProgram.page(program.attack), rng);
  host.clock('chain').set({ cd: 0 });
  const frame = { phase: 2, fighting: 1, px: 12, pz: -3 }, at = { x: 12, z: -3 };
  const before = rng.snapshot();
  expect(host.update(.05, frame, at).effects).toEqual([]);
  expect(rng.snapshot()).toEqual(before);
  const first = host.update(.05, frame, at);
  expect(first.effects.filter(row => row.values['landing'] === 1)).toHaveLength(1);
  expect(host.landings[0]?.value('x')).toBe(12);
  const paused = rng.snapshot(), tellT = host.landings[0]?.value('t');
  expect(host.update(1, { ...frame, fighting: 0 }, at).effects).toEqual([]);
  expect(host.landings[0]?.value('t')).toBe(tellT);
  expect(rng.snapshot()).toEqual(paused);
  let strikes = 0;
  for (let i = 0; i < 45; i++) for (const effect of host.update(.1, frame, at).effects)
    if (effect.values['landing'] === 1 && effect.values['strike'] === 1) strikes++;
  expect(strikes).toBe(7);
  host.reset();
  expect(host.landings.every(clock => clock.value('on') === 0)).toBe(true);
  expect(host.clock('spear').value('mode')).toBe(0);
});

test('an orchard frost boss binds different clock ids and two landing slots', () => {
  const rows = { ...TITAN_CLOCKS, schedules: TITAN_CLOCKS.schedules.map((row, i) => ({ ...row, id: i === 0 ? 'icicle' : 'hail' })),
    shared: { spearMode: { clock: 'icicle', slot: 'mode' }, chainLeft: { clock: 'hail', slot: 'chain' } },
    volley: { ...TITAN_CLOCKS.volley, launcher: 'hail', capacity: 2, trail: { capacity: 3, seconds: .2 } } };
  const host = new ArenaEncounter(rows, ReturnProgram.page(program.attack), new Rng(714));
  host.clock('hail').set({ cd: 0 });
  const effects = host.update(.1, { phase: 2, fighting: 1, px: -20, pz: 50 }, { x: -20, z: 50 }).effects;
  expect(effects.some(row => row.id === 'hail' && row.values['landing'] === 1)).toBe(true);
  expect(host.landings).toHaveLength(2);
  expect(host.landings[0]?.value('z')).toBe(50);
  expect(() => new ArenaEncounter({ ...rows, shared: {}, volley: { ...rows.volley, launcher: 'absent' } }, ReturnProgram.page(program.attack), new Rng(1))).toThrow('launcher');
});


test('field contact owns its footprint, cooldown and checkpoint reset', () => {
  const field = new ArenaField(TITAN_FIRE_FIELD, ReturnProgram.page(program.fire), new Rng(513));
  const { x, z } = fight.TITAN_ARENA.center;
  field.ignite(x, z);
  expect(field.sense(.05, { x, z }, { mounted: 1 })).toEqual({});
  const hit = field.sense(.05, { x, z }, { mounted: 1 });
  expect(hit['hurt']).toBe(4);
  expect(field.sense(.1, { x, z }, { mounted: 0 })['hurt']).toBe(0);
  const nearby = { x: x + 5, z };
  expect(field.activeAt(nearby.x, nearby.z)).toBe(false);
  expect(field.sense(.1, nearby, { mounted: 1 })['speed']).toBe(-1);
  expect(field.sense(.1, nearby, { mounted: 0 })['speed']).toBe(0);
  field.clear(); field.ignite(x, z);
  expect(field.sense(.1, { x, z }, { mounted: 0 })['hurt']).toBe(4);
});

test('the orchard field binds a different contact footprint and damage', () => {
  const field = new ArenaField({ x: 10, z: 20, width: 3, depth: 2, cell: 2,
    observations: { cx: 13, cz: 22, radius: 50, burn: 2 }, neighbours: [[0,1]],
    signals: { ignite: 'fieldIgnite', step: 'fire', clock: 'fieldClock' },
    contact: { law: { signal: 'fieldContact', initial: { cd: 0 }, parameters: { amount: 12 }, retain: { cd: 'cd' } }, samples: [{ x: 2, z: 0 }] },
  }, ReturnProgram.page(program.fire), new Rng(714));
  field.ignite(13, 21);
  expect(field.sense(.1, { x: 11, z: 21 }, { mounted: 1 })['speed']).toBe(-1);
  expect(field.sense(.1, { x: 13, z: 21 }, { mounted: 0 })['hurt']).toBe(6);
});

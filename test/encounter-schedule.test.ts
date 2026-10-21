import { expect, test } from 'vitest';
import { CoupledEncounter } from '../src/game/boss/encounterPatrol';
import { ProjectedState, ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import * as fight from '../src/shards/nalati-grasslands/generators/stormTitanFight';

const author = (): ReturnProgram => ReturnProgram.page(programs.attack);

test('the boss schedule retains committed target and emits a strike once', () => {
  const clock = new ProjectedState(fight.TITAN_SCHEDULES.spear, author()), random = new Rng(513);
  clock.set({ cd: 0 });
  clock.project({ dt: .1, phase: 0, px: 10, pz: 20, chain: 0 }, random);
  expect(clock.value('mode')).toBe(1);
  let hits = 0;
  for (let i = 0; i < 20; i++) hits += clock.project({ dt: .1, phase: 0, px: 10, pz: 20, chain: 0 }, random)['strike'] ?? 0;
  expect(hits).toBe(1); expect(clock.value('x')).toBe(10); expect(clock.value('z')).toBe(20);
  clock.reset(); expect(clock.value('mode')).toBe(0); expect(clock.value('cd')).toBe(2.5);
  expect(() => clock.set({ missing: 1 })).toThrow('projection state');
});

test('support death chips the boss once and commits only one surviving member', () => {
  const host = new CoupledEncounter(fight.TITAN_SUPPORT, author(), new Rng(513));
  host.add('one', { theta: 0 }); const two = host.add('two', { theta: 2 });
  const frame = { dt: 3, px: 10, pz: 20, hp: 1560, invuln: 0 };
  const result = host.update(frame, [{ id: 'one', x: 0, z: 0, alive: false }, { id: 'two', x: 2, z: 0, alive: true }]);
  expect(result.retired).toEqual(['one']); expect(result.state['hp']).toBe(1352); expect(two.state['mode']).toBe(2);
  const next = host.update({ ...frame, hp: result.state['hp'] ?? 0, dt: .1 }, [{ id: 'two', x: 2, z: 0, alive: true }]);
  expect(next.retired).toEqual([]); expect(next.state['hp']).toBe(1352);
  host.reset(); expect(host.members).toEqual([]);
});

test('an unrelated orchard boss uses its own support health share and opening timing', () => {
  const host = new CoupledEncounter({ ...fight.TITAN_SUPPORT, initial: { cd: 0 }, parameters: { chip: 12, lane: .2, flank: .4 } }, author(), new Rng(71));
  const member = host.add('sentry', { theta: 1 });
  const step = host.update({ dt: .1, px: 0, pz: 0, hp: 90, invuln: 0 }, [{ id: 'sentry', x: 10, z: 0, alive: true }]);
  expect(step.state['index']).toBe(0); expect(member.state['mode']).toBe(1);
  expect(host.damage(member, { x: 10, z: 0, px: 30, pz: 0, radius: 1 })).toBe(.5);
  const end = host.update({ dt: .1, px: 0, pz: 0, hp: 90, invuln: 0 }, [{ id: 'sentry', x: 10, z: 0, alive: false }]);
  expect(end.state['hp']).toBe(78); expect(end.state['broke']).toBe(1);
});

test('phase and arena rules are decided in the admitted module', () => {
  const rules = author();
  expect(rules.project('phaseEntry', { phase: 0 })).toMatchObject({ cd: 2, mask: 7, arm: 0, spread: 0 });
  expect(rules.project('phaseEntry', { phase: 1 })).toMatchObject({ cd: 2, mask: 3, arm: 1, spread: 0 });
  expect(rules.project('phaseEntry', { phase: 2 })).toMatchObject({ cd: 3, mask: 0, arm: 0, spread: 1 });
  const arena = { px: 0, pz: 0, cx: 0, cz: 0, radius: 68, tied: 1, mounted: 1, phase: 1, broke: 0, sealed: 1, fighting: 1 };
  expect(rules.project('arenaState', arena)).toEqual({ enter: 1, open: 1, mask: 1 });
  expect(rules.project('arenaState', { ...arena, mounted: 0, phase: 2 })).toEqual({ enter: 0, open: 0, mask: 3 });
  expect(rules.project('tie', { engaged: 0, victory: 0, hit: 0, mounted: 0, storm: 1 })).toEqual({ arm: 0, disarm: 0, index: 0 });
  expect(rules.project('tie', { engaged: 0, victory: 1, hit: 0, mounted: 1, storm: 1 })).toEqual({ arm: 1, disarm: 1, index: 2 });
});

test('mounted field refusal consumes numeric samples in AS without a second page rule', () => {
  const schedule = new ProjectedState(fight.TITAN_SCHEDULES.contact, author());
  const samples = [{ hit: 0 }, { hit: 1 }];
  expect(schedule.project({ dt: .1, mounted: 1, hit: 0, count: samples.length }, undefined, samples)).toMatchObject({ hurt: 0, speed: -1 });
  expect(schedule.project({ dt: .1, mounted: 0, hit: 0, count: samples.length }, undefined, samples)).toMatchObject({ hurt: 0, speed: 0 });
});

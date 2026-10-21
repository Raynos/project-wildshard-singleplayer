import { expect, test } from 'vitest';
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
  const schedule = new ProjectedState(fight.TITAN_SCHEDULES.contact, ReturnProgram.page(programs.fire));
  const samples = [{ hit: 0 }, { hit: 1 }];
  expect(schedule.project({ dt: .1, mounted: 1, hit: 0, count: samples.length }, undefined, samples)).toMatchObject({ hurt: 0, speed: -1 });
  expect(schedule.project({ dt: .1, mounted: 0, hit: 0, count: samples.length }, undefined, samples)).toMatchObject({ hurt: 0, speed: 0 });
});

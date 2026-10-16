import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { createMemoryActionBrain, type MemoryActionRows } from '../src/game/plugin/brain';
import { MONKEY_ACTIONS } from '../src/shards/driftwood-isle/data/speciesActions';
import { biteMonkey, throwMonkeyCoconut, type MonkeyStrikePorts } from '../src/shards/driftwood-isle/species/monkeyPolicy';

function actor(): AnimalSim {
  return new AnimalSim({ kind: 'hunter', label: 'Hunter', variant: 'common', rarity: 'common', hp: 30, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
  1, 1, 'hunter', { heightAt: () => 0, random: () => .5 });
}
const rows: MemoryActionRows = { stateKey: 'st', states: ['idle', 'attack'],
  actions: [{ state: 1, phase: .5, effect: 'hit', once: { key: 'hit', value: 1, test: 'falsy' } }] };

test('act-before-think stays quiet and a miss claims the actor field before its borrowed effect', () => {
  const a = actor(), seen: number[] = []; let decisions = 0;
  const brain = createMemoryActionBrain(a, rows, { decide: () => { decisions++; },
    effects: new Map([['hit', (body: AnimalSim) => { seen.push(body.mem['hit'] ?? 0); }]]) });
  brain.act(undefined); expect(seen).toEqual([]); expect(decisions).toBe(0);
  a.mem['st'] = 1; a.mem['hit'] = 0; a.startAttack(1); a.step(.6);
  const before = a.snapshot(); brain.act(undefined); expect(seen).toEqual([1]);
  brain.act(undefined); expect(seen).toEqual([1]);
  a.restore(before); brain.act(undefined); expect(seen).toEqual([1, 1]);
  brain.think(undefined); expect(decisions).toBeGreaterThan(0); expect(brain.state).toBe('attack');
});

test('monkey rows select one existing bite or coconut owner and retain restored attack memory', () => {
  const a = actor(), effects: string[] = [], target = new Vector3(0, 0, 1);
  const context: MonkeyStrikePorts<AnimalSim> = { player: target, reach: () => true,
    hurt: damage => { if (damage > 0) effects.push('hurt'); }, sound: name => { effects.push(name); },
    world: { throwCoconut: (from, to, thrower) => {
      expect(thrower).toBe(a); expect(from.y).toBeCloseTo(a.position.y + .95 * a.scale);
      expect(to.y).toBeCloseTo(target.y + .9); effects.push('throw');
    } } };
  const brain = createMemoryActionBrain<AnimalSim, MonkeyStrikePorts<AnimalSim>>(a, MONKEY_ACTIONS,
    { decide: () => undefined, effects: new Map([['bite', biteMonkey], ['throw', throwMonkeyCoconut]]) });
  a.mem['st'] = 2; a.mem['hit'] = 0; a.mem['bite'] = 0; a.startAttack(1); a.step(.7);
  const before = a.snapshot(); brain.act(context); brain.act(context); expect(effects).toEqual(['throw']);
  a.restore(before); brain.act(context); expect(effects).toEqual(['throw', 'throw']);
  effects.length = 0; a.mem['hit'] = 0; a.mem['bite'] = 1; a.startAttack(1); a.step(.5);
  brain.act(context); brain.act(context); expect(effects).toEqual(['hurt', 'monkey_shriek']);
});

test('preflights every action and refuses unsafe fields before registration or effects', () => {
  const a = actor(), original = { ...a.mem }, effects = new Map<string, (body: AnimalSim) => void>();
  expect(() => createMemoryActionBrain(a, rows, { decide: () => undefined, effects })).toThrow('unbound');
  effects.set('hit', () => undefined);
  expect(() => createMemoryActionBrain(a, { ...rows, stateKey: '__proto__' }, { decide: () => undefined, effects })).toThrow('states');
  const action = rows.actions[0]; if (action === undefined) throw new Error('Missing test action');
  expect(() => createMemoryActionBrain(a, { ...rows, actions: [{ ...action, phase: -1 }] }, { decide: () => undefined, effects })).toThrow('action');
  expect(a.mem).toEqual(original);
});

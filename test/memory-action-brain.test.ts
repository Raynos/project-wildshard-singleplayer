import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { createMemoryActionBrain, type MemoryActionRows } from '../src/game/plugin/brain';
import authoredSpeciesActions from '../src/shards/driftwood-isle/data/speciesActions.json' with { type: 'json' };
import { biteMonkey, throwMonkeyCoconut, type MonkeyStrikePorts } from '../src/shards/driftwood-isle/species/monkeyPolicy';
import { stepCreatureLift } from '@wildshard/game/plugin/animation';
import { Rng } from '../src/engine/core/rng';
import { DRIFTWOOD_STRIKES } from './fixtures/species/driftwood';

const { MONKEY_ACTIONS } = authoredSpeciesActions;

const CAPTAIN_ACTIONS = { stateKey:'st',states:['hide','rise','fight','attack','sink','under'],cadence:'decision',
  actions:[{state:3,phase:0,effect:'swing',once:{key:'hit',value:1,test:'falsy'}}] } as const;

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
    hurt: (damage:number) => { if (damage > 0) effects.push('hurt'); }, sound: (name:string) => { effects.push(name); },
    world: { throwCoconut: (from, to, thrower) => {
      expect(thrower).toBe(a); expect(from.y).toBeCloseTo(a.position.y + .95 * a.scale);
      expect(to.y).toBeCloseTo(target.y + .9); effects.push('throw');
    } } };
  const brain = createMemoryActionBrain<AnimalSim, MonkeyStrikePorts<AnimalSim>>(a, MONKEY_ACTIONS,
    { decide: () => undefined, effects: new Map([['bite', (body: AnimalSim, ports: MonkeyStrikePorts<AnimalSim>) => { biteMonkey(body, ports, DRIFTWOOD_STRIKES.bite); }], ['throw', throwMonkeyCoconut]]) });
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

function captain() {
  const a = actor(), effects: string[] = [];
  Object.assign(a.mem, { init: 1, st: 3, cd: 0, hitT: 0, hit: 0, combo: 0, rise: .2, rising: 1, sinking: 0, subT: 0,
    poolX: 0, poolZ: 0, arena: 22, awake: 1, phase: 1 });
  const ports = { dt: .1, calm: false, player: new Vector3(0, 0, 1), rng: new Rng(357), world: {},
    sound: (name:string) => { effects.push(name); }, heightAt: () => 0, claim: () => true, mayAttack: () => true,
    reach: () => true, hurt: (damage:number) => { if (damage > 0) effects.push('hurt'); } };
  a.startAttack(1); a.step(.8);
  return { a, ports, effects, brain:createMemoryActionBrain<AnimalSim,typeof ports>(a,CAPTAIN_ACTIONS,{decide:()=>undefined,
    beforeAct:(body,c)=>{stepCreatureLift(body,c.dt,1.1,.9,-2.8);},threshold:body=>{const windup=body.hp/body.maxHp>.66?.7:body.hp/body.maxHp>.33?.62:.5;return windup/(windup+.35)+.04;},
    effects:new Map([['swing',()=>{if(ports.player.distanceTo(a.position)<2.5){ports.hurt(24);ports.sound('sailor_slash');}}]])}) };
}

test('a decision-latched strike advances rise on every body step and resumes the old boolean continuation', () => {
  const { a, ports, effects, brain } = captain(), startRise = a.mem['rise'] ?? 0;
  brain.act(ports); expect(effects).toEqual([]); expect(a.mem['rise']).toBeGreaterThan(startRise);
  brain.think(ports); const saved = a.snapshot(), pending = brain.snapshot(); expect(pending).toBe(true);
  brain.act(ports); expect(effects).toEqual(['hurt', 'sailor_slash']); expect(brain.snapshot()).toBe(false);
  effects.length = 0; a.mem['hit'] = 0;
  brain.act(ports); expect(effects).toEqual([]);
  a.restore(saved); brain.restore(pending); brain.act(ports); expect(effects).toEqual(['hurt', 'sailor_slash']);
  brain.restore(true); expect(() => brain.restore('true')).toThrow('continuation'); expect(brain.snapshot()).toBe(true);
});

test('latched misses stay spent and the strike reads current hp and combo at the body step', () => {
  const { a, ports, effects, brain } = captain();
  ports.player.set(0, 0, 100); brain.think(ports); brain.act(ports);
  expect(a.mem['hit']).toBe(1); expect(effects).toEqual([]);
  ports.player.set(0, 0, 1); brain.think(ports); brain.act(ports); expect(effects).toEqual([]);
  a.mem['hit'] = 0; a.mem['combo'] = 1; a.startAttack(1); a.step(.67);
  brain.think(ports); a.hp = a.maxHp * .2;
  brain.act(ports); expect(effects).toEqual(['hurt', 'sailor_slash']);
});

test('invalid cadence and dynamic thresholds refuse without claiming an action field', () => {
  const a = actor(), effects = new Map([['hit', () => undefined]]);
  a.mem['st'] = 1; a.startAttack(1); a.step(.6);
  const brain = createMemoryActionBrain(a, rows, { decide: () => undefined, effects, threshold: () => Number.NaN });
  expect(() => brain.act(undefined)).toThrow('threshold'); expect(a.mem['hit']).toBeUndefined();
  const malformed = { ...rows }; Reflect.set(malformed, 'cadence', 'bad');
  expect(() => createMemoryActionBrain(a, malformed, { decide: () => undefined, effects })).toThrow('states');
});

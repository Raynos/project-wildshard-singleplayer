import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { AnimalSim, type AnimalSimSpec } from '../../../src/engine/entities/AnimalSim';
import { Rng } from '../../../src/engine/core/rng';
import { CaptainBrain, UNDER, type CaptainPorts } from '../../../src/shards/driftwood-isle/species/captainPolicy';

// a renderer-free body (no view, no rig animate): the captain's dims at his 1.35 scale are not what this test reads
const SPEC: AnimalSimSpec = { kind: 'captain', label: 'The Drowned Captain', variant: 'captain', rarity: 'uncommon', hp: 320, aggressive: true, lockable: true,
  dims: { bodyY: 1, bodyHalfLen: 0.2, bodyRadius: 0.25, headRadius: 0.14, legLen: 0.9, feet: [[0.12, 0], [-0.12, 0]], halfWidth: 0.25 },
  mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false } };

it('rises out of the pool and sinks back under it on the body step, with no view (SF72: the clock used to run in the rig\'s animate)', () => {
  const a = new AnimalSim(SPEC, 7, 1.35, 'creature:40', { heightAt: () => 0, random: () => 0.5 });
  a.place(0, 0, 0, 0);
  const brain = new CaptainBrain(a), hits: number[] = [];
  const base: Omit<CaptainPorts<AnimalSim>, 'dt'> = { calm: false, rng: new Rng(3), player: new Vector3(0, 0, 12), world: {}, heightAt: () => 0,
    sound: () => undefined, reach: () => true, hurt: (damage) => { hits.push(damage); }, claim: () => true, mayAttack: () => true };
  const frame = (tick: number): void => {
    if (tick % 6 === 0) brain.think({ ...base, dt: 0.1 });
    brain.act({ ...base, dt: 1 / 60 }); a.step(1 / 60);
  };
  for (let tick = 0; tick < 60; tick++) frame(tick);
  // asleep under the pool until woken
  expect([a.state, a.yOffset, a.position.y]).toEqual(['hide', UNDER, UNDER]);
  a.mem['awake'] = 1;
  let risen = -1;
  for (let tick = 60; tick < 300 && risen < 0; tick++) { frame(tick); if (a.state === 'stalk') risen = tick; }
  // 1.1 s of rise (66 body steps) after the waking decision, then he fights, feet on the pool floor
  expect(risen).toBeGreaterThan(60 + 66); expect(risen).toBeLessThan(60 + 66 + 13);
  expect([a.mem['rise'], a.mem['rising'], a.yOffset]).toEqual([1, 0, 0]);
  // phase II: every ~7 s he sinks (0.9 s) and comes up beside the player in a burst
  a.hp = a.maxHp * 0.5;
  const states = new Set<string>();
  for (let tick = 300; tick < 1200; tick++) { frame(tick); states.add(String(a.mem['st'])); }
  expect([...states].sort()).toEqual(expect.arrayContaining(['1', '2', '4', '5']));
  expect(brain.snapshot()).toBeTypeOf('boolean');
});

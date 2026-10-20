import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { groupSpecies } from '../src/game/population/groupSpecies';
import { legacyDouble } from './fake/FakeGame';

test('marsh herd rows own held memory, damage and bounded group cadence', () => {
  const control = { kind: 'herd', clock: 'marsh.groupClock', every: .2, confine: false, observeDamage: false, held: ['tethered'], damage: 'marsh.armour' };
  const binding = groupSpecies(control), motions: number[][] = [];
  const actor = legacyDouble<Animal>({ mem: { tethered: 1, 'marsh.armour': .4 }, alive: true, yaw: .7,
    setMotion: (yaw: number, speed: number, turn?: number) => { motions.push([yaw, speed, turn ?? 1]); } });
  const frame = legacyDouble<ThinkCtx>({ dt: .02, t: 1 });
  binding.think?.(actor, frame); expect(actor.mem['marsh.groupClock']).toBe(1); expect(motions).toEqual([]);
  actor.mem['tethered'] = 0; frame.t = 1.1; binding.think?.(actor, frame); expect(motions).toEqual([]);
  frame.t = 1.2; binding.think?.(actor, frame); expect(motions).toEqual([[.7, 0, 1]]);
  expect(binding.damageMul?.(actor, new Vector3(), new Vector3())).toBe(.4);
  expect(() => groupSpecies({ ...control, every: .05 })).toThrow();
});

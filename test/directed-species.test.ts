import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { DirectedSpecies } from '../src/game/population/directedSpecies';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';
import { riderGeometry } from '../src/shards/nalati-grasslands/generators/ghostFigure';
import { bakedActorGeometry } from '../src/shards/nalati-grasslands/world/places';

test('a marsh courier projects its own target memory, cadence and hit rules through the existing guest', () => {
  const row = { signal: 'steer', clock: 'courier.clock', every: .1, target: ['guide.x', 'guide.z'], motion: ['guide.speed', 'guide.turn'],
    speed: 3, turn: 1.8, threshold: 5, stopDistance: 1.2, look: .4, states: ['wander', 'flee'],
    damage: { signal: 'riderDamage', player: ['eye.x', 'eye.z'], radius: 2, scale: 1.4, coupled: false, elite: false } };
  const binding = new DirectedSpecies(row, admission).binding, motions: number[][] = [];
  const actor = legacyDouble<Animal>({ position: new Vector3(4, 0, 8), yaw: .3, state: 'idle',
    mem: { 'guide.x': 7, 'guide.z': 12, 'guide.speed': 6, 'eye.x': 0, 'eye.z': 0 }, lookTarget: new Vector3(), lookWeight: 0,
    setMotion: (yaw: number, speed: number, turn?: number) => { motions.push([yaw, speed, turn ?? 1]); } });
  const frame = legacyDouble<ThinkCtx>({ dt: .1, t: 0, player: new Vector3(1, 2, 3) });
  binding.think?.(actor, frame); expect(actor.state).toBe('flee'); expect(actor.lookWeight).toBe(.4);
  expect(motions[0]?.[0]).toBeCloseTo(Math.atan2(3, 4), 1); expect(motions[0]?.slice(1)).toEqual([6, 1.8]);
  frame.t = .05; binding.think?.(actor, frame); expect(motions).toHaveLength(1);
  delete actor.mem['guide.x']; frame.t = .1; binding.think?.(actor, frame); expect(motions[1]).toEqual([.3, 0, 1]); expect(actor.state).toBe('flee');
  expect(binding.damageMul?.(actor, new Vector3(1, 0, 0), new Vector3())).toBe(1.4);
  expect(binding.damageMul?.(actor, new Vector3(2, 0, 0), new Vector3())).toBe(1);
  expect(() => new DirectedSpecies({ ...row, every: .05 }, admission)).toThrow();
});

test('both spectral figure bakes retain every authored vertex and normal', () => {
  for (const captain of [false, true]) {
    const source = riderGeometry(captain), baked = bakedActorGeometry(captain ? 'ghost-captain' : 'ghost-rider');
    try {
      expect(baked.getAttribute('position').array).toEqual(source.getAttribute('position').array);
      expect(baked.getAttribute('normal').array).toEqual(source.getAttribute('normal').array);
    } finally { source.dispose(); baked.dispose(); }
  }
});

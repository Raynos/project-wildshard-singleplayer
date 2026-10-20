import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { FlockBrain } from '../src/engine/ai/flock';
import { CrowdRoster, CrowdTargets } from '../src/game/shardfile/crowdRuntime';

test('an orchard deer crowd supplies prey and authored hit spheres without a renderer', () => {
  const brain = new FlockBrain({ heightAt: () => 0, normalY: () => 1, inBounds: () => true, wetAt: () => false,
    playerCrouched: () => false, grassHeightAt: () => .2, trample: () => undefined, centre: () => undefined },
  { x: 20, z: -30, count: 3, seed: 9, range: 25, runSpeed: 6, walkSpeed: 1.2, grazeStep: .3, bleatCue: 'deer.call' });
  brain.initialize();
  const targets = new CrowdTargets(brain, { preyY: 1.4, hits: [[0, 1.4, .65]] });
  const crowds = [targets], roster = new CrowdRoster([], crowds, 'orchard');
  const prey = targets.prey(0), point = prey.position.clone();
  expect(targets.raycast(point.clone().add(new Vector3(0, 0, -2)), new Vector3(0, 0, 1), 4)).toBeGreaterThanOrEqual(0);
  expect(targets.raycast(point, new Vector3(0, 0, 1), 1)).toBeGreaterThanOrEqual(0);
  expect(targets.positions(0, new Vector3()).y).toBeCloseTo(1.4);
  const identity = roster.identity(prey); expect(identity).toBe('orchard:0:0');
  expect(roster.resolve(identity)).toBe(prey);
  expect(roster.resolve('orchard:1:0')).toBeNull(); expect(roster.resolve('orchard:0:3')).toBeNull();
  expect(new CrowdRoster([], crowds, 'orchard').resolve(identity)?.position).toEqual(prey.position);
  expect(roster.raycast(point.clone().add(new Vector3(0, 0, -2)), new Vector3(0, 0, 1), 4)?.flock).toBe(targets);
  const saved = brain.snapshot();
  prey.applyDamage(); expect(prey.alive).toBe(false); expect(targets.alive).toBe(2);
  brain.restore(saved); expect(prey.alive).toBe(true); expect(targets.alive).toBe(3);
  expect(() => targets.prey(3)).toThrow('Unknown crowd member');
  expect(() => new CrowdTargets(brain, { preyY: 1, hits: [[0, 1, -1]] })).toThrow('Invalid crowd target');
});

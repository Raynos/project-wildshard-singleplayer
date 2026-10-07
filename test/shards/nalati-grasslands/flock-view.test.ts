import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { FlockBrain } from '../../../src/engine/ai/flock';
import { Rng } from '../../../src/engine/core/rng';
import { Flock } from '../../../src/shards/nalati-grasslands/creatures/flock';
import { wildEnv } from '../../../src/shards/nalati-grasslands/creatures/env';
import { fakeWorld } from '../../fake/world';

import * as modelLook from '../../../src/shards/nalati-grasslands/world/glbPaint';

// Exercise the native loading fallback synchronously without a retired production Settings variant.
beforeEach(() => { vi.spyOn(modelLook, 'modelsOn').mockReturnValue(false); });
afterEach(() => { vi.restoreAllMocks(); });
const undoTerrain = overrideTerrain({ heightAt: (x, z) => Math.sin(x * 0.02) + Math.cos(z * 0.03), normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(undoTerrain);
const options = { x: 0, z: 0, count: 8, seed: 357, range: 32 };
function fixture(): { view: Flock; policy: FlockBrain; shipping: Flock } {
  const world = fakeWorld(), policy = new FlockBrain({ heightAt: (x, z) => Math.sin(x * 0.02) + Math.cos(z * 0.03),
    normalY: () => 1, wetAt: (x, z) => wildEnv.wetAt?.(x, z) ?? false,
    inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin,
    playerCrouched: () => wildEnv.playerCrouched, grassHeightAt: (x, z) => wildEnv.grassHeightAt(x, z),
    trample: (...args) => { wildEnv.trample(...args); }, centre: () => undefined },
  { ...options, runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' });
  policy.initialize();
  const draws = vi.spyOn(Rng.prototype, 'next'), view = new Flock(world.sky, options, policy).build();
  expect(draws).not.toHaveBeenCalled(); draws.mockRestore();
  return { view, policy, shipping: new Flock(world.sky, options).build() };
}
function pose(view: Flock): object {
  const time: unknown = Reflect.get(view, 'uTime');
  return { matrix: [...view.mesh.instanceMatrix.array], color: [...(view.mesh.instanceColor?.array ?? [])],
    anim: [...view.mesh.geometry.getAttribute('iAnim').array], centre: [view.cx, view.cz], alive: view.alive,
    time };
}
describe('Nalati declared native flock view', () => {
  it.each([30, 60])('retains shipping matrix, wool, shader inputs and prey queries for 10k frames at %i Hz', hz => {
    const { view, shipping, policy } = fixture(), player = new Vector3(), offSounds: string[] = [], onSounds: string[] = [];
    shipping.onSound = cue => { offSounds.push(cue); }; view.onSound = cue => { onSounds.push(cue); };
    policy.onSound = (cue, x, z) => { view.onSound?.(cue, x, z); };
    expect(pose(view)).toEqual(pose(shipping));
    for (let frame = 0; frame < 10000; frame++) {
      const distance = frame % 3000 < 800 ? 35 : frame % 3000 < 1600 ? 90 : 300;
      player.set(policy.cx + distance, 0, policy.cz);
      if (frame % 1500 === 0) { shipping.scare(-20, 0, 5); view.scare(-20, 0, 5); }
      if (frame === 401 || frame === 6000) { shipping.kill(2); view.kill(2); }
      shipping.update(1 / hz, frame / hz, player, frame < 5000 ? 0 : 6, []);
      const moved = policy.update(1 / hz, frame / hz, player, frame < 5000 ? 0 : 6, []);
      view.project(moved ? frame / hz : undefined);
      expect(pose(view)).toEqual(pose(shipping));
      expect(view.straggler()).toBe(shipping.straggler()); expect(view.panicking).toBe(shipping.panicking);
      expect(view.nearest(0, 0)).toBe(shipping.nearest(0, 0));
      expect(view.prey(2).alive).toBe(shipping.prey(2).alive); expect(view.prey(2).position).toEqual(shipping.prey(2).position);
      expect(view.raycast(new Vector3(0, 1, 0), new Vector3(0, 0, 1), 100)).toBe(shipping.raycast(new Vector3(0, 1, 0), new Vector3(0, 0, 1), 100));
    }
    expect(onSounds).toEqual(offSounds);
    expect(() => view.update(1 / hz, 0, player, 0, [])).toThrow('owning frame');
  });
});

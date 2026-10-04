import { afterAll, expect, it } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { creature } from '../fake/creature';

const restore = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restore);
it('a shipping ground monkey bites then rests without returning to an absent perch', () => {
  const f = creature('monkey', 'monkey'); f.advance(240);
  expect(f.hits.length).toBeGreaterThan(0);
  f.ctx.player.z = 50; f.advance(1000);
  expect(f.animal.mem['perch']).toBe(-1);
  expect(f.animal.state).toBe('idle');
  expect([...f.animal.position, f.animal.yaw, f.animal.desiredYaw].every(Number.isFinite)).toBe(true);
});

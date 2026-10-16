import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { stepRainFall } from '../src/game/systems/looks/rainCurtain';

describe('stepRainFall', () => {
  it('slants the fall by the wind, wraps the offset into the box and counts the streaks drawn', () => {
    const fall = { offset: new THREE.Vector3(), velocity: new THREE.Vector3() }, row = { count: 100, speed: 9.5, slant: 0.3, radius: 11 };
    const drawn = stepRainFall(fall, row, 1, { x: 10, z: -10 }, 0.5);
    expect(fall.velocity.toArray()).toEqual([3, -9.5, -3]);
    expect(fall.offset.x).toBeCloseTo(3);
    expect(fall.offset.y).toBeCloseTo(22 - 9.5);
    expect(fall.offset.z).toBeCloseTo(22 - 3);
    // The shipped ceil law keeps the extra streak at this floating-point boundary.
    expect(drawn).toBe(56 * 6);
    expect(stepRainFall(fall, row, 0, { x: 0, z: 0 }, 1)).toBe(600);
  });
});

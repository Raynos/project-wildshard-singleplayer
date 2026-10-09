import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LASH_BODY, LASH_CHEST, lashContact, lashLane, lashVolumeHit } from '../../../src/shards/sunscar-dunes/weapons/lash';

/** The grounded Matriarch at 3.6x (bodyY 0.3, half-length 1.1, radius 0.8, head 0.4), facing +z (the player at the origin). */
function matriarch(at: Vector3) {
  const s = 3.6, cy = at.y + 0.3 * s;
  return { head: new Vector3(at.x, cy, at.z + 1.1 * s), headRadius: 0.4 * s, a: new Vector3(at.x, cy, at.z - 1.1 * s), b: new Vector3(at.x, cy, at.z + 1.1 * s), bodyRadius: 0.8 * s };
}
describe('the lash contact rule shared by the browser and headless whips', () => {
  const eye = new Vector3(0, 1.68, 0), feet = new Vector3(0, 0.2, -9);
  it('lands on her skin, not her centre: grounded 9 m off, the 7 m lash reaches her head ball', () => {
    const body = matriarch(feet), centre = new Vector3(0, feet.y + 1.08, -9), dir = centre.clone().sub(eye).normalize();
    // she faces the player: her head ball's near surface is 9 - 3.96 - 1.44 m along the ground
    const along = lashVolumeHit(eye, dir, 7, body);
    expect(along).not.toBeNull(); expect(along ?? Infinity).toBeLessThan(4.5);
    expect(centre.distanceTo(eye)).toBeGreaterThan(7); // the old centre test refused this crack
  });
  it('misses a body wholly past the reach, and answers 0 from inside a volume', () => {
    const far = matriarch(new Vector3(0, 0.2, -30)), dir = new Vector3(0, 0, -1);
    expect(lashVolumeHit(eye, dir, 7, far)).toBeNull();
    const over = matriarch(new Vector3(0, 0, 0));
    expect(lashVolumeHit(new Vector3(0, 1.08, 0), dir, 7, over)).toBe(0);
  });
  it('keeps the browser lane exactly: chest over the feet, reach and width widened by the body allowance', () => {
    const dir = new Vector3(0, 0, -1);
    const inLane = (target: Vector3): number | null => lashLane(eye, dir, 7, 0.9, target);
    expect(LASH_CHEST).toBe(0.9); expect(LASH_BODY).toBe(0.7);
    expect(inLane(new Vector3(0, 0.78, -7.6))).toBeCloseTo(7.6);
    expect(inLane(new Vector3(0, 0.78, -7.8))).toBeNull();
    expect(inLane(new Vector3(1.55, 0.78, -3))).toBeCloseTo(3);
    expect(inLane(new Vector3(1.65, 0.78, -3))).toBeNull();
    expect(inLane(new Vector3(0, 0.78, 1))).toBeNull();
    // with no volume in reach the lash lands at min(forward, reach)
    const tiny = { head: new Vector3(0, 99, 0), headRadius: 0.01, a: new Vector3(0, 99, 0), b: new Vector3(0, 99, 0.1), bodyRadius: 0.01 };
    expect(lashContact(eye, dir, 7, 0.9, tiny, new Vector3(0, 0.78, -7.6))).toBe(7);
  });
});

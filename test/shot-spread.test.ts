import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { drawnSpreadDegrees, instantSpreadDegrees, shotSpread } from '../src/engine/combat/shotSpread';

// Frozen shipping cone oracle: combat/view/bow.ts, hitscan.ts and the crossbow's axisScale=2.
function shippingCone(direction: Vector3, radians: number, draws: readonly number[], scale: 1 | 2, sqrt: boolean): Vector3 {
  const [x, y, z, radius] = draws;
  if (x === undefined || y === undefined || z === undefined || radius === undefined) throw new Error('Incomplete oracle draws');
  const axis = new Vector3().set((x - 0.5) * scale, (y - 0.5) * scale, (z - 0.5) * scale).cross(direction).normalize();
  return direction.addScaledVector(axis, Math.tan(radians * (sqrt ? Math.sqrt(radius) : radius))).normalize();
}

describe('renderer-free authored shot cones', () => {
  it('preserves all four draws and the shipping vector arithmetic for both radial laws and axis scales', () => {
    for (const radius of ['linear', 'sqrt'] as const) for (const axisScale of [1, 2] as const) {
      for (let sample = 0; sample < 256; sample++) {
        const draws = [sample / 255, ((sample * 7) % 256) / 255, ((sample * 13) % 256) / 255, ((sample * 31) % 256) / 255];
        let read = 0;
        const random = (): number => { const value = draws[read++]; if (value === undefined) throw new Error('Extra gameplay draw'); return value; };
        const initial = new Vector3(Math.sin(sample), 0.3, Math.cos(sample)).normalize();
        const radians = sample % 8 === 0 ? 0 : sample / 100;
        const expected = shippingCone(initial.clone(), radians, draws, axisScale, radius === 'sqrt');
        const got = initial.clone(); shotSpread(got, radians, random, { radius, axisScale }, new Vector3());
        expect(got.toArray()).toEqual(expected.toArray()); expect(read).toBe(4);
      }
    }
  });

  it('preserves moving, aiming, bloom and mounted widths without reading a player or a view', () => {
    for (const aim of [0, 0.1, 0.5, 0.9, 1]) for (const speed of [0, 0.01, 0.5, 1, 1.5]) {
      expect(drawnSpreadDegrees(0.3, 0.15, aim, 0.6, speed, 0.4, 0.7))
        .toBe(0.3 * (1 - (1 - 0.15) * aim) + 0.6 * speed + 0.4 + 0.7);
      expect(instantSpreadDegrees(0.06, 0.9, aim, 0.4, speed, 0.75, 0.8))
        .toBe(0.06 + (1 - aim) * 0.9 + 0.4 * (1 - aim * 0.7) + speed * 0.75 * (1 - aim * 0.8));
    }
  });
});

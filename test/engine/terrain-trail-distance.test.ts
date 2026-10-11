import { describe, expect, it, vi } from 'vitest';
import { buildTerrain } from '../../src/engine/world/terrainField';
import { clamp } from '../../src/engine/core/noise';
import { Rng } from '../../src/engine/core/rng';
import type { Vec2 } from '../../src/engine/level/data';

// Shipping scan before travel profiling: no tolerance, rounding or changed segment projection.
function original(trails: Vec2[][], px: number, pz: number): number {
  let distance = Infinity;
  for (const poly of trails) for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1]; if (a === undefined || b === undefined) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], wx = px - a[0], wz = pz - a[1], l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
    const dx = px - (a[0] + vx * t), dz = pz - (a[1] + vz * t);
    distance = Math.min(distance, Math.sqrt(dx * dx + dz * dz));
  }
  return distance;
}
const field = (trails: Vec2[][]) => buildTerrain(917, { landscape: () => 0, trails, cabinSites: [] });

describe('terrain trail projection after the travel CPU profile', () => {
  it('matches every shipping distance bit with crossing, degenerate, nearly coincident and mutable paths', () => {
    const rng = new Rng(813), trails: Vec2[][] = [[], [[0, 0]], [[0, 0], [0, 0]], [[-250, 0], [250, 0]], [[0, -250], [0, 250]]];
    for (let n = 0; n < 9; n++) trails.push(Array.from({ length: 13 }, (): Vec2 => [rng.range(-250, 250), rng.range(-250, 250)]));
    const terrain = field(trails);
    for (let n = 0; n < 10000; n++) {
      const x = rng.range(-300, 300), z = rng.range(-300, 300);
      expect(Object.is(terrain.trailDistance(x, z), original(trails, x, z))).toBe(true);
    }
    trails.push([[1, 1], [1 + Number.EPSILON, 1], [2, 2]]);
    const samples: readonly Vec2[] = [[1, 1], [1, 1 + Number.EPSILON], [-0, 0], [1e150, 1e150], [Infinity, 0], [Number.NaN, 0]];
    for (const [x, z] of samples) {
      expect(Object.is(terrain.trailDistance(x, z), original(trails, x, z))).toBe(true);
    }
    expect(field([]).trailDistance(0, 0)).toBe(Infinity);
  });
  it('does not spend a square root on each rejected segment in a mesh field query', () => {
    const trails: Vec2[][] = [Array.from({ length: 101 }, (_, i): Vec2 => [i, Math.sin(i)])], terrain = field(trails);
    const expected = original(trails, 51.1, 0.8), roots = vi.spyOn(Math, 'sqrt');
    try { expect(terrain.trailDistance(51.1, 0.8)).toBe(expected); expect(roots).toHaveBeenCalledOnce(); }
    finally { roots.mockRestore(); }
  });
});

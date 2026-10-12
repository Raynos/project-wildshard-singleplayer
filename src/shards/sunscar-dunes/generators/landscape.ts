import { CHUNK_HALF } from '@wildshard/format/contentBounds';
import { SEED, TRAIL } from '../data/layout';
import { duneField } from './duneField';
import { DUNE_FIELD } from '../data/duneField';
import { signalNoise } from './landscapeNoise';

// Retained authored entry grading: 15 m road, reaching 60 m into the cell.
const ROAD_WIDTH = 15, ROAD_LENGTH = 60;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function signalTrailDistance(x: number, z: number): number {
  let distance = Infinity;
  for (const poly of TRAIL) for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    if (a === undefined || b === undefined) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], wx = x - a[0], wz = z - a[1];
    const length = vx * vx + vz * vz;
    const t = length > 0 ? Math.min(1, Math.max(0, (wx * vx + wz * vz) / length)) : 0;
    const dx = x - (a[0] + vx * t), dz = z - (a[1] + vz * t);
    distance = Math.min(distance, dx * dx + dz * dz);
  }
  return Math.sqrt(distance);
}

/** The retained Signal author height law: crescent dunes, trail bed, flat roads and entry ramps.
 * No runtime field, registry, render service or captured height grid is read. */
export function signalHeightAt(seed = SEED): (x: number, z: number) => number {
  const noise = { n: signalNoise(seed) }, landscape = duneField(DUNE_FIELD);
  return (x, z) => {
    let height = landscape(x, z, noise);
    height -= smoothstep(9, 2.5, signalTrailDistance(x, z)) * 0.35;
    const half = ROAD_WIDTH / 2 + 3;
    const along = (a: number, b: number): number => smoothstep(half + 22, half, Math.abs(a))
      * smoothstep(CHUNK_HALF - ROAD_LENGTH - 25, CHUNK_HALF - ROAD_LENGTH + 5, Math.abs(b));
    const road = Math.max(along(x, z), along(z, x));
    if (road > 0) {
      const inward = CHUNK_HALF - Math.max(Math.abs(x), Math.abs(z));
      const ramp = smoothstep(ROAD_LENGTH - 15, ROAD_LENGTH + 30, inward);
      height = lerp(lerp(0, height, ramp), height, 1 - road);
    }
    return height;
  };
}

/** Original analytic placement queries for authoring, independent of client
 * ground readiness. Native actor and prompt recipes retain their f64 poses. */
export function signalAuthorGround(): { heightAt: (x: number, z: number) => number; normalAt: (x: number, z: number, eps?: number) => [number, number, number]; splatAt: () => [number, number, number, number] } {
  const heightAt = signalHeightAt();
  return { heightAt, normalAt: (x, z, eps = 0.6) => {
    const nx = heightAt(x - eps, z) - heightAt(x + eps, z);
    const nz = heightAt(x, z - eps) - heightAt(x, z + eps), ny = 2 * eps;
    const length = Math.hypot(nx, ny, nz);
    return [nx / length, ny / length, nz / length];
  }, splatAt: () => [1, 0, 0, 0] };
}

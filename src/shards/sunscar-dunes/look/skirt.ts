import { GROUND_HALF } from '../data/layout';
import { WIND } from '../world/dunes';

/**
 * The skirt's height past the ground's edge (its edge heights easing into swells along the wind); inside, `heightAt`.
 * The skirt mesh (look/render.ts) and the baked dune-shadow map (generators/sand.ts) both stand on it.
 */
export function skirtAt(heightAt: (x: number, z: number) => number, x: number, z: number): number {
  const edge = GROUND_HALF, out = Math.max(Math.abs(x), Math.abs(z)) - edge;
  if (out < -0.5) return heightAt(x, z);
  const cx = Math.max(-edge, Math.min(edge, x)), cz = Math.max(-edge, Math.min(edge, z));
  const t = Math.min(1, Math.max(0, out / 60)), e = t * t * (3 - 2 * t);
  const u = (x * WIND.x + z * WIND.z) / 64, v = (-x * WIND.z + z * WIND.x) / 90;
  return heightAt(cx, cz) * (1 - e) + (2.5 + 3 * Math.sin((u + Math.sin(v) * 0.4) * Math.PI * 2)) * e - 0.05;
}

import type { TerrainNoise } from '#engine/data';
import { CRESTS } from '../layout';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const WAVE = 50, LEE = 0.44;

/**
 * Transverse dunes: long ridges across the north wind, a gentle windward (stoss) side to the south and a steeper
 * lee to the north. Every face stays under ~30° so the player walks them (max climb 40°).
 */
export function duneHeight(x: number, z: number, { n }: TerrainNoise): number {
  const warp = n.get(x * 0.011, z * 0.011) * 10 + Math.sin(x * 0.021) * 6;
  const u = (z + warp) / WAVE, p = u - Math.floor(u);
  const ridge = p < 1 - LEE ? smooth(p / (1 - LEE)) : 1 - smooth((p - (1 - LEE)) / LEE);
  const amp = 4.2 + 1.6 * n.get(x * 0.006 + 7, z * 0.006 - 3);
  let h = 3 + amp * ridge + 3 * n.get(x * 0.0035 - 11, z * 0.0035 + 5);
  for (const c of CRESTS) {
    const d = Math.hypot(x - c.x, z - c.z), w = 1 - smooth((d - c.r * 0.3) / c.r);
    if (w > 0) h += (3 + amp + c.lift - h) * w;
  }
  return h;
}

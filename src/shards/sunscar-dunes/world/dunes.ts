import type { TerrainNoise } from '#engine/data';
import { BASIN, CRESTS, PADS } from '../layout';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const WAVE = 50, LEE = 0.44;
/** The basin's sand floor (metres): the boss arena sits below every dune trough. */
export const BASIN_FLOOR = 0.8;

/** The raw dune field and its raised crests, before the pads and the basin. */
function rawDunes(x: number, z: number, n: TerrainNoise['n']): number {
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

/**
 * Transverse dunes: long ridges across the north wind, a gentle windward (stoss) side to the south and a steeper
 * lee to the north. Small flat pads under the caravan and the well, and a wide sand bowl north of the
 * tower for the boss. Every face stays under ~32° so the player walks them (max climb 40°).
 */
export function duneHeight(x: number, z: number, { n }: TerrainNoise): number {
  let h = rawDunes(x, z, n);
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z); if (d > p.r * 2.2) continue;
    h += (p.level - h) * (1 - smooth((d - p.r) / (p.r * 1.2)));
  }
  const db = Math.hypot(x - BASIN.x, z - BASIN.z);
  if (db < BASIN.r) h += (BASIN_FLOOR - h) * (1 - smooth((db - BASIN.floor) / (BASIN.r - BASIN.floor)));
  return h;
}

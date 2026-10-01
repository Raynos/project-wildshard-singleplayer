import { smoothstep, type TerrainNoise } from '#engine/data';
import { SPAWN, TOWER } from '../layout';

/**
 * The dune sea as one height function (node-safe: the manifest builds the terrain from it).
 * Transverse dunes run east–west: a long windward rise to the south, a short lee face to the north. The lee face
 * stays under ~30° (the motor climbs 40°), and the dunes flatten toward the slab edge so the edge roads meet y = 0
 * on gentle sand.
 */
const WAVE = 62, AMP = 5.5, LEE = 0.4;
export function duneHeight(x: number, z: number, { n, n2 }: TerrainNoise): number {
  const warp = n.get(x * 0.006, z * 0.006) * 16 + n2.get(x * 0.017, z * 0.017) * 4;
  const phase = (z + warp) / WAVE, f = phase - Math.floor(phase);
  // 0 at the trough, 1 at the crest: windward over 1 − LEE, lee over LEE.
  const rise = f < 1 - LEE ? f / (1 - LEE) : (1 - f) / LEE;
  const profile = smoothstep(0, 1, rise);
  const swell = n.get(x * 0.0035 + 11, z * 0.0035 - 4) * 3 + 2;
  const vary = 0.75 + 0.35 * n2.get(x * 0.011 - 3, z * 0.009 + 8);
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const fade = 1 - smoothstep(175, 235, edge);
  // Two broad crests: the spawn ridge and the far crest the tower stands on.
  const mound = (cx: number, cz: number, h: number, r: number): number => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  return (profile * AMP * vary + swell) * fade + mound(SPAWN.x, SPAWN.z, 2.5, 30) + mound(TOWER.x, TOWER.z, 6, 32);
}

/** Sand albedo by height and facing (linear RGB): warm crests, cooler troughs. Used for the vertex colours. */
export function sandColor(h: number, out: number[] | Float32Array): number[] | Float32Array {
  const t = smoothstep(-1, 9, h);
  out[0] = 0.5 + 0.14 * t; out[1] = 0.25 + 0.08 * t; out[2] = 0.12 + 0.03 * t;
  return out;
}

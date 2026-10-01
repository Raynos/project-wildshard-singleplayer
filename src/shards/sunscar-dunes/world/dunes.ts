/**
 * The dune field as pure functions (node-safe: the manifest imports it). Transverse dune ridges cross the wind: a long
 * concave windward rise and a short steep slip face, warped by noise so no two crests line up, on a slow swell. The
 * far crest is one big mound with the signal tower on its smoothed top. Slip faces stay under ~32 degrees, so the player
 * (max climb 40) walks every crest.
 */
import type { TerrainNoise } from '#engine/data';
import { CREST, SPAWN } from '../layout';

const WIND = 0.55, COS = Math.cos(WIND), SIN = Math.sin(WIND), WAVE = 50, LEE = 0.38;
const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** One ridge profile, 0 in the hollow to 1 at the crest; `s` is the phase across the ridge (0..1). */
export function ridge(s: number): number {
  const top = 1 - LEE;
  return s < top ? (s / top) ** 1.6 : smooth((1 - s) / LEE);
}

export function duneHeight(x: number, z: number, { n, n2 }: TerrainNoise): number {
  const u = x * COS + z * SIN, v = -x * SIN + z * COS;
  const warp = n.get(x * 0.005, z * 0.005) * 0.75 + Math.sin(v * 0.018) * 0.15;
  const phase = u / WAVE + warp, s = phase - Math.floor(phase);
  const amp = 4.2 * (0.75 + 0.35 * n2.get(x * 0.011 + 7, z * 0.011 - 3));
  const crestD = Math.hypot(x - CREST.x, z - CREST.z), mound = Math.exp(-(crestD * crestD) / (2 * CREST.r * CREST.r));
  const top = smooth((CREST.r * 0.42 - crestD) / (CREST.r * 0.3));
  const spawnFlat = 1 - 0.6 * smooth((14 - Math.hypot(x - SPAWN.x, z - SPAWN.z)) / 10);
  const swell = 3.2 * n.get(x * 0.0095 - 11, z * 0.0095 + 5);
  // the spawn stands on a low dune top, so the first look clears the near ridges to the far crest
  const sd = Math.hypot(x - SPAWN.x, z - SPAWN.z), lookout = 6.5 * Math.exp(-(sd * sd) / (2 * 15 * 15));
  return 2 + swell + ridge(s) * amp * (1 - top) * spawnFlat + CREST.h * mound + lookout;
}

/**
 * The sand's albedo (linear RGB) from height, slope and a little grain noise: dark burnt orange, a touch paler on the
 * crests, deeper and browner in the hollows (the cool blue there is the sky's light, not the sand).
 */
export function sandColor(h: number, slope: number, grain: number, out: [number, number, number] | Float32Array): void {
  const lift = smooth((h - 2) / 16) * 0.12, dim = 1 - slope * 0.25, g = 0.94 + grain * 0.12;
  out[0] = (0.50 + lift) * dim * g; out[1] = (0.20 + lift * 0.45) * dim * g; out[2] = (0.075 + lift * 0.15) * dim * g;
}

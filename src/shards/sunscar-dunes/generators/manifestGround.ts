import { signalHeightAt } from './landscape';
import { SEED, SPAWN, TOWER } from '../data/layout';
import { SCOUT_AT } from '../data/flags';
import { SAND_TINT } from '../data/duneField';

/** Cold author queries that preserve the original manifest poses and sand tint.
 * Ring means remain f64: storing f32 or sampling the collision lattice would
 * change the original tint. No runtime/legacy/cache or generated seed is read. */
export function signalManifestGround(): { metadata: { version: 1; seed: number; spawnY: number; towerY: number; heights: Record<string, number>; mean: { x: number; z: number; resolution: number; size: number; ring: number } }; means: Float64Array } {
  const height = signalHeightAt(), means = new Float64Array(257 ** 2), ring = SAND_TINT.ring;
  for (let z = 0; z < 257; z++) for (let x = 0; x < 257; x++) {
    const px = -250 + x * 500 / 256, pz = -250 + z * 500 / 256;
    means[z * 257 + x] = (height(px + ring, pz) + height(px - ring, pz) + height(px, pz + ring) + height(px, pz - ring)) / 4;
  }
  return { metadata: { version: 1, seed: SEED, spawnY: height(SPAWN.x, SPAWN.z), towerY: height(TOWER.x, TOWER.z),
    heights: { scout: height(SCOUT_AT.x, SCOUT_AT.z), spawn: height(SPAWN.x, SPAWN.z), whip: height(SPAWN.x, SPAWN.z - 4), ray: height(SPAWN.x, SPAWN.z), quest: height(TOWER.x - 4, TOWER.z + 12) },
    mean: { x: -250, z: -250, resolution: 257, size: 500, ring } }, means };
}

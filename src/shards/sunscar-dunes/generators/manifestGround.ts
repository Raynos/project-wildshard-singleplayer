import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { signalHeightAt } from './landscape';
import { BRAZIERS, CARAVAN, SEED, SPAWN, TOWER } from '../data/layout';
import { SCOUT_AT } from '../data/flags';
import { SAND_TINT } from '../data/duneField';

/** Cold author queries that preserve the original manifest poses and sand tint.
 * Ring means remain f64: storing f32 or sampling the collision lattice would
 * change the original tint. No runtime/legacy/cache or generated seed is read. */
export function signalManifestGround(): { metadata: { version: 1; seed: number; spawnY: number; towerY: number; heights: Record<string, number>; mean: { x: number; z: number; resolution: number; size: number; ring: number } }; means: Float64Array } {
  return withPortableMath(() => {
  const height = signalHeightAt(), means = new Float64Array(257 ** 2), ring = SAND_TINT.ring;
  for (let z = 0; z < 257; z++) for (let x = 0; x < 257; x++) {
    const px = -250 + x * 500 / 256, pz = -250 + z * 500 / 256;
    means[z * 257 + x] = (height(px + ring, pz) + height(px - ring, pz) + height(px, pz + ring) + height(px, pz - ring)) / 4;
  }
  return { metadata: { version: 1, seed: SEED, spawnY: height(SPAWN.x, SPAWN.z), towerY: height(TOWER.x, TOWER.z),
    heights: { scout: height(SCOUT_AT.x, SCOUT_AT.z), spawn: height(SPAWN.x, SPAWN.z), whip: height(SPAWN.x, SPAWN.z - 4), ray: height(SPAWN.x, SPAWN.z), quest: height(TOWER.x - 4, TOWER.z + 12) },
    mean: { x: -250, z: -250, resolution: 257, size: 500, ring } }, means };
  });
}

/** One block of the original 256² Float32 ground lattice (500 m): `w` × `h` samples from column `i0`, row `j0`, row-major. */
export interface DrapePatch { i0: number; j0: number; w: number; h: number; heights: number[] }

/** Cold author queries for the fire and lamp pools draped on the sand round the caravan and the braziers: the original
 * 256² ground lattice's exact Float32 samples (the native WSTR law: the same recipe at the same lattice points), kept only
 * in blocks round each site (16 m round the caravan, 12 m round each brazier), so the pools sit as they always have. */
export function signalDrapeGround(): { version: 1; res: 256; size: 500; patches: DrapePatch[] } {
  return withPortableMath(() => {
  const height = signalHeightAt(), res = 256, step = 500 / (res - 1);
  const block = (x: number, z: number, r: number): DrapePatch => {
    const i0 = Math.max(0, Math.floor((x - r + 250) / step)), j0 = Math.max(0, Math.floor((z - r + 250) / step));
    const i1 = Math.min(res - 1, Math.ceil((x + r + 250) / step)), j1 = Math.min(res - 1, Math.ceil((z + r + 250) / step));
    const heights: number[] = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) heights.push(Math.fround(height(-250 + i * step, -250 + j * step)));
    return { i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1, heights };
  };
  return { version: 1, res: 256, size: 500, patches: [block(CARAVAN.x, CARAVAN.z, 16), ...BRAZIERS.map((at) => block(at.x, at.z, 12))] };
  });
}

/** The complete original WSTR256 height lattice for native navigation. The
 * recipe uses the retained 500 m Float32 law; it reads no old binary or cache. */
export function signalNativeGround(): { version: 1; res: 256; size: 500; seed: number; heights: number[] } {
  return withPortableMath(() => {
    const height = signalHeightAt(), res = 256, step = 500 / (res - 1);
    return { version: 1, res, size: 500, seed: SEED,
      heights: Array.from({ length: res * res }, (_, i) => Math.fround(height(-250 + (i % res) * step, -250 + Math.floor(i / res) * step))) };
  });
}

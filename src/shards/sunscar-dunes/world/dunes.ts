import type { TerrainNoise } from '#engine/data';
import { DECK, SPAWN, TOWER } from '../layout';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const gauss = (x: number, z: number, cx: number, cz: number, sigma: number): number => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma));
const PERIOD = 70, WINDWARD = 0.66;

/** One transverse dune: a long gentle windward face (south) and a short slip face (north), every face under 38°. */
function duneProfile(u: number): number {
  const t = ((u / PERIOD) % 1 + 1) % 1;
  return t < WINDWARD ? smooth(t / WINDWARD) : 1 - smooth((t - WINDWARD) / (1 - WINDWARD));
}
/** The dune sea before the tower pad: a swell, warped transverse dunes, the spawn crest and the tower's crest. */
function rawHeight(x: number, z: number, { n }: TerrainNoise): number {
  const warp = 10 * n.get(x * 0.007, z * 0.007 + 11), amp = 5.6 + 1.8 * n.get(x * 0.011 + 40, z * 0.011);
  const nearTower = gauss(x, z, TOWER.x, TOWER.z, 22), nearSpawn = gauss(x, z, SPAWN.x, SPAWN.z, 16);
  const dunes = amp * duneProfile(z + warp + 0.18 * x) * (1 - 0.85 * nearTower) * (1 - 0.6 * nearSpawn);
  const swell = 4 * n.get(x * 0.0035 + 7, z * 0.0035 - 3);
  const crests = 15 * gauss(x, z, TOWER.x, TOWER.z, 30) + 7 * gauss(x, z, SPAWN.x, SPAWN.z, 26);
  const edge = smooth((245 - Math.max(Math.abs(x), Math.abs(z))) / 60);
  // The engine's four entry roads come in level at y = 0: lay the sand down toward them so their cuts stay walkable.
  const road = Math.max((1 - smooth((Math.abs(x) - 8) / 40)) * smooth((Math.abs(z) - 140) / 50), (1 - smooth((Math.abs(z) - 8) / 40)) * smooth((Math.abs(x) - 140) / 50));
  return (5 + swell + dunes + crests) * (0.3 + 0.7 * edge) * (1 - 0.8 * road);
}
/** The landscape `buildTerrain` reads: the dune sea, flattened to a level pad under the signal tower and its stair. */
export function duneHeight(x: number, z: number, noise: TerrainNoise): number {
  const h = rawHeight(x, z, noise);
  const pad = smooth(1 - (Math.hypot(x - TOWER.x, z - TOWER.z) - DECK.stairRun - 2) / 8);
  return pad <= 0 ? h : h + (rawHeight(TOWER.x, TOWER.z, noise) - h) * pad;
}

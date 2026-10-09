import { flock, type FlockData } from '@wildshard/sdk/crowds';
import { NALATI_FLOCK } from '../data/crowds';
import { NALATI_WILDLIFE } from './wildPlacement';

/** The layout's flocks as admitted crowd rows, on Wildlife's seeds (creatures/wildlife.ts `spawnFlock`: the level's seed plus
 *  101 a flock): the page's declared crowds (runtime/flockDeclared.ts) and the renderer-free host (runtime/headlessCreatures.ts). */
export function nalatiFlockRows(seed: number, layout = NALATI_WILDLIFE.flocks): FlockData[] {
  return layout.map((row, index) => flock({ ...NALATI_FLOCK, id: `nalati.flock.${String(index)}`, x: row.x, z: row.z,
    count: row.count, seed: seed + index * 101, range: row.range ?? 45 }));
}

import { KOKBORI_DEN, HORSE_PLAINS, PASTURE } from '../layout';

/** Shipping population counts and placement anchors, consumed by the original native placement owner. */
export interface WildlifeLayout {
  packs: { x: number; z: number; variants: string[] }[];
  herds: { x: number; z: number; mares: number; foals: number; stallion: boolean }[];
  flocks: { x: number; z: number; count: number; dog: boolean; range?: number }[];
  /** marmot burrows: `sites` seeded inside the box (ambient; one instanced draw for all) */
  marmots?: { sites: number; box: { x0: number; x1: number; z0: number; z1: number } };
  /** the camp's saddled horses tied at the hitching rail (HITCH_HORSE_SPOTS, src/shards/nalati-grasslands/world/layout.ts) */
  campHorses?: boolean;
}

/** layout v2 (src/shards/nalati-grasslands/layout.ts): the pack below Kokbori's den on the NE rim, the AI herd on the horse plains
 *  (the hundreds round it are the instanced far herds), the flock on the pasture */
export const NALATI_WILDLIFE: WildlifeLayout = {
  packs: [{ x: KOKBORI_DEN.x + 22, z: KOKBORI_DEN.z - 30, variants: ['alpha', 'grey', 'tawny', 'grey', 'scout'] }],
  herds: [{ x: HORSE_PLAINS.x, z: HORSE_PLAINS.z, mares: 11, foals: 3, stallion: true }],
  flocks: [{ x: PASTURE.x, z: PASTURE.z, count: 40, dog: true, range: PASTURE.r }],
  marmots: { sites: 7, box: { x0: -160, x1: 170, z0: -30, z1: 95 } },   // the Sky Grassland's bowl
  campHorses: true,
};

/** The wild herd's mare coats, in order: a herd starts at a rolled index and walks round the list. */
export const MARE_VARIANTS = ['bay', 'chestnut', 'bay', 'dun', 'chestnut', 'grey', 'bay', 'black', 'dun', 'bay', 'chestnut', 'grey'];


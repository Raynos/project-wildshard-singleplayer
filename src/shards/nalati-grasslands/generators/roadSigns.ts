import type { Board } from './campParams';
import { CAMP, PASTURE, HORSE_PLAINS, EAGLE_ROCK, KOKPAR, SUMMER_YURTS, KURGANS, WATCHTOWER } from './layout';

interface Signpost { x: number; z: number; boards: Board[] }

const dirTo = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);
/** compass directions as `dir` yaws: +z north, +x west */
const N = 0, S = Math.PI, W = Math.PI / 2;

/** the kurgan field's middle (the mounds other than the great one) */
const KF = KURGANS.filter((k) => k.great !== true).reduce((a, k, _, l) => ({ x: a.x + k.x / l.length, z: a.z + k.z / l.length }), { x: 0, z: 0 });
/** signposts at the junctions of layout v2 (src/shards/nalati-grasslands/layout.ts): the camp turn on the N road, the sky road's
 *  foot at the bridge, the gateway at its top, the bowl's crossroads, the E road's turn */
const SIGNS: Signpost[] = [
  { x: -5.2, z: 217, boards: [{ text: 'NOMAD CAMP', dir: dirTo(0, 214, CAMP.x, CAMP.z) }, { text: 'SKY GRASSLAND', dir: S }, { text: 'SHEEP PASTURE', dir: dirTo(0, 217, PASTURE.x, PASTURE.z) }] },
  { x: -6, z: 152, boards: [{ text: 'SKY ROAD', dir: W + 0.1 }, { text: 'KUNES BRIDGE', dir: N }] },
  { x: 127, z: 75, boards: [{ text: 'HORSE PLAINS', dir: dirTo(127, 75, HORSE_PLAINS.x, HORSE_PLAINS.z) }, { text: 'EAGLE ROCK', dir: dirTo(127, 75, EAGLE_ROCK.x, EAGLE_ROCK.z) }, { text: 'W ROAD', dir: dirTo(127, 75, 250, 0) }, { text: 'VALLEY · CAMP', dir: dirTo(127, 75, 92, 90) }] },
  { x: 12, z: 14, boards: [{ text: 'SNOW LOTUS VALLEY', dir: S }, { text: 'KOKPAR FIELD', dir: dirTo(12, 14, KOKPAR.x, KOKPAR.z) }, { text: 'SUMMER CAMP', dir: dirTo(12, 14, SUMMER_YURTS.x, SUMMER_YURTS.z) }, { text: 'HORSE PLAINS', dir: dirTo(12, 14, HORSE_PLAINS.x, HORSE_PLAINS.z) }] },
  { x: -170, z: 22, boards: [{ text: 'KURGAN FIELD', dir: dirTo(-170, 22, KF.x, KF.z) }, { text: 'WATCHTOWER', dir: dirTo(-170, 22, WATCHTOWER.x, WATCHTOWER.z) }, { text: 'E ROAD', dir: dirTo(-170, 22, -250, 0) }] },
];

/** Ordered authored junctions and bearings, detached from the defining layout records. */
export function nalatiRoadSignSites(): Signpost[] {
  return SIGNS.map(site => ({ x: site.x, z: site.z, boards: site.boards.map(board => ({ ...board })) }));
}

/** Original signpost anchors over a caller-owned native ground query; no place geometry is constructed. */
export function nalatiRoadSignposts(ground: (x: number, z: number) => number): { x: number; z: number; boards: Board[]; y: number }[] {
  return nalatiRoadSignSites().map(site => ({ x: site.x, z: site.z, boards: site.boards, y: ground(site.x, site.z) }));
}

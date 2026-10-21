import { currentPageMode } from '@wildshard/game/grid/pageMode';
import geography from '../data/geography.generated.json' with { type: 'json' };
import { streamProjection } from '@wildshard/format/populationEnvironment';

// The ground (terrain field, trails, pads, pond, the pond basin and the creek) is declared rows: data/ground.generated.json
// (generators/bake-geography.mjs `pineGround`), built by the game's declaredGround (G4).

/** Exact jittered candidate samples, without interpolation at clearing edges. */
const forest = new Map(geography.forest.map(row => [`${String(row.x)},${String(row.z)}`, row]));
function forestAt(x: number, z: number) {
  const row = forest.get(`${String(x)},${String(z)}`);
  if (row === undefined) throw new Error('Pine forest candidate differs from its geography bake');
  return row;
}
/** Exact complementary pond-cell test, including the strict distance edge. */
export function inBeaverPool(x: number, z: number): boolean {
  const n = streamProjection(geography.creek.lines, x, z), c = geography.creek;
  return n.d < 12 && n.s >= c.riffle && n.s <= c.dam-c.lead;
}

/** Native forest query ports; authored tuning and species stay in JSON. */
export const FOREST_QUERIES = { density: (x: number, z: number): number => forestAt(x,z).density, scale: (x: number, z: number): number => forestAt(x,z).scale, species: (x: number, z: number): Partial<Record<string, number>> => forestAt(x,z).species };

/**
 * G187 (Jake, 2026-10-07, `art/pine-hollow/round-36-content-cut/` board-view-distance B): on the phone, with the Pine
 * memory trim on (the grid's default), every reach the content-cut board scaled is 75 % of the phone row's: the trees' hi /
 * lo / twig bands, the cabins' detail meshes, the animals' draw, eye and shadow bands, the sun's shadow reach and the
 * pickup orbs. −6.5 MB of GL on the board (the cabin detail meshes that never build); the fog already hides the reach it cuts.
 * The numbers are 0.75 × the phone tier's own (Pine's row where it sets one, else the engine's phone row, render/tiers.ts).
 * Trim off (standalone) keeps the phone row's reach.
 */
const VIEW_B = {
  treeHiDist: 45, treeLoDist: 97.5, treeTwigDist: 18, 'pine.cabinDetailDist': 52.5,
  animalHideDist: 112.5, animalShadowDist: 45, animalEyeDist: 33.75, animalOneDrawDist: 75,
  shadowFar: 45, pickupOrbDist: 90,
} as const;

/** Pine's tier rows with view distance B laid over the phone's while the trim is on (read when the level applies its row) */
export function pineTiers<P extends object, D extends object>(rows: { phone: P; desktop: D }): { readonly phone: P; desktop: D } {
  return {
    get phone(): P { return currentPageMode() === 'grid' ? { ...rows.phone, ...VIEW_B } : rows.phone; },
    desktop: rows.desktop,
  };
}

import { currentPageMode } from '@wildshard/game/grid/pageMode';
import { basinBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { waterReflect } from './water';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import PINE_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import geography from '../data/geography.generated.json' with { type: 'json' };
import { streamProjection, streamSurface } from '@wildshard/format/populationEnvironment';

type Vec2 = [number, number];
// Preserve the authored shared road aliases.
LAYOUT.SPURS['den'] = LAYOUT.DEN_TRAIL; LAYOUT.SPURS['lookout'] = LAYOUT.LOOKOUT_TRAIL; LAYOUT.GRADED.paths[0] = LAYOUT.LOOKOUT_TRAIL;

/** Exact jittered candidate samples, without interpolation at clearing edges. */
const forest = new Map(geography.forest.map(row => [`${String(row.x)},${String(row.z)}`, row]));
function forestAt(x: number, z: number) {
  const row = forest.get(`${String(x)},${String(z)}`);
  if (row === undefined) throw new Error('Pine forest candidate differs from its geography bake');
  return row;
}
/** Projection retains the native operation order over baked segment spans. */
const creekAt = (x: number, z: number) => streamProjection(geography.creek.lines, x, z);
/** The live pool level remains independent of the baked bed. */
export function creekSurfaceAt(s: number): number { return streamSurface(geography.stream, s, { pool: LAYOUT.beaverPoolLevel.y }); }
/** Exact complementary pond-cell test, including the strict distance edge. */
export function inBeaverPool(x: number, z: number): boolean {
  const n = creekAt(x,z), c = geography.creek;
  return n.d < 12 && n.s >= c.riffle && n.s <= c.dam-c.lead;
}
function creekWaterAt(x: number, z: number): number | null {
  const n = creekAt(x,z);
  return n.d <= geography.creek.halfWidth ? creekSurfaceAt(n.s) : null;
}

/** trails: the four mandated entry roads (S / N / W / E), then a spur to every zone */
const TRAILS: Vec2[][] = [LAYOUT.S_ROAD, LAYOUT.N_ROAD, LAYOUT.W_ROAD, LAYOUT.E_ROAD, ...Object.values(LAYOUT.SPURS)];

/** Required original renderer lattice; trail/water/forest metadata keep their live laws. */
export const TERRAIN = createBakedTerrainField(PINE_TERRAIN, {
  water: LAYOUT.POND.level, trails: TRAILS, cabinSites: LAYOUT.CABIN_SITES, pond: { x: LAYOUT.POND.x, z: LAYOUT.POND.z, r: LAYOUT.POND.r },
});
TERRAIN.streamAt = creekWaterAt;

/** the creek: water wherever `creekWaterAt` answers, at the surface it answers */
function creekBody(): WaterBody {
  return {
    id: 'creek', get level() { return TERRAIN.waterLevel(); }, 
    restAt: creekWaterAt,
    surfaceAt: (x, z) => creekWaterAt(x, z) ?? TERRAIN.waterLevel(),
    inside: (x, z, y) => { const s = creekWaterAt(x, z); return s !== null && y < s; },
    reflect: waterReflect,
  };
}

export const PINE_WATER: readonly WaterBody[] = [basinBody('pond', TERRAIN, waterReflect), creekBody()];

export const GROUND = { terrain: TERRAIN, water: PINE_WATER };

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

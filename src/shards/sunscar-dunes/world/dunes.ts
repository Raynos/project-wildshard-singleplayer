import type { TerrainNoise } from '@wildshard/engine/level/data';
import { duneField } from '../runtime/looks/duneField';
import { DUNE_FIELD } from '../runtime/looks/duneFieldRows';

/** The wind (x, z): the crests run across it (data/duneField.ts). */
export const WIND = DUNE_FIELD.wind;
/** The basin's sand floor (metres): the boss arena sits below every dune trough. */
export const BASIN_FLOOR = DUNE_FIELD.basinFloor;
/** Crescent dunes (P2) from their rows (data/duneField.ts DUNE_FIELD); the trails are graded in (`manifest.ground.terrain.graded`). */
export const duneHeight: (x: number, z: number, noise: TerrainNoise) => number = duneField(DUNE_FIELD);

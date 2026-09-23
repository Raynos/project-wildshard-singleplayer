/**
 * Where nothing should grow or be scattered: the POI footprints (B5), as plain circles, derived from the layout data
 * (`src/chunks/nalatiLayout.ts`, layout v2) — which has no imports, so the chunk def and the placers (spruce mask, grass,
 * rocks, animals' spawn) can use this at module init.
 *
 *   mask: (x, z) => (inSpruceClearing(x, z) ? 0 : spruce(x, z))
 */
import {
  CAMP, PASTURE, BRIDGE_XZ, SUMMER_YURTS, EAGLE_ROCK, CAIRN, KURGANS, GREAT_KURGAN_DOOR, LEOPARD_CAVE, WATCHTOWER, KOKPAR,
} from '../../chunks/nalatiLayout';

export interface Clearing { x: number; z: number; r: number }

const great = KURGANS.find((k) => k.great === true);
/** the great kurgan's entrance: just outside its footprint on the door side (a door `rot` faces (−sin, −cos)) */
const entrance: Clearing[] = great ? [{ x: great.x - Math.sin(GREAT_KURGAN_DOOR) * (great.r + 3), z: great.z - Math.cos(GREAT_KURGAN_DOOR) * (great.r + 3), r: 9 }] : [];

export const POI_CLEARINGS: Clearing[] = [
  { x: CAMP.x, z: CAMP.z, r: 30 },                     // the nomad camp (yurts, yard, hitching rail)
  { x: CAMP.x + 27, z: CAMP.z + 9, r: 12 },            // the corral (layout.ts CORRAL)
  { x: BRIDGE_XZ.x, z: BRIDGE_XZ.z, r: 24 },           // the bridge and its ramps
  { x: SUMMER_YURTS.x, z: SUMMER_YURTS.z, r: 16 },     // the summer yurts
  { x: EAGLE_ROCK.x, z: EAGLE_ROCK.z, r: 20 },         // Eagle Rock
  { x: CAIRN.x, z: CAIRN.z, r: 10 },                   // the Wind Cairn (the south rim)
  ...entrance,                                          // the great kurgan's entrance
  { x: LEOPARD_CAVE.x - Math.sin(LEOPARD_CAVE.rot) * 3, z: LEOPARD_CAVE.z - Math.cos(LEOPARD_CAVE.rot) * 3, r: 9 }, // the cave porch
  { x: WATCHTOWER.x, z: WATCHTOWER.z, r: 10 },         // the watchtower
  { x: KOKPAR.x, z: KOKPAR.z, r: Math.max(KOKPAR.rx, KOKPAR.rz) + 4 }, // the kokpar field
];

export function inPoiClearing(x: number, z: number, margin = 0): boolean {
  for (const c of POI_CLEARINGS) { const dx = x - c.x, dz = z - c.z, r = c.r + margin; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}

/** the sheep pasture (the flock grazes within PASTURE.r of it: Wildlife NALATI_WILDLIFE) — open grass, no trees; the
 *  dressing's flowers / stones may still sit in it, so it is not a POI clearing */
export const PASTURE_CLEARING: Clearing = { x: PASTURE.x, z: PASTURE.z, r: PASTURE.r + 4 };

/** where no spruce may grow: every POI clearing (+ 8 m: no lone tree at the camp yard's edge) + the sheep pasture (the chunk def's `forest.mask`) */
export function inSpruceClearing(x: number, z: number): boolean {
  const dx = x - PASTURE_CLEARING.x, dz = z - PASTURE_CLEARING.z;
  return dx * dx + dz * dz < PASTURE_CLEARING.r * PASTURE_CLEARING.r || inPoiClearing(x, z, 8);
}

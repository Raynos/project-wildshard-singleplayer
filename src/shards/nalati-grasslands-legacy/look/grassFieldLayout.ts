import { RIVER } from '../world/terrain';

interface Zone { x: number; z: number; r: number; h: number }
const TALL_GRASS = 1.12;
// ── Nalati layout (engine coords: +z north, −x east) ──────────────────────────────────────────────
/**
 * Trodden yards only (look pass round 2: the mockups carry knee-high grass right up to the yurts and the path): the
 * height inside r, easing back to the lush meadow over another 0.8 r. The open pastures are meadow, not lawn.
 */
const NALATI_SHORT: Zone[] = [
  { x: 95, z: 205, r: 9, h: 0.16 },      // the camp yard, inside the ring of yurts
  { x: 122, z: 214, r: 7, h: 0.2 },      // the corral (the horses stand in it)
  { x: 0, z: 160, r: 7, h: 0.2 },        // bridge heads
  { x: 95, z: -200, r: 5.5, h: 0.18 },   // the summer camp's hearth yard
  { x: 20, z: -170, r: 9, h: 0.32 },     // inside the balbal circle
];
/** yurt footprints (bare felt floor + a trodden ring) — keep in step with NomadCamp.ts YURTS / SummerCamp.ts `Y` */
const polar = (cx: number, cz: number, deg: number, d: number, r: number): Zone => ({ x: cx + Math.cos((deg * Math.PI) / 180) * d, z: cz + Math.sin((deg * Math.PI) / 180) * d, r, h: 0 });
const NALATI_YURTS: Zone[] = [
  polar(95, 205, 128, 13.5, 3.0), polar(95, 205, 88, 14.5, 3.5), polar(95, 205, 46, 13, 2.8),
  polar(95, 205, 2, 13.5, 3.1), polar(95, 205, -44, 13, 2.7), polar(95, 205, -92, 13.5, 3.2),
  polar(95, -200, 70, 9, 2.9), polar(95, -200, 175, 9.5, 2.6), polar(95, -200, -60, 9, 2.7),
];
/** the valley's lush meadow (m) and the plateau's */
const MEADOW_VALLEY = 0.66;
const MEADOW_PLATEAU = 0.72;
/** feather-grass stealth fields */
const NALATI_TALL: Zone[] = [
  { x: -135, z: 25, r: 30, h: TALL_GRASS },    // wolf country: the spur beside the east gully (den)
  { x: -40, z: -70, r: 28, h: TALL_GRASS },    // plateau, below the rim
  { x: -65, z: -150, r: 30, h: TALL_GRASS },   // plateau, south-east approach to the kurgans
  { x: 60, z: -95, r: 24, h: TALL_GRASS },     // plateau, east edge of the horse plains
  { x: -200, z: -115, r: 28, h: TALL_GRASS },  // behind the kurgan field (wolves)
  { x: 205, z: -175, r: 26, h: TALL_GRASS },   // SW corner fold
  { x: 45, z: -35, r: 18, h: TALL_GRASS },     // rim-top patch by the waterfall
];
/** the Kunes corridor: the chunk def's own `RIVER` (centreline z, half-width) — one formula for the terrain, the water and the grass */
const riverZ = RIVER.z;
const riverHalf = RIVER.half;


export const NALATI_GRASS_LAYOUT = { short: NALATI_SHORT, tall: NALATI_TALL, bare: NALATI_YURTS, valley: MEADOW_VALLEY, plateau: MEADOW_PLATEAU, riverZ, riverHalf };

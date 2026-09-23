/**
 * Where nothing should grow or be scattered: the POI footprints (B5), as plain circles. Pure data + one function,
 * no imports, so the chunk def and the placers (spruce mask, grass, rocks, animals' spawn) can use it at module init.
 *
 *   mask: (x, z) => (inPoiClearing(x, z) ? 0 : spruce(x, z))
 *
 * Keep in step with `layout.ts` (the camp at (95, 205), the bridge at (0, RIVER.z(0)), …).
 */
export interface Clearing { x: number; z: number; r: number }

export const POI_CLEARINGS: Clearing[] = [
  { x: 95, z: 205, r: 30 },     // the nomad camp (yurts, yard, hitching rail)
  { x: 122, z: 214, r: 12 },    // the corral
  { x: 0, z: 160, r: 24 },      // the bridge and its ramps
  { x: 95, z: -200, r: 16 },    // the summer yurts
  { x: 170, z: -20, r: 20 },    // Eagle Rock
  { x: 20, z: -170, r: 16 },    // the balbal circle
  { x: -30, z: -60, r: 10 },    // the Wind Cairn
  { x: -124, z: -96, r: 9 },    // the great kurgan's entrance
  { x: -158, z: -162, r: 9 },   // the leopard's cave porch
];

export function inPoiClearing(x: number, z: number, margin = 0): boolean {
  for (const c of POI_CLEARINGS) { const dx = x - c.x, dz = z - c.z, r = c.r + margin; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}

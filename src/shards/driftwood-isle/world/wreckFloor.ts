import bake from '../data/wreckBake.json' with { type: 'json' };

const L = 19, W = 2.95, KEEL = -1.1;
const HOLD_Z0 = -4.2, HOLD_Z1 = 5.3, BREACH_Z0 = -2.5, BREACH_Z1 = -0.3;
const BOW_DECK = 2.6, QUARTER_DECK = 2.75, STAIR = { x0: -1.45, x1: -0.55, z0: -1.5, z1: -4.2 };
const tOf = (z: number): number => (z + L / 2) / L;
function halfBeam(t: number): number {
  if (t < 0.35) return Math.max(0.06, W * Math.sin((t / 0.35) * Math.PI / 2) ** 0.62);
  return W * (1 - 0.24 * ((t - 0.35) / 0.65) ** 2);
}
function topOf(t: number): number { return 2.75 + 0.9 * Math.max(0, (0.3 - t) / 0.3) ** 2 + 0.85 * Math.max(0, (t - 0.72) / 0.28) ** 1.5; }
function keelOf(t: number): number { return KEEL + 2.6 * Math.max(0, (0.16 - t) / 0.16) ** 2; }
function halfWidthAt(t: number, y: number): number {
  const top = topOf(t), k = keelOf(t);
  if (y > top || y < k) return 0;
  const u = (top - y) / (top - k);
  return halfBeam(t) * Math.max(0, 1 - u ** 2.4) ** 0.5;
}

/** The original hold, stair, ramp and deck query over the authored floor coefficients. */
export function wreckFloorHeight(floor: typeof bake.floor, x: number, z: number): number | undefined {
    const dx = x - floor.spec.x, dz = z - floor.spec.z;
    const lx = dx * floor.cs - dz * floor.sn, lz = dx * floor.sn + dz * floor.cs;
    const at = (p: { a: number; bx: number; bz: number }): number => p.a + p.bx * lx + p.bz * lz;
    if (lz >= HOLD_Z0 && lz <= HOLD_Z1) {
      const i = Math.round((lz - HOLD_Z0) / 0.25), row = floor.floorW[Math.max(0, Math.min(floor.floorW.length - 1, i))];
      const pw = row?.port ?? 1.5, sw = row?.starboard ?? 1.5;
      if (lx >= -pw && lx <= sw) {
        // the stair up the port side to the forecastle
        if (lx >= STAIR.x0 && lx <= STAIR.x1 && lz <= STAIR.z0) return at(floor.floorPlane) + BOW_DECK * Math.min(1, (STAIR.z0 - lz) / (STAIR.z0 - STAIR.z1));
        return at(floor.floorPlane);
      }
      // the hatch-cover ramp out of the breach
      if (lz > BREACH_Z0 + 0.25 && lz < BREACH_Z1 - 0.25 && lx > sw && lx < floor.rampX0 + floor.rampLen) {
        const f = (lx - floor.rampX0) / floor.rampLen;
        return at(floor.floorPlane) + floor.rampGround * Math.max(0, f);
      }
      return undefined;
    }
    if (lz < HOLD_Z0 && lz > -L / 2 + 1.2) {
      const t = tOf(lz), w = halfWidthAt(t, BOW_DECK) - 0.3;
      return Math.abs(lx) < w ? at(floor.bowPlane) : undefined;
    }
    if (lz > HOLD_Z1 && lz < L / 2 - 0.2) {
      const t = tOf(lz), w = halfWidthAt(t, QUARTER_DECK) - 0.3;
      return Math.abs(lx) < w ? at(floor.quarterPlane) : undefined;
    }
    return undefined;
  }

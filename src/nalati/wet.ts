/**
 * Where Nalati's water is, for anything that walks: the Kunes' whole braided corridor (the channels AND the gravel
 * bars between them — a flock or a herd does not wade the river) and the plateau brook's bed. The shared
 * `waterLevel()` only sees the river's flat surface at −10, so the bars read as dry land and the brook (up at +30)
 * not at all; the animals ask this instead (`AnimalManager.wetAt`, `wildEnv.wetAt`, set by src/nalati/index.ts).
 *
 *   nalatiWetAt(x, z) → true in the water / the corridor
 */
import { BROOK, RIM_Z, riverMask } from '../chunks/nalati-grasslands';

/** m either side of the brook's centreline that count as its bed (the ribbon is 3.8 m wide) */
const BROOK_HALF = 2.6;
const BROOK_Z_MAX = RIM_Z + 12;
// the brook polyline's bounding box (+ the bed): a cheap early-out for the whole plateau
const BX0 = Math.min(...BROOK.map((p) => p[0])) - BROOK_HALF, BX1 = Math.max(...BROOK.map((p) => p[0])) + BROOK_HALF;
const BZ0 = Math.min(...BROOK.map((p) => p[1])) - BROOK_HALF, BZ1 = Math.max(...BROOK.map((p) => p[1])) + BROOK_HALF;

function nearBrook(x: number, z: number): boolean {
  if (z > BROOK_Z_MAX || x < BX0 || x > BX1 || z < BZ0 || z > BZ1) return false;
  for (let i = 0; i < BROOK.length - 1; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (a === undefined || b === undefined) continue;
    const abx = b[0] - a[0], abz = b[1] - a[1], l2 = abx * abx + abz * abz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * abx + (z - a[1]) * abz) / l2)) : 0;
    const dx = x - (a[0] + abx * t), dz = z - (a[1] + abz * t);
    if (dx * dx + dz * dz < BROOK_HALF * BROOK_HALF) return true;
  }
  return false;
}

export function nalatiWetAt(x: number, z: number): boolean {
  return riverMask(x, z) > 0.35 || nearBrook(x, z);
}

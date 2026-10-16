import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import type { Rng } from '@wildshard/engine/core/rng';

interface Knot { y: number; cx: number; cz: number; r: number }
interface Spines { step: number; spines: Knot[][] }
/** a snag top (the night sentinel's perch) */
export interface PointPerch { x: number; y: number; z: number }
/** a bark section: the trunk's centre and radius at that height, and its weight */
export interface BarkPerch extends PointPerch { r: number; w: number }

/** the snags' species and the day forager's perch heights and per-species weights (Pine's woodpecker) */
export const PERCH_POLICY = { sentinel: 'snag', height: [3.2, 5.5] as const, weights: { snag: 3, birch: 1.5, ambient: 1 } as Readonly<Record<string, number>> };
const round = (v: number): number => Math.round(v * 1000) / 1000;

function world(t: TreeInstance, k: { cx: number; cz: number }): { x: number; z: number } {
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  return { x: t.x + (k.cx * c + k.cz * s) * t.scale, z: t.z + (-k.cx * s + k.cz * c) * t.scale };
}
/** the trunk's centre + bark radius at world height `y` on tree `t` (null: no bark there, above the spine's top) */
function section(rows: Spines, t: TreeInstance, y: number): { x: number; z: number; r: number } | null {
  const STEP = rows.step, sp = rows.spines[t.variant] ?? [], hl = (y - t.y) / t.scale;
  const i = Math.floor(hl / STEP) - 1, a = sp[Math.max(0, i)], b = sp[i + 1];
  if (a === undefined || hl < 0) return null;
  if (b === undefined && hl > a.y + STEP) return null;
  const u = b === undefined ? 0 : Math.min(1, Math.max(0, (hl - a.y) / STEP)), n = b ?? a;
  const k = { cx: a.cx + (n.cx - a.cx) * u, cz: a.cz + (n.cz - a.cz) * u, r: a.r + (n.r - a.r) * u };
  return { ...world(t, k), r: k.r * t.scale };
}
/** the top of the bark (a snag's broken crown) in world space, or null */
function top(rows: Spines, t: TreeInstance): PointPerch | null {
  const sp = rows.spines[t.variant] ?? [], k = sp[sp.length - 1];
  if (k === undefined) return null;
  return { ...world(t, k), y: t.y + (k.y + rows.step * 0.5) * t.scale };
}

/** Every planted tree's perches: snag tops, and one seeded bark section per weighted trunk (in planting order). */
export function perchRows(trees: readonly TreeInstance[], rows: Spines, rng: Rng): { snags: PointPerch[]; bark: BarkPerch[] } {
  const snags: PointPerch[] = [], bark: BarkPerch[] = [];
  for (const t of trees) {
    const p = t.species === PERCH_POLICY.sentinel ? top(rows, t) : null;
    if (p !== null) snags.push({ x: round(p.x), y: round(p.y), z: round(p.z) });
    const w = t.species === undefined ? undefined : PERCH_POLICY.weights[t.species];
    if (w === undefined) continue;
    const y = t.y + rng.range(...PERCH_POLICY.height), sec = section(rows, t, y);
    if (sec !== null) bark.push({ x: round(sec.x), y: round(y), z: round(sec.z), r: round(sec.r), w });
  }
  return { snags, bark };
}

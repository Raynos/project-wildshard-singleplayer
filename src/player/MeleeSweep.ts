/**
 * MeleeSweep — the pure geometry of the sword's blade-swept hit test (Sword.ts, C1 / B5), kept free of three.js so it
 * is unit-tested (test/melee-sweep.test.ts).
 *
 *   segmentBlocked(ax, ay, az, bx, by, bz, colliders) → true when the segment eye → hit point passes through a collider
 *     box (Player.ts oriented boxes: the hut walls, the wreck hull, boulders, palm trunks) that contains NEITHER end —
 *     no hits through a wall; standing inside a box (the hold under the wreck's deck) or hitting something inside one
 *     (the drowned sailor rising through the hull) still works.
 *   segmentEntry(ax, ay, az, bx, by, bz, colliders) → the fraction 0..1 along a → b where it first enters a box that does
 *     not hold a (the blade tip meeting a wall / trunk: the clang), or -1.
 */

/** Player.ts's oriented box: centre (x, z), half extents (hw, hd) in its own frame, `rot` (the frame is R(-rot)), y range */
export interface BoxCollider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const EPS = 1e-9;

const SLAB = { t0: 0, t1: 1 };
/** clip [SLAB.t0, SLAB.t1] to where a + (b - a)·t lies in [lo, hi]; false when that leaves nothing */
function slab(a: number, b: number, lo: number, hi: number): boolean {
  const d = b - a;
  if (Math.abs(d) < EPS) return a >= lo && a <= hi;
  let u = (lo - a) / d, v = (hi - a) / d;
  if (u > v) { const w = u; u = v; v = w; }
  SLAB.t0 = Math.max(SLAB.t0, u); SLAB.t1 = Math.min(SLAB.t1, v);
  return SLAB.t0 <= SLAB.t1;
}

/** true when (x, y, z) is inside the box */
export function insideBox(c: BoxCollider, x: number, y: number, z: number): boolean {
  if (y < c.yBottom || y > c.yTop) return false;
  const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
  const lx = (x - c.x) * cos - (z - c.z) * sin, lz = (x - c.x) * sin + (z - c.z) * cos;
  return Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd;
}

/** the segment a → b crosses the box (slab test in the box's frame) */
export function segmentHitsBox(c: BoxCollider, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  return segmentBoxT(c, ax, ay, az, bx, by, bz) >= 0;
}

/** the fraction along a → b where the segment enters the box (0 when a is inside), or -1 when it misses */
export function segmentBoxT(c: BoxCollider, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
  const alx = (ax - c.x) * cos - (az - c.z) * sin, alz = (ax - c.x) * sin + (az - c.z) * cos;
  const blx = (bx - c.x) * cos - (bz - c.z) * sin, blz = (bx - c.x) * sin + (bz - c.z) * cos;
  SLAB.t0 = 0; SLAB.t1 = 1; // module scratch, no closure: this runs per collider per ray in the sword's hot path
  return slab(alx, blx, -c.hw, c.hw) && slab(alz, blz, -c.hd, c.hd) && slab(ay, by, c.yBottom, c.yTop) ? SLAB.t0 : -1;
}


/** the segment a → b is blocked by a box that contains neither end (see the header) */
export function segmentBlocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number, colliders: readonly BoxCollider[]): boolean {
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
  for (const c of colliders) {
    // broad phase: the box's bounding circle against the segment's xz bounds
    const r = Math.hypot(c.hw, c.hd);
    if (c.x + r < minX || c.x - r > maxX || c.z + r < minZ || c.z - r > maxZ) continue;
    if (!segmentHitsBox(c, ax, ay, az, bx, by, bz)) continue;
    if (insideBox(c, ax, ay, az) || insideBox(c, bx, by, bz)) continue;
    return true;
  }
  return false;
}

/** the first entry (fraction along a → b) into a box that does not hold `a`, or -1 (see the header) */
export function segmentEntry(ax: number, ay: number, az: number, bx: number, by: number, bz: number, colliders: readonly BoxCollider[]): number {
  const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
  let best = -1;
  for (const c of colliders) {
    const r = Math.hypot(c.hw, c.hd);
    if (c.x + r < minX || c.x - r > maxX || c.z + r < minZ || c.z - r > maxZ) continue;
    const t = segmentBoxT(c, ax, ay, az, bx, by, bz);
    if (t < 0 || (best >= 0 && t >= best) || insideBox(c, ax, ay, az)) continue;
    best = t;
  }
  return best;
}

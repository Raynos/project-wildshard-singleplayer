/**
 * MeleeSweep — the pure geometry of the sword's blade-swept hit test (Sword.ts, C1 / B5), kept free of three.js so it
 * is unit-tested (test/melee-sweep.test.ts).
 *
 *   segmentBlocked(ax, ay, az, bx, by, bz, colliders) → true when the segment eye → hit point passes through a collider
 *     box (Player.ts oriented boxes: the hut walls, the wreck hull, boulders, palm trunks) that contains NEITHER end —
 *     no hits through a wall; standing inside a box (the hold under the wreck's deck) or hitting something inside one
 *     (the drowned sailor rising through the hull) still works.
 */

/** Player.ts's oriented box: centre (x, z), half extents (hw, hd) in its own frame, `rot` (the frame is R(-rot)), y range */
export interface BoxCollider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const EPS = 1e-9;

/** true when (x, y, z) is inside the box */
export function insideBox(c: BoxCollider, x: number, y: number, z: number): boolean {
  if (y < c.yBottom || y > c.yTop) return false;
  const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
  const lx = (x - c.x) * cos - (z - c.z) * sin, lz = (x - c.x) * sin + (z - c.z) * cos;
  return Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd;
}

/** the segment a → b crosses the box (slab test in the box's frame) */
export function segmentHitsBox(c: BoxCollider, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
  const alx = (ax - c.x) * cos - (az - c.z) * sin, alz = (ax - c.x) * sin + (az - c.z) * cos;
  const blx = (bx - c.x) * cos - (bz - c.z) * sin, blz = (bx - c.x) * sin + (bz - c.z) * cos;
  let t0 = 0, t1 = 1;
  const slab = (a: number, b: number, lo: number, hi: number): boolean => {
    const d = b - a;
    if (Math.abs(d) < EPS) return a >= lo && a <= hi;
    let u = (lo - a) / d, v = (hi - a) / d;
    if (u > v) { const w = u; u = v; v = w; }
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    return t0 <= t1;
  };
  return slab(alx, blx, -c.hw, c.hw) && slab(alz, blz, -c.hd, c.hd) && slab(ay, by, c.yBottom, c.yTop);
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

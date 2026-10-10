import * as THREE from 'three';

/**
 * Spots picked off a skinned hull's bind-pose vertices around one of its bones (SHARD-PLATFORM M3, the kit system): a
 * crown's or a rack's tips for things to hang from. Among the vertices higher than the bone's rest position by `above`
 * and within `reachZ` of it along z, the spots are the leftmost and the rightmost vertex and (when there is one) the
 * highest vertex about `middle.frac` of the way out to the rightmost x (within `middle.tol` of that x's size), each
 * `drop` under its vertex, in the bone's frame (model units). Every number is the shard's row.
 */

/** Where to look on the hull and how far under each tip a spot hangs (a shard's data row). */
export interface HullSpotsRow {
  /** the bone the spots are measured from (its bind position) */
  readonly bone: string;
  /** a vertex counts above the bone by more than this (model units) … */
  readonly above: number;
  /** … and within this of it along z */
  readonly reachZ: number;
  /** the middle spot: the highest vertex whose x is within `tol` × |right x| of `frac` × right x */
  readonly middle: { readonly frac: number; readonly tol: number };
  /** each spot hangs this far under its vertex */
  readonly drop: number;
}

/**
 * The hull's spots in `row.bone`'s frame: [left, right, middle] (the middle left out when none is found); null when the
 * skeleton has no such bone or nothing stands above it.
 */
export function hullSpots(mesh: THREE.SkinnedMesh, row: HullSpotsRow): [number, number, number][] | null {
  // the bone's rest position, from the skeleton's bind (model units, the rig's own joints)
  const sk = mesh.skeleton, hi = sk.bones.findIndex((b) => b.name === row.bone), inv = sk.boneInverses[hi];
  if (hi === -1 || !inv) return null;
  const hp = new THREE.Vector3().setFromMatrixPosition(inv.clone().invert());
  const head: [number, number, number] = [hp.x, hp.y, hp.z];
  const P = mesh.geometry.getAttribute('position');
  let left = -1, right = -1, mid = -1, lx = Infinity, rx = -Infinity, best = -Infinity;
  const above = (i: number): boolean => P.getY(i) > head[1] + row.above && Math.abs(P.getZ(i) - head[2]) < row.reachZ;
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    const x = P.getX(i);
    if (x < lx) { lx = x; left = i; }
    if (x > rx) { rx = x; right = i; }
  }
  if (left < 0 || right < 0) return null;
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    const x = P.getX(i);
    if (Math.abs(x - rx * row.middle.frac) < Math.abs(rx) * row.middle.tol && P.getY(i) > best) { best = P.getY(i); mid = i; }
  }
  const at = (i: number): [number, number, number] => [P.getX(i) - head[0], P.getY(i) - head[1] - row.drop, P.getZ(i) - head[2]];
  return mid >= 0 ? [at(left), at(right), at(mid)] : [at(left), at(right)];
}

import { Matrix4, Vector3 } from 'three';

/**
 * Seat a TRELLIS dragon head on the jian IN PROFILE (the targets' pose, round-6 A / B): its crown (glTF +Y) up the
 * blade (+y), its snout (glTF +Z) out to the blade's lower side (−x), its flank (glTF +X) toward the eye (+z). Scaled so
 * its snout-to-back length is `len` m, its centre at (`dx`, `dy`, 0).
 */
export function guardMatrix(bbox: { min: Vector3; max: Vector3 }, len: number, dx: number, dy: number, tilt: number): Matrix4 {
  const basis = new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(-1, 0, 0));
  const s = len / Math.max(bbox.max.z - bbox.min.z, 1e-4);
  const c = bbox.min.clone().add(bbox.max).multiplyScalar(0.5);
  const toOrigin = new Matrix4().makeTranslation(-c.x, -c.y, -c.z);
  const tiltM = new Matrix4().makeRotationZ(tilt);
  const lift = new Matrix4().makeTranslation(dx, dy, 0);
  return lift.multiply(tiltM).multiply(basis).multiply(new Matrix4().makeScale(s, s, s)).multiply(toOrigin);
}

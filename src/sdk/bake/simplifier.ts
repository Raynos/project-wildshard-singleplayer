import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

await MeshoptSimplifier.ready;

/** Author bakes simplify through the SDK (shard generators import only three, the SDK and commons): meshoptimizer's
 *  simplifier on an indexed position set, keeping every surface within `error` metres. Borders are free unless
 *  `lockBorder`. Returns the kept triangle indices. */
export function simplifyWithin(indices: Uint32Array, positions: Float32Array, error: number, lockBorder = false): Uint32Array {
  const scale = MeshoptSimplifier.getScale(positions, 3);
  return MeshoptSimplifier.simplify(indices, positions, 3, 0, error / scale, lockBorder ? ['LockBorder'] : [])[0];
}

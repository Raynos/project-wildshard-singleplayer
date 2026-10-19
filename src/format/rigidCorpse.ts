import * as v from 'valibot';

const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-20), v.maxValue(20));
const point = v.strictTuple([coordinate, coordinate, coordinate]);
/** Noncoplanar finite points are required; Rapier remains the convex hull constructor. */
function volumetric(points: readonly (readonly [number, number, number])[]): boolean {
  const origin = points[0]; if (origin === undefined) return false;
  let axis: readonly [number, number, number] = [0, 0, 0], length = 0;
  for (const p of points) {
    const delta: [number, number, number] = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
    const size = delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2;
    if (size > length) { axis = delta; length = size; }
  }
  let normal: readonly [number, number, number] = [0, 0, 0], area = 0;
  for (const p of points) {
    const x = p[0] - origin[0], y = p[1] - origin[1], z = p[2] - origin[2];
    const cross: [number, number, number] = [axis[1] * z - axis[2] * y, axis[2] * x - axis[0] * z, axis[0] * y - axis[1] * x];
    const size = cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2;
    if (size > area) { normal = cross; area = size; }
  }
  return points.some(p => Math.abs(normal[0] * (p[0] - origin[0]) + normal[1] * (p[1] - origin[1]) + normal[2] * (p[2] - origin[2])) > 1e-9);
}
const part = v.strictObject({
  bone: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  points: v.pipe(v.array(point), v.minLength(4), v.maxLength(128), v.check(points => volumetric(points), 'Degenerate rigid corpse hull')),
});
/** Strict inert presentation recipe. Bone-local bind units; runtime rig and hull checks remain mandatory. */
export const rigidCorpseSchema = v.pipe(v.strictObject({
  parts: v.pipe(v.array(part), v.minLength(1), v.maxLength(8)),
}), v.check(row => new Set(row.parts.map(p => p.bone)).size === row.parts.length
  && row.parts.reduce((count, p) => count + p.points.length, 0) <= 512, 'Invalid rigid corpse part budget'));

/** Copy every nested coordinate; absent dimensions must omit the optional property altogether. */
export function copyRigidCorpse(row: v.InferOutput<typeof rigidCorpseSchema>): v.InferOutput<typeof rigidCorpseSchema> {
  return { parts: row.parts.map(p => ({ bone: p.bone, points: p.points.map(([x, y, z]) => [x, y, z]) })) };
}

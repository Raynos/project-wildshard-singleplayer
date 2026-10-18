import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite());
const xyz = v.tuple([finite, finite, finite]);
const reference = v.strictObject({ library: id, model: id });
/** Shared presentation primitives retain authored draw order and GPU seeds. */
export const SceneDrawSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('card'), material: id, geometry: reference, scale: v.union([finite, xyz]), at: v.optional(xyz, [0, 0, 0]), order: finite, name: id }),
  v.strictObject({ kind: v.literal('points'), name: id, material: id, count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(4096)), scale: finite, y: finite }),
  v.strictObject({ kind: v.literal('pool'), geometry: reference, material: id }),
]);
export const SceneDrawsSchema = v.pipe(v.array(SceneDrawSchema), v.maxLength(32));
export type SceneDraw = v.InferOutput<typeof SceneDrawSchema>;

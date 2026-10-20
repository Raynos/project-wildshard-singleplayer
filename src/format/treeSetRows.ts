import * as v from 'valibot';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const ids = (max: number) => v.pipe(v.array(id), v.maxLength(max));
/**
 * A baked tree set as rows (G474 forest presentation; client-only): its rest geometry pool (`<variant>__<part>` parts,
 * part = trunk / trunkLo / hi / lo / twigs / far), the four look.materials graphs it wears (compiled from `product`'s
 * look rows, lent the set's card, impostor and bark textures from `/assets/models/<set>/`), the atlases' anisotropy, its
 * variants in the forest's order (the trunk capsule scaled by `collider`) and the model card the forest draws it as.
 */
export const TreeSetSchema = v.strictObject({
  product: id, set: id,
  geometry: v.strictObject({ url: id, parts: ids(128),
    channels: v.pipe(v.array(v.strictObject({ name: id, source: id, width: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(4)), parts: v.exactOptional(ids(128)) })), v.maxLength(16)) }),
  looks: v.strictObject({ bark: id, needles: id, twigs: id, far: id }),
  anisotropy: v.strictObject({ cards: v.pipe(n, v.minValue(1), v.maxValue(16)), far: v.pipe(n, v.minValue(1), v.maxValue(16)) }),
  tintBark: v.boolean(),
  model: v.strictObject({ id, name: id, file: id }),
  variants: v.pipe(v.array(v.strictObject({ name: id, label: id, species: id, height: n, trunk: n, collider: n })), v.minLength(1), v.maxLength(32)),
});
/** A validated tree set. */
export type TreeSetRows = v.InferOutput<typeof TreeSetSchema>;

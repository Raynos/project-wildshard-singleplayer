import * as v from 'valibot';

/**
 * G348 (Jake: the near and far placeholders are generic features for any shard, with no per-shard code): what a shard
 * declares, as its own data, to steer the placeholder bake. Absent fields take the bake's generic defaults: the ground
 * is the shard's baked `terrain.bin`, and a forest drawn by its own tree model is stood in by one generic conifer.
 */
const byte = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255));
const unit = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
/** sRGB 0..255 */
const rgb = v.tuple([byte, byte, byte]);
/**
 * One stand-in tree shape, unit high (scaled by the placement's height): an optional stem (top, radius, colour) and the
 * crown's rings (height, radius) under its apex, in the crown colour; `species` matches the forest placement's species.
 */
export const PlaceholderTreeSchema = v.strictObject({
  species: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/u)),
  stem: v.nullable(v.tuple([unit, unit, rgb])),
  rings: v.pipe(v.array(v.tuple([unit, unit])), v.maxLength(6)),
  crown: rgb,
});
/**
 * A shard's whole placeholder steer (its manifest's `placeholder` row): where its ground comes from and how its forest is
 * stood in; every field is optional and an empty row means the bake's generic defaults.
 */
export const PlaceholderSourceSchema = v.strictObject({
  /** a ground built by the shard's own generator instead of its `terrain.bin`: a module under its `generators/` and the
   *  export that returns the native terrain bytes */
  ground: v.optional(v.strictObject({
    generator: v.pipe(v.string(), v.regex(/^generators\/[A-Za-z0-9_/-]+\.ts$/u)),
    export: v.pipe(v.string(), v.regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u)),
  })),
  /** the forest's stand-in shapes by species; a species without a row takes the first row */
  trees: v.optional(v.pipe(v.array(PlaceholderTreeSchema), v.minLength(1), v.maxLength(16))),
});
/** One admitted stand-in tree shape (`PlaceholderTreeSchema`): species, optional stem, crown rings and colour, unit high. */
export type PlaceholderTree = v.InferOutput<typeof PlaceholderTreeSchema>;
/** A shard's admitted placeholder steer (`PlaceholderSourceSchema`), as the near / far bake reads it. */
export type PlaceholderSource = v.InferOutput<typeof PlaceholderSourceSchema>;

/** Admit a shard's declared placeholder source; throws with the shard's name on a malformed row. */
export function placeholderSource(slug: string, value: unknown): PlaceholderSource {
  if (value === undefined) return {};
  const result = v.safeParse(PlaceholderSourceSchema, value);
  if (!result.success) throw new Error(`${slug}: invalid placeholder source: ${result.issues.map((issue) => issue.message).join('; ')}`);
  return result.output;
}

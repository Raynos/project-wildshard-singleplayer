import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9_]*$/u), v.maxLength(64));
const rgb = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff));
/** fixed-length vectors, read-only once admitted (as generated rows are) */
const tuple2 = v.pipe(v.tuple([finite, finite]), v.transform((t): readonly [number, number] => t));
const tuple3 = v.pipe(v.tuple([finite, finite, finite]), v.transform((t): readonly [number, number, number] => t));
const tuple4 = v.pipe(v.tuple([finite, finite, finite, finite]), v.transform((t): readonly [number, number, number, number] => t));

/** A uniform as data (game/plugin/shaderFamily `UniformRow`): a number, a colour, a vector (a v3 may be normalized), or a
 *  bounded array of vec4s or colours. */
export const UniformRowSchema = v.union([finite, v.strictObject({ rgb }),
  v.strictObject({ v2: tuple2 }), v.strictObject({ v3: tuple3, normalize: v.exactOptional(v.boolean()) }), v.strictObject({ v4: tuple4 }),
  v.strictObject({ v4s: v.pipe(v.array(tuple4), v.maxLength(64), v.transform((rows): readonly (readonly [number, number, number, number])[] => rows)) }),
  v.strictObject({ rgbs: v.pipe(v.array(rgb), v.maxLength(64), v.transform((rows): readonly number[] => rows)) })]);
/** A named set of uniform rows (at most 256). */
export const UniformRowsSchema = v.pipe(v.record(name, UniformRowSchema), v.check(rows => Object.keys(rows).length <= 256, 'At most 256 uniforms'));
export type UniformRowsInput = v.InferInput<typeof UniformRowsSchema>;

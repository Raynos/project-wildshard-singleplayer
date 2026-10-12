import * as v from 'valibot';

/**
 * Light rows (DS1.4): the local lights a scene places — a three.js `PointLight` or `SpotLight` read by the SDK scene
 * reader (`@wildshard/sdk/scene` `readScene`). The sun, sky / ground and ambient are look rows (`look.keys`), never light
 * rows. A row is pure data in three.js's own units: `colour` is linear (three's working colour space), `intensity` is
 * candela, `distance` is the cutoff in metres (0 = none) and `decay` the falloff exponent (2 = physical). A spot adds its
 * world-space `target`, its cone half-angle `angle` (radians) and `penumbra` (0 hard … 1 soft).
 *
 * Bounded so a scene can never ask the renderer for an unbounded light loop: at most `LIGHT_ROWS_MAX` rows.
 */

/** the most light rows a scene may declare */
export const LIGHT_ROWS_MAX = 64;

const finite = v.pipe(v.number(), v.finite());
const nonNegative = v.pipe(finite, v.minValue(0));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const vec3 = v.tuple([finite, finite, finite]);
const colour = v.tuple([nonNegative, nonNegative, nonNegative]);
const base = { id, position: vec3, colour, intensity: v.pipe(nonNegative, v.maxValue(1e6)), distance: v.pipe(nonNegative, v.maxValue(10_000)), decay: v.pipe(nonNegative, v.maxValue(8)) };

/** One point light: an omnidirectional emitter at `position`. */
export const PointLightRowSchema = v.strictObject({ kind: v.literal('point'), ...base });
/** One spot light: a cone from `position` toward `target`. */
export const SpotLightRowSchema = v.strictObject({
  kind: v.literal('spot'), ...base, target: vec3,
  angle: v.pipe(finite, v.minValue(1e-4), v.maxValue(Math.PI / 2)), penumbra: v.pipe(finite, v.minValue(0), v.maxValue(1)),
});
/** Any light row, discriminated by `kind`. */
export const LightRowSchema = v.variant('kind', [PointLightRowSchema, SpotLightRowSchema]);
/** A scene's light rows: unique ids, at most `LIGHT_ROWS_MAX`. */
export const LightRowsSchema = v.pipe(
  v.array(LightRowSchema), v.maxLength(LIGHT_ROWS_MAX),
  v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'light row ids are unique'),
);
/** A validated light row. */
export type LightRow = v.InferOutput<typeof LightRowSchema>;

/** Validate light rows; throws a readable error on bad data. */
export function parseLightRows(input: unknown): LightRow[] {
  const r = v.safeParse(LightRowsSchema, input);
  if (!r.success) throw new Error(`light rows: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** Data-only client weather bindings; safe for schema discovery in Node. */
import * as v from 'valibot';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1));
/** Native presentation bindings are resource ids and numeric policies only. */
export const ForestWeatherSchema = v.strictObject({
  files: v.strictObject({ observations: id, rain: id, program: id, shelter: id }),
  channels: id, debug: id, heldPhase: n,
  focus: v.strictObject({ kind: id, variant: id, near: n, threshold: n, retention: n, height: n, radius: n, gain: n }),
  system: v.strictObject({ id, after: v.array(id), before: v.array(id) }),
});
export type ForestWeatherRows = v.InferOutput<typeof ForestWeatherSchema>;

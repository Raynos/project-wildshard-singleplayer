import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const field = v.picklist(['pan', 'gain', 'strength', 'sprinting', 'surface', 'point', 'dir', 'speed', 'heavy', 'kind', 'killed', 'clang', 'headshot', 'phase']);
const scalar = v.union([finite, v.boolean(), id]);
const condition = v.variant('op', [
  v.strictObject({ op: v.literal('present'), field }), v.strictObject({ op: v.literal('number'), field }),
  v.strictObject({ op: v.literal('equals'), field, value: scalar }),
  v.strictObject({ op: v.literal('in'), field, values: v.pipe(v.array(scalar), v.minLength(1), v.maxLength(32)) }),
]);
const conditions = v.pipe(v.array(condition), v.maxLength(16));
const defaults = v.strictObject({ pan: v.optional(v.pipe(finite, v.minValue(-1), v.maxValue(1))),
  gain: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(8))), strength: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(8))),
  speed: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(60))), heavy: v.optional(v.boolean()), killed: v.optional(v.boolean()),
  sprinting: v.optional(v.boolean()), surface: v.optional(id), kind: v.optional(id), phase: v.optional(id), clang: v.optional(v.picklist(['wood', 'stone'])) });
const action = v.strictObject({ voice: id, when: v.optional(conditions, []), defaults: v.optional(defaults, {}),
  delay: v.optional(v.nullable(v.pipe(finite, v.minValue(0), v.maxValue(60))), null) });
/** Ordered bounded cue rules dispatch admitted catalogue voices, with optional conditions, defaults and scope-owned delayed actions. No author callbacks. */
export const AudioRoutingSchema = v.pipe(v.array(v.strictObject({ id, when: v.optional(conditions, []),
  actions: v.pipe(v.array(action), v.maxLength(16)) })), v.maxLength(512));
/** Canonical cue routes accepted by the audio interpreter; array order preserves today's dispatch boundaries. */
export type AudioRouting = v.InferOutput<typeof AudioRoutingSchema>;
/** Validate author cue routing before any sound is scheduled or installed. */
export function parseAudioRouting(input: unknown): AudioRouting { return v.parse(AudioRoutingSchema, input); }

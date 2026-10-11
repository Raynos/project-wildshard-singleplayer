import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9_-]*$/u), v.maxLength(64));
/** An elite fight script's declaration: its module, parameters, slots, modes, voices, lanes, contacts and own actions. */
export const EliteScriptSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('elite-script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  /** the fight's numeric state, with its spawn values */
  slots: v.pipe(v.array(v.strictObject({ field: name, initial: finite })), v.maxLength(8)),
  /** every mode the elite's brain can be in (the input and the `mode` verb use the index) */
  modes: v.pipe(v.array(name), v.minLength(1), v.maxLength(16)),
  /** the voices the `voice` verb names */
  voices: v.pipe(v.array(name), v.maxLength(16)),
  /** a lane that steps before the call while the elite is in `mode`; its hit shakes the view by `trauma` */
  lanes: v.pipe(v.array(v.strictObject({ mode: name, lane: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7)), trauma: finite })), v.maxLength(8)),
  /** the measured contacts the `contact` verb runs: on a hit, the stun seconds (0: none), then the blow, then the shake */
  contacts: v.pipe(v.array(v.strictObject({ strike: key, throughWalls: v.boolean(), stun: finite, trauma: finite })), v.maxLength(8)),
  /** the shard's own actions the `action` verb names (a fade, a burst from a den, a call for rivals) */
  actions: v.pipe(v.array(name), v.maxLength(8)),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(40)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
}), v.check(row => new Set(row.slots.map(s => s.field)).size === row.slots.length && new Set(row.modes).size === row.modes.length,
  'Unique elite script slots and modes'));
/** Validated elite script data. */
export type EliteScriptData = v.InferOutput<typeof EliteScriptSchema>;
/** Validate before admission or allocation. */
export function parseEliteScript(input: unknown): EliteScriptData { return v.parse(EliteScriptSchema, input); }


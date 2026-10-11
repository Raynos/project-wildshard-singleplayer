import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const id = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9_]*$/u), v.maxLength(64));
/** A script species brain's declaration: its module, parameters, state slots, actor memory and strike catalogue. */
export const ScriptSpeciesSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  /** the creature's numeric state, with its spawn values */
  slots: v.pipe(v.array(finite), v.maxLength(8)),
  /** actor memory fields the module reads and writes (a pose's `mem`), with their spawn values */
  memory: v.pipe(v.array(v.strictObject({ field, initial: finite })), v.maxLength(4)),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
  strikes: v.pipe(v.array(v.strictObject({ event: id, strike: key })), v.minLength(1), v.maxLength(8)),
}), v.check(row => new Set(row.strikes.map(s => s.event)).size === row.strikes.length && new Set(row.memory.map(m => m.field)).size === row.memory.length,
  'Unique script species strikes and memory fields'));
/** Validated script species data. */
export type ScriptSpeciesData = v.InferOutput<typeof ScriptSpeciesSchema>;
/** Validate before admission or allocation. */
export function parseScriptSpecies(input: unknown): ScriptSpeciesData { return v.parse(ScriptSpeciesSchema, input); }


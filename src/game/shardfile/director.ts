import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000));
const id = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const event = v.strictObject({ id, key, direction: v.picklist(['input', 'output']), type: v.picklist(['none', 'boolean', 'number']), min: finite, max: finite });
/** Shard director declarations bound numeric events and observations; grid subscriptions are reserved, with no v1 delivery. */
export const DirectorSchema = v.pipe(v.strictObject({
  id: key, entity: id, module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  inputs: v.pipe(v.array(v.strictObject({ key, min: finite, max: finite })), v.maxLength(16)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  events: v.pipe(v.array(event), v.maxLength(32)),
  subscriptions: v.pipe(v.array(v.strictObject({ event: key, scope: v.picklist(['shard', 'grid']) })), v.maxLength(32)),
}), v.check((data) => new Set(data.inputs.map((row) => row.key)).size === data.inputs.length
  && new Set(data.events.map((row) => row.id)).size === data.events.length && new Set(data.events.map((row) => row.key)).size === data.events.length
  && data.inputs.every((row) => row.min <= row.max) && data.events.every((row) => row.min <= row.max
    && (row.type === 'number' || (row.min === 0 && row.max === (row.type === 'none' ? 0 : 1))))
  && new Set(data.subscriptions.map((row) => `${row.scope}:${row.event}`)).size === data.subscriptions.length
  && data.subscriptions.every((row) => row.scope === 'grid' || data.events.some((entry) => entry.direction === 'input' && entry.key === row.event)), 'Unique, bounded director declarations'));
/** Validated director data, with stable ids and immutable script parameters. */
export type DirectorData = v.InferOutput<typeof DirectorSchema>;
/** Validate before admission, allocation or registration. */
export function parseDirector(input: unknown): DirectorData { return v.parse(DirectorSchema, input); }
/** Typed output delivered only after a successful, atomically committed script call. */
export interface DirectorEvent { director: string; tick: number; key: string; type: 'none' | 'boolean' | 'number'; value: number }

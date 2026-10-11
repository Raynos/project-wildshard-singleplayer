import * as v from 'valibot';

const positive = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const moduleRef = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
/** Numeric entity handles and an optional host-verified actor id bind an admitted module to local sim work. */
export const ScriptBindingsSchema = v.pipe(v.array(v.strictObject({ module: moduleRef, entity: positive, actorId: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), kind: v.picklist(['server', 'entity']) })), v.maxLength(10000));
/** A validated v0 script binding list. */
export type ShardScriptBindings = v.InferOutput<typeof ScriptBindingsSchema>;
/** Reference/identity checks; both actor-bound server logic and actor-free director logic run authoritatively. */
export function scriptBindingRules(bindings: readonly ShardScriptBindings[number][], scripts: readonly string[]): string[] {
  const errors: string[] = [], keys = new Set<string>(), actors = new Map<number, string | null>();
  for (const binding of bindings) {
    const key = `${binding.module}:${binding.entity}`;
    if (!scripts.includes(binding.module)) errors.push('binding module declared in sim.scripts');
    if (keys.has(key)) errors.push('unique script binding'); keys.add(key);
    if (actors.has(binding.entity) && actors.get(binding.entity) !== binding.actorId) errors.push('consistent entity actor binding');
    actors.set(binding.entity, binding.actorId);
  }
  return [...new Set(errors)];
}
/** Format-owned field ids/defaults, with optional authored lower-only bounds. */
export interface ShardScriptField { id: number; name: string; type: 'bool' | 'i32' | 'f64' | 'string'; privacy: 'public' | 'owner' | 'host'; default: boolean | number | string; min?: number | undefined; max?: number | undefined }

import * as v from 'valibot';
import { ScriptLane, type ScriptBinding } from '@wildshard/engine/script/lane';
import { DeclaredScriptWorld, type ScriptStateDeclaration, type ScriptStateField } from '@wildshard/engine/script/state';
import type { EffectRules, ScriptEntity } from '@wildshard/engine/script/effects';
import type { ScriptHostOptions } from '@wildshard/engine/script/host';

const positive = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const moduleRef = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
/** Numeric entity handles and an optional host-verified actor id bind an admitted module to local sim work. */
export const ScriptBindingsSchema = v.pipe(v.array(v.strictObject({ module: moduleRef, entity: positive, actorId: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), kind: v.picklist(['server', 'entity']) })), v.maxLength(10000));
/** A validated v0 script binding list. */
export type ShardScriptBindings = v.InferOutput<typeof ScriptBindingsSchema>;
/** Reference/identity checks; both actor-bound server logic and actor-free director logic run authoritatively. */
export function scriptBindingRules(bindings: readonly ScriptBinding[], scripts: readonly string[]): string[] {
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
export interface ShardScriptField { id: number; name: string; type: 'bool' | 'i32' | 'f64' | 'string'; privacy: 'public' | 'owner' | 'host'; default: boolean | number | string; min?: number; max?: number }
/** Translate only numeric fields; string values never become forged numeric ids. Stable ids determine input order. */
export function numericScriptState(state: { shared: readonly ShardScriptField[]; player: readonly ShardScriptField[] }): ScriptStateDeclaration {
  const fields = (list: readonly ShardScriptField[]): ScriptStateField[] => list.flatMap((f) => {
    if (f.type === 'string') return [];
    const value = f.type === 'bool' && typeof f.default === 'boolean' ? Number(f.default) : f.default;
    if (typeof value !== 'number') throw new Error('Invalid numeric field default');
    const min = f.type === 'bool' ? 0 : f.type === 'i32' ? -2147483648 : -Number.MAX_VALUE;
    const max = f.type === 'bool' ? 1 : f.type === 'i32' ? 2147483647 : Number.MAX_VALUE;
    if ((f.min ?? min) < min || (f.max ?? max) > max) throw new Error('Field bounds may only lower');
    return [{ id: f.id, name: f.name, type: f.type, privacy: f.privacy, default: value, min: f.min ?? min, max: f.max ?? max }];
  });
  return { shared: fields(state.shared), player: fields(state.player) };
}
/** Content slice consumed by the full loader; assets are already hash-verified and schema-validated. */
export interface ShardScriptContent {
  identity: { seed: number }; sim: { scripts: readonly string[]; bindings: readonly ScriptBinding[]; scriptTickDivisor: number };
  state: { shared: readonly ShardScriptField[]; player: readonly ShardScriptField[] };
}
/** Loader-provided identities and query ports: the actor mapping comes from the session, not the shardfile. */
export interface ShardScriptPorts extends Omit<ScriptHostOptions, 'world'> { rules: EffectRules; entities: readonly ScriptEntity[]; actors: ReadonlyMap<number, string> }
/** Create the local authoritative lane explicitly; its constructor admits every module before execution. */
export function createShardfileScriptLane(content: ShardScriptContent, assets: ReadonlyMap<string, Uint8Array>, ports: ShardScriptPorts): ScriptLane {
  const errors = scriptBindingRules(content.sim.bindings, content.sim.scripts); if (errors.length > 0) throw new Error(errors.join('; '));
  const modules = content.sim.scripts.map((name) => {
    const bytes = assets.get(name); if (!bytes) throw new Error(`Missing script bytes ${name}`);
    return { name, bytes, seedLo: content.identity.seed | 0, seedHi: Math.floor(content.identity.seed / 4294967296) | 0 };
  });
  const world = new DeclaredScriptWorld(ports.rules, ports.entities, numericScriptState(content.state), ports.actors);
  return new ScriptLane({ ...ports, world, modules, bindings: content.sim.bindings, divisor: content.sim.scriptTickDivisor });
}

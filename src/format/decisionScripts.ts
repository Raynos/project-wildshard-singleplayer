import * as v from 'valibot';
import { isJsonData } from './json';
import { SCRIPT_V1_COMMANDS, SCRIPT_V1_EVENTS, SCRIPT_V1_LISTS, SCRIPT_V1_READS } from './scriptAbiV1';

function keys<T extends Readonly<Record<string, number>>>(table: T): (keyof T & string)[] { return Object.keys(table); }
const id = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9.:-]*$/u), v.maxLength(128));
const local = v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_.-]*$/u), v.maxLength(64));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const aliases = v.pipe(v.record(local, id), v.check(value => Object.keys(value).length <= 256, 'bounded script id map'));
const unique = (values: readonly unknown[]): boolean => new Set(values).size === values.length;
const readNames = [...keys(SCRIPT_V1_READS), ...keys(SCRIPT_V1_LISTS)];
const state = v.strictObject({ name: local, type: v.picklist(['bool', 'i32', 'f64']), default: v.union([v.boolean(), finite]),
  scope: v.picklist(['binding', 'actor', 'player', 'local']), min: v.exactOptional(finite), max: v.exactOptional(finite) });
/** Named ids that must resolve in another platform section. Timers are binding-local names. */
export const SCRIPT_V1_REFERENCE_KINDS = ['actors', 'moves', 'strikes', 'cues', 'fields', 'flags', 'zones', 'spots', 'targets', 'spawns', 'signals', 'facts', 'rewards', 'channels', 'impulses', 'weather'] as const;
export type ScriptV1ReferenceKind = typeof SCRIPT_V1_REFERENCE_KINDS[number];
const row = v.strictObject({
  id, abi: v.literal('1.0'), side: v.picklist(['sim', 'view']),
  module: v.pipe(v.string(), v.regex(/^blobs\/wasm\/[a-f0-9]{64}\.wasm$/u)),
  source: v.pipe(v.string(), v.maxLength(256), v.regex(/^behaviour\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.as$/u),
    v.check(value => !value.split('/').includes('generated'), 'authored script source, not generated glue')),
  binding: v.union([v.strictObject({ encounter: id }), v.strictObject({ quest: id }), v.strictObject({ zone: id }), v.strictObject({ shard: v.literal(true) }), v.strictObject({ spawnGroup: id })]),
  pages: v.optional(v.pipe(positive, v.maxValue(4)), 1), onFail: v.picklist(['hold', 'reset', 'skip']),
  on: v.pipe(v.array(v.picklist(keys(SCRIPT_V1_EVENTS))), v.minLength(1), v.maxLength(23), v.check(values => unique(values), 'unique subscribed events')),
  tick: v.optional(v.nullable(v.picklist([1, 2, 5, 10])), null),
  reads: v.pipe(v.array(v.picklist(readNames)), v.maxLength(readNames.length), v.check(values => unique(values), 'unique script reads')),
  commands: v.pipe(v.array(v.picklist(keys(SCRIPT_V1_COMMANDS))), v.maxLength(21), v.check(values => unique(values), 'unique script commands')),
  actors: v.optional(aliases, {}), moves: v.optional(aliases, {}), strikes: v.optional(aliases, {}), cues: v.optional(aliases, {}),
  fields: v.optional(aliases, {}), flags: v.optional(aliases, {}), zones: v.optional(aliases, {}), spots: v.optional(aliases, {}),
  targets: v.optional(aliases, {}), spawns: v.optional(aliases, {}), signals: v.optional(aliases, {}), facts: v.optional(aliases, {}),
  rewards: v.optional(aliases, {}), channels: v.optional(aliases, {}), impulses: v.optional(aliases, {}), weather: v.optional(aliases, {}),
  timers: v.optional(v.pipe(v.array(local), v.maxLength(64), v.check(values => unique(values), 'unique timer names')), []),
  stateVersion: positive, state: v.pipe(v.array(state), v.maxLength(16)),
  params: v.pipe(v.record(local, finite), v.check(value => Object.keys(value).length <= 32, 'bounded script parameters')),
});
export type DecisionScriptRow = v.InferOutput<typeof row>;
const reserved = new Set('abstract as assert async await boolean break case catch class const constructor continue debugger declare default delete do else enum export extends false final finally for from function get if implements import in instanceof interface is keyof let namespace never new null number of package private protected public readonly return set static string super switch symbol __proto__ prototype this throw true try type typeof undefined unknown var void while with yield bool i32 i64 f32 f64 usize'.split(' '));
/** The same generated identifier rule applies to all namespaces, slots and parameters. */
export function scriptV1Identifier(name: string): string {
  const value = name.replaceAll(/[._-]+([A-Za-z0-9])/gu, (_match, next: string) => next.toUpperCase());
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value) || reserved.has(name) || reserved.has(value)) throw new Error(`Invalid script binding identifier ${name}`);
  return value;
}
function validNames(names: readonly string[]): boolean {
  try { return unique(names.map(scriptV1Identifier)); } catch { return false; }
}
/** Row-local checks, independent of any renderer, module execution or source-code evaluator. */
export function decisionScriptRowRules(script: DecisionScriptRow): string[] {
  const errors: string[] = [];
  if ('spawnGroup' in script.binding && (script.side !== 'sim' || Object.keys(script.actors).length === 0 || script.state.some(slot => slot.scope !== 'actor')))
    errors.push('spawn groups declare members and actor-scoped simulation state');
  if ((script.tick !== null) !== script.on.includes('tick')) errors.push('tick subscription has a declared 1/2/5/10 Hz rate');
  if (script.side === 'sim' && (script.on.some(name => SCRIPT_V1_EVENTS[name] >= 30) || script.commands.some(name => SCRIPT_V1_COMMANDS[name] >= 100))) errors.push('simulation script uses only simulation ops');
  const viewEvents = new Set(['start', 'tick', 'timer', 'stop', 'flag', 'field', 'cue', 'channel']);
  const viewReads = new Set(['x', 'y', 'z', 'yaw', 'field', 'flag', 'playerFlag', 'random', 'distance', 'bearing']);
  if (script.side === 'view' && (script.on.some(name => !viewEvents.has(name)) || script.commands.some(name => SCRIPT_V1_COMMANDS[name] < 100) || script.reads.some(name => !viewReads.has(name)))) errors.push('view script uses only replicated reads and view ops');
  for (const names of [...SCRIPT_V1_REFERENCE_KINDS.map(kind => Object.keys(script[kind])), script.timers, script.state.map(slot => slot.name), Object.keys(script.params)]) {
    if (!validNames(names)) errors.push('unique nonreserved generated binding names');
  }
  for (const slot of script.state) {
    if ((slot.scope === 'local') !== (script.side === 'view')) errors.push('view state is local; simulation state is durable');
    if (slot.type === 'bool') {
      if (typeof slot.default !== 'boolean' || slot.min !== undefined || slot.max !== undefined) errors.push('typed script state defaults and bounds');
    } else {
      const low = slot.type === 'i32' ? -2147483648 : -Number.MAX_VALUE, high = slot.type === 'i32' ? 2147483647 : Number.MAX_VALUE;
      const min = slot.min ?? low, max = slot.max ?? high;
      if (typeof slot.default !== 'number' || slot.default < min || slot.default > max || min < low || max > high || min > max
        || (slot.type === 'i32' && ![slot.default, min, max].every(Number.isInteger))) errors.push('typed script state defaults and bounds');
    }
  }
  return [...new Set(errors)];
}
function safeInput(value: unknown): boolean {
  if (!isJsonData(value)) return false;
  const safe = (input: unknown): boolean => {
    if (typeof input !== 'object' || input === null) return true;
    return Object.entries(input).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safe(child));
  };
  return safe(value);
}

/** Plain platform section: v1 script rows. Existing v0 bindings remain a separate format during the W1 migration. */
export const DecisionScriptsSchema = v.pipe(v.unknown(), v.check(safeInput, 'plain JSON without unsafe property names'), v.array(v.pipe(row, v.check(value => decisionScriptRowRules(value).length === 0, 'script row semantic rules'))),
  v.maxLength(64), v.check(rows => unique(rows.map(value => value.id)), 'unique script ids'),
  v.check(rows => rows.reduce((count, value) => count + ('spawnGroup' in value.binding ? Object.keys(value.actors).length : 1), 0) <= 64, 'at most 64 logical decision bindings'),
  v.check(rows => new Set(rows.map(value => value.module)).size <= 8, 'at most eight decision modules'));
export type DecisionScripts = v.InferOutput<typeof DecisionScriptsSchema>;
/** Parse unknown direct input only after rejecting accessors, prototypes and non-JSON values. */
export function parseDecisionScripts(input: unknown): DecisionScripts {
  if (!isJsonData(input)) throw new Error('Decision scripts must be plain JSON');
  return v.parse(DecisionScriptsSchema, input);
}
/** One authored group row resolves to one logical invocation/state owner per member.
 * Every invocation still shares the admitted module image. Alias order never changes identities.
 */
export function actorDecisionRows(script: DecisionScriptRow): readonly DecisionScriptRow[] {
  if (!('spawnGroup' in script.binding)) return [script];
  const members: DecisionScriptRow[] = [];
  for (const [alias, actor] of Object.entries(script.actors).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    members.push({ ...script, id: `${script.id}.actor.${alias}`, actors: { [alias]: actor } });
  }
  return members;
}
/** Cross-section facts come from admitted platform registries, never from aliases in the script row itself. */
export interface DecisionScriptReferences {
  modules: ReadonlyMap<string, { abi: number; pages: number }>;
  ids: Readonly<Partial<Record<ScriptV1ReferenceKind, ReadonlySet<string>>>>;
  bindings: { encounters: ReadonlySet<string>; quests: ReadonlySet<string>; zones: ReadonlySet<string> };
  migrations: readonly { scope: string; from: number; to: number }[];
}
/** Every alias resolves in the matching registry, memory matches admitted bytes and migrations reach the latest slots. */
export function decisionScriptRules(scripts: readonly DecisionScriptRow[], references: DecisionScriptReferences): string[] {
  const errors: string[] = [];
  for (const script of scripts) {
    errors.push(...decisionScriptRowRules(script));
    const module = references.modules.get(script.module);
    if (module?.abi !== 1 || module.pages !== script.pages) errors.push('script module has matching admitted ABI and fixed pages');
    for (const kind of SCRIPT_V1_REFERENCE_KINDS) for (const value of Object.values(script[kind])) {
      if (references.ids[kind]?.has(value) !== true) errors.push(`script ${kind} reference resolves in its platform section`);
    }
    const binding = script.binding;
    if (('encounter' in binding && !references.bindings.encounters.has(binding.encounter))
      || ('quest' in binding && !references.bindings.quests.has(binding.quest))
      || ('zone' in binding && !references.bindings.zones.has(binding.zone))) errors.push('script binding resolves in its platform section');
    const migrations = references.migrations.filter(value => value.scope === `script:${script.id}`);
    if (!unique(migrations.map(value => value.from)) || migrations.some(value => !Number.isSafeInteger(value.from) || value.from < 1 || value.to !== value.from + 1 || value.to > script.stateVersion)) errors.push('unambiguous consecutive script migrations');
    const chain = [...migrations].sort((a, b) => a.from - b.from);
    if (chain.length !== script.stateVersion - 1 || chain.some((value, index) => value.from !== index + 1 || value.to !== index + 2)) errors.push('script migration chain reaches stateVersion');
  }
  return [...new Set(errors)];
}

/** A live species lends its existing body/encounter to one admitted decision script.
 * Presentation fields and contact impulses are names/numbers, never shard callbacks.
 */
export const BorrowedDecisionSchema = v.pipe(v.strictObject({ script: id, actor: v.exactOptional(id), group: v.exactOptional(id), perch: v.exactOptional(id),
  leanField: v.exactOptional(local), bankField: v.exactOptional(local),
  guard: v.exactOptional(v.strictObject({ field: local, activeValue: finite, multiplier: v.pipe(finite, v.minValue(0), v.maxValue(4)) })),
  marks: v.exactOptional(v.strictObject({ fight: local, phase: local })),
  idle: v.exactOptional(v.strictObject({ move: id, progress: local })),
  strikeEffects: v.pipe(v.array(v.strictObject({ strike: id, aimHeight: finite, speed: v.pipe(finite, v.minValue(0), v.maxValue(40)),
    lift: v.pipe(finite, v.minValue(0), v.maxValue(40)) })), v.maxLength(32)),
}), v.check(value => (value.actor === undefined) !== (value.group === undefined), 'one actor or spawn group owner'));
export type BorrowedDecision = v.InferOutput<typeof BorrowedDecisionSchema>;

import { isJsonData } from '@wildshard/format/json';
import { trustedLevel } from '@wildshard/game/plugin/simulation';
import { createSimHost } from '@wildshard/engine/sim';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import { installNativeBodyScripts } from '@wildshard/game/quest/nativeBodyScripts';
import { hasStaticGround } from '@wildshard/engine/physics/query';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan, HeadlessRuntimePreparation } from './headlessRuntime';

/** Static imports supplied by the trusted caller and checked by the producer.
 * Keys are repository-local module identifiers, never URLs to load at runtime. */
export type HeadlessAssemblyModules = Readonly<Record<string, object>>;
type Value = null | boolean | number | string | readonly Value[] | { readonly [key: string]: Value };
interface Row { readonly name: string; readonly value: Value }
interface Assembly { readonly version: 1; readonly modules: Readonly<Record<string, readonly string[]>>;
  readonly constants: Value;
  readonly prepare: readonly Row[]; readonly install: readonly Row[]; readonly level: Value; readonly ports: Value;
  readonly entries: Value }
interface NativeInstallation { readonly host: ReturnType<typeof createSimHost>; readonly context: HeadlessRuntimeInstallation; readonly preparation: HeadlessRuntimePreparation }
interface Environment { readonly values: Map<string, unknown>; readonly parent?: Environment; readonly native?: NativeInstallation }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const callable = (value: unknown): value is (...args: readonly unknown[]) => unknown => typeof value === 'function';
const valueList = (value: Value | undefined): value is readonly Value[] => Array.isArray(value);
const safeKey = (key: string): boolean => key.length > 0 && key.length <= 256 && !['__proto__', 'prototype', 'constructor', 'caller', 'callee', 'arguments'].includes(key);
const operations = new Set(['$ref', '$call', '$new', '$fn', '$set', '$if', '$or', '$coalesce', '$eq', '$not', '$sequence', '$native']);


function valueData(value: unknown, depth = 0): value is Value {
  if (depth > 48) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 4096 && value.every((item: unknown) => valueData(item, depth + 1));
  if (!record(value)) return false;
  const entries = Object.entries(value), tags = entries.filter(([key]) => key.startsWith('$'));
  return entries.length <= 256 && (tags.length === 0 || (entries.length === 1 && operations.has(tags[0]?.[0] ?? '')))
    && entries.every(([key, item]) => safeKey(key) && valueData(item, depth + 1));
}
function rows(value: unknown): value is readonly Row[] {
  return Array.isArray(value) && value.length <= 256 && value.every((row: unknown) => record(row)
    && Object.keys(row).length === 2 && typeof row['name'] === 'string' && safeKey(row['name']) && valueData(row['value']))
    && new Set(value.map((row: Row) => row.name)).size === value.length;
}
/** Build-time admission checks the exact statically imported export catalogue.
 * Runtime repeats admission against those same imports; neither boundary resolves
 * strings into modules, evaluates source, installs services or creates a clock. */
export function checkedHeadlessAssembly(input: unknown, modules: HeadlessAssemblyModules): Assembly {
  if (!isJsonData(input) || !record(input) || input['version'] !== 1 || !record(input['modules'])
    || !rows(input['prepare']) || !rows(input['install']) || !valueData(input['level']) || !valueData(input['ports']) || !valueData(input['entries'])
    || !valueData(input['constants']) || Object.keys(input).sort().join(',') !== 'constants,entries,install,level,modules,ports,prepare,version') throw new Error('Invalid trusted headless assembly');
  const declared: Record<string, readonly string[]> = {};
  const names = new Set(['assembly', 'shard', 'assets', 'product', 'rapier', 'host', 'context', 'constants', 'args', 'level', 'ports', 'absent']);
  for (const row of [...input['prepare'], ...input['install']]) {
    if (names.has(row.name)) throw new Error('Assembly binding conflicts with an existing owner'); names.add(row.name);
  }
  for (const [name, exports] of Object.entries(input['modules'])) {
    if (!/^(?:@wildshard\/[a-z]+\/|src\/(?:shards|game|engine|sdk)\/)[A-Za-z0-9_./-]+$/u.test(name)
      || name.split('/').includes('..') || !Array.isArray(exports) || exports.length > 256
      || !exports.every((key: unknown): key is string => typeof key === 'string' && safeKey(key))
      || new Set(exports).size !== exports.length) throw new Error('Invalid trusted module declaration');
    const supplied = modules[name];
    if (supplied === undefined || exports.some(key => !Object.hasOwn(supplied, key))) throw new Error(`Missing static assembly exports: ${name}`);
    declared[name] = exports;
  }
  if (Object.keys(declared).length !== Object.keys(modules).length) throw new Error('Assembly module catalogue differs from its static imports');
  let bodyScripts = false;
  const inspect = (value: Value, native = false): void => {
    if (valueList(value)) { for (const child of value) inspect(child); return; }
    if (value === null || typeof value !== 'object') return;
    if ('$native' in value) {
      if (!native || value['$native'] !== 'native.body-scripts' || bodyScripts) throw new Error('Invalid native assembly capability');
      bodyScripts = true; return;
    }
    const path = value['$ref'];
    if (path !== undefined) {
      if (!valueList(path) || typeof path[0] !== 'string' || path.length > 16 || path.length === 0
        || path.slice(1).some(key => (typeof key !== 'string' && typeof key !== 'number') || !safeKey(String(key)))) throw new Error('Invalid assembly reference');
      const exports = declared[path[0]];
      if (!names.has(path[0]) && exports === undefined) throw new Error('Unknown assembly binding');
      if ((path[0].startsWith('src/') || path[0].startsWith('@wildshard/'))
        && (exports === undefined || typeof path[1] !== 'string' || !exports.includes(path[1]))) throw new Error('Undeclared assembly export');
    }
    for (const child of Object.values(value)) inspect(child);
  };
  // Constants are literal data: reject reserved native expressions without
  // interpreting ordinary literal references stored inside them.
  const inspectConstants = (value: Value): void => {
    if (value === null || typeof value !== 'object') return;
    if (!valueList(value) && Object.hasOwn(value, '$native')) throw new Error('Native capability is not constant data');
    for (const child of Object.values(value)) inspectConstants(child);
  };
  inspectConstants(input['constants']);
  for (const row of input['prepare']) inspect(row.value);
  for (const row of input['install']) inspect(row.value, true);
  inspect(input['entries']); inspect(input['level']); inspect(input['ports']);
  return { version: 1, modules: declared, constants: input['constants'], prepare: input['prepare'], install: input['install'], level: input['level'], ports: input['ports'], entries: input['entries'] };
}
function lookup(env: Environment, name: string): unknown {
  if (env.values.has(name)) return env.values.get(name);
  return env.parent === undefined ? undefined : lookup(env.parent, name);
}
function member(owner: unknown, key: unknown): unknown {
  if (owner === null || owner === undefined) return undefined;
  if ((typeof owner !== 'object' && typeof owner !== 'function') || (typeof key !== 'string' && typeof key !== 'number') || !safeKey(String(key))) throw new Error('Invalid assembly member');
  const value: unknown = Reflect.get(owner, key); return value;
}
function list(value: Value | undefined): readonly Value[] {
  if (!valueList(value)) throw new Error('Assembly operation requires a list');
  return value;
}
function evaluate(value: Value, env: Environment): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (valueList(value)) return value.map(item => evaluate(item, env));
  if (!record(value)) throw new Error('Invalid assembly expression');
  const entries = Object.entries(value), first = entries[0];
  if (first === undefined || !first[0].startsWith('$')) return Object.fromEntries(entries.map(([key, item]) => [key, evaluate(item, env)]));
  const [op, input] = first;
  if (op === '$ref') {
    const path = list(input), root = path[0];
    if (typeof root !== 'string' || path.length > 16) throw new Error('Invalid assembly reference');
    let result = lookup(env, root);
    for (const [index, key] of path.slice(1).entries()) {
      const receiver = result; result = member(receiver, key);
      if (index === path.length - 2 && callable(result)) result = result.bind(receiver);
    }
    return result;
  }
  if (op === '$native') {
    if (input !== 'native.body-scripts' || env.native === undefined) throw new Error('Native capability requires its installation frame');
    const { host, context, preparation } = env.native, product = preparation.product;
    if (host.scope.disposed || host.scope.disposing) throw new Error('Native capability owner has ended');
    if (!hasStaticGround(host.physics)) throw new Error('Native body scripts require admitted ground');
    const sections = new Map<string, unknown>([['sim/scripts', product.section('sim/scripts')], ['sim/bodies', product.section('sim/bodies')]]);
    installNativeBodyScripts(host, product.shardfile, preparation.assets, context.restoring, sections);
    return undefined;
  }
  if (op === '$fn') return (...args: readonly unknown[]): unknown => evaluate(input, { values: new Map([['args', args]]), parent: env });
  if (op === '$not') { const truth = Boolean(evaluate(input, env)); return !truth; }
  const args = list(input);
  const at = (index: number): unknown => { const item = args[index]; if (item === undefined) throw new Error('Missing assembly operand'); return evaluate(item, env); };
  if (op === '$call' || op === '$new') {
    const fn = at(0); if (!callable(fn)) throw new Error('Missing assembly callable');
    const parameters = args.slice(1).map(item => evaluate(item, env));
    const result: unknown = op === '$new' ? Reflect.construct(fn, parameters) : fn(...parameters); return result;
  }
  if (op === '$set') {
    const owner = at(0), key = at(1), next = at(2);
    if (!record(owner) || typeof key !== 'string' || !safeKey(key) || !Reflect.set(owner, key, next)) throw new Error('Invalid assembly assignment');
    return next;
  }
  if (op === '$if') { const truth = Boolean(at(0)); return truth ? at(1) : at(2); }
  if (op === '$eq') return at(0) === at(1);
  if (op === '$sequence') { let last: unknown; for (const item of args) last = evaluate(item, env); return last; }
  if (op === '$or' || op === '$coalesce') {
    let last: unknown;
    for (const item of args) { last = evaluate(item, env); const truth = Boolean(last); if (op === '$or' ? truth : last !== null && last !== undefined) return last; }
    return last;
  }
  throw new Error('Unknown assembly operation');
}
function installRows(declaration: Assembly, env: Environment): void {
  for (const row of declaration.install) {
    const value = evaluate(row.value, env);
    if (value instanceof Promise) throw new Error('Headless installation must be synchronous');
    env.values.set(row.name, value);
  }
}
/** Renderer-free assembly primitives. Product JSON and fresh entry worlds are
 * preparation/proof work only; no primitive advances the installed live world. */
const primitives = {
  json: async (product: ShardProduct, name: string, fatal = true): Promise<unknown> => {
    const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal }).decode(await product.file(name))); return result;
  },
  need: (value: unknown, message: string): unknown => { if (value === null || value === undefined) throw new Error(message); return value; },
  coalesce: (first: unknown, second: unknown): unknown => first ?? second,
  merge: (...values: readonly object[]): object => { const merged: unknown = Object.assign({}, ...values); if (!record(merged)) throw new Error('Invalid assembly object'); return merged; },
  max: Math.max,
  Map,
  negativeInfinity: Number.NEGATIVE_INFINITY,
  fresh: (level: HeadlessRuntimePlan['level'], ports: NonNullable<HeadlessRuntimePlan['ports']>, rapier: Rapier,
    install: (host: ReturnType<typeof createSimHost>) => void, prove: (host: ReturnType<typeof createSimHost>) => unknown): unknown => {
    const host = createSimHost(level, { ...ports, rapier });
    try { install(host); host.step(); return prove(host); } finally { host.dispose(); }
  },
};
/** Assemble one native plan from declared ordered calls to existing owners.
 * The finite native.body-scripts capability is install-only, after real ground
 * admission and before quest props. Its typed frame adds no callable path,
 * clock or snapshot adapter.
 * Each install has fresh bindings; late callback reads retain that install's
 * live environment, including owners registered later. Save adapters, clocks,
 * physics, phases and disposal remain entirely with the called installers.
 * Only an explicitly trusted caller supplies the static module catalogue. */
export async function prepareHeadlessAssembly(preparation: HeadlessRuntimePreparation, modules: HeadlessAssemblyModules): Promise<HeadlessRuntimePlan> {
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await preparation.product.file('sim/headless-assembly.json')));
  const declaration = checkedHeadlessAssembly(data, modules);
  const shard = preparation.product.shardfile;
  const values = new Map<string, unknown>([['shard', shard], ['assets', preparation.assets], ['rapier', preparation.rapier], ['product', preparation.product], ['assembly', primitives]]);
  // Expose precisely the declared exports, never a module namespace's remainder.
  for (const [name, exports] of Object.entries(declaration.modules)) values.set(name, Object.fromEntries(exports.map(key => [key, member(modules[name], key)])));
  const env: Environment = { values };
  values.set('constants', structuredClone(declaration.constants));
  for (const row of declaration.prepare) values.set(row.name, await evaluate(row.value, env));
  const settings = evaluate(declaration.level, env), ports = evaluate(declaration.ports, env);
  if (!record(settings) || !record(settings['ground']) || !record(ports) || ports['ground'] !== false || !callable(ports['heightAt'])) throw new Error('Invalid assembled native world');
  const numeric = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Nonfinite assembly coordinate'); return value; };
  const query = ports['heightAt'], heightAt = (x: number, z: number): number => numeric(query(x, z));
  const spawn = shard.spawn;
  const level = trustedLevel(shard, { at: { x: spawn.x, y: Math.max(spawn.y, heightAt(spawn.x, spawn.z) + numeric(settings['lift'])), z: spawn.z },
    yaw: spawn.yaw, speed: numeric(settings['speed']) }, { size: numeric(settings['ground']['size']), height: numeric(settings['ground']['height']) });
  values.set('level', level); values.set('ports', { ground: false, heightAt });
  const entries = evaluate(declaration.entries, env);
  if (!callable(entries)) throw new Error('Missing assembly entry proof');
  return { level, ports: { ground: false, heightAt },
    install: (host, context) => { installRows(declaration, { values: new Map<string, unknown>([['host', host], ['context', context]]), parent: env, native: { host, context, preparation } }); },
    proveEntries: host => {
      const proof = entries(host);
      if (!record(proof)) throw new Error('Invalid assembly entry result');
      return { lanes: numeric(proof['lanes']), steps: numeric(proof['steps']),
        ...(proof['liftRides'] === undefined ? {} : { liftRides: numeric(proof['liftRides']) }),
        ...(proof['liftCalls'] === undefined ? {} : { liftCalls: numeric(proof['liftCalls']) }),
        ...(proof['portalTransfers'] === undefined ? {} : { portalTransfers: numeric(proof['portalTransfers']) }) };
    } };
}


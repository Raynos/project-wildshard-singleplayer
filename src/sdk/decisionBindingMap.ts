import { SCRIPT_V1_REFERENCE_KINDS, type DecisionScriptRow, type ScriptV1ReferenceKind } from '@wildshard/format/decisionScripts';

/** Authoritative platform ids; actor handles are never allocated from aliases or guessed from row order. */
export type DecisionRegistries = Readonly<Partial<Record<ScriptV1ReferenceKind, ReadonlyMap<string, number>>>>;
type Namespace = ScriptV1ReferenceKind | 'timers';
/** One defining map for generated constants, the production resolver and scenario labels. */
export interface DecisionBindingMap {
  ids: Readonly<Partial<Record<Namespace, Readonly<Record<string, number>>>>>;
  inverse: Readonly<Partial<Record<Namespace, ReadonlyMap<number, string>>>>;
  paramNames: readonly string[];
  stateNames: readonly string[];
}
/** Resolve an admitted row against real registries. Only binding-local timers receive newly allocated ids. */
export function decisionBindingMap(row: DecisionScriptRow, registries: DecisionRegistries): DecisionBindingMap {
  const ids: Partial<Record<Namespace, Readonly<Record<string, number>>>> = {};
  const inverse: Partial<Record<Namespace, ReadonlyMap<number, string>>> = {};
  for (const kind of SCRIPT_V1_REFERENCE_KINDS) {
    const registry = registries[kind], handles = new Set<number>();
    for (const handle of registry?.values() ?? []) {
      if (!Number.isSafeInteger(handle) || handle < 1 || handle > 0x7fffffff || handles.has(handle)) throw new Error(`Invalid or duplicate ${kind} registry handle`);
      handles.add(handle);
    }
    const entries: [string, number][] = [], names = new Map<number, string>();
    for (const alias of Object.keys(row[kind]).sort()) {
      const target = row[kind][alias], handle = target === undefined ? undefined : registry?.get(target);
      if (handle === undefined) throw new Error(`Missing ${kind} registry target for ${alias}`);
      if (names.has(handle)) throw new Error(`Duplicate ${kind} alias handle`);
      entries.push([alias, handle]); names.set(handle, alias);
    }
    ids[kind] = Object.freeze(Object.fromEntries(entries)); inverse[kind] = names;
  }
  if (new Set(row.timers).size !== row.timers.length) throw new Error('Duplicate local timer');
  const timers = [...row.timers].sort(), timerIds: [string, number][] = [], timerNames = new Map<number, string>();
  for (const [index, name] of timers.entries()) { timerIds.push([name, index + 1]); timerNames.set(index + 1, name); }
  ids.timers = Object.freeze(Object.fromEntries(timerIds)); inverse.timers = timerNames;
  return { ids: Object.freeze(ids), inverse: Object.freeze(inverse), paramNames: Object.freeze(Object.keys(row.params).sort()), stateNames: Object.freeze(row.state.map(slot => slot.name)) };
}

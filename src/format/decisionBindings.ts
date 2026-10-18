import { SCRIPT_V1_REFERENCE_KINDS, type DecisionScriptRow, type ScriptV1ReferenceKind } from './decisionScripts';
import type { Shardfile } from './shardSchema';
import type { ActorMove } from './actorMoves';
import type { WorldTargets } from './worldTargets';
import type { CreatureStrikes } from './creatures';

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

/** The actual player occupies a reserved handle, outside the bounded actor catalogue. */
export const DECISION_PLAYER_HANDLE = 0x7fffffff;
function catalogue(names: readonly string[]): ReadonlyMap<string, number> {
  if (new Set(names).size !== names.length || names.length >= DECISION_PLAYER_HANDLE) throw new Error('Duplicate decision catalogue identity');
  return new Map([...names].sort().map((name, index) => [name, index + 1]));
}
/** Declared group membership, shared by compilation, native reads and scenario fixtures. */
export function decisionSpawnGroups(source: Pick<Shardfile, 'creatures'>, scripts: readonly DecisionScriptRow[] = []): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, readonly string[]>(source.creatures.groups.map(group => [group.id, group.members]));
  for (const script of scripts) if ('spawnGroup' in script.binding) {
    if (groups.has(script.binding.spawnGroup)) throw new Error('Duplicate decision spawn group');
    groups.set(script.binding.spawnGroup, Object.values(script.actors));
  }
  return groups;
}
/** Wire handles come from real platform rows, independently of alias spelling or declaration order.
 * Unsupported namespaces remain absent and refuse in decisionBindingMap. Existing v0 handles are unchanged.
 * Compiler glue and the authoritative sim use this same catalogue for a given product.
 * nativeStrikeRows comes from the verified actors/strikes section; duplicate root/native ids refuse.
 * scripts supplies declared spawn-group membership alongside the existing actor spawn ids.
 */
export function buildDecisionRegistries(source: Pick<Shardfile, 'creatures' | 'rows' | 'state' | 'quests' | 'audio' | 'targets' | 'ledger' | 'clientChannels' | 'movers'> & Partial<Pick<Shardfile, 'runtime'>>,
  moves: readonly ActorMove[], worldTargets?: WorldTargets, nativeStrikeRows: readonly CreatureStrikes[number][] = [], scripts: readonly DecisionScriptRow[] = [], nativeActors: readonly string[] = []): DecisionRegistries {
  const runtime = source.runtime?.spawns;
  const actors = [...source.creatures.spawns, ...runtime?.homes ?? [], ...runtime?.bosses ?? [], ...runtime?.actors ?? []].map(row => row.id).concat(nativeActors);
  return {
    actors: catalogue(actors),
    moves: catalogue(moves.map(row => row.id)), strikes: catalogue([...source.rows.strikes, ...nativeStrikeRows].map(row => row.id)),
    fields: new Map(source.state.shared.filter(row => row.type !== 'string' && row.privacy === 'public').map(row => [row.name, row.id])),
    flags: catalogue(source.quests.flags), zones: catalogue(source.quests.triggers.filter(row => row.kind === 'region').map(row => row.id)),
    cues: catalogue(source.audio.cues.map(row => row.id)), channels: catalogue((source.clientChannels ?? []).map(row => row.id)),
    targets: catalogue(source.targets.interactions.map(row => row.id)), spawns: catalogue([...actors, ...decisionSpawnGroups(source, scripts).keys()]),
    spots: catalogue(worldTargets?.spots.map(row => row.id) ?? []),
    facts: catalogue(source.ledger.map(row => row.fact)), rewards: catalogue(source.ledger.map(row => row.fact)),
    signals: catalogue(source.movers.filter(row => row.atEnd !== undefined).map(row => row.id)),
    weather: catalogue(source.rows.weather.map(row => row.id)),
  };
}

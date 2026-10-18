import { Flags } from '@wildshard/engine/world/interact/flags';
import type { RuntimeFacts } from '../plugin/headless';
import type { Scope } from '@wildshard/engine/app/scope';
import type { QuestState } from '@wildshard/engine/quest/core';

const books = new WeakMap<Scope, Map<string, Flags>>();
const facts = new WeakMap<Scope, Map<string, RuntimeFacts>>();
const states = new WeakMap<Scope, Map<string, QuestState>>();

/** Internal publication by the existing quest binder; never creates state or listeners. */
export function publishBoundQuest(scope: Scope, state: QuestState): void {
  let quests = states.get(scope);
  if (quests === undefined) { quests = new Map(); states.set(scope, quests); }
  quests.set(state.def.id, state);
}

/** Borrow the original entered quest and its flags by id; disposed entries cannot be read. */
export function boundQuestState(scope: Scope, id: string): QuestState {
  const state = states.get(scope)?.get(id);
  if (scope.disposed || state === undefined) throw new Error(`Quest ${id} is not bound in this entry`);
  return state;
}

/** Install the original flag book once in its entered scope, retaining its persisted level key. */
export function installBoundQuestFlags(scope: Scope, id: string, level: string): Flags {
  if (scope.disposed || id.length === 0 || level.length === 0) throw new Error('Quest flags require a live declared owner');
  let rows = books.get(scope);
  if (rows === undefined) { rows = new Map(); books.set(scope, rows); }
  const current = states.get(scope)?.get(id)?.flags ?? rows.get(id);
  if (current !== undefined) {
    if (current.level !== level) throw new Error('Quest flag level differs from its existing owner');
    return current;
  }
  const flags = new Flags(level); rows.set(id, flags); return flags;
}
/** Existing achievement installation publishes its exact ledger/refresh service, never a shard hook. */
export function publishQuestFacts(scope: Scope, id: string, service: RuntimeFacts): void {
  let rows = facts.get(scope);
  if (rows === undefined) { rows = new Map(); facts.set(scope, rows); }
  rows.set(id, service);
}
/** Internal chapter admission borrows the existing services by id; no new ledger or flag owner is created. */
export function boundQuestServices(scope: Scope, id: string): { flags: Flags; facts: RuntimeFacts } {
  const flags = books.get(scope)?.get(id), service = facts.get(scope)?.get(id);
  if (scope.disposed || flags === undefined || service === undefined) throw new Error(`Quest ${id} is not bound in this entry`);
  return { flags, facts: service };
}
/** Read an entered state without constructing a second quest. */
export function findBoundQuestState(scope: Scope, id: string): QuestState | undefined {
  if (scope.disposed) throw new Error(`Quest ${id} is not bound in this entry`);
  return states.get(scope)?.get(id);
}

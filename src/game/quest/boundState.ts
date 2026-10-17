import type { Scope } from '@wildshard/engine/app/scope';
import type { QuestState } from '@wildshard/engine/quest/core';

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

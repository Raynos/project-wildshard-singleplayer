import type { Scope } from '@wildshard/engine/app/scope';
import type { ObservationRef } from '@wildshard/format/sceneRefs';
import type { ShardContext } from '../plugin/context';
import type { QuestChapter } from './chapter';
import { boundQuestState } from './boundState';
import type { AdventurePersistence } from './persistence';

const persistenceOwners = new WeakMap<Scope, AdventurePersistence>();
/** Saved owners publish directly, so numeric readers never import client persistence code. */
export function publishBoundPersistence(scope: Scope, owner: AdventurePersistence): void {
  if (persistenceOwners.has(scope)) throw new Error('Adventure persistence is already bound');
  persistenceOwners.set(scope, owner); scope.onDispose(() => { persistenceOwners.delete(scope); });
}
/** Borrow the concrete saved owner installed at world admission. */
export function enteredAdventurePersistence(scope: Scope): AdventurePersistence {
  const owner = persistenceOwners.get(scope);
  if (scope.disposed || owner === undefined) throw new Error('Adventure persistence is not entered');
  return owner;
}

const chapters = new WeakMap<Scope, Map<string, QuestChapter>>();
/** Internal chapter publication; the existing presentation owns every resource. */
export function publishBoundChapter(scope: Scope, id: string, chapter: QuestChapter): void {
  let installed = chapters.get(scope);
  if (installed === undefined) {
    installed = new Map<string, QuestChapter>(); chapters.set(scope, installed);
    // O18: a retired scope object can outlive its region (a cached facade or listener still names it); the weak key
    // then kept every visit's chapter, and through it that visit's whole world and script modules (~80 MB a visit)
    scope.onDispose(() => { chapters.delete(scope); });
  }
  installed.set(id, chapter);
}
/** Framework admission refuses duplicate chapter installation. */
export function hasBoundChapter(scope: Scope, id: string): boolean { return chapters.get(scope)?.has(id) === true; }
/** Borrow an installed chapter without constructing state or presentation. */
export function boundChapter(scope: Scope, id: string): QuestChapter {
  const chapter = chapters.get(scope)?.get(id);
  if (scope.disposed || chapter === undefined) throw new Error('Chapter presentation is not installed');
  return chapter;
}

/** Typed saved and quest observations share their actual entered owners.
 * Only elite record read failures recover; flag/listener failures are outside
 * that read boundary and always propagate. No reflected author path is read. */
export function readQuestObservation(ctx: Pick<ShardContext, 'scope'>, quest: string, ref: ObservationRef): number {
  if ('flag' in ref) return Number(boundQuestState(ctx.scope, quest).flags.has(ref.flag));
  if ('quest' in ref) {
    const state = boundQuestState(ctx.scope, ref.quest);
    if (ref.state === 'complete' && !state.isComplete) return 0;
    if (ref.state === 'active' && boundChapter(ctx.scope, quest).line?.active !== state) return 0;
    return Number(ref.step === undefined ? ref.state === 'active' || state.isComplete : state.current?.id === ref.step);
  }
  if (!('saved' in ref)) throw new Error('Observation requires its admitted scene owner');
  const persistence = enteredAdventurePersistence(ctx.scope), row = ref.saved;
  if (row.record === 'bosses') {
    const saved = persistence.bosses.read()[row.id];
    return saved === undefined ? 0 : Number(saved[row.field]);
  }
  if (row.field !== 'kills') throw new Error('Elite observation requires its kill field');
  let saved: ReturnType<typeof persistence.elites.read>;
  try { saved = persistence.elites.read(); } catch { return 0; }
  return saved[row.id]?.kills ?? 0;
}


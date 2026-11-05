/** Every state a fight or a lair can be in: `BossBrain`'s, then `EliteCore`'s. */
export const ENCOUNTER_STATES = ['dormant', 'armed', 'intro', 'fight', 'beat', 'victory', 'absent', 'idle', 'aware', 'engaged', 'leash', 'dead', 'broken', 'retired'] as const;

/** One boss fight or elite lair as a client sees it. Rules, clocks and scripts stay on the server. */
export interface EncounterNetView {
  readonly kind: 'boss' | 'elite'; readonly state: string; readonly hp: number;
  readonly phase: number; readonly shield: boolean; readonly body: string | null;
}

/** A lair as the rules hold it, with its body as the room knows it. */
interface EliteEntryRow {
  readonly state: string; readonly phase2: boolean; readonly beatT: number;
  readonly script: { readonly animal: { readonly hp: number; readonly maxHp: number; readonly entityId: string } | null };
}
/** A lair's row. Empty health while no body is out. */
export function eliteNetView(entry: EliteEntryRow): EncounterNetView {
  const body = entry.script.animal;
  return { kind: 'elite', state: entry.state, hp: body === null ? 0 : body.hp / body.maxHp, phase: Number(entry.phase2), shield: entry.beatT > 0, body: body?.entityId ?? null };
}

type EncounterRead = () => EncounterNetView;
const books = new WeakMap<object, Map<string, EncounterRead>>();
const NO_ROWS: ReadonlyMap<string, EncounterRead> = new Map<string, EncounterRead>();
/** Publish an encounter's row for the host's lifetime, under a stable wire id. Read only when a room samples it; the page
 *  publishes too and never reads, so this half stays out of `net/`, which the shipped client does not reach. */
export function publishEncounter(host: { readonly scope: { readonly onDispose: (run: () => void) => unknown } }, id: string, read: EncounterRead): void {
  let book = books.get(host);
  if (book === undefined) { const fresh = new Map<string, EncounterRead>(); book = fresh; books.set(host, fresh); host.scope.onDispose(() => { fresh.clear(); }); }
  const wire = `encounter:${id}`;
  if (book.has(wire)) throw new Error(`Duplicate encounter row ${id}`);
  book.set(wire, read);
}
/** Every row a host publishes, by wire id. */
export function encounterRows(host: object): ReadonlyMap<string, EncounterRead> { return books.get(host) ?? NO_ROWS; }

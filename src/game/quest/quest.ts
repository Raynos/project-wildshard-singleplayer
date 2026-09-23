/**
 * Quests — the data schema and the pure state machine (A1). A quest is a list of steps; each step is DONE when its
 * condition over the shard's flags holds (src/world/interact/flags.ts); the CURRENT step is the first step not done.
 * No step has code: the objective text, the counter, the map markers and the dialogue are all data, so a chunk's
 * quest can be shipped as validated config (sources/wildshard/FUNDAMENTALS.md).
 *
 *   const q = new QuestState(DRIFTWOOD_QUEST, flags);
 *   q.current            → the step you are on (null when the quest is complete)
 *   q.objective()        → "Recover the glyph shards · 1 / 3"
 *   q.markers()          → the live map / compass markers of the current step
 *   q.onStep = (step, prev) => …   // fires when the current step changes (a flag moved it on)
 *   lineFor(DIALOGUE.castaway, flags) → the first dialogue entry whose `when` holds
 */
import { test, type Flags } from '../../world/interact/flags';
import type { Cond, Place } from '../../world/interact/types';

export interface QuestMarker {
  id: string;
  label: string;
  at: Place;
  /** hidden once this holds (the shard at this spot was taken) */
  hideWhen?: Cond;
}

export interface QuestStep {
  id: string;
  /** the objective line; `{n}` / `{of}` are replaced by the step's counter */
  objective: string;
  /** a short hint under the objective (the HUD line's second row) */
  hint?: string;
  done: Cond;
  /** counts the flags that are set (`{n}`) out of all of them (`{of}`) */
  count?: string[];
  markers?: QuestMarker[];
}

export interface QuestDef {
  id: string;
  title: string;
  /** the quest is offered (appears at all) once this holds; before it the objective is `intro` */
  startWhen?: Cond;
  intro?: { objective: string; hint?: string; markers?: QuestMarker[] };
  steps: QuestStep[];
  /** raised once every step is done */
  completeFlag: string;
}

export interface DialogueEntry {
  /** the first entry whose condition holds is what the NPC says */
  when?: Cond;
  lines: string[];
  /** flags raised when the conversation ends */
  sets?: string[];
}
export interface NpcDef { id: string; name: string; dialogue: DialogueEntry[] }

export function lineFor(npc: NpcDef, flags: { has: (f: string) => boolean }): DialogueEntry | null {
  return npc.dialogue.find((d) => test(flags, d.when)) ?? null;
}

export class QuestState {
  onStep?: (step: QuestStep | null, prev: QuestStep | null) => void;
  onComplete?: () => void;
  private cur: QuestStep | null;
  private started: boolean;
  private unsub: () => void;

  constructor(readonly def: QuestDef, private flags: Flags) {
    this.started = test(flags, def.startWhen);
    this.cur = this.compute();
    this.unsub = flags.onChange(() => this.tick());
  }

  dispose(): void { this.unsub(); }

  get isStarted(): boolean { return this.started; }
  get isComplete(): boolean { return this.flags.has(this.def.completeFlag); }
  get current(): QuestStep | null { return this.started ? this.cur : null; }
  /** index of the current step (steps.length when complete, -1 before it starts) */
  get index(): number { return !this.started ? -1 : this.cur ? this.def.steps.indexOf(this.cur) : this.def.steps.length; }

  private compute(): QuestStep | null { return this.def.steps.find((s) => !test(this.flags, s.done)) ?? null; }

  private tick(): void {
    const started = test(this.flags, this.def.startWhen);
    const next = this.compute();
    if (started === this.started && next === this.cur) return;
    const prev = this.started ? this.cur : null;
    this.started = started; this.cur = next;
    if (!started) return;
    if (next === null && !this.flags.has(this.def.completeFlag)) { this.flags.set(this.def.completeFlag); this.onComplete?.(); }
    this.onStep?.(next, prev);
  }

  counter(step: QuestStep | null = this.current): { n: number; of: number } | null {
    if (!step?.count) return null;
    return { n: step.count.filter((f) => this.flags.has(f)).length, of: step.count.length };
  }

  objective(): string {
    if (!this.started) return this.def.intro?.objective ?? '';
    const s = this.cur;
    if (!s) return `${this.def.title} — complete`;
    const c = this.counter(s);
    return c ? s.objective.replace('{n}', String(c.n)).replace('{of}', String(c.of)) : s.objective;
  }
  hint(): string { return !this.started ? this.def.intro?.hint ?? '' : this.cur?.hint ?? ''; }

  markers(): QuestMarker[] {
    const list = !this.started ? this.def.intro?.markers ?? [] : this.cur?.markers ?? [];
    return list.filter((m) => m.hideWhen === undefined || !test(this.flags, m.hideWhen));
  }
}

/** checks a quest def is sound: unique step ids, every step reachable (a done condition that is not trivially true) */
export function validateQuest(q: QuestDef, raised: Set<string>): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const reads = (c: Cond | undefined) => (c ? [...(c.all ?? []), ...(c.any ?? []), ...(c.none ?? [])] : []);
  if (q.steps.length === 0) errs.push(`${q.id}: no steps`);
  for (const s of q.steps) {
    if (ids.has(s.id)) errs.push(`${q.id}.${s.id}: duplicate step id`);
    ids.add(s.id);
    if (reads(s.done).length === 0) errs.push(`${q.id}.${s.id}: a step with an empty done condition is always done`);
    for (const f of [...reads(s.done), ...(s.count ?? []), ...(s.markers ?? []).flatMap((m) => reads(m.hideWhen))]) if (!raised.has(f)) errs.push(`${q.id}.${s.id}: reads '${f}' that nothing raises`);
    if (!s.objective.trim()) errs.push(`${q.id}.${s.id}: empty objective`);
  }
  for (const f of reads(q.startWhen)) if (!raised.has(f)) errs.push(`${q.id}: startWhen reads '${f}' that nothing raises`);
  return errs;
}

import { engineString } from '#engine/strings';
import { test, type Flags } from '../world/interact/flags';
import type { Scope } from '../app/scope';
import type { Events } from '../events/events';
import type { Cond, Place } from '../world/interact/types';

export interface QuestMarker {
  id: string;
  label: string;
  /** the HUD chip's short name for it ("SEA CAVE" for "SEA CAVE KEY"); the map keeps `label` */
  short?: string;
  at: Place;
  /** hidden once this holds (the level at this spot was taken) */
  hideWhen?: Cond;
}

export interface QuestStep {
  id: string;
  /** the objective line; `{n}` / `{of}` are replaced by the step's counter */
  objective: string;
  /** the HUD chip's label (≤ CHIP_MAX chars, no counter: the chip appends `n/of` itself); falls back to `objective` */
  chip?: string;
  /** the step's sub-steps / a hint under the objective (the map tab's quest card) */
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
  intro?: { objective: string; chip?: string; hint?: string; markers?: QuestMarker[] };
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

declare module '../events/maps' {
  interface EventMap {
    'quest.step': { level: string; quest: string; step: string | null; previous: string | null };
  }
}

export class QuestState {
  onStep?: (step: QuestStep | null, prev: QuestStep | null) => void;
  onComplete?: () => void;
  private cur: QuestStep | null;
  private started: boolean;
  private unsub: () => void;
  private readonly observers = new Set<{ step?: (step: QuestStep | null, previous: QuestStep | null) => void; complete?: () => void }>();

  readonly def: QuestDef;
  readonly flags: Flags;
  private readonly events: Events | undefined;
  constructor(def: QuestDef, flags: Flags, events?: Events, scope?: Scope) {
    this.def = def; this.flags = flags; this.events = events;
    this.started = test(flags, def.startWhen);
    this.cur = this.compute();
    this.unsub = flags.onChange(() => this.tick());
    scope?.onDispose(() => this.dispose());
  }

  dispose(): void { this.unsub(); this.observers.clear(); }
  /** Multiple scoped views can observe transitions without replacing the authored callbacks. */
  observe(observer: { step?: (step: QuestStep | null, previous: QuestStep | null) => void; complete?: () => void }): () => void {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  }

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
    if (next === null && !this.flags.has(this.def.completeFlag)) {
      this.flags.set(this.def.completeFlag); this.onComplete?.();
      for (const observer of this.observers) observer.complete?.();
    }
    this.events?.emit('quest.step', { level: this.flags.level, quest: this.def.id, step: next?.id ?? null, previous: prev?.id ?? null });
    this.onStep?.(next, prev);
    for (const observer of this.observers) observer.step?.(next, prev);
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
  /** the HUD chip's two parts: a short label and the counter ('' when the step has none) — the counter is kept apart so
   *  the chip can truncate the label and never the count */
  chip(): { label: string; count: string } {
    if (!this.started) return { label: this.def.intro?.chip ?? this.def.intro?.objective ?? '', count: '' };
    const s = this.cur;
    if (!s) return { label: engineString('s_f316ae64883e'), count: '' };
    const c = this.counter(s);
    const label = s.chip ?? s.objective.replace(/\s*·?\s*\{n\}\s*\/\s*\{of\}/, '');
    return { label, count: c ? `${c.n}/${c.of}` : '' };
  }
  hint(): string { return !this.started ? this.def.intro?.hint ?? '' : this.cur?.hint ?? ''; }

  markers(): QuestMarker[] {
    const list = !this.started ? this.def.intro?.markers ?? [] : this.cur?.markers ?? [];
    return list.filter((m) => m.hideWhen === undefined || !test(this.flags, m.hideWhen));
  }
}

/** the longest chip label / marker short name that fits the HUD chip on a 390 px phone without an ellipsis */
export const CHIP_MAX = 18;

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
    if (s.chip !== undefined && s.chip.length > CHIP_MAX) errs.push(`${q.id}.${s.id}: chip '${s.chip}' is longer than ${CHIP_MAX}`);
    for (const m of s.markers ?? []) if (m.short !== undefined && m.short.length > CHIP_MAX) errs.push(`${q.id}.${s.id}: marker short '${m.short}' is longer than ${CHIP_MAX}`);
  }
  if (q.intro?.chip !== undefined && q.intro.chip.length > CHIP_MAX) errs.push(`${q.id}: intro chip '${q.intro.chip}' is longer than ${CHIP_MAX}`);
  for (const f of reads(q.startWhen)) if (!raised.has(f)) errs.push(`${q.id}: startWhen reads '${f}' that nothing raises`);
  return errs;
}

/** chained chapters: each def's `startWhen` reads the one before's `completeFlag`; the active one is the first not done */
export class QuestLine {
  readonly chapters: QuestState[];
  /** a chapter's current step changed (null = it just completed) */
  onStep?: (chapter: QuestState, step: QuestStep | null, prev: QuestStep | null) => void;
  onComplete?: (chapter: QuestState) => void;

  constructor(defs: QuestDef[], flags: Flags, events?: Events, scope?: Scope) {
    this.chapters = defs.map((d) => {
      const q = new QuestState(d, flags, events, scope);
      q.onStep = (s, p) => { this.onStep?.(q, s, p); };
      q.onComplete = () => { this.onComplete?.(q); };
      return q;
    });
  }

  /** the chapter being played: the first not complete (null once the line is finished) */
  get active(): QuestState | null { return this.chapters.find((q) => !q.isComplete) ?? null; }
  /** 1-based chapter number of `q` */
  number(q: QuestState): number { return this.chapters.indexOf(q) + 1; }
  dispose(): void { for (const q of this.chapters) q.dispose(); }
}

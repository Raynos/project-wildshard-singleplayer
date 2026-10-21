import { engineString } from '../strings';
/** A path supplies its vocabulary; the engine only accounts for exclusive wall time. */
export interface LoadingStep { key: string; label: string; weight: number; aliases?: readonly string[] }
export interface LoadingPath { id: string; steps: readonly LoadingStep[]; ignored?: readonly string[] }
export interface LoadingRow {
  key: string; label: string; number: number; state: 'todo' | 'on' | 'ok'; ms: number; detail: string; fraction?: number;
}
export interface LoadingGap { label: string; state: 'on' | 'ok'; ms: number; after: string | null }
interface Stage { key: string; base: string; detail: string; fraction?: number }
/** Nested/parallel waits never double-count elapsed seconds: the most recently entered stage owns each interval. */
export class LoadingTimeline {
  private path: LoadingPath;
  private readonly rows = new Map<string, { ms: number; started: boolean; detail: string; fraction?: number }>();
  private readonly active = new Map<number, Stage>();
  private readonly aliases = new Map<string, string>();
  private readonly ignored = new Set<string>();
  private readonly gaps: LoadingGap[] = [];
  private readonly startedOrder: string[] = [];
  private readonly occurrences = new Map<string, number>();
  private sequence = 0;
  private at: number;
  private last: string | null = null;
  private readonly now: () => number;
  constructor(path: LoadingPath, startedAt: number, now: () => number = () => performance.now()) {
    this.path = path; this.now = now; this.at = startedAt;
    this.configure(path);
    const initial = this.gaps.pop(), first = path.steps[0];
    if (first !== undefined) {
      const row = this.rows.get(first.key);
      if (row !== undefined) { row.started = true; row.ms = initial?.ms ?? 0; this.startedOrder.push(first.key); }
    }
  }
  configure(path: LoadingPath): void {
    this.accrue(); this.path = path; this.aliases.clear(); this.ignored.clear();
    for (const step of path.steps) {
      this.aliases.set(step.key, step.key);
      for (const alias of step.aliases ?? []) this.aliases.set(alias, step.key);
      if (!this.rows.has(step.key)) this.rows.set(step.key, { ms: 0, started: false, detail: '' });
    }
    for (const key of path.ignored ?? []) this.ignored.add(key);
  }
  private current(): Stage | undefined { return [...this.active.values()].at(-1); }
  private accrue(): void {
    const now = this.now(), elapsed = Math.max(0, now - this.at), current = this.current();
    this.at = now;
    if (current !== undefined) {
      const row = this.rows.get(current.key);
      if (row !== undefined) { row.ms += elapsed; row.detail = current.detail || row.detail; }
      if (row !== undefined && current.fraction !== undefined) row.fraction = current.fraction;
      return;
    }
    if (elapsed === 0) return;
    const previous = this.gaps.at(-1);
    if (previous?.state === 'on') previous.ms += elapsed;
    else this.gaps.push({ label: this.last === null ? engineString('s_loading_gap_setup') : engineString('s_loading_gap_after', [this.label(this.last)]),
      state: 'on', ms: elapsed, after: this.last });
  }
  private label(key: string): string { return this.path.steps.find(step => step.key === key)?.label ?? key; }
  report(name: string, text: string, done?: number, total?: number): void {
    const key = this.aliases.get(name) ?? name;
    for (const stage of this.active.values()) if (stage.key === key || stage.base === key) {
      stage.detail = text;
      // One unit remains for stage completion, just as in StepProgress.set.
      if (done !== undefined && total !== undefined && Number.isFinite(done) && Number.isFinite(total) && total > 0) {
        stage.fraction = Math.max(stage.fraction ?? 0, Math.min(total, Math.max(0, done)) / (total + 1));
      }
      // Parallel work keeps its real detail live even while a newer stage
      // owns the exclusive wall-time interval.
      const row = this.rows.get(stage.key);
      if (row !== undefined) {
        row.detail = stage.detail;
        if (stage.fraction !== undefined) row.fraction = stage.fraction;
      }
    }
  }
  /** A missing key becomes an explicit row, so an unrecognised stage can never disappear from the clock. */
  begin(name: string, detail = ''): { end: () => void; detail: (text: string) => void } {
    if (this.ignored.has(name)) return { end: () => undefined, detail: () => undefined };
    this.accrue();
    const base = this.aliases.get(name) ?? name;
    const count = this.occurrences.get(base) ?? 0;
    const already = [...this.active.values()].find(stage => stage.base === base);
    const repeated = count > 0 && already === undefined;
    const key = already?.key ?? (repeated ? `${base}#${count + 1}` : base);
    if (repeated || count === 0) this.occurrences.set(base, count + 1);
    if (!this.rows.has(key)) {
      this.rows.set(key, { ms: 0, started: false, detail: '' });
      this.path = { ...this.path, steps: [...this.path.steps, { key,
        label: repeated ? engineString('s_loading_step_repeat', [this.label(base), count + 1]) : name, weight: 1 }] };
    }
    const previous = this.gaps.at(-1); if (previous?.state === 'on') previous.state = 'ok';
    const row = this.rows.get(key); if (row !== undefined) row.started = true;
    if (!this.startedOrder.includes(key)) this.startedOrder.push(key);
    const id = ++this.sequence, stage = { key, base, detail };
    this.active.set(id, stage);
    return { end: () => {
      if (!this.active.has(id)) return;
      this.accrue(); this.active.delete(id); this.last = key;
    }, detail: text => { stage.detail = text; } };
  }
  snapshot(): { path: string; rows: LoadingRow[]; gaps: LoadingGap[]; current: string | null } {
    this.accrue();
    const running = new Set([...this.active.values()].map(stage => stage.key));
    // Number actual starts in their real order. Planned later work stays visible
    // after them; a resumed boundary has its own row rather than reopening step 2.
    const steps = new Map(this.path.steps.map(step => [step.key, step]));
    const ordered = [...this.startedOrder.filter(key => steps.has(key)), ...this.path.steps.filter(step => !this.startedOrder.includes(step.key)).map(step => step.key)];
    const rows = ordered.map((key, index): LoadingRow => {
      const step = steps.get(key);
      const row = this.rows.get(key);
      const result: LoadingRow = { key, label: step?.label ?? key, number: index + 1,
        state: running.has(key) ? 'on' : row?.started ? 'ok' : 'todo', ms: row?.ms ?? 0, detail: row?.detail ?? '' };
      if (row?.fraction !== undefined) result.fraction = row.fraction;
      return result;
    });
    return { path: this.path.id, rows, gaps: this.gaps.map(gap => ({ label: gap.label, state: gap.state,
      ms: gap.ms, after: gap.after })), current: this.current()?.key ?? null };
  }
}

let timeline: LoadingTimeline | undefined;
/** Installed explicitly by the visible loader; imports do not install observers or services. */
export function installLoadingTimeline(value: LoadingTimeline): () => void {
  timeline = value; return () => { if (timeline === value) timeline = undefined; };
}
export function currentLoadingTimeline(): LoadingTimeline | undefined { return timeline; }

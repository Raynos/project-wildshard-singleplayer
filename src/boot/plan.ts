/**
 * The boot plan — ported from game-demos/trials-gauntlet-demo `src/boot/plan.ts`
 * (their docs/tasks/loading-progress-invariant.md §4):
 *
 *   > Progress is the boot sequence's own declaration of work done over work declared, and the
 *   > loader can only display it.
 *
 * Two fractions, each monotone by construction and each exactly 1 on `done()` by arithmetic:
 *
 *   setup    = Σ weight(step) × fraction(step) / Σ weight(step)      over BOOT_STEPS (steps.ts)
 *   download = Σ min(read(src), total(src)) / Σ total(src)           over BYTE_SOURCES (steps.ts)
 *
 * A step's fraction is 1 when its `work()` resolved (finishing IS reporting); while running it is
 * `done / (total + 1)` of its sub-progress — so a running step can report every unit and still
 * not read complete (no "100 % but not done"); 0 before it starts. A byte source's `read` grows
 * only by what the reader that reads the bytes adds, and is set to `total` by the completion of
 * the step that awaited it. There is no cap, timer, easing or "need" flag anywhere.
 *
 * `Plan<Remaining>` loses each key as `step()` runs it, and `done` is typed `never` until nothing
 * remains — a step dropped from `main.ts` is a compile error.
 */
import { BOOT_STEPS, BYTE_SOURCES, STEP_INFO, byteLabel, closedBy, type BootStep, type ByteKey } from './steps';

export interface StepProgress {
  /** Progress in the step's own unit; the step's contribution becomes max(previous, done / (total + 1)). */
  set(done: number, total: number, detail?: string): void;
  /** The live detail line for this step (a count, a program total). */
  detail(text: string): void;
}
export interface ByteProgress { add(n: number): void }

export interface LogRow {
  key: BootStep; label: string; state: 'todo' | 'on' | 'ok';
  /** Wall ms of the step (running: so far). */
  ms: number; detail: string; fraction: number; sub: number;
}

export interface ProgressView {
  download: number; setup: number; done: boolean; error: string | null;
  step: BootStep; label: string; detail: string;
  /** DOWNLOAD's live line: the source most recently read, its bytes so far and its declared total. */
  bytes: { key: ByteKey; label: string; done: number; total: number } | null;
  bytesRead: number; bytesTotal: number; filesDone: number; filesTotal: number;
  doneCount: number; rows: LogRow[];
}
export type Sink = (view: ProgressView) => void;

export interface Plan<R extends BootStep> {
  step<K extends R, T>(key: K, work: (p: StepProgress) => T | Promise<T>): Promise<Plan<Exclude<R, K>> & { readonly value: T }>;
  /** The byte counter for a source; hand it to the code that reads the bytes. */
  reader(key: ByteKey): ByteProgress;
  /** A file of a source finished (for the "n / m files" line). */
  fileDone(key: ByteKey): void;
  fail(message: string): void;
  /** Everything ran: both fractions are 1. Callable only on the exhausted plan type. */
  readonly done: [R] extends [never] ? () => void : never;
  readonly view: ProgressView;
  readonly remaining?: R;
}

export interface PlanOptions {
  /** Declared byte totals and file counts per source (known before the first byte). */
  totals: Readonly<Record<ByteKey, { bytes: number; files: number }>>;
  now?: () => number;
}

interface StepState { state: 'todo' | 'on' | 'ok'; fraction: number; sub: number; detail: string; t0: number; ms: number }
const clamp01 = (x: number): number => (x > 1 ? 1 : x > 0 ? x : 0);

export function createBootPlan(sink: Sink, options: PlanOptions): Plan<BootStep> {
  const now = options.now ?? (() => performance.now());
  const steps = new Map<BootStep, StepState>();
  for (const k of BOOT_STEPS) steps.set(k, { state: 'todo', fraction: 0, sub: 0, detail: '', t0: 0, ms: 0 });
  const sources = new Map<ByteKey, { total: number; files: number; read: number; filesDone: number; closed: boolean }>();
  for (const k of BYTE_SOURCES) sources.set(k, { total: Math.max(0, options.totals[k]?.bytes || 0), files: options.totals[k]?.files || 0, read: 0, filesDone: 0, closed: false });
  let lastRead: ByteKey | null = null;
  let current: BootStep = BOOT_STEPS[0]!;
  let error: string | null = null;
  let finished = false;
  let shownDownload = 0;
  let shownSetup = 0;
  let view!: ProgressView;
  const weightTotal = BOOT_STEPS.reduce((n, k) => n + STEP_INFO[k].weight, 0);
  const credited = (s: { total: number; read: number; closed: boolean }): number => (s.closed ? s.total : Math.min(s.read, s.total));

  function publish(): void {
    const t = now();
    let acc = 0, doneCount = 0;
    const rows: LogRow[] = BOOT_STEPS.map((k) => {
      const s = steps.get(k)!;
      const ok = s.state === 'ok';
      if (ok) doneCount++;
      acc += STEP_INFO[k].weight * (ok ? 1 : s.state === 'on' ? s.fraction : 0);
      return { key: k, label: STEP_INFO[k].label, state: s.state, ms: s.state === 'on' ? t - s.t0 : s.ms, detail: s.detail, fraction: ok ? 1 : s.fraction, sub: ok ? 1 : s.sub };
    });
    let read = 0, total = 0, filesDone = 0, filesTotal = 0;
    for (const s of sources.values()) {
      if (s.total <= 0) continue;
      total += s.total; read += credited(s);
      filesTotal += s.files; filesDone += s.closed ? s.files : Math.min(s.filesDone, s.files);
    }
    // The max() is the assertion that no future edit can make the screen run backwards.
    shownSetup = Math.max(shownSetup, weightTotal > 0 ? acc / weightTotal : 1);
    shownDownload = Math.max(shownDownload, total > 0 ? read / total : 1);
    const last = lastRead ? sources.get(lastRead)! : null;
    view = {
      download: shownDownload, setup: shownSetup, done: finished, error,
      step: current, label: STEP_INFO[current].label, detail: steps.get(current)!.detail,
      bytes: lastRead && last ? { key: lastRead, label: byteLabel(lastRead), done: credited(last), total: last.total } : null,
      bytesRead: read, bytesTotal: total, filesDone, filesTotal, doneCount, rows,
    };
    sink(view);
  }

  function progressFor(key: BootStep): StepProgress {
    const s = steps.get(key)!;
    return {
      set(done, total, detail) {
        if (s.state !== 'on') return;
        if (total > 0 && Number.isFinite(total) && Number.isFinite(done)) {
          const d = Math.min(Math.max(0, done), total);
          s.sub = Math.max(s.sub, d / total);
          s.fraction = Math.max(s.fraction, clamp01(d / (total + 1)));
        }
        if (detail !== undefined) s.detail = detail;
        publish();
      },
      detail(text) { if (s.state !== 'on') return; s.detail = text; publish(); },
    };
  }

  async function run<T>(key: BootStep, work: (p: StepProgress) => T | Promise<T>): Promise<T> {
    const s = steps.get(key);
    if (!s || s.state !== 'todo' || finished) throw new Error(`boot plan: ${key} ${!s ? 'unknown' : finished ? 'after done()' : 'already ' + s.state}`);
    s.state = 'on'; s.t0 = now(); current = key;
    publish();
    const value = await work(progressFor(key));
    s.state = 'ok'; s.fraction = 1; s.sub = 1; s.ms = now() - s.t0;
    for (const bk of BYTE_SOURCES) if (closedBy(bk) === key) sources.get(bk)!.closed = true;
    publish();
    return value;
  }

  const next = (value: unknown): Plan<BootStep> & { value: unknown } => Object.assign(Object.create(api) as Plan<BootStep> & { value: unknown }, { value });
  const api = {
    async step(key: BootStep, work: (p: StepProgress) => unknown) { return next(await run(key, work)); },
    reader(key: ByteKey): ByteProgress {
      const s = sources.get(key)!;
      return { add(n) { if (!(n > 0) || s.closed) return; s.read += n; lastRead = key; publish(); } };
    },
    fileDone(key: ByteKey) { const s = sources.get(key)!; if (!s.closed) { s.filesDone++; publish(); } },
    fail(message: string) { error = message; publish(); },
    done() {
      if (finished) return;
      const missed = BOOT_STEPS.filter((k) => steps.get(k)!.state !== 'ok');
      if (missed.length) throw new Error(`boot plan: ${missed.join(',')} not complete`);
      finished = true;
      publish();
      // Arithmetic, not policy: Σw·1/Σw and ΣT/ΣT. The throw is the assertion that this file's math was not edited into a lie.
      if (view.download !== 1 || view.setup !== 1) throw new Error('boot plan: done() not at 1/1');
    },
    get view(): ProgressView { return view; },
  } as unknown as Plan<BootStep>;
  publish();
  return api;
}

export const formatMB = (b: number): string => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 2 : 1)} MB`;

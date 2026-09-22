/**
 * The boot plan — ported from game-demos/trials-gauntlet-demo `src/boot/plan.ts`
 * (their docs/tasks/loading-progress-invariant.md §4):
 *
 *   > Progress is the boot sequence's own declaration of work done over work declared, and the
 *   > loader can only display it.
 *
 * Two fractions, each monotone by construction and each exactly 1 on `done()` by arithmetic:
 *
 *   setup    = Σ expected(step) × fraction(step) / Σ expected(step)  over BOOT_STEPS (steps.ts)
 *   download = Σ min(read(src), total(src)) / Σ total(src)           over BYTE_SOURCES (steps.ts)
 *
 * `expected(step)` is the wall ms the step took last time on this device and tier (timing.ts;
 * the table's weights on a first run). A step's fraction is 1 when its `work()` resolved
 * (finishing IS reporting); while running it is the larger of its reported sub-progress
 * `done / (total + 1)` and its elapsed / expected — both strictly below 1, so a running step can
 * report every unit, or overrun its expectation, and still not read complete (no "100 % but not
 * done"); 0 before it starts. While a step runs the view is republished every animation frame
 * so the elapsed term moves the bar continuously. A byte source's `read` grows only by what the
 * reader that reads the bytes adds, and is set to `total` by the completion of the step that
 * awaited it. There is no easing or "need" flag anywhere.
 *
 * `Plan<Remaining>` loses each key as `step()` runs it, and `done` is typed `never` until nothing
 * remains — a step dropped from `main.ts` is a compile error.
 */
import { BOOT_STEPS, BYTE_SOURCES, STEP_INFO, byteLabel, closedBy, type BootStep, type ByteKey } from './steps';
import { expectedDurations, saveTimings, type Timings } from './timing';

export interface StepProgress {
  /** Progress in the step's own unit; the step's contribution becomes max(previous, done / (total + 1)). */
  set: (done: number, total: number, detail?: string) => void;
  /** The live detail line for this step (a count, a program total). */
  detail: (text: string) => void;
}
export interface ByteProgress { add: (n: number) => void }

export interface LogRow {
  key: BootStep; label: string; state: 'todo' | 'on' | 'ok';
  /** Wall ms of the step (running: so far at publish time; `t0` lets a painter keep it live). */
  ms: number; t0: number; detail: string; fraction: number; sub: number;
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
  step: <K extends R, T>(key: K, work: (p: StepProgress) => T | Promise<T>) => Promise<Plan<Exclude<R, K>> & { readonly value: T }>;
  /** The byte counter for a source; hand it to the code that reads the bytes. */
  reader: (key: ByteKey) => ByteProgress;
  /** A file of a source finished (for the "n / m files" line). */
  fileDone: (key: ByteKey) => void;
  fail: (message: string) => void;
  /** Everything ran: both fractions are 1. Callable only on the exhausted plan type. */
  readonly done: [R] extends [never] ? () => void : never;
  readonly view: ProgressView;
  readonly remaining?: R;
}

export interface PlanOptions {
  /** Declared byte totals and file counts per source (known before the first byte). */
  totals: Readonly<Record<ByteKey, { bytes: number; files: number }>>;
  now?: () => number;
  /** Expected ms per step (default: the previous run's, from localStorage — timing.ts). */
  expected?: Readonly<Record<BootStep, number>>;
  /** Called at done() with this run's per-step ms (default: blends them into localStorage). */
  record?: (measured: Timings) => void;
  /** Per-frame republish while a step runs (default: requestAnimationFrame; tests pass their own or none). */
  schedule?: ((fn: () => void) => void) | null;
  /**
   * Awaited after every step (default in a browser: one macrotask). A step's work and the next step's
   * start otherwise chain through microtasks inside ONE task — the 0.75–1.3 s long tasks of
   * docs/plans/LOAD-PERF.md were forest + edge + grass and animals + weapon glued together.
   */
  yieldTask?: (() => Promise<void>) | null;
}

/** End the current task: the next step starts in a fresh one (a MessageChannel hop — no 4 ms timer clamp). */
export const macrotask = (): Promise<void> => new Promise((resolve) => {
  const c = new MessageChannel();
  c.port1.onmessage = () => { c.port1.close(); resolve(); };
  c.port2.postMessage(0);
});

/**
 * A yield point that ends the task only once it has run `budgetMs` (wall): sprinkle `await slice()` between
 * builders of uneven size — the ones a shard skips cost nothing, the heavy runs still break under ~100 ms.
 */
export function slicer(budgetMs = 30): () => Promise<void> {
  let t0 = performance.now();
  return async () => {
    if (performance.now() - t0 < budgetMs) return;
    await macrotask();
    t0 = performance.now();
  };
}

interface StepState { state: 'todo' | 'on' | 'ok'; fraction: number; sub: number; detail: string; t0: number; ms: number }
interface SourceState { total: number; files: number; read: number; filesDone: number; closed: boolean }
const clamp01 = (x: number): number => (x > 1 ? 1 : Math.max(x, 0));
/** A running step never reads complete: its elapsed / expected term is capped just below 1. */
const RUNNING_CAP = 0.995;

export function createBootPlan(sink: Sink, options: PlanOptions): Plan<BootStep> {
  const now = options.now ?? (() => performance.now());
  const steps = {} as Record<BootStep, StepState>; // every key filled just below
  for (const k of BOOT_STEPS) steps[k] = { state: 'todo', fraction: 0, sub: 0, detail: '', t0: 0, ms: 0 };
  const sources = {} as Record<ByteKey, SourceState>;
  for (const k of BYTE_SOURCES) sources[k] = { total: Math.max(0, options.totals[k].bytes || 0), files: options.totals[k].files || 0, read: 0, filesDone: 0, closed: false };
  let lastRead: ByteKey | null = null;
  const firstStep = BOOT_STEPS[0];
  if (firstStep === undefined) throw new Error('boot plan: no steps');
  let current: BootStep = firstStep;
  let error: string | null = null;
  let finished = false;
  let shownDownload = 0;
  let shownSetup = 0;
  let view!: ProgressView;
  const expected = options.expected ?? expectedDurations();
  const record = options.record ?? saveTimings;
  const schedule = options.schedule === undefined ? (typeof requestAnimationFrame === 'function' ? (fn: () => void) => { requestAnimationFrame(fn); } : null) : options.schedule;
  let ticking = false;
  const yieldTask = options.yieldTask === undefined ? (typeof window !== 'undefined' && typeof MessageChannel === 'function' ? macrotask : null) : options.yieldTask;
  const credited = (s: { total: number; read: number; closed: boolean }): number => (s.closed ? s.total : Math.min(s.read, s.total));

  function publish(): void {
    const t = now();
    let acc = 0, expectedTotal = 0, doneCount = 0;
    const rows: LogRow[] = BOOT_STEPS.map((k) => {
      const s = steps[k];
      const ok = s.state === 'ok';
      if (ok) doneCount++;
      const d = expected[k];
      // running: reported sub-progress or elapsed / expected, whichever is further — never 1
      const fraction = ok ? 1 : s.state === 'on' ? Math.max(s.fraction, Math.min(RUNNING_CAP, (t - s.t0) / d)) : 0;
      acc += d * fraction; expectedTotal += d; // the same additions as `acc` at done() (fraction 1 everywhere): equal by arithmetic
      return { key: k, label: STEP_INFO[k].label, state: s.state, ms: s.state === 'on' ? t - s.t0 : s.ms, t0: s.t0, detail: s.detail, fraction, sub: ok ? 1 : s.sub };
    });
    let read = 0, total = 0, filesDone = 0, filesTotal = 0;
    for (const s of Object.values(sources)) {
      if (s.total <= 0) continue;
      total += s.total; read += credited(s);
      filesTotal += s.files; filesDone += s.closed ? s.files : Math.min(s.filesDone, s.files);
    }
    // The max() is the assertion that no future edit can make the screen run backwards.
    shownSetup = Math.max(shownSetup, expectedTotal > 0 ? acc / expectedTotal : 1);
    shownDownload = Math.max(shownDownload, total > 0 ? read / total : 1);
    const last = lastRead ? sources[lastRead] : null;
    view = {
      download: shownDownload, setup: shownSetup, done: finished, error,
      step: current, label: STEP_INFO[current].label, detail: steps[current].detail,
      bytes: lastRead && last ? { key: lastRead, label: byteLabel(lastRead), done: credited(last), total: last.total } : null,
      bytesRead: read, bytesTotal: total, filesDone, filesTotal, doneCount, rows,
    };
    sink(view);
  }

  function progressFor(key: BootStep): StepProgress {
    const s = steps[key];
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

  /** While a step is running, republish every frame so the elapsed term moves the bar between events. */
  function tick(): void {
    if (ticking || !schedule) return;
    ticking = true;
    const frame = () => {
      ticking = false;
      if (finished || error !== null || steps[current].state !== 'on') return;
      publish();
      ticking = true;
      schedule(frame);
    };
    schedule(frame);
  }

  async function run<T>(key: BootStep, work: (p: StepProgress) => T | Promise<T>): Promise<T> {
    const s = Object.hasOwn(steps, key) ? steps[key] : undefined; // a key outside BOOT_STEPS (a JS caller) is unknown
    if (s?.state !== 'todo' || finished) throw new Error(`boot plan: ${key} ${s === undefined ? 'unknown' : finished ? 'after done()' : `already ${s.state}`}`);
    s.state = 'on'; s.t0 = now(); current = key;
    publish();
    tick();
    const value = await work(progressFor(key));
    s.state = 'ok'; s.fraction = 1; s.sub = 1; s.ms = now() - s.t0;
    for (const bk of BYTE_SOURCES) if (closedBy(bk) === key) sources[bk].closed = true;
    publish();
    return value;
  }

  const api = {
    async step(key: BootStep, work: (p: StepProgress) => unknown) { const value = await run(key, work); if (yieldTask) await yieldTask(); return next(value); },
    reader(key: ByteKey): ByteProgress {
      const s = sources[key];
      return { add(n) { if (!(n > 0) || s.closed) return; s.read += n; lastRead = key; publish(); } };
    },
    fileDone(key: ByteKey) { const s = sources[key]; if (!s.closed) { s.filesDone++; publish(); } },
    fail(message: string) { error = message; publish(); },
    done() {
      if (finished) return;
      const missed = BOOT_STEPS.filter((k) => steps[k].state !== 'ok');
      if (missed.length > 0) throw new Error(`boot plan: ${missed.join(',')} not complete`);
      finished = true;
      publish();
      const measured: Timings = {};
      for (const k of BOOT_STEPS) measured[k] = steps[k].ms;
      record(measured);
      // Arithmetic, not policy: Σw·1/Σw and ΣT/ΣT. The throw is the assertion that this file's math was not edited into a lie.
      if (view.download !== 1 || view.setup !== 1) throw new Error('boot plan: done() not at 1/1');
    },
    get view(): ProgressView { return view; },
  } as unknown as Plan<BootStep>;
  function next(value: unknown): Plan<BootStep> & { value: unknown } { return Object.assign(Object.create(api) as Plan<BootStep> & { value: unknown }, { value }); }
  publish();
  return api;
}

export const formatMB = (b: number): string => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 2 : 1)} MB`;

/** Runs one step: what code outside main.ts (bootstrap) receives, so it need not know the plan type. */
export type StepRunner = <T>(key: BootStep, work: (p: StepProgress) => T | Promise<T>) => Promise<T>;
const noProgress: StepProgress = { set: () => undefined, detail: () => undefined };
/** No loading screen (dev entries): run the work, report nothing. */
export const runDirect: StepRunner = (_key, work) => Promise.resolve(work(noProgress));

import { uiScope, mountUi } from './ownership';
import { engineString } from '../strings';
import { saveStorage } from '../saves/slots';
import { formatMB, type ProgressView } from '../boot/plan';
import { bootWaits } from '../boot/waits';
import { TIER } from '../core/tier';
import { loadShellTemplate } from '../boot/shell';
import { appIdentity } from '../app/identity';
import { recordBootCheckpoint, recordBootProgress, startBoot } from '../boot/bootTrace';
import { DownloadAccounting, installDownloadAccounting } from '../boot/download';
import { LoadingTimeline, installLoadingTimeline, type LoadingPath, type LoadingRow, type LoadingGap } from '../boot/timeline';
import { LoadingStall } from '../boot/stall';
import { loadingExpectations, loadingFraction, type LoadingTimings, type LoadingTimingKey, type LoadingCalibration } from '../boot/weights';
import { loadPathTimings, savePathTimings } from '../boot/pathTiming';
import './loading.css';

const savedStorage = saveStorage('session');

/**
 * Loading screen in the Wildshard staging identity — a painter of the boot plan's view
 * (src/engine/boot/plan.ts) and nothing else: two tracks (DOWNLOAD bytes read / declared, SETUP
 * weighted steps and reported sub-progress) as integers that read 100 only when the fraction is exactly 1,
 * an elapsed clock, and one row per step with its wall ms and live detail. Bytes and completed work come
 * from the producer; unknown totals and waits stay explicit. `done()` fades it out and resolves when it is gone.
 *
 * Players (E140, the user's 4a) see only the shard's display name, one bar weighted by measured stage time and a short line;
 * the tracks, the step log, the tier line and "Loading chunk · <slug>" are developer mode's (`<html data-dev>`, set by
 * index.html before the first paint — src/engine/core/devMode.ts; loading.css does the hiding).
 */
type ElKey = 'clock' | 'dlFact' | 'dlPct' | 'dlBar' | 'suFact' | 'suPct' | 'suBar' | 'rows' | 'foot' | 'slug' | 'tier' | 'bar' | 'line' | 'diagnostics';

/** Write text only when it changed: an unchanged textContent write still dirties layout. */
const set = (el: HTMLElement, text: string): void => { if (el.textContent !== text) el.textContent = text; };
/** The same for a `data-*` attribute: the plan republishes on every byte chunk and sub-step, and every attribute write
 *  (even an unchanged one) invalidates style and queues a mutation record (SF67). */
const setData = (el: HTMLElement, key: string, value: string): void => { if (el.dataset[key] !== value) el.dataset[key] = value; };

/** Renderer-independent admission facts; the caller owns its phases and actual byte counter. */
export interface LoadingAdmission {
  phase: string; detail: string; bytesRead: number; bytesTotal: number; filesDone: number; filesTotal: number;
}
/** The loading panel's repaint cadence while a step runs (20 Hz: the clock's tenths still tick); done and errors paint at once. */
const PAINT_MS = 50;
let currentLoading: { id: string; loading: Loading } | null = null;
/** the loading screen: the download and set-up bars, the boot steps' rows, the tier and the diagnostics */
export class Loading {
  readonly scope = uiScope('Loading');
  root: HTMLElement;
  private els: Record<ElKey, HTMLElement>;
  private rowsEl: HTMLElement;
  private t0 = performance.now();
  private raf = 0;
  private view: ProgressView | null = null;
  private dirty = false;
  private lastFrameAt = performance.now();
  private lastDiagnosticAt = 0;
  private lastPaintAt = 0;
  private lastPaintStep = '';
  private longestPauseMs = 0;
  private longestPauseAt = '';
  private lastFrameStep = '';
  private textureBytes = 0;
  private readonly attempt: number;
  private admission: LoadingAdmission | null = null;
  private readonly downloads: DownloadAccounting;
  private readonly downloadObserver: PerformanceObserver;
  private readonly timeline: LoadingTimeline;
  private phase: { end: () => void; detail: (text: string) => void } | undefined;
  private phaseKey = 'modules';
  private readonly stall = new LoadingStall(performance.now());
  private readonly identity: string;
  private timingKey: LoadingTimingKey;
  private baseline: LoadingTimings = {};
  private expected: LoadingTimings = {};
  private configured = false;
  private finished = false;
  private shownSetup = 0;
  private readonly admissionPhases = new Set<string>();
  private readonly paintedRows: (LoadingRow | LoadingGap)[] = [];

  constructor(chunk: { id: string; name: string; trace?: boolean }) {
    this.identity = chunk.id;
    this.timingKey = { tier: TIER, path: 'pending', identity: this.identity };
    startBoot({ id: chunk.id, name: chunk.name }, TIER === 'phone' && chunk.trace === true);
    const nav: { hardwareConcurrency?: number | undefined } = navigator; // Safari < 15.4 has no hardwareConcurrency
    // index.html paints this panel from its first bytes (src/engine/boot/shell.ts): adopt it; a page without it gets a fresh one
    const shell = document.querySelector<HTMLElement>('.ws-load[data-shell]');
    if (shell) { this.root = shell; delete shell.dataset['shell']; mountUi(shell, this.scope, document.body); }
    else {
      this.root = document.createElement('div');
      this.root.className = 'ws-load';
      this.root.innerHTML = loadShellTemplate();
      mountUi(this.root, this.scope, document.body);
    }
    const startedAt = Number(this.root.dataset['startedAt']);
    if (Number.isFinite(startedAt) && startedAt >= 0 && startedAt <= this.t0) this.t0 = startedAt;
    this.timeline = new LoadingTimeline({ id: 'pending', steps: [{ key: 'modules', label: engineString('s_loading_modules'), weight: 1 }] }, this.t0);
    this.phase = this.timeline.begin('modules');
    this.scope.onDispose(installLoadingTimeline(this.timeline));
    this.downloads = new DownloadAccounting(location.href, shell === null ? this.t0 : 0);
    this.scope.onDispose(installDownloadAccounting(this.downloads));
    this.downloadObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (entry instanceof PerformanceResourceTiming) this.downloads.resource(entry);
      this.dirty = true;
    });
    this.downloadObserver.observe({ type: 'resource', buffered: true });
    this.scope.onDispose(() => { this.downloadObserver.disconnect(); });
    const tagline = this.root.querySelector('.ws-load-tagline'); if (tagline === null) throw new Error('Loading: no tagline'); tagline.textContent = appIdentity().tagline;
    const el = (key: ElKey): HTMLElement => { const e = this.root.querySelector<HTMLElement>(`[data-el="${key}"]`); if (!e) throw new Error(`Loading: no [data-el="${key}"]`); return e; };
    this.els = { slug: el('slug'), tier: el('tier'), clock: el('clock'), dlFact: el('dlFact'), dlPct: el('dlPct'), dlBar: el('dlBar'), suFact: el('suFact'), suPct: el('suPct'), suBar: el('suBar'), rows: el('rows'), foot: el('foot'), bar: el('bar'), line: el('line'), diagnostics: el('diagnostics') };
    this.els.slug.textContent = chunk.name;
    this.els.tier.textContent = engineString('s_783b614ae363', [TIER, Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), nav.hardwareConcurrency ?? engineString('s_8a8de823d5ed'), window.__ws_sw ? engineString('s_5c75b0e90774') : '']);
    const key = 'loadAttempt';
    let attempt = 1;
    try {
      const previous: unknown = JSON.parse(savedStorage.getItem(key) ?? 'null');
      if (typeof previous === 'object' && previous !== null && Reflect.get(previous, 'slug') === chunk.id) {
        const when: unknown = Reflect.get(previous, 'at');
        const count: unknown = Reflect.get(previous, 'count');
        if (typeof when === 'number' && Date.now() - when < 120_000 && typeof count === 'number') attempt = count + 1;
      }
      savedStorage.setItem(key, JSON.stringify({ slug: chunk.id, at: Date.now(), count: attempt }));
    } catch { /* a storage-denied PWA still gets the loader */ }
    this.attempt = attempt;
    this.rowsEl = this.els.rows;
    const tick = (): void => { this.tickClock(); this.raf = this.scope.raf(tick); };
    tick();
  }

  /** Show real pre-session work. Unknown totals stay explicit instead of inventing a percentage. */
  paintAdmission(progress: LoadingAdmission): void {
    if (this.view !== null) throw new Error('Admission progress arrived after world setup started');
    if (!this.admissionPhases.has(progress.phase)) { this.admissionPhases.add(progress.phase); recordBootCheckpoint(`admission:${progress.phase}`, { detail: progress.detail }); }
    this.admission = progress;
    const phase = progress.phase === 'modules' ? 'modules' : 'admission';
    if (this.phase !== undefined && phase !== this.phaseKey) { this.phase.end(); this.phase = this.timeline.begin(phase); this.phaseKey = phase; }
    const detail = `${progress.detail} · ${progress.filesDone} / ${progress.filesTotal} files · ${formatMB(progress.bytesRead)} read`;
    this.phase?.detail(detail);
    this.timeline.report(phase, detail, progress.filesDone, progress.filesTotal);
    setData(this.root, 'step', `admission.${progress.phase}`);
    this.dirty = true;
  }

  /** Explain module/tier/SW waits before the first source denominator is known. */
  waiting(detail: string): void {
    this.paintAdmission({ phase: 'modules', detail, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0 });
  }

  /** The composition root supplies the actual path's vocabulary before its product or world starts. */
  setPath(path: LoadingPath, calibrations: readonly LoadingCalibration[] = []): void {
    this.timeline.configure(path); setData(this.root, 'path', path.id);
    this.timingKey = { tier: TIER, path: path.id, identity: this.identity };
    const calibration = calibrations.find(row => row.tier === TIER && row.path === path.id && row.identity === this.identity)
      ?? calibrations.find(row => row.tier === TIER && row.path === path.id && row.identity === '*');
    this.baseline = calibration?.ms ?? {};
    this.expected = loadingExpectations(path.steps, this.baseline, loadPathTimings(this.timingKey));
    this.configured = true;
  }
  /** End pre-session admission before LevelLoader's data/world boundaries take over. */
  endAdmission(): void { this.phase?.end(); this.phase = undefined; }

  /**
   * The plan publishes a view on every event (every byte chunk of every fetch, every sub-step); the
   * cheap attributes land at once (`data-step` is what the bench and the tests read), the text and
   * bars at most once per frame (`tickClock`) — the DOM writes and the layout they force were ~8 %
   * of a phone-tier load at 4× CPU (project/archive/2026-09-22-load-perf.md Status). Integers floor, so 100 means done.
   */
  paint(view: ProgressView): void {
    this.phase?.end(); this.phase = undefined;
    let v = view;
    v = { ...v, setup: this.setupProgress() };
    const transfer = this.downloadProgress(v.done);
    v = { ...v, bytesRead: transfer.networkBytes, bytesTotal: transfer.networkBytes + transfer.pendingBytes,
      filesDone: transfer.filesDone, filesTotal: transfer.filesTotal, download: transfer.fraction };
    this.view = v;
    recordBootProgress(v);
    this.dirty = true;
    const pct = (f: number): string => String(Math.floor(f * 100));
    setData(this.root, 'download', pct(v.download));
    setData(this.root, 'setup', pct(v.setup));
    if (v.error) { this.els.foot.textContent = v.error; this.paintNow(); }
    else if (v.done) this.paintNow();
  }

  /** Text + bars from the latest view; only what changed is written (a write forces the next layout). */
  private paintNow(): void {
    if (!this.dirty) return;
    const v = this.view;
    if (!v) { this.paintAdmissionNow(); return; }
    this.dirty = false;
    // the tier line once a frame, not on every published view (it reads the viewport, which may rotate)
    const hardware: { hardwareConcurrency?: number | undefined } = navigator;
    set(this.els.tier, engineString('s_783b614ae363', [TIER, Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), hardware.hardwareConcurrency ?? engineString('s_8a8de823d5ed'), window.__ws_sw ? engineString('s_5c75b0e90774') : '']));
    const pct = (f: number): string => String(Math.floor(f * 100));
    setData(this.root, 'setup', pct(v.setup));
    set(this.els.dlPct, pct(v.download));
    set(this.els.suPct, pct(v.setup));
    const dl = `${(v.download * 100).toFixed(1)}%`, su = `${(v.setup * 100).toFixed(1)}%`;
    if (this.els.dlBar.style.width !== dl) this.els.dlBar.style.width = dl;
    if (this.els.suBar.style.width !== su) this.els.suBar.style.width = su;
    // Admission and setup share the measured stage clock; completion alone grants 100.
    const all = v.setup, allW = `${(all * 100).toFixed(1)}%`;
    if (this.els.bar.style.width !== allW) this.els.bar.style.width = allW;
    set(this.els.line, this.finished ? engineString('s_5fa7aac5375c') : engineString('s_bf5e849564ae', [v.worldBytesReady ? 'Building the world' : engineString('s_37b345555d7e'), pct(all)]));
    this.paintDownloads(v.done);
    this.paintRows();
  }

  private paintAdmissionNow(): void {
    const p = this.admission;
    if (p === null) return;
    this.dirty = false;
    const download = this.paintDownloads(false);
    const setup = this.setupProgress();
    setData(this.root, 'download', String(Math.floor(download * 100)));
    setData(this.root, 'setup', String(Math.floor(setup * 100)));
    set(this.els.dlPct, String(Math.floor(download * 100))); set(this.els.suPct, String(Math.floor(setup * 100)));
    this.els.dlBar.style.width = `${download * 100}%`; this.els.suBar.style.width = `${setup * 100}%`;
    this.els.bar.style.width = `${setup * 100}%`;
    set(this.els.suFact, p.detail); set(this.els.line, p.detail);
    this.paintRows();
  }

  private downloadProgress(done: boolean) {
    for (const entry of this.downloadObserver.takeRecords()) if (entry instanceof PerformanceResourceTiming) this.downloads.resource(entry);
    const transfer = this.downloads.snapshot();
    const fraction = done && transfer.filesDone === transfer.filesTotal && transfer.unclassifiedBytes === 0 ? 1
      : Math.min(0.999, transfer.networkBytes / (transfer.networkBytes + transfer.pendingBytes + 1));
    return { ...transfer, fraction };
  }

  private setupProgress(): number {
    if (!this.configured) return 0;
    this.shownSetup = Math.max(this.shownSetup, loadingFraction(this.timeline.snapshot().rows, this.expected, this.finished));
    return this.shownSetup;
  }

  private paintDownloads(done: boolean): number {
    const transfer = this.downloadProgress(done);
    setData(this.root, 'networkBytes', String(transfer.networkBytes));
    setData(this.root, 'cachedBytes', String(transfer.cachedBytes));
    setData(this.root, 'pendingBytes', String(transfer.pendingBytes));
    set(this.els.dlFact, `${formatMB(transfer.networkBytes)} downloaded · ${formatMB(transfer.cachedBytes)} from cache · ${formatMB(transfer.pendingBytes)} still expected · ${transfer.filesDone} / ${transfer.filesTotal} files${transfer.unclassifiedBytes > 0 ? ` · ${formatMB(transfer.unclassifiedBytes)} source unknown` : ''}${done ? '' : ' · total pending'}`);
    return transfer.fraction;
  }

  private paintRows(): void {
    const timeline = this.timeline.snapshot();
    const current = timeline.rows.find(row => row.key === timeline.current);
    const currentGap = timeline.gaps.find(row => row.state === 'on');
    setData(this.root, 'step', current?.key ?? 'gap');
    if (current !== undefined) set(this.els.suFact, engineString('s_af18899b96b3', [current.number, timeline.rows.length, current.label, current.detail ? engineString('s_614cafefe4f0', [current.detail]) : '']));
    else if (currentGap !== undefined) set(this.els.suFact, currentGap.label);
    const shown: (LoadingRow | LoadingGap)[] = [];
    for (const gap of timeline.gaps) if (gap.after === null) shown.push(gap);
    for (const row of timeline.rows) {
      if (row.state === 'todo') continue;
      shown.push(row);
      for (const gap of timeline.gaps) if (gap.after === row.key) shown.push(gap);
    }
    while (this.rowsEl.children.length < shown.length) { const d = document.createElement('div'); d.innerHTML = engineString('s_a9fadf880555'); this.rowsEl.append(d); }
    shown.forEach((r, i) => {
      const previous = this.paintedRows[i];
      // Completed rows keep their exact values. Avoid translating their
      // labels and reading their DOM children on every active-step paint.
      if (previous !== undefined && previous.state === r.state && previous.ms === r.ms
        && previous.label === r.label
        && ('detail' in previous ? previous.detail : '') === ('detail' in r ? r.detail : '')
        && ('key' in previous ? previous.key : 'gap') === ('key' in r ? r.key : 'gap')
        && ('number' in previous ? previous.number : 0) === ('number' in r ? r.number : 0)) return;
      this.paintedRows[i] = r;
      const el = this.rowsEl.children[i] as HTMLElement;
      const cls = r.state === 'on' ? 'on' : 'ok';
      if (el.className !== cls) el.className = cls;
      set(el.children[0] as HTMLElement, engineString('s_dd0d06d0c0aa', ['number' in r ? engineString('s_loading_step_label', [r.number, r.label]) : r.label]));
      set(el.children[1] as HTMLElement, 'detail' in r ? r.detail : '');
      setData(el, 'key', 'key' in r ? r.key : 'gap');
      setData(el, 'ms', String(r.ms));
      const ms = r.ms;
      set(el.children[2] as HTMLElement, ms >= 1000 ? engineString('s_51b784eb9dd6', [(ms / 1000).toFixed(1)]) : engineString('s_f3813306296c', [Math.round(ms)]));
    });
  }

  private tickClock(): void {
    const now = performance.now();
    // A gap here includes synchronous JS, style/layout, GC and a suspended tab. It is not CPU percentage.
    const pauseMs = now - this.lastFrameAt - 17;
    if (document.visibilityState === 'visible' && pauseMs > this.longestPauseMs) {
      this.longestPauseMs = pauseMs;
      this.longestPauseAt = this.lastFrameStep;
    }
    this.lastFrameAt = now;
    if (this.view) this.lastFrameStep = `${this.view.label}${this.view.detail ? `: ${this.view.detail}` : ''}`;
    else if (this.admission) this.lastFrameStep = this.admission.detail;
    if (now - this.lastDiagnosticAt > 250) { this.paintDiagnostics(); this.lastDiagnosticAt = now; }
    // SF67: within a step the clock, bars and rows repaint at most PAINT_MS apart, not every frame: each repaint is a style,
    // layout and paint of the panel (~3 ms a frame at 4x CPU, ~1.2 s of a Nalati load). A new step paints on its first frame.
    const step = this.view?.step ?? this.admission?.phase ?? '';
    if (step === this.lastPaintStep && now - this.lastPaintAt < PAINT_MS) return;
    this.lastPaintAt = now; this.lastPaintStep = step;
    this.paintWaiting();
    const s = (now - this.t0) / 1000;
    set(this.els.clock, engineString('s_c0951c6055b1', [String(Math.floor(s / 60)).padStart(2, '0'), (s % 60).toFixed(1).padStart(4, '0')]));
    // Easing continues through a quiet wait without needing another producer event.
    if (this.view !== null) this.view = { ...this.view, setup: this.setupProgress() };
    this.dirty = true;
    this.paintNow();
  }

  private paintWaiting(): void {
    if (this.view?.error) return;
    const pending = bootWaits(), files = pending.filter(wait => wait.kind === 'file');
    const wait = files[0] ?? pending.find(row => row.kind !== 'admission') ?? pending[0];
    const timeline = this.timeline.snapshot(), transfer = this.downloads.snapshot();
    const current = timeline.rows.find(row => row.key === timeline.current);
    const signature = `${timeline.current}:${timeline.rows.map(row => `${row.state}:${row.detail}`).join('|')}:${transfer.networkBytes}:${transfer.cachedBytes}:${this.downloads.progressVersion}:${wait?.id ?? 0}`;
    const quietMs = this.stall.quietMs(signature, performance.now());
    const stalled = !this.finished && quietMs >= 10_000;
    setData(this.root, 'stalled', String(stalled));
    setData(this.root, 'waiting', wait?.label ?? '');
    setData(this.root, 'filesInFlight', String(files.length));
    const label = wait?.label ?? current?.label ?? timeline.gaps.find(row => row.state === 'on')?.label ?? 'Final activation';
    const detail = wait === undefined ? `Now working on: ${label}` : `Now waiting for: ${label} · ${(wait.ageMs / 1000).toFixed(1)} s · ${files.length} files in flight${pending.length > 1 ? ` · ${pending.length} waits` : ''}`;
    set(this.els.foot, stalled ? `No reported progress for ${Math.floor(quietMs / 1000)} s · ${detail}` : detail);
  }

  /** Estimated scene texture allocation; render targets and the browser's own surfaces are outside this estimate. */
  setTextureBytes(bytes: number): void { this.textureBytes = bytes; this.paintDiagnostics(); }

  private paintDiagnostics(): void {
    const mem: unknown = Reflect.get(performance, 'memory');
    const heap: unknown = typeof mem === 'object' && mem !== null ? Reflect.get(mem, 'usedJSHeapSize') : undefined;
    const js = typeof heap === 'number' && Number.isFinite(heap) ? engineString('s_77edeca5d621', [Math.round(heap / 1048576)]) : engineString('s_80ff86e39352');
    const tex = this.textureBytes > 0 ? engineString('s_d28268aeb36d', [Math.round(this.textureBytes / 1048576)]) : '';
    const pause = this.longestPauseMs >= 100 ? engineString('s_f72e3c1c062c', [(this.longestPauseMs / 1000).toFixed(1)]) : engineString('s_911a92a8de1f');
    set(this.els.diagnostics, engineString('s_d6331a58cb42', [this.attempt, js, tex, pause, this.longestPauseAt ? engineString('s_46a39d7c2bfd', [this.longestPauseAt]) : '']));
  }

  /**
   * Complete the path, store its exclusive stage times, then fade out and resolve when gone.
   * it used to hold that for 350 ms and fade for 700 — a second of nothing between a built world and
   * the title menu, on every launch. The fade (loading.css) is 250 ms; the menu is live under it.
   */
  done(): Promise<void> {
    this.finished = true;
    const measured = Object.fromEntries(this.timeline.snapshot().rows.filter(row => row.state !== 'todo').map(row => [row.key, row.ms]));
    savePathTimings(this.timingKey, measured, this.baseline);
    if (this.view !== null) this.paint(this.view);
    return new Promise((resolve) => {
      this.root.classList.add('hide');
      this.scope.timeout(250, () => { this.scope.cancelRaf(this.raf); this.scope.dispose(); resolve(); });
    });
  }
}

/** Begin before product hydration; the session adopts this same panel and clock when its plan becomes available. */
export function beginLoading(chunk: { id: string; name: string; trace?: boolean }): Loading {
  if (currentLoading?.id === chunk.id && !currentLoading.loading.scope.disposed) return currentLoading.loading;
  currentLoading?.loading.scope.dispose();
  const loading = new Loading(chunk);
  currentLoading = { id: chunk.id, loading };
  loading.scope.onDispose(() => { if (currentLoading?.loading === loading) currentLoading = null; });
  return loading;
}


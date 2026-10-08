import { uiScope, mountUi } from './ownership';
import { engineString } from '../strings';
import { saveStorage } from '../saves/slots';
import { formatMB, type ProgressView } from '../boot/plan';
import { TIER } from '../core/tier';
import { loadShellTemplate } from '../boot/shell';
import { appIdentity } from '../app/identity';
import { lastEndLine } from '../boot/lastEnd';
import { recordBootCheckpoint, recordBootProgress, startBoot } from '../boot/bootTrace';
import { BOOT_STEPS } from '../boot/steps';
import './loading.css';

const savedStorage = saveStorage('session');

/**
 * Loading screen in the Wildshard staging identity — a painter of the boot plan's view
 * (src/engine/boot/plan.ts) and nothing else: two tracks (DOWNLOAD bytes read / declared, SETUP
 * weighted steps) as integers that read 100 only when the fraction is exactly 1, an elapsed
 * clock, and one row per step with its wall ms and live detail. Nothing here eases, animates
 * on a timer or guesses. `done()` fades it out and resolves when it is gone.
 *
 * Players (E140, the user's 4a) see only the shard's display name, one bar (both tracks, half each) and a short line;
 * the tracks, the step log, the tier line and "Loading chunk · <slug>" are developer mode's (`<html data-dev>`, set by
 * index.html before the first paint — src/engine/core/devMode.ts; loading.css does the hiding).
 */
type ElKey = 'clock' | 'dlFact' | 'dlPct' | 'dlBar' | 'suFact' | 'suPct' | 'suBar' | 'rows' | 'foot' | 'slug' | 'tier' | 'bar' | 'line' | 'diagnostics';

/** Write text only when it changed: an unchanged textContent write still dirties layout. */
const set = (el: HTMLElement, text: string): void => { if (el.textContent !== text) el.textContent = text; };

/** Renderer-independent admission facts; the caller owns its phases and actual byte counter. */
export interface LoadingAdmission {
  phase: string; detail: string; bytesRead: number; bytesTotal: number; filesDone: number; filesTotal: number;
}
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
  private longestPauseMs = 0;
  private longestPauseAt = '';
  private lastFrameStep = '';
  private textureBytes = 0;
  private readonly attempt: number;
  private admission: LoadingAdmission | null = null;
  private descriptorBytes = 0;
  private admittedBytes = 0;
  private admittedFiles = 0;
  private admissionUnits = 0;
  private hasProductAdmission = false;
  private moduleBytes = 0;
  private readonly admissionPhases = new Set<string>();

  constructor(chunk: { id: string; name: string; trace?: boolean }) {
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
    this.moduleBytes = Number(this.root.dataset['moduleBytes']) || 0;
    const startedAt = Number(this.root.dataset['startedAt']);
    if (Number.isFinite(startedAt) && startedAt >= 0 && startedAt <= performance.now()) this.t0 = startedAt;
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
    if (progress.phase === 'descriptor') this.descriptorBytes = progress.bytesRead;
    else if (progress.phase !== 'modules') { this.admittedBytes = progress.bytesRead; this.admittedFiles = progress.filesDone; }
    if (progress.phase !== 'modules') {
      this.hasProductAdmission = true;
      this.admissionUnits = Math.max(this.admissionUnits, progress.phase === 'complete' ? 4 : progress.phase === 'cache' ? 3 : progress.phase === 'validation' ? 2 : progress.phase === 'assets' || progress.phase === 'hash' ? 1 : 0);
    }
    this.root.dataset['step'] = `admission.${progress.phase}`;
    this.dirty = true;
  }

  /** Explain module/tier/SW waits before the first source denominator is known. */
  waiting(detail: string): void {
    this.paintAdmission({ phase: 'modules', detail, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0 });
  }

  /**
   * The plan publishes a view on every event (every byte chunk of every fetch, every sub-step); the
   * cheap attributes land at once (`data-step` is what the bench and the tests read), the text and
   * bars at most once per frame (`tickClock`) — the DOM writes and the layout they force were ~8 %
   * of a phone-tier load at 4× CPU (project/archive/2026-09-22-load-perf.md Status). Integers floor, so 100 means done.
   */
  paint(view: ProgressView): void {
    let v = view;
    if (this.hasProductAdmission || this.moduleBytes > 0) {
      const prior = this.moduleBytes + this.descriptorBytes + this.admittedBytes;
      const bytesRead = v.bytesRead + prior, bytesTotal = v.bytesTotal + prior;
      v = { ...v, bytesRead, bytesTotal, filesDone: v.filesDone + this.admittedFiles + (this.descriptorBytes > 0 ? 1 : 0), filesTotal: v.filesTotal + this.admittedFiles + (this.descriptorBytes > 0 ? 1 : 0),
        download: v.done ? 1 : bytesTotal > 0 ? Math.min(0.999, bytesRead / bytesTotal) : v.download,
        setup: this.hasProductAdmission ? (v.setup * BOOT_STEPS.length + this.admissionUnits) / (BOOT_STEPS.length + 4) : v.setup };
    }
    const hardware: { hardwareConcurrency?: number | undefined } = navigator;
    this.els.tier.textContent = engineString('s_783b614ae363', [TIER, Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio), hardware.hardwareConcurrency ?? engineString('s_8a8de823d5ed'), window.__ws_sw ? engineString('s_5c75b0e90774') : '']);
    this.view = v;
    recordBootProgress(v);
    this.dirty = true;
    const pct = (f: number): string => String(Math.floor(f * 100));
    this.root.dataset['download'] = pct(v.download);
    this.root.dataset['setup'] = pct(v.setup);
    this.root.dataset['step'] = v.step;
    if (v.error) { this.els.foot.textContent = v.error; this.paintNow(); }
    else if (v.done) this.paintNow();
  }

  /** Text + bars from the latest view; only what changed is written (a write forces the next layout). */
  private paintNow(): void {
    if (!this.dirty) return;
    const v = this.view;
    if (!v) { this.paintAdmissionNow(); return; }
    this.dirty = false;
    const pct = (f: number): string => String(Math.floor(f * 100));
    set(this.els.dlPct, pct(v.download));
    set(this.els.suPct, pct(v.setup));
    const dl = `${(v.download * 100).toFixed(1)}%`, su = `${(v.setup * 100).toFixed(1)}%`;
    if (this.els.dlBar.style.width !== dl) this.els.dlBar.style.width = dl;
    if (this.els.suBar.style.width !== su) this.els.suBar.style.width = su;
    // the player's one bar: download and setup, half each (each only grows, so the sum does); 100 only when both are
    const all = (v.download + v.setup) / 2, allW = `${(all * 100).toFixed(1)}%`;
    if (this.els.bar.style.width !== allW) this.els.bar.style.width = allW;
    set(this.els.line, v.done ? engineString('s_5fa7aac5375c') : engineString('s_bf5e849564ae', [v.download < 1 ? engineString('s_37b345555d7e') : engineString('s_080cd8d3b901'), pct(all)]));
    set(this.els.dlFact, v.bytesTotal > 0
      ? engineString('s_9efb7c208f96', [formatMB(v.bytesRead), formatMB(v.bytesTotal), v.filesDone, v.filesTotal, v.bytes && v.bytes.done < v.bytes.total ? engineString('s_614cafefe4f0', [v.bytes.label]) : ''])
      : engineString('s_387d49323b0f'));
    set(this.els.suFact, engineString('s_af18899b96b3', [Math.min(v.doneCount + 1, v.rows.length), v.rows.length, v.label, v.detail ? engineString('s_614cafefe4f0', [v.detail]) : '']));
    this.paintRows();
  }

  private paintAdmissionNow(): void {
    const p = this.admission;
    if (p === null) return;
    this.dirty = false;
    const read = this.moduleBytes + this.descriptorBytes + this.admittedBytes;
    const total = p.phase === 'modules' && this.admissionUnits === 4 ? read : p.bytesTotal > 0 ? this.moduleBytes + (p.phase === 'descriptor' ? p.bytesTotal : this.descriptorBytes + p.bytesTotal) : 0;
    const download = total > 0 ? Math.min(0.999, read / total) : 0;
    const setup = this.admissionUnits / (BOOT_STEPS.length + 4);
    this.root.dataset['download'] = String(Math.floor(download * 100));
    this.root.dataset['setup'] = String(Math.floor(setup * 100));
    set(this.els.dlPct, String(Math.floor(download * 100))); set(this.els.suPct, String(Math.floor(setup * 100)));
    this.els.dlBar.style.width = `${download * 100}%`; this.els.suBar.style.width = `${setup * 100}%`;
    this.els.bar.style.width = `${(download + setup) * 50}%`;
    set(this.els.dlFact, `${formatMB(read)} read${total > 0 ? ` / ${formatMB(total)}` : ' · total pending'} · ${p.filesDone} / ${p.filesTotal} files`);
    set(this.els.suFact, p.detail); set(this.els.line, p.detail);
  }

  private paintRows(): void {
    const v = this.view; if (!v) return;
    // every step that has started, newest last; todo steps are not rows (nothing to say about them yet)
    const shown = v.rows.filter((r) => r.state !== 'todo');
    while (this.rowsEl.children.length < shown.length) { const d = document.createElement('div'); d.innerHTML = engineString('s_a9fadf880555'); this.rowsEl.append(d); }
    shown.forEach((r, i) => {
      const el = this.rowsEl.children[i] as HTMLElement;
      const cls = r.state === 'on' ? 'on' : 'ok';
      if (el.className !== cls) el.className = cls;
      set(el.children[0] as HTMLElement, engineString('s_dd0d06d0c0aa', [r.label]));
      set(el.children[1] as HTMLElement, r.detail);
      const ms = r.state === 'on' ? performance.now() - r.t0 : r.ms;
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
    const s = (now - this.t0) / 1000;
    set(this.els.clock, engineString('s_c0951c6055b1', [String(Math.floor(s / 60)).padStart(2, '0'), (s % 60).toFixed(1).padStart(4, '0')]));
    // the running step's ms is live: repaint rows so its clock moves without a plan event
    if (this.dirty) this.paintNow();
    else if (this.view && !this.view.done) this.paintRows();
  }

  /** Estimated scene texture allocation; render targets and the browser's own surfaces are outside this estimate. */
  setTextureBytes(bytes: number): void { this.textureBytes = bytes; this.paintDiagnostics(); }

  private paintDiagnostics(): void {
    const mem: unknown = Reflect.get(performance, 'memory');
    const heap: unknown = typeof mem === 'object' && mem !== null ? Reflect.get(mem, 'usedJSHeapSize') : undefined;
    const js = typeof heap === 'number' && Number.isFinite(heap) ? engineString('s_77edeca5d621', [Math.round(heap / 1048576)]) : engineString('s_80ff86e39352');
    const tex = this.textureBytes > 0 ? engineString('s_d28268aeb36d', [Math.round(this.textureBytes / 1048576)]) : '';
    const pause = this.longestPauseMs >= 100 ? engineString('s_f72e3c1c062c', [(this.longestPauseMs / 1000).toFixed(1)]) : engineString('s_911a92a8de1f');
    set(this.els.diagnostics, engineString('s_d6331a58cb42', [this.attempt, js, tex, pause, this.longestPauseAt ? engineString('s_46a39d7c2bfd', [this.longestPauseAt]) : '', lastEndLine()]));
  }

  /**
   * Fade out and resolve when gone. The panel already shows 100 / 100 (painted by the plan's done());
   * it used to hold that for 350 ms and fade for 700 — a second of nothing between a built world and
   * the title menu, on every launch. The fade (loading.css) is 250 ms; the menu is live under it.
   */
  done(): Promise<void> {
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


import { getActiveChunk } from '../chunks/registry';
import { formatMB, type ProgressView } from '../boot/plan';
import { TIER } from '../core/tier';
import { PERFLOAD, barTrace } from '../boot/perflog';
import './loading.css';

/**
 * Loading screen in the Wildshard staging identity — a painter of the boot plan's view
 * (src/boot/plan.ts) and nothing else: two tracks (DOWNLOAD bytes read / declared, SETUP
 * weighted steps) as integers that read 100 only when the fraction is exactly 1, an elapsed
 * clock, and one row per step with its wall ms and live detail. Nothing here eases, animates
 * on a timer or guesses. `done()` fades it out and resolves when it is gone.
 */
type ElKey = 'clock' | 'dlFact' | 'dlPct' | 'dlBar' | 'suFact' | 'suPct' | 'suBar' | 'rows' | 'foot';

/** Write text only when it changed: an unchanged textContent write still dirties layout. */
const set = (el: HTMLElement, text: string): void => { if (el.textContent !== text) el.textContent = text; };

export class Loading {
  root: HTMLElement;
  private els: Record<ElKey, HTMLElement>;
  private rowsEl: HTMLElement;
  private t0 = performance.now();
  private raf = 0;
  private view: ProgressView | null = null;
  private dirty = false;

  constructor() {
    const chunk = getActiveChunk();
    const nav: { hardwareConcurrency?: number | undefined } = navigator; // Safari < 15.4 has no hardwareConcurrency
    this.root = document.createElement('div');
    this.root.className = 'ws-load';
    this.root.innerHTML = `
      <div class="ws-load-head">
        <div class="ws-wordmark">Project <b>Wildshard</b></div>
        <div class="ws-load-tagline">A world that does not exist yet, arriving one chunk at a time.</div>
      </div>
      <div class="ws-load-body">
        <div class="ws-glass ws-load-panel">
          <div class="ws-load-title">Loading chunk · <b>${chunk.slug}</b><span class="ws-load-clock" data-el="clock">00:00.0</span></div>
          <div class="ws-load-meta ws-load-meta-1">
            <div><span>tier</span><span>${TIER} · ${Math.round(innerWidth * devicePixelRatio)}×${Math.round(innerHeight * devicePixelRatio)} · ${nav.hardwareConcurrency ?? '?'} cores${window.__ws_sw ? ' · offline cache' : ''}</span></div>
          </div>
          <div class="ws-load-track">
            <div class="ws-load-track-row"><span class="ws-load-track-name">download</span><span class="ws-load-track-fact" data-el="dlFact">—</span><span class="ws-load-track-pct" data-el="dlPct">0</span></div>
            <div class="ws-load-bar"><div class="ws-load-fill" data-el="dlBar"></div></div>
          </div>
          <div class="ws-load-track">
            <div class="ws-load-track-row"><span class="ws-load-track-name">setup</span><span class="ws-load-track-fact" data-el="suFact">—</span><span class="ws-load-track-pct" data-el="suPct">0</span></div>
            <div class="ws-load-bar"><div class="ws-load-fill" data-el="suBar"></div></div>
          </div>
          <div class="ws-load-log" data-el="rows"></div>
        </div>
      </div>
      <div class="ws-load-foot"><span>local build · unuploaded</span><span data-el="foot">an in-progress private project</span></div>`;
    document.body.append(this.root);
    const el = (key: ElKey): HTMLElement => { const e = this.root.querySelector<HTMLElement>(`[data-el="${key}"]`); if (!e) throw new Error(`Loading: no [data-el="${key}"]`); return e; };
    this.els = { clock: el('clock'), dlFact: el('dlFact'), dlPct: el('dlPct'), dlBar: el('dlBar'), suFact: el('suFact'), suPct: el('suPct'), suBar: el('suBar'), rows: el('rows'), foot: el('foot') };
    this.rowsEl = this.els.rows;
    const tick = (): void => { this.tickClock(); this.raf = requestAnimationFrame(tick); };
    tick();
  }

  /**
   * The plan publishes a view on every event (every byte chunk of every fetch, every sub-step); the
   * cheap attributes land at once (`data-step` is what the bench and the tests read), the text and
   * bars at most once per frame (`tickClock`) — the DOM writes and the layout they force were ~8 %
   * of a phone-tier load at 4× CPU (docs/plans/LOAD-PERF.md Status). Integers floor, so 100 means done.
   */
  paint(v: ProgressView): void {
    this.view = v;
    this.dirty = true;
    if (PERFLOAD) barTrace.push([Math.round(performance.now() - this.t0), v.setup, v.download, v.step]);
    const pct = (f: number): string => String(Math.floor(f * 100));
    this.root.dataset['download'] = pct(v.download);
    this.root.dataset['setup'] = pct(v.setup);
    this.root.dataset['step'] = v.step;
    if (v.error) { this.els.foot.textContent = v.error; this.paintNow(); }
    else if (v.done) this.paintNow();
  }

  /** Text + bars from the latest view; only what changed is written (a write forces the next layout). */
  private paintNow(): void {
    const v = this.view; if (!v || !this.dirty) return;
    this.dirty = false;
    const pct = (f: number): string => String(Math.floor(f * 100));
    set(this.els.dlPct, pct(v.download));
    set(this.els.suPct, pct(v.setup));
    const dl = `${(v.download * 100).toFixed(1)}%`, su = `${(v.setup * 100).toFixed(1)}%`;
    if (this.els.dlBar.style.width !== dl) this.els.dlBar.style.width = dl;
    if (this.els.suBar.style.width !== su) this.els.suBar.style.width = su;
    set(this.els.dlFact, v.bytesTotal > 0
      ? `${formatMB(v.bytesRead)} / ${formatMB(v.bytesTotal)} · ${v.filesDone} / ${v.filesTotal} files${v.bytes && v.bytes.done < v.bytes.total ? ` · ${v.bytes.label}` : ''}`
      : 'nothing declared');
    set(this.els.suFact, `step ${Math.min(v.doneCount + 1, v.rows.length)} / ${v.rows.length} · ${v.label}${v.detail ? ` · ${v.detail}` : ''}`);
    this.paintRows();
  }

  private paintRows(): void {
    const v = this.view; if (!v) return;
    // every step that has started, newest last; todo steps are not rows (nothing to say about them yet)
    const shown = v.rows.filter((r) => r.state !== 'todo');
    while (this.rowsEl.children.length < shown.length) { const d = document.createElement('div'); d.innerHTML = '<span class="ws-load-row-label"></span><span class="ws-load-row-detail"></span><span class="ws-load-row-ms"></span>'; this.rowsEl.append(d); }
    shown.forEach((r, i) => {
      const el = this.rowsEl.children[i] as HTMLElement;
      const cls = r.state === 'on' ? 'on' : 'ok';
      if (el.className !== cls) el.className = cls;
      set(el.children[0] as HTMLElement, `▸ ${r.label}`);
      set(el.children[1] as HTMLElement, r.detail);
      const ms = r.state === 'on' ? performance.now() - r.t0 : r.ms;
      set(el.children[2] as HTMLElement, ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
    });
  }

  private tickClock(): void {
    const s = (performance.now() - this.t0) / 1000;
    set(this.els.clock, `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`);
    // the running step's ms is live: repaint rows so its clock moves without a plan event
    if (this.dirty) this.paintNow();
    else if (this.view && !this.view.done) this.paintRows();
  }

  /**
   * Fade out and resolve when gone. The panel already shows 100 / 100 (painted by the plan's done());
   * it used to hold that for 350 ms and fade for 700 — a second of nothing between a built world and
   * the title menu, on every launch. The fade (loading.css) is 250 ms; the menu is live under it.
   */
  done(): Promise<void> {
    return new Promise((resolve) => {
      this.root.classList.add('hide');
      setTimeout(() => { cancelAnimationFrame(this.raf); this.root.remove(); resolve(); }, 250);
    });
  }
}
